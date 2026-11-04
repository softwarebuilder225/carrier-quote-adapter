/**
 * Harbor Assurance, renters: one resolver per field key in form.json.
 * This is the only file that knows Harbor's field keys. See docs/mapping.md.
 */
import { ceilToOption, formatDate, fullName, matchOption, stateName } from "@/lib/convert";
import { fieldByKey, optionsOf } from "@/lib/form";
import type { EligibilityRule, FieldResolution, ResolverMap, ValidationRule } from "@/lib/types";

function resolution(status: FieldResolution["status"], value?: unknown, hint?: string): FieldResolution {
  const r: FieldResolution = { status };
  if (value !== undefined) r.value = value;
  if (hint) r.hint = hint;
  return r;
}
const answered = (value: unknown) => resolution("answered", value);
const partial = (value: unknown, hint: string) => resolution("partial", value, hint);
const unknown = (hint?: string) => resolution("unknown", undefined, hint);
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const harborResolvers: ResolverMap = {
  applicant_full_name: (p) => {
    const name = fullName(p.first_name, p.last_name);
    return name ? answered(name) : unknown();
  },

  date_of_birth: (p, { field }) => {
    // Same meaning, different format: YYYY-MM-DD -> MM/DD/YYYY, by string split.
    const formatted = field.type === "date" ? formatDate(p.date_of_birth, field.format) : null;
    return formatted ? answered(formatted) : unknown();
  },

  contact_email: (p) => {
    const email = (p.email ?? "").trim();
    return email ? answered(email) : unknown();
  },

  // The profile has no phone number.
  phone: () => unknown(),

  residence_state: (p) => {
    // Code -> full name. A state outside Harbor's options is a fact about the customer, so it is
    // an eligibility failure (lib/eligibility), never a question. An unrecognised code is passed
    // through unchanged so the eligibility message shows what the profile contained.
    const name = stateName(p.state ?? "");
    return answered(name ?? p.state);
  },

  postal_code: (p) => {
    const zip = (p.zip ?? "").trim();
    return zip ? answered(zip) : unknown();
  },

  contents_coverage: (p, { field }) => {
    // Not the same thing: the value of the belongings is a fact, the coverage amount is a
    // purchase. We pre-fill the smallest option that covers the belongings (round UP, never
    // under-insure) and let the customer confirm.
    const value = p.personal_property_value;
    if (!isNumber(value) || value <= 0) return unknown();
    const options = optionsOf(field);
    const bucket = ceilToOption(value, options);
    if (bucket === null) {
      // ASSUMPTION A1 (docs/decisions.md #4): above the largest option the customer is
      // ineligible; that rule lives in the Harbor eligibility rules. Here we only report why
      // there is no value.
      const max = Math.max(...options.filter(isNumber));
      return unknown(`Your profile lists ${usd(value)} of belongings, above the largest option offered (${usd(max)}).`);
    }
    return partial(bucket, `Your profile lists ${usd(value)} of belongings; ${usd(bucket)} is the smallest option that covers it.`);
  },

  pets: (p) =>
    // has_dog only says whether "Dog" belongs in the list. It says nothing about cats or other
    // animals, and false is not "None". Always confirmed by the customer.
    p.has_dog
      ? partial(["Dog"], "Your profile says there is a dog. Add any other pets, then confirm.")
      : partial(undefined, 'Your profile says there is no dog. Select any other pets, or "None".'),

  dog_breed: (p, { field }) => {
    // Shown only when pets includes "Dog" (showIf). If the customer adds a dog the profile did
    // not know about, the field appears and is asked.
    if (!p.has_dog) return unknown();
    const breed = (p.dog_breed ?? "").trim();
    if (!breed) return unknown("Your profile has a dog but no breed.");
    const options = optionsOf(field).map(String);
    const match = matchOption(breed, options, null);
    if (match) return answered(match);
    return partial("Other", `Your profile lists the breed as "${breed}", which is not one of the options, so "Other" is pre-selected.`);
  },

  claims_last_5_years: (p) => {
    // Different time window. The 3-year count is a lower bound for the 5-year count, not the
    // value, so this is asked. Not pre-filled: a pre-filled number invites silent under-reporting.
    // The floor (answer >= claims_last_3_years) is enforced by Harbor's custom validation rule.
    const n = p.claims_last_3_years;
    if (!isNumber(n)) return unknown();
    return unknown(`You reported ${n} ${n === 1 ? "claim" : "claims"} in the last 3 years, so the 5-year count is at least ${n}.`);
  },

  // The profile knows nothing about the building.
  building_has_sprinklers: () => unknown(),
};

/**
 * Harbor rules that the form JSON does not express. Each is an ASSUMPTION logged in
 * docs/decisions.md and kept here, next to the mapping, rather than in the generic engines.
 */
export const harborEligibilityRules: EligibilityRule[] = [
  // ASSUMPTION A1 (decisions.md #4): belongings worth more than the largest contents option
  // cannot be covered by Harbor's product, so Harbor does not quote.
  ({ profile, form }) => {
    const field = fieldByKey(form, "contents_coverage");
    if (!field) return [];
    const max = Math.max(...optionsOf(field).filter(isNumber));
    const value = profile.personal_property_value;
    if (!isNumber(value) || value <= max) return [];
    return [
      {
        fieldKey: field.key,
        label: field.label,
        message: `Your belongings are valued at ${usd(value)}, above the largest contents coverage offered, ${usd(max)}.`,
      },
    ];
  },
];

export const harborValidationRules: ValidationRule[] = [
  // ASSUMPTION A2 (decisions.md #1): the last 5 years contain the last 3, so the 5-year count
  // cannot be below the 3-year count the profile already holds.
  ({ profile, values }) => {
    const answer = values.claims_last_5_years;
    const floor = profile.claims_last_3_years;
    if (!isNumber(answer) || !isNumber(floor) || answer >= floor) return [];
    return [
      {
        fieldKey: "claims_last_5_years",
        message:
          `You reported ${floor} ${floor === 1 ? "claim" : "claims"} in the last 3 years. ` +
          `The last 5 years include those 3, so this cannot be lower than ${floor}.`,
      },
    ];
  },
  // ASSUMPTION A3 (decisions.md #13): "None" cannot be combined with another pet.
  ({ values }) => {
    const pets = values.pets;
    if (!Array.isArray(pets) || !pets.includes("None") || pets.length < 2) return [];
    return [{ fieldKey: "pets", message: '"None" cannot be combined with other pets.' }];
  },
];
