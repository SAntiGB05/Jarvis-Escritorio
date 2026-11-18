"""
Paquete «Desarrollo» (plan de mejoras, puntos 5 y 6).

Nunca acepta rutas ni comandos dictados: el modelo elige el NOMBRE de un proyecto
del registro (data/proyectos.json) y el anfitrión decide la ruta y el comando.
Todos los subprocess van con lista de argumentos, cwd del registro y timeout.
"""
from __future__ import annotations

import json
import os
import re
import shlex
import signal
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "jarvis"))
import comun                                     # noqa: E402
import rutas                                     # noqa: E402

TIMEOUT_TESTS = 45      # el turno del cerebro dura como mucho 60 s


# ---------------------------------------------------------------------------
# registro de proyectos
# ---------------------------------------------------------------------------

def registro() -> dict[str, dict]:
    data = comun.leer_json(rutas.PROYECTOS, {})
    return {k: v for k, v in data.items() if isinstance(v, dict) and v.get("ruta")}


def resolver_proyecto(nombre: str) -> tuple[str, Path] | None:
    reg = registro()
    clave = comun.mejor_coincidencia(nombre, reg.keys())
    if clave is None:
        return None
    ruta = Path(reg[clave]["ruta"]).expanduser().resolve()
    return (clave, ruta) if ruta.is_dir() else None


def _comando(clave: str, tipo: str) -> list[str] | None:
    cmd = registro().get(clave, {}).get(tipo)
    return [str(x) for x in cmd] if isinstance(cmd, list) and cmd else None


def _no_registrado(nombre: str) -> tuple[bool, str]:
    nombres = ", ".join(registro()) or "ninguno todavía (se añaden en Ajustes → Proyectos)"
    return False, f"No tengo registrado el proyecto «{nombre}». Registrados: {nombres}."


def listar_proyectos(args: dict) -> tuple[bool, str]:
    reg = registro()
    if not reg:
        return True, "No hay proyectos registrados. Se añaden en Ajustes → Proyectos."
    return True, "Proyectos registrados: " + ", ".join(reg) + "."


# ---------------------------------------------------------------------------
# Terminal (Claude Code, servidor de desarrollo)
# ---------------------------------------------------------------------------

SCRIPT_TERMINAL = """on run argv
  tell application "Terminal"
    activate
    do script ("cd " & quoted form of item 1 of argv & " && " & item 2 of argv)
  end tell
end run"""


def _abrir_terminal(ruta: Path, comando_shell: str) -> tuple[bool, str]:
    """`comando_shell` lo construye SIEMPRE el anfitrión con shlex (nunca texto libre)."""
    try:
        r = subprocess.run(["osascript", "-e", SCRIPT_TERMINAL, str(ruta), comando_shell],
                           capture_output=True, text=True, timeout=15)
    except subprocess.TimeoutExpired:
        return False, "Terminal tardó demasiado en responder."
    if r.returncode != 0:
        if "-1743" in r.stderr:
            return False, "Falta el permiso de Automatización para Terminal (Ajustes → Sistema)."
        return False, "No pude abrir la terminal."
    return True, ""


def delegar_a_claude_code(args: dict) -> tuple[bool, str]:
    nombre = str(args.get("proyecto", ""))
    p = resolver_proyecto(nombre)
    if p is None:
        return _no_registrado(nombre)
    clave, ruta = p
    tarea = re.sub(r"[\x00-\x08\x0b-\x1f]", " ", str(args.get("tarea", ""))).strip()[:2000]
    if not tarea:
        return False, "Necesito saber qué tarea le paso a Claude Code."
    claude = comun.which("claude") or "claude"
    ok, err = _abrir_terminal(ruta, shlex.join([claude, tarea]))
    if not ok:
        return False, err
    return True, f"Abrí Claude Code en {clave}. Revisa los cambios en pantalla."


