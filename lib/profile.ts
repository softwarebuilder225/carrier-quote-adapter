/**
 * Parses a customer profile pasted as JSON and checks its shape. No carrier knowledge.
 */
import type { CustomerProfile } from "./types";

export type ParseProfileResult = { ok: true; profile: CustomerProfile } | { ok: false; error: string };

const STRING_KEYS = ["first_name", "last_name", "date_of_birth", "email", "state", "zip"] as const;

export function parseProfile(json: string): ParseProfileResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${(e as Error).message}` };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, error: "Expected a JSON object." };
  }
  const obj = data as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of STRING_KEYS) {
    if (typeof obj[key] !== "string") problems.push(`${key} must be a string`);
  }
  if (typeof obj.personal_property_value !== "number") problems.push("personal_property_value must be a number");
  if (typeof obj.has_dog !== "boolean") problems.push("has_dog must be true or false");
  if (obj.dog_breed !== undefined && obj.dog_breed !== null && typeof obj.dog_breed !== "string") {
    problems.push("dog_breed must be a string or null");
  }
  if (typeof obj.claims_last_3_years !== "number") problems.push("claims_last_3_years must be a number");
  if (problems.length > 0) return { ok: false, error: `${problems.join("; ")}.` };

  const profile = { ...obj, dog_breed: obj.dog_breed ?? null } as unknown as CustomerProfile;
  return { ok: true, profile };
}
