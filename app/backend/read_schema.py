import sqlite3
c = sqlite3.connect('finance_test.db')
with open('out_schema.txt', 'w') as f:
    f.write(c.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='budgets'").fetchone()[0])
