import sys
from pathlib import Path

# Append services/ml directory to Python module search path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.main import app