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
    ENV = os.getenv("FINANCE_ENV", "TEST").upper()
    DB_FILENAME = "finance_prod.db" if ENV == "PROD" else "finance_test.db"

config = GlobalConfig()

def update_db_path():
    config.DB_FILENAME = "finance_prod.db" if config.ENV == "PROD" else "finance_test.db"
    print(f"SWITCHED TO: {config.ENV} ({config.DB_FILENAME})")

DB_PATH = os.path.join(os.path.dirname(__file__), config.DB_FILENAME)

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

    
class ConfigUpdate(BaseModel):
    env: str

class ResetRequest(BaseModel):
    confirmation: str

@app.get("/config")
def get_config():
    return {"env": config.ENV, "db": config.DB_FILENAME}

@app.post("/config/switch")
def switch_env(update: ConfigUpdate):
    if update.env not in ["TEST", "PROD"]:
        raise HTTPException(status_code=400, detail="Invalid environment. Use TEST or PROD.")
    
    config.ENV = update.env
    update_db_path()
    
    # Ensure DB exists/init if switching to new one
    try:
        init_db()
    except:
        pass # Might fail if table already exists, init_db is safe
        
    return {"status": "ok", "env": config.ENV, "db": config.DB_FILENAME}

@app.post("/config/reset")
def reset_db_data(req: ResetRequest):
    if req.confirmation != "fiorestzin":
        raise HTTPException(status_code=403, detail="Frase de confirmación incorrecta.")
        
    conn = get_db_connection()
    cursor = conn.cursor()
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

@app.get("/")
def read_root():
    return {"message": "Finance API is running"}

@app.get("/transactions")
def get_transactions(
    limit: int = 100, 
    start_date: str = None, 
    end_date: str = None, 
    category: str = None, 
    bank: str = None,
    detalle: str = None,
    environment: str = "TEST"  # TEST (demo) or PROD (real)
):
    conn = get_db_connection()
    
    real_query = "SELECT * FROM transactions WHERE environment = ?"
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
        columns = ['id', 'fecha', 'tipo', 'categoria', 'detalle', 'banco', 'monto', 'ingreso', 'gasto', 'environment']
        return [dict(zip(columns, row)) for row in rows]
    return [dict(row) for row in rows]



@app.get("/summary/banks")
def get_bank_balances(environment: str = "TEST"):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = '''
        SELECT 
            banco, 
            SUM(ingreso) as total_ingreso, 
            SUM(gasto) as total_gasto,
            (SUM(ingreso) - SUM(gasto)) as saldo
        FROM transactions 
        WHERE environment = ? AND banco IS NOT NULL AND banco != 'None' AND banco != 'nan'
        GROUP BY banco
        ORDER BY saldo DESC
    '''
    cursor.execute(sql_param(query), [environment])
    rows = cursor.fetchall()
    conn.close()
    
    if USE_POSTGRES:
        return [{"banco": row[0], "total_ingreso": row[1], "total_gasto": row[2], "saldo": row[3]} for row in rows]
    return [dict(row) for row in rows]


@app.get("/reports")
def get_reports(start_date: str = None, end_date: str = None, environment: str = "TEST"):
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


    # 1. Category Breakdown (Pie Chart) - ONLY Expenses for now
    cat_query = f'''
        SELECT categoria as name, SUM(gasto) as value
        FROM transactions 
        WHERE {where_clause} AND gasto > 0
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

    # 2. Monthly History (Bar Chart)
    hist_query = f"SELECT fecha, ingreso, gasto FROM transactions WHERE {where_clause}"
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
def get_period_comparison(start_date: str, end_date: str):
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
        query = '''
            SELECT 
                COALESCE(SUM(ingreso), 0) as total_ingreso,
                COALESCE(SUM(gasto), 0) as total_gasto,
                COUNT(*) as num_transactions
            FROM transactions 
            WHERE fecha >= ? AND fecha <= ?
        '''
        cursor.execute(sql_param(query), (start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")))
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
def get_analysis(start_date: str = None, end_date: str = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    where_clause = "1=1"
    params = []
    if start_date:
        where_clause += " AND fecha >= ?"
        params.append(start_date)
    if end_date:
        where_clause += " AND fecha <= ?"
        params.append(end_date)
        
    # 1. Top 10 Specific Items (by Detalle)
    top_items_query = f'''
        SELECT detalle as name, SUM(gasto) as value 
        FROM transactions 
        WHERE {where_clause} AND gasto > 0
        GROUP BY detalle
        ORDER BY value DESC
        LIMIT 10
    '''
    cursor.execute(sql_param(top_items_query), params)
    top_rows = cursor.fetchall()
    
    # 2. Payment Methods / Bank Balances (net balance: ingreso - gasto)
    payment_methods_query = f'''
        SELECT banco as name, (SUM(ingreso) - SUM(gasto)) as value
        FROM transactions
        WHERE {where_clause} AND banco IS NOT NULL AND banco != 'None'
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
    filter_val: str = None
):
    conn = get_db_connection()
    
    # Validate column to prevent injection
    if filter_col not in ['detalle', 'categoria', 'banco']:
        raise HTTPException(status_code=400, detail="Invalid filter column")

    where_clause = "1=1"
    params = []
    
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
    monto: float
    environment: str = "TEST"  # TEST (demo) or PROD (real)

