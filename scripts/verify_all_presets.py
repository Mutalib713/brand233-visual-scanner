import os
import json
from PIL import Image

uploads_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\public\uploads'
data_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\src\data'

with open(os.path.join(data_dir, 'descriptors.json'), 'r') as f:
    descriptors = json.load(f)

with open(os.path.join(data_dir, 'families.json'), 'r') as f:
    families = json.load(f)

# The 10 pitch presets
presets = [
    ('/uploads/product-6-1781018530481.jpeg', 'Round Bottle'),
    ('/uploads/product-7-1781018441025.jpeg', 'Round Bottle'),
    ('/uploads/product-15-1781016855223.jpeg', 'Temperature Flask'),
    ('/uploads/product-12-1784740086078.jpeg', 'Sublimation Sport Bottle'),
    ('/uploads/product-75-1782565051197.jpeg', 'Bottle wine set'),
    ('/uploads/product-18-1784738699978.jpeg', 'Glass Tumbler with handle'),
    ('/uploads/product-86-1783004682573.jpeg', '4in1 set with umbrella'),
    ('/uploads/product-87-1783004746973.jpeg', 'Wooden umbrella set'),
    ('/uploads/product-31-1784734663217.jpeg', 'Wooden Round Opener'),
    ('/uploads/product-80-1782567341583.jpeg', 'Small stanley cup'),
]

passed = 0
for path, expected_fam in presets:
    # Query desc
    q = descriptors.get(path)
    if not q:
        print(f"FAILED: {path} not in desc")
        continue
        
    scores = []
    for ref_path, ref_desc in descriptors.items():
        # hist
        hist_sim = sum(min(q['hist'][i], ref_desc['hist'][i]) for i in range(16))
        # dhash
        d_sim = max(0.0, 1.0 - sum(c1 != c2 for c1, c2 in zip(q['dhash'], ref_desc['dhash'])) / 64.0)
        # ahash
        a_sim = max(0.0, 1.0 - sum(c1 != c2 for c1, c2 in zip(q['ahash'], ref_desc['ahash'])) / 64.0)
        # ar
        ar_sim = max(0.0, 1.0 - abs(q['aspectRatio'] - ref_desc['aspectRatio']) / 1.5)
        
        tot = ((d_sim * 0.25 + a_sim * 0.25) + (hist_sim * 0.35) + (ar_sim * 0.15)) * 100.0
        scores.append((ref_desc['family'], tot, ref_path))
        
    scores.sort(key=lambda x: -x[1])
    top_fam, top_score, top_ref = scores[0]
    
    match_ok = expected_fam.lower() in top_fam.lower() or top_fam.lower() in expected_fam.lower()
    if match_ok:
        passed += 1
        print(f"[PASS] {os.path.basename(path):32} -> Matched: {top_fam:26} ({top_score:.1f}%)")
    else:
        print(f"[FAIL] {os.path.basename(path):32} -> Expected: {expected_fam}, Got: {top_fam}")

print(f"\nFinal Result: {passed}/{len(presets)} passed ({passed/len(presets)*100:.0f}%)")
