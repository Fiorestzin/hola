import sqlite3
import glob

print("Checking for contributions with empty/null banco...")
for db in glob.glob('*.db'):
    try:
        conn = sqlite3.connect(db)
        c = conn.cursor()
        c.execute("SELECT id, goal_id, monto, banco, cuenta FROM savings_contributions WHERE banco IS NULL OR banco = ''")
        rows = c.fetchall()
        if rows:
            print(f"--- DB: {db} ---")
            for r in rows:
                print(r)
    except Exception as e:
        pass
