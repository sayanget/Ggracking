import re

def test():
    with open("widget_single.html", "r", encoding="utf-8") as f:
        html = f.read()
        
    print("Length of HTML:", len(html))
    
    # Let's find any URLs or API paths
    paths = set(re.findall(r'["\'](/[^"\'\s>]+)["\']', html))
    print("Found", len(paths), "paths.")
    
    # Filter paths that look like API endpoints
    api_paths = [p for p in paths if "track" in p.lower() or "api" in p.lower() or "active" in p.lower()]
    print("\nAPI paths:")
    for p in sorted(api_paths):
        print(" -", p)
        
if __name__ == "__main__":
    test()
