import re
import sys

# Ensure stdout uses utf-8 or replaces characters safely
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def test():
    with open("m_track.html", "r", encoding="utf-8") as f:
        html = f.read()
    
    print("HTML length:", len(html))
    
    # Search for script tags
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
    print(f"Found {len(scripts)} script tags")
    
    # Print the start of each script
    for i, s in enumerate(scripts):
        s_clean = s.strip()
        if not s_clean:
            continue
        print(f"\n--- Script {i} (len: {len(s_clean)}) ---")
        print(s_clean[:300])
        if "SPXMCO" in s_clean or "track" in s_clean.lower() or "data" in s_clean.lower():
            print("  (Contains interesting keywords!)")

if __name__ == "__main__":
    test()