def iniciar_proyecto(args: dict) -> tuple[bool, str]:
    nombre = str(args.get("proyecto", ""))
    p = resolver_proyecto(nombre)
    if p is None:
        return _no_registrado(nombre)
    clave, ruta = p
    cmd = _comando(clave, "dev")
    if not cmd:
        return False, f"{clave} no tiene comando «dev» en el registro."
    ok, err = _abrir_terminal(ruta, shlex.join(cmd))
    return (True, f"Levanté {clave} en Terminal. Ciérralo tú cuando acabes.") if ok else (False, err)


# ---------------------------------------------------------------------------
# dependencias y tests
# ---------------------------------------------------------------------------

def auditar_dependencias(args: dict) -> tuple[bool, str]:
    nombre = str(args.get("proyecto", ""))
    p = resolver_proyecto(nombre)
    if p is None:
        return _no_registrado(nombre)
    _, ruta = p
    if (ruta / "package.json").exists():
        try:
            # npm audit no instala ni ejecuta scripts del proyecto.
            r = comun.ejecutar(["npm", "audit", "--json"], cwd=ruta, timeout=50)
        except FileNotFoundError:
            return False, "No encuentro npm en este Mac."
        except subprocess.TimeoutExpired:
            return False, "npm audit tardó demasiado."
        try:
            sev = json.loads(r.stdout or "{}").get("metadata", {}).get("vulnerabilities", {})
        except json.JSONDecodeError:
            return False, "No pude leer el resultado de npm audit."
        total = sum(int(sev.get(k, 0) or 0) for k in ("critical", "high", "moderate", "low"))
        if total == 0:
            return True, "Sin vulnerabilidades conocidas."
        return True, (f"{sev.get('critical', 0)} críticas, {sev.get('high', 0)} altas, "
                      f"{sev.get('moderate', 0)} moderadas y {sev.get('low', 0)} bajas.")
    if (ruta / "pom.xml").exists() or (ruta / "build.gradle").exists():
        return True, "Es un proyecto Java; puedo delegar la revisión a Claude Code."
    if (ruta / "pyproject.toml").exists() or (ruta / "requirements.txt").exists():
        return True, "Es un proyecto Python; puedo delegar la revisión a Claude Code."
    return False, "No reconozco el tipo de proyecto."


def _resumen_tests(salida: str) -> str | None:
    """Jest/Vitest (--reporter=json), pytest, Maven/Surefire, Go, cargo, mocha."""
    for linea in reversed(salida.splitlines()):
        linea = linea.strip()
        if linea.startswith("{") and "numPassedTests" in linea:
            try:
                d = json.loads(linea)
            except ValueError:
                continue
            fallan = [a.get("fullName") or a.get("title") for r in d.get("testResults", [])
                      for a in r.get("assertionResults", []) if a.get("status") == "failed"]
            txt = f"{d.get('numPassedTests', 0)} pasan, {d.get('numFailedTests', 0)} fallan"
            return txt + (": " + "; ".join(f for f in fallan[:3] if f) if fallan else "") + "."
    try:
        d = json.loads(salida)
        if isinstance(d, dict) and "numPassedTests" in d:
            return f"{d['numPassedTests']} pasan, {d.get('numFailedTests', 0)} fallan."
    except ValueError:
        pass
    m = re.findall(r"Tests run:\s*(\d+),\s*Failures:\s*(\d+),\s*Errors:\s*(\d+)", salida)
    if m:
        run, fail, err = (int(x) for x in m[-1])
        return f"{run - fail - err} pasan, {fail + err} fallan."
    pas = re.findall(r"(\d+)\s+(?:passed|passing|pasan)", salida)
    fal = re.findall(r"(\d+)\s+(?:failed|failing|fallan)", salida)
    if pas or fal:
        nombres = re.findall(r"^(?:FAILED|✗|×)\s+(.+)$", salida, re.M)[:3]
        txt = f"{pas[-1] if pas else 0} pasan, {fal[-1] if fal else 0} fallan"
        return txt + (": " + "; ".join(n.strip()[:80] for n in nombres) if nombres else "") + "."
    return None


