/**
 * Submit-time validation of the merged values against the form JSON: required, type,
 * pattern, min and max, with showIf gating (a hidden field is neither required nor
 * validated). Then the carrier's customRules. Generic; nothing here knows a field key.
 */
import { toIsoDate } from "./convert";
import { isBlank, isFieldVisible } from "./form";
import { effectiveValues } from "./request";
import type { Answers, CarrierAdapter, CarrierField, CarrierForm, CustomerProfile, Resolutions, ValidationError } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The error for one visible, non-blank value, or null when it is acceptable. */
function checkValue(field: CarrierField, value: unknown): string | null {
  switch (field.type) {
    case "text": {
      if (typeof value !== "string") return "Enter text.";
      if (field.pattern && !new RegExp(field.pattern).test(value.trim())) return `Must match the format ${field.pattern}.`;
      return null;
    }
    case "email":
      return typeof value === "string" && EMAIL.test(value.trim()) ? null : "Enter a valid email address.";
    case "tel":
      // The carrier gives no pattern, so no format is invented: a non-empty string is accepted.
      return typeof value === "string" ? null : "Enter a phone number.";
    case "date":
      return toIsoDate(value, field.format) ? null : `Enter a date as ${field.format}.`;
    case "select":
      return field.options.includes(value as string | number) ? null : "Choose one of the listed options.";
    case "multiselect":
      return Array.isArray(value) && value.every((v) => field.options.includes(v as string))
        ? null
        : "Choose only from the listed options.";
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return "Enter a number.";
      if (field.min !== undefined && value < field.min) return `Must be at least ${field.min}.`;
      if (field.max !== undefined && value > field.max) return `Must be at most ${field.max}.`;
      return null;
    }
    case "boolean":
      return typeof value === "boolean" ? null : "Choose yes or no.";
  }
}

/** Validates merged values against the form only. */
export function validateValues(form: CarrierForm, values: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const field of form.fields) {
    if (!isFieldVisible(form, field, values)) continue;
    const value = values[field.key];
    if (isBlank(value)) {
      if (field.required) errors.push({ fieldKey: field.key, message: "Required." });
      continue;
    }
    const message = checkValue(field, value);
    if (message) errors.push({ fieldKey: field.key, message });
  }
  return errors;
}

/**
 * Form rules plus the carrier's customRules, over the profile resolutions merged with the
 * answers. A field gets one message: when the form-level check already failed for a field,
 * custom-rule errors for that field are dropped (fix the basic problem first).
 */
export function validate(adapter: CarrierAdapter, profile: CustomerProfile, answers: Answers, now: Date): ValidationError[] {
  const { form } = adapter;
  const resolutions: Resolutions = adapter.resolve(profile, now);
  const values = effectiveValues(form, resolutions, answers);
  const formErrors = validateValues(form, values);
  const failed = new Set(formErrors.map((e) => e.fieldKey));
  const customErrors = adapter.customRules
    .flatMap((rule) => rule({ profile, form, resolutions, values, now }))
    .filter((e) => !failed.has(e.fieldKey));
  return [...formErrors, ...customErrors];
}
