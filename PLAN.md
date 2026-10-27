# Brand 233 Visual Product Scanner — Implementation Plan

## Overview
This plan defines the step-by-step roadmap to implement the Visual Product Scanner prototype, load real catalogue items, verify matching accuracy, and deploy the application to Vercel.

---

### Task 1: Extract Real Catalogue Data & Photos from Database Backup
- **Goal**: Read `giftshop-manual-2026-10-20T23-35-10-857Z.db`, parse products, categories, stock levels, and unpack the 97 reference photos from `backup_photos` table into static image assets and structured JSON.
- **Evidence**: Script outputs `products.json` (212 products with variant links) and extracted `.jpeg` image files verified on disk.

### Task 2: Build Deterministic Computer Vision Engine
- **Goal**: Implement non-AI visual matching:
  1. **Visual Hash Generator**: Perceptual/dHash computation to measure shape/edge similarity against reference images.
  2. **Color Extractor**: HSV/CIELAB color quantization that isolates the object, rejects white/neutral backgrounds, and identifies dominant color name + hex.
  3. **Variant Resolver**: Maps detected color to product variants within the matched family (resolving items with no photos).
- **Evidence**: Automated test runs with synthetic & real photo inputs proving correct family and color variant resolution.

### Task 3: Walking Skeleton Web UI (Live by Task 3)
- **Goal**: Create mobile-first Next.js / React application with:
  - Header with Brand 233 styling (`#a21caf`).
  - Input mode: `Take a Picture` (device camera) and `Upload Image` (file picker).
  - Image review & interactive crop box.
  - Live scanning status with progress indicator.
  - Results card: Top family match, match confidence label (`Strong match`, `Possible match`, `Needs confirmation`), detected color swatch, available variant swatches, and stock numbers.
- **Evidence**: App compiles cleanly and runs locally on `http://localhost:3000` with functioning photo upload and matching card.

### Task 4: Test Sandbox & Evaluation
- **Goal**: Provide sample test items (bottles, tumblers, mugs) right in the UI to let anyone click and test immediately without needing a physical item nearby, plus validation check.
- **Evidence**: Run evaluation against test samples verifying top-1 and top-3 accuracy and latency < 300ms.

### Task 5: Vercel Deployment & Verification
- **Goal**: Commit to git (zero AI attribution) and deploy to Vercel.
- **Evidence**: Public Vercel URL verified live and accessible on mobile browsers.
