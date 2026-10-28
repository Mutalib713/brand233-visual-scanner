import os
import json
from PIL import Image

uploads_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\public\uploads'

def compute_features(im):
    rgb = im.convert('RGB')
    w, h = rgb.size
    aspect_ratio = round(w / h, 2)
    
    # 1. Background sampling (corners)
    corners = [
        rgb.getpixel((int(w * 0.05), int(h * 0.05))),
        rgb.getpixel((int(w * 0.95), int(h * 0.05))),
        rgb.getpixel((int(w * 0.05), int(h * 0.95))),
        rgb.getpixel((int(w * 0.95), int(h * 0.95)))
    ]
    bg_r = sum(c[0] for c in corners) / 4
    bg_g = sum(c[1] for c in corners) / 4
    bg_b = sum(c[2] for c in corners) / 4
    
    # 2. Foreground mask & color histogram
    # 12 hue bins (0-30, 30-60, ... 330-360) + 3 neutral bins (Black, Grey, White) = 15 bins
    hist = [0] * 15
    fg_pixels = []
    
    sample_step_x = max(1, w // 60)
    sample_step_y = max(1, h // 60)
    
    for y in range(int(h * 0.15), int(h * 0.85), sample_step_y):
        for x in range(int(w * 0.15), int(w * 0.85), sample_step_x):
            p = rgb.getpixel((x, y))
            bg_dist = ((p[0] - bg_r)**2 + (p[1] - bg_g)**2 + (p[2] - bg_b)**2)**0.5
            
            # Is foreground pixel
            if bg_dist > 25:
                fg_pixels.append(p)
                rf, gf, bf = p[0] / 255.0, p[1] / 255.0, p[2] / 255.0
                cmax, cmin = max(rf, gf, bf), min(rf, gf, bf)
                delta = cmax - cmin
                v = cmax
                s = 0 if cmax == 0 else delta / cmax
                
                if s < 0.20:
                    if v > 0.75: hist[14] += 1 # White
                    elif v < 0.30: hist[12] += 1 # Black
                    else: hist[13] += 1 # Grey
                else:
                    if delta == 0: h_deg = 0
                    elif cmax == rf: h_deg = ((60 * ((gf - bf) / delta) + 360) % 360)
                    elif cmax == gf: h_deg = ((60 * ((bf - rf) / delta) + 120) % 360)
                    else: h_deg = ((60 * ((rf - gf) / delta) + 240) % 360)
                    bin_idx = int(h_deg / 30) % 12
                    hist[bin_idx] += 1

    # Normalize histogram
    tot = sum(hist)
    if tot > 0:
        hist = [round(x / tot, 3) for x in hist]
        
    # 3. 8x8 dHash (64-bit)
    gray = im.convert('L').resize((9, 8), Image.Resampling.BILINEAR)
    px = list(gray.getdata())
    dhash = []
    for r in range(8):
        for c in range(8):
            dhash.append('1' if px[r * 9 + c] > px[r * 9 + c + 1] else '0')
    dhash_str = ''.join(dhash)
    
    # 4. Vertical mass profile (is the object top-heavy, bottom-heavy, or uniform?)
    # 4 horizontal slices
    slices = [0] * 4
    h_step = h // 4
    for i in range(4):
        sl = gray.crop((0, i * h_step, w, (i + 1) * h_step))
        avg = sum(sl.getdata()) / (w * h_step)
        slices[i] = round(avg / 255.0, 2)

    return {
        'aspectRatio': aspect_ratio,
        'hist': hist,
        'dhash': dhash_str,
        'slices': slices
    }

# Let's inspect a few distinct items
samples = [
    'product-6-1781018530481.jpeg',   # Round Bottle White
    'product-7-1781018441025.jpeg',   # Round Bottle Black
    'product-15-1781016855223.jpeg',  # Temp Flask Blue
    'product-18-1784738699978.jpeg',  # Glass Tumbler with handle
    'product-75-1782565051197.jpeg',  # Bottle wine set
    'product-86-1783004682573.jpeg',  # 4in1 set with umbrella
]

for s in samples:
    path = os.path.join(uploads_dir, s)
    with Image.open(path) as im:
        feat = compute_features(im)
        print(f"\n{s}:")
        print(f"  AR: {feat['aspectRatio']}, Slices: {feat['slices']}")
        print(f"  Top Hist Bins: {[(i, v) for i, v in enumerate(feat['hist']) if v > 0.1]}")
