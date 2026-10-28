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
  dhash: string;
  ahash: string;
  hist: number[];
  aspectRatio: number;
  dominantColor: string;
  swatch: string;
}

export interface ColorExtractionResult {
  colorName: string;
  swatchHex: string;
  confidence: 'high' | 'medium' | 'low';
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
    colorCompositionPercent: number;
    detectedColor: string;
    variantColor: string;
    colorMatched: boolean;
    aspectRatioDiff: number;
  };
}

export interface ScanResult {
  matchStatus: 'matched' | 'no_match';
  detectedColor: ColorExtractionResult;
  topMatch: MatchCandidate | null;
  otherCandidates: MatchCandidate[];
  weakCandidates: MatchCandidate[];
  processingTimeMs: number;
  rejectionReason?: string;
}

const BIN_NAMES: Record<number, [string, string]> = {
  0: ['Red', '#DC2626'],
  1: ['Orange', '#F97316'],
  2: ['Gold', '#EAB308'],
  3: ['Green', '#16A34A'],
  4: ['Green', '#16A34A'],
  5: ['Teal', '#0D9488'],
  6: ['Blue', '#2563EB'],
  7: ['Blue', '#1D4ED8'],
  8: ['Purple', '#9333EA'],
  9: ['Purple', '#7E22CE'],
  10: ['Pink', '#EC4899'],
  11: ['Pink', '#DB2777'],
  12: ['Black', '#1E293B'],
  13: ['Grey', '#475569'],
  14: ['Grey', '#94A3B8'],
  15: ['White', '#FFFFFF']
};

function hamming(s1: string, s2: string): number {
  let dist = 0;
  const len = Math.min(s1.length, s2.length);
  for (let i = 0; i < len; i++) {
    if (s1[i] !== s2[i]) dist++;
  }
  return dist + Math.abs(s1.length - s2.length);
}

