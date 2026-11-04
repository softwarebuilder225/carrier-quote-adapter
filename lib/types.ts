/**
 * Shared types. Nothing in this file knows about any particular carrier.
 */

/** Our platform's standard customer profile (docs/assessment.md). */
export interface CustomerProfile {
  first_name: string;
  last_name: string;
  /** ISO calendar date, YYYY-MM-DD. */
  date_of_birth: string;
  email: string;
  /** Two-letter US state code, e.g. "CA". */
  state: string;
  /** Five digits. */
  zip: string;
  /** USD. */
  personal_property_value: number;
  has_dog: boolean;
  dog_breed: string | null;
  claims_last_3_years: number;
}

/**
 * A field is shown only when another field has a given value.
 * If the other field's value is an array, "includes" means membership; otherwise equality.
 */
export interface ShowIf {
  field: string;
  includes: string | number | boolean;
}

interface FieldBase {
  key: string;
  label: string;
  required: boolean;
  showIf?: ShowIf;
}

export interface TextField extends FieldBase {
  type: "text";
  /** JavaScript regular expression source the whole value must match. */
  pattern?: string;
}
export interface EmailField extends FieldBase {
  type: "email";
}
export interface TelField extends FieldBase {
  type: "tel";
}
export interface DateField extends FieldBase {
  type: "date";
  /** Output format built from the tokens YYYY, MM and DD, e.g. "MM/DD/YYYY". */
  format: string;
  validation?: { minAge?: number };
}
export interface SelectField extends FieldBase {
  type: "select";
  options: Array<string | number>;
}
export interface MultiselectField extends FieldBase {
  type: "multiselect";
  options: string[];
}
export interface NumberField extends FieldBase {
  type: "number";
  min?: number;
  max?: number;
}
export interface BooleanField extends FieldBase {
  type: "boolean";
}

export type CarrierField =
  | TextField
  | EmailField
  | TelField
  | DateField
  | SelectField
  | MultiselectField
  | NumberField
  | BooleanField;

export type FieldType = CarrierField["type"];

/** A carrier's quote form, as the carrier supplies it. */
export interface CarrierForm {
  carrier: string;
  product: string;
  fields: CarrierField[];
}

/**
 * answered: the profile fully determines the value; shown read-only.
 * partial:  the profile gives a candidate or a hint; pre-filled, the customer confirms.
 * unknown:  the profile says nothing usable; asked.
 */
export type ResolutionStatus = "answered" | "partial" | "unknown";

export interface FieldResolution {
  status: ResolutionStatus;
  /** Already in the carrier's representation (option value, formatted date, ...). */
  value?: unknown;
  /** One line shown to the customer explaining what the profile already knows. */
  hint?: string;
}

/** Resolutions keyed by carrier field key. */
export type Resolutions = Record<string, FieldResolution>;

/** The customer's answers keyed by carrier field key. */
export type Answers = Record<string, unknown>;

export interface ResolverContext {
  field: CarrierField;
  form: CarrierForm;
  now: Date;
}

/** Maps one carrier field from the profile. Lives in the carrier's mapping module. */
export type FieldResolver = (profile: CustomerProfile, ctx: ResolverContext) => FieldResolution;

/** One resolver per carrier field key. */
export type ResolverMap = Record<string, FieldResolver>;

export interface CarrierAdapter {
  id: string;
  form: CarrierForm;
  /** What the profile answers, per field, as of `now`. */
  resolve(profile: CustomerProfile, now: Date): Resolutions;
  /** The carrier's quote request: profile resolutions merged with the customer's answers. */
  toRequest(profile: CustomerProfile, answers: Answers, now: Date): Record<string, unknown>;
  /** Carrier rules beyond what the form JSON expresses. Each is an ASSUMPTION logged in docs/decisions.md. */
  eligibilityRules: EligibilityRule[];
  /** Carrier submit-time rules beyond the form JSON. */
  customRules: ValidationRule[];
}

export interface EligibilityReason {
  fieldKey: string;
  label: string;
  message: string;
}

export interface EligibilityResult {
  eligible: boolean;
  /** Every failing reason, never just the first. */
  reasons: EligibilityReason[];
}

export interface ValidationError {
  fieldKey: string;
  message: string;
}

export interface RuleContext {
  profile: CustomerProfile;
  form: CarrierForm;
  resolutions: Resolutions;
  /** Profile resolutions merged with the customer's answers. */
  values: Record<string, unknown>;
  now: Date;
}

/** A carrier-specific eligibility rule. Returns the reasons it finds, possibly none. */
export type EligibilityRule = (ctx: RuleContext) => EligibilityReason[];

/** A carrier-specific submit-time rule. Returns the errors it finds, possibly none. */
export type ValidationRule = (ctx: RuleContext) => ValidationError[];
