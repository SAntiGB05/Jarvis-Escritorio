"""rutas.py — todas las rutas del proyecto, en un solo sitio.

    jarvis/      este código          interfaz/orbe/     la esfera
    cerebro/     cwd del cerebro      interfaz/ajustes/  ventana de ajustes (React)
    data/        datos locales        .env · sitios_permitidos.txt  ajustes del usuario
"""
from pathlib import Path

CODIGO = Path(__file__).resolve().parent
RAIZ = CODIGO.parent

ENV = RAIZ / ".env"
ENV_EJEMPLO = RAIZ / ".env.example"
SITIOS = RAIZ / "sitios_permitidos.txt"

DATA = RAIZ / "data"
AVISOS = DATA / "avisos"            # la app y el motor se avisan con archivos aquí

CEREBRO = RAIZ / "cerebro"          # cwd de `claude -p`: CLAUDE.md (+ mcp.json y .claude/ generados)
ORBE_HTML = RAIZ / "interfaz" / "orbe" / "index.html"
AJUSTES_HTML = RAIZ / "interfaz" / "ajustes" / "dist" / "index.html"

CONTROL = CODIGO / "control.py"     # la app
MOTOR = CODIGO / "motor.py"         # esfera + oído + cerebro
ACCIONES = CODIGO / "acciones_mcp.py"
FILTRO_BUSQUEDA = CODIGO / "limitar_busqueda.py"
