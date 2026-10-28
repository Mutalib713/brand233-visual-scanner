import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_new_matcher import get_image_signature, uploads_dir
from PIL import Image

BIN_NAMES = {
    0: ('Red', '#DC2626'),
    1: ('Orange', '#F97316'),
    2: ('Gold', '#EAB308'),
    3: ('Green', '#16A34A'),
    4: ('Green', '#16A34A'),
    5: ('Teal', '#0D9488'),
    6: ('Blue', '#2563EB'),
    7: ('Blue', '#1D4ED8'),
    8: ('Purple', '#9333EA'),
    9: ('Purple', '#7E22CE'),
    10: ('Pink', '#EC4899'),
    11: ('Pink', '#DB2777'),
    12: ('Black', '#1E293B'),
    13: ('Grey', '#475569'),
    14: ('Grey', '#94A3B8'),
    15: ('White', '#FFFFFF')
}

def get_dominant_from_hist(hist):
    color_mass = sum(hist[0:12])
    if color_mass >= 0.12:
        peak_idx = max(range(12), key=lambda i: hist[i])
        return BIN_NAMES[peak_idx]
    
    neutral_bins = [12, 13, 14, 15]
    peak_neutral = max(neutral_bins, key=lambda i: hist[i])
    return BIN_NAMES[peak_neutral]

samples = [
    ('product-6-1781018530481.jpeg', 'White'),
    ('product-7-1781018441025.jpeg', 'Black'),
    ('product-15-1781016855223.jpeg', 'Blue'),
    ('product-17-1781018653991.jpeg', 'Blue'),
    ('product-18-1784738699978.jpeg', 'Clear/White'),
]

for s, expected in samples:
    p = os.path.join(uploads_dir, s)
    with Image.open(p) as im:
        sig = get_image_signature(im)
        name, swatch = get_dominant_from_hist(sig['hist'])
        print(f"{s:35}: Expected={expected:10} -> Detected={name:10} (Swatch: {swatch})")
