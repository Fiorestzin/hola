import sqlite3
import os

db_files = ["finance_prod.db", "finance_test.db"]
base_dir = r"c:\Users\adrim\OneDrive\Documentos\Personal\Referencias\Autodidacta\Proyectos Personales\Proyecto informático\Finanzas Personales\Aplicativo\app\backend"

for db_file in db_files:
    db_path = os.path.join(base_dir, db_file)
    if not os.path.exists(db_path):
        print(f"Skipping {db_file}, not found.")
        continue
    
    print(f"Processing {db_file}...")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Identify problem rows
        cursor.execute("SELECT id, detalle, monto, ingreso, gasto FROM transactions WHERE monto < 0 OR ingreso < 0 OR gasto < 0")
        rows = cursor.fetchall()
        
        if not rows:
            print(f"No negative values found in {db_file}.")
        else:
            for row in rows:
                tx_id, detalle, monto, ingreso, gasto = row
                print(f"Fixing ID {tx_id} ({detalle}): monto={monto}, ingreso={ingreso}, gasto={gasto}")
                
            # Update all negative values to their absolute
            cursor.execute("""
                UPDATE transactions 
                SET monto = ABS(monto), 
                    ingreso = ABS(ingreso), 
                    gasto = ABS(gasto)
                WHERE monto < 0 OR ingreso < 0 OR gasto < 0
            """)
            print(f"Modified {cursor.rowcount} rows in {db_file}.")
            conn.commit()
        
        conn.close()
    except Exception as e:
        print(f"Error processing {db_file}: {e}")

print("Done.")
