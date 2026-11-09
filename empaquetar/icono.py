"""icono.py — dibuja el icono de Jarvis.app (la esfera dorada) y crea Jarvis.icns.

Uso:  python empaquetar/icono.py <carpeta_salida>
"""
import math
import random
import subprocess
import sys
import tempfile
from pathlib import Path

import AppKit
from Foundation import NSMakeRect

S = 1024
random.seed(7)


def color(r, g, b, a=1.0):
    return AppKit.NSColor.colorWithSRGBRed_green_blue_alpha_(r, g, b, a)


def dibujar() -> AppKit.NSBitmapImageRep:
    rep = AppKit.NSBitmapImageRep.alloc().initWithBitmapDataPlanes_pixelsWide_pixelsHigh_bitsPerSample_samplesPerPixel_hasAlpha_isPlanar_colorSpaceName_bytesPerRow_bitsPerPixel_(
        None, S, S, 8, 4, True, False, AppKit.NSDeviceRGBColorSpace, 0, 0)
    ctx = AppKit.NSGraphicsContext.graphicsContextWithBitmapImageRep_(rep)
    AppKit.NSGraphicsContext.saveGraphicsState()
    AppKit.NSGraphicsContext.setCurrentContext_(ctx)

    # Cuadrado redondeado de macOS (rejilla de Apple: 824 px con margen de 100).
    m, lado = 100, 824
    forma = AppKit.NSBezierPath.bezierPathWithRoundedRect_xRadius_yRadius_(NSMakeRect(m, m, lado, lado), 185, 185)
    forma.addClip()
    fondo = AppKit.NSGradient.alloc().initWithColors_([color(0.16, 0.12, 0.08), color(0.04, 0.035, 0.03)])
    fondo.drawInBezierPath_relativeCenterPosition_(forma, AppKit.NSMakePoint(0.25, 0.35))

    # retícula tenue, como el escenario de la ventana de ajustes
    color(1, 0.93, 0.82, 0.035).set()
    for i in range(m, m + lado, 48):
        AppKit.NSBezierPath.fillRect_(NSMakeRect(i, m, 2, lado))
        AppKit.NSBezierPath.fillRect_(NSMakeRect(m, i, lado, 2))

    cx = cy = S / 2
    R = 255
    halo = AppKit.NSGradient.alloc().initWithColors_atLocations_colorSpace_(
        [color(1, 0.52, 0.06, 0.55), color(1, 0.28, 0.02, 0.18), color(1, 0.28, 0.02, 0.0)], [0.0, 0.45, 1.0],
        AppKit.NSColorSpace.sRGBColorSpace())
    halo.drawFromCenter_radius_toCenter_radius_options_((cx, cy), 0, (cx, cy), R * 1.75, 0)

    # esfera de Fibonacci inclinada (misma idea que la mini esfera de Ajustes)
    deep, mid, pale = (1, 0.28, 0.02), (1, 0.52, 0.06), (1, 0.85, 0.55)
    n, gold = 1100, math.pi * (3 - math.sqrt(5))
    tilt, rot = 0.38, 0.6
    puntos = []
    for i in range(n):
        y = 1 - (i / (n - 1)) * 2
        r = math.sqrt(1 - y * y)
        th = gold * i
        rr = 0.95 + random.random() * 0.1 if random.random() < 0.8 else 0.35 + random.random() * 0.55
        x, z = math.cos(th) * r * rr, math.sin(th) * r * rr
        y *= rr
        x1 = x * math.cos(rot) + z * math.sin(rot)
        z1 = -x * math.sin(rot) + z * math.cos(rot)
        y2 = y * math.cos(tilt) - z1 * math.sin(tilt)
        z2 = y * math.sin(tilt) + z1 * math.cos(tilt)
        pr = 2.4 / (2.4 - z2)
        puntos.append((z2, cx + x1 * R * pr, cy + y2 * R * pr))
    puntos.sort()
    for z2, sx, sy in puntos:
        f = max(0.0, min(1.0, (z2 + 1) / 2))
        c = [a + (b - a) * (f * 2) for a, b in zip(deep, mid)] if f < 0.5 else [a + (b - a) * ((f - 0.5) * 2) for a, b in zip(mid, pale)]
        tam = (2.2 + 7.5 * f) * (0.7 + random.random() * 0.6)
        color(*c, 0.25 + 0.7 * f).set()
        AppKit.NSBezierPath.bezierPathWithOvalInRect_(NSMakeRect(sx - tam / 2, sy - tam / 2, tam, tam)).fill()

    nucleo = AppKit.NSGradient.alloc().initWithColors_atLocations_colorSpace_(
        [color(1, 0.95, 0.8, 0.9), color(1, 0.7, 0.25, 0.35), color(1, 0.5, 0.1, 0.0)], [0.0, 0.3, 1.0],
        AppKit.NSColorSpace.sRGBColorSpace())
    nucleo.drawFromCenter_radius_toCenter_radius_options_((cx, cy), 0, (cx, cy), 120, 0)

    AppKit.NSGraphicsContext.restoreGraphicsState()
    return rep


def main() -> None:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    rep = dibujar()
    png = rep.representationUsingType_properties_(AppKit.NSBitmapImageFileTypePNG, {})
    with tempfile.TemporaryDirectory() as d:
        base = Path(d) / "base.png"
        png.writeToFile_atomically_(str(base), True)
        iconset = Path(d) / "Jarvis.iconset"
        iconset.mkdir()
        for px in (16, 32, 128, 256, 512):
            for scale in (1, 2):
                name = f"icon_{px}x{px}{'@2x' if scale == 2 else ''}.png"
                subprocess.run(["sips", "-z", str(px * scale), str(px * scale), str(base), "--out", str(iconset / name)],
                               check=True, capture_output=True)
        subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(out / "Jarvis.icns")], check=True)
        (out / "icono.png").write_bytes(base.read_bytes())
    print(out / "Jarvis.icns")


if __name__ == "__main__":
    main()
