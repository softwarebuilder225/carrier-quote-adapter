# Carrier quote adapter

Connects our standard customer profile to an insurance carrier's quote form, using Harbor Assurance
(renters) as the first carrier. The adapter turns a profile into Harbor's exact request; the page
renders Harbor's form from its JSON, pre-fills what the profile answers, asks only for the rest, and
refuses clearly when Harbor cannot quote the customer. No backend, database or auth.

Requires Node 22 (`.nvmrc` is included, so `nvm use` picks it). Then:

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm test     # 98 Vitest tests; pnpm build && pnpm lint also pass
```

Stack: Next.js 16 (App Router), React 19, TypeScript strict, Vitest 5. All mapping, eligibility and
validation logic lives in `lib/` with no React imports; components only render and collect answers.

## How the mapping works

The full field-by-field analysis is in [docs/mapping.md](docs/mapping.md). Every Harbor field resolves
to one of three statuses: **answered** (the profile fully determines it, shown read-only), **partial**
(the profile gives a candidate or a hint, pre-filled but confirmed by the customer) or **unknown**
(asked). Three Harbor fields look like profile fields but are not the same thing:

- **Claims window.** `claims_last_3_years` is not `claims_last_5_years`: a 3-year count is only a lower
  bound for a 5-year count. The field is asked, empty, with the hint "you reported N claims in the last
  3 years, so this is at least N", and an answer below N is rejected at submit.
- **has_dog vs pets.** A boolean about dogs says nothing about cats or other animals, and `false` is not
  "None". Pets is partial: "Dog" is pre-ticked when `has_dog` is true, nothing is pre-ticked otherwise,
  and the customer always confirms the full list.
- **Property value vs coverage buckets.** The value of the belongings is a fact; the coverage amount is a
  purchase. Coverage is pre-filled with the smallest Harbor option that covers the value (32,000 becomes
  50,000; rounding to nearest would under-insure by 7,000) and stays editable.

Formats are converted, never guessed: `1994-03-12` becomes `03/12/1994` by string splitting, `OR`
becomes `Oregon`, and a free-text breed is matched against Harbor's list with "Other" as the fallback.

## Eligibility

Checked before the customer is asked anything; every failing reason is reported, not just the first.

- From the form JSON: `date_of_birth.validation.minAge = 21`, and `residence_state` is a closed list
  (California, Oregon, Washington, Arizona). A state outside it is a fact about the customer, so it is a
  reason, never a select to "choose" from.
- Assumption, not in the JSON: a property value above the largest coverage option (75,000) is ineligible,
  with the maximum named in the reason.
- Data sanity: a birth date in the future is reported as a bad profile value rather than a negative age.

## Assumptions

Each is logged in [docs/decisions.md](docs/decisions.md) with its origin and the alternative rejected.

- Property value above 75,000 is ineligible. Rejected: cap at 75,000 and warn about under-coverage.
- The 5-year claims answer must be at least the 3-year count. Rejected: accept any number.
- "None" in pets cannot be combined with other pets, enforced in the UI and at submit. Rejected: leave it.
- Profile `state` is the state of residence and first/last name form the legal name. Rejected: re-ask.
- A claims count must be a whole number; the JSON only says `type: number, min: 0`. Rejected: allow 1.5.
- A profile fact that fails its own format check (zip, email) becomes editable with the problem explained;
  closed-option facts such as the state stay read-only. Rejected: a validation error on a read-only field.
- Coverage is editable (partial) rather than read-only, because the amount is a choice. Rejected: lock it.
- An unlisted breed pre-selects "Other" and shows the original text. Rejected: substring matching.
- An unanswered optional field is omitted from the request. Rejected: send `false`.
- No invented carrier rules: no breed exclusions (Pit Bull and Rottweiler are options), no claims
  maximum, no maximum age, no phone format beyond "something was entered", no ZIP-to-state check.

## What I'd do with more time

- Move the browser click-through into the repo as a Playwright test in CI. Today it is a 35-check script
  I ran locally against the production build (both profiles, a pasted profile, live showIf, submit).
- Record contradictions between the profile and the answers, such as `has_dog: true` with "Dog" unticked,
  and pass them to underwriting instead of silently trusting the answer.
- A route per carrier (`/quote/[carrier]`) driven by the registry; the page currently hard-codes Harbor.
- Per-carrier friendly messages for patterns, so `^\d{5}(-\d{4})?$` reads "Enter a 5-digit ZIP code".
- Breed matching that ignores punctuation ("Pit-Bull", "Pitbull") plus a per-carrier synonym table.
- Re-read the date at submit so a tab left open past midnight does not age-check against yesterday.

## Scaling to 50 carriers

A carrier is one folder: `lib/carriers/<id>/form.json` (verbatim from the carrier), `mapping.ts` (one
resolver per field plus the carrier's own rules) and its tests, registered with one line in
`lib/carriers/index.ts`. Nothing else changes. The pieces that make that hold:

- **The CarrierAdapter contract** (`lib/types.ts`): `resolve(profile, now)`, `toRequest(profile, answers,
  now)`, eligibility and validation hooks, and UI hints such as exclusive options, all built by
  `createAdapter`, which validates the carrier JSON at startup and fails loudly on an unknown field type.
- **The shared converter library** (`lib/convert.ts`): dates by string splitting, age at the birthday
  boundary, state codes, round-up to an option, option matching. Carrier modules compose these.
- **The generic renderer and validator**: `components/CarrierForm.tsx`, `lib/validate.ts` and
  `lib/eligibility.ts` are driven by the form JSON and the resolution statuses and never mention a key.
- **A per-carrier contract-test suite**: run every registered adapter against the sample profiles and
  assert the invariants (every resolution has a valid status, request keys are a subset of the form's keys
  in form order, hidden fields never appear, reasons carry labels). Harbor's tests are the template.
- **A mapping-coverage check** that fails CI when a carrier JSON gains a field with no resolver. It exists
  for Harbor today as a test; it becomes a loop over the registry.
- **A declarative mapping format** for simple carriers, e.g. `{ "contact_email": { "from": "email" },
  "date_of_birth": { "from": "date_of_birth", "convert": "date" } }`, with `mapping.ts` as the escape hatch
  for fields like pets or claims that need judgment.
- **Versioned carrier JSON**: `form.v2.json` beside `form.v1.json`, the version stamped on the request,
  the old mapping kept until the contract tests pass against the new file.

## Sample results (as of 2026-11-04)

**Profile A, Maya Torres: eligible.** Pre-filled read-only: name, birth date 03/12/1994, email, Oregon,
97205, breed Labrador. Pre-filled and editable: coverage 50,000, pets [Dog]. Asked: phone, claims in the
last 5 years (hint: at least 0), sprinklers (optional). With phone 503-555-0100, claims 0 and sprinklers
yes, the request is:

```json
{
  "applicant_full_name": "Maya Torres",
  "date_of_birth": "03/12/1994",
  "contact_email": "maya@example.com",
  "phone": "503-555-0100",
  "residence_state": "Oregon",
  "postal_code": "97205",
  "contents_coverage": 50000,
  "pets": ["Dog"],
  "dog_breed": "Labrador",
  "claims_last_5_years": 0,
  "building_has_sprinklers": true
}
```

**Profile B, Sam Lee: ineligible, both reasons shown, no submit button.**

1. State of residence: Nevada is not one of California, Oregon, Washington, Arizona.
2. Applicants must be at least 21. You are 20 today and become eligible on January 20, 2027.

The form is still rendered, disabled, so the reviewer can see what would have been asked: coverage
25,000 (12,000 rounded up), nothing pre-ticked in pets, breed hidden, claims hint "at least 1".

## How I used AI

I used Claude Code for this project, with CLAUDE.md for project rules and docs/assessment.md for the requirements, so I didn't have to keep repeating the context.

Before writing code, I used plan mode to create a mapping table. I reviewed it against the spec myself and corrected <N> rows, which I documented in docs/decisions.md.

I then used the expected values to write tests in lib/tests before implementing the code.

Afterward, I ran the tests, checked both sample profiles in the browser, and used an adversarial review prompt to catch anything I might have missed. <One issue was fixed, and another was rejected.>

I reviewed every diff and made all commits myself.