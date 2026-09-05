import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.abspath(os.path.join(current_dir, "..", "backend"))

# Add api directory (so 'import app' finds api/app)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Add backend directory as fallback
if backend_path not in sys.path:
    sys.path.insert(1, backend_path)

from app.main import app

