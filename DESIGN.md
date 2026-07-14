# Navaja · Sistema de diseño

Identidad: **premium oscuro + acento dorado**, con personalidad de barbería clásica
hecha moderna. Se vende en oscuro (landing cinematográfica) y se trabaja en claro
(panel y reserva, menos fatiga visual).

## Decisiones (con razón)

| Dimensión | Decisión | Por qué |
|---|---|---|
| Estilo landing | Exaggerated minimalism (Playfair gigante, negativo, glow) | Impacto editorial, sensación premium |
| Estilo panel | Minimalismo suizo (grid, hairlines, claridad) | Densidad operativa sin ruido |
| Color | Negro `#1c1917` + oro `#a16207` | Paleta *luxury* masculina; oro AA sobre blanco y oscuro |
| Tipografía | Playfair Display + Inter + JetBrains Mono | Serif de marca, sans impecable de UI, mono para cifras/horas |
| Sidebar | Oscuro sobre contenido claro | Contraste premium, refuerza marca |

## Tokens (`src/app/globals.css`, Tailwind v4 `@theme`)

**Color**
- `stone-950 #0c0a09` · `stone-900 #1c1917` · … · `stone-50 #faf9f7`
- `gold #a16207` (acento, WCAG) · `gold-400 #d4a23a` (decorativo)
- `cream #faf9f7` (fondo app) · `card #fff` · `border #e7e2dd`
- Semánticos: `success`, `warning`, `destructive`, `info`

**Tipografía** — `--font-display` (Playfair) · `--font-sans` (Inter) · `--font-mono` (JetBrains).
Cifras con `.tnum` (tabular) para precios, horas y métricas.

**Utilidades de marca** — `.grain` (grano de film en hero oscuro), `.glow-gold`
(resplandor cálido), `.barber-pole` / `<BarberPole/>` (poste animado), `.text-gradient-gold`,
`.animate-rise` (entrada).

## UX aplicada (del skill UI/UX Pro Max)

- **Accesibilidad**: foco visible dorado global, contraste ≥4.5:1, `prefers-reduced-motion`
  respetado (corta toda animación), labels reales en formularios, `inputMode`/`autoComplete`.
- **Touch**: targets ≥44px, estados hover/active/disabled distintos, `active:scale`.
- **Formularios**: validación progresiva (el botón Continuar se habilita por paso),
  stepper con back, pantalla de éxito con resumen.
- **Navegación**: sidebar con estado activo, jerarquía clara, drawer móvil con scrim.
- **Estados vacíos**: agenda sin citas y búsquedas sin resultados tienen mensaje + acción.

## Marca

- **Logo**: navaja estilizada en badge dorado (SVG en `components/brand/Logo.tsx`) +
  wordmark "Navaja" en Playfair.
- **Avatares**: iniciales sobre degradado del acento del barbero (confiable, sin fotos).
- **Imágenes fotográficas**: pendientes — los componentes ya tienen hueco para
  enchufarlas (hero, fichas) cuando haya generación de imagen disponible.
