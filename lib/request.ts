/**
 * Builds a carrier request from profile resolutions and customer answers. Generic.
 */
import { formatDate, isIsoDate } from "./convert";
import { isBlank, isFieldVisible } from "./form";
import type { Answers, CarrierForm, Resolutions } from "./types";

function hasAnswer(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true; // an empty array is an explicit answer of "nothing"
}

/**
 * Per field: an answered field always takes the profile's value (it is read-only);
 * a partial or unknown field takes the customer's answer, falling back to the pre-filled value.
 */
export function effectiveValues(form: CarrierForm, resolutions: Resolutions, answers: Answers): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of form.fields) {
    const resolution = resolutions[field.key];
    const answer = answers[field.key];
    const value = resolution?.status === "answered" ? resolution.value : hasAnswer(answer) ? answer : resolution?.value;
    if (value !== undefined) values[field.key] = value;
  }
  return values;
}

/**
 * Keys follow the form's field order. Fields hidden by showIf are omitted, and so are blank
 * values (an unanswered optional field is absent, never `false` or ""). Date fields given as
 * ISO (what a date input produces) are converted to the carrier's format.
 */
export function buildRequest(form: CarrierForm, resolutions: Resolutions, answers: Answers): Record<string, unknown> {
  const values = effectiveValues(form, resolutions, answers);
  const request: Record<string, unknown> = {};
  for (const field of form.fields) {
    if (!isFieldVisible(form, field, values)) continue;
    const value = values[field.key];
    if (isBlank(value)) continue;
    request[field.key] = field.type === "date" && isIsoDate(value) ? formatDate(value, field.format) : value;
  }
  return request;
}