def ejecutar_tests(args: dict) -> tuple[bool, str]:
    nombre = str(args.get("proyecto", ""))
    p = resolver_proyecto(nombre)
    if p is None:
        return _no_registrado(nombre)
    clave, ruta = p
    cmd = _comando(clave, "test")
    if not cmd:
        return False, f"{clave} no tiene comando «test» en el registro."
    if str(args.get("modo", "")).lower() == "terminal":
        ok, err = _abrir_terminal(ruta, shlex.join(cmd))
        return (True, f"Abrí los tests de {clave} en Terminal.") if ok else (False, err)
    try:
        r = comun.ejecutar(cmd, cwd=ruta, timeout=TIMEOUT_TESTS, env=comun.entorno_hijo(CI="1"))
    except FileNotFoundError:
        return False, f"No encuentro {cmd[0]} en este Mac."
    except subprocess.TimeoutExpired:
        return False, (f"Los tests de {clave} tardan más de {TIMEOUT_TESTS} segundos; "
                       "puedo abrirlos en Terminal (modo terminal).")
    resumen = _resumen_tests((r.stdout or "") + "\n" + (r.stderr or ""))
    if resumen:
        return True, resumen
    return (r.returncode == 0,
            "Todos los tests pasan." if r.returncode == 0 else
            f"Los tests fallaron (código {r.returncode}) y no pude leer el resumen.")


# ---------------------------------------------------------------------------
# puertos
# ---------------------------------------------------------------------------

def _puerto(args: dict) -> int | None:
    try:
        n = int(args.get("puerto"))
    except (TypeError, ValueError):
        return None
    return n if 1 <= n <= 65535 else None


def _escuchando(n: int) -> list[tuple[int, str]]:
    r = comun.ejecutar(["lsof", "-nP", f"-iTCP:{n}", "-sTCP:LISTEN", "-Fpc"], timeout=10)
    out, pid = [], None
    for linea in r.stdout.splitlines():
        if linea.startswith("p"):
            pid = int(linea[1:])
        elif linea.startswith("c") and pid is not None:
            out.append((pid, linea[1:]))
    return list(dict.fromkeys(out))


def puerto_en_uso(args: dict) -> tuple[bool, str]:
    n = _puerto(args)
    if n is None:
        return False, "Dime un puerto entre 1 y 65535."
    procs = _escuchando(n)
    if not procs:
        return True, f"Nada está escuchando en el puerto {n}."
    return True, "; ".join(f"{c} (PID {p})" for p, c in procs) + f" escucha en el puerto {n}."


def _protegidos() -> set[int]:
    """Jarvis (este proceso y sus antepasados) nunca se mata."""
    pids, pid = set(), os.getpid()
    for _ in range(12):
        pids.add(pid)
        try:
            pid = int(subprocess.run(["ps", "-o", "ppid=", "-p", str(pid)], capture_output=True,
                                     text=True, timeout=3).stdout.strip() or 0)
        except (ValueError, subprocess.SubprocessError):
            break
        if pid <= 1:
            break
    return pids


def liberar_puerto(args: dict) -> tuple[bool, str]:
    n = _puerto(args)
    if n is None:
        return False, "Dime un puerto entre 1 y 65535."
    forzar = bool(args.get("forzar"))
    procs = _escuchando(n)
    if not procs:
        return True, f"El puerto {n} ya está libre."
    prot, hechos = _protegidos(), []
    for pid, cmd in procs:
        dueño = subprocess.run(["ps", "-o", "uid=,command=", "-p", str(pid)], capture_output=True,
                               text=True, timeout=3).stdout.strip()
        campos = dueño.split(maxsplit=1)
        uid = int(campos[0]) if campos and campos[0].isdigit() else None
        if pid < 100 or pid in prot or uid != os.getuid() or "Jarvis.app" in dueño \
                or str(rutas.RAIZ) in dueño:
            return False, f"No toco {cmd} (PID {pid}): es del sistema, de otro usuario o del propio asistente."
        try:
            os.kill(pid, signal.SIGKILL if forzar else signal.SIGTERM)
            hechos.append(f"{cmd} (PID {pid})")
        except ProcessLookupError:
            continue
        except PermissionError:
            return False, f"No tengo permiso para cerrar {cmd}."
    return True, ("Forcé el cierre de " if forzar else "Pedí cerrar ") + ", ".join(hechos) + "."


