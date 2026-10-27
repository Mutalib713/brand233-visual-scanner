import os
import json
from PIL import Image

uploads_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\public\uploads'
data_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\src\data'

with open(os.path.join(data_dir, 'families.json'), 'r', encoding='utf-8') as f:
    families = json.load(f)

def compute_dhash_h(image, width=16, height=16):
    resized = image.convert('L').resize((width + 1, height), Image.Resampling.BILINEAR)
    pixels = list(resized.getdata())
    diff = []
    for row in range(height):
        for col in range(width):
            idx = row * (width + 1) + col
            diff.append('1' if pixels[idx] > pixels[idx + 1] else '0')
    return ''.join(diff)

def compute_dhash_v(image, width=16, height=16):
    resized = image.convert('L').resize((width, height + 1), Image.Resampling.BILINEAR)
    pixels = list(resized.getdata())
    diff = []
    for row in range(height):
        for col in range(width):
            idx = row * width + col
            diff.append('1' if pixels[idx] > pixels[idx + width] else '0')
    return ''.join(diff)

def extract_dominant_color(image):
    rgb = image.convert('RGB')
    w, h = rgb.size
    
    # 1. Background corner sampling
    corner_samples = [
        rgb.getpixel((int(w * 0.05), int(h * 0.05))),
        rgb.getpixel((int(w * 0.95), int(h * 0.05))),
        rgb.getpixel((int(w * 0.05), int(h * 0.95))),
        rgb.getpixel((int(w * 0.95), int(h * 0.95)))
    ]
    bg_r = sum(c[0] for c in corner_samples) / 4
    bg_g = sum(c[1] for c in corner_samples) / 4
    bg_b = sum(c[2] for c in corner_samples) / 4
    
    # 2. Sample foreground center column/box (x: 35%-65%, y: 25%-75%)
    fg_pixels = []
    for x in range(int(w * 0.35), int(w * 0.65), max(1, w // 80)):
        for y in range(int(h * 0.25), int(h * 0.75), max(1, h // 80)):
            p = rgb.getpixel((x, y))
            # Distance from corner background
            bg_dist = ((p[0] - bg_r)**2 + (p[1] - bg_g)**2 + (p[2] - bg_b)**2)**0.5
            fg_pixels.append((p, bg_dist))
            
    # Keep pixels that contrast with background
    sorted_fg = sorted(fg_pixels, key=lambda x: -x[1])
    top_fg = [x[0] for x in sorted_fg[:len(sorted_fg)//2]] if sorted_fg else [(128,128,128)]
    
    avg_r = sum(p[0] for p in top_fg) // len(top_fg)
    avg_g = sum(p[1] for p in top_fg) // len(top_fg)
    avg_b = sum(p[2] for p in top_fg) // len(top_fg)
    
    rf, gf, bf = avg_r / 255.0, avg_g / 255.0, avg_b / 255.0
    cmax, cmin = max(rf, gf, bf), min(rf, gf, bf)
    delta = cmax - cmin
    v = cmax
    s = 0 if cmax == 0 else delta / cmax
    
    if avg_r > 190 and avg_g > 190 and avg_b > 190:
        cname = 'White'
    elif avg_r < 60 and avg_g < 60 and avg_b < 60:
        cname = 'Black'
    elif s < 0.20:
        cname = 'Grey'
    else:
        if delta == 0: h_deg = 0
        elif cmax == rf: h_deg = (60 * ((gf - bf) / delta) + 360) % 360
        elif cmax == gf: h_deg = (60 * ((bf - rf) / delta) + 120) % 360
        else: h_deg = (60 * ((rf - gf) / delta) + 240) % 360
        
        if h_deg >= 345 or h_deg < 15: cname = 'Red'
        elif 15 <= h_deg < 42: cname = 'Orange'
        elif 42 <= h_deg < 68: cname = 'Gold' if v < 0.7 else 'Yellow'
        elif 68 <= h_deg < 165: cname = 'Green'
        elif 165 <= h_deg < 195: cname = 'Teal'
        elif 195 <= h_deg < 255: cname = 'Blue'
        elif 255 <= h_deg < 295: cname = 'Purple'
        else: cname = 'Pink'
        
    swatch = f"#{avg_r:02x}{avg_g:02x}{avg_b:02x}"
    return cname, swatch

descriptors = {}
count = 0
for fam in families:
    for img_path in fam['referenceImages']:
        clean = os.path.basename(img_path)
        real_file = os.path.join(uploads_dir, clean)
        if os.path.exists(real_file):
            try:
                with Image.open(real_file) as im:
                    w, h = im.size
                    dh_h = compute_dhash_h(im)
                    dh_v = compute_dhash_v(im)
                    dom_color, swatch = extract_dominant_color(im)
                    
                    descriptors[img_path] = {
                        "family": fam['family'],
                        "dHashH": dh_h,
                        "dHashV": dh_v,
                        "aspectRatio": round(w / h, 3),
                        "width": w,
                        "height": h,
                        "dominantColor": dom_color,
                        "swatch": swatch
                    }
                    count += 1
            except Exception as e:
                print(f"Error on {clean}: {e}")

with open(os.path.join(data_dir, 'descriptors.json'), 'w', encoding='utf-8') as f:
    json.dump(descriptors, f, indent=2)

print(f"Updated descriptors for {count} photos.")
