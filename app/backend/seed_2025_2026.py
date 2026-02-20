import sqlite3
import random
from datetime import datetime, timedelta
import os

def create_connection():
    db_path = os.path.join(os.path.dirname(__file__), 'finance_test.db')
    try:
        conn = sqlite3.connect(db_path)
        return conn
    except sqlite3.Error as e:
        print(e)
    return None

def seed_current_period():
    conn = create_connection()
    if conn is None:
        print("Error connecting to database")
        return

    cursor = conn.cursor()
    
    # Check if environment column exists, if not, verify schema
    cursor.execute("PRAGMA table_info(transactions)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'environment' not in columns:
        print("Adding environment column...")
        cursor.execute("ALTER TABLE transactions ADD COLUMN environment TEXT DEFAULT 'PROD'")

    # Set range: Dec 1 2025 to Feb 7 2026
    start_date = datetime(2025, 12, 1)
    end_date = datetime(2026, 2, 7)
    current_date = start_date

    categories_gasto = [
        ('Alimentación', ['Supermercado Lider', 'Feria', 'Panadería', 'Restaurante', 'Delivery Sushi']),
        ('Transporte', ['Carga Bip', 'Uber', 'Bencina', 'Estacionamiento']),
        ('Vivienda', ['Gastos Comunes', 'Reparación baño', 'Mueble nuevo']),
        ('Servicios', ['Luz', 'Agua', 'Gas', 'Internet', 'Celular']),
        ('Entretenimiento', ['Cine', 'Netflix', 'Spotify', 'Salida Bar', 'Libros']),
        ('Salud', ['Farmacia', 'Consulta dental', 'Exámenes']),
        ('Educación', ['Curso online', 'Materiales']),
        ('Ropa', ['Zapatos', 'Polera', 'Jeans'])
    ]
    
    banks = ['Santander', 'Banco Estado', 'Banco de Chile', 'Efectivo']
    
    count = 0
    
    # Fix salary and fixed expenses for the 3 months
    months = [
        (2025, 12),
        (2026, 1),
        (2026, 2)
    ]
    
    for year, month in months:
        # Salary
        day_salary = 5
        salary_date = datetime(year, month, day_salary).strftime('%Y-%m-%d')
        salary_amt = 1500000 + random.randint(0, 100000)
        cursor.execute('''
            INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, ingreso, gasto, monto, environment)
            VALUES (?, 'Ingreso', 'Salario', 'Sueldo Mensual', 'Santander', ?, 0, ?, 'PROD')
        ''', (salary_date, salary_amt, salary_amt))
        count += 1
        
        # Rent/Vivienda fixed
        rent_date = datetime(year, month, 1).strftime('%Y-%m-%d')
        rent_amt = 400000
        cursor.execute('''
            INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, ingreso, gasto, monto, environment)
            VALUES (?, 'Gasto', 'Vivienda', 'Arriendo', 'Banco de Chile', 0, ?, ?, 'PROD')
        ''', (rent_date, rent_amt, rent_amt))
        count += 1

    # Random variable expenses daily
    current_date = start_date
    while current_date <= end_date:
        day_str = current_date.strftime('%Y-%m-%d')
        
        # 1-3 transactions per day
        num_tx = random.randint(0, 3)
        for _ in range(num_tx):
            cat, details = random.choice(categories_gasto)
            det = random.choice(details)
            amt = random.randint(5000, 50000)
            bank = random.choice(banks)
            
            cursor.execute('''
                INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, ingreso, gasto, monto, environment)
                VALUES (?, 'Gasto', ?, ?, ?, 0, ?, ?, 'PROD')
            ''', (day_str, cat, det, bank, amt, amt))
            count += 1
            
        current_date += timedelta(days=1)

    conn.commit()
    conn.close()
    print(f"Database seeded with {count} transactions from 2025-12-01 to current date.")

if __name__ == '__main__':
    seed_current_period()
