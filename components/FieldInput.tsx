"use client";

import type { CarrierField } from "@/lib/types";

interface Props {
  field: CarrierField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  /** Pre-filled from the profile: shown, never editable. */
  readOnly?: boolean;
  invalid?: boolean;
  /** Multiselect options that clear the others when ticked (and are cleared by them). */
  exclusiveOptions?: string[];
}

export const inputId = (key: string) => `field-${key}`;

/** True for the field types rendered as a group of controls rather than one input. */
export const isGroupField = (field: CarrierField) => field.type === "multiselect" || field.type === "boolean";

const asString = (value: unknown) => (value === undefined || value === null ? "" : String(value));

/** How a read-only value is displayed, whatever the field type. */
function displayValue(field: CarrierField, value: unknown): string {
  if (field.type === "multiselect") return Array.isArray(value) ? value.map(String).join(", ") : "";
  if (field.type === "boolean") return value === true ? "Yes" : value === false ? "No" : "";
  return asString(value);
}

/** One input per carrier field type. Renders and reports changes; no validation here. */
export function FieldInput({
  field,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  invalid = false,
  exclusiveOptions = [],
}: Props) {
  const id = inputId(field.key);
  const common = { id, name: field.key, disabled, "aria-invalid": invalid || undefined };

  // A read-only value is shown as text, so a fact outside the carrier's options (for example a
  // state the carrier does not serve) is still visible instead of an empty select.
  if (readOnly) {
    return <input {...common} type="text" readOnly value={displayValue(field, value)} />;
  }

  switch (field.type) {
    case "text":
    case "email":
    case "tel":
      return <input {...common} type={field.type} value={asString(value)} onChange={(e) => onChange(e.target.value)} />;

    case "date":
      // Shown and submitted in the carrier's own format (e.g. MM/DD/YYYY), so the customer
      // sees exactly what the carrier receives.
      return (
        <input
          {...common}
          type="text"
          inputMode="numeric"
          placeholder={field.format}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return (
        <input
          {...common}
          type="number"
          min={field.min}
          max={field.max}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );

    case "select":
      return (
        <select
          {...common}
          value={asString(value)}
          // Options keep their own type (Harbor's coverage amounts are numbers), so the chosen
          // option is reported, not the <select>'s string. Choosing the placeholder clears (null).
          onChange={(e) => onChange(field.options.find((o) => String(o) === e.target.value) ?? null)}
        >
          <option value="">Select…</option>
          {field.options.map((o) => (
            <option key={String(o)} value={String(o)}>
              {String(o)}
            </option>
          ))}
        </select>
      );

    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (option: string, checked: boolean) => {
        let next: string[];
        if (!checked) next = selected.filter((s) => s !== option);
        else if (exclusiveOptions.includes(option)) next = [option];
        else next = [...selected.filter((s) => !exclusiveOptions.includes(s)), option];
        onChange(field.options.filter((o) => next.includes(o))); // keep the carrier's option order
      };
      return (
        <div className="choices" role="group" aria-labelledby={`${id}-label`}>
          {field.options.map((option) => (
            <label key={option} className="choice">
              <input
                type="checkbox"
                name={field.key}
                value={option}
                checked={selected.includes(option)}
                disabled={disabled}
                onChange={(e) => toggle(option, e.target.checked)}
              />
              {option}
            </label>
          ))}
        </div>
      );
    }

    case "boolean":
      return (
        <div className="choices" role="radiogroup" aria-labelledby={`${id}-label`}>
          {[
            { label: "Yes", option: true },
            { label: "No", option: false },
          ].map(({ label, option }) => (
            <label key={label} className="choice">
              <input type="radio" name={field.key} checked={value === option} disabled={disabled} onChange={() => onChange(option)} />
              {label}
            </label>
          ))}
        </div>
      );
  }
}
