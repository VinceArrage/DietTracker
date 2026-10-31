# Diet Tracker

Phone-first PWA (React + TypeScript + Vite) for ticking off a daily diet plan against calorie/macro goals. No backend: data lives in the browser's IndexedDB.

## Commands

- `npm run dev` — dev server at http://localhost:5173/DietTracker/
- `npm test` — Vitest (jsdom + fake-indexeddb)
- `npm run lint` — ESLint, zero warnings allowed
- `npm run build` — type-check + production build (PWA service worker included)

## Layout

- `src/domain/` — pure logic, no React or storage: `nutrition.ts` (portion scaling, units), `plan.ts` (seed → plan), `day.ts` (the editable day and its totals). Every function returns new objects; never mutate inputs.
- `src/storage/repo.ts` — the only module that touches IndexedDB; export/import is zod-validated, `schemaVersion: 1`.
- `src/lookup/` — Open Food Facts + USDA search, normalized to `Food` (per 100 g).
- `src/screens/`, `src/components/` — UI. Screens load their own data on mount.
- `src/data/plan.seed.json` — Vincent's plan, transcribed from screenshots; first-run seed.

## Rules

- A day is a copy of the plan; edits on Today are today-only unless "Also update my plan" is ticked.
- Over goal is fine (green); only under goal is flagged.
- Day keys are local dates (`localDateKey`), never UTC.
- Test-first for domain logic; numbers in tests come from the plan screenshots.
