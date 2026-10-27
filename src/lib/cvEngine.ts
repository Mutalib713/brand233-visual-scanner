import descriptorsData from '../data/descriptors.json';
import familiesData from '../data/families.json';
import catalogData from '../data/catalog.json';

export interface ProductVariant {
  id: number;
  sku: string;
  name: string;
  family: string;
  color: string;
  colorHex: string;
  category: string;
  categoryId: number | null;
  costPrice: number;
  sellingPrice: number;
  retailStock: number;
  warehouseStock: number;
  totalStock: number;
  imageUrl: string | null;
  hasImage: boolean;
}

export interface ProductFamily {
  family: string;
  category: string;
  referenceImages: string[];
  variants: ProductVariant[];
}

export interface ImageDescriptor {
  family: string;
  dHashH: string;
  dHashV: string;
  aspectRatio: number;
  width: number;
  height: number;
  dominantColor: string;
  swatch: string;
}

export interface ColorExtractionResult {
  colorName: string;
  swatchHex: string;
  confidence: 'high' | 'medium' | 'low';
  secondaryColors: { name: string; percentage: number; hex: string }[];
}

export interface MatchCandidate {
  family: string;
  category: string;
  shapeScore: number; // 0 to 100
  referenceImage: string;
  recommendedVariant: ProductVariant;
  otherVariants: ProductVariant[];
  matchStrength: 'Strong match' | 'Possible match' | 'Needs confirmation';
  evidence: {
    shapeMatchPercent: number;
    detectedColor: string;
    variantColor: string;
    colorMatched: boolean;
    aspectRatioDiff: number;
  };
}

export interface ScanResult {
  detectedColor: ColorExtractionResult;
  topMatch: MatchCandidate | null;
  otherCandidates: MatchCandidate[];
  processingTimeMs: number;
}

// Compute Hamming distance between two binary strings
function hammingDistance(str1: string, str2: string): number {
  let dist = 0;
  const len = Math.min(str1.length, str2.length);
  for (let i = 0; i < len; i++) {
    if (str1[i] !== str2[i]) dist++;
  }
  return dist + Math.abs(str1.length - str2.length);
}

// Calculate Difference Hashes from HTML Canvas
export function computeCanvasDHashes(
  sourceCanvas: HTMLCanvasElement,
  crop?: { x: number; y: number; width: number; height: number }
): { dHashH: string; dHashV: string; aspectRatio: number } {
  const cropX = crop ? crop.x : 0;
  const cropY = crop ? crop.y : 0;
  const cropW = crop ? crop.width : sourceCanvas.width;
  const cropH = crop ? crop.height : sourceCanvas.height;
  const aspectRatio = Number((cropW / cropH).toFixed(3));

  // 1. Horizontal Hash (17x16)
  const hCanvas = document.createElement('canvas');
  hCanvas.width = 17;
  hCanvas.height = 16;
  const hCtx = hCanvas.getContext('2d')!;
  hCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, 17, 16);
  const hData = hCtx.getImageData(0, 0, 17, 16).data;

  const hDiff: string[] = [];
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const idx1 = (r * 17 + c) * 4;
      const idx2 = (r * 17 + (c + 1)) * 4;
      const l1 = 0.299 * hData[idx1] + 0.587 * hData[idx1 + 1] + 0.114 * hData[idx1 + 2];
      const l2 = 0.299 * hData[idx2] + 0.587 * hData[idx2 + 1] + 0.114 * hData[idx2 + 2];
      hDiff.push(l1 > l2 ? '1' : '0');
    }
  }

  // 2. Vertical Hash (16x17)
  const vCanvas = document.createElement('canvas');
  vCanvas.width = 16;
  vCanvas.height = 17;
  const vCtx = vCanvas.getContext('2d')!;
  vCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, 16, 17);
  const vData = vCtx.getImageData(0, 0, 16, 17).data;

  const vDiff: string[] = [];
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const idx1 = (r * 16 + c) * 4;
      const idx2 = ((r + 1) * 16 + c) * 4;
      const l1 = 0.299 * vData[idx1] + 0.587 * vData[idx1 + 1] + 0.114 * vData[idx1 + 2];
      const l2 = 0.299 * vData[idx2] + 0.587 * vData[idx2 + 1] + 0.114 * vData[idx2 + 2];
      vDiff.push(l1 > l2 ? '1' : '0');
    }
  }

  return {
    dHashH: hDiff.join(''),
    dHashV: vDiff.join(''),
    aspectRatio
  };
}

