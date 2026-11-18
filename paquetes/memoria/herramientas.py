"""Paquete «Memoria» (punto 13). data/memoria.json, inyectado en launch_prompt().
recordar es de escritura: el hook impide que una página web «envenene» la memoria."""
from __future__ import annotations

import os
import re
import time
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "jarvis"))
import comun                                     # noqa: E402
import rutas                                     # noqa: E402

MAX_RECUERDOS = 100
_SECRETO = re.compile(r"(contraseñ|password|clave|pin\b|tarjeta|cvv|\b\d{12,19}\b)", re.I)


def leer() -> list[dict]:
    return [m for m in comun.leer_json(rutas.MEMORIA, []) if isinstance(m, dict) and m.get("texto")]


def recordar(args: dict) -> tuple[bool, str]:
    dato = re.sub(r"\s+", " ", str(args.get("dato", ""))).strip()[:240]
    if not dato:
        return False, "¿Qué quieres que recuerde?"
    if _SECRETO.search(dato):
        return False, "Por seguridad no guardo contraseñas, claves ni números de tarjeta."
    memoria = leer()
    if any(comun.norm(m["texto"]) == comun.norm(dato) for m in memoria):
        return True, "Eso ya lo tenía apuntado."
    if len(memoria) >= MAX_RECUERDOS:
        return False, f"Tengo {MAX_RECUERDOS} recuerdos; borra alguno en Ajustes → Memoria."
    memoria.append({"id": os.urandom(5).hex(), "texto": dato, "ts": time.time()})
    comun.escribir_json(rutas.MEMORIA, memoria, privado=True)
    return True, "Lo recordaré."


TOOLS = {
    "recordar": (recordar, "Guarda un dato que el usuario pidió explícitamente recordar (frase corta, en tercera persona).",
                 {"dato": {"type": "string"}}, ["dato"]),
}
