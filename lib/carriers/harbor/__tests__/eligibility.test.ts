import { describe, expect, it } from "vitest";
import { checkEligibility } from "@/lib/eligibility";
import { harborAdapter } from "@/lib/carriers/harbor/adapter";
import { profileA, profileB } from "@/lib/sample-profiles";

/** 2026-11-04 in local time. */
const NOW = new Date(2026, 10, 4);

describe("Harbor eligibility", () => {
  it("profile A is eligible with no reasons", () => {
    expect(checkEligibility(harborAdapter, profileA, NOW)).toEqual({ eligible: true, reasons: [] });
  });

  it("profile B is ineligible with exactly two reasons, state and age, both reported", () => {
    const result = checkEligibility(harborAdapter, profileB, NOW);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons.map((r) => r.fieldKey).sort()).toEqual(["date_of_birth", "residence_state"]);

    const state = result.reasons.find((r) => r.fieldKey === "residence_state")!;
    expect(state.label).toBe("State of residence");
    expect(state.message).toContain("Nevada");
    expect(state.message).toContain("California, Oregon, Washington, Arizona");

    const age = result.reasons.find((r) => r.fieldKey === "date_of_birth")!;
    expect(age.label).toBe("Birth date");
    expect(age.message).toContain("20");
    expect(age.message).toContain("21");
    expect(age.message).toContain("January 20, 2027");
  });

  it("the age rule turns on the 21st birthday itself", () => {
    const applicant = { ...profileA, date_of_birth: "2005-11-03" };
    expect(checkEligibility(harborAdapter, applicant, new Date(2026, 10, 3)).eligible).toBe(true);
    const dayBefore = checkEligibility(harborAdapter, applicant, new Date(2026, 10, 2));
    expect(dayBefore.eligible).toBe(false);
    expect(dayBefore.reasons.map((r) => r.fieldKey)).toEqual(["date_of_birth"]);
  });

  it("a property value above the largest coverage option is ineligible and names the maximum (ASSUMPTION A1)", () => {
    const result = checkEligibility(harborAdapter, { ...profileA, personal_property_value: 80000 }, NOW);
    expect(result.eligible).toBe(false);
    expect(result.reasons.map((r) => r.fieldKey)).toEqual(["contents_coverage"]);
    expect(result.reasons[0].message).toMatch(/75,?000/);
  });

  it("exactly the largest option is still eligible", () => {
    expect(checkEligibility(harborAdapter, { ...profileA, personal_property_value: 75000 }, NOW).eligible).toBe(true);
  });

  it("an unrecognised state code is reported with the code the profile contained", () => {
    const result = checkEligibility(harborAdapter, { ...profileA, state: "ZZ" }, NOW);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0].fieldKey).toBe("residence_state");
    expect(result.reasons[0].message).toContain("ZZ");
  });

  it("does not invent rules: Pit Bull and Rottweiler owners are eligible", () => {
    expect(checkEligibility(harborAdapter, { ...profileA, dog_breed: "Pit Bull" }, NOW).eligible).toBe(true);
    expect(checkEligibility(harborAdapter, { ...profileA, dog_breed: "Rottweiler" }, NOW).eligible).toBe(true);
  });
});

describe("Harbor eligibility: bad profile data", () => {
  it("reports a birth date in the future instead of a negative age", () => {
    const result = checkEligibility(harborAdapter, { ...profileA, date_of_birth: "2030-05-05" }, NOW);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0].fieldKey).toBe("date_of_birth");
    expect(result.reasons[0].message).toContain("in the future");
  });

  it("does not treat a malformed zip as ineligibility; the field becomes editable instead", () => {
    expect(checkEligibility(harborAdapter, { ...profileA, zip: "9720" }, NOW).eligible).toBe(true);
  });
});
