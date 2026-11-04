import { createAdapter } from "@/lib/adapter";
import type { CarrierForm } from "@/lib/types";
import formJson from "./form.json";
import { harborEligibilityRules, harborResolvers, harborValidationRules } from "./mapping";

/** Harbor's form, verbatim from the carrier. */
export const harborForm = formJson as CarrierForm;

export const harborAdapter = createAdapter({
  id: "harbor",
  name: "Harbor",
  form: harborForm,
  resolvers: harborResolvers,
  eligibilityRules: harborEligibilityRules,
  customRules: harborValidationRules,
});
