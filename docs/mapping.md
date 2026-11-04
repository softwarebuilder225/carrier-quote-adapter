# Field mapping: standard profile → Harbor Assurance renters form

Source of truth: `docs/assessment.md`. Date used for all age calculations: **2026-11-04**.

Statuses (from `CLAUDE.md`):

- **answered**: the profile fully and losslessly determines the value. Shown read-only.
- **partial**: the profile gives a candidate or a hint, but the customer must confirm. Shown editable, pre-filled.
- **unknown**: the profile says nothing usable. Asked.

Decisions from the review on 2026-11-04 are folded in (see `docs/decisions.md`); every open point is resolved (section 8).

## 1. "Looks alike but isn't the same" check

Each Harbor field against the closest profile field, on the four axes that must all match before a value may be copied across.

| Harbor key | Closest profile field | Same meaning? | Same time window? | Same scale / format? | Same option set? | Verdict |
|---|---|---|---|---|---|---|
| applicant_full_name | first_name + last_name | yes, assuming profile names are legal names | n/a | no: two strings vs one | n/a | lossless join → answered |
| date_of_birth | date_of_birth | yes | n/a | no: `YYYY-MM-DD` vs `MM/DD/YYYY` | n/a | lossless reformat → answered |
| contact_email | email | yes | n/a | yes | n/a | copy → answered |
| phone | (none) | — | — | — | — | unknown |
| residence_state | state | yes, assuming profile `state` is the state of residence | n/a | no: 2-letter code vs full name | no: Harbor lists 4 states, the profile allows 50+ | lossless code→name; a state outside the 4 is a *fact*, so it is an eligibility failure, not a question → answered |
| postal_code | zip | yes | n/a | compatible: 5 digits satisfies `^\d{5}(-\d{4})?$` | n/a | copy → answered |
| contents_coverage | personal_property_value | **no**: value of belongings (a fact) vs coverage amount bought (a choice) | n/a | **no**: continuous USD vs 4 buckets | **no** | derive a candidate, customer confirms → partial |
| pets | has_dog | **no**: "is there a dog" vs "which pets are in the home" | n/a | **no**: boolean vs multi-select | **no**: has_dog says nothing about Cat / Other / None | hint only → partial |
| dog_breed | dog_breed | yes | n/a | no: free text vs fixed list | **no**: 3 named breeds + Other | exact normalised match → answered; anything else → partial ("Other") |
| claims_last_5_years | claims_last_3_years | same kind of count | **no**: 3 years vs 5 years | yes | n/a | 3-year count is only a lower bound → unknown with hint |
| building_has_sprinklers | (none) | — | — | — | — | unknown |

Only four Harbor fields are plain copies (email, zip) or lossless transforms (name, date). The two
with the same *name* on both sides (`date_of_birth`, `dog_breed`) still need work: a format change
and an option mapping respectively. The three that are most tempting to copy and must **not** be
copied are `contents_coverage`, `pets` and `claims_last_5_years`.

## 2. Field-by-field mapping

