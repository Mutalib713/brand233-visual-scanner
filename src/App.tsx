import { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  CheckCircle2, 
  Package, 
  RefreshCw, 
  Info, 
  ChevronRight,
  Store,
  Warehouse,
  Tag,
  ShieldCheck,
  Search
} from 'lucide-react';
import { 
  matchProductImage, 
  ScanResult, 
  ProductVariant, 
  MatchCandidate,
  catalogData
} from './lib/cvEngine.ts';

// 10 real distinct products from catalogue for live pitching & instant testing
const TEST_PRESETS = [
  { label: 'Round Bottle (White)', path: '/uploads/product-6-1781018530481.jpeg', category: 'Bottles' },
  { label: 'Round Bottle (Black)', path: '/uploads/product-7-1781018441025.jpeg', category: 'Bottles' },
  { label: 'Temp Flask (Blue)', path: '/uploads/product-15-1781016855223.jpeg', category: 'Flasks' },
  { label: 'Sport Bottle', path: '/uploads/product-12-1784740086078.jpeg', category: 'Sport' },
  { label: 'Wine Bottle Set', path: '/uploads/product-75-1782565051197.jpeg', category: 'Gift Sets' },
  { label: 'Glass Tumbler', path: '/uploads/product-18-1784738699978.jpeg', category: 'Glassware' },
  { label: '4in1 Umbrella Set', path: '/uploads/product-86-1783004682573.jpeg', category: 'Gift Sets' },
  { label: 'Wooden Umbrella Set', path: '/uploads/product-87-1783004746973.jpeg', category: 'Executive' },
  { label: 'Wooden Opener', path: '/uploads/product-31-1784734663217.jpeg', category: 'Souvenirs' },
  { label: 'Stanley Cup', path: '/uploads/product-80-1782567341583.jpeg', category: 'Drinkware' },
];

