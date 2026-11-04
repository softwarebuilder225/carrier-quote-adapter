import { createAdapter } from "@/lib/adapter";
import type { CarrierForm } from "@/lib/types";
import formJson from "./form.json";
import { harborResolvers } from "./mapping";

/** Harbor's form, verbatim from the carrier. */
export const harborForm = formJson as CarrierForm;

export const harborAdapter = createAdapter({ id: "harbor", form: harborForm, resolvers: harborResolvers });
