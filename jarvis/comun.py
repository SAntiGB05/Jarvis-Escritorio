"""
comun.py — utilidades compartidas por acciones_mcp.py, los paquetes, el motor y la app.

Reglas que se cumplen aquí para que nadie tenga que acordarse:
  * subprocess SIEMPRE con lista de argumentos (nunca shell=True), con timeout
    y con el PATH ampliado (Homebrew, ~/.local/bin) que usa control.py.
  * AppleScript SIEMPRE con `argv`: el texto del usuario nunca se pega dentro
    del script.
  * Los archivos de data/avisos/ se crean solo para el usuario (0600, carpeta 0700).
"""
from __future__ import annotations

import difflib
import json
import os
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rutas                                     # noqa: E402


# ---------------------------------------------------------------------------
# texto
# ---------------------------------------------------------------------------

def norm(s: str) -> str:
    """«Api-Inventário» → «apiinventario» (para comparar nombres dichos en voz)."""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return "".join(ch for ch in s.lower() if ch.isalnum())


def mejor_coincidencia(nombre: str, claves) -> str | None:
    """La misma lógica difusa que abrir_app: exacta, empieza por, contiene, parecida."""
    claves = list(claves)
    por_norm = {norm(k): k for k in claves}
    key = norm(nombre)
    if not key:
        return None
    if key in por_norm:
        return por_norm[key]
    starts = [k for k in por_norm if k.startswith(key)]
    if starts:
        return por_norm[min(starts, key=len)]
    contains = [k for k in por_norm if key in k or (len(k) >= 4 and k in key)]
    if contains:
        return por_norm[min(contains, key=len)]
    close = difflib.get_close_matches(key, list(por_norm), n=1, cutoff=0.75)
    return por_norm[close[0]] if close else None


# ---------------------------------------------------------------------------
# procesos
# ---------------------------------------------------------------------------

def path_ampliado() -> str:
    extra = [str(Path.home() / ".local" / "bin"), "/opt/homebrew/bin", "/usr/local/bin",
             "/usr/bin", "/bin", "/usr/sbin", "/sbin"]
    actual = os.environ.get("PATH", "").split(":")
    return ":".join(dict.fromkeys([p for p in extra + actual if p]))


def which(cmd: str) -> str | None:
    return shutil.which(cmd, path=path_ampliado())


def entorno_hijo(**extra: str) -> dict[str, str]:
    """Entorno para los comandos que lanzan las herramientas: sin secretos de
    Jarvis ni variables que redirijan a Claude, y con el PATH ampliado."""
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(("ANTHROPIC_", "CLAUDE_CODE_", "SPOTIFY_", "PYTHON"))
           and k not in ("CLAUDECODE",)}
    env["PATH"] = path_ampliado()
    env.update(extra)
    return env


def ejecutar(args: list[str], cwd: str | Path | None = None, timeout: float = 30,
             env: dict | None = None) -> subprocess.CompletedProcess:
    """subprocess.run con lista, cwd, timeout y PATH ampliado. Lanza
    FileNotFoundError si el programa no existe y TimeoutExpired si tarda."""
    if not args or not isinstance(args, list):
        raise ValueError("comando vacío")
    exe = args[0] if "/" in args[0] else (which(args[0]) or args[0])
    return subprocess.run([exe, *args[1:]], cwd=str(cwd) if cwd else None, capture_output=True,
                          text=True, timeout=timeout, env=env or entorno_hijo(),
                          stdin=subprocess.DEVNULL)


def osascript(script: str, *args: str, timeout: float = 20) -> tuple[bool, str]:
    try:
        r = subprocess.run(["osascript", "-e", script, *[str(a) for a in args]],
                           capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return False, "La acción tardó demasiado."
    if r.returncode != 0:
        err = r.stderr.strip()
        if "-1743" in err or "not allowed" in err.lower():
            return False, ("macOS no me ha dado permiso para controlar esa app. "
                           "Ajustes del Sistema → Privacidad y seguridad → Automatización.")
        return False, err[:300] or "AppleScript falló."
    return True, r.stdout.strip()


# ---------------------------------------------------------------------------
# JSON en data/
# ---------------------------------------------------------------------------

def leer_json(path: Path, defecto):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return data if isinstance(data, type(defecto)) else defecto
    except (OSError, ValueError):
        return defecto


def escribir_json(path: Path, data, privado: bool = False) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    if privado:
        os.chmod(tmp, 0o600)
    tmp.replace(path)


def preparar_avisos() -> Path:
    """data/avisos/ solo para el usuario (otros usuarios del Mac no pueden escribir)."""
    rutas.AVISOS.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(rutas.AVISOS, 0o700)
    except OSError:
        pass
    return rutas.AVISOS


# ---------------------------------------------------------------------------
# paquetes de capacidad
# ---------------------------------------------------------------------------

def manifiestos() -> dict[str, dict]:
    """Todos los paquetes disponibles: {id: manifiesto}, en orden de carpeta."""
    out: dict[str, dict] = {}
    if not rutas.PAQUETES.is_dir():
        return out
    for d in sorted(rutas.PAQUETES.iterdir()):
        m = leer_json(d / "paquete.json", {}) if d.is_dir() else {}
        if m.get("id") == d.name:
            m.setdefault("herramientas", [])
            for k in ("escritura", "confirmacion", "no_confiables", "permisos_macos", "dominios"):
                m.setdefault(k, [])
            out[d.name] = m
    return out


def paquetes_activos() -> list[str]:
    """Los que el usuario activó en el panel; si nunca tocó nada, los marcados
    como `por_defecto` en su manifiesto."""
    todos = manifiestos()
    data = leer_json(rutas.PAQUETES_ACTIVOS, {})
    if isinstance(data.get("activos"), list):
        return [p for p in data["activos"] if p in todos]
    return [p for p, m in todos.items() if m.get("por_defecto")]


# ---------------------------------------------------------------------------
# Llavero de macOS (secretos fuera de .env y del entorno del cerebro)
# ---------------------------------------------------------------------------

LLAVERO_SERVICIO = "com.jarvis.escritorio"


def _sec():
    import Security                              # pyobjc-framework-Security
    return Security


def secreto_leer(cuenta: str) -> str:
    try:
        S = _sec()
        q = {S.kSecClass: S.kSecClassGenericPassword, S.kSecAttrService: LLAVERO_SERVICIO,
             S.kSecAttrAccount: cuenta, S.kSecReturnData: True, S.kSecMatchLimit: S.kSecMatchLimitOne}
        err, data = S.SecItemCopyMatching(q, None)
        if err == 0 and data is not None:
            return bytes(data).decode("utf-8")
    except Exception:
        pass
    return ""


def secreto_guardar(cuenta: str, valor: str) -> bool:
    """Guarda (o borra, si `valor` está vacío) un secreto en el Llavero."""
    try:
        S = _sec()
        base = {S.kSecClass: S.kSecClassGenericPassword, S.kSecAttrService: LLAVERO_SERVICIO,
                S.kSecAttrAccount: cuenta}
        S.SecItemDelete(base)
        if not valor:
            return True
        from Foundation import NSData
        raw = valor.encode("utf-8")
        item = dict(base)
        item[S.kSecValueData] = NSData.dataWithBytes_length_(raw, len(raw))
        item[S.kSecAttrLabel] = "Jarvis de escritorio"
        return S.SecItemAdd(item, None)[0] == 0
    except Exception:
        return False