| Harbor key | Profile source | Status | Transform | Eligibility impact | Notes |
|---|---|---|---|---|---|
| applicant_full_name | first_name, last_name | answered | trim each, join with one space | none | Required. Assumes profile names are legal names (no nickname field exists). |
| date_of_birth | date_of_birth | answered | split `YYYY-MM-DD` on `-`, emit `MM/DD/YYYY`. Never `new Date(string)` (UTC shift). Internal value stays ISO; the carrier format is applied on output and display only | **Rule E1**: `validation.minAge: 21`. Age on the application date must be ≥ 21, counted so that the applicant turns N on the birthday itself | Required. Malformed ISO date → treat as unknown and ask. |
| contact_email | email | answered | trim | none | Required. `type: email` is validated at submit. |
| phone | — | unknown | — | none | Required, asked. Harbor gives no pattern, so the only check is "non-empty" plus the browser's `tel` input. No stricter format is invented. |
| residence_state | state | answered | upper-case the code, look up the full name in a 50-state + DC table | **Rule E2**: the name must be one of California, Oregon, Washington, Arizona, otherwise Harbor cannot quote. The customer is never offered the select to "pick" a served state | Required. Unrecognised code (e.g. `ZZ`) → blocking reason "state code not recognised", distinct from E2. |
| postal_code | zip | answered | none | none | Required. Validated against Harbor's pattern at submit; ZIP+4 is accepted if a profile ever carries it. |
| contents_coverage | personal_property_value | partial | **round up**: the smallest option ≥ value. 32 000 → 50 000, 12 000 → 25 000, 10 000 → 10 000, 4 000 → 10 000. Pre-filled, editable, with the hint "Your profile lists $X of belongings; this is the smallest option that covers it" | **Rule A1 (assumption, decisions.md #4)**: value above 75 000, the largest option, → ineligible; the reason names the maximum | Required. Rounding to nearest would map 32 000 → 25 000 and under-insure by 7 000; rounding down always under-insures. Rounding up is the only direction that never leaves the customer short. Non-numeric or ≤ 0 value → unknown, ask. |
| pets | has_dog | partial | has_dog `true` → pre-fill `["Dog"]`; has_dog `false` → pre-fill nothing. In both cases the customer confirms the full list. Hint: "Your profile says there is a dog; add any other pets" or "Your profile says there is no dog; tell us about any other pets" | none | Required. `has_dog: false` does **not** mean "None": the profile never asked about cats or other animals. UI constraint (assumption A3): "None" cannot be combined with another option. |
| dog_breed | dog_breed | answered when the normalised text equals an option; partial ("Other") when it does not; unknown when a dog is present and breed is null | trim, case-insensitive exact match against `["Labrador","Pit Bull","Rottweiler","Other"]`; no match → "Other" with the hint "Profile says: <original text>" so the customer can correct a near-miss like "Labrador Retriever" | none. Pit Bull and Rottweiler are *options*, so Harbor quotes them; no breed exclusion is added | Required only when `pets` includes "Dog" (`showIf`). Hidden otherwise, and then neither validated nor submitted. If the customer adds "Dog" to a profile with `has_dog: false`, the field appears as unknown. |
| claims_last_5_years | claims_last_3_years (hint only) | unknown | not pre-filled. Hint: "You reported N claim(s) in the last 3 years, so this is at least N". Submit-time rule (assumption A2): answer ≥ claims_last_3_years, integer, ≥ `min: 0` | none. Harbor sets no maximum, so none is added | Required. Not pre-filled on purpose: a pre-filled "0" invites silent under-reporting on a question that carriers treat as misrepresentation. The 3-year count is a floor, never the value. |
| building_has_sprinklers | — | unknown | — | none | **Optional**, asked. Omitted from the request when unanswered rather than sent as `false`, because "didn't answer" is not "no". |

### Shared converters implied by the table (carrier-agnostic)

- `fullName(first, last)`: trim, join.
- `formatDate(iso, pattern)`: string split; supports at least `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`.
- `ageOn(iso, now)`: compare (year, month, day) tuples; 29 Feb birthdays count 1 Mar in non-leap years.
- `stateName(code)`: static table, returns `null` for unknown codes.
- `ceilToOption(value, options)`: smallest option ≥ value, `null` when none.
- `matchOption(text, options, fallback)`: normalised exact match, else `fallback`.

## 3. Eligibility rules derived from the form JSON

| Rule | Source in JSON | Message to the customer |
|---|---|---|
| E1: applicant must be at least 21 on the application date | `date_of_birth.validation.minAge = 21` | "Harbor requires applicants to be at least 21. You are 20 today and become eligible on 2027-01-20." |
| E2: state of residence must be one of the listed options | `residence_state.options` is a closed list and the value is a fact from the profile | "Harbor is not available in Nevada. It currently quotes in California, Oregon, Washington and Arizona." |

Plus one assumed rule that is **not** in the JSON: **A1** in section 4, personal_property_value above the largest coverage option (75 000) → ineligible. It is logged as an assumption in `docs/decisions.md` (#4).

Everything else in the JSON (`required`, `pattern`, `min`, `type`, `showIf`) is *validation*: the customer
can satisfy it by answering, so it never makes a profile ineligible. Eligibility is checked **before** the
customer is asked anything, and **all** failing reasons are reported together, not just the first.

## 4. Rules that are NOT in the JSON

Candidates we add, each flagged as an assumption and logged in `docs/decisions.md`:

| Id | Rule | Why we need it | Status |
|---|---|---|---|
| A1 | personal_property_value above 75 000 (the largest option) → ineligible; the reason names the maximum | the JSON is silent, and Harbor's product cannot cover the belongings | **adopted** (decisions.md #4; cap at 75 000 and warn was rejected) |
| A2 | claims_last_5_years must be ≥ claims_last_3_years | a 5-year window contains the 3-year window; a smaller number is impossible, so the answer would be a data error | **adopted** as validation, not eligibility (decisions.md #1) |
| A3 | "None" in `pets` is exclusive with "Dog", "Cat", "Other" | "None" plus "Dog" is contradictory | **adopted** (decisions.md #13) |
| A4 | Profile `state` is the state of residence; `first_name`/`last_name` are legal names | the profile has no other candidate fields | **adopted** (decisions.md #11) |

Rules deliberately **not** added, because the JSON does not contain them:

- Breed exclusions or surcharges. Pit Bull and Rottweiler are selectable options.
- A maximum number of claims, a maximum age, or a minimum property value.
- A phone number format beyond "something was entered".
- ZIP-to-state consistency, email domain checks.

## 5. Sample profile A (Maya Torres) on 2026-11-04

**Eligible.** Age 32 (E1 passes). State OR → Oregon, in the list (E2 passes).

| Shown as | Fields |
|---|---|
| Pre-filled, read-only (answered) | applicant_full_name "Maya Torres"; date_of_birth 03/12/1994; contact_email maya@example.com; residence_state Oregon; postal_code 97205; dog_breed Labrador (visible because pets includes Dog) |
| Pre-filled, editable (partial) | contents_coverage 50 000 (hint: belongings 32 000, smallest covering option); pets ["Dog"] (hint: confirm, add other pets) |
| Asked (unknown) | phone (required); claims_last_5_years (required, hint "at least 0"); building_has_sprinklers (optional) |

## 6. Sample profile B (Sam Lee) on 2026-11-04

**Ineligible, two reasons, both shown:**

1. E2: state NV → Nevada is not among California, Oregon, Washington, Arizona.
2. E1: born 2006-01-20, age 20 today, minimum 21; eligible from 2027-01-20.

No submit button. For transparency the form is still shown, disabled, with what would have been
pre-filled: name "Sam Lee"; date_of_birth 01/20/2006; email; residence_state Nevada (flagged);
postal_code 89501; contents_coverage 25 000 (12 000 rounded up); pets nothing pre-filled (has_dog
false says nothing about other pets); dog_breed hidden; claims_last_5_years asked with hint "at
least 1"; phone and sprinklers asked.

## 7. Expected Harbor request for profile A

Customer answers: phone "503-555-0100", pets ["Dog"], claims_last_5_years 0, building_has_sprinklers true,
and accepts the pre-filled coverage of 50 000. Keys are emitted in the form's field order.

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

Notes on the shape: `contents_coverage` is a number because Harbor's options are numbers;
`residence_state` is the full name because that is what the option list contains; `dog_breed` is
present only because `pets` includes "Dog"; `building_has_sprinklers` would be absent, not `false`,
if the customer had skipped it.

## 8. Review decisions (2026-11-04)

Resolved during review; the full log with origins is in `docs/decisions.md`:

- Q1, property value above 75 000: **ineligible**, the reason names the 75 000 maximum. Assumption A1,
  not in the JSON. The alternative, pre-fill 75 000 and warn about under-coverage, was rejected (decisions.md #4).
- Q3, claims_last_5_years: **asked with an empty input** and the "at least N" hint, never pre-filled,
  with the floor validated at submit (decisions.md #1).
- contents_coverage rounding: **up**, confirmed (decisions.md #3).
- pets: **partial**, confirmed (decisions.md #2).

Also confirmed on 2026-11-04, after being left open in the first draft:

- Q2, contents_coverage status: **partial**, pre-filled with the rounded-up option and editable,
  because meaning and scale differ (section 1, rule 1). The alternative, `answered` and read-only
  at the rounded-up option, was rejected (decisions.md #12).
- Q4, "None" exclusivity in pets (A3): **enforced** in the UI and at submit (decisions.md #13).

## 9. Proposed file layout

A second carrier is added with two files under `lib/carriers/<id>/` plus one registry line. Nothing
else changes.

```
lib/types.ts                        CustomerProfile; CarrierForm; CarrierField (discriminated union: text, email, tel, date, select, multiselect, number, boolean; showIf, pattern, min, format, validation.minAge); FieldResolution; CarrierAdapter
lib/convert.ts                      carrier-agnostic converters listed in section 2
lib/resolve.ts                      runs a carrier's resolvers over a profile → Record<key, FieldResolution>
lib/eligibility.ts                  generic: minAge from the JSON, closed-option facts, plus the adapter's extra rules; returns { eligible, reasons[] } with every reason
lib/validate.ts                     generic: required, pattern, min, type, showIf gating, plus the adapter's customRules; returns errors keyed by field
lib/request.ts                      generic buildRequest(form, resolutions, answers, now): answers override partial/unknown, keys in form order, showIf-hidden and unanswered-optional fields omitted, carrier date format applied
lib/carriers/index.ts               registry: { harbor: harborAdapter }, keyed by carrier id
lib/carriers/harbor/form.json       the Harbor JSON, verbatim from docs/assessment.md
lib/carriers/harbor/mapping.ts      one resolver per Harbor key + customRules (A2); the only file allowed to mention a Harbor key
lib/carriers/harbor/index.ts        createAdapter(form.json, mapping) → harborAdapter
lib/sample-profiles.ts              profiles A and B, verbatim
lib/__tests__/convert.test.ts       date, age boundary, state table, ceilToOption, matchOption
lib/__tests__/harbor.test.ts        resolutions for A and B; expected request for A (section 7)
lib/__tests__/eligibility.test.ts   B has exactly two reasons; A passes; birthday boundary
lib/__tests__/validate.test.ts      claims floor, showIf gating, postal pattern, optional field
app/layout.tsx                      unchanged shell
app/page.tsx                        thin: picks the carrier from the registry, renders QuoteFlow
app/globals.css                     minimal styles
components/QuoteFlow.tsx            client: profile switcher (A, B, paste JSON), eligibility panel, form, request output
components/CarrierForm.tsx          generic renderer: form JSON + resolutions → sections (from profile / confirm / we need more), live showIf, inline errors
components/FieldInput.tsx           one input per field type, carrier date format for display
```
