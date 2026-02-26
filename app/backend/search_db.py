import sqlite3
import glob

print("Dumping all goals from databases...")
for db in glob.glob('*.db'):
    try:
        conn = sqlite3.connect(db)
        c = conn.cursor()
        c.execute('SELECT id, nombre, monto_actual FROM savings_goals')
        goals = c.fetchall()
        if goals:
            print(f"--- DB: {db} ---")
            for g in goals:
                print(g)
    except Exception as e:
        pass
