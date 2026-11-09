"""
limitar_busqueda.py — hook PreToolUse de Claude Code para la herramienta WebSearch.

El modelo NO decide a qué sitios busca: este script reescribe cada búsqueda
para que SOLO devuelva resultados de los dominios de sitios_permitidos.txt
(`allowed_domains`), y la bloquea si algo sale raro. Registra cada búsqueda en
data/busquedas.log para que puedas ver qué se buscó.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rutas                                     # noqa: E402


def dominios() -> list[str]:
    out = []
    for line in rutas.SITIOS.read_text().splitlines():
        rule = line.strip().lower()
        if not rule or rule.startswith("#"):
            continue
        if rule.startswith("*."):
            rule = rule[2:]               # "*.gov.co" -> "gov.co" (incluye subdominios)
        if "*" in rule:
            continue
        out.append(rule)
    return sorted(set(out))


def responder(decision: str, motivo: str, nuevo: dict | None = None) -> None:
    out = {"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                  "permissionDecision": decision,
                                  "permissionDecisionReason": motivo}}
    if nuevo is not None:
        out["hookSpecificOutput"]["updatedInput"] = nuevo
    print(json.dumps(out))
    sys.exit(0)


def main() -> None:
    try:
        ev = json.load(sys.stdin)
    except Exception:
        responder("deny", "entrada ilegible")
    if ev.get("tool_name") != "WebSearch":
        responder("deny", "solo se permite WebSearch")
    entrada = dict(ev.get("tool_input") or {})
    query = str(entrada.get("query", ""))[:300]
    permitidos = dominios()
    if not query or not permitidos:
        responder("deny", "búsqueda vacía o lista de sitios vacía")
    nuevo = {"query": query, "allowed_domains": permitidos}   # se descarta lo que pidiera el modelo
    try:
        rutas.DATA.mkdir(exist_ok=True)
        with open(rutas.DATA / "busquedas.log", "a") as f:
            f.write(f"{datetime.now():%Y-%m-%d %H:%M}  {query}\n")
    except OSError:
        pass
    responder("allow", "búsqueda limitada a sitios oficiales", nuevo)


if __name__ == "__main__":
    main()
