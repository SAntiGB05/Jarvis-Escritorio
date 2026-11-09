"""data_paths.py — dónde guarda `usage_store.py` el uso de Claude.

Versión reducida del módulo del proyecto original: aquí solo hace falta
`usage_path()`.
"""
from pathlib import Path

import rutas


def data_dir() -> Path:
    rutas.DATA.mkdir(parents=True, exist_ok=True)
    return rutas.DATA


def usage_path() -> Path:
    """La última observación de límites de uso del CLI (ver usage_store.py)."""
    return data_dir() / "usage.json"
