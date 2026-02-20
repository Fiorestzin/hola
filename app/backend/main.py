from fastapi import FastAPI, HTTPException, UploadFile, File, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
import sqlite3
import pandas as pd
from datetime import datetime, timedelta
import io
import os
from jose import JWTError, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from typing import Optional

# PostgreSQL support
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False

# --- AUTH CONFIG ---
SECRET_KEY = "fiorestzin-super-secret-key-change-in-prod"  # Change this in production!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

ph = PasswordHasher()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI()

# Enable CORS so the frontend (port 5173) can talk to backend (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production we would restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE CONFIGURATION ---
# Check for PostgreSQL DATABASE_URL (Supabase/Render)
DATABASE_URL = os.getenv("DATABASE_URL")
USE_POSTGRES = DATABASE_URL is not None and HAS_POSTGRES

# SQLite fallback config
class GlobalConfig:
    ENV = "TEST"
    DB_FILENAME = "finance_test.db"

config = GlobalConfig()

def get_db_path():
    return os.path.join(os.path.dirname(__file__), config.DB_FILENAME)

print(f"\nSTARTING FINANCE BACKEND")
if USE_POSTGRES:
    print(f"DATABASE: PostgreSQL (Supabase)")
else:
    print(f"ENVIRONMENT: {config.ENV}")
    print(f"DATABASE: SQLite ({config.DB_FILENAME})")
print("")


def get_db_connection():
    if USE_POSTGRES:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    else:
        conn = sqlite3.connect(get_db_path())
        conn.row_factory = sqlite3.Row
        return conn

def execute_query(conn, query, params=None):
    """Execute a query and return cursor - handles both SQLite and PostgreSQL"""
    cursor = conn.cursor()
    if params:
        cursor.execute(query, params)
    else:
        cursor.execute(query)
    return cursor

def fetchall_as_dict(cursor):
    """Fetch all rows as list of dicts - handles both SQLite and PostgreSQL"""
    if USE_POSTGRES:
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        return [dict(zip(columns, row)) for row in cursor.fetchall()]
    else:
        return [dict(row) for row in cursor.fetchall()]

def sql_param(query: str) -> str:
    """Convert SQLite ? placeholders to PostgreSQL %s"""
    if USE_POSTGRES:
        return query.replace("?", "%s")
    return query

def fetchone_as_dict(cursor):
    """Fetch one row as dict"""
    if USE_POSTGRES:
        row = cursor.fetchone()
        if row is None:
            return None
        columns = [desc[0] for desc in cursor.description]
        return dict(zip(columns, row))
    else:
        row = cursor.fetchone()
        return dict(row) if row else None

    

def init_budgets_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Categories Table
    if USE_POSTGRES:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                tipo TEXT NOT NULL, -- 'Ingreso', 'Gasto'
                environment TEXT DEFAULT 'PROD',
                UNIQUE(nombre, environment)
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                id SERIAL PRIMARY KEY,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                month TEXT NOT NULL, -- YYYY-MM
                environment TEXT DEFAULT 'PROD',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
    else:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                tipo TEXT NOT NULL,
                environment TEXT DEFAULT 'PROD',
                UNIQUE(nombre, environment)
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                month TEXT NOT NULL,
                environment TEXT DEFAULT 'PROD',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
    
    # Seed Categories if empty
    try:
        cursor.execute(sql_param("SELECT COUNT(*) FROM categories"))
        count = cursor.fetchone()[0]
        if count == 0:
            default_cats = [
                ('Salario', 'Ingreso'), ('Otros Ingresos', 'Ingreso'),
                ('Alimentación', 'Gasto'), ('Transporte', 'Gasto'),
                ('Vivienda', 'Gasto'), ('Servicios', 'Gasto'),
                ('Entretenimiento', 'Gasto'), ('Salud', 'Gasto'),
                ('Educación', 'Gasto'), ('Ropa', 'Gasto'),
                ('Transferencia', 'Ingreso'), ('Transferencia', 'Gasto')
            ]
            print("Seeding default categories...")
            for name, type_ in default_cats:
                try:
                    cursor.execute(sql_param("INSERT INTO categories (nombre, tipo, environment) VALUES (?, ?, 'PROD')"), (name, type_))
                except Exception as e:
                    print(f"Skipping duplicate: {name}")
    except Exception as e:
        print(f"Error seeding categories: {e}")
                
    # --- CLEANUP TEST DATA ---
    print("Cleaning up TEST data...")
    try:
        cursor.execute(sql_param("DELETE FROM categories WHERE environment = 'TEST'"))
        cursor.execute(sql_param("DELETE FROM budgets WHERE environment = 'TEST'"))
        # We also remove transactions marked as TEST if desired, but let's be safe and assume yes based on request
        # cursor.execute(sql_param("DELETE FROM transactions WHERE environment = 'TEST'")) 
    except Exception as e:
        print(f"Error cleaning up TEST data: {e}")

    conn.commit()
    conn.close()

# Initialize DB tables
init_budgets_db()

class ConfigUpdate(BaseModel):
    env: str

class ResetRequest(BaseModel):
    confirmation: str

@app.get("/config")
def get_config():
    return {"env": "PROD", "db": config.DB_FILENAME}

# Removed switch_env endpoint as we are enforcing PROD

