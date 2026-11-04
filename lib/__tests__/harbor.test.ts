import { describe, expect, it } from "vitest";
import { ageOn, ceilToOption, formatDate, matchOption, stateName } from "@/lib/convert";
import { buildRequest } from "@/lib/request";
import { carriers } from "@/lib/carriers";
import { harborAdapter, harborForm } from "@/lib/carriers/harbor/adapter";
import { harborResolvers } from "@/lib/carriers/harbor/mapping";
import { profileA, profileB } from "@/lib/sample-profiles";
import type { CarrierForm } from "@/lib/types";

/** 2026-11-04 in local time. Dates are built from parts so no UTC shift can creep in. */
const NOW = new Date(2026, 10, 4);
const COVERAGE_OPTIONS = [10000, 25000, 50000, 75000];
const BREED_OPTIONS = ["Labrador", "Pit Bull", "Rottweiler", "Other"];

describe("Harbor resolve: profile A (Maya Torres)", () => {
  const r = harborAdapter.resolve(profileA, NOW);

  it("answers the fields the profile fully determines, converting where formats differ", () => {
    expect(r.applicant_full_name).toEqual({ status: "answered", value: "Maya Torres" });
    expect(r.date_of_birth).toEqual({ status: "answered", value: "03/12/1994" });
    expect(r.contact_email).toEqual({ status: "answered", value: "maya@example.com" });
    expect(r.residence_state).toEqual({ status: "answered", value: "Oregon" });
    expect(r.postal_code).toEqual({ status: "answered", value: "97205" });
    expect(r.dog_breed).toEqual({ status: "answered", value: "Labrador" });
  });

  it("rounds the property value UP to a coverage bucket and lets the customer confirm (decisions #3, #12)", () => {
    expect(r.contents_coverage.status).toBe("partial");
    expect(r.contents_coverage.value).toBe(50000);
    expect(r.contents_coverage.hint).toContain("32,000");
  });

  it("pre-fills Dog in pets but still asks, because has_dog says nothing about other pets", () => {
    expect(r.pets.status).toBe("partial");
    expect(r.pets.value).toEqual(["Dog"]);
    expect(r.pets.hint).toBeTruthy();
  });

  it("asks for the 5-year claims count, with the 3-year count only as a hint", () => {
    expect(r.claims_last_5_years.status).toBe("unknown");
    expect(r.claims_last_5_years.value).toBeUndefined();
    expect(r.claims_last_5_years.hint).toContain("0");
  });

  it("asks for what the profile cannot know", () => {
    expect(r.phone).toEqual({ status: "unknown" });
    expect(r.building_has_sprinklers).toEqual({ status: "unknown" });
  });
});

describe("Harbor resolve: profile B (Sam Lee)", () => {
  const r = harborAdapter.resolve(profileB, NOW);

  it("rounds 12000 up to 25000", () => {
    expect(r.contents_coverage).toMatchObject({ status: "partial", value: 25000 });
  });

  it("pre-fills nothing for pets when has_dog is false, and still asks", () => {
    expect(r.pets.status).toBe("partial");
    expect(r.pets.value).toBeUndefined();
  });

  it("does not answer dog_breed", () => {
    expect(r.dog_breed.status).not.toBe("answered");
  });

  it("reports the state as a fact even though Harbor does not serve it (eligibility decides)", () => {
    expect(r.residence_state).toEqual({ status: "answered", value: "Nevada" });
  });

  it("mentions the 3-year count of 1 in the claims hint", () => {
    expect(r.claims_last_5_years.status).toBe("unknown");
    expect(r.claims_last_5_years.hint).toContain("1");
  });
});

describe("Harbor resolve: edge cases", () => {
  it("maps an unlisted breed to Other as partial, keeping the original text in the hint", () => {
    const r = harborAdapter.resolve({ ...profileA, dog_breed: "Husky" }, NOW);
    expect(r.dog_breed.status).toBe("partial");
    expect(r.dog_breed.value).toBe("Other");
    expect(r.dog_breed.hint).toContain("Husky");
  });

  it("asks for the breed when there is a dog but no breed", () => {
    const r = harborAdapter.resolve({ ...profileA, dog_breed: null }, NOW);
    expect(r.dog_breed.status).toBe("unknown");
  });

  it("gives no coverage value when the property value exceeds the largest option", () => {
    const r = harborAdapter.resolve({ ...profileA, personal_property_value: 80000 }, NOW);
    expect(r.contents_coverage.value).toBeUndefined();
    expect(r.contents_coverage.hint).toContain("75,000");
  });
});

describe("ceilToOption", () => {
  it.each([
    [10000, 10000],
    [10001, 25000],
    [25000, 25000],
    [75000, 75000],
    [75001, null],
  ])("%s -> %s", (value, expected) => {
    expect(ceilToOption(value, COVERAGE_OPTIONS)).toBe(expected);
  });

  it("ignores option order and non-numeric options", () => {
    expect(ceilToOption(30000, [75000, "n/a", 10000, 50000, 25000])).toBe(50000);
  });
});

