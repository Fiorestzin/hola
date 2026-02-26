import sqlite3
import glob

search_val = "775652"
print(f"Searching for '{search_val}' in all DBs...")

for db in glob.glob('*.db'):
    try:
        conn = sqlite3.connect(db)
        c = conn.cursor()
        c.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = c.fetchall()
        for t in tables:
            table = t[0]
            c.execute(f"PRAGMA table_info({table})")
            cols = [row[1] for row in c.fetchall()]
            for col in cols:
                try:
                    c.execute(f"SELECT * FROM {table} WHERE CAST({col} AS TEXT) LIKE '%775652%'")
                    rows = c.fetchall()
                    if rows:
                        print(f"Match in {db} -> {table}.{col}:")
                        for r in rows:
                            print(r)
                except:
                    pass
    except Exception as e:
        print(f"Error {db}: {e}")
