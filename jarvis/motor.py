"""
motor.py — el motor de Jarvis: sin navegador, sin chat.

Una esfera pequeña aparece arriba a la derecha SOLO cuando dices "Raphael",
escucha tu petición, la ejecuta (apps, Spotify, recordatorios…), te responde
en voz alta y vuelve a esconderse. Doble clic en la esfera: la desactiva y
descarta lo que le pediste.

Lo lanza la app (control.py). A mano, sin la app:  .venv/bin/python jarvis/motor.py
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rutas                                     # noqa: E402

DATA = rutas.DATA
ORB_FILE = DATA / "orb.json"                     # lo escribe la ventana de ajustes
PREVIEW_FILE = rutas.AVISOS / "vista_previa.json"
ACTIVITY_FILE = DATA / "actividad.jsonl"
STATUS_FILE = DATA / "estado.json"
ORB_DEFAULTS = {"palette": "dorado", "size": 1.0, "count": 1600, "speed": 1.0, "glow": 1.0,
                "turb": 1.0, "corner": "tr", "sound": True, "dblclick": True, "drag": True}


def _load_env() -> None:
    env = rutas.ENV
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s: %(message)s",
                    datefmt="%H:%M:%S")
log = logging.getLogger("jarvis")

import webview                                   # noqa: E402

SIZE = 230
MARGIN = 14
NOMBRE = os.getenv("JARVIS_NAME", "").strip() or "Jarvis"
FOLLOW_UP_SEC = 6.0
BYE_RE = re.compile(
    r"\b(eso es todo|nada m[aá]s|adi[oó]s|chao|hasta luego|(ya )?(te puedes ir|puedes irte|vete)"
    r"|desaparece|esc[oó]ndete)\b"
    r"|\b(gracias|listo)\b[.!¡]*$", re.I)
DUCK_VOLUME = 20                                 # % de Spotify mientras Jarvis escucha
CHIME = "/System/Library/Sounds/Tink.aiff"


class _ApiEsfera:
    """Lo que el JavaScript de la esfera puede llamar (window.pywebview.api)."""

    def __init__(self, orbe: "Orbe"):
        self._orbe = orbe

    def doble_clic(self) -> None:
        self._orbe._doble_clic()


def leer_orbe() -> dict:
    cfg = dict(ORB_DEFAULTS)
    try:
        data = json.loads(ORB_FILE.read_text())
        if isinstance(data, dict):
            cfg.update({k: data[k] for k in ORB_DEFAULTS if k in data})
    except (OSError, ValueError):
        pass
    return cfg


def _posicion(corner: str, size: int) -> tuple[int, int]:
    """Esquina de la pantalla (coordenadas con origen arriba a la izquierda),
    respetando la barra de menús y el Dock."""
    try:
        from AppKit import NSScreen
        scr = NSScreen.mainScreen() or NSScreen.screens()[0]
        full, vis = scr.frame(), scr.visibleFrame()
        left, right = vis.origin.x, vis.origin.x + vis.size.width
        top = full.size.height - (vis.origin.y + vis.size.height)
        bottom = full.size.height - vis.origin.y
    except Exception:
        screen = webview.screens[0]
        left, right, top, bottom = 0, screen.width, 24, screen.height
    x = right - size - MARGIN if corner.endswith("r") else left + MARGIN
    y = bottom - size - MARGIN if corner.startswith("b") else top + MARGIN
    return int(x), int(y)


class Orbe:
    """La ventana flotante. Todos los métodos son seguros desde otros hilos."""

    def __init__(self):
        self.cfg = leer_orbe()
        self.size = self._lado(self.cfg)
        x, y = _posicion(str(self.cfg["corner"]), self.size)
        self.on_double_click = None              # lo asigna `motor`
        self._monitor = None
        self.window = webview.create_window(
            NOMBRE, url=str(rutas.ORBE_HTML),
            width=self.size, height=self.size, x=x, y=y,
            frameless=True, easy_drag=bool(self.cfg["drag"]), on_top=True, transparent=True,
            hidden=True, focus=False, shadow=False, resizable=False,
            js_api=_ApiEsfera(self))
        self.visible = False
        self.window.events.loaded += self._forzar_transparencia
        self.window.events.loaded += self._escuchar_doble_clic
        self.window.events.loaded += lambda: self.aplicar(self.cfg, forzar=True)

    @staticmethod
    def _lado(cfg: dict) -> int:
        try:
            return int(SIZE * max(0.6, min(1.4, float(cfg["size"]))))
        except (TypeError, ValueError):
            return SIZE

    def aplicar(self, cfg: dict, forzar: bool = False) -> None:
        """Aplica en vivo los ajustes de data/orb.json."""
        antes, self.cfg = self.cfg, cfg
        self._js("window.jarvis && jarvis.setConfig(" + json.dumps(cfg) + ")")
        lado = self._lado(cfg)
        if forzar or lado != self.size or cfg["corner"] != antes["corner"]:
            self.size = lado
            try:
                self.window.resize(lado, lado)
                self.window.move(*_posicion(str(cfg["corner"]), lado))
            except Exception as e:
                log.debug("no pude mover la esfera: %s", e)
        try:
            from webview.platforms.cocoa import BrowserView
            BrowserView.instances[self.window.uid].easy_drag = bool(cfg["drag"])
        except Exception:
            pass

    def _doble_clic(self) -> None:
        cb = self.on_double_click
        if cb and self.visible and self.cfg.get("dblclick", True):
            try:
                cb()
            except Exception:
                log.exception("doble clic")

    def _escuchar_doble_clic(self) -> None:
        """Doble clic nativo: la ventana nunca recibe el foco, así que el
        WebView podría no ver el clic; un monitor de eventos de AppKit sí."""
        def aplicar():
            if self._monitor is not None:
                return
            try:
                import AppKit
                nswin = self.window.native
                mask = getattr(AppKit, "NSEventMaskLeftMouseDown", 1 << 1)

                def handler(ev):
                    try:
                        if ev.clickCount() == 2 and ev.window() == nswin:
                            self._doble_clic()
                    except Exception:
                        pass
                    return ev
                self._monitor = AppKit.NSEvent.addLocalMonitorForEventsMatchingMask_handler_(
                    mask, handler)
                log.info("doble clic en la esfera: OK")
            except Exception as e:
                log.warning("no pude escuchar el doble clic nativo: %s", e)
        try:
            from PyObjCTools import AppHelper
            AppHelper.callAfter(aplicar)
        except Exception:
            aplicar()

    def _forzar_transparencia(self) -> None:
        """Solo la esfera: ventana y vista web sin ningún fondo."""
        def aplicar():
            try:
                from AppKit import NSColor
                nswin = self.window.native               # NSWindow
                nswin.setOpaque_(False)
                nswin.setBackgroundColor_(NSColor.clearColor())
                nswin.setHasShadow_(False)
                pend = [nswin.contentView()]
                while pend:                              # buscar el WKWebView
                    v = pend.pop()
                    if v.className().startswith("WKWebView") or "WebView" in str(v.className()):
                        v.setValue_forKey_(False, "drawsBackground")
                    pend.extend(v.subviews() or [])
                log.info("ventana transparente: OK")
            except Exception as e:
                log.warning("no pude forzar la transparencia: %s", e)
        try:
            from PyObjCTools import AppHelper
            AppHelper.callAfter(aplicar)
        except Exception:
            aplicar()

    def _js(self, code: str) -> None:
        try:
            self.window.run_js(code)
        except Exception:
            pass

    def state(self, name: str) -> None:
        self._js(f"window.jarvis && jarvis.setState('{name}')")

    def level(self, v: float) -> None:
        self._js(f"window.jarvis && jarvis.setAudioLevel({v:.3f})")

    def show(self) -> None:
        if not self.visible:
            self.window.show()
            self.visible = True

    def hide(self) -> None:
        if self.visible:
            self.window.hide()
            self.visible = False


def _chime(orbe: "Orbe") -> None:
    if orbe.cfg.get("sound", True) and Path(CHIME).exists():
        subprocess.Popen(["afplay", "-v", "0.5", CHIME])


def _estado(**campos) -> None:
    """data/estado.json: lo lee la ventana de ajustes (cerebro, micrófono…)."""
    try:
        actual = json.loads(STATUS_FILE.read_text()) if STATUS_FILE.exists() else {}
    except (OSError, ValueError):
        actual = {}
    if actual.get("pid") != os.getpid():
        actual = {"pid": os.getpid(), "desde": time.time()}
    actual.update(campos)
    try:
        STATUS_FILE.write_text(json.dumps(actual))
    except OSError:
        pass


def _registrar(tu: str, respuesta: str, herramientas: list[str], ok: bool = True) -> None:
    try:
        with open(ACTIVITY_FILE, "a") as f:
            f.write(json.dumps({"ts": time.time(), "tu": tu, "respuesta": respuesta,
                                "herramientas": herramientas, "ok": ok}, ensure_ascii=False) + "\n")
    except OSError:
        pass


async def motor(orbe: Orbe, stop: threading.Event) -> None:
    from oido import Oido
    import voz
    import cerebro as cer

    # Spotify sin Premium pulsa «Reproducir» en la app: necesita Accesibilidad.
    try:
        from ApplicationServices import AXIsProcessTrustedWithOptions, kAXTrustedCheckOptionPrompt
        if not AXIsProcessTrustedWithOptions({kAXTrustedCheckOptionPrompt: True}):
            log.warning("falta el permiso de Accesibilidad (Ajustes del Sistema → Privacidad y "
                        "seguridad → Accesibilidad → activar Jarvis): Spotify no podrá darle play solo")
        else:
            log.info("permiso de Accesibilidad: OK")
    except Exception as e:
        log.debug("comprobación de accesibilidad: %s", e)

    _estado(cerebro="arrancando")
    oido = Oido()
    brain = cer.crear(model=os.getenv("JARVIS_BRAIN_MODEL", "haiku"),
                      user_name=os.getenv("USER_NAME", ""))
    log.info("arrancando el cerebro…")
    if not await brain.start():
        log.error("el cerebro no arrancó: %s", brain.failure_reason or "revisa `claude` y tu sesión")
        _estado(cerebro="error", error=str(brain.failure_reason or "el cerebro no arrancó"))
        orbe.show(); orbe.state("error")
        await asyncio.sleep(4)
        orbe.hide()
        return
    oido.start()
    _estado(cerebro="ok", modelo=os.getenv("JARVIS_BRAIN_MODEL", "haiku"), palabra=oido.wake_word)
    log.info("listo. Di «%s».", oido.wake_word)

    # Doble clic en la esfera mientras está activa → se cancela todo.
    loop = asyncio.get_running_loop()
    cancelar = oido.cancelar                     # también corta grabación y voz
    activa: dict = {"task": None}

    def al_doble_clic() -> None:
        t = activa["task"]
        if t is not None and not t.done() and not cancelar.is_set():
            log.info("doble clic: Jarvis desactivado, petición descartada")
            cancelar.set()
            loop.call_soon_threadsafe(t.cancel)
    orbe.on_double_click = al_doble_clic

    async def comprobar_microfono():
        await asyncio.sleep(5)
        _estado(microfono=oido.peak > 0)
        if oido.peak == 0:
            log.error("el micrófono solo entrega silencio: falta el permiso de Micrófono "
                      "(Ajustes del Sistema → Privacidad y seguridad → Micrófono)")
            orbe.show(); orbe.state("error")
            await decir_simple("No tengo permiso para usar el micrófono. Actívalo en Ajustes del Sistema, Privacidad, Micrófono.")
            await asyncio.sleep(1.5)
            orbe.hide()

    async def decir_simple(texto: str) -> None:
        mp3 = await voz.synth_mp3(texto)
        if mp3:
            await asyncio.to_thread(voz.play, mp3, orbe.level)

    async def decir(texto: str) -> None:
        orbe.state("speaking")
        mp3 = await voz.synth_mp3(texto)
        if mp3:
            oido.mute(True)
            try:
                await asyncio.to_thread(voz.play, mp3, orbe.level, cancelar)
            finally:
                oido.mute(False)

    # La música de Spotify se colaba como si fueras tú hablando y mantenía
    # viva la conversación. Mientras Jarvis está activo se baja, como Siri.
    _DUCK = ('on run argv\nif application "Spotify" is running then\n'
             'tell application "Spotify"\nset v to sound volume\n'
             'if v > (item 1 of argv as integer) then set sound volume to (item 1 of argv as integer)\n'
             'return v\nend tell\nend if\nreturn ""\nend run')
    _RESTORE = ('on run argv\nif application "Spotify" is running then\n'
                'tell application "Spotify" to set sound volume to (item 1 of argv as integer)\n'
                'end if\nend run')

    def _osa(script: str, arg: str) -> str:
        try:
            r = subprocess.run(["osascript", "-e", script, arg], capture_output=True,
                               text=True, timeout=5)
            return r.stdout.strip()
        except Exception:
            return ""

    def bajar_spotify() -> int | None:
        out = _osa(_DUCK, str(DUCK_VOLUME))
        return int(out) if out.isdigit() and int(out) > DUCK_VOLUME else None

    def restaurar_spotify(vol: int | None) -> None:
        if vol is not None:
            _osa(_RESTORE, str(vol))

    async def conversar() -> None:
        first = True
        while not stop.is_set():
            if first and oido.resto:           # "Raphael, abre Spotify" de un tirón
                text, oido.resto = oido.resto, ""
                orbe.state("thinking")
            else:
                audio = await asyncio.to_thread(
                    oido.record_utterance, orbe.level, 5.0 if first else FOLLOW_UP_SEC,
                    medir_ambiente=not first)
                if audio is None:
                    return
                orbe.state("thinking")
                text = await asyncio.to_thread(oido.transcribe, audio)
            log.info("Tú: %s", text or "(nada)")
            if not text:
                return
            first = False
            turno = asyncio.create_task(brain.turn(text))
            try:
                # Si tarda (p. ej. una búsqueda web), avisar en vez de quedarse callado.
                done_, _ = await asyncio.wait({turno}, timeout=4.5)
                if not done_:
                    await decir("Un momento, lo estoy buscando.")
                    orbe.state("thinking")
                # shield: cancelar a la fuerza el turno desalinearía el
                # protocolo con `claude -p`; se le pide que lo abandone.
                result = await asyncio.shield(turno)
            except asyncio.CancelledError:
                if not turno.done():
                    brain.interrumpir()
                raise
            except Exception:
                log.exception("turno falló")
                result = None
            if result is None or result.stop_reason != "result" or not result.text.strip():
                orbe.state("error")
                reason = getattr(result, "stop_reason", "error")
                _registrar(text, "(límite de uso)" if reason == "rate_limited" else "(falló)", [], ok=False)
                await decir("Lo siento, algo falló." if reason != "rate_limited"
                            else "He alcanzado el límite de uso por ahora.")
                orbe.state("error")
                await asyncio.sleep(2.0)
                return
            reply = result.text.strip()
            log.info("%s: %s  [herramientas: %s]", NOMBRE, reply, ", ".join(result.tools) or "-")
            _registrar(text, reply, [t.removeprefix("mcp__acciones__") for t in result.tools])
            await decir(reply)
            orbe.state("done")
            await asyncio.sleep(1.2)
            if BYE_RE.search(text):
                return
            orbe.state("listening")          # puedes seguir hablando sin repetir "Raphael"

    async def vigilar_ajustes():
        """Ajustes del orbe en vivo y vista previa pedida desde la ventana de ajustes."""
        visto = None
        previa: str | bool = False
        while not stop.is_set():
            await asyncio.sleep(0.4)
            try:
                mtime = ORB_FILE.stat().st_mtime
            except OSError:
                mtime = None
            if mtime != visto:
                visto = mtime
                orbe.aplicar(leer_orbe())
            if activa["task"] is not None:
                previa = False                  # una conversación real manda
                continue
            try:
                pv = json.loads(PREVIEW_FILE.read_text())
                quiere = float(pv.get("until", 0)) > time.time()
            except (OSError, ValueError, TypeError, AttributeError):
                pv, quiere = {}, False
            if quiere:
                st = str(pv.get("state") or "idle")
                if not previa or st != previa:  # setState('done') reinicia su onda: solo al cambiar
                    orbe.show()
                    orbe.state(st)
                previa = st
            elif previa:
                previa = False
                orbe.state("idle")
                orbe.hide()

    asyncio.create_task(comprobar_microfono())
    asyncio.create_task(vigilar_ajustes())
    while not stop.is_set():
        woke = await asyncio.to_thread(oido.wait_for_wake, stop)
        if not woke:
            break
        orbe.show()
        orbe.state("listening")
        vol_spotify = await asyncio.to_thread(bajar_spotify)
        _chime(orbe)
        cancelar.clear()
        conv = asyncio.create_task(conversar())
        activa["task"] = conv
        try:
            await conv
        except asyncio.CancelledError:
            if not cancelar.is_set():
                raise                            # cierre real, no doble clic
        finally:
            activa["task"] = None
            oido.mute(False)
            await asyncio.to_thread(restaurar_spotify, vol_spotify)
        orbe.state("idle")
        await asyncio.sleep(0.4)
        orbe.hide()
        if brain.rotation_overdue:
            await brain.rotate()

    oido.stop()
    await brain.stop()


def _una_sola_instancia():
    import fcntl
    lock = open(DATA / "jarvis.lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        log.info("Jarvis ya está corriendo; salgo.")
        sys.exit(0)
    return lock


def _vigilar_padre() -> None:
    """Lanzado por la app (control.py): si la app desaparece, este motor también."""
    padre = os.getppid()

    def run():
        while True:
            time.sleep(2)
            if os.getppid() != padre:
                log.info("la app se cerró; salgo")
                os._exit(0)
    threading.Thread(target=run, daemon=True).start()


def main() -> None:
    rutas.AVISOS.mkdir(parents=True, exist_ok=True)
    if os.getenv("JARVIS_SUPERVISADO") == "1":
        _vigilar_padre()
    _lock = _una_sola_instancia()   # noqa: F841 (se mantiene abierto mientras vive)
    orbe = Orbe()
    stop = threading.Event()

    def arrancar():
        # Sin icono en el Dock ni robar el foco: app "accesoria".
        try:
            from AppKit import NSApplication
            NSApplication.sharedApplication().setActivationPolicy_(1)
        except Exception:
            pass
        asyncio.run(motor(orbe, stop))
        orbe.window.destroy()

    try:
        webview.start(arrancar, private_mode=True)
    finally:
        stop.set()


if __name__ == "__main__":
    main()