export default function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [activeTab, setActiveTab] = useState<'scanner' | 'catalog'>('scanner');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [useCenterCrop, setUseCenterCrop] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-scan whenever image or crop mode changes
  useEffect(() => {
    if (selectedImage) {
      runVisualScan(selectedImage);
    }
  }, [selectedImage, useCenterCrop]);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const runVisualScan = (imgSrc: string) => {
    setIsScanning(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsScanning(false);
        return;
      }
      ctx.drawImage(img, 0, 0);

      // Center crop box if enabled
      let crop: { x: number; y: number; width: number; height: number } | undefined;
      if (useCenterCrop) {
        crop = {
          x: Math.round(img.width * 0.15),
          y: Math.round(img.height * 0.15),
          width: Math.round(img.width * 0.7),
          height: Math.round(img.height * 0.7)
        };
      }

      // Execute non-AI Computer Vision Matching
      const result = matchProductImage(canvas, crop);
      setScanResult(result);
      if (result.topMatch) {
        setSelectedVariant(result.topMatch.recommendedVariant);
      } else {
        setSelectedVariant(null);
      }
      setIsScanning(false);
    };
    img.src = imgSrc;
  };

  const handleSelectCandidate = (candidate: MatchCandidate) => {
    if (!scanResult) return;
    setScanResult({
      ...scanResult,
      topMatch: candidate,
      otherCandidates: [
        scanResult.topMatch!,
        ...scanResult.otherCandidates.filter(c => c.family !== candidate.family)
      ]
    });
    setSelectedVariant(candidate.recommendedVariant);
  };

  // Filter catalog
  const filteredCatalog = catalogData.filter(p => 
    p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <canvas ref={canvasRef} className="hidden" />

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageFile} 
        accept="image/*" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={cameraInputRef} 
        onChange={handleImageFile} 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center text-white font-black text-lg shadow-sm">
              233
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-slate-900 leading-tight">Brand 233</h1>
                <span className="text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                  Visual Scanner
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Deterministic CV Product Matcher (No AI)</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('scanner')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'scanner' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Scanner
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'catalog' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Catalogue ({catalogData.length})
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 w-full flex-1">
        {activeTab === 'scanner' ? (
          <div className="space-y-6">
            {/* Input Hero Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 bg-brand-700 hover:bg-brand-800 text-white font-medium py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-sm transition active:scale-[0.99]"
                >
                  <Camera className="w-5 h-5" />
                  <span>Take a Picture</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-sm transition active:scale-[0.99]"
                >
                  <Upload className="w-5 h-5" />
                  <span>Upload Image</span>
                </button>
              </div>

              {/* Pitch & Demo Shelf: 10 real products */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Pitch Demo Shelf — Tap any real shop item to scan:
                  </span>
                  <label className="flex items-center space-x-1.5 text-xs text-slate-500 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useCenterCrop} 
                      onChange={(e) => setUseCenterCrop(e.target.checked)}
                      className="rounded text-brand-700 focus:ring-brand-700" 
                    />
                    <span>Tight Center Crop</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {TEST_PRESETS.map((preset, idx) => {
                    const isSelected = selectedImage === preset.path;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedImage(preset.path)}
                        className={`flex items-center space-x-2 p-2 rounded-xl text-left border transition ${
                          isSelected 
                            ? 'border-brand-600 bg-brand-50 text-brand-900 ring-2 ring-brand-600/20' 
                            : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-700'
                        }`}
                      >
                        <img 
                          src={preset.path} 
                          alt={preset.label} 
                          className="w-8 h-8 object-cover rounded-md border border-slate-200 bg-white flex-shrink-0" 
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold truncate leading-tight">{preset.label}</p>
                          <span className="text-[9px] text-slate-400 block">{preset.category}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Results Area */}
            {selectedImage && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left Column: Input Photo & Detected Color */}
                <div className="md:col-span-5 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Input Photo
                      </span>
                      {scanResult && (
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          ⚡ {scanResult.processingTimeMs}ms
                        </span>
                      )}
                    </div>

                    <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <img 
                        src={selectedImage} 
                        alt="Scanned item" 
                        className="w-full h-full object-contain" 
                      />
                      {useCenterCrop && (
                        <div className="absolute inset-[15%] border-2 border-dashed border-brand-500/80 rounded-lg pointer-events-none flex items-start justify-end p-1">
                          <span className="bg-brand-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                            Active ROI
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Detected Color Bar */}
                    {scanResult && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-600">Detected Object Colour:</span>
                          <div className="flex items-center space-x-2">
                            <span 
                              className="w-4 h-4 rounded-full border border-slate-300 shadow-xs inline-block"
                              style={{ backgroundColor: scanResult.detectedColor.swatchHex }}
                            />
                            <span className="text-xs font-bold text-slate-900">
                              {scanResult.detectedColor.colorName}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {scanResult.detectedColor.swatchHex}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Non-AI Guarantee notice */}
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-emerald-900">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-950">100% Deterministic Computer Vision</p>
                      <p className="text-emerald-800 text-[11px] mt-0.5 leading-relaxed">
                        Evaluates 16-bin color histogram intersection, structural silhouette hashes, and aspect ratio in real time. Zero external AI API costs.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column: Matched Product & Breakdown */}
                <div className="md:col-span-7 space-y-4">
                  {isScanning ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                      <RefreshCw className="w-8 h-8 text-brand-700 animate-spin mx-auto mb-3" />
                      <p className="font-bold text-slate-800">Analyzing Image Features…</p>
                      <p className="text-xs text-slate-500 mt-1">Comparing color histograms & silhouette gradients</p>
                    </div>
                  ) : scanResult?.topMatch ? (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                      {/* Match header */}
                      <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            scanResult.topMatch.matchStrength === 'Strong match' 
                              ? 'bg-emerald-500 text-white' 
                              : scanResult.topMatch.matchStrength === 'Possible match' 
                              ? 'bg-amber-500 text-white' 
                              : 'bg-sky-500 text-white'
                          }`}>
                            {scanResult.topMatch.matchStrength}
                          </span>
                          <span className="text-xs font-mono text-slate-300">
                            Confidence: {scanResult.topMatch.shapeScore}%
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {scanResult.topMatch.category}
                        </span>
                      </div>

                      {/* Product Content */}
                      <div className="p-5 space-y-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-semibold text-brand-700 uppercase tracking-wider">
                              Product Family: {scanResult.topMatch.family}
                            </span>
                            <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                              {selectedVariant?.name || scanResult.topMatch.family}
                            </h2>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                SKU: {selectedVariant?.sku}
                              </span>
                              <span className="text-xs text-slate-500">
                                ID: #{selectedVariant?.id}
                              </span>
                            </div>
                          </div>

                          {scanResult.topMatch.referenceImage && (
                            <div className="text-center flex-shrink-0">
                              <img 
                                src={scanResult.topMatch.referenceImage} 
                                alt="Ref" 
                                className="w-16 h-16 object-cover rounded-xl border border-slate-200 bg-slate-50" 
                              />
                              <span className="text-[10px] text-slate-400 block mt-1 font-medium">Catalogue Ref</span>
                            </div>
                          )}
                        </div>

                        {/* Multi-Signal Breakdown Meter */}
                        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
                          <div className="font-semibold text-slate-800 flex items-center justify-between">
                            <span className="flex items-center space-x-1.5">
                              <Info className="w-4 h-4 text-brand-700" />
                              <span>Signal Match Breakdown:</span>
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              Total: {scanResult.topMatch.shapeScore}%
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-slate-500 block">Shape & Silhouette</span>
                              <span className="font-bold text-slate-900">
                                {scanResult.topMatch.evidence.shapeMatchPercent}% similarity
                              </span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-slate-500 block">Color Histogram</span>
                              <span className="font-bold text-slate-900">
                                {scanResult.topMatch.evidence.colorCompositionPercent}% intersection
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                            {scanResult.topMatch.evidence.colorMatched ? (
                              <span className="text-emerald-700 font-medium">
                                ✨ Detected colour <strong>{scanResult.topMatch.evidence.detectedColor}</strong> matched variant SKU <strong>{selectedVariant?.sku}</strong> (even if unphotographed).
                              </span>
                            ) : (
                              <span>
                                Showing available catalogue variant ({selectedVariant?.color}).
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Available Colours / Variant Picker */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                              Available Colours in this Design ({scanResult.topMatch.otherVariants.length + 1})
                            </span>
                            <span className="text-[11px] text-slate-500">Tap to switch colour</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {[scanResult.topMatch.recommendedVariant, ...scanResult.topMatch.otherVariants].map(variant => {
                              const isSelected = selectedVariant?.id === variant.id;
                              return (
                                <button
                                  key={variant.id}
                                  onClick={() => setSelectedVariant(variant)}
                                  className={`p-2.5 rounded-xl border text-left flex items-center space-x-2.5 transition ${
                                    isSelected 
                                      ? 'border-brand-600 bg-brand-50/60 ring-2 ring-brand-600/20' 
                                      : 'border-slate-200 bg-white hover:bg-slate-50'
                                  }`}
                                >
                                  <span 
                                    className="w-4 h-4 rounded-full border border-slate-300 flex-shrink-0 shadow-2xs"
                                    style={{ backgroundColor: variant.colorHex }}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-semibold text-slate-900 truncate">
                                      {variant.color}
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex items-center space-x-1">
                                      <span>Stock: {variant.totalStock}</span>
                                      {!variant.hasImage && (
                                        <span className="text-slate-400 font-mono text-[9px]">(no img)</span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Stock & Pricing */}
                        {selectedVariant && (
                          <div className="grid grid-cols-3 gap-3 pt-2">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                                Retail Stock
                              </span>
                              <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                                {selectedVariant.retailStock} <span className="text-xs font-normal text-slate-500">units</span>
                              </span>
                              <span className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                                <Store className="w-3 h-3" />
                                <span>Shop Floor</span>
                              </span>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                                Warehouse
                              </span>
                              <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                                {selectedVariant.warehouseStock} <span className="text-xs font-normal text-slate-500">units</span>
                              </span>
                              <span className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                                <Warehouse className="w-3 h-3" />
                                <span>Backroom</span>
                              </span>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                                Selling Price
                              </span>
                              <span className="text-lg font-bold text-brand-700 mt-0.5 block">
                                GHS {selectedVariant.sellingPrice.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                                <Tag className="w-3 h-3" />
                                <span>Cost: GHS {selectedVariant.costPrice.toFixed(2)}</span>
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="pt-2 flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={() => alert(`Prototype Confirmed:\nProduct: ${selectedVariant?.name}\nSKU: ${selectedVariant?.sku}\nStock: ${selectedVariant?.totalStock} units\nPrice: GHS ${selectedVariant?.sellingPrice.toFixed(2)}`)}
                            className="flex-1 bg-brand-700 hover:bg-brand-800 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-sm transition active:scale-[0.99]"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Confirm Product Selection</span>
                          </button>
                          <button
                            onClick={() => { setSelectedImage(null); setScanResult(null); }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-4 rounded-xl transition"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Alternative Close Candidates */}
                  {scanResult && scanResult.otherCandidates.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                        Other Visually Similar Products ({scanResult.otherCandidates.length})
                      </h3>
                      <div className="space-y-2">
                        {scanResult.otherCandidates.map((cand, idx) => (
                          <div 
                            key={idx}
                            onClick={() => handleSelectCandidate(cand)}
                            className="p-2.5 rounded-xl border border-slate-200 hover:border-brand-500 bg-slate-50 hover:bg-white flex items-center justify-between cursor-pointer transition"
                          >
                            <div className="flex items-center space-x-3">
                              {cand.referenceImage ? (
                                <img 
                                  src={cand.referenceImage} 
                                  alt={cand.family} 
                                  className="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-white" 
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400">
                                  <Package className="w-5 h-5" />
                                </div>
                              )}
                              <div>
                                <h4 className="text-xs font-bold text-slate-900">{cand.family}</h4>
                                <span className="text-[10px] text-slate-500">
                                  {cand.category} • {cand.otherVariants.length + 1} colors available
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-mono font-semibold text-slate-600">
                                {cand.shapeScore}%
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Catalogue Tab */
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Brand 233 Product Catalogue</h2>
                <p className="text-xs text-slate-500">212 real products and stock levels extracted from database backup</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text" 
                  placeholder="Search name, SKU, category…" 
                  value={catalogSearch} 
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700" 
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Colour</th>
                    <th className="py-2.5 px-3">Retail</th>
                    <th className="py-2.5 px-3">Warehouse</th>
                    <th className="py-2.5 px-3">Price</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCatalog.slice(0, 50).map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-medium text-slate-900 flex items-center space-x-2">
                        {p.imageUrl ? (
                          <img 
                            src={p.imageUrl} 
                            alt={p.name} 
                            className="w-7 h-7 object-cover rounded-md border border-slate-200" 
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-300">
                            <Package className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className="truncate max-w-[200px]">{p.name}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{p.sku}</td>
                      <td className="py-2.5 px-3 text-slate-500">{p.category}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full border border-slate-300" style={{ backgroundColor: p.colorHex }} />
                          <span>{p.color}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{p.retailStock}</td>
                      <td className="py-2.5 px-3 text-slate-600">{p.warehouseStock}</td>
                      <td className="py-2.5 px-3 font-bold text-brand-700">GHS {p.sellingPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-3">
                        {p.imageUrl && (
                          <button
                            onClick={() => {
                              setSelectedImage(p.imageUrl);
                              setActiveTab('scanner');
                            }}
                            className="text-brand-700 hover:text-brand-900 font-semibold text-[11px] hover:underline"
                          >
                            Scan Test
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        Brand 233 Accra • Visual Product Scanner Prototype • 100% Deterministic Computer Vision
      </footer>
    </div>
  );
}
