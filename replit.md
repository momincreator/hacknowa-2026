# PhishGuard AI

PhishGuard AI analyzes suspicious URL text with safe, explainable heuristics before a user clicks.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/phishguard-ai run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/phishguard-ai/src/App.tsx` — responsive single-page analyzer UI
- `artifacts/phishguard-ai/src/index.css` — visual theme and responsive styling
- `artifacts/api-server/src/lib/url-analyzer.ts` — safe heuristic engine and optional AI provider adapter
- `artifacts/api-server/src/routes/analyze-url.ts` — analysis and AI explanation endpoints
- `lib/api-spec/openapi.yaml` — API source of truth
- `README.md` — product, setup, analysis, AI, and limitations documentation

## Architecture decisions

- Submitted links are parsed locally and never fetched, so analysis cannot trigger a suspicious destination.
- The heuristic engine remains fully functional without AI credentials; AI is an optional server-side explanation layer.
- OpenAPI generates both the frontend React Query client and server validation schemas.
- No database is required because the product does not persist user-submitted URLs.

## Product

Users paste a URL, receive a low/medium/high risk assessment, review the signals behind it, and get practical next steps.

## User preferences

- Mobile-first, hackathon-demo-ready cybersecurity UX with clear non-alarmist language.

## Gotchas

- `lib/api-spec/openapi.yaml` must be updated before rerunning codegen.
- AI provider values are server-only environment variables and must never be exposed in frontend code.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
