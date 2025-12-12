import requests
import json

BASE_URL = "http://localhost:8000"

def test_backend():
    print(f"Testing connectivity to {BASE_URL}...")
    try:
        # 1. Health Check
        r = requests.get(f"{BASE_URL}/")
        print(f"Health Check: {r.status_code} - {r.json()}")
        if r.status_code != 200:
            return False

        # 2. Post Transaction
        data = {
            "fecha": "2025-12-12",
            "tipo": "Gasto",
            "categoria": "TestBackend",
            "detalle": "Verification Script",
            "banco": "Efectivo",
            "monto": 12345
        }
        r = requests.post(f"{BASE_URL}/transaction", json=data)
        print(f"Create Tx: {r.status_code} - {r.json()}")
        if r.status_code != 200:
            print("FAILED to create transaction")
            return False

        # 3. Read Transactions
        r = requests.get(f"{BASE_URL}/transactions?limit=5")
        txs = r.json()
        print(f"Read Txs: Found {len(txs)} items")
        found = any(t['detalle'] == "Verification Script" for t in txs)
        if not found:
            print("FAILED to find created transaction")
            return False
        
        # 4. Excel Export
        r = requests.get(f"{BASE_URL}/export_report?start_date=2025-12-01&end_date=2025-12-12")
        print(f"Export Report: {r.status_code} - Size: {len(r.content)} bytes")
        if r.status_code != 200:
            print("FAILED to export report")
            return False

        print("SUCCESS: Backend is fully operational.")
        return True

    except Exception as e:
        print(f"CRITICAL FAILURE: {e}")
        return False

if __name__ == "__main__":
    test_backend()
