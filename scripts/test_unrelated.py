import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_robust_descriptors import extract_features
import json
from PIL import Image

data_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\src\data'

with open(os.path.join(data_dir, 'descriptors.json'), 'r') as f:
    descriptors = json.load(f)

img1 = Image.new('RGB', (400, 200), color=(30, 144, 255))
img2 = Image.new('RGB', (300, 300), color=(240, 230, 140))

for name, im in [('Solid Blue Wide Rect (Not in shop)', img1), ('Yellow Square (Not in shop)', img2)]:
    q = extract_features(im)
    scores = []
    for ref_path, ref_desc in descriptors.items():
        hist_sim = sum(min(q['hist'][i], ref_desc['hist'][i]) for i in range(16))
        d_sim = max(0.0, 1.0 - sum(c1 != c2 for c1, c2 in zip(q['dhash'], ref_desc['dhash'])) / 64.0)
        a_sim = max(0.0, 1.0 - sum(c1 != c2 for c1, c2 in zip(q['ahash'], ref_desc['ahash'])) / 64.0)
        ar_sim = max(0.0, 1.0 - abs(q['aspectRatio'] - ref_desc['aspectRatio']) / 1.5)
        
        tot = ((d_sim * 0.25 + a_sim * 0.25) + (hist_sim * 0.35) + (ar_sim * 0.15)) * 100.0
        scores.append((ref_desc['family'], tot))
        
    scores.sort(key=lambda x: -x[1])
    print(f"\nTest: {name}")
    print(f"  Top candidate: {scores[0][0]} with score: {scores[0][1]:.1f}%")
    print(f"  2nd candidate: {scores[1][0]} with score: {scores[1][1]:.1f}%")
