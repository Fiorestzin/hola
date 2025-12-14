"""
Quick seed script to generate test data for local testing
Run with: python seed_test_data.py
"""
import sqlite3
import random
from datetime import datetime, timedelta
import os

# Use the correct DB path
DB_PATH = os.path.join(os.path.dirname(__file__), "finance_test.db")

def seed_data():
    print(f"Connecting to: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'")
    if not cursor.fetchone():
        print("ERROR: transactions table doesn't exist. Run the backend first to create it.")
        return
    
    categories_gasto = ['Alimentación', 'Transporte', 'Vivienda', 'Salud', 'Ocio', 'Regalos', 'Educación']
    categories_ingreso = ['Sueldo', 'Freelance', 'Inversiones']
    banks = ['Santander', 'Banco de Chile', 'Efectivo', 'Scotiabank', 'Estado', 'Falabella']
    
    # Generate 3 months of data
    start_date = datetime.now() - timedelta(days=90)
    count = 0
    
    for i in range(90):
        current_date = start_date + timedelta(days=i)
        day_str = current_date.strftime('%Y-%m-%d')
        
        # 1-3 expenses per day
        for _ in range(random.randint(1, 3)):
            cat = random.choice(categories_gasto)
            amount = random.randint(1000, 50000)
            bank = random.choice(banks)
            detalle = f"{cat} - Item {random.randint(1,100)}"
            
            cursor.execute('''
                INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, monto, ingreso, gasto, environment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (day_str, 'Gasto', cat, detalle, bank, amount, 0, amount, 'TEST'))
            count += 1
        
        # Income every 15 days (simulating bi-weekly pay)
        if i % 15 == 0:
            cat = random.choice(categories_ingreso)
            amount = random.randint(500000, 1500000)
            bank = random.choice(banks)
            
            cursor.execute('''
                INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, monto, ingreso, gasto, environment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (day_str, 'Ingreso', cat, f"{cat} mensual", bank, amount, amount, 0, 'TEST'))
            count += 1
    
    # Add some recurring expenses (subscriptions) for detector test
    recurring = [
        ('Netflix', 15990),
        ('Spotify', 5990),
        ('Internet Hogar', 25990),
        ('Gym', 29990),
    ]
    
    for i in range(3):  # 3 months of subscriptions
        month_date = datetime.now() - timedelta(days=30 * i)
        for name, amount in recurring:
            cursor.execute('''
                INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, monto, ingreso, gasto, environment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (month_date.strftime('%Y-%m-%d'), 'Gasto', 'Suscripciones', name, 'Efectivo', amount, 0, amount, 'TEST'))
            count += 1
    
    conn.commit()
    conn.close()
    print(f"✅ Seeded {count} transactions successfully!")

if __name__ == '__main__':
    seed_data()
