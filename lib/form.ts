/**
 * Generic helpers over a carrier form definition. No carrier knowledge.
 */
import type { CarrierField, CarrierForm, FieldType, ShowIfValue } from "./types";

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
  const has = (v: ShowIfValue) => (Array.isArray(parentValue) ? parentValue.includes(v) : parentValue === v);
  if ("includes" in cond) return has(cond.includes);
  if ("notIncludes" in cond) return !has(cond.notIncludes);
  return parentValue === cond.equals;
}

export function visibleFields(form: CarrierForm, values: Record<string, unknown>): CarrierField[] {
  return form.fields.filter((f) => isFieldVisible(form, f, values));
}

const FIELD_TYPES: ReadonlyArray<FieldType> = ["text", "email", "tel", "date", "select", "multiselect", "number", "boolean"];
const SHOW_IF_OPERATORS = ["includes", "notIncludes", "equals"] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Validates a carrier's form JSON at load time and returns it typed. Every problem is
 * listed in one error, so a bad carrier definition fails loudly when the adapter is
 * created instead of silently rendering nothing or validating nothing.
 */
export function parseCarrierForm(json: unknown): CarrierForm {
  if (!isRecord(json)) throw new Error("Carrier form must be a JSON object.");
  const problems: string[] = [];
  if (typeof json.carrier !== "string" || json.carrier === "") problems.push("carrier must be a non-empty string");
  if (typeof json.product !== "string" || json.product === "") problems.push("product must be a non-empty string");
  const fields: unknown[] = Array.isArray(json.fields) ? json.fields : [];
  if (fields.length === 0) problems.push("fields must be a non-empty array");

  const keys = new Set<string>();
  const showIfTargets: Array<{ where: string; target: string }> = [];

  fields.forEach((raw, index) => {
    if (!isRecord(raw)) {
      problems.push(`field #${index}: must be an object`);
      return;
    }
    const where = typeof raw.key === "string" && raw.key !== "" ? `field "${raw.key}"` : `field #${index}`;
    if (typeof raw.key !== "string" || raw.key === "") problems.push(`${where}: key must be a non-empty string`);
    else if (keys.has(raw.key)) problems.push(`${where}: duplicate key`);
    else keys.add(raw.key);
    if (typeof raw.label !== "string" || raw.label === "") problems.push(`${where}: label must be a non-empty string`);
    if (typeof raw.required !== "boolean") problems.push(`${where}: required must be true or false`);

    const type = raw.type;
    if (!FIELD_TYPES.includes(type as FieldType)) problems.push(`${where}: unsupported type "${String(type)}"`);
    if (type === "select" || type === "multiselect") {
      const options = raw.options;
      const ok =
        Array.isArray(options) &&
        options.length > 0 &&
        options.every((o) => typeof o === "string" || (type === "select" && typeof o === "number"));
      if (!ok) problems.push(`${where}: options must be a non-empty array of ${type === "select" ? "strings or numbers" : "strings"}`);
    }
    if (type === "date") {
      const format = raw.format;
      if (typeof format !== "string" || !["YYYY", "MM", "DD"].every((t) => format.includes(t))) {
        problems.push(`${where}: format must contain YYYY, MM and DD`);
      }
      const validation = raw.validation;
      if (validation !== undefined && (!isRecord(validation) || (validation.minAge !== undefined && typeof validation.minAge !== "number"))) {
        problems.push(`${where}: validation.minAge must be a number`);
      }
    }
    if (type === "text" && raw.pattern !== undefined) {
      if (typeof raw.pattern !== "string") problems.push(`${where}: pattern must be a string`);
      else {
        try {
          new RegExp(raw.pattern);
        } catch {
          problems.push(`${where}: pattern is not a valid regular expression`);
        }
      }
    }
    if (type === "number") {
      for (const bound of ["min", "max"]) {
        if (raw[bound] !== undefined && typeof raw[bound] !== "number") problems.push(`${where}: ${bound} must be a number`);
      }
    }
    const showIf = raw.showIf;
    if (showIf !== undefined) {
      if (!isRecord(showIf) || typeof showIf.field !== "string") problems.push(`${where}: showIf.field must be a string`);
      else {
        showIfTargets.push({ where, target: showIf.field });
        const operators = SHOW_IF_OPERATORS.filter((op) => op in showIf);
        if (operators.length !== 1) problems.push(`${where}: showIf must use exactly one of ${SHOW_IF_OPERATORS.join(", ")}`);
      }
    }
  });

  for (const { where, target } of showIfTargets) {
    if (!keys.has(target)) problems.push(`${where}: showIf.field "${target}" is not a field in this form`);
  }

  if (problems.length > 0) {
    const name = typeof json.carrier === "string" ? ` "${json.carrier}"` : "";
    throw new Error(`Invalid carrier form${name}:\n- ${problems.join("\n- ")}`);
  }
  return json as unknown as CarrierForm;
}
