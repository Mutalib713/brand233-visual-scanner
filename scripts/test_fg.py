import os
from PIL import Image

uploads_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\public\uploads'

def calibrate_color(filename):
    path = os.path.join(uploads_dir, filename)
    with Image.open(path) as im:
        rgb = im.convert('RGB')
        w, h = rgb.size
        
        # 1. Sample background profile from corners
        corner_samples = []
        for x in [int(w * 0.05), int(w * 0.95)]:
            for y in [int(h * 0.05), int(h * 0.95)]:
                corner_samples.append(rgb.getpixel((x, y)))
        bg_r = sum(c[0] for c in corner_samples) / len(corner_samples)
        bg_g = sum(c[1] for c in corner_samples) / len(corner_samples)
        bg_b = sum(c[2] for c in corner_samples) / len(corner_samples)
        
        # 2. Sample foreground center column/box (x: 35%-65%, y: 25%-75%)
        fg_pixels = []
        for x in range(int(w * 0.35), int(w * 0.65), max(1, w // 80)):
            for y in range(int(h * 0.25), int(h * 0.75), max(1, h // 80)):
                p = rgb.getpixel((x, y))
                # Distance from background
                bg_dist = ((p[0] - bg_r)**2 + (p[1] - bg_g)**2 + (p[2] - bg_b)**2)**0.5
                fg_pixels.append((p, bg_dist))
                
        # Filter pixels that differ most from background or are central object
        sorted_fg = sorted(fg_pixels, key=lambda x: -x[1])
        top_fg = [x[0] for x in sorted_fg[:len(sorted_fg)//2]]
        
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
            
        print(f"{filename:35}: RGB=({avg_r:3},{avg_g:3},{avg_b:3}) S={s:.2f} V={v:.2f} -> {cname}")

calibrate_color('product-6-1781018530481.jpeg') # White
calibrate_color('product-7-1781018441025.jpeg') # Black
calibrate_color('product-15-1781016855223.jpeg') # Blue
calibrate_color('product-17-1781018653991.jpeg') # Slim glass cup blue
