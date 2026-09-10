"""
Single-command launcher for the Faculty Substitution & Duty Allocation System.
Runs both FastAPI backend (port 8000) and Vite frontend (port 3000).
"""
import subprocess
import sys
import os
import time

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("==================================================================")
    print("  FACULTY SUBSTITUTION & DUTY ALLOCATION SYSTEM")
    print("  The Apollo University")
    print("==================================================================")
    print("1. Starting FastAPI Backend on http://localhost:8000...")
    backend_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=backend_dir
    )

    time.sleep(2)

    print("2. Starting Vite React Frontend on http://localhost:3000...")
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=frontend_dir,
        shell=True
    )

    print("\n------------------------------------------------------------------")
    print("  System is running!")
    print("  • Frontend: http://localhost:3000")
    print("  • Backend API: http://localhost:8000/api/v1")
    print("  • Swagger Docs: http://localhost:8000/docs")
    print("------------------------------------------------------------------")
    print("Press Ctrl+C to terminate both servers.\n")

    try:
        backend_process.wait()
        frontend_process.wait()
    except KeyboardInterrupt:
        print("\nStopping services...")
        backend_process.terminate()
        frontend_process.terminate()

if __name__ == "__main__":
    main()