# ---------------------------------------------------------------------------
# git
# ---------------------------------------------------------------------------

def _git(ruta: Path, *args: str, timeout: float = 30) -> subprocess.CompletedProcess:
    # Sin hooks del repositorio ni preguntas interactivas.
    return comun.ejecutar(["git", "-c", "core.hooksPath=/dev/null", "-C", str(ruta), *args],
                          timeout=timeout, env=comun.entorno_hijo(GIT_TERMINAL_PROMPT="0",
                                                                  GIT_ASKPASS="/usr/bin/false"))


def git_estado(args: dict) -> tuple[bool, str]:
    reg = registro()
    if not reg:
        return True, "No hay proyectos registrados."
    partes = []
    for clave, info in reg.items():
        ruta = Path(info["ruta"]).expanduser()
        if not (ruta / ".git").exists():
            continue
        try:
            r = _git(ruta, "status", "--porcelain=v1", "--branch", timeout=10)
        except (subprocess.SubprocessError, FileNotFoundError):
            continue
        lineas = r.stdout.splitlines()
        rama = lineas[0][3:].split("...")[0] if lineas and lineas[0].startswith("##") else "?"
        cambios = len([l for l in lineas if not l.startswith("##")])
        partes.append(f"{clave} en {rama}: " + (f"{cambios} archivos con cambios" if cambios else "limpio"))
    return True, ("; ".join(partes) + ".") if partes else "Ningún proyecto del registro usa git."


def git_pull(args: dict) -> tuple[bool, str]:
    nombre = str(args.get("proyecto", ""))
    p = resolver_proyecto(nombre)
    if p is None:
        return _no_registrado(nombre)
    clave, ruta = p
    try:
        r = _git(ruta, "pull", "--ff-only", timeout=40)
    except subprocess.TimeoutExpired:
        return False, "git pull tardó demasiado."
    if r.returncode != 0:
        err = (r.stderr or r.stdout).strip().splitlines()
        return False, f"git pull falló en {clave}: {(err[-1] if err else 'error')[:160]}"
    return True, f"{clave}: " + ("ya estaba al día." if "Already up to date" in r.stdout
                                  or "Ya está actualizado" in r.stdout else "actualizado con pull.")


_RAMA_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$")


def git_rama(args: dict) -> tuple[bool, str]:
    nombre = str(args.get("proyecto", ""))
    rama = str(args.get("nombre", "")).strip().replace(" ", "-")
    p = resolver_proyecto(nombre)
    if p is None:
        return _no_registrado(nombre)
    clave, ruta = p
    if not _RAMA_RE.match(rama) or ".." in rama or rama.endswith((".lock", "/", ".")):
        return False, "Ese nombre de rama no es válido."
    if _git(ruta, "check-ref-format", "--branch", rama, timeout=5).returncode != 0:
        return False, "Ese nombre de rama no es válido."
    r = _git(ruta, "switch", "-c", rama, timeout=15)
    if r.returncode != 0:
        return False, f"No pude crear la rama: {(r.stderr.strip().splitlines() or ['error'])[-1][:160]}"
    return True, f"Creé la rama {rama} en {clave} y me cambié a ella."


# ---------------------------------------------------------------------------
# sistema
# ---------------------------------------------------------------------------

def estado_sistema(args: dict) -> tuple[bool, str]:
    partes = []
    try:
        df = comun.ejecutar(["df", "-h", "/System/Volumes/Data"], timeout=5).stdout.splitlines()
        if len(df) > 1:
            c = df[1].split()
            partes.append(f"Disco: {c[3]} libres de {c[1]}")
    except Exception:
        pass
    try:
        b = comun.ejecutar(["pmset", "-g", "batt"], timeout=5).stdout
        m = re.search(r"(\d+)%;\s*([^;]+)", b)
        if m:
            partes.append(f"batería al {m.group(1)} % ({m.group(2).strip()})")
    except Exception:
        pass
    try:
        total = int(comun.ejecutar(["sysctl", "-n", "hw.memsize"], timeout=5).stdout.strip())
        vm = comun.ejecutar(["vm_stat"], timeout=5).stdout
        pag = int(re.search(r"page size of (\d+)", vm).group(1))
        libres = sum(int(re.search(rf"{k}:\s+(\d+)", vm).group(1))
                     for k in ("Pages free", "Pages inactive", "Pages speculative"))
        partes.append(f"memoria: {libres * pag / 2**30:.1f} GB disponibles de {total / 2**30:.0f} GB")
    except Exception:
        pass
    return (True, "; ".join(partes) + ".") if partes else (False, "No pude leer el estado del sistema.")


