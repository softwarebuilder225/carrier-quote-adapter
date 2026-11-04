import { describe, expect, it } from "vitest";
import { validate } from "@/lib/validate";
import { harborAdapter } from "@/lib/carriers/harbor/adapter";
import { profileA } from "@/lib/sample-profiles";
import type { Answers, CustomerProfile } from "@/lib/types";

const NOW = new Date(2026, 10, 4);

const goodAnswers: Answers = {
  phone: "503-555-0100",
  pets: ["Dog"],
  claims_last_5_years: 0,
  building_has_sprinklers: true,
};

const errorsFor = (profile: CustomerProfile, answers: Answers) =>
  validate(harborAdapter, profile, answers, NOW).map((e) => e.fieldKey);

describe("Harbor validation", () => {
  it("accepts profile A with complete answers", () => {
    expect(validate(harborAdapter, profileA, goodAnswers, NOW)).toEqual([]);
  });

  it("requires phone and does not require building_has_sprinklers", () => {
    const { phone: _phone, building_has_sprinklers: _sprinklers, ...rest } = goodAnswers;
    void _phone;
    void _sprinklers;
    expect(errorsFor(profileA, rest)).toEqual(["phone"]);
  });

  it("rejects claims_last_5_years 0 when claims_last_3_years is 1, explaining the two windows", () => {
    const errors = validate(harborAdapter, { ...profileA, claims_last_3_years: 1 }, goodAnswers, NOW);
    expect(errors.map((e) => e.fieldKey)).toEqual(["claims_last_5_years"]);
    expect(errors[0].message).toContain("3 years");
    expect(errors[0].message).toContain("5 years");
  });

  it("accepts claims_last_5_years equal to the 3-year count", () => {
    expect(errorsFor({ ...profileA, claims_last_3_years: 1 }, { ...goodAnswers, claims_last_5_years: 1 })).toEqual([]);
  });

  it("ignores dog_breed when pets is [Cat], and requires it when pets includes Dog", () => {
    const noBreed = { ...profileA, dog_breed: null }; // breed unknown, so only an answer can fill it
    expect(errorsFor(noBreed, { ...goodAnswers, pets: ["Cat"] })).toEqual([]);
    expect(errorsFor(noBreed, { ...goodAnswers, pets: ["Dog"] })).toEqual(["dog_breed"]);
  });

  it("rejects postal_code 9720 and accepts 97205-1234", () => {
    expect(errorsFor({ ...profileA, zip: "9720" }, goodAnswers)).toEqual(["postal_code"]);
    expect(errorsFor({ ...profileA, zip: "97205-1234" }, goodAnswers)).toEqual([]);
  });

  it("rejects a select value outside the options", () => {
    expect(errorsFor(profileA, { ...goodAnswers, contents_coverage: 30000 })).toEqual(["contents_coverage"]);
  });

  it("rejects a negative claims count (min 0)", () => {
    expect(errorsFor(profileA, { ...goodAnswers, claims_last_5_years: -1 })).toEqual(["claims_last_5_years"]);
  });

  it("rejects None combined with another pet (ASSUMPTION A3)", () => {
    const errors = validate(harborAdapter, profileA, { ...goodAnswers, pets: ["None", "Dog"] }, NOW);
    expect(errors.map((e) => e.fieldKey)).toEqual(["pets"]);
  });

  it("rejects a malformed email even though it came from the profile", () => {
    expect(errorsFor({ ...profileA, email: "not-an-email" }, goodAnswers)).toEqual(["contact_email"]);
  });

  it("reports every failing field, not just the first", () => {
    const errors = errorsFor({ ...profileA, zip: "1" }, { ...goodAnswers, phone: "", claims_last_5_years: -2 });
    expect(errors.sort()).toEqual(["claims_last_5_years", "phone", "postal_code"]);
  });
});
