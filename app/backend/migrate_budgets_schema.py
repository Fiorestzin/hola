import sqlite3
import os

DB_NAMES = ["finance_test.db", "finance_prod.db"]

def migrate_db(db_name):
    if not os.path.exists(db_name):
        print(f"Skipping {db_name} (not found)")
        return

    print(f"\nMigrating {db_name}...")
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    try:
        # 1. Rename existing table
        cursor.execute("ALTER TABLE budgets RENAME TO budgets_old")
        
        # 2. Create new table with correct constraint
        # UNIQUE(category, month, environment) instead of (category, month)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                month TEXT NOT NULL,
                environment TEXT DEFAULT 'TEST',
                UNIQUE(category, month, environment)
            )
        ''')
        
        # 3. Copy data
        # Note: We handle the case where 'environment' column might not exist in old table
        # by checking columns first or just inserting with default
        
        # Get columns of old table to see if 'environment' exists
        cursor.execute("PRAGMA table_info(budgets_old)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if 'environment' in columns:
            cursor.execute('''
                INSERT INTO budgets (id, category, amount, month, environment)
                SELECT id, category, amount, month, environment FROM budgets_old
            ''')
        else:
            print("  'environment' column missing in old table, using default 'TEST'")
            cursor.execute('''
                INSERT INTO budgets (id, category, amount, month, environment)
                SELECT id, category, amount, month, 'TEST' FROM budgets_old
            ''')
            
        # 4. Drop old table
        cursor.execute("DROP TABLE budgets_old")
        
        print(f"✅ Migration successful for {db_name}")
        conn.commit()

    except Exception as e:
        print(f"❌ Error migrating {db_name}: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    for db in DB_NAMES:
        migrate_db(db)
