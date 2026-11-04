import { createAdapter } from "@/lib/adapter";
import formJson from "./form.json";
import { harborEligibilityRules, harborExclusiveOptions, harborResolvers, harborValidationRules } from "./mapping";

export const harborAdapter = createAdapter({
  id: "harbor",
  name: "Harbor",
  form: formJson, // verbatim from the carrier; validated by createAdapter
  resolvers: harborResolvers,
  eligibilityRules: harborEligibilityRules,
  customRules: harborValidationRules,
  exclusiveOptions: harborExclusiveOptions,
});

/** Harbor's form, typed. */
export const harborForm = harborAdapter.form;
