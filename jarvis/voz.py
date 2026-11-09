"""
voz.py — Jarvis habla: edge-tts (gratis) → WAV → altavoz, midiendo el nivel
de audio en tiempo real para que la esfera se mueva con la voz.
"""
from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile
import threading
import wave
from pathlib import Path
from typing import Callable, Optional

import numpy as np
import sounddevice as sd

log = logging.getLogger("jarvis.voz")

DEFAULT_VOICE = "es-CO-GonzaloNeural"


async def synth_mp3(text: str, voice: Optional[str] = None, rate: Optional[str] = None,
                    pitch: Optional[str] = None) -> Optional[bytes]:
    """Sin argumentos usa EDGE_VOICE / EDGE_RATE / EDGE_PITCH; la ventana de
    ajustes los pasa explícitos para «Probar voz» antes de guardar."""
    import edge_tts
    voice = (voice or os.getenv("EDGE_VOICE", DEFAULT_VOICE)).strip() or DEFAULT_VOICE
    rate = (rate or os.getenv("EDGE_RATE", "+5%")).strip() or "+5%"
    pitch = (pitch or os.getenv("EDGE_PITCH", "-4Hz")).strip() or "-4Hz"
    buf = bytearray()
    try:
        async for chunk in edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).stream():
            if chunk.get("type") == "audio":
                buf.extend(chunk["data"])
    except Exception as e:
        log.error("edge-tts: %s", e)
        return None
    return bytes(buf) or None


def _mp3_to_pcm(mp3: bytes) -> tuple[np.ndarray, int]:
    """Decodifica con afconvert (incluido en macOS)."""
    with tempfile.TemporaryDirectory() as d:
        src, dst = Path(d) / "a.mp3", Path(d) / "a.wav"
        src.write_bytes(mp3)
        subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16", str(src), str(dst)],
                       check=True, capture_output=True, timeout=20)
        with wave.open(str(dst)) as w:
            sr, ch = w.getframerate(), w.getnchannels()
            pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    if ch > 1:
        pcm = pcm.reshape(-1, ch).mean(axis=1).astype(np.int16)
    return pcm, sr


def play(mp3: bytes, level_cb: Optional[Callable[[float], None]] = None,
         stop: Optional[threading.Event] = None) -> None:
    """Reproduce bloqueando el hilo; llama a level_cb ~30 veces por segundo.
    Si `stop` se activa (doble clic en la esfera), se corta al instante."""
    if stop is not None and stop.is_set():
        return
    pcm, sr = _mp3_to_pcm(mp3)
    block = sr // 30
    pos = 0

    def cb(outdata, frames, t, status):
        nonlocal pos
        chunk = pcm[pos:pos + frames]
        pos += frames
        if len(chunk) < frames:
            outdata[:len(chunk), 0] = chunk
            outdata[len(chunk):, 0] = 0
            raise sd.CallbackStop
        outdata[:, 0] = chunk
        if level_cb:
            rms = float(np.sqrt(np.mean(chunk.astype(np.float32) ** 2)))
            level_cb(min(1.0, rms / 6000.0))

    with sd.OutputStream(samplerate=sr, channels=1, dtype="int16", blocksize=block, callback=cb) as s:
        while s.active:
            if stop is not None and stop.is_set():
                s.abort()
                break
            sd.sleep(50)
    if level_cb:
        level_cb(0.0)
