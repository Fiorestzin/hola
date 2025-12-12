import sqlite3
import os

DB_PATH = "finance.db"

if not os.path.exists(DB_PATH):
    print("DB NOT FOUND at", os.path.abspath(DB_PATH))
else:
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("--- TABLES ---")
        cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table'")
        for row in cursor.fetchall():
            print(f"Table: {row[0]}")
            print(f"Schema: {row[1]}")
            print("-" * 20)

        print("\n--- TRANSACTIONS SAMPLE ---")
        try:
            cursor.execute("SELECT * FROM transactions ORDER BY rowid DESC LIMIT 3")
            columns = [description[0] for description in cursor.description]
            print(f"Columns: {columns}")
            for row in cursor.fetchall():
                print(row)
        except Exception as e:
            print(f"Error reading transactions: {e}")

        conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")
