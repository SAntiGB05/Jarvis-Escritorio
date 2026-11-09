"""
control.py — la app Jarvis (lo que arranca Jarvis.app).

  * Icono en la barra de menús: abrir ajustes, detener/iniciar, reiniciar, salir.
  * Ventana de ajustes (React, en interfaz/ajustes/dist) con un puente a Python (`Api`).
  * El motor de voz (motor.py: esfera + oído + cerebro) como proceso hijo; si se
    cae, lo vuelve a lanzar.

Los ajustes viven donde siempre: `.env`, `sitios_permitidos.txt` y `data/`.
El motor lee el `.env` al arrancar (por eso «se aplica al reiniciar»);
`data/orb.json` y la lista de sitios se aplican al instante.

Ejecutar sin empaquetar:  .venv/bin/python jarvis/control.py
"""
from __future__ import annotations

import asyncio
import ctypes
import json
import logging
import os
import plistlib
import re
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rutas                                     # noqa: E402

ROOT = rutas.RAIZ
DATA = rutas.DATA
AVISOS = rutas.AVISOS
ENV_FILE = rutas.ENV
ENV_EXAMPLE = rutas.ENV_EJEMPLO
SITES_FILE = rutas.SITIOS
ORB_FILE = DATA / "orb.json"
UI_FILE = DATA / "ui.json"
PREVIEW_FILE = AVISOS / "vista_previa.json"
ACTIVITY_FILE = DATA / "actividad.jsonl"
SEARCHES_FILE = DATA / "busquedas.log"
STATUS_FILE = DATA / "estado.json"
USAGE_FILE = DATA / "usage.json"
LOG_FILE = Path.home() / "Library" / "Logs" / "jarvis.log"
LABEL = "com.jarvis.escritorio"
PLIST = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
AJUSTES_HTML = rutas.AJUSTES_HTML
VERSION = "1.0"

log = logging.getLogger("jarvis.app")

import webview                                   # noqa: E402


# ---------------------------------------------------------------------------
# .env  ⇄  valores de la interfaz
# ---------------------------------------------------------------------------

# clave de la interfaz → (clave del .env, valor por defecto)
ENV_MAP = {
    "assistantName": ("JARVIS_NAME", "Jarvis"),
    "wakeWord": ("JARVIS_WAKE_WORD", "Raphael"),
    "userName": ("USER_NAME", ""),
    "persona": ("JARVIS_PERSONA", "britanico"),
    "brain": ("JARVIS_BRAIN_MODEL", "haiku"),
    "voice": ("EDGE_VOICE", "es-CO-GonzaloNeural"),
    "rate": ("EDGE_RATE", "+5%"),
    "pitch": ("EDGE_PITCH", "-4Hz"),
    "whisper": ("JARVIS_WHISPER_MODEL", "small"),
    "lang": ("JARVIS_LANGUAGE", "es"),
    "sens": ("JARVIS_WAKE_SENS", "2.5"),
    "city": ("WEATHER_LOCATION_LABEL", "Armenia, Quindío"),
    "lat": ("WEATHER_LATITUDE", "4.5339"),
    "lon": ("WEATHER_LONGITUDE", "-75.6811"),
    "spId": ("SPOTIFY_CLIENT_ID", ""),
    "spSecret": ("SPOTIFY_CLIENT_SECRET", ""),
}
ELECCIONES = {
    "persona": {"britanico", "cercano", "formal"},
    "brain": {"haiku", "sonnet", "opus"},
    "whisper": {"tiny", "base", "small", "medium", "large-v3"},
    "lang": {"es", "en", "pt"},
}
_KEY_RE = re.compile(r"^\s*([A-Z0-9_]+)\s*=(.*)$")


def leer_env() -> dict[str, str]:
    out: dict[str, str] = {}
    try:
        lines = ENV_FILE.read_text().splitlines()
    except OSError:
        return out
    for line in lines:
        m = _KEY_RE.match(line)
        if m and not line.lstrip().startswith("#"):
            out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return out


def _num(texto: str, defecto: float) -> float:
    m = re.search(r"[-+]?\d+(?:\.\d+)?", texto or "")
    return float(m.group()) if m else defecto


def env_para_ui() -> dict:
    raw = leer_env()
    ui: dict = {}
    for k, (key, default) in ENV_MAP.items():
        ui[k] = raw.get(key, default)
    ui["rate"] = int(_num(ui["rate"], 5))
    ui["pitch"] = int(_num(ui["pitch"], -4))
    ui["sens"] = round(max(1.0, min(5.0, _num(str(ui["sens"]), 2.5))), 1)
    for k, ok in ELECCIONES.items():
        if ui[k] not in ok:
            ui[k] = ENV_MAP[k][1]
    return ui


def _limpio(v) -> str:
    return re.sub(r"[\r\n]+", " ", str(v)).strip()


