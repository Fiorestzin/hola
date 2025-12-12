import sqlite3

def migrate():
    try:
        conn = sqlite3.connect('finance.db')
        cursor = conn.cursor()
        
        # Create budgets table
        # id, category, amount, month (YYYY-MM)
        # uniqueness constraint on (category, month) to prevent duplicates per month
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                month TEXT NOT NULL,
                UNIQUE(category, month)
            )
        ''')
        
        print("Table 'budgets' created successfully.")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == '__main__':
    migrate()
