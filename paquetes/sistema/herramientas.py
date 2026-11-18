"""Paquete «Control del sistema» (punto 17)."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "jarvis"))
import comun                                     # noqa: E402


def brillo(args: dict) -> tuple[bool, str]:
    accion = comun.norm(str(args.get("accion", "")))
    try:
        pasos = max(1, min(16, int(args.get("pasos", 2))))
    except (TypeError, ValueError):
        pasos = 2
    codigo = {"subir": 144, "mas": 144, "bajar": 145, "menos": 145}.get(accion)
    if codigo is None:
        return False, "accion debe ser subir o bajar."
    script = ('on run argv\ntell application "System Events"\nrepeat (item 2 of argv as integer) times\n'
              'key code (item 1 of argv as integer)\ndelay 0.05\nend repeat\nend tell\nend run')
    ok, out = comun.osascript(script, str(codigo), str(pasos))
    return (True, "Brillo " + ("subido." if codigo == 144 else "bajado.")) if ok else (False, out)


def bloquear_pantalla(args: dict) -> tuple[bool, str]:
    r = subprocess.run(["pmset", "displaysleepnow"], capture_output=True, text=True, timeout=5)
    return (r.returncode == 0, "Pantalla bloqueada." if r.returncode == 0 else "No pude bloquearla.")


def bateria(args: dict) -> tuple[bool, str]:
    out = subprocess.run(["pmset", "-g", "batt"], capture_output=True, text=True, timeout=5).stdout
    m = re.search(r"(\d+)%;\s*([^;]+);\s*([^\n]*)", out)
    if not m:
        return True, "Este Mac no tiene batería o no pude leerla."
    resto = m.group(3).split(" present")[0].strip()
    resto = "" if resto.startswith("0:00") or "no estimate" in resto else resto.replace("remaining", "restantes")
    return True, f"Batería al {m.group(1)} %, {m.group(2).strip()}" + (f", {resto}" if resto else "") + "."


TOOLS = {
    "brillo": (brillo, "Sube o baja el brillo de la pantalla.",
               {"accion": {"type": "string", "enum": ["subir", "bajar"]}, "pasos": {"type": "integer", "minimum": 1, "maximum": 16}}, ["accion"]),
    "bloquear_pantalla": (bloquear_pantalla, "Apaga la pantalla y bloquea el Mac.", {}, []),
    "bateria": (bateria, "Nivel y estado de la batería.", {}, []),
}