@app.post("/transaction")
def create_transaction(tx: Transaction):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    ingreso = 0
    gasto = 0
    
    if tx.tipo == 'Ingreso':
        ingreso = tx.monto
    else:
        gasto = tx.monto
        
    try:
        print(f"DEBUG INSERT: env={tx.environment}, {tx.fecha}, {tx.tipo}, {tx.categoria}")
        cursor.execute(sql_param('''
            INSERT INTO transactions (fecha, tipo, categoria, detalle, banco, ingreso, gasto, monto, environment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''), (tx.fecha, tx.tipo, tx.categoria, tx.detalle, tx.banco, ingreso, gasto, tx.monto, tx.environment))
        
        conn.commit()
        conn.close()
        return {"status": "ok", "message": "Transaction created"}

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
                monto REAL,
                ingreso REAL,
                gasto REAL
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS budgets (
                id SERIAL PRIMARY KEY,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                month TEXT NOT NULL,
                UNIQUE(category, month)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                tipo TEXT DEFAULT 'Gasto'
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS banks (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL UNIQUE
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                is_admin INTEGER DEFAULT 0
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
        
        cursor.execute('SELECT count(*) FROM users')
        if cursor.fetchone()[0] == 0:
            hashed_pwd = ph.hash("fiorestzin")
            cursor.execute('INSERT INTO users (username, hashed_password, is_admin) VALUES (%s, %s, %s)', 
                          ("admin", hashed_pwd, 1))
            print("Created default admin user: admin / fiorestzin")
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
                monto REAL,
                ingreso REAL,
                gasto REAL
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                month TEXT NOT NULL,
                UNIQUE(category, month)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                tipo TEXT DEFAULT 'Gasto'
            )
        ''')
        
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
                nombre TEXT NOT NULL UNIQUE
            )
        ''')
        
        cursor.execute('SELECT count(*) FROM banks')
        if cursor.fetchone()[0] == 0:
            default_banks = [('Santander',), ('Banco de Chile',), ('Efectivo',), ('Scotiabank',), ('Estado',), ('Falabella',)]
            cursor.executemany('INSERT INTO banks (nombre) VALUES (?)', default_banks)
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                is_admin INTEGER DEFAULT 0
            )
        ''')
        
        cursor.execute('SELECT count(*) FROM users')
        if cursor.fetchone()[0] == 0:
            hashed_pwd = ph.hash("fiorestzin")
            cursor.execute('INSERT INTO users (username, hashed_password, is_admin) VALUES (?, ?, ?)', 
                          ("admin", hashed_pwd, 1))
            print("Created default admin user: admin / fiorestzin")
    
    conn.commit()
    conn.close()


# Initialize on startup
init_db()

class Category(BaseModel):
    nombre: str
    tipo: str = 'Gasto'

@app.get("/categories")
def get_categories():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, tipo FROM categories ORDER BY nombre")
    rows = cursor.fetchall()
    conn.close()
    if USE_POSTGRES:
        return [{"id": row[0], "nombre": row[1], "tipo": row[2]} for row in rows]
    return [dict(row) for row in rows]

@app.post("/categories")
def create_category(cat: Category):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(sql_param("INSERT INTO categories (nombre, tipo) VALUES (?, ?)"), (cat.nombre, cat.tipo))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    conn.close()
    return {"status": "ok", "message": "Category created"}

