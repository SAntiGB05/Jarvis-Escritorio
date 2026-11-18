"""
limitar_escritura.py — hook PreToolUse de Claude Code para las herramientas que
escriben o actúan (plan de mejoras, puntos 2 y 3).

1. Turnos contaminados. Si desde el último mensaje del usuario entró contenido
   externo (WebSearch, leer_pagina, Wikipedia, portapapeles, pantalla, agenda…),
   ese turno NO puede escribir ni actuar. Lo decide este proceso, que controla
   el anfitrión: el modelo no se lo puede saltar.
2. Confirmación física. Las acciones de riesgo (delegar a Claude Code, liberar
   un puerto, git, crear eventos…) esperan un doble clic en la esfera. El hook
   escribe data/avisos/confirmar.json con un nonce aleatorio; el motor lo
   anuncia en voz alta, pone la esfera en ámbar y, con el doble clic, escribe
   data/avisos/confirmado-<nonce>. Sin eso en 20 s, se deniega.

Fallar es denegar: si algo no se puede comprobar, la herramienta no se ejecuta.
"""
from __future__ import annotations

import json
import os
import secrets
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comun                                     # noqa: E402
import politica                                  # noqa: E402
import rutas                                     # noqa: E402

ESPERA_CONFIRMACION = 20.0


def responder(decision: str, motivo: str) -> None:
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                             "permissionDecision": decision,
                                             "permissionDecisionReason": motivo}},
                     ensure_ascii=False))
    sys.exit(0)


# ---------------------------------------------------------------------------
# transcript
# ---------------------------------------------------------------------------

def _contenido(ev: dict):
    msg = ev.get("message")
    return msg.get("content") if isinstance(msg, dict) else None


def es_mensaje_de_usuario(ev: dict) -> bool:
    """Un mensaje escrito por la persona (no un resultado de herramienta)."""
    if ev.get("type") != "user" or ev.get("isMeta"):
        return False
    c = _contenido(ev)
    if isinstance(c, str):
        return bool(c.strip())
    if isinstance(c, list):
        tipos = {b.get("type") for b in c if isinstance(b, dict)}
        return "tool_result" not in tipos and bool(tipos & {"text", "image"})
    return False


def nombres_tool_use(ev: dict) -> set[str]:
    if ev.get("type") != "assistant":
        return set()
    c = _contenido(ev)
    return {str(b.get("name")) for b in c or []
            if isinstance(b, dict) and b.get("type") == "tool_use"} if isinstance(c, list) else set()


def herramientas_del_turno(transcript_path: str) -> set[str]:
    """Las herramientas usadas desde el último mensaje del usuario."""
    eventos = []
    with open(transcript_path, encoding="utf-8") as f:
        for linea in f:
            if linea.strip():
                try:
                    eventos.append(json.loads(linea))
                except ValueError:
                    continue
    usadas: set[str] = set()
    for ev in reversed(eventos):                 # desde el final hasta el último turno humano
        if es_mensaje_de_usuario(ev):
            return usadas
        usadas |= nombres_tool_use(ev)
    return usadas


# ---------------------------------------------------------------------------
# confirmación física
# ---------------------------------------------------------------------------

def resumen(nombre: str, args: dict) -> str:
    a = {k: str(v)[:120] for k, v in (args or {}).items()}
    plantillas = {
        "delegar_a_claude_code": "Voy a abrir Claude Code en {proyecto} para: {tarea}",
        "liberar_puerto": "Voy a cerrar el proceso que ocupa el puerto {puerto}",
        "git_pull": "Voy a hacer git pull en {proyecto}",
        "git_rama": "Voy a crear la rama {nombre} en {proyecto}",
        "crear_evento": "Voy a crear el evento {titulo} en tu calendario",
        "ejecutar_atajo": "Voy a ejecutar el atajo {nombre}",
        "bloquear_pantalla": "Voy a bloquear la pantalla",
    }
    try:
        texto = plantillas.get(nombre, "Voy a usar " + nombre.replace("_", " ")).format_map(
            {k: a.get(k, "") for k in ("proyecto", "tarea", "puerto", "nombre", "titulo")})
    except (KeyError, ValueError):
        texto = "Voy a usar " + nombre.replace("_", " ")
    return texto.strip().rstrip(".:") + "."


def confirmar_fisicamente(nombre: str, args: dict) -> bool:
    avisos = comun.preparar_avisos()
    nonce = secrets.token_hex(16)
    listo = avisos / f"confirmado-{nonce}"
    rechazo = avisos / f"rechazado-{nonce}"
    comun.escribir_json(rutas.CONFIRMAR, {"nonce": nonce, "herramienta": nombre,
                                          "resumen": resumen(nombre, args),
                                          "hasta": time.time() + ESPERA_CONFIRMACION}, privado=True)
    try:
        fin = time.monotonic() + ESPERA_CONFIRMACION
        while time.monotonic() < fin:
            if listo.exists():
                return True
            if rechazo.exists():
                return False
            time.sleep(0.15)
        return False
    finally:
        for p in (listo, rechazo):
            p.unlink(missing_ok=True)
        actual = comun.leer_json(rutas.CONFIRMAR, {})
        if actual.get("nonce") == nonce:
            rutas.CONFIRMAR.unlink(missing_ok=True)


# ---------------------------------------------------------------------------

def main() -> None:
    try:
        ev = json.load(sys.stdin)
    except Exception:
        responder("deny", "entrada ilegible")
    tool = str(ev.get("tool_name") or "")
    args = ev.get("tool_input") if isinstance(ev.get("tool_input"), dict) else {}
    nombre = politica.nombre_corto(tool)
    pol = politica.politica()
    escribe, confirma = nombre in pol["escritura"], nombre in pol["confirmacion"]

    # Atajos de Apple: el modo lo fija el usuario por atajo en el panel.
    if nombre == "ejecutar_atajo":
        permitidos = comun.leer_json(rutas.ATAJOS, {})
        clave = comun.mejor_coincidencia(str(args.get("nombre", "")), permitidos.keys())
        if clave is None:
            responder("deny", "Ese atajo no está en la lista de atajos permitidos.")
        modo = (permitidos.get(clave) or {}).get("modo", "escritura")
        escribe = confirma = modo != "lectura"

    if not escribe:
        responder("allow", "herramienta de solo lectura")

    ruta = ev.get("transcript_path")
    try:
        usadas = herramientas_del_turno(str(ruta)) if ruta and os.path.exists(str(ruta)) else None
    except OSError:
        usadas = None
    if usadas is None:
        responder("deny", "No pude comprobar este turno; repite la orden.")
    externas = sorted(t for t in usadas if politica.es_no_confiable(t, pol))
    if externas:
        responder("deny", "Este turno leyó contenido externo ("
                  + ", ".join(politica.nombre_corto(t) for t in externas)
                  + "). Por seguridad no actúo en el mismo turno: repite la orden y la ejecuto.")

    if confirma and not confirmar_fisicamente(nombre, args):
        responder("deny", "No hubo confirmación física (doble clic en la esfera), así que no lo hice.")
    responder("allow", "confirmado" if confirma else "turno limpio")


if __name__ == "__main__":
    main()
