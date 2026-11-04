/**
 * Generic helpers over a carrier form definition. No carrier knowledge.
 */
import type { CarrierField, CarrierForm } from "./types";

export function fieldByKey(form: CarrierForm, key: string): CarrierField | undefined {
  return form.fields.find((f) => f.key === key);
}

/** The options of a select or multiselect field. Throws for other field types. */
export function optionsOf(field: CarrierField): ReadonlyArray<string | number> {
  if (field.type === "select" || field.type === "multiselect") return field.options;
  throw new Error(`Field "${field.key}" has no options`);
}

/** undefined, null, an empty or whitespace string, or an empty array. `false` and 0 are values. */
export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Whether a field is shown given the current values. A field whose showIf parent is itself
 * hidden is hidden too. `depth` guards against a cyclic showIf chain in a bad carrier JSON.
 */
export function isFieldVisible(
  form: CarrierForm,
  field: CarrierField,
  values: Record<string, unknown>,
  depth = 0,
): boolean {
  const cond = field.showIf;
  if (!cond) return true;
  if (depth > form.fields.length) return false;
  const parent = fieldByKey(form, cond.field);
  if (parent && !isFieldVisible(form, parent, values, depth + 1)) return false;
  const parentValue = values[cond.field];
  return Array.isArray(parentValue) ? parentValue.includes(cond.includes) : parentValue === cond.includes;
}

export function visibleFields(form: CarrierForm, values: Record<string, unknown>): CarrierField[] {
  return form.fields.filter((f) => isFieldVisible(form, f, values));
}
