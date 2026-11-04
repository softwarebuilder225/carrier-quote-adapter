import { describe, expect, it } from "vitest";
import { parseProfile } from "@/lib/profile";
import { profileA } from "@/lib/sample-profiles";

describe("parseProfile", () => {
  it("accepts sample A as JSON", () => {
    expect(parseProfile(JSON.stringify(profileA))).toEqual({ ok: true, profile: profileA });
  });

  it("rejects invalid JSON with a readable error", () => {
    const result = parseProfile("{ not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Not valid JSON");
  });

  it("rejects a non-object", () => {
    expect(parseProfile("[1, 2]").ok).toBe(false);
  });

  it("lists every wrong field", () => {
    const result = parseProfile(JSON.stringify({ ...profileA, has_dog: "yes", zip: 97205 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("has_dog");
      expect(result.error).toContain("zip");
    }
  });

  it("treats a missing dog_breed as null", () => {
    const { dog_breed: _breed, ...withoutBreed } = profileA;
    void _breed;
    const result = parseProfile(JSON.stringify(withoutBreed));
    expect(result).toEqual({ ok: true, profile: { ...withoutBreed, dog_breed: null } });
  });
});
