import sqlite3
import os

DB_PATH = "finance.db"

def test_db_write():
    print(f"Attempting to write to {DB_PATH}...")
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        
        print("Executing INSERT...")
        cursor.execute('''
            INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, ingreso, gasto, monto)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', ('2025-12-12', 'Gasto', 'TestDB', 'DirectWrite', 'Efectivo', 0, 100, 100))
        
        conn.commit()
        print("INSERT SUCCESS. Data committed.")
        
        cursor.execute("SELECT id, detalle FROM transactions WHERE detalle = 'DirectWrite'")
        row = cursor.fetchone()
        print(f"VERIFICATION SELECT: {row}")
        
        conn.close()
        return True
    except Exception as e:
        print(f"DB WRITE FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if os.path.exists("app/backend/finance.db"):
        os.chdir("app/backend")
    elif os.path.exists("backend/finance.db"):
        os.chdir("backend")
    
    test_db_write()
