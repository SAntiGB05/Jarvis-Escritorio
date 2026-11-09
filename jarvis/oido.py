"""
oido.py — escucha local: palabra de activación + grabación + transcripción.

Nada de audio sale del Mac:
  * Palabra de activación (JARVIS_WAKE_WORD, por defecto "Raphael"): cada frase corta que detecta el
    micrófono se transcribe en local con faster-whisper y se busca
    "Rafael/Raphael" (openWakeWord no tiene modelo para ese nombre).
  * Al detectarla, se graba hasta que dejas de hablar (silencio ~1 s).
  * faster-whisper transcribe en local (modelo descargado una vez).
Solo el TEXTO de lo que dijiste después de "Raphael" llega al cerebro.
"""
from __future__ import annotations

import collections
import logging
import os
import queue
import re
import threading
import time
from typing import Callable, Optional

import numpy as np
import sounddevice as sd

log = logging.getLogger("jarvis.oido")

SR = 16000
FRAME = 1280                     # 80 ms, lo que espera openWakeWord


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


class Oido:
    def __init__(self):
        # Sensibilidad para considerar que alguien está hablando (múltiplo del
        # ruido de fondo). Más bajo = más sensible, pero más transcripciones.
        self.wake_sens = _env_float("JARVIS_WAKE_SENS", 2.5)
        self.resto = ""                          # lo dicho tras "Raphael" en la misma frase
        self.cancelar = threading.Event()        # doble clic en la esfera

        from faster_whisper import WhisperModel
        size = os.getenv("JARVIS_WHISPER_MODEL", "small")
        log.info("cargando whisper %s…", size)
        try:   # ya descargado: no vuelve a consultar internet
            self.whisper = WhisperModel(size, device="cpu", compute_type="int8", local_files_only=True)
        except Exception:
            self.whisper = WhisperModel(size, device="cpu", compute_type="int8")
        self.language = os.getenv("JARVIS_LANGUAGE", "es")
        self.wake_word = os.getenv("JARVIS_WAKE_WORD", "").strip() or "Raphael"
        self.wake_re = patron_activacion(self.wake_word)
        self.vocab = _vocabulario(self.wake_word)

        self._q: "queue.Queue[np.ndarray]" = queue.Queue(maxsize=200)
        self._muted = threading.Event()          # mientras Jarvis habla
        self._stream: Optional[sd.InputStream] = None
        self.noise_floor = 300.0
        self.peak = 0                            # 0 tras unos segundos = sin permiso de micrófono

    # ── micrófono ──────────────────────────────────────────────────────
    def start(self) -> None:
        def cb(indata, frames, t, status):
            if status:
                log.debug("audio status: %s", status)
            peak = int(np.abs(indata).max()) if len(indata) else 0
            if peak > self.peak:
                self.peak = peak
            try:
                self._q.put_nowait(indata[:, 0].copy())
            except queue.Full:
                pass
        self._stream = sd.InputStream(samplerate=SR, channels=1, dtype="int16",
                                      blocksize=FRAME, callback=cb)
        self._stream.start()

    def stop(self) -> None:
        if self._stream:
            self._stream.stop()
            self._stream.close()

    def mute(self, on: bool) -> None:
        if on:
            self._muted.set()
        else:
            self._muted.clear()
            self.flush()

    def flush(self) -> None:
        while not self._q.empty():
            try:
                self._q.get_nowait()
            except queue.Empty:
                break

    def _frame(self, timeout: float = 1.0) -> Optional[np.ndarray]:
        try:
            return self._q.get(timeout=timeout)
        except queue.Empty:
            return None

    # ── palabra de activación ─────────────────────────────────────────
    def wait_for_wake(self, stop: threading.Event) -> bool:
        """Bloquea hasta oír "Raphael". El audio se descarta al instante.

        Corta el audio en frases (voz seguida de ~0.5 s de silencio, máx. 4 s)
        y solo esas frases se transcriben en local para buscar el nombre.
        Si en la misma frase dijiste la petición ("Raphael, abre Spotify"),
        queda en `self.resto` para no tener que repetirla."""
        self.flush()
        self.resto = ""
        pre: collections.deque = collections.deque(maxlen=4)   # 320 ms antes de la voz
        seg: list[np.ndarray] = []
        voiced = silence = 0
        max_frames = int(4.0 * SR / FRAME)
        while not stop.is_set():
            f = self._frame()
            if f is None or self._muted.is_set():
                continue
            rms = float(np.sqrt(np.mean(f.astype(np.float32) ** 2)))
            thr = max(450.0, self.noise_floor * self.wake_sens)
            if not seg:
                self.noise_floor = 0.995 * self.noise_floor + 0.005 * min(rms, 3000)
                pre.append(f)
                if rms > thr:
                    seg, voiced, silence = list(pre), 1, 0
                continue
            seg.append(f)
            if rms > thr * 0.6:
                voiced, silence = voiced + 1, 0
            else:
                silence += 1
            cortada = len(seg) >= max_frames           # sigues hablando
            if silence < 6 and not cortada:
                continue
            frase, n_voz = seg, voiced
            seg, voiced, silence = [], 0, 0
            pre.clear()
            if n_voz < 3:                              # un golpe o un clic, no voz
                continue
            heard = self._transcribe_raw(np.concatenate(frase))
            m = self.wake_re.search(heard)
            if m:
                log.info("palabra de activación → «%s»", heard)
                resto = heard[m.end():].strip(" ,.;:!¡?¿-")
                self.resto = resto if (not cortada and len(resto.split()) >= 2) else ""
                self.flush()
                return True
        return False

    # ── grabar una frase ──────────────────────────────────────────────
    def record_utterance(self, level_cb: Optional[Callable[[float], None]] = None,
                         wait_start: float = 5.0, max_len: float = 15.0,
                         end_silence: float = 1.0, medir_ambiente: bool = False) -> Optional[np.ndarray]:
        """Graba desde que empiezas a hablar hasta ~1 s de silencio.
        None si no dices nada en `wait_start` segundos."""
        speak_thr = max(500.0, self.noise_floor * 3.0)
        # El ruido de fondo puede haber cambiado desde la palabra de activación
        # (p. ej. música que acaba de empezar): se mide ~0.4 s de ambiente y el
        # umbral sube para que no cuente como si estuvieras hablando.
        ambient = []
        if medir_ambiente:
            self.flush()
            ambient = [f for f in (self._frame(0.2) for _ in range(5)) if f is not None]
        if ambient:
            amb = float(np.median([np.sqrt(np.mean(f.astype(np.float32) ** 2)) for f in ambient]))
            speak_thr = max(speak_thr, amb * 2.5)
        pre = collections.deque(maxlen=4)       # 320 ms antes de empezar
        chunks: list[np.ndarray] = []
        started = False
        t0 = time.monotonic()
        last_voice = t0
        while True:
            if self.cancelar.is_set():
                return None
            f = self._frame()
            now = time.monotonic()
            if f is None:
                if not started and now - t0 > wait_start:
                    return None
                continue
            rms = float(np.sqrt(np.mean(f.astype(np.float32) ** 2)))
            if level_cb:
                level_cb(min(1.0, rms / 4000.0))
            if not started:
                pre.append(f)
                if rms > speak_thr:
                    started = True
                    chunks.extend(pre)
                    last_voice = now
                elif now - t0 > wait_start:
                    return None
                continue
            chunks.append(f)
            if rms > speak_thr * 0.6:
                last_voice = now
            if now - last_voice > end_silence or now - t0 > max_len:
                break
        return np.concatenate(chunks) if chunks else None

    # ── transcribir ───────────────────────────────────────────────────
    def _transcribe_raw(self, audio: np.ndarray, prompt: str = "") -> str:
        pcm = audio.astype(np.float32) / 32768.0
        segments, _ = self.whisper.transcribe(
            pcm, language=self.language, beam_size=1, vad_filter=True,
            condition_on_previous_text=False, initial_prompt=prompt or None)
        return " ".join(s.text.strip() for s in segments).strip()

    def transcribe(self, audio: np.ndarray) -> str:
        return self._transcribe_raw(audio, prompt=self.vocab)


