# Carrier quote adapter (take-home assessment)

Read docs/assessment.md first. It is the source of truth for the customer profile, the
Harbor form JSON and the two sample profiles. Never edit those inputs. docs/mapping.md
(once it exists) is the agreed field-mapping design; docs/decisions.md is the decision log.

## Stack
- Next.js App Router, TypeScript strict, Vitest, pnpm. No backend, DB, auth, or UI library.
- `pnpm test` runs tests, `pnpm dev` runs the app, `pnpm build && pnpm lint` must stay green.

## Architecture rules
- All mapping, eligibility, validation and adapter logic lives in `lib/` and never imports
  React. It must be callable from tests with plain objects.
- A carrier is data plus one mapping module: `lib/carriers/<id>/form.json` and
  `lib/carriers/<id>/mapping.ts`. The renderer and validator are generic and driven by the
  form JSON. Nothing outside `lib/carriers/harbor/` may mention a Harbor field key.
- Every field resolution carries a status: `answered` (profile fully answers it, shown
  read-only), `partial` (profile gives a hint, customer must confirm), `unknown` (ask).
- Anything that depends on "today" takes a `now: Date` parameter. Parse `YYYY-MM-DD` by
  splitting the string; never `new Date("YYYY-MM-DD")` (UTC shift bug).

## Working rules
- Do not invent carrier rules that are not in the form JSON. When a rule is an assumption,
  mark it `// ASSUMPTION:` in code and append it to docs/decisions.md.
- State a short plan before editing. Keep diffs small and explain non-obvious choices.
- Never run `git commit` or `git push`; I review and commit after each step.
- Tests first for anything in `lib/`. Run `pnpm test` and paste the result when done.