def ui_a_env(ui: dict) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, (key, default) in ENV_MAP.items():
        if k not in ui:
            continue
        v = ui[k]
        if k == "rate":
            n = int(max(-50, min(50, _num(str(v), 5))))
            v = f"{n:+d}%"
        elif k == "pitch":
            n = int(max(-20, min(20, _num(str(v), -4))))
            v = f"{n:+d}Hz"
        elif k == "sens":
            v = f"{max(1.0, min(5.0, _num(str(v), 2.5))):.1f}"
        elif k in ELECCIONES and v not in ELECCIONES[k]:
            v = default
        elif k in ("lat", "lon"):
            try:
                float(v)
            except (TypeError, ValueError):
                raise ValueError(f"{'Latitud' if k == 'lat' else 'Longitud'} no válida: {v!r}")
        out[key] = _limpio(v)
    return out


def guardar_env(valores: dict[str, str]) -> None:
    """Cambia solo las claves dadas y conserva comentarios y orden."""
    if not ENV_FILE.exists() and ENV_EXAMPLE.exists():
        ENV_FILE.write_text(ENV_EXAMPLE.read_text())
    lines = ENV_FILE.read_text().splitlines() if ENV_FILE.exists() else []
    pendientes = dict(valores)
    for i, line in enumerate(lines):
        m = _KEY_RE.match(line)
        if m and not line.lstrip().startswith("#") and m.group(1) in pendientes:
            lines[i] = f"{m.group(1)}={pendientes.pop(m.group(1))}"
    if pendientes:
        if "# --- Ajustes de la app ---" not in lines:
            lines += ["", "# --- Ajustes de la app ---"]
        lines += [f"{k}={v}" for k, v in pendientes.items()]
    tmp = ENV_FILE.with_suffix(".tmp")
    tmp.write_text("\n".join(lines) + "\n")
    os.chmod(tmp, 0o600)                  # contiene el secreto de Spotify
    tmp.replace(ENV_FILE)


# ---------------------------------------------------------------------------
# orbe, tema y sitios permitidos
# ---------------------------------------------------------------------------

ORB_DEFAULTS = {"palette": "dorado", "size": 1.0, "count": 1600, "speed": 1.0, "glow": 1.0,
                "turb": 1.0, "corner": "tr", "sound": True, "dblclick": True, "drag": True}
ORB_LIMITS = {"size": (0.6, 1.4), "count": (400, 3000), "speed": (0.2, 2.5), "glow": (0.3, 1.6), "turb": (0, 2.5)}


def _leer_json(path: Path, defecto):
    try:
        data = json.loads(path.read_text())
        return data if isinstance(data, type(defecto)) else defecto
    except (OSError, ValueError):
        return defecto


def _escribir_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    tmp.replace(path)


def leer_orbe() -> dict:
    cfg = dict(ORB_DEFAULTS)
    data = _leer_json(ORB_FILE, {})
    cfg.update({k: data[k] for k in ORB_DEFAULTS if k in data})
    return cfg


def normalizar_orbe(o: dict) -> dict:
    cfg = leer_orbe()
    for k, v in (o or {}).items():
        if k not in ORB_DEFAULTS:
            continue
        if k in ORB_LIMITS:
            lo, hi = ORB_LIMITS[k]
            try:
                v = max(lo, min(hi, float(v)))
            except (TypeError, ValueError):
                continue
            v = int(round(v / 50) * 50) if k == "count" else round(v, 3)
        elif k == "palette":
            v = v if v in ("dorado", "azul", "esmeralda", "violeta", "plata") else "dorado"
        elif k == "corner":
            v = v if v in ("tl", "tr", "bl", "br") else "tr"
        else:
            v = bool(v)
        cfg[k] = v
    return cfg


_GRUPO_RE = re.compile(r"^#\s*-{2,}\s*(.+?)\s*-{2,}\s*$")
_DOMINIO_RE = re.compile(r"^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$")


def leer_sitios() -> list[dict]:
    grupos: list[dict] = []
    actual = None
    try:
        lines = SITES_FILE.read_text().splitlines()
    except OSError:
        lines = []
    for line in lines:
        t = line.strip()
        m = _GRUPO_RE.match(t)
        if m:
            actual = {"g": m.group(1), "items": []}
            grupos.append(actual)
            continue
        if not t or t.startswith("#"):
            continue
        if actual is None:
            actual = {"g": "Personalizados", "items": []}
            grupos.append(actual)
        actual["items"].append(t.lower())
    return grupos


def guardar_sitios(grupos: list[dict]) -> list[dict]:
    try:
        lines = SITES_FILE.read_text().splitlines()
    except OSError:
        lines = []
    cabecera = []
    for line in lines:                      # el comentario de arriba, hasta el primer grupo
        if _GRUPO_RE.match(line.strip()) or (line.strip() and not line.strip().startswith("#")):
            break
        cabecera.append(line)
    while cabecera and not cabecera[-1].strip():
        cabecera.pop()
    out, vistos = cabecera + [""], set()
    for g in grupos or []:
        nombre = _limpio(g.get("g", "Personalizados"))[:60] or "Personalizados"
        items = []
        for d in g.get("items", []):
            d = str(d).strip().lower()
            if _DOMINIO_RE.match(d) and (d.startswith("*.") or "." in d) and d not in vistos:
                vistos.add(d)
                items.append(d)
        if items:
            out += [f"# --- {nombre} ---"] + items + [""]
    SITES_FILE.write_text("\n".join(out).rstrip() + "\n")
    return leer_sitios()


