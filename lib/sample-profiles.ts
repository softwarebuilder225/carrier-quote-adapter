/** The two sample profiles from docs/assessment.md, verbatim. */
import type { CustomerProfile } from "./types";

export const profileA: CustomerProfile = {
  first_name: "Maya",
  last_name: "Torres",
  date_of_birth: "1994-03-12",
  email: "maya@example.com",
  state: "OR",
  zip: "97205",
  personal_property_value: 32000,
  has_dog: true,
  dog_breed: "Labrador",
  claims_last_3_years: 0,
};

export const profileB: CustomerProfile = {
  first_name: "Sam",
  last_name: "Lee",
  date_of_birth: "2006-01-20",
  email: "sam@example.com",
  state: "NV",
  zip: "89501",
  personal_property_value: 12000,
  has_dog: false,
  dog_breed: null,
  claims_last_3_years: 1,
};

export const sampleProfiles = [
  { id: "A", label: "Sample A: Maya Torres", profile: profileA },
  { id: "B", label: "Sample B: Sam Lee", profile: profileB },
] as const;
