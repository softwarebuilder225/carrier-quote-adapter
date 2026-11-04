/**
 * Turns a carrier's form JSON plus its resolver map into a CarrierAdapter. Generic.
 */
import { buildRequest } from "./request";
import type {
  Answers,
  CarrierAdapter,
  CarrierForm,
  CustomerProfile,
  EligibilityRule,
  Resolutions,
  ResolverMap,
  ValidationRule,
} from "./types";

export interface AdapterConfig {
  id: string;
  form: CarrierForm;
  resolvers: ResolverMap;
  eligibilityRules?: EligibilityRule[];
  customRules?: ValidationRule[];
}

export function createAdapter({ id, form, resolvers, eligibilityRules = [], customRules = [] }: AdapterConfig): CarrierAdapter {
  const resolve = (profile: CustomerProfile, now: Date): Resolutions => {
    const resolutions: Resolutions = {};
    for (const field of form.fields) {
      const resolver = resolvers[field.key];
      // A field with no resolver is simply asked. The carrier test suite checks coverage.
      resolutions[field.key] = resolver ? resolver(profile, { field, form, now }) : { status: "unknown" };
    }
    return resolutions;
  };

  const toRequest = (profile: CustomerProfile, answers: Answers, now: Date) =>
    buildRequest(form, resolve(profile, now), answers);

  return { id, form, resolve, toRequest, eligibilityRules, customRules };
}
