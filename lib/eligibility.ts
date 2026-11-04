/**
 * Eligibility: can this carrier quote this customer at all? Generic, driven by the form JSON
 * and the resolved profile values, plus the carrier's own eligibility rules. Runs before the
 * customer is asked anything and returns every failing reason.
 */
import { ageOn, birthdayAfterYears, longDate, toIsoDate } from "./convert";
import { effectiveValues } from "./request";
import type { CarrierAdapter, CarrierForm, CustomerProfile, EligibilityReason, EligibilityResult, Resolutions } from "./types";

const listOptions = (options: ReadonlyArray<string | number>) => options.map(String).join(", ");

/** The rules the form JSON itself expresses. */
export function eligibilityFromForm(form: CarrierForm, resolutions: Resolutions, now: Date): EligibilityReason[] {
  const reasons: EligibilityReason[] = [];

  for (const field of form.fields) {
    const resolution = resolutions[field.key];
    if (!resolution || resolution.value === undefined) continue;

    // Rule: a date field with validation.minAge.
    if (field.type === "date" && field.validation?.minAge !== undefined) {
      const iso = toIsoDate(resolution.value, field.format);
      const age = iso ? ageOn(iso, now) : null;
      if (iso && age !== null && age < field.validation.minAge) {
        const minAge = field.validation.minAge;
        const eligibleFrom = birthdayAfterYears(iso, minAge);
        reasons.push({
          fieldKey: field.key,
          label: field.label,
          message:
            `Applicants must be at least ${minAge}. You are ${age} today` +
            (eligibleFrom ? ` and become eligible on ${longDate(eligibleFrom)}.` : "."),
        });
      }
    }

    // Rule: a required select whose value is a fact from the profile ("answered") but is not
    // one of the carrier's options. The customer cannot change a fact, so this is not a question.
    if (field.type === "select" && field.required && resolution.status === "answered") {
      if (!field.options.includes(resolution.value as string | number)) {
        reasons.push({
          fieldKey: field.key,
          label: field.label,
          message: `${field.label}: ${String(resolution.value)} is not one of ${listOptions(field.options)}.`,
        });
      }
    }
  }

  return reasons;
}

export function checkEligibility(adapter: CarrierAdapter, profile: CustomerProfile, now: Date): EligibilityResult {
  const { form } = adapter;
  const resolutions = adapter.resolve(profile, now);
  const values = effectiveValues(form, resolutions, {});
  const ctx = { profile, form, resolutions, values, now };

  const reasons = [
    ...eligibilityFromForm(form, resolutions, now),
    ...adapter.eligibilityRules.flatMap((rule) => rule(ctx)),
  ];
  return { eligible: reasons.length === 0, reasons };
}
