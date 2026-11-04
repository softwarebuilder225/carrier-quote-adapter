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
}

export const inputId = (key: string) => `field-${key}`;

const asString = (value: unknown) => (value === undefined || value === null ? "" : String(value));

/** One input per carrier field type. Renders and reports changes; no validation here. */
export function FieldInput({ field, value, onChange, disabled = false, readOnly = false, invalid = false }: Props) {
  const id = inputId(field.key);
  const locked = disabled || readOnly;
  const common = { id, name: field.key, disabled, "aria-invalid": invalid || undefined };

  switch (field.type) {
    case "text":
    case "email":
    case "tel":
      return (
        <input
          {...common}
          type={field.type}
          value={asString(value)}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
        />
      );

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
          readOnly={readOnly}
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
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );

    case "select":
      return (
        <select
          {...common}
          disabled={locked}
          value={asString(value)}
          // Options keep their own type (Harbor's coverage amounts are numbers), so the
          // chosen option object is reported, not the <select>'s string.
          onChange={(e) => onChange(field.options.find((o) => String(o) === e.target.value))}
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
        const next = checked ? [...selected, option] : selected.filter((s) => s !== option);
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
                disabled={locked}
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
              <input
                type="radio"
                name={field.key}
                checked={value === option}
                disabled={locked}
                onChange={() => onChange(option)}
              />
              {label}
            </label>
          ))}
        </div>
      );
  }
}
