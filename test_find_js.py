import re

def test():
    with open("parcels.html", "r", encoding="utf-8") as f:
        html = f.read()
        
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
    for i, s in enumerate(scripts):
        s_clean = s.strip()
        if "uuid" in s_clean or "tracking" in s_clean or "parcels" in s_clean:
            print(f"\n--- Script {i} ---")
            print(s_clean[:1000])

if __name__ == "__main__":
    test()
