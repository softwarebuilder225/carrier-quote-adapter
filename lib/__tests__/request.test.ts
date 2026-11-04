import { describe, expect, it } from "vitest";
import { buildRequest, effectiveValues } from "@/lib/request";
import { validateValues } from "@/lib/validate";
import type { CarrierForm } from "@/lib/types";

const NOW = new Date(2026, 10, 4);

const form: CarrierForm = {
  carrier: "test",
  product: "test",
  fields: [
    { key: "when", label: "When", type: "date", format: "DD/MM/YYYY", required: true },
    { key: "kind", label: "Kind", type: "select", options: ["a", "b"], required: true },
    { key: "detail", label: "Detail", type: "text", required: true, showIf: { field: "kind", includes: "b" } },
    { key: "code", label: "Code", type: "text", pattern: "\\d{5}", required: false },
    { key: "amount", label: "Amount", type: "select", options: [10, 20], required: true },
  ],
};

describe("generic request builder", () => {
  it("converts a customer's ISO date answer to the carrier's format", () => {
    const request = buildRequest(form, {}, { when: "2000-01-05", kind: "a", amount: 10 });
    expect(request).toEqual({ when: "05/01/2000", kind: "a", amount: 10 });
  });

  it("applies showIf to a select parent by equality", () => {
    expect(buildRequest(form, {}, { kind: "a", detail: "x" })).not.toHaveProperty("detail");
    expect(buildRequest(form, {}, { kind: "b", detail: "x" })).toHaveProperty("detail", "x");
  });

  it("trims strings so the request matches what was validated", () => {
    const values = effectiveValues(form, {}, { when: " 2000-01-05 ", code: " 12345 ", kind: "a", amount: 10 });
    expect(validateValues(form, values, NOW)).toEqual([]);
    expect(buildRequest(form, {}, { when: " 2000-01-05 ", code: " 12345 ", kind: "a", amount: 10 })).toMatchObject({
      when: "05/01/2000",
      code: "12345",
    });
  });

  it("treats null and empty string as explicit cleared answers, not as 'use the pre-fill'", () => {
    const resolutions = { amount: { status: "partial" as const, value: 20 }, code: { status: "partial" as const, value: "99999" } };
    const values = effectiveValues(form, resolutions, { amount: null, code: "" });
    expect(values.amount).toBeNull();
    expect(values.code).toBe("");
    expect(validateValues(form, values, NOW).map((e) => e.fieldKey)).toContain("amount");
    expect(buildRequest(form, resolutions, { amount: null, code: "" })).not.toHaveProperty("amount");
  });

  it("keeps the pre-fill when there is no answer at all", () => {
    const resolutions = { amount: { status: "partial" as const, value: 20 } };
    expect(effectiveValues(form, resolutions, {}).amount).toBe(20);
  });
});

describe("generic validation", () => {
  it("anchors carrier patterns so they must match the whole value", () => {
    expect(validateValues(form, { kind: "a", amount: 10, when: "05/01/2000", code: "abc12345xyz" }, NOW).map((e) => e.fieldKey)).toEqual(["code"]);
    expect(validateValues(form, { kind: "a", amount: 10, when: "05/01/2000", code: "12345" }, NOW)).toEqual([]);
  });

  it("applies minAge to any date value, including one the customer typed", () => {
    const withAge: CarrierForm = {
      ...form,
      fields: [{ key: "dob", label: "DOB", type: "date", format: "MM/DD/YYYY", required: true, validation: { minAge: 21 } }],
    };
    expect(validateValues(withAge, { dob: "01/01/2015" }, NOW)[0].message).toBe("Applicants must be at least 21.");
    expect(validateValues(withAge, { dob: "2030-05-05" }, NOW)[0].message).toBe("Enter a date in the past.");
    expect(validateValues(withAge, { dob: "01/01/1990" }, NOW)).toEqual([]);
  });
});

describe("date canonicalisation in the request", () => {
  it("emits a loosely typed carrier-format date in the exact format", () => {
    expect(buildRequest(form, {}, { when: "5/1/2000", kind: "a", amount: 10 }).when).toBe("05/01/2000");
  });
});
