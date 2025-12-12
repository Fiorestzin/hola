import urllib.request
import urllib.error
import json

BASE_URL = "http://127.0.0.1:8000"

def test_backend():
    print(f"Testing connectivity to {BASE_URL}...")
    try:
        # 1. Health Check
        try:
            with urllib.request.urlopen(f"{BASE_URL}/") as response:
                 print(f"Health Check: {response.getcode()} - OK")
        except Exception as e:
            print(f"Health Check FAILED: {e}")
            return False

        # 2. Post Transaction
        data = {
            "fecha": "2025-12-12",
            "tipo": "Gasto",
            "categoria": "TestBackend",
            "detalle": "Verification Script",
            "banco": "Efectivo",
            "monto": 12345.0
        }
        req = urllib.request.Request(
            f"{BASE_URL}/transaction", 
            data=json.dumps(data).encode('utf-8'), 
            headers={'Content-Type': 'application/json'}
        )
        try:
            with urllib.request.urlopen(req) as response:
                 print(f"Create Tx: {response.getcode()} - {response.read().decode()}")
        except urllib.error.HTTPError as e:
             error_body = e.read().decode()
             print(f"CREATE TX FAILED: {e.code} {e.reason} - {error_body}")
             return False

        # 3. Read Transactions
        try:
            with urllib.request.urlopen(f"{BASE_URL}/transactions?limit=5") as response:
                txs = json.loads(response.read().decode())
                print(f"Read Txs: Found {len(txs)} items")
                found = any(t['detalle'] == "Verification Script" for t in txs)
                if not found:
                    print("FAILED to find created transaction")
                else:
                     print("SUCCESS: Found created transaction")
        except Exception as e:
            print(f"Read Txs FAILED: {e}")

        # 4. Excel Export
        try:
            with urllib.request.urlopen(f"{BASE_URL}/export_report?start_date=2025-12-01&end_date=2025-12-12") as response:
                content = response.read()
                print(f"Export Report: {response.getcode()} - Size: {len(content)} bytes")
        except urllib.error.HTTPError as e:
             error_body = e.read().decode()
             print(f"Export Report FAILED: {e.code} {e.reason} - {error_body}")
        except Exception as e:
            print(f"Export Report FAILED: {e}")

        print("SUCCESS: Backend is fully operational.")
        return True

    except Exception as e:
        print(f"CRITICAL FAILURE: {e}")
        return False

if __name__ == "__main__":
    test_backend()
