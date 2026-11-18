"""
fastpath.py — comandos frecuentes resueltos en el motor, sin pasar por Claude
(plan de mejoras, punto 10): respuesta en milisegundos y sin gastar cuota.

Solo reglas que coinciden CON SEGURIDAD y solo acciones de bajo riesgo (volumen,
Spotify, la hora, abrir una app conocida). Si nada coincide, devuelve None y la
petición va a Claude como siempre. Se desactiva con JARVIS_FASTPATH=0.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import acciones_mcp                              # noqa: E402

_NUM = {"cero": 0, "diez": 10, "veinte": 20, "treinta": 30, "cuarenta": 40, "cincuenta": 50,
        "sesenta": 60, "setenta": 70, "ochenta": 80, "noventa": 90, "cien": 100, "máximo": 100,
        "maximo": 100, "mínimo": 5, "minimo": 5}


def activo() -> bool:
    return os.getenv("JARVIS_FASTPATH", "1").strip() not in ("0", "false", "no")


def _limpio(texto: str) -> str:
    t = unicodedata.normalize("NFC", texto).lower().strip()
    t = re.sub(r"[¿?¡!.,;:«»\"]", " ", t)
    t = re.sub(r"\b(por favor|porfa|gracias)\b", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _volumen_actual() -> int | None:
    try:
        out = subprocess.run(["osascript", "-e", "output volume of (get volume settings)"],
                             capture_output=True, text=True, timeout=5).stdout.strip()
        return int(out)
    except (ValueError, subprocess.SubprocessError):
        return None


def intentar(texto: str) -> tuple[bool, str, str] | None:
    """(ok, respuesta para decir, herramienta usada) o None si no es un comando claro."""
    t = _limpio(texto)
    if not t or len(t) > 48:
        return None

    m = re.fullmatch(r"(?:pon|sube|baja|ajusta|deja)? ?(?:el )?volumen (?:al|a|en) (\d{1,3}|\w+)(?: %| por ciento)?", t)
    if m:
        raw = m.group(1)
        n = int(raw) if raw.isdigit() else _NUM.get(raw)
        if n is None:
            return None
        ok, msg = acciones_mcp.volumen({"nivel": n})
        return ok, msg, "volumen"
    m = re.fullmatch(r"(sube|baja)(?:le)? (?:el |un poco el )?volumen(?: un poco)?", t)
    if m:
        actual = _volumen_actual()
        if actual is None:
            return None
        n = max(0, min(100, actual + (15 if m.group(1) == "sube" else -15)))
        ok, msg = acciones_mcp.volumen({"nivel": n})
        return ok, msg, "volumen"

    spotify = {
        r"(?:pon )?pausa|pausa(?:r)? (?:la )?(?:música|musica|canción|cancion)|para la (?:música|musica)": "pausa",
        r"(?:la )?siguiente(?: canción| cancion)?|pasa(?: la)? canción|pasa(?: la)? cancion|otra canción|otra cancion": "siguiente",
        r"(?:la )?anterior(?: canción| cancion)?|canción anterior|cancion anterior": "anterior",
        r"reanuda(?:r)?(?: la música| la musica)?|continúa(?: la música)?|continua(?: la musica)?|sigue (?:la )?(?:música|musica)": "reanudar",
        r"qué (?:canción|cancion) (?:es esta|suena|está sonando)|que (?:cancion) (?:es esta|suena|esta sonando)": "que_suena",
    }
    for patron, accion in spotify.items():
        if re.fullmatch(patron, t):
            ok, msg = acciones_mcp.spotify_control({"accion": accion})
            return ok, msg, "spotify_control"

    if re.fullmatch(r"(?:qué|que) hora es|dime la hora|la hora", t):
        ahora = datetime.now()
        return True, f"Son las {ahora.hour}:{ahora.minute:02d}.", "fecha_hora"

    m = re.fullmatch(r"abre (?:la app |la aplicación |la aplicacion )?([\w' -]{2,28})", t)
    if m and " y " not in m.group(1) and "ajuste" not in m.group(1):
        nombre = m.group(1).strip()
        apps = acciones_mcp._installed_apps()
        key = acciones_mcp._norm(nombre)
        candidatos = [k for k in apps if k == key] or [k for k in apps if k.startswith(key) and len(key) >= 4]
        if len(candidatos) == 1:                 # solo si no hay ninguna duda
            ok, msg = acciones_mcp.abrir_app({"nombre": apps[candidatos[0]].stem})
            return ok, msg, "abrir_app"
    return None
