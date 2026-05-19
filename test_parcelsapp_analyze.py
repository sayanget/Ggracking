import json

def test():
    with open("parcels_requests.json", "r", encoding="utf-8") as f:
        reqs = json.load(f)
        
    print("Total requests:", len(reqs))
    for r in reqs:
        url = r["url"]
        if "parcels" in url:
            print(f"\n[{r['method']}] {url}")
            if r["post_data"]:
                print("  Post Data:", r["post_data"][:300])

if __name__ == "__main__":
    test()
