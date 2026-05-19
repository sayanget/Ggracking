import re

def test():
    with open("externalcall.js", "r", encoding="utf-8") as f:
        js = f.read()
        
    lines = js.split("\n")
    print("Total lines:", len(lines))
    
    keywords = ["message", "listener", "addEventListener"]
    for i, line in enumerate(lines):
        for kw in keywords:
            if kw in line:
                print(f"Line {i+1}: {line[:200]}")
                break

if __name__ == "__main__":
    test()
