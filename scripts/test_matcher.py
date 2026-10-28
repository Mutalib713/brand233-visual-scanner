import json

with open('src/data/descriptors.json', 'r', encoding='utf-8') as f:
    desc = json.load(f)

def hamming(s1, s2):
    return sum(c1 != c2 for c1, c2 in zip(s1, s2))

# Test every image in descriptors against all other descriptors
results = {}
for path, d in desc.items():
    fam = d['family']
    hH = d['dHashH']
    hV = d['dHashV']
    ar = d['aspectRatio']
    
    scores = []
    for ref_path, ref_d in desc.items():
        dH = hamming(hH, ref_d['dHashH'])
        dV = hamming(hV, ref_d['dHashV'])
        tot = dH + dV
        sim = max(0, 100 - (tot / 512) * 100 * 2.2)
        arDiff = abs(ar - ref_d['aspectRatio'])
        if arDiff > 0.8: sim -= 20
        elif arDiff > 0.4: sim -= 10
        scores.append((ref_d['family'], sim, ref_path))
        
    scores.sort(key=lambda x: -x[1])
    top_fam = scores[0][0]
    top_sim = scores[0][1]
    top_ref = scores[0][2]
    # Check 2nd best (excluding self match)
    second = scores[1] if len(scores) > 1 else None
    
    print(f"Query: {path}")
    print(f"  Self: {fam} -> Top match: {top_fam} ({top_sim:.1f}%), 2nd: {second[0] if second else ''} ({second[1]:.1f}%)")
