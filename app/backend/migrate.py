import pandas as pd
import sqlite3
import os

# Configuration
EXCEL_PATH = r"C:\Users\adrim\.gemini\antigravity\scratch\finanzas\Viendo como trabajar con bancos.xlsx"
DB_PATH = r"C:\Users\adrim\.gemini\antigravity\scratch\app\backend\finance.db"

def setup_database():
    """Create the SQLite database schema."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create Transactions Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT,
        tipo TEXT,
        categoria TEXT,
        detalle TEXT,
        banco TEXT,
        ingreso REAL,
        gasto REAL,
        raw_data TEXT
    )
    ''')
    
    conn.commit()
    return conn

def find_header_row(df):
    """Scans the dataframe to find the row that looks like a header."""
    keywords = ['fecha', 'date', 'categoría', 'categoria', 'detalle', 'banco', 'ingreso', 'gasto', 'monto']
    
    for idx, row in df.iterrows():
        row_str = " ".join([str(x).lower() for x in row.values])
        hits = sum(1 for k in keywords if k in row_str)
        if hits >= 2:
            return idx
    return None

def migrate():
    print("[START] Starting Migration...")
    
    if not os.path.exists(EXCEL_PATH):
        print(f"[ERROR] Excel file not found at {EXCEL_PATH}")
        return

    # 1. Read Excel (REGISTRO sheet)
    print("... Reading Excel file (this might take a moment)...")
    try:
        # Read first 50 rows to find header
        df_preview = pd.read_excel(EXCEL_PATH, sheet_name='REGISTRO', header=None, nrows=50)
        header_idx = find_header_row(df_preview)
        
        if header_idx is None:
            print("[FAIL] Could not automatically find the header row in 'REGISTRO'.")
            print("   Dumping first 5 rows for inspection:")
            print(df_preview.head(5))
            return

        print(f"[OK] Header found at row index: {header_idx}")
        
        # Read the full sheet starting from the header
        df = pd.read_excel(EXCEL_PATH, sheet_name='REGISTRO', header=header_idx)
        
        # 2. Setup Database
        # Drop table first to ensure clean state
        # We do this OUTSIDE the main connection loop to avoid conflicts, 
        # but inside the try block is fine.
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('DROP TABLE IF EXISTS transactions')
        conn.commit()
        conn.close()

        conn = setup_database()
        cursor = conn.cursor()
        
        print(f"... Processing {len(df)} rows...")
        
        count = 0
        for index, row in df.iterrows():
            if index == 0:
                print(f"   Columns found: {list(df.columns)}")

            def get_col(candidates):
                for col in df.columns:
                    if any(c.lower() in str(col).lower() for c in candidates):
                        return row[col]
                return None

            p_fecha = get_col(['fecha', 'date'])
            p_tipo = get_col(['tipo', 'movimiento'])
            p_cat = get_col(['cat', 'rubro']) # Sometimes 'bancos' is categorized differently, but stick to standard
            
            # 'Bancos' column is likely the account
            p_banco = get_col(['bancos', 'cuenta', 'bank'])
            
            p_cat = get_col(['categor', 'rubro'])
            p_det = get_col(['descrip', 'detalle', 'observacion'])
            
            def clean_money(val):
                if pd.isna(val): return 0.0
                try:
                    s = str(val).replace('$','').strip()
                    return float(s.replace(',','')) 
                except:
                    return 0.0

            p_ingreso = clean_money(get_col(['ingreso', 'haber']))
            p_gasto = clean_money(get_col(['gasto', 'egreso', 'debe']))
            
            # Logic for Single Amount Column
            p_monto = clean_money(get_col(['monto', 'importe']))
            
            if p_ingreso == 0 and p_gasto == 0 and p_monto != 0:
                tipo_str = str(p_tipo).lower()
                if 'ingreso' in tipo_str:
                    p_ingreso = p_monto
                elif 'gasto' in tipo_str or 'egreso' in tipo_str:
                    p_gasto = p_monto

            cursor.execute('''
                INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, ingreso, gasto, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(p_fecha), 
                str(p_tipo), 
                str(p_cat), 
                str(p_det), 
                str(p_banco), 
                p_ingreso, 
                p_gasto, 
                str(row.to_dict())
            ))
            count += 1
            
        conn.commit()
        conn.close()
        print(f"[SUCCESS] Migrated {count} transactions to {DB_PATH}")

    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")

if __name__ == "__main__":
    migrate()
