# Brand 233 Visual Product Scanner — Project Profile

## Mission
Build a lightweight, mobile-first web prototype for Brand 233 (Accra gift shop) that visually identifies retail products without barcodes using traditional, deterministic computer vision (zero AI models or cloud APIs). It identifies product families by shape/pattern similarity and resolves exact color variants using HSV/CIELAB color extraction — matching items even when specific color variants have no photos in the database.

## Sacred Rules
1. **Zero AI Services or Models**: Strictly no LLMs, cloud vision APIs (Google Cloud Vision, AWS Rekognition), or neural network models. All matching uses deterministic image processing (perceptual hashing, HSV color clustering, edge/gradient metrics).
2. **Deterministic & Explainable**: Matches must output calibrated confidence levels (`Strong match`, `Possible match`, `Needs confirmation`) with visible evidence (detected color swatch, shape similarity score).
3. **Dual Separation of Family vs. Variant**: Visual shape identifies the product family (e.g., "Round Bottle"); color detection identifies the specific variant (e.g., "Blue"), matching unphotographed SKUs in the catalogue.
4. **Zero AI Attribution in Git**: Never add `Co-Authored-By: Claude`, `Co-Authored-By: Antigravity`, or any AI disclaimer to git commits or file headers.
5. **No Stock Mutations During Scan**: Scanning and matching is strictly read-only; it never writes to inventory or alters prices.
6. **$0/Month Infrastructure**: Runs statically and serverless on Vercel's free tier.

## NOT in v1 (Prototype Scope)
- No live cashier checkout or cash/MoMo transaction processing.
- No supplier management, Goods Received Notes (GRN) posting, or issue vouchers.
- No barcode printing or thermal receipt printer integrations.
- No user authentication or role permission management.
- No persistent database writes back to Railway production.

## Tech Stack
- **Framework**: Next.js 14+ (App Router) or Vite + React (TypeScript).
- **Styling**: Tailwind CSS (Brand 233 fuchsia `#a21caf` and neutral tokens).
- **Computer Vision**: Browser Canvas API + Web Worker image processing (Perceptual Hashing, HSV color quantization, CIELAB delta-E).
- **Data Source**: Real Brand 233 catalogue extracted from `giftshop-manual-2026-10-20T23-35-10-857Z.db` (212 products, 13 categories, 97 reference photos).
- **Hosting**: Vercel (Hobby Tier — $0/month).
