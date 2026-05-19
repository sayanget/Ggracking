def solve():
    tracking = "SPXMCO115400412373"
    encoded_bytes = [
        0x21, 0x1E, 0x26, 0x1B, 0x11, 0x1D, 0x7D, 0x7D, 0x03, 0x02, 0x7C, 0x7C, 0x02, 0x7D, 0x00, 0x01, 0x05, 0x01
    ]
    
    print("Char | Ord | Encoded | Diff | XOR")
    print("-" * 35)
    for c, enc in zip(tracking, encoded_bytes):
        diff = ord(c) - enc
        xor = ord(c) ^ enc
        print(f" {c}   | {ord(c):3d} |   {enc:3d}   | {diff:4d} | {xor:3d} (0x{xor:02X})")
        
if __name__ == "__main__":
    solve()
