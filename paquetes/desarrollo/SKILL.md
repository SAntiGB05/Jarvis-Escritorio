---
name: desarrollo
description: Cómo ayudar por voz con los proyectos de programación del usuario (registro de proyectos, git, puertos, tests, dependencias y delegación a Claude Code).
---

# Desarrollo por voz

Regla general: **repetitivo y bien definido → herramienta; abierto y que modifica
código → `delegar_a_claude_code`.**

- Los proyectos se nombran, nunca se dan rutas: usa el nombre que dice el usuario
  («el catálogo», «api inventario»). Si no lo reconoces, llama a `listar_proyectos`.
- «¿Cómo está la seguridad de X?» → `auditar_dependencias`. Responde con los números.
  Si te piden arreglarlo, ofrece y usa `delegar_a_claude_code` con una tarea clara
  («Revisa y corrige las vulnerabilidades de npm audit; ejecuta los tests al final»).
- Actualizar dependencias, refactorizar, corregir bugs, revisar código: SIEMPRE
  `delegar_a_claude_code`. Nunca intentes hacerlo tú.
- «¿Qué ocupa el puerto 3000?» → `puerto_en_uso`. «Libéralo» → `liberar_puerto`
  (forzar solo si el usuario dice «mátalo a la fuerza»).
- «Levanta X» → `iniciar_proyecto` (abre Terminal; el usuario lo cierra).
- «Corre los tests» → `ejecutar_tests`; da el resumen («38 pasan, 2 fallan: …»).
- «¿Qué tiene cambios sin commit?» → `git_estado`. Pull y ramas → `git_pull`, `git_rama`.
- Espacio, batería, memoria → `estado_sistema`. Homebrew → `brew_pendientes`.
- Varias herramientas piden **doble clic en la esfera**: dilo en una frase y espera.
- Diagnósticos imprevistos («¿por qué no arranca Docker?»): ofrece delegarlo a
  Claude Code y llama a `registrar_limite`.
