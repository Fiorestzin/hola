import sqlite3
c = sqlite3.connect('finance_test.db')
with open('out_indices.txt', 'w') as f:
    for row in c.execute("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='budgets'"):
        f.write(str(row) + '\n')
