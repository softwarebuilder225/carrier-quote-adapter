/**
 * Builds a carrier request from profile resolutions and customer answers. Generic.
 */
import { formatDate, toIsoDate } from "./convert";
import { isBlank, isFieldVisible } from "./form";
import type { Answers, CarrierForm, Resolutions } from "./types";

/**
 * Per field: an answered field always takes the profile's value (it is read-only); a partial
 * or unknown field takes the customer's answer when one exists, else the pre-filled value.
 * Only `undefined` means "no answer": null, "" and [] are explicit answers (a cleared field),
 * so a customer can clear a pre-filled value and the required check then applies.
 */
export function effectiveValues(form: CarrierForm, resolutions: Resolutions, answers: Answers): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of form.fields) {
    const resolution = resolutions[field.key];
    const answer = answers[field.key];
    const value = resolution?.status === "answered" ? resolution.value : answer !== undefined ? answer : resolution?.value;
    if (value !== undefined) values[field.key] = value;
  }
  return values;
}

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : value);

/**
 * Keys follow the form's field order. Fields hidden by showIf are omitted, and so are blank
 * values (an unanswered optional field is absent, never `false` or ""). Strings are trimmed,
 * so the request matches what the validator checked. Date fields are emitted in the exact
 * carrier format, whether the value came in as ISO or loosely typed.
 */
export function buildRequest(form: CarrierForm, resolutions: Resolutions, answers: Answers): Record<string, unknown> {
  const values = effectiveValues(form, resolutions, answers);
  const request: Record<string, unknown> = {};
  for (const field of form.fields) {
    if (!isFieldVisible(form, field, values)) continue;
    const raw = values[field.key];
    if (isBlank(raw)) continue;
    const value = trimmed(raw);
    request[field.key] = field.type === "date" ? canonicalDate(value, field.format) : value;
  }
  return request;
}

/** ISO or loosely typed carrier-format input ("3/5/1990") becomes the exact carrier format. */
function canonicalDate(value: unknown, format: string): unknown {
  const iso = toIsoDate(value, format);
  return iso ? formatDate(iso, format) : value;
}
