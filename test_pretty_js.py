def test():
    with open("externalcall.js", "r", encoding="utf-8") as f:
        js = f.read()
        
    pos = js.find("e.onmessage")
    if pos != -1:
        start = pos
        end = min(len(js), pos + 1000)
        print("Context after e.onmessage:")
        print(js[start:end])

if __name__ == "__main__":
    test()
