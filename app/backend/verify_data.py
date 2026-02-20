import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'finance_test.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM transactions WHERE fecha >= "2025-12-01"')
count = cursor.fetchone()[0]
print(f"Transactions from 2025-12-01: {count}")
conn.close()
