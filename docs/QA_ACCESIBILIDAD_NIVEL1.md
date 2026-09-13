# QA de accesibilidad — gate NIVEL 1 (teclado / touch / tamaños)

- **Fecha:** 2026-09-13
- **Entorno:** producción (`sistema-medico-web.vercel.app`), navegador real (Claude in Chrome).
- **Alcance:** shell de la app (topbar, Command Center, Command Palette) y reglas responsive.
- **Referencias del plan:** §2.1 (shell 3 columnas), §2.3 (accesibilidad), gate NIVEL 1.

## Resultado: ✅ sin defectos bloqueantes

No se encontraron defectos de accesibilidad bloqueantes en el shell. Queda una
**verificación pendiente de ancho de móvil por render** (ver Limitaciones), cubierta
por inspección de CSS.

## Verificado

| Área | Verificación | Resultado |
| --- | --- | --- |
| **Teclado — Command Palette** | `⌘K`/`Ctrl+K` abre la paleta con foco en el input; pistas visibles "↑↓ navegar · Enter abrir · Esc cerrar"; `Esc` la cierra | ✅ |
| **Nombres accesibles** | Nav (Inicio/Pacientes/Agenda) con texto; botón de logout con aria-label "Cerrar sesión (email)"; filas de paciente son enlaces con texto (nombre · edad · MRN) | ✅ |
| **Landmarks** | `header` (topbar), `nav aria-label="Navegación principal"`, `main`; paleta con `role=dialog` | ✅ |
| **Layout desktop (≥1024px)** | Command Center en 3 columnas; el shell sólo se muestra autenticado | ✅ |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` presente en global.css | ✅ |
| **Dark mode** | Tokens redefinidos bajo `@media (prefers-color-scheme: dark)` | ✅ |
| **Gate en CI** | Storybook con addon a11y (`test: 'error'`) fuerza a11y a nivel de componente | ✅ |

## Responsive (por inspección de CSS)

- `.mos-grid`: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` → las tarjetas
  colapsan de 3 → 2 → 1 columna al reducir el ancho, sin scroll horizontal.
- `.mos-workspace`: 3 columnas por defecto; `@media (max-width: 90rem)` → 2 columnas (se oculta
  la línea de tiempo); `@media (max-width: 64rem)` → 1 columna con el rail a ancho completo.
- Conclusión: a ~400px el Command Center y el workspace quedan en 1 columna.

## Limitaciones de esta corrida

- **Ancho de móvil (≤400px) no verificado por render:** en el entorno de automatización la
  ventana no se redujo por debajo de ~1069px (mínimo del navegador), así que el layout de móvil
  se validó por las reglas CSS anteriores, no por captura visual. **Recomendado:** una pasada
  manual en device-mode (o dispositivo real) a 360–414px antes de GA.
- No se ejecutó un audit automatizado tipo axe sobre la app en runtime (sí a nivel de componente
  vía Storybook). Sugerido como mejora: integrar `@axe-core/playwright` en un e2e.

## Cierre del gate NIVEL 1

- Storybook (infra de componentes): ✅ (entregado).
- Accesibilidad teclado/touch: ✅ verificado con la limitación anotada arriba.
- **Pendiente menor (no bloqueante):** pasada visual a ≤414px en device-mode y, opcionalmente,
  audit axe en e2e.
