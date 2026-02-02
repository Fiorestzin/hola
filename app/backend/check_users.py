import sqlite3
import os

DB_PATH = "finance_test.db"
if os.path.exists(DB_PATH):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT username, is_admin FROM users")
        rows = cursor.fetchall()
        if rows:
            print("Users found:")
            for row in rows:
                print(f"User: {row[0]}, Admin: {row[1]}")
        else:
            print("No users found.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
else:
    print("DB not found.")
