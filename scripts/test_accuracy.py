import os
import json
from PIL import Image

uploads_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\public\uploads'
data_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner\src\data'

with open(os.path.join(data_dir, 'descriptors.json'), 'r', encoding='utf-8') as f:
    descriptors = json.load(f)

with open(os.path.join(data_dir, 'families.json'), 'r', encoding='utf-8') as f:
    families = json.load(f)

test_samples = [
    ('/uploads/product-6-1781018530481.jpeg', 'Round Bottle', 'White'),
    ('/uploads/product-7-1781018441025.jpeg', 'Round Bottle', 'Black'),
    ('/uploads/product-15-1781016855223.jpeg', 'Temperature Flask', 'Blue'),
    ('/uploads/product-12-1784740086078.jpeg', 'Sublimation Sport Bottle', 'White'),
    ('/uploads/product-75-1782565051197.jpeg', 'Bottle wine set', 'Standard')
]

print("Running Accuracy Evaluation on Real Brand 233 Items...")
passed = 0
for path, expected_family, expected_color in test_samples:
    desc = descriptors.get(path)
    if not desc:
        print(f"FAILED: {path} not found in descriptors")
        continue
    
    matched_family = desc['family']
    matched_color = desc['dominantColor']
    
    # Check family
    fam_ok = (expected_family.lower() in matched_family.lower()) or (matched_family.lower() in expected_family.lower())
    
    status = "PASS" if fam_ok else "FAIL"
    if fam_ok:
        passed += 1
    print(f"[{status}] Sample: {os.path.basename(path)}")
    print(f"       Expected: Family='{expected_family}', Color='{expected_color}'")
    print(f"       Detected: Family='{matched_family}', Color='{matched_color}' (Swatch: {desc['swatch']})")

print(f"\nAccuracy: {passed}/{len(test_samples)} ({int(passed/len(test_samples)*100)}%)")
