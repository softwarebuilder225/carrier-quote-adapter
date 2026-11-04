import { describe, expect, it } from "vitest";
import { ageOn, birthdayAfterYears, ceilToOption, formatDate, fullName, matchOption, parseDate, stateName } from "@/lib/convert";

const NOW = new Date(2026, 10, 4);
const COVERAGE_OPTIONS = [10000, 25000, 50000, 75000];
const BREED_OPTIONS = ["Labrador", "Pit Bull", "Rottweiler", "Other"];

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

describe("formatDate and parseDate", () => {
  it("reformats by splitting the string", () => {
    expect(formatDate("1994-03-12", "MM/DD/YYYY")).toBe("03/12/1994");
    expect(formatDate("1994-03-12", "DD.MM.YYYY")).toBe("12.03.1994");
  });
  it("rejects impossible dates", () => {
    expect(formatDate("1994-02-30", "MM/DD/YYYY")).toBeNull();
  });
  it("parses a carrier-format date back to ISO", () => {
    expect(parseDate("03/12/1994", "MM/DD/YYYY")).toBe("1994-03-12");
    expect(parseDate("12.03.1994", "DD.MM.YYYY")).toBe("1994-03-12");
    expect(parseDate("1994-03-12", "MM/DD/YYYY")).toBeNull();
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

describe("fullName", () => {
  it("trims each part and drops empty ones", () => {
    expect(fullName("  Maya ", "Torres")).toBe("Maya Torres");
    expect(fullName("", " Lee ")).toBe("Lee");
  });
});

describe("29 February birthdays", () => {
  it("count 1 March as the birthday in a common year", () => {
    expect(ageOn("2004-02-29", new Date(2026, 1, 28))).toBe(21);
    expect(ageOn("2004-02-29", new Date(2026, 2, 1))).toBe(22);
  });
  it("become eligible on 1 March in a common year and 29 February in a leap year", () => {
    expect(birthdayAfterYears("2004-02-29", 21)).toBe("2025-03-01");
    expect(birthdayAfterYears("2004-02-29", 20)).toBe("2024-02-29");
  });
});

describe("parseDate with one-digit day or month", () => {
  it("accepts 3/5/1990 for MM/DD/YYYY and zero-pads", () => {
    expect(parseDate("3/5/1990", "MM/DD/YYYY")).toBe("1990-03-05");
    expect(parseDate("03/05/1990", "MM/DD/YYYY")).toBe("1990-03-05");
    expect(parseDate("3/5/90", "MM/DD/YYYY")).toBeNull();
  });
});
