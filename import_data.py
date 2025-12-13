"""
Script to import data from Excel to PostgreSQL (Supabase)
"""
import pandas as pd
import psycopg2
from datetime import datetime

# Database connection
DATABASE_URL = "postgresql://postgres.ijwmxgnfilnihiizozdg:72143306Sfmm!@aws-0-us-west-2.pooler.supabase.com:5432/postgres"

# Read Excel file
excel_path = r"C:\Users\adrim\.gemini\antigravity\scratch\finanzas\Viendo como trabajar con bancos.xlsx"
df = pd.read_excel(excel_path, sheet_name='REGISTRO', header=4)

# Rename columns
df.columns = ['_', 'fecha', 'tipo', 'banco', 'categoria', 'detalle', 'observaciones', 'medio_pago', 'monto']

# Drop the unnamed column and rows with NaN fecha
df = df.drop(columns=['_', 'observaciones', 'medio_pago'])
df = df.dropna(subset=['fecha'])

# Convert fecha to string format
df['fecha'] = pd.to_datetime(df['fecha'], errors='coerce')
df = df.dropna(subset=['fecha'])
df['fecha'] = df['fecha'].dt.strftime('%Y-%m-%d')

# Convert monto to float
df['monto'] = pd.to_numeric(df['monto'], errors='coerce').fillna(0)

# Calculate ingreso/gasto
df['ingreso'] = df.apply(lambda x: x['monto'] if x['tipo'] == 'Ingreso' else 0, axis=1)
df['gasto'] = df.apply(lambda x: x['monto'] if x['tipo'] == 'Gasto' else 0, axis=1)

print(f"Total rows to import: {len(df)}")
print(df.head())

# Connect and insert
conn = psycopg2.connect(DATABASE_URL)
cursor = conn.cursor()

# Insert each row
imported = 0
for _, row in df.iterrows():
    try:
        cursor.execute('''
            INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, monto, ingreso, gasto)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            row['fecha'],
            row['tipo'],
            row['categoria'],
            row['detalle'],
            row['banco'],
            row['monto'],
            row['ingreso'],
            row['gasto']
        ))
        imported += 1
    except Exception as e:
        print(f"Error importing row: {e}")

conn.commit()
cursor.close()
conn.close()

print(f"\n✅ Imported {imported} transactions successfully!")
