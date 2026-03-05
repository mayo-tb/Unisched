import requests
import json
import os

BASE_URL = "http://127.0.0.1:8000/api"

def get_token():
    try:
        # Try to authenticate with default admin credentials
        resp = requests.post(f"{BASE_URL}/auth/token/", json={"username": "admin", "password": "password123"})
        if resp.status_code == 200:
            return resp.json()['access']
        print(f"Auth failed: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"Auth connection failed: {e}")
    return None

def verify_endpoints():
    token = get_token()
    if not token:
        print("Skipping authenticated tests due to login failure.")
        return

    headers = {"Authorization": f"Bearer {token}"}
    print(f"\n--- Verifying Endpoints with User Token ---")

    # 1. Dashboard Metrics
    url = f"{BASE_URL}/dashboard/metrics/"
    try:
        resp = requests.get(url, headers=headers)
        print(f"GET {url}: {resp.status_code}")
        if resp.status_code == 200:
            print("  Dashboard Metrics OK")
    except Exception as e:
        print(f"Failed {url}: {e}")

    # 2. Resources (Courses)
    url = f"{BASE_URL}/courses/"
    try:
        resp = requests.get(url, headers=headers)
        print(f"GET {url}: {resp.status_code}")
        if resp.status_code == 200:
             data = resp.json()
             count = len(data.get('results', [])) if 'results' in data else len(data)
             print(f"  Courses found: {count}")
    except Exception as e:
        print(f"Failed {url}: {e}")

    # 3. Timetable
    url = f"{BASE_URL}/timetable/"
    try:
        resp = requests.get(url, headers=headers)
        print(f"GET {url}: {resp.status_code}")
        if resp.status_code == 200:
            print("  Timetable OK")
    except Exception as e:
        print(f"Failed {url}: {e}")

if __name__ == "__main__":
    verify_endpoints()
