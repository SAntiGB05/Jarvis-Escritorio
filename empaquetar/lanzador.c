/*
 * lanzador.c — el ejecutable de Jarvis.app.
 *
 * Incrusta el Python del proyecto (Python.framework de Homebrew) en lugar de
 * lanzar `python`: así el proceso ES Jarvis.app para macOS (nombre, icono,
 * Info.plist y permisos de micrófono/accesibilidad a nombre de «Jarvis»).
 *
 *   Jarvis               → ejecuta jarvis/control.py (barra de menús + ajustes + motor)
 *   Jarvis --opcion …    → igual, con opciones de la app (--sin-ventana)
 *   Jarvis script.py …   → `python script.py …`, PERO solo para los scripts de
 *                          PERMITIDOS (motor, servidor MCP y los dos hooks),
 *                          por su ruta canónica y con su SHA-256 fijado al
 *                          compilar. Nada de -c, -m, -i ni ninguna otra opción
 *                          de intérprete (plan de mejoras, punto 1): ningún
 *                          otro proceso puede usar Jarvis.app como un Python
 *                          con los permisos de micrófono, Accesibilidad y
 *                          Automatización de Jarvis.
 *
 * JARVIS_ROOT, JARVIS_SITE y los HASH_* se fijan al compilar (ver crear_app.sh).
 * Cambiar uno de esos scripts exige volver a ejecutar crear_app.sh.
 */
#include <Python.h>
#include <CommonCrypto/CommonDigest.h>
#include <limits.h>
#include <mach-o/dyld.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef JARVIS_ROOT
#error "compila con -DJARVIS_ROOT=... -DJARVIS_SITE=... -DHASH_MOTOR=... (crear_app.sh)"
#endif
#if !defined(HASH_MOTOR) || !defined(HASH_ACCIONES) || !defined(HASH_BUSQUEDA) || !defined(HASH_ESCRITURA)
#error "faltan los hashes de los scripts permitidos (crear_app.sh)"
#endif

extern char **environ;

static const char *PERMITIDOS[] = {"motor.py", "acciones_mcp.py", "limitar_busqueda.py",
                                   "limitar_escritura.py"};
static const char *HASHES[] = {HASH_MOTOR, HASH_ACCIONES, HASH_BUSQUEDA, HASH_ESCRITURA};
#define N_PERMITIDOS (sizeof(PERMITIDOS) / sizeof(PERMITIDOS[0]))

/* SHA-256 del archivo en hexadecimal (65 bytes con el NUL). 0 si falla. */
static int sha256_archivo(const char *ruta, char hex[65]) {
    FILE *f = fopen(ruta, "rb");
    if (f == NULL) return 0;
    CC_SHA256_CTX ctx;
    CC_SHA256_Init(&ctx);
    unsigned char buf[65536];
    size_t n;
    while ((n = fread(buf, 1, sizeof buf, f)) > 0) CC_SHA256_Update(&ctx, buf, (CC_LONG)n);
    int err = ferror(f);
    fclose(f);
    if (err) return 0;
    unsigned char dig[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256_Final(dig, &ctx);
    for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) snprintf(hex + 2 * i, 3, "%02x", dig[i]);
    return 1;
}

static int script_permitido(const char *arg) {
    char real[PATH_MAX], esperado[PATH_MAX], hex[65];
    if (arg == NULL || arg[0] == '-') return 0;             /* nada de -c, -m, -B, -i … */
    if (realpath(arg, real) == NULL) return 0;              /* resuelve symlinks y ".." */
    for (size_t i = 0; i < N_PERMITIDOS; i++) {
        snprintf(esperado, sizeof esperado, "%s/jarvis/%s", JARVIS_ROOT, PERMITIDOS[i]);
        if (strcmp(real, esperado) == 0)
            return sha256_archivo(real, hex) && strcmp(hex, HASHES[i]) == 0;
    }
    return 0;
}

/* Fuera cualquier PYTHON* heredado (PYTHONINSPECT, PYTHONSTARTUP, PYTHONHOME…):
   el intérprete solo ve lo que fija este lanzador. */
static void limpiar_entorno(void) {
    int cambiado = 1;
    while (cambiado) {
        cambiado = 0;
        for (char **e = environ; e && *e; e++) {
            if (strncmp(*e, "PYTHON", 6) == 0) {
                char nombre[256];
                size_t len = strcspn(*e, "=");
                if (len >= sizeof nombre) len = sizeof nombre - 1;
                memcpy(nombre, *e, len);
                nombre[len] = '\0';
                unsetenv(nombre);
                cambiado = 1;
                break;                                       /* environ cambió: volver a empezar */
            }
        }
    }
}

int main(int argc, char *argv[]) {
    limpiar_entorno();
    /* Los paquetes del .venv y el código (jarvis/), para este proceso y sus hijos. */
    setenv("PYTHONPATH", JARVIS_SITE ":" JARVIS_ROOT "/jarvis", 1);
    setenv("PYTHONNOUSERSITE", "1", 1);
    setenv("PYTHONSAFEPATH", "1", 1);

    /* argv[0] absoluto: será sys.executable, con el que la app lanza sus hijos. */
    char exe[PATH_MAX], real[PATH_MAX];
    uint32_t size = sizeof(exe);
    if (_NSGetExecutablePath(exe, &size) == 0 && realpath(exe, real) != NULL)
        argv[0] = real;

    const char *a1 = argc > 1 ? argv[1] : "";
    int opcion_app = strncmp(a1, "--", 2) == 0;              /* --sin-ventana … */
    int psn = strncmp(a1, "-psn_", 5) == 0;                  /* Finder antiguo */

    if (argc > 1 && !opcion_app && !psn) {
        /* Modo intérprete: solo los scripts conocidos y sin modificar. */
        if (!script_permitido(argv[1])) {
            fprintf(stderr, "Jarvis: «%s» no es un script permitido.\n", argv[1]);
            return 1;
        }
        return Py_BytesMain(argc, argv);
    }

    /* Modo app: jarvis/control.py + las opciones de la app (nunca opciones de Python:
       van detrás del script, así que Python se las pasa a control.py). */
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
