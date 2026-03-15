# FamilyQuest — Convenciones y Contexto del Proyecto

## Stack
- **Framework**: Next.js 16 + React 19 + TypeScript (App Router)
- **DB**: Supabase (PostgreSQL con RLS)
- **Auth**: Supabase Auth (Google OAuth)
- **AI**: Google GenAI API (@google/genai)
- **UI**: Tailwind CSS 4 + PostCSS
- **Hosting**: Vercel
- **GitHub**: ranabunker80/family_quest

## Naming
- **Archivos**: kebab-case
- **Componentes**: PascalCase
- **Variables/funciones**: camelCase
- **Path alias**: `@/*` → `./src/*`

## Idioma
- **UI**: ESPAÑOL
- **Código (variables, funciones)**: INGLÉS

## Commands
```bash
npm run dev    # Desarrollo
npm run build  # Build producción
npm run lint   # ESLint
```

---

## Estado del Proyecto y Memoria Compartida

> Esta sección permite a cualquier instancia de Claude Code tener contexto completo del proyecto, sin importar en qué computadora se trabaje.

### Qué es FamilyQuest
App gamificada para 3 niños (9-11 años) con economía familiar: misiones, recompensas, y juegos educativos.

### Usuarios
- **Isaac, Elias, Sara** (9-11 años) — los 3 niños
- **Andrea** (mamá) — rol parent
- **Dispositivo**: Tablet Samsung, landscape es su orientación preferida
- Touch targets mínimo 56px (auditoría UX infantil)
- Auth: Google OAuth (pendiente probar con Family Link para cuentas de niños)

### Juegos implementados
1. **Spelling Bee** ✅ Funcional — 3 dificultades, score, streak, timer. 99 imágenes + 99 audios. Layout landscape side-by-side confirmado por niños.
2. **Copa de Mates** ✅ Implementado, pendiente testing — Para Sara (Copa Nacional, 4to grado). 8 categorías. Generación procedural. Teclado numérico on-screen.
3. **Misión Examen** ✅ Implementado, pendiente testing — Para Isaac y Elias. 3 mundos: Español (2 niveles), Ciencias+FCyE (4 niveles), Matemáticas (4 niveles). 8 tipos de pregunta. Sin timer (modo estudio).

### Features implementadas
- Parent Preview Mode (jugar sin guardar resultados)
- Analytics por hijo (desglose por categoría, alertas, barras de progreso)
- Economía gamificada: Coins, misiones, recompensas
- UI: Toast/ConfirmModal con glassmorphism, confetti

### Archivos clave
- `src/components/game/GameEngine.tsx` — Motor Spelling Bee
- `src/components/game/MathEngine.tsx` — Motor Copa de Mates
- `src/components/game/ExamEngine.tsx` — Motor Misión Examen
- `src/components/game/ExamPrepHub.tsx` — Hub con 3 mundos
- `src/lib/exam-data/` — Contenido de exámenes (spanish.ts, science.ts, math-exam.ts)
- `src/lib/math-problems.ts` — Generador procedural de problemas
- `src/lib/words.ts` — 100 palabras en 10 categorías

### Pendientes prioritarios
1. Probar Misión Examen end-to-end en browser y tablet Samsung
2. Probar Copa de Mates end-to-end
3. Aplicar layout side-by-side landscape al MathEngine + NumericKeyboard
4. Verificar login Google de Andrea y niños (Family Link)
5. Modo práctica por categoría individual
6. Gráfica de progreso histórico
7. Agregar más preguntas de examen si los niños terminan rápido

### Notas técnicas
- `submitGameResult` guarda en tabla `game_results` (antes solo ledger)
- Analytics empiezan a llenarse desde la implementación (no hay datos históricos)
- Layout landscape side-by-side ya probado y confirmado en Spelling Bee → aplicar a MathEngine

### Última sesión: 2026-02-28
