import os
import json
from PIL import Image

uploads_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\public\uploads'
data_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\src\data'

with open(os.path.join(data_dir, 'families.json'), 'r', encoding='utf-8') as f:
    families = json.load(f)

def extract_features(im):
    rgb = im.convert('RGB')
    w, h = rgb.size
    aspect_ratio = round(w / h, 2)
    
    # 1. Corner background sampling
    corners = [
        rgb.getpixel((int(w * 0.05), int(h * 0.05))),
        rgb.getpixel((int(w * 0.95), int(h * 0.05))),
        rgb.getpixel((int(w * 0.05), int(h * 0.95))),
        rgb.getpixel((int(w * 0.95), int(h * 0.95)))
    ]
    bg_r = sum(c[0] for c in corners) / 4
    bg_g = sum(c[1] for c in corners) / 4
    bg_b = sum(c[2] for c in corners) / 4
    
    # 2. Color Histogram & Pixel collection
    hist = [0.0] * 16 # 0-11 hue bins, 12: black, 13: dark grey, 14: light grey, 15: white
    fg_pixels = []
    
    step_x = max(1, w // 40)
    step_y = max(1, h // 40)
    
    for y in range(int(h * 0.1), int(h * 0.9), step_y):
        for x in range(int(w * 0.1), int(w * 0.9), step_x):
            p = rgb.getpixel((x, y))
            bg_dist = ((p[0] - bg_r)**2 + (p[1] - bg_g)**2 + (p[2] - bg_b)**2)**0.5
            
            # Count pixels that contrast with background
            if bg_dist > 25:
                fg_pixels.append(p)
                rf, gf, bf = p[0] / 255.0, p[1] / 255.0, p[2] / 255.0
                cmax, cmin = max(rf, gf, bf), min(rf, gf, bf)
                delta = cmax - cmin
                v = cmax
                s = 0 if cmax == 0 else delta / cmax
                
                if s < 0.22:
                    if v > 0.78: hist[15] += 1.0 # White
                    elif v > 0.45: hist[14] += 1.0 # Light grey
                    elif v > 0.22: hist[13] += 1.0 # Dark grey
                    else: hist[12] += 1.0 # Black
                else:
                    if delta == 0: h_deg = 0
                    elif cmax == rf: h_deg = ((60 * ((gf - bf) / delta) + 360) % 360)
                    elif cmax == gf: h_deg = ((60 * ((bf - rf) / delta) + 120) % 360)
                    else: h_deg = ((60 * ((rf - gf) / delta) + 240) % 360)
                    bin_idx = int(h_deg / 30) % 12
                    hist[bin_idx] += 1.0

    tot = sum(hist)
    if tot > 0:
        hist = [round(v / tot, 4) for v in hist]
        
    # Dominant color
    color_mass = sum(hist[0:12])
    if color_mass >= 0.18:
        peak_idx = max(range(12), key=lambda i: hist[i])
        bin_names = {
            0: ('Red', '#DC2626'), 1: ('Orange', '#F97316'), 2: ('Gold', '#EAB308'),
            3: ('Green', '#16A34A'), 4: ('Green', '#16A34A'), 5: ('Teal', '#0D9488'),
            6: ('Blue', '#2563EB'), 7: ('Blue', '#1D4ED8'), 8: ('Purple', '#9333EA'),
            9: ('Purple', '#7E22CE'), 10: ('Pink', '#EC4899'), 11: ('Pink', '#DB2777')
        }
        dom_color, dom_swatch = bin_names[peak_idx]
    else:
        # Neutral peak
        neutral_bins = [12, 13, 14, 15]
        peak_n = max(neutral_bins, key=lambda i: hist[i])
        n_names = {12: ('Black', '#1E293B'), 13: ('Grey', '#475569'), 14: ('Grey', '#94A3B8'), 15: ('White', '#FFFFFF')}
        dom_color, dom_swatch = n_names[peak_n]

    # 3. 8x8 dHash (64-bit)
    gray = im.convert('L').resize((9, 8), Image.Resampling.BILINEAR)
    px = list(gray.getdata())
    dhash = []
    for r in range(8):
        for c in range(8):
            dhash.append('1' if px[r * 9 + c] > px[r * 9 + c + 1] else '0')
            
    # 4. 8x8 aHash (64-bit)
    gray8 = im.convert('L').resize((8, 8), Image.Resampling.BILINEAR)
    px8 = list(gray8.getdata())
    avg8 = sum(px8) / 64.0
    ahash = ['1' if p > avg8 else '0' for p in px8]

    return {
        'aspectRatio': aspect_ratio,
        'hist': hist,
        'dhash': ''.join(dhash),
        'ahash': ''.join(ahash),
        'dominantColor': dom_color,
        'swatch': dom_swatch
    }

descriptors = {}
count = 0

for fam in families:
    for img_path in fam['referenceImages']:
        clean = os.path.basename(img_path)
        real_file = os.path.join(uploads_dir, clean)
        if os.path.exists(real_file):
            try:
                with Image.open(real_file) as im:
                    feat = extract_features(im)
                    
                    descriptors[img_path] = {
                        "family": fam['family'],
                        "dhash": feat['dhash'],
                        "ahash": feat['ahash'],
                        "hist": feat['hist'],
                        "aspectRatio": feat['aspectRatio'],
                        "dominantColor": feat['dominantColor'],
                        "swatch": feat['swatch']
                    }
                    count += 1
            except Exception as e:
                print(f"Error on {clean}: {e}")

with open(os.path.join(data_dir, 'descriptors.json'), 'w', encoding='utf-8') as f:
    json.dump(descriptors, f, indent=2)

print(f"Successfully generated multi-feature descriptors for {count} reference photos.")
