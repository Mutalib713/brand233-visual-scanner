import os
import json
from PIL import Image

uploads_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\public\uploads'

def compute_dhash_h(image, width=16, height=16):
    resized = image.convert('L').resize((width + 1, height), Image.Resampling.BILINEAR)
    pixels = list(resized.getdata())
    diff = []
    for row in range(height):
        for col in range(width):
            idx = row * (width + 1) + col
            diff.append('1' if pixels[idx] > pixels[idx + 1] else '0')
    return ''.join(diff)

with open('src/data/descriptors.json', 'r') as f:
    desc = json.load(f)

for img_name in ['product-6-1781018530481.jpeg', 'product-15-1781016855223.jpeg', 'product-18-1784738699978.jpeg']:
    p = os.path.join(uploads_dir, img_name)
    with Image.open(p) as im:
        w, h = im.size
        # Full image hash
        full_h = compute_dhash_h(im)
        # Cropped (15% - 85%)
        crop_im = im.crop((int(w*0.15), int(h*0.15), int(w*0.85), int(h*0.85)))
        crop_h = compute_dhash_h(crop_im)
        
        # Hamming distance
        diff = sum(c1 != c2 for c1, c2 in zip(full_h, crop_h))
        print(f"{img_name}: Hamming distance full vs 70% crop = {diff} / 256 bits ({diff/256*100:.1f}%)")