// Extract multi-feature signature from canvas
export function extractCanvasSignature(
  sourceCanvas: HTMLCanvasElement,
  crop?: { x: number; y: number; width: number; height: number }
): {
  dhash: string;
  ahash: string;
  hist: number[];
  aspectRatio: number;
  dominantColor: string;
  swatch: string;
} {
  const cropX = crop ? crop.x : 0;
  const cropY = crop ? crop.y : 0;
  const cropW = crop ? crop.width : sourceCanvas.width;
  const cropH = crop ? crop.height : sourceCanvas.height;
  const aspectRatio = Number((cropW / cropH).toFixed(2));

  // 1. Draw into a standard 100x100 canvas for fast pixel sampling
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 100;
  sampleCanvas.height = 100;
  const ctx = sampleCanvas.getContext('2d')!;
  ctx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, 100, 100);
  const imgData = ctx.getImageData(0, 0, 100, 100).data;

  // Background sampling from 4 corners
  const cornerIdxs = [
    (5 * 100 + 5) * 4,
    (5 * 100 + 95) * 4,
    (95 * 100 + 5) * 4,
    (95 * 100 + 95) * 4
  ];
  let bgR = 0, bgG = 0, bgB = 0;
  for (const idx of cornerIdxs) {
    bgR += imgData[idx];
    bgG += imgData[idx + 1];
    bgB += imgData[idx + 2];
  }
  bgR /= 4; bgG /= 4; bgB /= 4;

  // 16-bin color histogram
  const hist = new Array(16).fill(0);
  let totalFg = 0;
  let fgR = 0, fgG = 0, fgB = 0;

  for (let y = 10; y < 90; y += 2) {
    for (let x = 10; x < 90; x += 2) {
      const idx = (y * 100 + x) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      const a = imgData[idx + 3];
      if (a < 128) continue;

      const bgDist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
      if (bgDist > 25) {
        totalFg++;
        fgR += r; fgG += g; fgB += b;

        const rf = r / 255.0;
        const gf = g / 255.0;
        const bf = b / 255.0;
        const cmax = Math.max(rf, gf, bf);
        const cmin = Math.min(rf, gf, bf);
        const delta = cmax - cmin;
        const v = cmax;
        const s = cmax === 0 ? 0 : delta / cmax;

        if (s < 0.22) {
          if (v > 0.78) hist[15]++;      // White
          else if (v > 0.45) hist[14]++; // Light grey
          else if (v > 0.22) hist[13]++; // Dark grey
          else hist[12]++;               // Black
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
          const binIdx = Math.floor(hDeg / 30) % 12;
          hist[binIdx]++;
        }
      }
    }
  }

  // Normalize histogram
  if (totalFg > 0) {
    for (let i = 0; i < 16; i++) {
      hist[i] = Number((hist[i] / totalFg).toFixed(4));
    }
  }

  // Determine dominant color from peak histogram bin
  let domColor = 'White';
  let domSwatch = '#FFFFFF';
  let colorMass = 0;
  for (let i = 0; i < 12; i++) colorMass += hist[i];

  if (colorMass >= 0.18) {
    let peakIdx = 0;
    let maxVal = -1;
    for (let i = 0; i < 12; i++) {
      if (hist[i] > maxVal) {
        maxVal = hist[i];
        peakIdx = i;
      }
    }
    const [name, swatch] = BIN_NAMES[peakIdx];
    domColor = name;
    domSwatch = swatch;
  } else {
    // Peak neutral
    const neutralBins = [12, 13, 14, 15];
    let peakIdx = 15;
    let maxVal = -1;
    for (const b of neutralBins) {
      if (hist[b] > maxVal) {
        maxVal = hist[b];
        peakIdx = b;
      }
    }
    const [name, swatch] = BIN_NAMES[peakIdx];
    domColor = name;
    domSwatch = swatch;
  }

  // If we collected foreground pixels, calculate real average swatch
  if (totalFg > 0) {
    const avgR = Math.round(fgR / totalFg);
    const avgG = Math.round(fgG / totalFg);
    const avgB = Math.round(fgB / totalFg);
    domSwatch = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
  }

  // 2. Compute 8x8 dHash (9x8 canvas)
  const dCanvas = document.createElement('canvas');
  dCanvas.width = 9;
  dCanvas.height = 8;
  const dCtx = dCanvas.getContext('2d')!;
  dCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, 9, 8);
  const dData = dCtx.getImageData(0, 0, 9, 8).data;
  const dhashArr: string[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const idx1 = (r * 9 + c) * 4;
      const idx2 = (r * 9 + (c + 1)) * 4;
      const l1 = 0.299 * dData[idx1] + 0.587 * dData[idx1 + 1] + 0.114 * dData[idx1 + 2];
      const l2 = 0.299 * dData[idx2] + 0.587 * dData[idx2 + 1] + 0.114 * dData[idx2 + 2];
      dhashArr.push(l1 > l2 ? '1' : '0');
    }
  }

  // 3. Compute 8x8 aHash (8x8 canvas)
  const aCanvas = document.createElement('canvas');
  aCanvas.width = 8;
  aCanvas.height = 8;
  const aCtx = aCanvas.getContext('2d')!;
  aCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, 8, 8);
  const aData = aCtx.getImageData(0, 0, 8, 8).data;
  let lumSum = 0;
  const lums: number[] = [];
  for (let i = 0; i < 64; i++) {
    const idx = i * 4;
    const l = 0.299 * aData[idx] + 0.587 * aData[idx + 1] + 0.114 * aData[idx + 2];
    lums.push(l);
    lumSum += l;
  }
  const avgLum = lumSum / 64;
  const ahashArr = lums.map(l => (l > avgLum ? '1' : '0'));

  return {
    dhash: dhashArr.join(''),
    ahash: ahashArr.join(''),
    hist,
    aspectRatio,
    dominantColor: domColor,
    swatch: domSwatch
  };
}

