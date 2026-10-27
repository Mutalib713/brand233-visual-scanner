import os
from PIL import Image

uploads_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\public\uploads'

def inspect_img(filename):
    path = os.path.join(uploads_dir, filename)
    with Image.open(path) as im:
        rgb = im.convert('RGB')
        w, h = rgb.size
        print(f"\n--- {filename} ({w}x{h}) ---")
        
        # Sample center region
        cx, cy = w // 2, h // 2
        center_pixels = [rgb.getpixel((cx + dx, cy + dy)) for dx in range(-5, 6) for dy in range(-5, 6)]
        avg_r = sum(p[0] for p in center_pixels) // len(center_pixels)
        avg_g = sum(p[1] for p in center_pixels) // len(center_pixels)
        avg_b = sum(p[2] for p in center_pixels) // len(center_pixels)
        print(f"Dead Center RGB: ({avg_r}, {avg_g}, {avg_b}) -> #{avg_r:02x}{avg_g:02x}{avg_b:02x}")
        
        # Sample corners (background)
        corners = [rgb.getpixel((5, 5)), rgb.getpixel((w - 5, 5)), rgb.getpixel((5, h - 5)), rgb.getpixel((w - 5, h - 5))]
        print(f"Corner background RGB: {corners}")

inspect_img('product-6-1781018530481.jpeg') # Round Bottle White
inspect_img('product-7-1781018441025.jpeg') # Round Bottle Black
inspect_img('product-15-1781016855223.jpeg') # Temperature Flask Blue
