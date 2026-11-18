"""Paquete «Dictado a hoja de cálculo» (punto 17). AppleScript con argv."""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "jarvis"))
import comun                                     # noqa: E402


NUMBERS = '''on run argv
tell application "Numbers"
  if (count of documents) = 0 then error "No hay ninguna hoja abierta en Numbers."
  tell table 1 of active sheet of front document
    add row below last row
    set r to last row
    repeat with i from 1 to (count of argv)
      if i > (count of columns) then exit repeat
      set value of cell i of r to item i of argv
    end repeat
  end tell
end tell
end run'''

EXCEL = '''on run argv
tell application "Microsoft Excel"
  set ws to active sheet
  set ur to used range of ws
  set n to (first row index of ur) + (count of rows of ur)
  repeat with i from 1 to (count of argv)
    set value of cell i of row n of ws to item i of argv
  end repeat
end tell
end run'''


def agregar_fila(args: dict) -> tuple[bool, str]:
    valores = args.get("valores")
    if not isinstance(valores, list) or not valores:
        return False, "Faltan los valores de la fila."
    valores = [str(v).strip()[:200] for v in valores[:26]]
    app = comun.norm(str(args.get("app", "numbers")))
    ok, out = comun.osascript(EXCEL if app == "excel" else NUMBERS, *valores, timeout=20)
    return (True, f"Fila añadida con {len(valores)} valores.") if ok else (False, out)


TOOLS = {
    "agregar_fila": (agregar_fila, "Añade una fila al final de la tabla de la hoja abierta (Numbers por defecto o Excel).",
                     {"valores": {"type": "array", "items": {"type": "string"}},
                      "app": {"type": "string", "enum": ["numbers", "excel"]}}, ["valores"]),
}
