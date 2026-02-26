import sqlite3
import json

conn = sqlite3.connect('finance_test.db')
c = conn.cursor()

output = []

c.execute("SELECT id, monto, banco, cuenta FROM savings_contributions WHERE goal_id = 12")
output.append("Contributions:")
for r in c.fetchall():
    output.append(str(r))

c.execute("SELECT id, monto, banco, cuenta FROM savings_withdrawals WHERE goal_id = 12")
output.append("Withdrawals:")
for r in c.fetchall():
    output.append(str(r))

with open('goal_12_out.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

