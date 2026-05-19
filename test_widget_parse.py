import json

def test():
    with open("widget_responses.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for item in data:
        url = item["url"]
        if "track/restapi" in url:
            print("\nFOUND TRACK/RESTAPI:")
            print("URL:", url)
            print("Method:", item["method"])
            print("Status:", item["status"])
            print("Request Headers:")
            print(json.dumps(item["headers"], indent=2))
            print("Post Data:")
            print(item["post_data"])
            print("Response Length:", len(item["response_text"]))
            print("Response:")
            # Parse response json and print it nicely
            try:
                res_obj = json.loads(item["response_text"])
                print(json.dumps(res_obj, indent=2, ensure_ascii=False)[:3000])
            except Exception as e:
                print("Failed to parse response JSON:", e)
                print(item["response_text"][:1000])

if __name__ == "__main__":
    test()