# ---------------------------------------------------------------------------
# permisos de macOS
# ---------------------------------------------------------------------------

def permiso_microfono() -> str:
    try:
        import objc
        ns: dict = {}
        objc.loadBundle("AVFoundation", ns, bundle_path="/System/Library/Frameworks/AVFoundation.framework")
        st = int(ns["AVCaptureDevice"].authorizationStatusForMediaType_("soun"))
    except Exception as e:
        log.debug("permiso de micrófono: %s", e)
        return "unknown"
    return {0: "pending", 1: "denied", 2: "denied", 3: "granted"}.get(st, "unknown")


def pedir_microfono() -> None:
    try:
        import objc
        ns: dict = {}
        objc.loadBundle("AVFoundation", ns, bundle_path="/System/Library/Frameworks/AVFoundation.framework")
        ns["AVCaptureDevice"].requestAccessForMediaType_completionHandler_("soun", lambda ok: None)
    except Exception as e:
        log.debug("pedir micrófono: %s", e)


def permiso_accesibilidad(preguntar: bool = False) -> str:
    try:
        from ApplicationServices import AXIsProcessTrustedWithOptions, kAXTrustedCheckOptionPrompt
        return "granted" if AXIsProcessTrustedWithOptions({kAXTrustedCheckOptionPrompt: preguntar}) else "pending"
    except Exception:
        return "unknown"


class _AEDesc(ctypes.Structure):
    _fields_ = [("descriptorType", ctypes.c_uint32), ("dataHandle", ctypes.c_void_p)]


_CS = None


def _fourcc(s: str) -> int:
    return int.from_bytes(s.encode("ascii"), "big")


def _automatizar(bundle_id: str, preguntar: bool) -> int | None:
    """AEDeterminePermissionToAutomateTarget: 0 concedido, -1743 denegado,
    -1744 aún no se ha preguntado, -600 la app no está abierta."""
    global _CS
    try:
        if _CS is None:
            _CS = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/CoreServices.framework/CoreServices")
            _CS.AECreateDesc.argtypes = [ctypes.c_uint32, ctypes.c_void_p, ctypes.c_long, ctypes.POINTER(_AEDesc)]
            _CS.AECreateDesc.restype = ctypes.c_int16
            _CS.AEDeterminePermissionToAutomateTarget.argtypes = [ctypes.POINTER(_AEDesc), ctypes.c_uint32,
                                                                  ctypes.c_uint32, ctypes.c_ubyte]
            _CS.AEDeterminePermissionToAutomateTarget.restype = ctypes.c_int32
            _CS.AEDisposeDesc.argtypes = [ctypes.POINTER(_AEDesc)]
        desc = _AEDesc()
        data = bundle_id.encode()
        if _CS.AECreateDesc(_fourcc("bund"), data, len(data), ctypes.byref(desc)) != 0:
            return None
        try:
            return int(_CS.AEDeterminePermissionToAutomateTarget(
                ctypes.byref(desc), _fourcc("****"), _fourcc("****"), 1 if preguntar else 0))
        finally:
            _CS.AEDisposeDesc(ctypes.byref(desc))
    except Exception as e:
        log.debug("automatización %s: %s", bundle_id, e)
        return None


AUTOMATIZA = ["com.spotify.client", "com.apple.reminders", "com.apple.systemevents"]


def permiso_automatizacion(preguntar: bool = False) -> str:
    res = [_automatizar(b, preguntar) for b in AUTOMATIZA]
    if -1743 in res:
        return "denied"
    if -1744 in res:
        return "pending"
    if 0 in res:
        return "granted"
    return "unknown"                       # ninguna de esas apps está abierta ahora


PANELES = {"mic": "Privacy_Microphone", "acc": "Privacy_Accessibility", "auto": "Privacy_Automation"}


# ---------------------------------------------------------------------------
# actividad, búsquedas y uso
# ---------------------------------------------------------------------------

def _ultimas_lineas(path: Path, max_bytes: int = 600_000) -> list[str]:
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - max_bytes))
            data = f.read().decode("utf-8", errors="replace")
    except OSError:
        return []
    lines = data.splitlines()
    return lines[1:] if size > max_bytes else lines


def leer_actividad(limit: int = 40) -> dict:
    items = []
    for line in _ultimas_lineas(ACTIVITY_FILE):
        try:
            d = json.loads(line)
            items.append({"ts": float(d["ts"]), "you": str(d.get("tu", "")), "reply": str(d.get("respuesta", "")),
                          "tools": [str(t) for t in d.get("herramientas", [])], "ok": bool(d.get("ok", True))})
        except (ValueError, KeyError, TypeError):
            continue
    hoy = datetime.now().date()
    dias = [hoy - timedelta(days=13 - i) for i in range(14)]
    cuenta = {d: 0 for d in dias}
    for it in items:
        d = datetime.fromtimestamp(it["ts"]).date()
        if d in cuenta:
            cuenta[d] += 1
    return {"items": list(reversed(items))[:max(1, min(200, int(limit)))],
            "days": [{"day": d.day, "date": d.isoformat(), "count": cuenta[d]} for d in dias]}