// Extract dominant object color from canvas with background rejection and foreground isolation
export function extractCanvasColor(
  sourceCanvas: HTMLCanvasElement,
  crop?: { x: number; y: number; width: number; height: number }
): ColorExtractionResult {
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 100;
  sampleCanvas.height = 100;
  const ctx = sampleCanvas.getContext('2d')!;

  const cropX = crop ? crop.x : 0;
  const cropY = crop ? crop.y : 0;
  const cropW = crop ? crop.width : sourceCanvas.width;
  const cropH = crop ? crop.height : sourceCanvas.height;

  // Draw crop into 100x100
  ctx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, 100, 100);
  const fullData = ctx.getImageData(0, 0, 100, 100).data;

  // 1. Sample 4 corner regions for background profile
  const cornerIndices = [
    (5 * 100 + 5) * 4,
    (5 * 100 + 95) * 4,
    (95 * 100 + 5) * 4,
    (95 * 100 + 95) * 4
  ];
  let bgR = 0, bgG = 0, bgB = 0;
  for (const idx of cornerIndices) {
    bgR += fullData[idx];
    bgG += fullData[idx + 1];
    bgB += fullData[idx + 2];
  }
  bgR /= 4; bgG /= 4; bgB /= 4;

  // 2. Sample foreground center column/box (x: 30% to 70%, y: 25% to 75%)
  const fgPixels: { r: number; g: number; b: number; dist: number }[] = [];
  for (let y = 25; y < 75; y += 2) {
    for (let x = 30; x < 70; x += 2) {
      const idx = (y * 100 + x) * 4;
      const r = fullData[idx];
      const g = fullData[idx + 1];
      const b = fullData[idx + 2];
      const a = fullData[idx + 3];
      if (a < 128) continue;

      // Color distance from corner background
      const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
      fgPixels.push({ r, g, b, dist });
    }
  }

  // Filter pixels that contrast most with the background
  fgPixels.sort((a, b) => b.dist - a.dist);
  const topCount = Math.max(1, Math.floor(fgPixels.length * 0.6));
  const topPixels = fgPixels.slice(0, topCount);

  let avgR = 0, avgG = 0, avgB = 0;
  for (const p of topPixels) {
    avgR += p.r; avgG += p.g; avgB += p.b;
  }
  avgR = Math.round(avgR / topCount);
  avgG = Math.round(avgG / topCount);
  avgB = Math.round(avgB / topCount);

  const rf = avgR / 255.0;
  const gf = avgG / 255.0;
  const bf = avgB / 255.0;
  const cmax = Math.max(rf, gf, bf);
  const cmin = Math.min(rf, gf, bf);
  const delta = cmax - cmin;
  const v = cmax;
  const s = cmax === 0 ? 0 : delta / cmax;

  let colorName = 'Grey';
  if (avgR > 185 && avgG > 185 && avgB > 185) {
    colorName = 'White';
  } else if (avgR < 65 && avgG < 65 && avgB < 65) {
    colorName = 'Black';
  } else if (s < 0.20) {
    colorName = 'Grey';
  } else {
    let hDeg = 0;
    if (delta !== 0) {
      if (cmax === rf) {
        hDeg = ((60 * ((gf - bf) / delta) + 360) % 360);
      } else if (cmax === gf) {
        hDeg = ((60 * ((bf - rf) / delta) + 120) % 360);
      } else {
        hDeg = ((60 * ((rf - gf) / delta) + 240) % 360);
      }
    }

    if (hDeg >= 345 || hDeg < 15) colorName = 'Red';
    else if (hDeg >= 15 && hDeg < 42) colorName = 'Orange';
    else if (hDeg >= 42 && hDeg < 68) colorName = v < 0.7 ? 'Gold' : 'Yellow';
    else if (hDeg >= 68 && hDeg < 165) colorName = 'Green';
    else if (hDeg >= 165 && hDeg < 195) colorName = 'Teal';
    else if (hDeg >= 195 && hDeg < 255) colorName = 'Blue';
    else if (hDeg >= 255 && hDeg < 295) colorName = 'Purple';
    else colorName = 'Pink';
  }

  const swatchHex = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;

  return {
    colorName,
    swatchHex,
    confidence: 'high',
    secondaryColors: []
  };
}