def brew_pendientes(args: dict) -> tuple[bool, str]:
    try:
        r = comun.ejecutar(["brew", "outdated", "--json=v2"], timeout=45,
                           env=comun.entorno_hijo(HOMEBREW_NO_AUTO_UPDATE="1"))
    except FileNotFoundError:
        return False, "Homebrew no está instalado."
    except subprocess.TimeoutExpired:
        return False, "brew tardó demasiado."
    try:
        d = json.loads(r.stdout or "{}")
    except ValueError:
        return False, "No pude leer la respuesta de brew."
    nombres = [f["name"] for f in d.get("formulae", [])] + [c["name"] for c in d.get("casks", [])]
    if not nombres:
        return True, "Todo está al día en Homebrew."
    return True, f"{len(nombres)} pendientes: " + ", ".join(nombres[:8]) + ("…" if len(nombres) > 8 else ".")


_P = {"proyecto": {"type": "string", "description": "Nombre del proyecto del registro"}}

TOOLS = {
    "listar_proyectos": (listar_proyectos, "Lista los proyectos de programación registrados.", {}, []),
    "auditar_dependencias": (auditar_dependencias, "Revisa las vulnerabilidades conocidas de las dependencias de un proyecto (npm audit, solo lectura).", _P, ["proyecto"]),
    "delegar_a_claude_code": (delegar_a_claude_code, "Abre Terminal en el proyecto con Claude Code y la tarea escrita. Úsala para TODO lo que modifique código: actualizar dependencias, refactorizar, corregir bugs. Pide confirmación física.",
                              {**_P, "tarea": {"type": "string", "description": "La tarea, clara y completa, para Claude Code"}}, ["proyecto", "tarea"]),
    "puerto_en_uso": (puerto_en_uso, "Dice qué proceso escucha en un puerto TCP.", {"puerto": {"type": "integer"}}, ["puerto"]),
    "liberar_puerto": (liberar_puerto, "Cierra el proceso que escucha en un puerto (SIGTERM; SIGKILL solo con forzar). Pide confirmación física.",
                       {"puerto": {"type": "integer"}, "forzar": {"type": "boolean", "description": "Solo si el usuario lo pide explícitamente"}}, ["puerto"]),
    "iniciar_proyecto": (iniciar_proyecto, "Abre Terminal y ejecuta el comando dev del proyecto (queda visible).", _P, ["proyecto"]),
    "ejecutar_tests": (ejecutar_tests, f"Ejecuta los tests del proyecto (máx. {TIMEOUT_TESTS} s) y resume cuántos pasan y fallan. modo=terminal los abre en Terminal.",
                       {**_P, "modo": {"type": "string", "enum": ["resumen", "terminal"]}}, ["proyecto"]),
    "git_estado": (git_estado, "Rama actual y cambios sin commit de cada proyecto del registro.", {}, []),
    "git_pull": (git_pull, "git pull --ff-only en un proyecto. Pide confirmación física.", _P, ["proyecto"]),
    "git_rama": (git_rama, "Crea una rama nueva en un proyecto y se cambia a ella. Pide confirmación física.",
                 {**_P, "nombre": {"type": "string", "description": "Nombre de la rama"}}, ["proyecto", "nombre"]),
    "estado_sistema": (estado_sistema, "Espacio en disco, batería y memoria del Mac.", {}, []),
    "brew_pendientes": (brew_pendientes, "Paquetes de Homebrew que tienen actualización.", {}, []),
}
