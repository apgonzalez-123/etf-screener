# CLAUDE.md

The full build brief lives at `docs/PROMPT.md`, which is internal and kept out of git; ask the owner for a copy. Its non-negotiables and acceptance tests are the contract.

- `pipeline/`: Python 3.9+, pydantic. `registry.py` is the only place columns are declared; `sources.py` is the only place network calls happen; `calc.py` holds pure formulas that the UI also shows in tooltips.
- `web/`: React 18 + TypeScript strict + Vite. Every number renders through `components/Num.tsx` (source, as-of, formula). `lib/data.ts` is the provider seam; swap the static snapshot for a live service there, not in pages.
- Never render a fabricated value: missing → "—". Never show raw fund codes.
- Run `pytest`, `vitest`, and `playwright test` before committing.