@app.delete("/categories/{cat_id}")
def delete_category(cat_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("DELETE FROM categories WHERE id = ?"), (cat_id,))
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Category deleted"}



# --- Bank Management ---

class Bank(BaseModel):
    nombre: str

@app.get("/banks")
def get_banks():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre FROM banks ORDER BY nombre")
    rows = cursor.fetchall()
    conn.close()
    if USE_POSTGRES:
        return [{"id": row[0], "nombre": row[1]} for row in rows]
    return [dict(row) for row in rows]

@app.post("/banks")
def create_bank(bank: Bank):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(sql_param("INSERT INTO banks (nombre) VALUES (?)"), (bank.nombre,))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    conn.close()
    return {"status": "ok", "message": "Bank created"}

@app.delete("/banks/{bank_id}")
def delete_bank(bank_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("DELETE FROM banks WHERE id = ?"), (bank_id,))
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Bank deleted"}



# --- Budget Management ---

class Budget(BaseModel):
    category: str
    amount: float
    month: str # YYYY-MM

@app.get("/budgets")
def get_budgets(month: str = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT id, category, amount, month FROM budgets WHERE 1=1"
    params = []
    
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
            b = {"id": r[0], "category": r[1], "amount": r[2], "month": r[3]}
        else:
            b = dict(r)
        
        cat = b['category']
        m = b['month']
        
        # SQL to sum expenses - use LEFT() for PostgreSQL, strftime for SQLite
        if USE_POSTGRES:
            sum_query = '''
                SELECT COALESCE(SUM(gasto), 0) 
                FROM transactions 
                WHERE categoria = %s AND LEFT(fecha, 7) = %s
            '''
        else:
            sum_query = '''
                SELECT COALESCE(SUM(gasto), 0) 
                FROM transactions 
                WHERE categoria = ? AND strftime('%Y-%m', fecha) = ?
            '''
        cursor.execute(sum_query, (cat, m))
        spent = cursor.fetchone()[0] or 0
        b['spent'] = spent
        b['percentage'] = (spent / b['amount']) * 100 if b['amount'] > 0 else 0
        budgets_with_progress.append(b)
        
    conn.close()
    return budgets_with_progress

@app.post("/budgets")
def set_budget(budget: Budget):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # UPSERT: PostgreSQL uses ON CONFLICT, SQLite uses INSERT OR REPLACE
        if USE_POSTGRES:
            cursor.execute('''
                INSERT INTO budgets (category, amount, month)
                VALUES (%s, %s, %s)
                ON CONFLICT (category, month) DO UPDATE SET amount = EXCLUDED.amount
            ''', (budget.category, budget.amount, budget.month))
        else:
            cursor.execute('''
                INSERT OR REPLACE INTO budgets (category, amount, month)
                VALUES (?, ?, ?)
            ''', (budget.category, budget.amount, budget.month))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    
    conn.close()
    return {"status": "ok", "message": "Budget set successfully"}

@app.delete("/budgets/{budget_id}")
def delete_budget(budget_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_param("DELETE FROM budgets WHERE id = ?"), (budget_id,))
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Budget deleted"}


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
def get_subscriptions():
    conn = get_db_connection()
    
    # Logic: Look for transactions with same 'detalle' and roughly same 'amount' (within small margin)
    # recurring at least 3 times in different months? 
    # Or just simple grouping by Exact Detalle + Exact Amount for now.
    
    query = '''
        SELECT 
            detalle as name, 
            monto as amount, 
            COUNT(*) as frequency,
            MAX(fecha) as last_payment
        FROM transactions 
        WHERE gasto > 0
        GROUP BY detalle, monto
        HAVING frequency >= 3
        ORDER BY last_payment DESC
    '''
    
    rows = conn.execute(query).fetchall()
    conn.close()
    
    subs = []
    for r in rows:
        # Heuristic: If frequency is high, it's likely a sub.
        # We could also check if dates are roughly 30 days apart, but SQL group is easier first.
        subs.append({
            "name": r['name'],
            "amount": r['amount'],
            "frequency": r['frequency'],
            "last_payment": r['last_payment'],
            "annual_cost": r['amount'] * 12 # Estimate
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

