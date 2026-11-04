/**
 * Turns a carrier's form JSON plus its resolver map into a CarrierAdapter. Generic.
 */
import { parseCarrierForm } from "./form";
import { buildRequest } from "./request";
import { checkFormat } from "./validate";
import type {
  Answers,
  CarrierAdapter,
  CarrierForm,
  CustomerProfile,
  EligibilityRule,
  FieldResolution,
  Resolutions,
  ResolverMap,
  ValidationRule,
} from "./types";

export interface AdapterConfig {
  id: string;
  name: string;
  /** The carrier's form JSON, validated by parseCarrierForm when the adapter is created. */
  form: unknown;
  resolvers: ResolverMap;
  eligibilityRules?: EligibilityRule[];
  customRules?: ValidationRule[];
  exclusiveOptions?: Record<string, string[]>;
}

/**
 * A fact from the profile that fails the field's own format check (pattern, email, date,
 * number range) becomes editable, with the problem explained, so the customer can correct
 * it instead of facing a read-only error. Closed-option fields are left alone: a value
 * outside the options is a fact for lib/eligibility, never a question.
 */
function correctable(field: CarrierForm["fields"][number], resolution: FieldResolution): FieldResolution {
  if (resolution.status !== "answered" || field.type === "select" || field.type === "multiselect") return resolution;
  const problem = checkFormat(field, resolution.value);
  if (!problem) return resolution;
  return {
    status: "partial",
    value: resolution.value,
    hint: `Your profile has "${String(resolution.value)}", which does not look right (${problem.replace(/\.$/, "")}). Please correct it.`,
  };
}

export function createAdapter({
  id,
  name,
  form: formJson,
  resolvers,
  eligibilityRules = [],
  customRules = [],
  exclusiveOptions = {},
}: AdapterConfig): CarrierAdapter {
  const form = parseCarrierForm(formJson);
  const resolve = (profile: CustomerProfile, now: Date): Resolutions => {
    const resolutions: Resolutions = {};
    for (const field of form.fields) {
      const resolver = resolvers[field.key];
      // A field with no resolver is simply asked. The carrier test suite checks coverage.
      const resolution = resolver ? resolver(profile, { field, form, now }) : { status: "unknown" as const };
      resolutions[field.key] = correctable(field, resolution);
    }
    return resolutions;
  };

  const toRequest = (profile: CustomerProfile, answers: Answers, now: Date) =>
    buildRequest(form, resolve(profile, now), answers);

  return { id, name, form, resolve, toRequest, eligibilityRules, customRules, exclusiveOptions };
}
