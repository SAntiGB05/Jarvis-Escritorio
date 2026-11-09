/*
 * lanzador.c — el ejecutable de Jarvis.app.
 *
 * Incrusta el Python del proyecto (Python.framework de Homebrew) en lugar de
 * lanzar `python`: así el proceso ES Jarvis.app para macOS (nombre, icono,
 * Info.plist y permisos de micrófono/accesibilidad a nombre de «Jarvis»).
 *
 *   Jarvis               → ejecuta jarvis/control.py (barra de menús + ajustes + motor)
 *   Jarvis script.py …   → se comporta como `python script.py …` (lo usa la
 *                          app para lanzar motor.py, acciones_mcp.py y el filtro)
 *
 * JARVIS_ROOT y JARVIS_SITE (site-packages del .venv) se fijan al compilar
 * (ver crear_app.sh).
 */
#include <Python.h>
#include <limits.h>
#include <mach-o/dyld.h>
#include <stdlib.h>
#include <string.h>

#ifndef JARVIS_ROOT
#error "compila con -DJARVIS_ROOT=... -DJARVIS_SITE=..."
#endif

int main(int argc, char *argv[]) {
    /* Los paquetes del .venv y el código (jarvis/), para este proceso y sus hijos. */
    setenv("PYTHONPATH", JARVIS_SITE ":" JARVIS_ROOT "/jarvis", 1);
    setenv("PYTHONNOUSERSITE", "1", 1);
    unsetenv("PYTHONHOME");

    /* argv[0] absoluto: será sys.executable, con el que la app lanza sus hijos. */
    char exe[PATH_MAX], real[PATH_MAX];
    uint32_t size = sizeof(exe);
    if (_NSGetExecutablePath(exe, &size) == 0 && realpath(exe, real) != NULL)
        argv[0] = real;

    /* ¿Lo llaman como intérprete (subprocess, multiprocessing: `-c`, `-B`,
       `script.py`…) o como app (`--sin-ventana`, o sin argumentos)? */
    const char *a1 = argc > 1 ? argv[1] : "";
    int opcion_app = strncmp(a1, "--", 2) == 0 && strcmp(a1, "--version") != 0 &&
                     strcmp(a1, "--help") != 0 && strncmp(a1, "--check-hash", 12) != 0;
    int psn = strncmp(a1, "-psn_", 5) == 0;            /* Finder antiguo */
    if (argc > 1 && !opcion_app && !psn)
        return Py_BytesMain(argc, argv);

    /* Modo app: jarvis/control.py + las opciones de la app. */
    char **args = calloc((size_t)argc + 2, sizeof(char *));
    if (args == NULL) return 1;
    int n = 0;
    args[n++] = argv[0];
    args[n++] = JARVIS_ROOT "/jarvis/control.py";
    for (int i = 1; i < argc; i++)
        if (strncmp(argv[i], "-psn_", 5) != 0) args[n++] = argv[i];
    args[n] = NULL;
    return Py_BytesMain(n, args);
}
