import requests

def test():
    url = "https://www.17track.net/externalcall.js"
    r = requests.get(url, timeout=10)
    print("Status:", r.status_code)
    print("Length:", len(r.text))
    
    # Save the JS file
    with open("externalcall.js", "w", encoding="utf-8") as f:
        f.write(r.text)
    print("Saved to externalcall.js")
    
    # Search for postMessage, message, callback, or event in JS
    print("\nKeywords Check:")
    for kw in ["message", "postMessage", "callback", "event", "listener", "addEventListener", "YQV5"]:
        print(f"Keyword '{kw}' count:", r.text.lower().count(kw.lower()))
        
if __name__ == "__main__":
    test()
