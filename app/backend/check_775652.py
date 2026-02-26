import sqlite3
import glob

print("Checking databases for goal_id=775652...")
for db in glob.glob('*.db'):
    try:
        conn = sqlite3.connect(db)
        c = conn.cursor()
        c.execute('SELECT banco, cuenta, sum(monto) FROM savings_contributions WHERE goal_id=775652 GROUP BY banco, cuenta')
        rows = c.fetchall()
        if rows:
            print(f"--- DB: {db} ---")
            for r in rows:
                print(r)
        
        # Check if the goal exists at all
        c.execute('SELECT * FROM savings_goals WHERE id=775652')
        goal = c.fetchone()
        if goal:
            print(f"Goal exists in {db}: {goal}")
    except Exception as e:
        print(f"Error in {db}: {e}")
