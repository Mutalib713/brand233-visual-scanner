import os
import json
from PIL import Image

uploads_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\public\uploads'

def get_image_signature(im):
    rgb = im.convert('RGB')
    w, h = rgb.size
    aspect_ratio = round(w / h, 2)
    
    # 1. Background sampling from 4 corners
    corners = [
        rgb.getpixel((int(w * 0.05), int(h * 0.05))),
        rgb.getpixel((int(w * 0.95), int(h * 0.05))),
        rgb.getpixel((int(w * 0.05), int(h * 0.95))),
        rgb.getpixel((int(w * 0.95), int(h * 0.95)))
    ]
    bg_r = sum(c[0] for c in corners) / 4
    bg_g = sum(c[1] for c in corners) / 4
    bg_b = sum(c[2] for c in corners) / 4
    
    # 2. 16-bin Color Histogram (12 hue bins + black + dark grey + light grey + white)
    hist = [0.0] * 16
    total_fg = 0
    fg_colors = []
    
    step_x = max(1, w // 50)
    step_y = max(1, h // 50)
    
    for y in range(int(h * 0.1), int(h * 0.9), step_y):
        for x in range(int(w * 0.1), int(w * 0.9), step_x):
            p = rgb.getpixel((x, y))
            bg_dist = ((p[0] - bg_r)**2 + (p[1] - bg_g)**2 + (p[2] - bg_b)**2)**0.5
            
            # Foreground if it differs from background
            if bg_dist > 25:
                total_fg += 1
                fg_colors.append(p)
                rf, gf, bf = p[0] / 255.0, p[1] / 255.0, p[2] / 255.0
                cmax, cmin = max(rf, gf, bf), min(rf, gf, bf)
                delta = cmax - cmin
                v = cmax
                s = 0 if cmax == 0 else delta / cmax
                
                if s < 0.20:
                    if v > 0.80: hist[15] += 1.0 # White
                    elif v > 0.50: hist[14] += 1.0 # Light grey
                    elif v > 0.25: hist[13] += 1.0 # Dark grey
                    else: hist[12] += 1.0 # Black
                else:
                    if delta == 0: h_deg = 0
                    elif cmax == rf: h_deg = ((60 * ((gf - bf) / delta) + 360) % 360)
                    elif cmax == gf: h_deg = ((60 * ((bf - rf) / delta) + 120) % 360)
                    else: h_deg = ((60 * ((rf - gf) / delta) + 240) % 360)
                    bin_idx = int(h_deg / 30) % 12
                    hist[bin_idx] += 1.0

    if total_fg > 0:
        hist = [round(v / total_fg, 4) for v in hist]
        
    # Dominant color from fg_colors
    dom_color = 'White'
    dom_swatch = '#FFFFFF'
    if fg_colors:
        avg_r = sum(p[0] for p in fg_colors) // len(fg_colors)
        avg_g = sum(p[1] for p in fg_colors) // len(fg_colors)
        avg_b = sum(p[2] for p in fg_colors) // len(fg_colors)
        dom_swatch = f"#{avg_r:02x}{avg_g:02x}{avg_b:02x}"
        
        # Determine dominant name
        rf, gf, bf = avg_r / 255.0, avg_g / 255.0, avg_b / 255.0
        cmax, cmin = max(rf, gf, bf), min(rf, gf, bf)
        delta = cmax - cmin
        v, s = cmax, (0 if cmax == 0 else delta / cmax)
        
        if avg_r > 185 and avg_g > 185 and avg_b > 185: dom_color = 'White'
        elif avg_r < 65 and avg_g < 65 and avg_b < 65: dom_color = 'Black'
        elif s < 0.20: dom_color = 'Grey'
        else:
            if delta == 0: h_deg = 0
            elif cmax == rf: h_deg = ((60 * ((gf - bf) / delta) + 360) % 360)
            elif cmax == gf: h_deg = ((60 * ((bf - rf) / delta) + 120) % 360)
            else: h_deg = ((60 * ((rf - gf) / delta) + 240) % 360)
            
            if h_deg >= 345 or h_deg < 15: dom_color = 'Red'
            elif 15 <= h_deg < 42: dom_color = 'Orange'
            elif 42 <= h_deg < 68: dom_color = 'Gold' if v < 0.7 else 'Yellow'
            elif 68 <= h_deg < 165: dom_color = 'Green'
            elif 165 <= h_deg < 195: dom_color = 'Teal'
            elif 195 <= h_deg < 255: dom_color = 'Blue'
            elif 255 <= h_deg < 295: dom_color = 'Purple'
            else: dom_color = 'Pink'

    # 3. 8x8 dHash (64 bits) - noise-tolerant
    gray = im.convert('L').resize((9, 8), Image.Resampling.BILINEAR)
    px = list(gray.getdata())
    dhash = []
    for r in range(8):
        for c in range(8):
            dhash.append('1' if px[r * 9 + c] > px[r * 9 + c + 1] else '0')
            
    # 4. 8x8 aHash (Average Hash - 64 bits)
    gray8 = im.convert('L').resize((8, 8), Image.Resampling.BILINEAR)
    px8 = list(gray8.getdata())
    avg8 = sum(px8) / 64
    ahash = ['1' if p > avg8 else '0' for p in px8]

    return {
        'aspectRatio': aspect_ratio,
        'hist': hist,
        'dhash': ''.join(dhash),
        'ahash': ''.join(ahash),
        'dominantColor': dom_color,
        'swatch': dom_swatch
    }

def compare_signatures(sig1, sig2):
    # 1. Histogram intersection (0 to 1)
    hist_sim = sum(min(a, b) for a, b in zip(sig1['hist'], sig2['hist']))
    
    # 2. dHash similarity (64 bits)
    dhash_dist = sum(c1 != c2 for c1, c2 in zip(sig1['dhash'], sig2['dhash']))
    dhash_sim = max(0.0, 1.0 - (dhash_dist / 64.0))
    
    # 3. aHash similarity (64 bits)
    ahash_dist = sum(c1 != c2 for c1, c2 in zip(sig1['ahash'], sig2['ahash']))
    ahash_sim = max(0.0, 1.0 - (ahash_dist / 64.0))
    
    # 4. Aspect Ratio compatibility
    ar_diff = abs(sig1['aspectRatio'] - sig2['aspectRatio'])
    ar_sim = max(0.0, 1.0 - (ar_diff / 1.5))
    
    # Combined score (0 to 100)
    # Shape & Hash = 40%, Color Hist = 35%, Aspect Ratio = 25%
    total_score = (
        (dhash_sim * 0.20 + ahash_sim * 0.20) +
        (hist_sim * 0.35) +
        (ar_sim * 0.25)
    ) * 100.0
    
    return round(total_score, 1), round(hist_sim * 100, 1), round(dhash_sim * 100, 1)

# Test matching between different images
with open('src/data/families.json', 'r') as f:
    families = json.load(f)

# Build database of signatures
db = {}
for fam in families:
    for img_path in fam['referenceImages']:
        fname = os.path.basename(img_path)
        real_p = os.path.join(uploads_dir, fname)
        if os.path.exists(real_p):
            with Image.open(real_p) as im:
                db[img_path] = {
                    'family': fam['family'],
                    'sig': get_image_signature(im)
                }

print(f"Loaded {len(db)} reference signatures.")

# Test queries
test_queries = [
    'product-6-1781018530481.jpeg',   # Round Bottle White
    'product-7-1781018441025.jpeg',   # Round Bottle Black
    'product-15-1781016855223.jpeg',  # Temp Flask Blue
    'product-18-1784738699978.jpeg',  # Glass Tumbler with handle
    'product-75-1782565051197.jpeg',  # Bottle wine set
    'product-12-1784740086078.jpeg',  # Sublimation Sport Bottle
]

for q_name in test_queries:
    q_path = os.path.join(uploads_dir, q_name)
    with Image.open(q_path) as im:
        q_sig = get_image_signature(im)
        
        # Rank against all
        ranked = []
        for ref_path, item in db.items():
            score, h_sim, d_sim = compare_signatures(q_sig, item['sig'])
            ranked.append((item['family'], score, ref_path, item['sig']['dominantColor']))
            
        ranked.sort(key=lambda x: -x[1])
        top = ranked[0]
        second = ranked[1]
        print(f"\nQuery [{q_name}] (Detected Color: {q_sig['dominantColor']}):")
        print(f"  Top Match: {top[0]} (Score: {top[1]}%, Ref: {os.path.basename(top[2])})")
        print(f"  2nd Match: {second[0]} (Score: {second[1]}%, Ref: {os.path.basename(second[2])})")
