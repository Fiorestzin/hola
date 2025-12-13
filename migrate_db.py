"""
Database migration script for PostgreSQL
1. Add unique constraint to budgets for ON CONFLICT to work
2. Add environment column to transactions
3. Mark existing transactions as TEST (demo)
"""
import psycopg2

DATABASE_URL = "postgresql://postgres.ijwmxgnfilnihiizozdg:72143306Sfmm!@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("Starting migration...")

# 1. Add unique constraint to budgets (for ON CONFLICT to work)
try:
    cur.execute("""
        ALTER TABLE budgets 
        ADD CONSTRAINT budgets_category_month_unique 
        UNIQUE (category, month)
    """)
    print("Added unique constraint to budgets")
except Exception as e:
    print(f"Budgets constraint: {e}")
    conn.rollback()

# 2. Add environment column to transactions
try:
    cur.execute("ALTER TABLE transactions ADD COLUMN environment TEXT")
    print("Added environment column")
except Exception as e:
    print(f"Environment column: {e}")
    conn.rollback()

# 3. Set all existing transactions as TEST (demo)
try:
    cur.execute("UPDATE transactions SET environment = 'TEST' WHERE environment IS NULL")
    print("Marked existing transactions as TEST")
except Exception as e:
    print(f"Update environment: {e}")
    conn.rollback()

conn.commit()
print("Migration complete!")

# Verify
cur.execute("SELECT COUNT(*) FROM transactions WHERE environment = 'TEST'")
print(f"TEST transactions: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM transactions WHERE environment = 'PROD' OR environment IS NULL")
print(f"PROD/NULL transactions: {cur.fetchone()[0]}")

conn.close()
