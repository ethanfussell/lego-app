import os
import requests
import json

# Define the cache file path
CACHE_FILE = os.path.join(os.path.dirname(__file__), "sets_cache.json")

# Rebrickable API details
API_URL = "https://rebrickable.com/api/v3/lego/sets/"
API_KEY = os.getenv("REBRICKABLE_API_KEY")  # Store your API key in an environment variable

def fetch_all_lego_sets():
    """Fetch all LEGO sets from the Rebrickable API and save to a local file."""
    if not API_KEY:
        raise ValueError("Rebrickable API key is missing. Set the REBRICKABLE_API_KEY environment variable.")

    headers = {"Authorization": f"key {API_KEY}"}
    sets = []
    page = 1

    while True:
        response = requests.get(API_URL, headers=headers, params={"page": page})
        if response.status_code == 200:
            data = response.json()
            sets.extend([
                {
                    "set_num": item["set_num"],
                    "name": item["name"],
                    "pieces": item["num_parts"],
                    "theme": item.get("theme", "Unknown"),  # Use .get() to avoid KeyError
                    "year": item["year"],
                }
                for item in data["results"]
            ])
            if not data["next"]:  # Check if there's another page
                break
            page += 1
        else:
            print(f"Error fetching data: {response.status_code}, {response.text}")
            break

    # Save the data to the cache file
    with open(CACHE_FILE, "w") as f:
        json.dump(sets, f, indent=4)
    print(f"Fetched {len(sets)} LEGO sets and saved to {CACHE_FILE}")

if __name__ == "__main__":
    fetch_all_lego_sets()