// Main Matching Engine
export function matchProductImage(
  sourceCanvas: HTMLCanvasElement,
  crop?: { x: number; y: number; width: number; height: number }
): ScanResult {
  const startTime = performance.now();

  const querySig = extractCanvasSignature(sourceCanvas, crop);
  const descriptors = descriptorsData as Record<string, ImageDescriptor>;
  const families = familiesData as ProductFamily[];
  const familiesMap = new Map<string, ProductFamily>();
  families.forEach(f => familiesMap.set(f.family, f));

  interface ScoredRef {
    family: string;
    refImage: string;
    totalScore: number;
    shapeSimilarity: number;
    colorComposition: number;
    aspectRatioDiff: number;
  }

  const scoredRefs: ScoredRef[] = [];

  for (const [refImage, desc] of Object.entries(descriptors)) {
    // 1. Color Histogram Intersection (0.0 to 1.0)
    let histSim = 0;
    for (let i = 0; i < 16; i++) {
      histSim += Math.min(querySig.hist[i] || 0, desc.hist[i] || 0);
    }

    // 2. dHash similarity (64 bits)
    const dDist = hamming(querySig.dhash, desc.dhash);
    const dSim = Math.max(0.0, 1.0 - dDist / 64.0);

    // 3. aHash similarity (64 bits)
    const aDist = hamming(querySig.ahash, desc.ahash);
    const aSim = Math.max(0.0, 1.0 - aDist / 64.0);

    // 4. Aspect Ratio compatibility
    const arDiff = Math.abs(querySig.aspectRatio - desc.aspectRatio);
    const arSim = Math.max(0.0, 1.0 - arDiff / 1.5);

    // Multi-feature weighted score:
    // Shape/Silhouette: 50% (dHash: 25%, aHash: 25%)
    // Color Histogram Intersection: 35%
    // Aspect Ratio: 15%
    const combinedScore = (
      (dSim * 0.25 + aSim * 0.25) +
      (histSim * 0.35) +
      (arSim * 0.15)
    ) * 100.0;

    scoredRefs.push({
      family: desc.family,
      refImage,
      totalScore: Math.round(combinedScore),
      shapeSimilarity: Math.round((dSim * 0.5 + aSim * 0.5) * 100),
      colorComposition: Math.round(histSim * 100),
      aspectRatioDiff: Number(arDiff.toFixed(2))
    });
  }

  // Group by family and find highest score for each family
  const familyBest = new Map<string, ScoredRef>();
  for (const item of scoredRefs) {
    const existing = familyBest.get(item.family);
    if (!existing || item.totalScore > existing.totalScore) {
      familyBest.set(item.family, item);
    }
  }

  // Resolve variants within candidate families
  const candidates: MatchCandidate[] = [];

  for (const [familyName, bestRef] of familyBest.entries()) {
    const fam = familiesMap.get(familyName);
    if (!fam || fam.variants.length === 0) continue;

    const detectedLower = querySig.dominantColor.toLowerCase();

    // Check if any variant matches the detected color
    let bestVariant = fam.variants[0];
    let colorMatched = false;

    const colorMatch = fam.variants.find(v => v.color.toLowerCase() === detectedLower);
    if (colorMatch) {
      bestVariant = colorMatch;
      colorMatched = true;
    } else {
      bestVariant = fam.variants.find(v => v.hasImage) || fam.variants[0];
    }

    const otherVariants = fam.variants.filter(v => v.id !== bestVariant.id);

    // Final score with color alignment bonus
    let finalScore = bestRef.totalScore;
    if (colorMatched) {
      finalScore = Math.min(100, finalScore + 15);
    }

    let matchStrength: 'Strong match' | 'Possible match' | 'Needs confirmation' = 'Needs confirmation';
    if (finalScore >= 80) matchStrength = 'Strong match';
    else if (finalScore >= 60) matchStrength = 'Possible match';

    candidates.push({
      family: fam.family,
      category: fam.category,
      shapeScore: finalScore,
      referenceImage: bestRef.refImage,
      recommendedVariant: bestVariant,
      otherVariants,
      matchStrength,
      evidence: {
        shapeMatchPercent: bestRef.shapeSimilarity,
        colorCompositionPercent: bestRef.colorComposition,
        detectedColor: querySig.dominantColor,
        variantColor: bestVariant.color,
        colorMatched,
        aspectRatioDiff: bestRef.aspectRatioDiff
      }
    });
  }

  // Sort descending by score
  candidates.sort((a, b) => b.shapeScore - a.shapeScore);

  const bestCandidate = candidates[0] || null;
  const MIN_MATCH_THRESHOLD = 60; // 60% minimum required for genuine product candidate

  let matchStatus: 'matched' | 'no_match' = 'no_match';
  let topMatch: MatchCandidate | null = null;
  let otherCandidates: MatchCandidate[] = [];
  let weakCandidates: MatchCandidate[] = [];
  let rejectionReason: string | undefined;

  if (bestCandidate && bestCandidate.shapeScore >= MIN_MATCH_THRESHOLD) {
    matchStatus = 'matched';
    topMatch = bestCandidate;
    // Only include other candidates that also cross reasonable threshold (>= 55%)
    otherCandidates = candidates.slice(1, 5).filter(c => c.shapeScore >= 55);
  } else {
    matchStatus = 'no_match';
    topMatch = null;
    rejectionReason = bestCandidate 
      ? `Highest candidate match was only ${bestCandidate.shapeScore}%, which is below the minimum 60% confidence threshold.`
      : 'No product features matched the catalogue.';
    // Keep low candidates only for optional "did you mean" inspection
    weakCandidates = candidates.slice(0, 3).filter(c => c.shapeScore >= 35);
  }

  const endTime = performance.now();

  return {
    matchStatus,
    detectedColor: {
      colorName: querySig.dominantColor,
      swatchHex: querySig.swatch,
      confidence: 'high'
    },
    topMatch,
    otherCandidates,
    weakCandidates,
    processingTimeMs: Math.round(endTime - startTime),
    rejectionReason
  };
}

export { catalogData, familiesData };
