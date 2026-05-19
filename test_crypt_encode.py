def encode_tracking_id(tracking_id: str) -> str:
    encoded = []
    for c in tracking_id:
        val = (ord(c) - 50) % 126
        encoded.append(chr(val))
    return "".join(encoded)

def test():
    tracking = "SPXMCO115400412373"
    enc = encode_tracking_id(tracking)
    print("Encoded string:", repr(enc))
    
    # URL encode it
    import urllib.parse
    print("URL Encoded:", urllib.parse.quote(enc))
    
if __name__ == "__main__":
    test()