@app.post("/config/reset")
def reset_db_data(req: ResetRequest):
    # Get the current delete phrase from database
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("SELECT value FROM settings WHERE key = ?"), ("delete_phrase",))
    row = cursor.fetchone()
    current_phrase = row[0] if row else "fiorestzin"  # Default
    
    if req.confirmation != current_phrase:
        conn.close()
        raise HTTPException(status_code=403, detail="Frase de confirmación incorrecta.")
    
    try:
        # Dangerous part: Delete all user data
        cursor.execute("DELETE FROM transactions")
        cursor.execute("DELETE FROM budgets")
        # We do NOT delete categories to preserve configuration
        conn.commit()
        return {"status": "ok", "message": "Datos eliminados correctamente (Fábrica)."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# --- AUTH HELPER FUNCTIONS ---
def verify_password(plain_password, hashed_password):
    try:
        ph.verify(hashed_password, plain_password)
        return True
    except VerifyMismatchError:
        return False

def get_user(username: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("SELECT id, username, hashed_password, is_admin FROM users WHERE username = ?"), (username,))
    row = cursor.fetchone()
    conn.close()
    if row is None:
        return None
    # Convert to dict for both SQLite and PostgreSQL
    if USE_POSTGRES:
        return {"id": row[0], "username": row[1], "hashed_password": row[2], "is_admin": row[3]}
    return dict(row)


def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user:
        return False
    if not verify_password(password, user["hashed_password"]):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user(username)
    if user is None:
        raise credentials_exception
    return user

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    username: str
    password: str

@app.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me")
async def read_users_me(current_user = Depends(get_current_user)):
    return {"username": current_user["username"], "is_admin": current_user["is_admin"]}

# --- SETTINGS ENDPOINTS ---

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@app.post("/settings/change-password")
async def change_login_password(data: PasswordChange, current_user = Depends(get_current_user)):
    """Change the user's login password. Requires current password verification."""
    # Verify current password
    if not verify_password(data.current_password, current_user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Contraseña actual incorrecta")
    
    # Hash and update new password
    conn = get_db_connection()
    cursor = conn.cursor()
    new_hash = ph.hash(data.new_password)
    cursor.execute(sql_param("UPDATE users SET hashed_password = ? WHERE id = ?"), 
                   (new_hash, current_user["id"]))
    conn.commit()
    conn.close()
    
    return {"status": "ok", "message": "Contraseña de inicio de sesión actualizada"}

class DeletePhraseChange(BaseModel):
    current_phrase: str
    new_phrase: str

# Store delete confirmation phrase in a settings table or as a user attribute
# For now, we'll create a simple settings table
@app.post("/settings/change-delete-phrase")
async def change_delete_phrase(data: DeletePhraseChange, current_user = Depends(get_current_user)):
    """Change the phrase required to confirm delete operations."""
    # Get current phrase from database
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(sql_param("SELECT value FROM settings WHERE key = ?"), ("delete_phrase",))
    row = cursor.fetchone()
    current_phrase = row[0] if row else "fiorestzin"  # Default
    
    # Verify current phrase
    if data.current_phrase != current_phrase:
        conn.close()
        raise HTTPException(status_code=401, detail="Frase actual incorrecta")
    
    # Update or insert new phrase
    try:
        if row:
            cursor.execute(sql_param("UPDATE settings SET value = ? WHERE key = ?"), 
                           (data.new_phrase, "delete_phrase"))
        else:
            cursor.execute(sql_param("INSERT INTO settings (key, value) VALUES (?, ?)"),
                           ("delete_phrase", data.new_phrase))
        conn.commit()
    finally:
        conn.close()
    
    return {"status": "ok", "message": "Frase de confirmación actualizada"}

@app.get("/settings/delete-phrase")
async def get_delete_phrase(current_user = Depends(get_current_user)):
    """Get current delete confirmation phrase for verification."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("SELECT value FROM settings WHERE key = ?"), ("delete_phrase",))
    row = cursor.fetchone()
    conn.close()
    return {"phrase": row[0] if row else "fiorestzin"}

# Global environment state (shared across requests)
current_environment = "TEST"  # Default to demo mode

@app.get("/")
def read_root():
    return {"message": "Finance API is running"}

@app.get("/config")
def get_config():
    """Get current environment configuration"""
    global current_environment
    return {
        "env": current_environment,
        "db": "PostgreSQL (Supabase)"
    }

@app.post("/config/switch")
def switch_environment(data: dict):
    """Switch between TEST and PROD environments"""
    global current_environment
    new_env = data.get("env", "TEST")
    if new_env not in ["TEST", "PROD"]:
        raise HTTPException(status_code=400, detail="Invalid environment. Use TEST or PROD.")
    current_environment = new_env
    return {"status": "ok", "env": current_environment}


@app.get("/transactions")
def get_transactions(
    limit: int = 100, 
    start_date: str = None, 
    end_date: str = None, 
    category: str = None, 
    bank: str = None,
    cuenta: str = None,
    detalle: str = None,
    include_transfers: bool = False,
    environment: str = "PROD"  # TEST (demo) or PROD (real)
):
    conn = get_db_connection()
    
    # Exclude internal transfers from transaction list UNLESS:
    # - filtering by a specific bank or category
    # - explicitly requesting transfers via include_transfers=true
    if bank or category or include_transfers:
        # Show everything (including transfers)
        real_query = "SELECT * FROM transactions WHERE environment = ?"
    else:
        # Global list: exclude transfers to avoid double-counting and clutter
        real_query = "SELECT * FROM transactions WHERE environment = ? AND categoria != 'Transferencia'"
    
    real_params = [environment]
    
    if start_date:
        real_query += " AND fecha >= ?"
        real_params.append(start_date)
    if end_date:
        real_query += " AND fecha <= ?"
        real_params.append(end_date)
    if category:
        real_query += " AND categoria = ?"
        real_params.append(category)
    if bank:
        real_query += " AND banco = ?"
        real_params.append(bank)
    if cuenta:
        real_query += " AND cuenta = ?"
        real_params.append(cuenta)
    if detalle:
        real_query += " AND detalle = ?"
        real_params.append(detalle)
        
    real_query += " ORDER BY fecha DESC, id DESC"
    
    if limit > 0:
        real_query += " LIMIT ?"
        real_params.append(limit)

    cursor = conn.cursor()
    cursor.execute(sql_param(real_query), real_params)
    rows = cursor.fetchall()
    conn.close()
    
    if USE_POSTGRES:
        columns = ['id', 'fecha', 'tipo', 'categoria', 'detalle', 'banco', 'cuenta', 'monto', 'ingreso', 'gasto', 'environment']
        return [dict(zip(columns, row)) for row in rows]
    return [dict(row) for row in rows]



@app.get("/summary/banks")
def get_bank_balances(environment: str = "PROD"):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = '''
        SELECT 
            banco, cuenta,
            SUM(ingreso) as total_ingreso, 
            SUM(gasto) as total_gasto,
            (SUM(ingreso) - SUM(gasto)) as saldo
        FROM transactions 
        WHERE environment = ? AND banco IS NOT NULL AND banco != 'None' AND banco != 'nan'
        GROUP BY banco, cuenta
        ORDER BY saldo DESC
    '''
    cursor.execute(sql_param(query), [environment])
    rows = cursor.fetchall()
    conn.close()
    
    if USE_POSTGRES:
        return [{"banco": row[0], "cuenta": row[1], "total_ingreso": row[2], "total_gasto": row[3], "saldo": row[4]} for row in rows]
    return [dict(row) for row in rows]


@app.get("/reports")
def get_reports(
    start_date: str = None, 
    end_date: str = None, 
    category: str = None, 
    bank: str = None,
    detalle: str = None,
    environment: str = "PROD"
):
    conn = get_db_connection()
    
    # Base filter with environment
    where_clause = "environment = ?"
    params = [environment]
    if start_date:
        where_clause += " AND fecha >= ?"
        params.append(start_date)
    if end_date:
        where_clause += " AND fecha <= ?"
        params.append(end_date)
    if category:
        where_clause += " AND categoria = ?"
        params.append(category)
    if bank:
        where_clause += " AND banco = ?"
        params.append(bank)
    if detalle:
        where_clause += " AND detalle LIKE ?"
        params.append(f"%{detalle}%")


    # 1. Category Breakdown (Pie Chart) - ONLY Expenses, exclude transfers
    cat_query = f'''
        SELECT categoria as name, SUM(gasto) as value
        FROM transactions 
        WHERE {where_clause} AND gasto > 0 AND categoria != 'Transferencia'
        GROUP BY categoria
        ORDER BY value DESC
    '''
    cursor = conn.cursor()
    cursor.execute(sql_param(cat_query), params)
    cat_rows = cursor.fetchall()
    
    if USE_POSTGRES:
        cat_data = [{"name": row[0], "value": row[1]} for row in cat_rows]
    else:
        cat_data = [dict(row) for row in cat_rows]

    # 2. Monthly History (Bar Chart) - exclude transfers
    hist_query = f"SELECT fecha, ingreso, gasto FROM transactions WHERE {where_clause} AND categoria != 'Transferencia'"
    df = pd.read_sql_query(sql_param(hist_query), conn, params=params)
    
    history_data = []
    if not df.empty:
        try:
            df['dt'] = pd.to_datetime(df['fecha'], errors='coerce', dayfirst=False)
            df['month'] = df['dt'].dt.strftime('%Y-%m')
            df['month'] = df['month'].fillna('Desconocido')
            
            grp = df.groupby('month')[['ingreso', 'gasto']].sum().reset_index()
            history_data = grp.sort_values('month').to_dict(orient='records')
        except:
            pass

    conn.close()
    
    return {
        "pie_data": cat_data,
        "bar_data": history_data
    }



@app.get("/comparison")
def get_period_comparison(
    start_date: str, 
    end_date: str, 
    category: str = None,
    bank: str = None,
    detalle: str = None,
    environment: str = "PROD"
):
    """Compare current period with previous period of same length"""
    from datetime import datetime, timedelta
    
    # Parse dates
    current_start = datetime.strptime(start_date, "%Y-%m-%d")
    current_end = datetime.strptime(end_date, "%Y-%m-%d")
    days_diff = (current_end - current_start).days + 1
    
    # Calculate previous period
    prev_end = current_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days_diff - 1)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    def get_period_totals(start, end):
        p_where = "environment = ? AND fecha >= ? AND fecha <= ?"
        p_params = [environment, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")]
        
        if category:
            p_where += " AND categoria = ?"
            p_params.append(category)
        if bank:
            p_where += " AND banco = ?"
            p_params.append(bank)
        if detalle:
            p_where += " AND detalle LIKE ?"
            p_params.append(f"%{detalle}%")
        
        query = f'''
            SELECT 
                COALESCE(SUM(ingreso), 0) as total_ingreso,
                COALESCE(SUM(gasto), 0) as total_gasto,
                COUNT(*) as num_transactions
            FROM transactions 
            WHERE {p_where}
        '''
        cursor.execute(sql_param(query), p_params)
        result = cursor.fetchone()
        return {
            "ingreso": result[0] or 0,
            "gasto": result[1] or 0,
            "transactions": result[2] or 0,
            "balance": (result[0] or 0) - (result[1] or 0)
        }
    
    current_data = get_period_totals(current_start, current_end)
    prev_data = get_period_totals(prev_start, prev_end)
    
    # Calculate % changes
    def pct_change(current, previous):
        if previous == 0:
            return 100 if current > 0 else 0
        return round(((current - previous) / previous) * 100, 1)
    
    conn.close()

    
    return {
        "current": {
            "start": start_date,
            "end": end_date,
            "days": days_diff,
            **current_data
        },
        "previous": {
            "start": prev_start.strftime("%Y-%m-%d"),
            "end": prev_end.strftime("%Y-%m-%d"),
            "days": days_diff,
            **prev_data
        },
        "changes": {
            "ingreso_pct": pct_change(current_data["ingreso"], prev_data["ingreso"]),
            "gasto_pct": pct_change(current_data["gasto"], prev_data["gasto"]),
            "balance_diff": current_data["balance"] - prev_data["balance"]
        }
    }

@app.get("/analysis")
def get_analysis(
    start_date: str = None, 
    end_date: str = None, 
    category: str = None, 
    bank: str = None,
    detalle: str = None,
    environment: str = "PROD"
):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    where_clause = "environment = ?"
    params = [environment]
    if start_date:
        where_clause += " AND fecha >= ?"
        params.append(start_date)
    if end_date:
        where_clause += " AND fecha <= ?"
        params.append(end_date)
    if category:
        where_clause += " AND categoria = ?"
        params.append(category)
    if bank:
        where_clause += " AND banco = ?"
        params.append(bank)
    if detalle:
        where_clause += " AND detalle LIKE ?"
        params.append(f"%{detalle}%")
        
    # 1. Top 10 Categorías de Gasto (exclude transfers)
    top_items_query = f'''
        SELECT categoria as name, SUM(gasto) as value 
        FROM transactions 
        WHERE {where_clause} AND gasto > 0 AND categoria != 'Transferencia'
        GROUP BY categoria
        ORDER BY value DESC
        LIMIT 10
    '''
    cursor.execute(sql_param(top_items_query), params)
    top_rows = cursor.fetchall()
    
    # 2. Payment Methods / Bank Usage (gastos por banco, exclude transfers)
    payment_methods_query = f'''
        SELECT banco as name, SUM(gasto) as value
        FROM transactions
        WHERE {where_clause} AND banco IS NOT NULL AND banco != 'None' AND banco != '' AND gasto > 0 AND categoria != 'Transferencia'
        GROUP BY banco
        ORDER BY value DESC
    '''
    cursor.execute(sql_param(payment_methods_query), params)
    payment_rows = cursor.fetchall()
    
    conn.close()
    
    if USE_POSTGRES:
        return {
            "top_expenses": [{"name": row[0], "value": row[1]} for row in top_rows],
            "payment_methods": [{"name": row[0], "value": row[1]} for row in payment_rows]
        }
    return {
        "top_expenses": [dict(row) for row in top_rows],
        "payment_methods": [dict(row) for row in payment_rows]
    }


@app.get("/history")
def get_history(
    start_date: str = None, 
    end_date: str = None,
    filter_col: str = 'detalle', # detalle, categoria, banco
    filter_val: str = None,
    environment: str = "PROD"
):
    conn = get_db_connection()
    
    # Validate column to prevent injection
    if filter_col not in ['detalle', 'categoria', 'banco']:
        raise HTTPException(status_code=400, detail="Invalid filter column")

    where_clause = "environment = ?"
    params = [environment]
    
    if start_date:
        where_clause += " AND fecha >= ?"
        params.append(start_date)

    if end_date:
        where_clause += " AND fecha <= ?"
        params.append(end_date)
        
    if filter_val:
        where_clause += f" AND {filter_col} = ?"
        params.append(filter_val)

    # Monthly evolution of expenses
    query = f"SELECT fecha, gasto FROM transactions WHERE {where_clause} AND gasto > 0"
    df = pd.read_sql_query(sql_param(query), conn, params=params)
    
    history_data = []
    if not df.empty:
        try:
            df['dt'] = pd.to_datetime(df['fecha'], errors='coerce', dayfirst=False)
            df['month'] = df['dt'].dt.strftime('%Y-%m')
            df['month'] = df['month'].fillna('Desconocido')
            
            grp = df.groupby('month')['gasto'].sum().reset_index()
            history_data = grp.sort_values('month').to_dict(orient='records')
        except:
            pass

    conn.close()
    return history_data


class Transaction(BaseModel):
    fecha: str
    tipo: str
    categoria: str
    detalle: str
    banco: str
    cuenta: str = "Principal"
    monto: float
    environment: str = "PROD"  # TEST (demo) or PROD (real)

@app.post("/transaction")
def create_transaction(tx: Transaction):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    ingreso = 0
    gasto = 0
    
    monto_abs = abs(tx.monto)
    if tx.tipo == 'Ingreso':
        ingreso = monto_abs
    else:
        gasto = monto_abs
        
    try:
        print(f"DEBUG INSERT: env={tx.environment}, {tx.fecha}, {tx.tipo}, {tx.categoria}")
        cursor.execute(sql_param('''
            INSERT INTO transactions (fecha, tipo,categoria, detalle, banco, cuenta, ingreso, gasto, monto, environment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''), (tx.fecha, tx.tipo, tx.categoria, tx.detalle, tx.banco, tx.cuenta, ingreso, gasto, monto_abs, tx.environment))
        
        conn.commit()
        
        # Get the new ID
        if USE_POSTGRES:
            cursor.execute("SELECT lastval()")
        else:
            cursor.execute("SELECT last_insert_rowid()")
        new_id = cursor.fetchone()[0]
        
        conn.close()
        return {"status": "ok", "message": "Transaction created", "id": new_id, "tipo": tx.tipo} # Return ID and Type

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR INSERTING TRANSACTION: {e}")
        raise HTTPException(status_code=500, detail=f"{str(e)} | Tr: {traceback.format_exc()}")


@app.delete("/transaction/{tx_id}")
def delete_transaction(tx_id: int):
    """Delete a specific transaction by ID"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if transaction exists
    cursor.execute(sql_param("SELECT id FROM transactions WHERE id = ?"), (tx_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    cursor.execute(sql_param("DELETE FROM transactions WHERE id = ?"), (tx_id,))
    conn.commit()
    conn.close()
    return {"status": "ok", "message": f"Transaction {tx_id} deleted"}


class TransactionUpdate(BaseModel):
    fecha: str = None
    tipo: str = None
    categoria: str = None
    detalle: str = None
    banco: str = None
    cuenta: str = None
    monto: float = None

@app.put("/transaction/{tx_id}")
def update_transaction(tx_id: int, tx: TransactionUpdate):
    """Update an existing transaction by ID"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if transaction exists
    cursor.execute(sql_param("SELECT * FROM transactions WHERE id = ?"), (tx_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Build update query dynamically based on provided fields
    updates = []
    params = []
    
    if tx.fecha is not None:
        updates.append("fecha = ?")
        params.append(tx.fecha)
    if tx.tipo is not None:
        updates.append("tipo = ?")
        params.append(tx.tipo)
    if tx.categoria is not None:
        updates.append("categoria = ?")
        params.append(tx.categoria)
    if tx.detalle is not None:
        updates.append("detalle = ?")
        params.append(tx.detalle)
    if tx.banco is not None:
        updates.append("banco = ?")
        params.append(tx.banco)
    if tx.cuenta is not None:
        updates.append("cuenta = ?")
        params.append(tx.cuenta)
    if tx.monto is not None:
        monto_abs = abs(tx.monto)
        updates.append("monto = ?")
        params.append(monto_abs)
        # Also update ingreso/gasto based on tipo
        current_tipo = tx.tipo if tx.tipo else (row[2] if USE_POSTGRES else row['tipo'])
        if current_tipo == 'Ingreso':
            updates.append("ingreso = ?")
            params.append(monto_abs)
            updates.append("gasto = ?")
            params.append(0)
        else:
            updates.append("ingreso = ?")
            params.append(0)
            updates.append("gasto = ?")
            params.append(monto_abs)
    
    if not updates:
        conn.close()
        return {"status": "ok", "message": "No changes provided"}
    
    params.append(tx_id)
    query = f"UPDATE transactions SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(sql_param(query), params)
    conn.commit()
    conn.close()
    return {"status": "ok", "message": f"Transaction {tx_id} updated"}


# --- Internal Transfers ---

class Transfer(BaseModel):
    fecha: str
    banco_origen: str
    banco_destino: str
    monto: float
    detalle: str = "Transferencia interna"
    environment: str = "TEST"

@app.post("/transfer")
def create_transfer(transfer: Transfer):
    """Create an internal transfer between two banks (creates 2 linked transactions)."""
    if transfer.banco_origen == transfer.banco_destino:
        raise HTTPException(status_code=400, detail="Banco origen y destino no pueden ser iguales")
    
    if transfer.monto <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Transaction 1: Gasto (salida) from banco_origen
        detalle_salida = f"↗ {transfer.detalle} → {transfer.banco_destino}"
        cursor.execute(sql_param('''
            INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, ingreso, gasto, monto, environment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''), (transfer.fecha, 'Gasto', 'Transferencia', detalle_salida, 
               transfer.banco_origen, 0, transfer.monto, transfer.monto, transfer.environment))
        
        # Transaction 2: Ingreso (entrada) to banco_destino
        detalle_entrada = f"↘ {transfer.detalle} ← {transfer.banco_origen}"
        cursor.execute(sql_param('''
            INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, ingreso, gasto, monto, environment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''), (transfer.fecha, 'Ingreso', 'Transferencia', detalle_entrada,
               transfer.banco_destino, transfer.monto, 0, transfer.monto, transfer.environment))
        
        conn.commit()
        return {
            "status": "ok", 
            "message": f"Transferencia de ${transfer.monto:,.0f} realizada: {transfer.banco_origen} → {transfer.banco_destino}"
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# Ensure database schema includes categories
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # SQL syntax differs between SQLite and PostgreSQL
    if USE_POSTGRES:
        # PostgreSQL syntax
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                fecha TEXT,
                tipo TEXT,
                categoria TEXT,
                detalle TEXT,
                banco TEXT,
                cuenta TEXT DEFAULT 'Principal',
                monto REAL,
                ingreso REAL,
                gasto REAL
            )
        ''')
        
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cuenta TEXT DEFAULT 'Principal'")
        except:
            pass
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS budgets (
                id SERIAL PRIMARY KEY,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                month TEXT NOT NULL,
                environment TEXT DEFAULT 'TEST',
                UNIQUE(category, month, environment)
            )
        ''')
        
        # Migration: Add environment column to budgets if it doesn't exist
        try:
            cursor.execute("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'TEST'")
        except:
            pass  # Column already exists
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                tipo TEXT DEFAULT 'Gasto',
                environment TEXT DEFAULT NULL
            )
        ''')
        
        # Migration: Add environment column if it doesn't exist (for existing databases)
        try:
            cursor.execute("ALTER TABLE categories ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT NULL")
        except:
            pass  # Column already exists
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS banks (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                environment TEXT DEFAULT NULL
            )
        ''')
        
        # Migration: Add environment column to banks if it doesn't exist
        try:
            cursor.execute("ALTER TABLE banks ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT NULL")
        except:
            pass  # Column already exists
            
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS accounts (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                environment TEXT DEFAULT NULL
            )
        ''')
        
        # Migration: Add environment column to accounts if it doesn't exist
        try:
            cursor.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT NULL")
        except:
            pass  # Column already exists
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                is_admin INTEGER DEFAULT 0
            )
        ''')
        
        # Settings table for configurable values
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                value TEXT
            )
        ''')
        
        # Savings goals table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS savings_goals (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                monto_objetivo REAL NOT NULL,
                monto_actual REAL DEFAULT 0,
                fecha_limite TEXT,
                frecuencia_aporte TEXT,
                dia_aporte INTEGER,
                icono TEXT DEFAULT '🎯',
                color TEXT DEFAULT '#3b82f6',
                notas TEXT DEFAULT NULL,
                environment TEXT DEFAULT 'TEST',
                created_at TEXT
            )
        ''')
        
        # Savings contributions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS savings_contributions (
                id SERIAL PRIMARY KEY,
                goal_id INTEGER REFERENCES savings_goals(id) ON DELETE CASCADE,
                monto REAL NOT NULL,
                fecha TEXT NOT NULL,
                banco TEXT
            )
        ''')
        
        # Savings withdrawals table (PostgreSQL)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS savings_withdrawals (
                id SERIAL PRIMARY KEY,
                goal_id INTEGER REFERENCES savings_goals(id) ON DELETE CASCADE,
                monto REAL NOT NULL,
                motivo TEXT,
                categoria TEXT,
                banco TEXT,
                fecha TEXT NOT NULL,
                fecha_limite_reponer TEXT NOT NULL,
                repuesto BOOLEAN DEFAULT FALSE,
                fecha_repuesto TEXT
            )
        ''')
        
        # Check and seed defaults for PostgreSQL
        cursor.execute('SELECT count(*) FROM categories')
        if cursor.fetchone()[0] == 0:
            defaults = [
                ('Alimentación', 'Gasto'), ('Transporte', 'Gasto'), ('Vivienda', 'Gasto'),
                ('Salud', 'Gasto'), ('Ocio', 'Gasto'), ('Sueldo', 'Ingreso'),
                ('Regalos', 'Gasto'), ('Educación', 'Gasto'), ('Inversiones', 'Gasto')
            ]
            for nombre, tipo in defaults:
                cursor.execute('INSERT INTO categories (nombre, tipo) VALUES (%s, %s)', (nombre, tipo))
        
        cursor.execute('SELECT count(*) FROM banks')
        if cursor.fetchone()[0] == 0:
            default_banks = ['Santander', 'Banco de Chile', 'Efectivo', 'Scotiabank', 'Estado', 'Falabella']
            for banco in default_banks:
                cursor.execute('INSERT INTO banks (nombre) VALUES (%s)', (banco,))
                
        cursor.execute('SELECT count(*) FROM accounts')
        if cursor.fetchone()[0] == 0:
            default_accounts = ['Principal', 'Cuenta RUT', 'Cuenta Corriente', 'Cuenta de Ahorro', 'Vista', 'Tarjeta de Crédito']
            for acc in default_accounts:
                cursor.execute('INSERT INTO accounts (nombre) VALUES (%s)', (acc,))
        
        cursor.execute('SELECT count(*) FROM users')
        if cursor.fetchone()[0] == 0:
            hashed_pwd = ph.hash("fiorestzin")
            cursor.execute('INSERT INTO users (username, hashed_password, is_admin) VALUES (%s, %s, %s)', 
                          ("admin", hashed_pwd, 1))
            print("Created default admin user: admin / fiorestzin")
            
        # Migration: Add notas column to savings_goals if it doesn't exist
        try:
            cursor.execute("ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT NULL")
        except:
            pass  # Column already exists
    else:
        # SQLite syntax
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha TEXT,
                tipo TEXT,
                categoria TEXT,
                detalle TEXT,
                banco TEXT,
                cuenta TEXT DEFAULT 'Principal',
                monto REAL,
                ingreso REAL,
                gasto REAL,
                environment TEXT DEFAULT 'TEST'
            )
        ''')
        
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN cuenta TEXT DEFAULT 'Principal'")
        except:
            pass
        
        # Migration: Add environment column to transactions if missing
        try:
            cursor.execute("ALTER TABLE transactions ADD COLUMN environment TEXT DEFAULT 'TEST'")
        except:
            pass  # Column already exists
        
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
        
        # Migration: Add environment column to budgets if missing
        try:
            cursor.execute("ALTER TABLE budgets ADD COLUMN environment TEXT DEFAULT 'TEST'")
        except:
            pass  # Column already exists
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                tipo TEXT DEFAULT 'Gasto',
                environment TEXT DEFAULT NULL
            )
        ''')
        
        # SQLite migration: Add environment column if missing
        try:
            cursor.execute("ALTER TABLE categories ADD COLUMN environment TEXT DEFAULT NULL")
        except:
            pass  # Column already exists
        
        cursor.execute('SELECT count(*) FROM categories')
        if cursor.fetchone()[0] == 0:
            defaults = [
                ('Alimentación', 'Gasto'), ('Transporte', 'Gasto'), ('Vivienda', 'Gasto'),
                ('Salud', 'Gasto'), ('Ocio', 'Gasto'), ('Sueldo', 'Ingreso'),
                ('Regalos', 'Gasto'), ('Educación', 'Gasto'), ('Inversiones', 'Gasto')
            ]
            cursor.executemany('INSERT INTO categories (nombre, tipo) VALUES (?, ?)', defaults)
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS banks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                environment TEXT DEFAULT NULL
            )
        ''')
        
        # SQLite migration: Add environment column if missing
        try:
            cursor.execute("ALTER TABLE banks ADD COLUMN environment TEXT DEFAULT NULL")
        except:
            pass  # Column already exists
            
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                environment TEXT DEFAULT NULL
            )
        ''')
        
        # SQLite migration: Add environment column if missing
        try:
            cursor.execute("ALTER TABLE accounts ADD COLUMN environment TEXT DEFAULT NULL")
        except:
            pass  # Column already exists
        
        cursor.execute('SELECT count(*) FROM banks')
        if cursor.fetchone()[0] == 0:
            default_banks = [('Santander',), ('Banco de Chile',), ('Efectivo',), ('Scotiabank',), ('Estado',), ('Falabella',)]
            cursor.executemany('INSERT INTO banks (nombre) VALUES (?)', default_banks)
            
        cursor.execute('SELECT count(*) FROM accounts')
        if cursor.fetchone()[0] == 0:
            default_accounts = [('Principal',), ('Cuenta RUT',), ('Cuenta Corriente',), ('Cuenta de Ahorro',), ('Vista',), ('Tarjeta de Crédito',)]
            cursor.executemany('INSERT INTO accounts (nombre) VALUES (?)', default_accounts)
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                is_admin INTEGER DEFAULT 0
            )
        ''')
        
        # Settings table for configurable values (SQLite)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT
            )
        ''')
        
        # Savings goals table (SQLite)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS savings_goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                monto_objetivo REAL NOT NULL,
                monto_actual REAL DEFAULT 0,
                fecha_limite TEXT,
                frecuencia_aporte TEXT,
                dia_aporte INTEGER,
                icono TEXT DEFAULT '🎯',
                color TEXT DEFAULT '#3b82f6',
                notas TEXT DEFAULT NULL,
                environment TEXT DEFAULT 'TEST',
                created_at TEXT
            )
        ''')
        
        # Savings contributions table (SQLite)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS savings_contributions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_id INTEGER REFERENCES savings_goals(id) ON DELETE CASCADE,
                monto REAL NOT NULL,
                fecha TEXT NOT NULL,
                banco TEXT
            )
        ''')
        
        # Savings withdrawals table (SQLite)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS savings_withdrawals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_id INTEGER REFERENCES savings_goals(id) ON DELETE CASCADE,
                monto REAL NOT NULL,
                motivo TEXT,
                categoria TEXT,
                banco TEXT,
                fecha TEXT NOT NULL,
                fecha_limite_reponer TEXT NOT NULL,
                repuesto INTEGER DEFAULT 0,
                fecha_repuesto TEXT
            )
        ''')
        
        cursor.execute('SELECT count(*) FROM users')
        if cursor.fetchone()[0] == 0:
            hashed_pwd = ph.hash("fiorestzin")
            cursor.execute('INSERT INTO users (username, hashed_password, is_admin) VALUES (?, ?, ?)', 
                          ("admin", hashed_pwd, 1))
            print("Created default admin user: admin / fiorestzin")
            
        # Migration: Add notas column to savings_goals if it doesn't exist
        try:
            cursor.execute("ALTER TABLE savings_goals ADD COLUMN notas TEXT DEFAULT NULL")
        except:
            pass  # Column already exists
    
    conn.commit()
    conn.close()


# Initialize on startup
init_db()

class Category(BaseModel):
    nombre: str
    tipo: str = 'Gasto'
    environment: str = 'PROD'  # TEST (demo) or PROD (real)

@app.get("/categories")
def get_categories(environment: str = None):
    """Get categories. If environment is specified, filter by it. Otherwise return all (for backwards compatibility)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if environment:
        # Filter by environment: get shared (NULL/empty) + environment-specific
        cursor.execute(sql_param(
            "SELECT id, nombre, tipo, environment FROM categories WHERE environment IS NULL OR environment = '' OR environment = ? ORDER BY nombre"
        ), (environment,))
    else:
        cursor.execute("SELECT id, nombre, tipo, environment FROM categories ORDER BY nombre")
    
    rows = cursor.fetchall()
    conn.close()
    if USE_POSTGRES:
        return [{"id": row[0], "nombre": row[1], "tipo": row[2], "environment": row[3]} for row in rows]
    return [dict(row) for row in rows]

@app.post("/categories")
def create_category(cat: Category):
    """Create a new category in the specified environment."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(sql_param("INSERT INTO categories (nombre, tipo, environment) VALUES (?, ?, ?)"), 
                       (cat.nombre, cat.tipo, cat.environment))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    conn.close()
    return {"status": "ok", "message": "Category created", "environment": cat.environment}

@app.delete("/categories/{cat_id}")
def delete_category(cat_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("DELETE FROM categories WHERE id = ?"), (cat_id,))
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Category deleted"}

class CategoryUpdate(BaseModel):
    nombre: str
    tipo: str = None  # Optional, keep current if not provided

@app.put("/categories/{cat_id}")
def update_category(cat_id: int, cat: CategoryUpdate):
    """Update an existing category's name and/or type. Also updates all transactions with the old category name."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get the old category name first
    cursor.execute(sql_param("SELECT nombre FROM categories WHERE id = ?"), (cat_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Category not found")
    
    old_name = row[0] if USE_POSTGRES else row['nombre']
    
    # Update the category
    if cat.tipo:
        cursor.execute(sql_param("UPDATE categories SET nombre = ?, tipo = ? WHERE id = ?"), 
                       (cat.nombre, cat.tipo, cat_id))
    else:
        cursor.execute(sql_param("UPDATE categories SET nombre = ? WHERE id = ?"), 
                       (cat.nombre, cat_id))
    
    # CASCADE: Update all transactions that have the old category name
    if old_name != cat.nombre:
        cursor.execute(sql_param("UPDATE transactions SET categoria = ? WHERE categoria = ?"),
                       (cat.nombre, old_name))
        updated_count = cursor.rowcount
    else:
        updated_count = 0
    
    conn.commit()
    conn.close()
    return {
        "status": "ok", 
        "message": f"Category updated. {updated_count} transactions updated.",
        "transactions_updated": updated_count
    }



# --- Bank Management ---

class Bank(BaseModel):
    nombre: str
    environment: str = 'PROD'  # TEST (demo) or PROD (real)

@app.get("/banks")
def get_banks(environment: str = None):
    """Get banks. If environment is specified, filter by it. Otherwise return all (for backwards compatibility)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if environment:
        # Filter by environment: get shared (NULL/empty) + environment-specific
        cursor.execute(sql_param(
            "SELECT id, nombre, environment FROM banks WHERE environment IS NULL OR environment = '' OR environment = ? ORDER BY nombre"
        ), (environment,))
    else:
        cursor.execute("SELECT id, nombre, environment FROM banks ORDER BY nombre")
    
    rows = cursor.fetchall()
    conn.close()
    if USE_POSTGRES:
        return [{"id": row[0], "nombre": row[1], "environment": row[2]} for row in rows]
    return [dict(row) for row in rows]

@app.post("/banks")
def create_bank(bank: Bank):
    """Create a new bank in the specified environment."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(sql_param("INSERT INTO banks (nombre, environment) VALUES (?, ?)"), 
                       (bank.nombre, bank.environment))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    conn.close()
    return {"status": "ok", "message": "Bank created", "environment": bank.environment}

@app.delete("/banks/{bank_id}")
def delete_bank(bank_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("DELETE FROM banks WHERE id = ?"), (bank_id,))
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Bank deleted"}


# --- Accounts Management ---

class AccountModel(BaseModel):
    nombre: str
    environment: str = 'PROD'  # TEST (demo) or PROD (real)

@app.get("/accounts")
def get_accounts(environment: str = None):
    """Get accounts. If environment is specified, filter by it. Otherwise return all."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if environment:
        cursor.execute(sql_param(
            "SELECT id, nombre, environment FROM accounts WHERE environment IS NULL OR environment = '' OR environment = ? ORDER BY nombre"
        ), (environment,))
    else:
        cursor.execute("SELECT id, nombre, environment FROM accounts ORDER BY nombre")
    
    rows = cursor.fetchall()
    conn.close()
    if USE_POSTGRES:
        return [{"id": row[0], "nombre": row[1], "environment": row[2]} for row in rows]
    return [dict(row) for row in rows]

@app.post("/accounts")
def create_account(account: AccountModel):
    """Create a new account in the specified environment."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(sql_param("INSERT INTO accounts (nombre, environment) VALUES (?, ?)"), 
                       (account.nombre, account.environment))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    conn.close()
    return {"status": "ok", "message": "Account created", "environment": account.environment}

@app.delete("/accounts/{acc_id}")
def delete_account(acc_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("DELETE FROM accounts WHERE id = ?"), (acc_id,))
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Account deleted"}

@app.get("/banks/with-balance")
def get_banks_with_balance(environment: str = "PROD"):
    """Get banks that have a positive calculated balance (Income - Expenses)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get all banks
    cursor.execute(sql_param("SELECT id, nombre FROM banks WHERE environment IS NULL OR environment = '' OR environment = ?"), (environment,))
    banks = cursor.fetchall()
    
    positive_banks = []
    
    for bank_row in banks:
        b_id, b_name = bank_row
        
        # Calculate balance for this bank
        # Balance = Sum(Income) - Sum(Expense)
        # Transactions have 'ingreso' and 'gasto' columns (or we use 'tipo' and 'monto')
        # Based on init_db, transactions has 'ingreso' and 'gasto' columns.
        
        if USE_POSTGRES:
            cursor.execute(sql_param('''
                SELECT COALESCE(SUM(ingreso), 0) - COALESCE(SUM(gasto), 0)
                FROM transactions 
                WHERE banco = ? AND (environment = ? OR environment IS NULL)
            '''), (b_name, environment))
        else:
            cursor.execute(sql_param('''
                SELECT COALESCE(SUM(ingreso), 0) - COALESCE(SUM(gasto), 0)
                FROM transactions 
                WHERE banco = ? AND (environment = ? OR environment IS NULL)
            '''), (b_name, environment))
            
        balance = cursor.fetchone()[0]
        
        if balance > 0:
            positive_banks.append({"id": b_id, "nombre": b_name, "saldo": balance})
            
    conn.close()
    return positive_banks



# --- Budget Management ---

class Budget(BaseModel):
    category: str
    amount: float
    month: str  # YYYY-MM
    environment: str = "PROD"

class BudgetUpdate(BaseModel):
    category: str = None
    amount: float = None
    month: str = None

@app.get("/budgets")
def get_budgets(month: str = None, environment: str = "PROD"):
    """Get all budgets for the given environment, optionally filtered by month."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT id, category, amount, month, environment FROM budgets WHERE environment = ?"
    params = [environment]
    
    if month:
        query += " AND month = ?"
        params.append(month)
        
    query += " ORDER BY month DESC, category ASC"
    cursor.execute(sql_param(query), params)
    rows = cursor.fetchall()
    
    # Calculate progress for each budget
    budgets_with_progress = []
    for r in rows:
        if USE_POSTGRES:
            b = {"id": r[0], "category": r[1], "amount": r[2], "month": r[3], "environment": r[4]}
        else:
            b = dict(r)
        
        cat = b['category']
        m = b['month']
        
        # SQL to sum expenses - use TO_CHAR for PostgreSQL, strftime for SQLite
        if USE_POSTGRES:
            sum_query = '''
                SELECT COALESCE(SUM(gasto), 0) 
                FROM transactions 
                WHERE categoria = %s AND TO_CHAR(fecha::date, 'YYYY-MM') = %s AND environment = %s
            '''
        else:
            sum_query = '''
                SELECT COALESCE(SUM(gasto), 0) 
                FROM transactions 
                WHERE categoria = ? AND strftime('%Y-%m', fecha) = ? AND environment = ?
            '''
        cursor.execute(sum_query, (cat, m, environment))
        spent = cursor.fetchone()[0] or 0
        b['spent'] = spent
        b['percentage'] = round((spent / b['amount']) * 100, 1) if b['amount'] > 0 else 0
        b['remaining'] = max(0, b['amount'] - spent)
        b['exceeded'] = spent > b['amount']
        budgets_with_progress.append(b)
        
    conn.close()
    return budgets_with_progress

@app.post("/budgets")
def create_budget(budget: Budget):
    """Create a new budget or update if category+month+environment already exists."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # UPSERT: PostgreSQL uses ON CONFLICT, SQLite uses INSERT OR REPLACE
        if USE_POSTGRES:
            cursor.execute('''
                INSERT INTO budgets (category, amount, month, environment)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (category, month, environment) DO UPDATE SET amount = EXCLUDED.amount
            ''', (budget.category, budget.amount, budget.month, budget.environment))
        else:
            # For SQLite, check if exists first then update or insert
            cursor.execute(sql_param('''
                SELECT id FROM budgets WHERE category = ? AND month = ? AND environment = ?
            '''), (budget.category, budget.month, budget.environment))
            existing = cursor.fetchone()
            
            if existing:
                cursor.execute(sql_param('''
                    UPDATE budgets SET amount = ? WHERE id = ?
                '''), (budget.amount, existing[0]))
            else:
                cursor.execute(sql_param('''
                    INSERT INTO budgets (category, amount, month, environment)
                    VALUES (?, ?, ?, ?)
                '''), (budget.category, budget.amount, budget.month, budget.environment))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    
    conn.close()
    return {"status": "ok", "message": "Presupuesto guardado correctamente"}

@app.put("/budgets/{budget_id}")
def update_budget(budget_id: int, budget: BudgetUpdate):
    """Update an existing budget by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if exists
    cursor.execute(sql_param("SELECT id FROM budgets WHERE id = ?"), (budget_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    
    # Build dynamic update query
    updates = []
    params = []
    
    if budget.category is not None:
        updates.append("category = ?")
        params.append(budget.category)
    if budget.amount is not None:
        updates.append("amount = ?")
        params.append(budget.amount)
    if budget.month is not None:
        updates.append("month = ?")
        params.append(budget.month)
    
    if not updates:
        conn.close()
        return {"status": "ok", "message": "No hay cambios que aplicar"}
    
    params.append(budget_id)
    query = f"UPDATE budgets SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(sql_param(query), params)
    conn.commit()
    conn.close()
    
    return {"status": "ok", "message": "Presupuesto actualizado"}

@app.delete("/budgets/{budget_id}")
def delete_budget(budget_id: int):
    """Delete a budget by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if exists
    cursor.execute(sql_param("SELECT id FROM budgets WHERE id = ?"), (budget_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    
    cursor.execute(sql_param("DELETE FROM budgets WHERE id = ?"), (budget_id,))
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Presupuesto eliminado"}




# --- Forecasting ---

@app.get("/forecasting")
def get_forecasting(months_ahead: int = 3):
    conn = get_db_connection()
    
    # 1. Get Monthly History
    query = '''
        SELECT strftime('%Y-%m', fecha) as month, SUM(gasto) as gasto 
        FROM transactions 
        WHERE gasto > 0 
        GROUP BY month 
        ORDER BY month ASC
    '''
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    if df.empty or len(df) < 2:
        return {"historical": [], "projection": []}
    
    # Convert to numeric for regression
    df['period'] = range(len(df))
    
    # Simple Linear Regression: y = mx + b
    # We use numpy for this (pandas dependency)
    import numpy as np
    
    x = df['period'].values
    y = df['gasto'].values
    
    # Polyfit degree 1 (Line)
    slope, intercept = np.polyfit(x, y, 1)
    
    # Generate Projections
    last_period = df['period'].iloc[-1]
    last_month_str = df['month'].iloc[-1]
    last_date = pd.to_datetime(last_month_str + '-01')
    
    projection_data = []
    
    for i in range(1, months_ahead + 1):
        next_period = last_period + i
        projected_val = slope * next_period + intercept
        
        # Calculate Date
        next_date = last_date + pd.DateOffset(months=i)
        month_label = next_date.strftime('%Y-%m')
        
        projection_data.append({
            "month": month_label,
            "gasto_proyectado": max(0, round(projected_val, 0)), # No negative expenses
            "is_projection": True
        })
        
    # Mark historical data
    historical = df[['month', 'gasto']].to_dict(orient='records')
    for h in historical:
        h['gasto_proyectado'] = None # Explicitly null for graph
        h['is_projection'] = False
        
    return {
        "historical": historical,
        "projection": projection_data,
        "trend_info": {
            "slope": round(slope, 2),
            "trend": "increasing" if slope > 0 else "decreasing"
        }
    }

# --- Subscription Detection ---

@app.get("/subscriptions")
def get_subscriptions(environment: str = "TEST"):
    """Detect recurring expenses (potential subscriptions) based on transactions that appear in multiple distinct months.
    Returns the REAL total paid, not an annual estimate."""
    conn = get_db_connection()
    
    # Logic:
    # 1. Filter by environment
    # 2. Group by detalle (item name) - detect by name, not amount
    # 3. Count distinct months (must appear in 3+ different months)
    # 4. Return REAL total paid (SUM), not estimate
    
    if USE_POSTGRES:
        query = '''
            SELECT 
                detalle as name, 
                ROUND(AVG(monto)::numeric, 0) as avg_amount, 
                COUNT(*) as frequency,
                MAX(fecha) as last_payment,
                COUNT(DISTINCT TO_CHAR(TO_DATE(fecha, 'YYYY-MM-DD'), 'YYYY-MM')) as distinct_months,
                SUM(monto) as total_paid
            FROM transactions 
            WHERE gasto > 0 AND environment = %s AND detalle IS NOT NULL AND detalle != '' AND categoria != 'Transferencia'
            GROUP BY detalle
            HAVING COUNT(DISTINCT TO_CHAR(TO_DATE(fecha, 'YYYY-MM-DD'), 'YYYY-MM')) >= 2
            ORDER BY total_paid DESC
        '''
    else:
        # SQLite version
        query = '''
            SELECT 
                detalle as name, 
                ROUND(AVG(monto), 0) as avg_amount, 
                COUNT(*) as frequency,
                MAX(fecha) as last_payment,
                COUNT(DISTINCT strftime('%Y-%m', fecha)) as distinct_months,
                SUM(monto) as total_paid
            FROM transactions 
            WHERE gasto > 0 AND environment = ? AND detalle IS NOT NULL AND detalle != '' AND categoria != 'Transferencia'
            GROUP BY detalle
            HAVING COUNT(DISTINCT strftime('%Y-%m', fecha)) >= 2
            ORDER BY total_paid DESC
        '''
    
    cursor = conn.cursor()
    cursor.execute(query, (environment,))
    rows = cursor.fetchall()
    conn.close()
    
    subs = []
    for r in rows:
        if USE_POSTGRES:
            subs.append({
                "name": r[0],
                "amount": float(r[1]) if r[1] else 0,
                "frequency": r[2],
                "last_payment": r[3],
                "distinct_months": r[4],
                "total_paid": float(r[5]) if r[5] else 0
            })
        else:
            subs.append({
                "name": r[0],
                "amount": r[1] or 0,
                "frequency": r[2],
                "last_payment": r[3],
                "distinct_months": r[4],
                "total_paid": r[5] or 0
            })
        
    return subs

# --- Export Report ---

@app.get("/export_report")
def export_report(start_date: str = None, end_date: str = None):
    conn = get_db_connection()
    
    # 1. Transactions Sheet
    query_tx = "SELECT * FROM transactions WHERE 1=1"
    params = []
    if start_date:
        query_tx += " AND fecha >= ?"
        params.append(start_date)
    if end_date:
        query_tx += " AND fecha <= ?"
        params.append(end_date)
    query_tx += " ORDER BY fecha DESC"
    
    df_tx = pd.read_sql_query(query_tx, conn, params=params)
    
    # 2. Summary by Category
    if not df_tx.empty:
        df_cat = df_tx[df_tx['gasto'] > 0].groupby('categoria')['gasto'].sum().reset_index().sort_values('gasto', ascending=False)
    else:
        df_cat = pd.DataFrame(columns=['categoria', 'gasto'])

    conn.close()
    
    # Create Excel
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_tx.to_excel(writer, sheet_name='Transacciones', index=False)
        df_cat.to_excel(writer, sheet_name='Resumen Categorías', index=False)
        
    output.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="reporte_finance_{start_date}_{end_date}.xlsx"'
    }
    return Response(content=output.getvalue(), media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers=headers)



# --- BUDGETS & CATEGORIES ENDPOINTS ---

class CategoryCreate(BaseModel):
    nombre: str
    tipo: str # Ingreso, Gasto
    environment: str = 'PROD'

@app.get("/categories")
def get_categories(environment: str = "PROD"):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("SELECT id, nombre, tipo FROM categories WHERE environment = ? ORDER BY nombre"), (environment,))
    rows = fetchall_as_dict(cursor)
    conn.close()
    return rows

@app.post("/categories")
def create_category(cat: CategoryCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(sql_param("INSERT INTO categories (nombre, tipo, environment) VALUES (?, ?, ?)"), 
                       (cat.nombre, cat.tipo, cat.environment))
        conn.commit()
        return {"status": "ok", "message": "Category created"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

class BudgetCreate(BaseModel):
    category: str
    amount: float
    month: str # YYYY-MM
    environment: str = 'PROD'

class BudgetUpdate(BaseModel):
    amount: float

@app.get("/budgets")
def get_budgets(month: str, environment: str = "PROD"):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Get Budgets
    cursor.execute(sql_param("SELECT * FROM budgets WHERE month = ? AND environment = ?"), (month, environment))
    budgets = fetchall_as_dict(cursor)
    
    # 2. Get Actual Spending for each budget category in that month
    # We need to sum "gasto" from transactions where category matches and date is in the month
    # Using simple string matching for month (YYYY-MM)
    
    budget_list = []
    for b in budgets:
        cat = b['category']
        # Sum spending
        cursor.execute(sql_param("""
            SELECT SUM(gasto) FROM transactions 
            WHERE environment = ? AND categoria = ? AND fecha LIKE ?
        """), (environment, cat, f"{month}%"))
        
        row = cursor.fetchone()
        spent = row[0] if row and row[0] else 0
        
        amount = b['amount']
        remaining = amount - spent
        percentage = (spent / amount * 100) if amount > 0 else 0
        
        b_dict = dict(b)
        b_dict['spent'] = spent
        b_dict['remaining'] = remaining
        b_dict['percentage'] = percentage
        b_dict['exceeded'] = spent > amount
        
        budget_list.append(b_dict)
        
    conn.close()
    return budget_list

@app.post("/budgets")
def create_budget(budget: BudgetCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check duplicate
    cursor.execute(sql_param("SELECT id FROM budgets WHERE category = ? AND month = ? AND environment = ?"), 
                   (budget.category, budget.month, budget.environment))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Ya existe un presupuesto para esta categoría en este mes")

    cursor.execute(sql_param("""
        INSERT INTO budgets (category, amount, month, environment, created_at)
        VALUES (?, ?, ?, ?, ?)
    """), (budget.category, budget.amount, budget.month, budget.environment, datetime.now()))
    
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Budget created"}

@app.put("/budgets/{budget_id}")
def update_budget(budget_id: int, budget: BudgetUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(sql_param("UPDATE budgets SET amount = ? WHERE id = ?"), (budget.amount, budget_id))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Budget not found")
        
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Budget updated"}

@app.delete("/budgets/{budget_id}")
def delete_budget(budget_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("DELETE FROM budgets WHERE id = ?"), (budget_id,))
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Budget deleted"}


# --- Savings Goals ---

class SavingsGoalCreate(BaseModel):
    nombre: str
    monto_objetivo: float
    fecha_limite: str = None
    frecuencia_aporte: str = None  # 'diario', 'semanal', 'mensual', or None
    dia_aporte: int = None  # Day of week (0-6) for weekly, day of month (1-31) for monthly
    icono: str = '🎯'
    color: str = '#3b82f6'
    environment: str = 'PROD'

class SavingsGoalUpdate(BaseModel):
    nombre: str = None
    monto_objetivo: float = None
    fecha_limite: str = None
    frecuencia_aporte: str = None
    dia_aporte: int = None
    icono: str = None
    color: str = None

class SavingsContributionCreate(BaseModel):
    monto: float
    fecha: str = None  # Defaults to today
    banco: str = None

@app.get("/savings-goals")
def get_savings_goals(environment: str = "PROD"):
    """Get all savings goals for the given environment."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(sql_param('''
        SELECT id, nombre, monto_objetivo, monto_actual, fecha_limite, 
               frecuencia_aporte, dia_aporte, icono, color, environment, created_at, notas
        FROM savings_goals WHERE environment = ? ORDER BY created_at DESC
    '''), (environment,))
    
    rows = cursor.fetchall()
    conn.close()
    
    goals = []
    for row in rows:
        if USE_POSTGRES:
            goals.append({
                "id": row[0], "nombre": row[1], "monto_objetivo": row[2],
                "monto_actual": row[3], "fecha_limite": row[4],
                "frecuencia_aporte": row[5], "dia_aporte": row[6],
                "icono": row[7], "color": row[8], "environment": row[9],
                "created_at": row[10], "notas": row[11],
                "porcentaje": round((row[3] / row[2]) * 100, 1) if row[2] > 0 else 0
            })
        else:
            goal = dict(row)
            goal["porcentaje"] = round((goal["monto_actual"] / goal["monto_objetivo"]) * 100, 1) if goal["monto_objetivo"] > 0 else 0
            goals.append(goal)
    
    return goals

@app.post("/savings-goals")
def create_savings_goal(goal: SavingsGoalCreate):
    """Create a new savings goal."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        cursor.execute(sql_param('''
            INSERT INTO savings_goals (nombre, monto_objetivo, monto_actual, fecha_limite, 
                                        frecuencia_aporte, dia_aporte, icono, color, environment, created_at)
            VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
        '''), (goal.nombre, goal.monto_objetivo, goal.fecha_limite, 
               goal.frecuencia_aporte, goal.dia_aporte, goal.icono, 
               goal.color, goal.environment, created_at))
        conn.commit()
        
        # Get the new ID
        if USE_POSTGRES:
            cursor.execute("SELECT lastval()")
        else:
            cursor.execute("SELECT last_insert_rowid()")
        new_id = cursor.fetchone()[0]
        
        return {"status": "ok", "message": "Meta de ahorro creada", "id": new_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

class GoalNotesUpdate(BaseModel):
    notas: str

@app.put("/savings-goals/{goal_id}/notas")
def update_goal_notas(goal_id: int, update: GoalNotesUpdate):
    """Update notes of a savings goal."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("UPDATE savings_goals SET notas = ? WHERE id = ?"), (update.notas, goal_id))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.put("/savings-goals/{goal_id}")
def update_savings_goal(goal_id: int, goal: SavingsGoalUpdate):
    """Update an existing savings goal."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if exists
    cursor.execute(sql_param("SELECT id FROM savings_goals WHERE id = ?"), (goal_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    
    # Build dynamic update query
    updates = []
    params = []
    
    if goal.nombre is not None:
        updates.append("nombre = ?")
        params.append(goal.nombre)
    if goal.monto_objetivo is not None:
        updates.append("monto_objetivo = ?")
        params.append(goal.monto_objetivo)
    if goal.fecha_limite is not None:
        updates.append("fecha_limite = ?")
        params.append(goal.fecha_limite if goal.fecha_limite else None)
    if goal.frecuencia_aporte is not None:
        updates.append("frecuencia_aporte = ?")
        params.append(goal.frecuencia_aporte if goal.frecuencia_aporte else None)
    if goal.dia_aporte is not None:
        updates.append("dia_aporte = ?")
        params.append(goal.dia_aporte)
    if goal.icono is not None:
        updates.append("icono = ?")
        params.append(goal.icono)
    if goal.color is not None:
        updates.append("color = ?")
        params.append(goal.color)
    
    if updates:
        params.append(goal_id)
        query = f"UPDATE savings_goals SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(sql_param(query), params)
        conn.commit()
    
    conn.close()
    return {"status": "ok", "message": "Meta actualizada"}

@app.delete("/savings-goals/{goal_id}")
def delete_savings_goal(goal_id: int):
    """Delete a savings goal and all its contributions."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if exists
    cursor.execute(sql_param("SELECT id FROM savings_goals WHERE id = ?"), (goal_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    
    # Delete contributions first (for databases without CASCADE)
    cursor.execute(sql_param("DELETE FROM savings_contributions WHERE goal_id = ?"), (goal_id,))
    cursor.execute(sql_param("DELETE FROM savings_goals WHERE id = ?"), (goal_id,))
    conn.commit()
    conn.close()
    
    return {"status": "ok", "message": "Meta eliminada"}

@app.post("/savings-goals/{goal_id}/contribute")
def contribute_to_goal(goal_id: int, contribution: SavingsContributionCreate):
    """Add a contribution to a savings goal."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if goal exists
    cursor.execute(sql_param("SELECT id, monto_actual FROM savings_goals WHERE id = ?"), (goal_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    
    if contribution.monto <= 0:
        conn.close()
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")
    
    fecha = contribution.fecha or datetime.now().strftime("%Y-%m-%d")
    
    try:
        # Insert contribution
        cursor.execute(sql_param('''
            INSERT INTO savings_contributions (goal_id, monto, fecha, banco)
            VALUES (?, ?, ?, ?)
        '''), (goal_id, contribution.monto, fecha, contribution.banco))
        
        # Update goal's monto_actual
        current_amount = row[1] if USE_POSTGRES else row['monto_actual']
        new_amount = current_amount + contribution.monto
        cursor.execute(sql_param("UPDATE savings_goals SET monto_actual = ? WHERE id = ?"),
                       (new_amount, goal_id))
        
        conn.commit()
        
        # Get the new ID
        if USE_POSTGRES:
            cursor.execute("SELECT lastval()")
        else:
            cursor.execute("SELECT last_insert_rowid()")
        new_contribution_id = cursor.fetchone()[0]

        return {
            "status": "ok", 
            "message": f"Aporte de ${contribution.monto:,.0f} registrado",
            "nuevo_total": new_amount,
            "contribution_id": new_contribution_id
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/savings-goals/{goal_id}/contributions")
def get_goal_contributions(goal_id: int):
    """Get all contributions for a savings goal."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if goal exists
    cursor.execute(sql_param("SELECT id FROM savings_goals WHERE id = ?"), (goal_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    
    cursor.execute(sql_param('''
        SELECT id, monto, fecha, banco FROM savings_contributions 
        WHERE goal_id = ? ORDER BY fecha DESC
    '''), (goal_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    if USE_POSTGRES:
        return [{"id": r[0], "monto": r[1], "fecha": r[2], "banco": r[3]} for r in rows]
    return [dict(row) for row in rows]

@app.get("/savings-goals/{goal_id}/history")
def get_goal_history(goal_id: int):
    """Get unified history of contributions (positive) and withdrawals (negative)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if goal exists
    cursor.execute(sql_param("SELECT id FROM savings_goals WHERE id = ?"), (goal_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    
    # Get Contributions
    cursor.execute(sql_param('''
        SELECT id, monto, fecha, banco FROM savings_contributions 
        WHERE goal_id = ?
    '''), (goal_id,))
    contributions = fetchall_as_dict(cursor)
    
    # Get Withdrawals
    cursor.execute(sql_param('''
        SELECT id, monto, fecha, banco, motivo FROM savings_withdrawals 
        WHERE goal_id = ?
    '''), (goal_id,))
    withdrawals = fetchall_as_dict(cursor)
    
    conn.close()
    
    # Combine and standardize
    history = []
    
    for c in contributions:
        history.append({
            "id": f"c_{c['id']}", # Unique ID for list
            "original_id": c['id'],
            "fecha": c['fecha'],
            "monto": c['monto'], # Positive
            "tipo": "Aporte",
            "banco": c['banco'],
            "detalle": "Aporte"
        })
        
    for w in withdrawals:
        history.append({
            "id": f"w_{w['id']}",
            "original_id": w['id'],
            "fecha": w['fecha'],
            "monto": -w['monto'], # Negative
            "tipo": "Retiro",
            "banco": w['banco'],
            "detalle": w.get('motivo') or "Retiro"
        })
    
    # Sort by date descending
    history.sort(key=lambda x: x['fecha'], reverse=True)
    
    return history

@app.get("/savings-goals/by-bank")
def get_savings_by_bank(environment: str = "PROD"):
    """Get total savings accumulated per bank."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(sql_param('''
        SELECT c.banco, SUM(c.monto)
        FROM savings_contributions c
        JOIN savings_goals g ON c.goal_id = g.id
        WHERE g.environment = ? AND c.banco IS NOT NULL AND c.banco != ''
        GROUP BY c.banco
    '''), (environment,))
    
    rows = cursor.fetchall()
    conn.close()
    
    # Return as dict {banco: total}
    return {row[0]: row[1] for row in rows}

def update_goal_total(goal_id: int):
    """Recalculate and update the current amount of a goal based on contributions."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("SELECT COALESCE(SUM(monto), 0) FROM savings_contributions WHERE goal_id = ?"), (goal_id,))
    total = cursor.fetchone()[0]
    cursor.execute(sql_param("UPDATE savings_goals SET monto_actual = ? WHERE id = ?"), (total, goal_id))
    conn.commit()
    conn.close()

@app.put("/savings-contributions/{contribution_id}")
def update_contribution(contribution_id: int, data: dict):
    """Update a savings contribution."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(sql_param("SELECT goal_id FROM savings_contributions WHERE id = ?"), (contribution_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Aporte no encontrado")
    
    goal_id = row[0] if USE_POSTGRES else row['goal_id']
    
    fields = []
    params = []
    if "monto" in data:
        fields.append("monto = ?")
        params.append(data["monto"])
    if "fecha" in data:
        fields.append("fecha = ?")
        params.append(data["fecha"])
    if "banco" in data:
        fields.append("banco = ?")
        params.append(data["banco"])
        
    if not fields:
        conn.close()
        return {"message": "No fields to update"}
        
    query = f"UPDATE savings_contributions SET {', '.join(fields)} WHERE id = ?"
    params.append(contribution_id)
    
    cursor.execute(sql_param(query), params)
    conn.commit()
    conn.close()
    
    # Update goal totals
    update_goal_total(goal_id)
    
    return {"status": "ok"}

@app.delete("/savings-contributions/{contribution_id}")
def delete_contribution(contribution_id: int):
    """Delete a savings contribution."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(sql_param("SELECT goal_id FROM savings_contributions WHERE id = ?"), (contribution_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Aporte no encontrado")
    
    goal_id = row[0] if USE_POSTGRES else row['goal_id']
    
    cursor.execute(sql_param("DELETE FROM savings_contributions WHERE id = ?"), (contribution_id,))
    conn.commit()
    conn.close()
    
    # Update goal totals
    update_goal_total(goal_id)
    
    return {"status": "ok"}

@app.delete("/savings-withdrawals/{withdrawal_id}")
def delete_withdrawal(withdrawal_id: int):
    """Delete a withdrawal and its associated negative contribution."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get withdrawal info
    cursor.execute(sql_param("SELECT goal_id, monto, fecha, banco FROM savings_withdrawals WHERE id = ?"), (withdrawal_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Retiro no encontrado")
    
    goal_id = row[0] if USE_POSTGRES else row['goal_id']
    monto = row[1] if USE_POSTGRES else row['monto']
    fecha = row[2] if USE_POSTGRES else row['fecha']
    banco = row[3] if USE_POSTGRES else row['banco']
    
    # Delete associated negative contribution
    # Note: We find it by matching criteria as there isn't a direct link ID
    cursor.execute(sql_param('''
        DELETE FROM savings_contributions 
        WHERE goal_id = ? AND monto = ? AND fecha = ? AND banco = ?
    '''), (goal_id, -monto, fecha, banco))
    
    # Delete withdrawal
    cursor.execute(sql_param("DELETE FROM savings_withdrawals WHERE id = ?"), (withdrawal_id,))
    
    conn.commit()
    conn.close()
    
    # Update goal totals
    update_goal_total(goal_id)
    
    return {"status": "ok"}

@app.get("/savings-goals/summary")
def get_savings_summary(environment: str = "PROD"):
    """Get summary of all savings for displaying committed amounts per bank."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Total saved across all goals
    cursor.execute(sql_param('''
        SELECT COALESCE(SUM(monto_actual), 0) as total_ahorrado,
               COUNT(*) as num_metas
        FROM savings_goals WHERE environment = ?
    '''), (environment,))
    
    row = cursor.fetchone()
    total_ahorrado = row[0] if row else 0
    num_metas = row[1] if row else 0
    
    conn.close()
    
    return {
        "total_ahorrado": total_ahorrado,
        "num_metas": num_metas
    }

@app.get("/savings-goals/by-bank")
def get_savings_by_bank(environment: str = "PROD"):
    """Get total contributions grouped by bank, for showing committed amounts per bank."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get contributions grouped by bank (only those with a bank specified)
    cursor.execute(sql_param('''
        SELECT sc.banco, COALESCE(SUM(sc.monto), 0) as total_aportado
        FROM savings_contributions sc
        JOIN savings_goals sg ON sc.goal_id = sg.id
        WHERE sg.environment = ? AND sc.banco IS NOT NULL AND sc.banco != ''
        GROUP BY sc.banco
    '''), (environment,))
    
    rows = cursor.fetchall()
    conn.close()
    
    # Return as dictionary {banco: monto}
    result = {}
    for row in rows:
        banco = row[0] if USE_POSTGRES else row['banco']
        monto = row[1] if USE_POSTGRES else row['total_aportado']
        result[banco] = monto
    
    return result

@app.get("/savings-goals/{goal_id}/banks")
def get_goal_banks(goal_id: int):
    """Get banks that have contributions to a specific goal (for withdrawal dropdown)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(sql_param('''
        SELECT banco, COALESCE(SUM(monto), 0) as total
        FROM savings_contributions 
        WHERE goal_id = ? AND banco IS NOT NULL AND banco != ''
        GROUP BY banco
        HAVING COALESCE(SUM(monto), 0) > 0
        ORDER BY total DESC
    '''), (goal_id,))
    
    rows = fetchall_as_dict(cursor)
    conn.close()
    
    return rows

@app.post("/savings-goals/{goal_id}/complete")
def complete_savings_goal(goal_id: int):
    """Complete a savings goal - removes all contributions (frees committed amounts) and deletes the goal."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if goal exists
    cursor.execute(sql_param("SELECT id, nombre, monto_actual, monto_objetivo FROM savings_goals WHERE id = ?"), (goal_id,))
    goal = cursor.fetchone()
    if not goal:
        conn.close()
        raise HTTPException(status_code=404, detail="Meta de ahorro no encontrada")
    
    # Delete all contributions for this goal (this frees the committed amounts from all banks)
    cursor.execute(sql_param("DELETE FROM savings_contributions WHERE goal_id = ?"), (goal_id,))
    
    # Delete all withdrawals for this goal
    cursor.execute(sql_param("DELETE FROM savings_withdrawals WHERE goal_id = ?"), (goal_id,))
    
    # Delete the goal itself
    cursor.execute(sql_param("DELETE FROM savings_goals WHERE id = ?"), (goal_id,))
    
    conn.commit()
    conn.close()
    
    return {"message": "¡Meta completada! Los comprometidos han sido liberados."}

# ============ SAVINGS TRANSFER ENDPOINTS ============

class SavingsTransfer(BaseModel):
    banco_origen: str
    banco_destino: str
    goal_ids: Optional[list[int]] = None # If None, transfer ALL goals from that bank
    environment: str = "PROD"

@app.post("/savings/transfer-between-banks")
def transfer_savings_between_banks(transfer: SavingsTransfer):
    """
    Conceptual transfer: Changes the 'banco' association for existing savings contributions.
    Does NOT create a real money transfer transaction.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Build the query
        query = "UPDATE savings_contributions SET banco = ? WHERE banco = ?"
        params = [transfer.banco_destino, transfer.banco_origen]
        
        # If specific goals are provided, limit the update
        if transfer.goal_ids and len(transfer.goal_ids) > 0:
            placeholders = ",".join(["?"] * len(transfer.goal_ids))
            query += f" AND goal_id IN ({placeholders})"
            params.extend(transfer.goal_ids)
            
        # Security: Only update contributions belonging to goals in the current environment
        query += " AND goal_id IN (SELECT id FROM savings_goals WHERE environment = ?)"
        params.append(transfer.environment)
        
        cursor.execute(sql_param(query), params)
        updated_count = cursor.rowcount
        
        conn.commit()
        return {
            "status": "ok", 
            "message": f"Se han migrado {updated_count} registros de ahorro conceptualmente.",
            "updated_count": updated_count
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# ============ SAVINGS WITHDRAWALS ENDPOINTS ============

class SavingsWithdrawal(BaseModel):
    monto: float
    motivo: str = None
    categoria: str = None
    banco: str = None
    fecha_limite_reponer: str

@app.post("/savings-goals/{goal_id}/withdraw")
def create_withdrawal(goal_id: int, withdrawal: SavingsWithdrawal, environment: str = "PROD"):
    """Create a withdrawal from a savings goal - reduces the committed amount for a specific bank."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if goal exists
    cursor.execute(sql_param("SELECT id, monto_actual, nombre FROM savings_goals WHERE id = ?"), (goal_id,))
    goal = cursor.fetchone()
    if not goal:
        conn.close()
        raise HTTPException(status_code=404, detail="Meta de ahorro no encontrada")
    
    monto_actual = goal[1] if USE_POSTGRES else goal['monto_actual']
    goal_nombre = goal[2] if USE_POSTGRES else goal['nombre']
    
    if withdrawal.monto > monto_actual:
        conn.close()
        raise HTTPException(status_code=400, detail="El monto a retirar excede el saldo de la meta")
    
    # Verify the bank has contributions to this goal
    if withdrawal.banco:
        cursor.execute(sql_param('''
            SELECT COALESCE(SUM(monto), 0) as total 
            FROM savings_contributions 
            WHERE goal_id = ? AND banco = ?
        '''), (goal_id, withdrawal.banco))
        bank_total = cursor.fetchone()[0]
        if bank_total < withdrawal.monto:
            conn.close()
            raise HTTPException(status_code=400, detail=f"El banco {withdrawal.banco} solo tiene ${bank_total:,.0f} aportado a esta meta")
    
    fecha_hoy = datetime.now().strftime("%Y-%m-%d")
    
    # 1. Create the withdrawal record (for tracking pending repayments)
    cursor.execute(sql_param('''
        INSERT INTO savings_withdrawals (goal_id, monto, motivo, categoria, banco, fecha, fecha_limite_reponer, repuesto)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    '''), (goal_id, withdrawal.monto, withdrawal.motivo, withdrawal.categoria, 
           withdrawal.banco, fecha_hoy, withdrawal.fecha_limite_reponer, False if USE_POSTGRES else 0))
    
    # 2. Create a NEGATIVE contribution to reduce the bank's committed amount
    if withdrawal.banco:
        cursor.execute(sql_param('''
            INSERT INTO savings_contributions (goal_id, monto, fecha, banco)
            VALUES (?, ?, ?, ?)
        '''), (goal_id, -withdrawal.monto, fecha_hoy, withdrawal.banco))
    
    # 3. Reduce monto_actual of the goal
    nuevo_monto = monto_actual - withdrawal.monto
    cursor.execute(sql_param("UPDATE savings_goals SET monto_actual = ? WHERE id = ?"), (nuevo_monto, goal_id))
    
    conn.commit()
    conn.close()
    
    return {"message": "Retiro registrado. El saldo comprometido del banco se ha reducido.", "nuevo_monto": nuevo_monto}

@app.get("/savings-goals/{goal_id}/withdrawals")
def get_goal_withdrawals(goal_id: int):
    """Get all withdrawals for a specific savings goal."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(sql_param('''
        SELECT id, monto, motivo, categoria, banco, fecha, fecha_limite_reponer, repuesto, fecha_repuesto
        FROM savings_withdrawals WHERE goal_id = ? ORDER BY fecha DESC
    '''), (goal_id,))
    
    rows = fetchall_as_dict(cursor)
    conn.close()
    
    # Convert repuesto to boolean for consistency
    for row in rows:
        row['repuesto'] = bool(row['repuesto'])
    
    return rows

@app.get("/savings-withdrawals/pending")
def get_pending_withdrawals(environment: str = "PROD"):
    """Get all pending (not repaid) withdrawals across all goals."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(sql_param('''
        SELECT sw.id, sw.goal_id, sg.nombre as goal_nombre, sw.monto, sw.motivo, 
               sw.categoria, sw.banco, sw.fecha, sw.fecha_limite_reponer
        FROM savings_withdrawals sw
        JOIN savings_goals sg ON sw.goal_id = sg.id
        WHERE sg.environment = ? AND (sw.repuesto = ? OR sw.repuesto IS NULL)
        ORDER BY sw.fecha_limite_reponer ASC
    '''), (environment, False if USE_POSTGRES else 0))
    
    rows = fetchall_as_dict(cursor)
    conn.close()
    
    return rows

@app.put("/savings-withdrawals/{withdrawal_id}/repay")
def repay_withdrawal(withdrawal_id: int, monto: float = None):
    """Mark a withdrawal as repaid (adds contribution back to the goal and bank)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get withdrawal info including banco
    cursor.execute(sql_param('''
        SELECT id, goal_id, monto, repuesto, banco FROM savings_withdrawals WHERE id = ?
    '''), (withdrawal_id,))
    withdrawal = cursor.fetchone()
    
    if not withdrawal:
        conn.close()
        raise HTTPException(status_code=404, detail="Retiro no encontrado")
    
    goal_id = withdrawal[1] if USE_POSTGRES else withdrawal['goal_id']
    withdrawal_monto = withdrawal[2] if USE_POSTGRES else withdrawal['monto']
    repuesto = withdrawal[3] if USE_POSTGRES else withdrawal['repuesto']
    banco = withdrawal[4] if USE_POSTGRES else withdrawal['banco']
    
    if repuesto:
        conn.close()
        raise HTTPException(status_code=400, detail="Este retiro ya fue repuesto")
    
    fecha_hoy = datetime.now().strftime("%Y-%m-%d")
    
    # Mark as repaid
    cursor.execute(sql_param('''
        UPDATE savings_withdrawals SET repuesto = ?, fecha_repuesto = ? WHERE id = ?
    '''), (True if USE_POSTGRES else 1, fecha_hoy, withdrawal_id))
    
    # Add the amount back to the goal
    cursor.execute(sql_param('''
        UPDATE savings_goals SET monto_actual = monto_actual + ? WHERE id = ?
    '''), (withdrawal_monto, goal_id))
    
    # Create a POSITIVE contribution to restore the bank's committed amount
    if banco:
        cursor.execute(sql_param('''
            INSERT INTO savings_contributions (goal_id, monto, fecha, banco)
            VALUES (?, ?, ?, ?)
        '''), (goal_id, withdrawal_monto, fecha_hoy, banco))
    
    conn.commit()
    conn.close()
    
    return {"message": "Retiro repuesto. El saldo comprometido del banco ha sido restaurado."}