def leer_busquedas(limit: int = 20) -> list[dict]:
    out = []
    for line in reversed(_ultimas_lineas(SEARCHES_FILE, 100_000)):
        m = re.match(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+(.*)$", line)
        if m:
            out.append({"when": m.group(1), "q": m.group(2).strip()})
        if len(out) >= limit:
            break
    return out


def leer_uso() -> list[dict]:
    data = _leer_json(USAGE_FILE, {})
    out = []
    for key, label in (("five_hour", "Últimas 5 h"), ("seven_day", "Últimos 7 días")):
        w = (data.get("windows") or {}).get(key) or {}
        pct = w.get("utilization")
        out.append({"key": key, "label": label,
                    "pct": float(pct) if isinstance(pct, (int, float)) else None,
                    "resetsAt": w.get("resets_at"), "status": w.get("status")})
    return out


# ---------------------------------------------------------------------------
# el motor (motor.py) como proceso hijo
# ---------------------------------------------------------------------------

def _rotar_log() -> None:
    try:
        if LOG_FILE.exists() and LOG_FILE.stat().st_size > 5_000_000:
            LOG_FILE.replace(LOG_FILE.with_suffix(".log.1"))
    except OSError:
        pass


def _pid_vivo(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (OSError, TypeError):
        return False


class Motor:
    def __init__(self):
        self.proc: subprocess.Popen | None = None
        self.desde: float | None = None
        self.deseado = True                   # el usuario lo quiere en marcha
        self.reiniciando = False
        self._fallos: list[float] = []
        self._lock = threading.Lock()

    def _matar_huerfano(self) -> None:
        """Un motor de una sesión anterior de la app que siguió vivo."""
        pid = _leer_json(STATUS_FILE, {}).get("pid")
        if not isinstance(pid, int) or not _pid_vivo(pid) or (self.proc and self.proc.pid == pid):
            return
        try:
            cmd = subprocess.run(["ps", "-p", str(pid), "-o", "command="], capture_output=True,
                                 text=True, timeout=3).stdout
        except Exception:
            return
        if str(rutas.MOTOR) in cmd:
            log.info("cerrando un motor anterior (pid %s)", pid)
            os.kill(pid, signal.SIGTERM)
            for _ in range(30):
                if not _pid_vivo(pid):
                    break
                time.sleep(0.1)

    def iniciar(self) -> None:
        with self._lock:
            self.deseado = True
            if self.proc and self.proc.poll() is None:
                return
            self._matar_huerfano()
            env = dict(os.environ)
            env["JARVIS_SUPERVISADO"] = "1"
            log_f = open(LOG_FILE, "a")
            self.proc = subprocess.Popen([sys.executable, str(rutas.MOTOR)], cwd=str(ROOT), env=env,
                                         stdout=log_f, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
            log_f.close()
            self.desde = time.time()
            log.info("motor en marcha (pid %s)", self.proc.pid)

    def detener(self, deseado: bool = False) -> None:
        with self._lock:
            self.deseado = deseado
            p, self.proc = self.proc, None
            self.desde = None
        if p and p.poll() is None:
            p.terminate()
            try:
                p.wait(timeout=6)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait(timeout=3)
            log.info("motor detenido")

    def reiniciar(self) -> None:
        self.reiniciando = True
        try:
            self.detener(deseado=True)
            self.iniciar()
        finally:
            self.reiniciando = False

    def en_marcha(self) -> bool:
        return bool(self.proc and self.proc.poll() is None)

    def vigilar(self) -> None:
        """Lo relanza si se cae (máx. 5 veces en 2 minutos, luego espera)."""
        if not self.deseado or self.reiniciando or self.proc is None or self.proc.poll() is None:
            return
        code = self.proc.returncode
        ahora = time.time()
        self._fallos = [t for t in self._fallos if ahora - t < 120]
        if len(self._fallos) >= 5:
            return
        self._fallos.append(ahora)
        log.warning("el motor terminó (código %s); lo vuelvo a lanzar", code)
        self.proc = None
        time.sleep(2)
        self.iniciar()


# ---------------------------------------------------------------------------
# arranque automático (LaunchAgent)
# ---------------------------------------------------------------------------

def _ejecutable_app() -> list[str]:
    exe = Path(sys.executable)
    if ".app/Contents/MacOS/" in str(exe):
        return [str(exe)]                        # Jarvis.app: el propio ejecutable
    return [str(exe), str(rutas.CONTROL)]


def autoarranque_activo() -> bool:
    return PLIST.exists()


def poner_autoarranque(on: bool) -> bool:
    if not on:
        PLIST.unlink(missing_ok=True)
        return False
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    plist = {
        "Label": LABEL,
        "ProgramArguments": _ejecutable_app(),
        "WorkingDirectory": str(ROOT),
        "RunAtLoad": True,
        "KeepAlive": {"SuccessfulExit": False},   # solo si se cae; «Salir» no lo relanza
        "ThrottleInterval": 15,
        "ProcessType": "Interactive",
        "EnvironmentVariables": {"PATH": _path_con_claude()},
    }
    with open(PLIST, "wb") as f:
        plistlib.dump(plist, f)
    return True


def _path_con_claude() -> str:
    extra = [str(Path.home() / ".local" / "bin"), "/opt/homebrew/bin", "/usr/local/bin"]
    actual = os.environ.get("PATH", "/usr/bin:/bin:/usr/sbin:/sbin").split(":")
    return ":".join(dict.fromkeys(extra + actual))


# ---------------------------------------------------------------------------
# prueba de micrófono (independiente del motor)
# ---------------------------------------------------------------------------

class PruebaMic:
    def __init__(self):
        self.stream = None
        self.level = 0.0
        self.noise = 300.0
        self._t = 0.0

    def iniciar(self) -> bool:
        if self.stream is not None:
            return True
        import numpy as np
        import sounddevice as sd

        def cb(indata, frames, t, status):
            rms = float(np.sqrt(np.mean(indata[:, 0].astype(np.float32) ** 2))) if len(indata) else 0.0
            self.level = rms
            # ruido de fondo como en oido.py: media lenta de lo que no es voz
            if rms < self.noise * 2.5:
                self.noise = 0.98 * self.noise + 0.02 * min(rms, 3000)
            self._t = time.time()
        try:
            self.stream = sd.InputStream(samplerate=16000, channels=1, dtype="int16", blocksize=1280, callback=cb)
            self.stream.start()
            return True
        except Exception as e:
            log.warning("prueba de micrófono: %s", e)
            self.stream = None
            return False

    def detener(self) -> None:
        s, self.stream = self.stream, None
        if s is not None:
            try:
                s.stop(); s.close()
            except Exception:
                pass


# ---------------------------------------------------------------------------
# puente con la ventana de ajustes (window.pywebview.api.*)
# ---------------------------------------------------------------------------

class Api:
    def __init__(self, app: "Aplicacion"):
        self._app = app
        self._mic = PruebaMic()
        self._voz_ocupada = threading.Lock()

    # ---- configuración ----
    def get_config(self) -> dict:
        return {"env": env_para_ui(), "orb": leer_orbe(), "sites": leer_sitios(),
                "theme": _leer_json(UI_FILE, {}).get("theme", "oscuro"), "version": VERSION}

    def save_env(self, ui: dict) -> dict:
        try:
            guardar_env(ui_a_env(ui or {}))
        except ValueError as e:
            return {"ok": False, "error": str(e)}
        self._app.actualizar_titulo()
        return {"ok": True, "env": env_para_ui()}

    def get_orb(self) -> dict:
        return leer_orbe()

    def save_orb(self, o: dict) -> dict:
        cfg = normalizar_orbe(o)
        _escribir_json(ORB_FILE, cfg)              # el motor lo aplica en vivo
        return cfg

    def save_theme(self, mode: str) -> str:
        mode = mode if mode in ("claro", "oscuro", "auto") else "oscuro"
        ui = _leer_json(UI_FILE, {})
        ui["theme"] = mode
        _escribir_json(UI_FILE, ui)
        self._app.apariencia(mode)
        return mode

    def get_sites(self) -> list:
        return leer_sitios()

    def save_sites(self, grupos: list) -> list:
        return guardar_sitios(grupos)

    def test_url(self, url: str) -> dict:
        import urllib.parse
        import acciones_mcp
        u = (url or "").strip()
        if not u:
            return {"state": "empty"}
        if "://" not in u:
            u = "https://" + u
        try:
            p = urllib.parse.urlparse(u)
            p.port
        except ValueError:
            return {"state": "invalid"}
        if not p.hostname:
            return {"state": "invalid"}
        if p.scheme != "https":
            return {"state": "https"}
        rule = acciones_mcp.regla_coincidente(u)
        return {"state": "ok", "rule": rule, "host": p.hostname} if rule else {"state": "blocked", "host": p.hostname}

    # ---- estado (la ventana lo pide cada 5 s) ----
    def get_status(self) -> dict:
        m = self._app.motor
        st = _leer_json(STATUS_FILE, {})
        vivo = m.en_marcha()
        if vivo and st.get("pid") != m.proc.pid:
            st = {}                                # aún no ha escrito su estado
        return {
            "service": {"running": vivo, "restarting": m.reiniciando, "since": m.desde,
                        "autostart": autoarranque_activo(), "brain": st.get("cerebro") if vivo else None,
                        "model": st.get("modelo"), "error": st.get("error") if vivo else None},
            # El motor sabe si de verdad le llega audio (CoreAudio no siempre
            # pasa por el estado de AVFoundation): eso manda cuando lo hay.
            "perms": {"mic": "granted" if (vivo and st.get("microfono") is True) else
                      ("denied" if vivo and st.get("microfono") is False else permiso_microfono()),
                      "acc": permiso_accesibilidad(), "auto": permiso_automatizacion()},
            "usage": leer_uso(),
            "last": (leer_actividad(1)["items"] or [None])[0],
        }

    def get_activity(self, limit: int = 40) -> dict:
        return leer_actividad(limit)

    def get_searches(self) -> list:
        return leer_busquedas()

    # ---- servicio ----
    def start(self) -> bool:
        threading.Thread(target=self._app.motor.iniciar, daemon=True).start()
        return True

    def stop(self) -> bool:
        self._app.motor.detener()
        self._app.actualizar_menu()
        return True

    def restart(self) -> bool:
        self._app.motor.reiniciar()
        self._app.actualizar_menu()
        return True

    def set_autostart(self, on: bool) -> bool:
        return poner_autoarranque(bool(on))

    def open_log(self) -> bool:
        LOG_FILE.touch(exist_ok=True)
        subprocess.Popen(["open", "-a", "Console", str(LOG_FILE)])
        return True

    def open_privacy_pane(self, name: str) -> bool:
        def run():
            if name == "mic" and permiso_microfono() == "pending":
                pedir_microfono()                     # sale el diálogo de macOS
                return
            if name == "acc":
                permiso_accesibilidad(preguntar=True)  # añade Jarvis a la lista
            if name == "auto":
                for b in AUTOMATIZA:                   # pide permiso a las apps abiertas
                    _automatizar(b, preguntar=True)
            subprocess.Popen(["open", f"x-apple.systempreferences:com.apple.preference.security?{PANELES.get(name, '')}"])
        threading.Thread(target=run, daemon=True).start()
        return True

    # ---- vista previa en la esfera real ----
    def preview_orb(self, state: str | None) -> bool:
        if state:
            _escribir_json(PREVIEW_FILE, {"state": str(state), "until": time.time() + 2.5})
        else:
            PREVIEW_FILE.unlink(missing_ok=True)
        return True

    # ---- voz ----
    def test_voice(self, voice: str, rate, pitch) -> dict:
        if not self._voz_ocupada.acquire(blocking=False):
            return {"ok": False, "error": "ocupada"}
        try:
            import voz
            env = env_para_ui()
            nombre = env.get("assistantName") or "Jarvis"
            texto = f"Hola, soy {nombre}. Así sonará mi voz cuando te responda."
            r = int(max(-50, min(50, _num(str(rate), 5))))
            p = int(max(-20, min(20, _num(str(pitch), -4))))
            mp3 = asyncio.run(voz.synth_mp3(texto, voice=str(voice), rate=f"{r:+d}%", pitch=f"{p:+d}Hz"))
            if not mp3:
                return {"ok": False, "error": "No pude generar la voz (¿hay internet?)."}
            self.preview_orb("speaking")
            fin = threading.Event()

            def mantener():
                while not fin.wait(1.0):
                    self.preview_orb("speaking")
            threading.Thread(target=mantener, daemon=True).start()
            try:
                voz.play(mp3)
            finally:
                fin.set()
                self.preview_orb(None)
            return {"ok": True}
        except Exception as e:
            log.exception("probar voz")
            return {"ok": False, "error": str(e)}
        finally:
            self._voz_ocupada.release()

    # ---- micrófono ----
    def mic_start(self) -> bool:
        return self._mic.iniciar()

    def mic_level(self) -> dict:
        return {"level": self._mic.level, "noise": self._mic.noise, "live": self._mic.stream is not None}

    def mic_stop(self) -> bool:
        self._mic.detener()
        return True

    def close_window(self) -> bool:
        self._app.ocultar_ajustes()
        return True


# ---------------------------------------------------------------------------
# la aplicación: barra de menús + ventana de ajustes
# ---------------------------------------------------------------------------

def _main(fn):
    try:
        from PyObjCTools import AppHelper
        AppHelper.callAfter(fn)
    except Exception:
        fn()


class Aplicacion:
    def __init__(self):
        self.motor = Motor()
        self.api = Api(self)
        self.saliendo = False
        self.visible = False
        self._status = None
        self._menu_target = None
        nombre = env_para_ui()["assistantName"]
        self.win = webview.create_window(
            f"{nombre} — Ajustes", url=str(AJUSTES_HTML), js_api=self.api,
            width=1180, height=780, min_size=(900, 620), resizable=True,
            hidden=True, background_color="#15120F", text_select=False)
        self.win.events.closing += self._al_cerrar
        self.win.events.loaded += self._preparar_ventana

    # ---- ventana ----
    def _al_cerrar(self):
        if self.saliendo:
            return True
        _main(self.ocultar_ajustes)
        return False                                  # cerrar = esconder

    def _preparar_ventana(self):
        def aplicar():
            try:
                import AppKit
                w = self.win.native
                # La cabecera del diseño (44 px) va debajo de una barra de título
                # transparente: solo quedan los semáforos nativos.
                w.setStyleMask_(w.styleMask() | AppKit.NSWindowStyleMaskFullSizeContentView)
                w.setTitlebarAppearsTransparent_(True)
                w.setTitleVisibility_(AppKit.NSWindowTitleHidden)
                try:
                    w.setTitlebarSeparatorStyle_(1)    # NSTitlebarSeparatorStyleNone
                except Exception:
                    pass
                # pywebview pinta el fondo de la barra de título; aquí debe ser transparente.
                cerrar = w.standardWindowButton_(AppKit.NSWindowCloseButton)
                barra = cerrar.superview().superview() if cerrar is not None else None
                pendientes = [barra] if barra is not None else []
                while pendientes:
                    v = pendientes.pop()
                    if v.isKindOfClass_(AppKit.NSVisualEffectView):
                        v.setHidden_(True)
                    elif v.respondsToSelector_("setBackgroundColor:") and not v.isKindOfClass_(AppKit.NSButton):
                        v.setBackgroundColor_(AppKit.NSColor.clearColor())
                    pendientes.extend(v.subviews() or [])
            except Exception as e:
                log.warning("no pude ajustar la barra de título: %s", e)
            self.apariencia(_leer_json(UI_FILE, {}).get("theme", "oscuro"))
        _main(aplicar)

    def apariencia(self, mode: str) -> None:
        def aplicar():
            try:
                import AppKit
                name = {"claro": AppKit.NSAppearanceNameAqua, "oscuro": AppKit.NSAppearanceNameDarkAqua}.get(mode)
                ap = AppKit.NSAppearance.appearanceNamed_(name) if name else None
                self.win.native.setAppearance_(ap)
                self.win.native.setBackgroundColor_(
                    AppKit.NSColor.colorWithSRGBRed_green_blue_alpha_(0.965, 0.953, 0.933, 1) if mode == "claro"
                    else AppKit.NSColor.colorWithSRGBRed_green_blue_alpha_(0.082, 0.071, 0.059, 1))
            except Exception as e:
                log.debug("apariencia: %s", e)
        _main(aplicar)

    # OJO: show/hide/destroy/evaluate_js de pywebview esperan a eventos que
    # produce el hilo principal; llamadas DESDE él (menú, Apple Events) se
    # quedaban bloqueadas para siempre. Aquí solo AppKit nativo, sin esperas.
    # La página se refresca sola al recibir el foco.

    def mostrar_ajustes(self, *_):
        def aplicar():
            import AppKit
            app = AppKit.NSApplication.sharedApplication()
            w = self.win.native
            if w is None:
                return
            app.setActivationPolicy_(0)                    # icono en el Dock mientras está abierta
            if w.isMiniaturized():
                w.deminiaturize_(None)
            w.makeKeyAndOrderFront_(None)
            app.activateIgnoringOtherApps_(True)
            self.visible = True
        _main(aplicar)

    def ocultar_ajustes(self, *_):
        self.api.mic_stop()
        self.api.preview_orb(None)

        def aplicar():
            import AppKit
            if self.win.native is not None:
                self.win.native.orderOut_(None)
            AppKit.NSApplication.sharedApplication().setActivationPolicy_(1)   # sin Dock
        _main(aplicar)
        self.visible = False

    def actualizar_titulo(self):
        nombre = env_para_ui()["assistantName"]

        def aplicar():
            if self.win.native is not None:
                self.win.native.setTitle_(f"{nombre} — Ajustes")
        _main(aplicar)
        self.actualizar_menu()

    # ---- barra de menús ----
    def crear_menu(self):
        import AppKit
        from Foundation import NSObject
        app = self

        class Destino(NSObject):
            def abrir_(self, sender):
                app.mostrar_ajustes()

            def alternar_(self, sender):
                if app.motor.en_marcha():
                    threading.Thread(target=lambda: (app.motor.detener(), app.actualizar_menu()), daemon=True).start()
                else:
                    threading.Thread(target=lambda: (app.motor.iniciar(), app.actualizar_menu()), daemon=True).start()

            def reiniciar_(self, sender):
                threading.Thread(target=lambda: (app.motor.reiniciar(), app.actualizar_menu()), daemon=True).start()

            def salir_(self, sender):
                threading.Thread(target=app.salir, daemon=True).start()   # no congelar el menú

            def reabrir_conRespuesta_(self, event, reply):
                # Clic en el icono (Dock, Finder, Spotlight) con la app ya abierta.
                app.mostrar_ajustes()

        self._menu_target = Destino.alloc().init()
        # macOS no lanza otra copia si ya está abierta: manda «reabrir» (aevt/rapp).
        AppKit.NSAppleEventManager.sharedAppleEventManager().setEventHandler_andSelector_forEventClass_andEventID_(
            self._menu_target, "reabrir:conRespuesta:", _fourcc("aevt"), _fourcc("rapp"))
        bar = AppKit.NSStatusBar.systemStatusBar()
        self._status = bar.statusItemWithLength_(AppKit.NSVariableStatusItemLength)
        img = AppKit.NSImage.imageWithSystemSymbolName_accessibilityDescription_("circle.hexagongrid.circle", "Jarvis")
        if img is not None:
            img.setTemplate_(True)
            self._status.button().setImage_(img)
        else:
            self._status.button().setTitle_("◉")
        menu = AppKit.NSMenu.alloc().init()
        menu.setAutoenablesItems_(False)
        self._mi_estado = menu.addItemWithTitle_action_keyEquivalent_("", None, "")
        self._mi_estado.setEnabled_(False)
        menu.addItem_(AppKit.NSMenuItem.separatorItem())
        for title, sel, key in (("Abrir ajustes…", "abrir:", ","), ("", "alternar:", ""), ("Reiniciar", "reiniciar:", "")):
            it = menu.addItemWithTitle_action_keyEquivalent_(title, sel, key)
            it.setTarget_(self._menu_target)
            if sel == "alternar:":
                self._mi_alternar = it
        menu.addItem_(AppKit.NSMenuItem.separatorItem())
        it = menu.addItemWithTitle_action_keyEquivalent_("Salir", "salir:", "q")
        it.setTarget_(self._menu_target)
        self._mi_salir = it
        self._status.setMenu_(menu)
        self.actualizar_menu()

    def actualizar_menu(self):
        if self._status is None:
            return
        nombre = env_para_ui()["assistantName"]
        vivo = self.motor.en_marcha()

        def aplicar():
            self._mi_estado.setTitle_(f"{nombre} está en marcha" if vivo else f"{nombre} está detenido")
            self._mi_alternar.setTitle_(f"Detener {nombre}" if vivo else f"Iniciar {nombre}")
            self._mi_salir.setTitle_(f"Salir de {nombre}")
            self._status.button().setToolTip_(nombre)
        _main(aplicar)

    # ---- ciclo de vida ----
    def vigilar(self):
        ultimo_vivo = None
        while not self.saliendo:
            time.sleep(0.5)
            try:
                self.motor.vigilar()
                vivo = self.motor.en_marcha()
                if vivo != ultimo_vivo:
                    ultimo_vivo = vivo
                    self.actualizar_menu()
                aviso = AVISOS / "abrir_ajustes"
                if aviso.exists():
                    aviso.unlink(missing_ok=True)
                    self.mostrar_ajustes()
                if (AVISOS / "salir").exists():
                    (AVISOS / "salir").unlink(missing_ok=True)
                    self.salir()
            except Exception:
                log.exception("vigilancia")

    def salir(self):
        """Llamar fuera del hilo principal (detener el motor tarda unos segundos)."""
        if self.saliendo:
            return
        self.saliendo = True
        log.info("saliendo")
        self.api.mic_stop()
        self.api.preview_orb(None)
        self.motor.detener()
        logging.shutdown()
        os._exit(0)          # sin pasar por pywebview: su cierre puede esperar al hilo principal

    def arrancar(self, abrir: bool):
        def al_iniciar():
            try:
                import AppKit
                AppKit.NSApplication.sharedApplication().setActivationPolicy_(1)
            except Exception:
                pass
            _main(self.crear_menu)
            self.motor.iniciar()
            threading.Thread(target=self.vigilar, daemon=True).start()
            if abrir:
                time.sleep(0.8)
                self.mostrar_ajustes()
        try:
            webview.start(al_iniciar, private_mode=True)
        finally:
            self.saliendo = True
            self.motor.detener()


def _una_sola_instancia():
    import fcntl
    DATA.mkdir(exist_ok=True)
    lock = open(DATA / "control.lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        # Ya hay una app abierta: que muestre sus ajustes (abrir Jarvis.app otra vez).
        AVISOS.mkdir(parents=True, exist_ok=True)
        (AVISOS / "abrir_ajustes").write_text(str(time.time()))
        print("Jarvis ya está abierto; le pido que muestre los ajustes.")
        sys.exit(0)
    lock.write(str(os.getpid()))
    lock.flush()
    return lock


def main() -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    _rotar_log()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s: %(message)s", datefmt="%H:%M:%S",
                        handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()])
    AVISOS.mkdir(parents=True, exist_ok=True)
    _lock = _una_sola_instancia()   # noqa: F841
    (AVISOS / "salir").unlink(missing_ok=True)      # de un ./detener.sh con la app ya cerrada
    if not AJUSTES_HTML.exists():
        log.error("falta %s: ejecuta `npm run build` en interfaz/ajustes/", AJUSTES_HTML)
    os.environ["PATH"] = _path_con_claude()
    # Abierta a mano (Finder, Spotlight): enseña los ajustes. Al iniciar sesión, no.
    por_launchd = os.environ.get("XPC_SERVICE_NAME") == LABEL
    Aplicacion().arrancar(abrir=not por_launchd and "--sin-ventana" not in sys.argv)


if __name__ == "__main__":
    main()
