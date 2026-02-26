import sqlite3
import os

DB_NAMES = ["finance_test.db", "finance_prod.db", "finances.db"]

def migrate_db(db_name):
    if not os.path.exists(db_name):
        print(f"Skipping {db_name} (not found)")
        return

    print(f"\nMigrating {db_name}...")
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    try:
        # Get schema of old budgets table
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='budgets'")
        row = cursor.fetchone()
        if not row:
            print("No budgets table")
            return
        
        sql = row[0]
        print("OLD SCHEMA:", sql)
        
        # 1. Rename existing table
        cursor.execute("ALTER TABLE budgets RENAME TO budgets_old")
        
        # 2. Create new table without the strict UNIQUE constraint
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                nombre TEXT,
                amount REAL NOT NULL,
                month TEXT NOT NULL,
                environment TEXT DEFAULT 'TEST',
                banco_designado TEXT,
                cuenta_designada TEXT,
                fecha_pago TEXT,
                frecuencia TEXT DEFAULT 'unavez'
            )
        ''')
        
        # 3. Copy data
        cursor.execute("PRAGMA table_info(budgets_old)")
        columns = [info[1] for info in cursor.fetchall()]
        cols_str = ", ".join(columns)
        
        cursor.execute(f'''
            INSERT INTO budgets ({cols_str})
            SELECT {cols_str} FROM budgets_old
        ''')
            
        # 4. Drop old table
        cursor.execute("DROP TABLE budgets_old")
        
        # Add a unique constraint that includes nombre, frequency and environment
        # Actually it's better to just let the application level handle duplicates for now, 
        # or just UNIQUE(category, nombre, month, environment)
        
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
