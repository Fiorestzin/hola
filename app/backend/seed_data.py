import sqlite3
import random
from datetime import datetime, timedelta

def create_connection():
    try:
        conn = sqlite3.connect('finance.db')
        return conn
    except sqlite3.Error as e:
        print(e)
    return None

def seed_data():
    conn = create_connection()
    if conn is None:
        print("Error connecting to database")
        return

    cursor = conn.cursor()
    
    # Clean existing data and reset schema
    cursor.execute("DROP TABLE IF EXISTS transactions")
    
    # Ensure table exists (just in case)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT,
            tipo TEXT,
            categoria TEXT,
            detalle TEXT,
            banco TEXT,
            monto REAL,
            ingreso REAL,
            gasto REAL
        )
    ''')
    
    categories = ['Vivienda', 'Alimentación', 'Transporte', 'Servicios', 'Ocio', 'Salud', 'Educación']
    banks = ['Santander', 'Banco Estado', 'Banco de Chile', 'Efectivo']
    
    # Fixed monthly expenses
    fixed_expenses = [
        ('Vivienda', 'Alquiler Depto', 450000),
        ('Servicios', 'Internet Fibra', 25990),
        ('Servicios', 'Luz + Agua', 35000),
        ('Educación', 'Curso Inglés', 80000),
        ('Ocio', 'Netflix', 10990),
        ('Ocio', 'Spotify', 6500)
    ]
    
    # Variable expenses patterns
    variable_expenses = [
        ('Alimentación', 'Supermercado Lider', 80000, 150000),
        ('Alimentación', 'Minimarket Esquina', 5000, 20000),
        ('Transporte', 'Uber', 4000, 12000),
        ('Transporte', 'Carga Bip!', 5000, 10000),
        ('Ocio', 'Salida a Comer', 25000, 60000),
        ('Salud', 'Farmacia', 5000, 30000),
        ('Vivienda', 'Artículos Limpieza', 10000, 30000)
    ]

    start_date = datetime(2024, 1, 1)
    end_date = datetime(2025, 12, 12)
    current_date = start_date

    count = 0
    
    while current_date <= end_date:
        month_str = current_date.strftime('%Y-%m')
        day_str = current_date.strftime('%Y-%m-%d')
        
        # 1. Salary (Income) - Once a month
        if current_date.day == 5 or (current_date.day == 3 and current_date.weekday() == 4): # Payday around 5th
            salary = 1600000 + random.randint(0, 50000)
            cursor.execute('''
                INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, monto, ingreso, gasto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (day_str, 'Ingreso', 'Sueldo', 'Sueldo Mensual', 'Santander', salary, salary, 0))
            count += 1

        # 2. Fixed Expenses - Around 1st-10th
        if current_date.day == 2:
            for cat, det, amount in fixed_expenses:
                # Add some slight variation
                final_amount = amount + random.randint(-500, 500)
                bank = random.choice(['Santander', 'Banco de Chile'])
                cursor.execute('''
                    INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, monto, ingreso, gasto)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (day_str, 'Gasto', cat, det, bank, final_amount, 0, final_amount))
                count += 1

        # 3. Random Variable Expenses
        if random.random() < 0.4: # 40% chance of expense each day
            cat, det, min_amt, max_amt = random.choice(variable_expenses)
            amount = random.randint(min_amt, max_amt)
            bank = random.choice(banks)
            cursor.execute('''
                INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, monto, ingreso, gasto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (day_str, 'Gasto', cat, det, bank, amount, 0, amount))
            count += 1
            
        current_date += timedelta(days=1)

    conn.commit()
    conn.close()
    print(f"Database seeded with {count} transactions.")

if __name__ == '__main__':
    seed_data()