# "Raphael" tal como lo suele escribir Whisper en español: Rafael, Rafaél,
# Raphael, Rafel, Rafa el…
_RAPHAEL_RE = re.compile(r"\br+[aá](?:f|ph)+(?:a\s?)?[eé]l+\b", re.I)

_VOCALES = {"a": "aáà", "e": "eéè", "i": "iíìy", "o": "oóò", "u": "uúùü", "y": "yi"}
# Grafías que Whisper confunde al oír un nombre.
_PARECIDOS = [("ph", "(?:f|ph)"), ("f", "(?:f|ph)"), ("qu", "(?:qu|k|c)"), ("k", "(?:k|c|qu)"),
              ("c", "(?:c|k|s|z)"), ("z", "(?:z|s|c)"), ("s", "(?:s|z|c)"), ("v", "[vb]"), ("b", "[bv]"),
              ("ll", "(?:ll|y)"), ("y", "(?:y|ll|i)"), ("h", "h?"), ("j", "[jg]"), ("g", "[gj]")]


def patron_activacion(palabra: str) -> "re.Pattern[str]":
    """Expresión que reconoce la palabra de activación y sus variantes
    habituales al transcribir (acentos, letras dobles, ph/f, b/v, c/k…)."""
    import unicodedata
    base = unicodedata.normalize("NFKD", palabra.lower()).encode("ascii", "ignore").decode()
    base = re.sub(r"[^a-z ]", "", base).strip()
    if not base:
        base = "raphael"
    if base == "raphael" or base == "rafael":
        return _RAPHAEL_RE
    out, i = [], 0
    while i < len(base):
        ch = base[i]
        if ch == " ":
            out.append(r"[\s,.-]*"); i += 1; continue
        for orig, rx in _PARECIDOS:
            if base.startswith(orig, i):
                out.append(rx + "+" if not rx.endswith("?") else rx)
                i += len(orig)
                break
        else:
            out.append(f"[{_VOCALES[ch]}]+" if ch in _VOCALES else re.escape(ch) + "+")
            i += 1
    return re.compile(r"\b" + "".join(out) + r"\b", re.I)


def _vocabulario(palabra: str = "Raphael") -> str:
    """Pista para Whisper con palabras que vas a decir: nombres de tus apps."""
    apps = []
    for d in ("/Applications", "/System/Applications"):
        try:
            apps += [p[:-4] for p in os.listdir(d) if p.endswith(".app")]
        except OSError:
            pass
    base = (f"{palabra}, abre Spotify, pon una canción, abre CapCut, crea un recordatorio, "
            "pausa la música, sube el volumen.")
    return (base + " " + ", ".join(sorted(set(apps))[:60]))[:600]