// Main Matching Service: Evaluates query image against catalogue descriptors
export function matchProductImage(
  sourceCanvas: HTMLCanvasElement,
  crop?: { x: number; y: number; width: number; height: number }
): ScanResult {
  const startTime = performance.now();

  const { dHashH, dHashV, aspectRatio } = computeCanvasDHashes(sourceCanvas, crop);
  const colorResult = extractCanvasColor(sourceCanvas, crop);

  const descriptors = descriptorsData as Record<string, ImageDescriptor>;
  const families = familiesData as ProductFamily[];
  const familiesMap = new Map<string, ProductFamily>();
  families.forEach(f => familiesMap.set(f.family, f));

  // Score each reference image
  interface ScoredImage {
    family: string;
    refImage: string;
    shapeSimilarity: number;
    aspectRatioDiff: number;
  }

  const scoredImages: ScoredImage[] = [];

  for (const [refImage, desc] of Object.entries(descriptors)) {
    // 512 total bits (256 horizontal + 256 vertical)
    const distH = hammingDistance(dHashH, desc.dHashH);
    const distV = hammingDistance(dHashV, desc.dHashV);
    const totalDist = distH + distV;
    const maxDist = 512;

    // Raw shape similarity 0 to 100
    let similarity = Math.max(0, 100 - (totalDist / maxDist) * 100 * 2.2);

    // Aspect ratio penalty if orientation differs drastically
    const arDiff = Math.abs(aspectRatio - desc.aspectRatio);
    if (arDiff > 0.8) {
      similarity -= 20;
    } else if (arDiff > 0.4) {
      similarity -= 10;
    }

    scoredImages.push({
      family: desc.family,
      refImage,
      shapeSimilarity: Math.max(5, Math.round(similarity)),
      aspectRatioDiff: arDiff
    });
  }

  // Group by family and find best score for each family
  const familyBestScores = new Map<string, ScoredImage>();
  for (const item of scoredImages) {
    const existing = familyBestScores.get(item.family);
    if (!existing || item.shapeSimilarity > existing.shapeSimilarity) {
      familyBestScores.set(item.family, item);
    }
  }

  // Rank candidate families and resolve variants
  const candidates: MatchCandidate[] = [];

  for (const [familyName, bestImg] of familyBestScores.entries()) {
    const fam = familiesMap.get(familyName);
    if (!fam || fam.variants.length === 0) continue;

    // Find best variant in this family
    let bestVariant = fam.variants[0];
    let colorMatched = false;

    // Check if any variant matches the detected color
    const detectedLower = colorResult.colorName.toLowerCase();
    const colorMatch = fam.variants.find(v => v.color.toLowerCase() === detectedLower);

    if (colorMatch) {
      bestVariant = colorMatch;
      colorMatched = true;
    } else {
      // If no exact color match, pick the variant that has an image or first
      bestVariant = fam.variants.find(v => v.hasImage) || fam.variants[0];
    }

    const otherVariants = fam.variants.filter(v => v.id !== bestVariant.id);

    // Combined score: shape + color bonus
    let finalScore = bestImg.shapeSimilarity;
    if (colorMatched) {
      finalScore = Math.min(99, finalScore + 15);
    }

    let matchStrength: 'Strong match' | 'Possible match' | 'Needs confirmation' = 'Needs confirmation';
    if (finalScore >= 75) {
      matchStrength = 'Strong match';
    } else if (finalScore >= 55) {
      matchStrength = 'Possible match';
    }

    candidates.push({
      family: fam.family,
      category: fam.category,
      shapeScore: finalScore,
      referenceImage: bestImg.refImage,
      recommendedVariant: bestVariant,
      otherVariants,
      matchStrength,
      evidence: {
        shapeMatchPercent: bestImg.shapeSimilarity,
        detectedColor: colorResult.colorName,
        variantColor: bestVariant.color,
        colorMatched,
        aspectRatioDiff: bestImg.aspectRatioDiff
      }
    });
  }

  // Sort descending by score
  candidates.sort((a, b) => b.shapeScore - a.shapeScore);

  const topMatch = candidates[0] || null;
  const otherCandidates = candidates.slice(1, 6);

  const endTime = performance.now();

  return {
    detectedColor: colorResult,
    topMatch,
    otherCandidates,
    processingTimeMs: Math.round(endTime - startTime)
  };
}

export { catalogData, familiesData };
