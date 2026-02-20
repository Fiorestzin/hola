import sqlite3

try:
    conn = sqlite3.connect('finance_test.db')
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(savings_goals)")
    columns = [row[1] for row in cursor.fetchall()]
    print("Columns found:", columns)
    
    if 'frecuencia_aporte' not in columns:
        print("MISSING: frecuencia_aporte")
    else:
        print("FOUND: frecuencia_aporte")
        
    if 'dia_aporte' not in columns:
        print("MISSING: dia_aporte")
    else:
        print("FOUND: dia_aporte")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")
