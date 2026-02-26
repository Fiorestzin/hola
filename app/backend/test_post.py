import urllib.request
import json
import sys

data = json.dumps({
    'category': 'Alimentación',
    'amount': 150000,
    'month': '2026-02',
    'environment': 'PROD',
    'banco_designado': '',
    'fecha_pago': '',
    'frecuencia': 'mensual'
}).encode('utf-8')

req = urllib.request.Request('http://127.0.0.1:8000/budgets', data=data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
