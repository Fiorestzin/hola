import sqlite3
import os

def check_schema(db_name):
    if not os.path.exists(db_name):
        print(f"DB {db_name} not found.")
        return

    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='budgets'")
    row = cursor.fetchone()
    if row:
        print(f"--- Schema for {db_name} ---")
        print(row[0])
    else:
        print(f"Table 'budgets' not found in {db_name}")
    conn.close()

if __name__ == "__main__":
    check_schema("finance_test.db")
    check_schema("finance_prod.db")
