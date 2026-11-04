"use client";

import { useState, type FormEvent } from "react";
import { FieldInput, inputId, isGroupField } from "./FieldInput";
import { visibleFields } from "@/lib/form";
import { effectiveValues } from "@/lib/request";
import type { Answers, CarrierField, CarrierForm as CarrierFormDefinition, ResolutionStatus, Resolutions, ValidationError } from "@/lib/types";

interface Props {
  form: CarrierFormDefinition;
  resolutions: Resolutions;
  /** Rendered but not submittable (the customer is ineligible). */
  disabled?: boolean;
  exclusiveOptions?: Record<string, string[]>;
  validate: (answers: Answers) => ValidationError[];
  buildRequest: (answers: Answers) => Record<string, unknown>;
  requestTitle: string;
}

const SECTION_TITLES: Record<ResolutionStatus, string> = {
  answered: "From your profile",
  partial: "Please confirm",
  unknown: "We need a few more details",
};

/**
 * Generic renderer: the carrier's form JSON plus the profile resolutions decide what is
 * shown, what is read-only and what is asked. All checks happen in lib/ via the props.
 * Answers hold only what the customer touched; pre-filled values come from the resolutions.
 */
export function CarrierForm({ form, resolutions, disabled = false, exclusiveOptions = {}, validate, buildRequest, requestTitle }: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [request, setRequest] = useState<Record<string, unknown> | null>(null);

  const values = effectiveValues(form, resolutions, answers);
  const visible = visibleFields(form, values);
  const statusOf = (field: CarrierField): ResolutionStatus => resolutions[field.key]?.status ?? "unknown";
  const errorFor = (key: string) => errors.find((e) => e.fieldKey === key)?.message;

  const setAnswer = (key: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setErrors((current) => current.filter((e) => e.fieldKey !== key)); // the customer is fixing it
    setRequest(null);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(answers);
    setErrors(found);
    setRequest(found.length === 0 ? buildRequest(answers) : null);
  };

  const renderField = (field: CarrierField) => {
    const status = statusOf(field);
    const readOnly = status === "answered";
    const hint = resolutions[field.key]?.hint;
    const error = errorFor(field.key);
    const labelText = (
      <>
        {field.label}
        {!field.required && <span className="muted"> (optional)</span>}
      </>
    );
    return (
      <div key={field.key} className={`field${error ? " has-error" : ""}`}>
        <div className="field-label" id={`${inputId(field.key)}-label`}>
          {isGroupField(field) && !readOnly ? (
            // A checkbox or radio group has no single labelable element; the group is
            // labelled through aria-labelledby instead.
            <span>{labelText}</span>
          ) : (
            <label htmlFor={inputId(field.key)}>{labelText}</label>
          )}
          {readOnly && <span className="badge">From your profile</span>}
        </div>
        <FieldInput
          field={field}
          value={values[field.key]}
          onChange={(value) => setAnswer(field.key, value)}
          disabled={disabled}
          readOnly={readOnly}
          invalid={Boolean(error)}
          exclusiveOptions={exclusiveOptions[field.key]}
        />
        {!readOnly && hint && <p className="hint">{hint}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  };

  const sections = (["answered", "partial", "unknown"] as const)
    .map((status) => ({ status, fields: visible.filter((field) => statusOf(field) === status) }))
    .filter((section) => section.fields.length > 0);

  return (
    <form className={`carrier-form${disabled ? " is-disabled" : ""}`} onSubmit={onSubmit} noValidate>
      {sections.map(({ status, fields }) => (
        <section key={status}>
          <h2>{SECTION_TITLES[status]}</h2>
          {fields.map(renderField)}
        </section>
      ))}

      {!disabled && (
        <div className="actions">
          <button type="submit">Build quote request</button>
          {errors.length > 0 && (
            <p className="error">
              Please fix the {errors.length} highlighted {errors.length === 1 ? "field" : "fields"}.
            </p>
          )}
        </div>
      )}

      {request && (
        <section className="request">
          <h2>{requestTitle}</h2>
          <pre>{JSON.stringify(request, null, 2)}</pre>
        </section>
      )}
    </form>
  );
}
