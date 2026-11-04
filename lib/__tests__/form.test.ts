import { describe, expect, it } from "vitest";
import { isFieldVisible, parseCarrierForm } from "@/lib/form";
import type { CarrierForm } from "@/lib/types";

const base = {
  carrier: "test",
  product: "test",
  fields: [
    { key: "kind", label: "Kind", type: "select", options: ["a", "b"], required: true },
    { key: "detail", label: "Detail", type: "text", required: true, showIf: { field: "kind", includes: "b" } },
  ],
};

const problemsOf = (json: unknown): string => {
  try {
    parseCarrierForm(json);
    return "";
  } catch (e) {
    return (e as Error).message;
  }
};

describe("parseCarrierForm", () => {
  it("accepts a well-formed form and returns it typed", () => {
    expect(parseCarrierForm(base).fields).toHaveLength(2);
  });

  it("rejects an unsupported field type, naming the field", () => {
    const json = { ...base, fields: [{ key: "notes", label: "Notes", type: "textarea", required: false }] };
    expect(problemsOf(json)).toContain('field "notes": unsupported type "textarea"');
  });

  it("rejects duplicate keys and a missing label in one error", () => {
    const json = { ...base, fields: [...base.fields, { key: "kind", type: "text", required: true }] };
    const message = problemsOf(json);
    expect(message).toContain("duplicate key");
    expect(message).toContain("label must be a non-empty string");
  });

  it("rejects a showIf with an unknown operator or two operators", () => {
    const unknownOp = { ...base, fields: [base.fields[0], { ...base.fields[1], showIf: { field: "kind", contains: "b" } }] };
    expect(problemsOf(unknownOp)).toContain("showIf must use exactly one of includes, notIncludes, equals");
    const twoOps = { ...base, fields: [base.fields[0], { ...base.fields[1], showIf: { field: "kind", includes: "b", equals: "b" } }] };
    expect(problemsOf(twoOps)).toContain("exactly one");
  });

  it("rejects a showIf that points at a field that does not exist", () => {
    const json = { ...base, fields: [base.fields[0], { ...base.fields[1], showIf: { field: "nope", includes: "b" } }] };
    expect(problemsOf(json)).toContain('showIf.field "nope" is not a field');
  });

  it("rejects selects without options, dates without tokens and bad patterns", () => {
    const json = {
      ...base,
      fields: [
        { key: "s", label: "S", type: "select", options: [], required: true },
        { key: "d", label: "D", type: "date", format: "MM/DD", required: true },
        { key: "t", label: "T", type: "text", pattern: "(", required: true },
      ],
    };
    const message = problemsOf(json);
    expect(message).toContain('field "s": options must be a non-empty array');
    expect(message).toContain('field "d": format must contain YYYY, MM and DD');
    expect(message).toContain('field "t": pattern is not a valid regular expression');
  });

  it("rejects a form that is not an object", () => {
    expect(() => parseCarrierForm("nope")).toThrow("must be a JSON object");
  });
});

describe("isFieldVisible", () => {
  const form: CarrierForm = {
    carrier: "test",
    product: "test",
    fields: [
      { key: "kind", label: "Kind", type: "select", options: ["a", "b"], required: true },
      { key: "detail", label: "Detail", type: "text", required: true, showIf: { field: "kind", includes: "b" } },
      { key: "extra", label: "Extra", type: "text", required: false, showIf: { field: "detail", equals: "x" } },
      { key: "tags", label: "Tags", type: "multiselect", options: ["p", "q"], required: false },
      { key: "why", label: "Why", type: "text", required: false, showIf: { field: "tags", notIncludes: "p" } },
    ],
  };
  const field = (key: string) => form.fields.find((f) => f.key === key)!;

  it("hides a child whose parent is itself hidden, even if the child's own condition holds", () => {
    expect(isFieldVisible(form, field("extra"), { kind: "a", detail: "x" })).toBe(false);
    expect(isFieldVisible(form, field("extra"), { kind: "b", detail: "x" })).toBe(true);
  });

  it("supports equals and notIncludes", () => {
    expect(isFieldVisible(form, field("extra"), { kind: "b", detail: "y" })).toBe(false);
    expect(isFieldVisible(form, field("why"), { tags: ["q"] })).toBe(true);
    expect(isFieldVisible(form, field("why"), { tags: ["p", "q"] })).toBe(false);
    expect(isFieldVisible(form, field("why"), {})).toBe(true);
  });
});
