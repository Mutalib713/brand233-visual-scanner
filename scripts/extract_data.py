import os
import sqlite3
import json
import re

db_path = r'c:\Users\USER\Downloads\giftshop-manual-2026-10-20T23-35-10-857Z.db'
target_dir = r'c:\Users\USER\MyClaudeProjects\brand233-visual-scanner'
uploads_dir = os.path.join(target_dir, 'public', 'uploads')
os.makedirs(uploads_dir, exist_ok=True)

con = sqlite3.connect(db_path)
cur = con.cursor()

# 1. Unpack backup_photos into public/uploads
print("Unpacking backup photos...")
cur.execute("SELECT name, data FROM backup_photos")
photos = cur.fetchall()
saved_photos = 0
for name, data in photos:
    clean_name = os.path.basename(name)
    filepath = os.path.join(uploads_dir, clean_name)
    with open(filepath, 'wb') as f:
        f.write(data)
    saved_photos += 1
print(f"Extracted {saved_photos} photos to {uploads_dir}")

# 2. Extract categories
cur.execute("SELECT id, name FROM categories")
categories = {row[0]: row[1] for row in cur.fetchall()}

# 3. Extract stock levels
cur.execute("SELECT product_id, quantity FROM retail_stock")
retail_stock = {}
for pid, qty in cur.fetchall():
    retail_stock[pid] = qty

cur.execute("SELECT product_id, quantity FROM warehouse_stock")
warehouse_stock = {}
for pid, qty in cur.fetchall():
    warehouse_stock[pid] = qty

# 4. Color keywords definition
COLOR_MAP = {
    'white': ('White', '#FFFFFF'),
    'black': ('Black', '#1E293B'),
    'blue': ('Blue', '#2563EB'),
    'navy': ('Navy', '#1E3A8A'),
    'red': ('Red', '#DC2626'),
    'green': ('Green', '#16A34A'),
    'grey': ('Grey', '#64748B'),
    'gray': ('Grey', '#64748B'),
    'pink': ('Pink', '#EC4899'),
    'purple': ('Purple', '#9333EA'),
    'gold': ('Gold', '#EAB308'),
    'silver': ('Silver', '#94A3B8'),
    'orange': ('Orange', '#F97316'),
    'yellow': ('Yellow', '#FACC15'),
    'rose gold': ('Rose Gold', '#FB7185'),
    'brown': ('Brown', '#78350F')
}

def parse_product_family_and_variant(name):
    clean = name.strip()
    # Check if ends with a color or has a color in parens or word boundary
    found_color = None
    color_hex = None
    base_family = clean
    
    # Sort keys by length descending (so 'rose gold' matches before 'gold')
    for c_key in sorted(COLOR_MAP.keys(), key=lambda x: -len(x)):
        # Match as distinct word
        pattern = r'(?i)\b' + re.escape(c_key) + r'\b'
        if re.search(pattern, clean):
            found_color, color_hex = COLOR_MAP[c_key]
            # Strip the color from base family
            base_family = re.sub(pattern, '', clean).strip()
            # Clean up residual parens, hyphens, dashes
            base_family = re.sub(r'[\(\)\-\,\/]+', ' ', base_family).strip()
            base_family = re.sub(r'\s+', ' ', base_family).strip()
            break
            
    if not found_color:
        found_color = 'Standard'
        color_hex = '#94A3B8'
        
    return base_family, found_color, color_hex

# 5. Extract products
cur.execute("""
    SELECT id, sku, name, category_id, description, cost_price, selling_price, is_active, image_url 
    FROM products 
    ORDER BY id ASC
""")
products_raw = cur.fetchall()

catalog = []
families_dict = {}

for row in products_raw:
    pid, sku, name, cat_id, desc, cost, price, active, img_url = row
    
    # Image resolution
    final_img = None
    if img_url:
        basename = os.path.basename(img_url)
        if os.path.exists(os.path.join(uploads_dir, basename)):
            final_img = f"/uploads/{basename}"

    family_name, variant_color, variant_hex = parse_product_family_and_variant(name)
    
    prod_item = {
        "id": pid,
        "sku": sku,
        "name": name,
        "family": family_name,
        "color": variant_color,
        "colorHex": variant_hex,
        "category": categories.get(cat_id, "Gifts"),
        "categoryId": cat_id,
        "costPrice": cost or 0,
        "sellingPrice": price or 0,
        "retailStock": retail_stock.get(pid, 0),
        "warehouseStock": warehouse_stock.get(pid, 0),
        "totalStock": (retail_stock.get(pid, 0) or 0) + (warehouse_stock.get(pid, 0) or 0),
        "imageUrl": final_img,
        "hasImage": final_img is not None
    }
    catalog.append(prod_item)
    
    if family_name not in families_dict:
        families_dict[family_name] = {
            "family": family_name,
            "category": categories.get(cat_id, "Gifts"),
            "referenceImages": [],
            "variants": []
        }
    
    if final_img and final_img not in families_dict[family_name]["referenceImages"]:
        families_dict[family_name]["referenceImages"].append(final_img)
        
    families_dict[family_name]["variants"].append(prod_item)

con.close()

# Save catalog JSON to src/data/catalog.json
data_dir = os.path.join(target_dir, 'src', 'data')
os.makedirs(data_dir, exist_ok=True)

with open(os.path.join(data_dir, 'catalog.json'), 'w', encoding='utf-8') as f:
    json.dump(catalog, f, indent=2)

families_list = list(families_dict.values())
with open(os.path.join(data_dir, 'families.json'), 'w', encoding='utf-8') as f:
    json.dump(families_list, f, indent=2)

print(f"Saved {len(catalog)} products and {len(families_list)} families to {data_dir}")
