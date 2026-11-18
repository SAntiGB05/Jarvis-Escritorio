"""
politica.py — qué herramientas escriben, cuáles piden confirmación física y
cuáles traen contenido no confiable. Lo decide el ANFITRIÓN (este archivo, los
manifiestos de paquetes/ y data/paquetes.json), nunca el modelo.

Lo usan cerebro.py (para generar los matchers de los hooks) y
limitar_escritura.py (el hook que aplica las reglas en cada llamada).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comun                                     # noqa: E402

PREFIJO = "mcp__acciones__"

# Herramientas del núcleo (acciones_mcp.py), siempre disponibles.
BASE = {
    "escritura": ["crear_recordatorio", "cerrar_app", "programar_aviso"],
    "confirmacion": [],
    "no_confiables": ["leer_pagina", "buscar_wikipedia"],
}
# Las del propio Claude Code que traen texto de internet.
NO_CONFIABLES_CLI = {"WebSearch", "WebFetch"}


def politica(activos: list[str] | None = None) -> dict[str, set[str]]:
    """{"escritura", "confirmacion", "no_confiables"} con nombres cortos (sin prefijo).
    Toda herramienta que pide confirmación cuenta también como escritura."""
    activos = comun.paquetes_activos() if activos is None else activos
    todos = comun.manifiestos()
    out = {k: set(v) for k, v in BASE.items()}
    for pid in activos:
        m = todos.get(pid) or {}
        for k in out:
            out[k] |= set(m.get(k, []))
    out["escritura"] |= out["confirmacion"]
    return out


def nombre_corto(tool_name: str) -> str:
    return tool_name[len(PREFIJO):] if tool_name.startswith(PREFIJO) else tool_name


def es_no_confiable(tool_name: str, pol: dict[str, set[str]]) -> bool:
    return tool_name in NO_CONFIABLES_CLI or (
        tool_name.startswith(PREFIJO) and nombre_corto(tool_name) in pol["no_confiables"])
