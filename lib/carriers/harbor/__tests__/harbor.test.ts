import { describe, expect, it } from "vitest";
import { carriers } from "@/lib/carriers";
import { harborAdapter, harborForm } from "@/lib/carriers/harbor/adapter";
import { harborResolvers } from "@/lib/carriers/harbor/mapping";
import { profileA, profileB } from "@/lib/sample-profiles";

/** 2026-11-04 in local time. Dates are built from parts so no UTC shift can creep in. */
const NOW = new Date(2026, 10, 4);

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

  it("makes a malformed profile fact editable instead of locking it (A6)", () => {
    const r = harborAdapter.resolve({ ...profileA, zip: "9720", email: "not-an-email" }, NOW);
    expect(r.postal_code).toMatchObject({ status: "partial", value: "9720" });
    expect(r.postal_code.hint).toContain("9720");
    expect(r.contact_email.status).toBe("partial");
  });

  it("keeps an out-of-list state read-only: it is a fact for eligibility, not a question", () => {
    const r = harborAdapter.resolve(profileB, NOW);
    expect(r.residence_state.status).toBe("answered");
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

  it("trims a typed phone number", () => {
    expect(harborAdapter.toRequest(profileA, { ...answers, phone: "  503-555-0100 " }, NOW).phone).toBe("503-555-0100");
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

describe("Harbor resolve: more edge cases", () => {
  it("asks for coverage when the property value is zero, negative or not a number", () => {
    expect(harborAdapter.resolve({ ...profileA, personal_property_value: 0 }, NOW).contents_coverage.status).toBe("unknown");
    expect(harborAdapter.resolve({ ...profileA, personal_property_value: -5 }, NOW).contents_coverage.status).toBe("unknown");
    expect(harborAdapter.resolve({ ...profileA, personal_property_value: Number.NaN }, NOW).contents_coverage.status).toBe("unknown");
  });

  it("keeps a breed listed on a 'no dog' profile as a partial pre-fill and says so in the pets hint", () => {
    const r = harborAdapter.resolve({ ...profileB, dog_breed: "Labrador" }, NOW);
    expect(r.pets.value).toBeUndefined();
    expect(r.pets.hint).toContain("Labrador");
    expect(r.dog_breed).toMatchObject({ status: "partial", value: "Labrador" });
  });

  it("validates Harbor's own JSON at adapter creation", () => {
    expect(harborForm.fields.map((f) => f.key)).toHaveLength(11);
  });
});
