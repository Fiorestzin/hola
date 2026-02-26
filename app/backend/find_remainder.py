import sqlite3
import glob

print("Calculating grouped sums per goal for all DBs...")
for db in glob.glob('*.db'):
    try:
        conn = sqlite3.connect(db)
        c = conn.cursor()
        c.execute("""
            SELECT goal_id, banco, cuenta, SUM(monto) as total
            FROM savings_contributions
            GROUP BY goal_id, banco, cuenta
            HAVING SUM(monto) != 0
        """)
        rows = c.fetchall()
        
        # Now fetch the goals to get their names
        goals = {}
        c.execute("SELECT id, nombre FROM savings_goals")
        for g_id, g_name in c.fetchall():
            goals[g_id] = g_name

        if rows:
            print(f"--- DB: {db} ---")
            
            # Print by goal_id
            goal_sums = {}
            for r in rows:
                g_id, banco, cuenta, total = r
                if g_id not in goal_sums:
                    goal_sums[g_id] = []
                goal_sums[g_id].append((banco, cuenta, total))
            
            for g_id, sums in goal_sums.items():
                name = goals.get(g_id, "Unknown")
                print(f"Goal {g_id} ({name}):")
                total_goal = 0
                for s in sums:
                    print(f"  Banco: {s[0]}, Cuenta: {s[1]}, Total: {s[2]}")
                    total_goal += s[2]
                print(f"  --> Grand Total: {total_goal}")
                print()
    except Exception as e:
        pass