describe("ageOn", () => {
  it("born 2006-01-20 is 20 on 2026-11-03", () => {
    expect(ageOn("2006-01-20", new Date(2026, 10, 3))).toBe(20);
  });
  it("turns 21 on the birthday itself, 2027-01-20", () => {
    expect(ageOn("2006-01-20", new Date(2027, 0, 20))).toBe(21);
  });
  it("is still 20 the day before, 2027-01-19", () => {
    expect(ageOn("2006-01-20", new Date(2027, 0, 19))).toBe(20);
  });
  it("returns null for a malformed date", () => {
    expect(ageOn("20-01-2006", NOW)).toBeNull();
  });
});

describe("formatDate", () => {
  it("reformats by splitting the string", () => {
    expect(formatDate("1994-03-12", "MM/DD/YYYY")).toBe("03/12/1994");
    expect(formatDate("1994-03-12", "DD.MM.YYYY")).toBe("12.03.1994");
  });
  it("rejects impossible dates", () => {
    expect(formatDate("1994-02-30", "MM/DD/YYYY")).toBeNull();
  });
});

describe("matchOption", () => {
  it("is case-insensitive", () => {
    expect(matchOption("labrador", BREED_OPTIONS, "Other")).toBe("Labrador");
    expect(matchOption("  pit bull ", BREED_OPTIONS, "Other")).toBe("Pit Bull");
  });
  it("falls back when nothing matches", () => {
    expect(matchOption("Husky", BREED_OPTIONS, "Other")).toBe("Other");
    expect(matchOption("Husky", BREED_OPTIONS, null)).toBeNull();
  });
});

describe("stateName", () => {
  it("maps codes to names regardless of case", () => {
    expect(stateName("or")).toBe("Oregon");
    expect(stateName("NV")).toBe("Nevada");
  });
  it("returns null for an unknown code", () => {
    expect(stateName("ZZ")).toBeNull();
  });
});

describe("Harbor toRequest", () => {
  const answers = {
    phone: "503-555-0100",
    pets: ["Dog"],
    claims_last_5_years: 0,
    building_has_sprinklers: true,
  };

  // Expected request from docs/mapping.md, section 7.
  const expected = {
    applicant_full_name: "Maya Torres",
    date_of_birth: "03/12/1994",
    contact_email: "maya@example.com",
    phone: "503-555-0100",
    residence_state: "Oregon",
    postal_code: "97205",
    contents_coverage: 50000,
    pets: ["Dog"],
    dog_breed: "Labrador",
    claims_last_5_years: 0,
    building_has_sprinklers: true,
  };

  it("produces exactly the expected request for profile A, keys in the form's order", () => {
    const request = harborAdapter.toRequest(profileA, answers, NOW);
    expect(request).toEqual(expected);
    expect(Object.keys(request)).toEqual(harborForm.fields.map((f) => f.key));
  });

  it("omits dog_breed when pets does not include Dog", () => {
    const request = harborAdapter.toRequest(profileA, { ...answers, pets: ["Cat"] }, NOW);
    expect(request).not.toHaveProperty("dog_breed");
    expect(request.pets).toEqual(["Cat"]);
  });

  it("omits an unanswered optional field instead of sending false", () => {
    const request = harborAdapter.toRequest(
      profileA,
      { phone: "503-555-0100", pets: ["Dog"], claims_last_5_years: 0 },
      NOW,
    );
    expect(request).not.toHaveProperty("building_has_sprinklers");
  });

  it("keeps an explicit false", () => {
    const request = harborAdapter.toRequest(profileA, { ...answers, building_has_sprinklers: false }, NOW);
    expect(request.building_has_sprinklers).toBe(false);
  });

  it("lets the customer change a partial field but never an answered one", () => {
    const request = harborAdapter.toRequest(
      profileA,
      { ...answers, contents_coverage: 75000, applicant_full_name: "Someone Else" },
      NOW,
    );
    expect(request.contents_coverage).toBe(75000);
    expect(request.applicant_full_name).toBe("Maya Torres");
  });
});

describe("generic request builder", () => {
  const form: CarrierForm = {
    carrier: "test",
    product: "test",
    fields: [
      { key: "when", label: "When", type: "date", format: "DD/MM/YYYY", required: true },
      { key: "kind", label: "Kind", type: "select", options: ["a", "b"], required: true },
      { key: "detail", label: "Detail", type: "text", required: true, showIf: { field: "kind", includes: "b" } },
    ],
  };

  it("converts a customer's ISO date answer to the carrier's format", () => {
    const request = buildRequest(form, {}, { when: "2000-01-05", kind: "a" });
    expect(request).toEqual({ when: "05/01/2000", kind: "a" });
  });

  it("applies showIf to a select parent by equality", () => {
    expect(buildRequest(form, {}, { kind: "a", detail: "x" })).not.toHaveProperty("detail");
    expect(buildRequest(form, {}, { kind: "b", detail: "x" })).toHaveProperty("detail", "x");
  });
});

describe("carrier registry", () => {
  it("exposes Harbor by id", () => {
    expect(carriers.harbor).toBe(harborAdapter);
  });

  it("has a resolver for every field in Harbor's form", () => {
    const missing = harborForm.fields.map((f) => f.key).filter((key) => !(key in harborResolvers));
    expect(missing).toEqual([]);
  });
});
