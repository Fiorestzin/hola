import os
import sys
import subprocess
import time

def print_header(title):
    print("\n" + "="*50)
    print(f"   {title}")
    print("="*50 + "\n")

def run_backend(env_mode):
    print_header(f"LAUNCHING BACKEND ({env_mode})")
    
    # Environment variables
    env = os.environ.copy()
    env["FINANCE_ENV"] = env_mode
    
    # Path to backend
    cwd = os.path.join(os.getcwd(), "app", "backend")
    
    print(f"Working Directory: {cwd}")
    print(f"API Port: 8000")
    print("Press CTRL+C to stop.\n")
    
    try:
        # Run Uvicorn
        cmd = ["uvicorn", "main:app", "--reload", "--port", "8000", "--host", "0.0.0.0"]
        subprocess.run(cmd, env=env, cwd=cwd)
    except KeyboardInterrupt:
        print("\n\nServer Stopped.")

def main():
    if len(sys.argv) < 2:
        print("Uso: python manage.py [test|prod]")
        print("  test -> Inicia con datos de prueba (finance_test.db)")
        print("  prod -> Inicia con datos reales (finance_prod.db)")
        # Default to TEST if no arg provided for safety
        print("\n No mode specified. Defaulting to TEST mode.")
        run_backend("TEST")
        return

    mode = sys.argv[1].upper()
    if mode not in ["TEST", "PROD"]:
        print("ERROR: Modo invalido. Usa 'test' o 'prod'.")
        return

    run_backend(mode)

if __name__ == "__main__":
    main()
