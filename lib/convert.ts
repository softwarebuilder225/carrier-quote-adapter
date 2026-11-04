/**
 * Carrier-agnostic converters. Pure functions; no carrier knowledge, no React.
 */

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Parses YYYY-MM-DD by splitting the string. Never `new Date(string)`: a date-only
 * string parses as UTC midnight and shows as the previous day west of Greenwich.
 */
export function parseIsoDate(iso: string): DateParts | null {
  const m = ISO_DATE.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && parseIsoDate(value) !== null;
}

/** Formats an ISO date with a pattern made of YYYY, MM and DD tokens. Null for an invalid date. */
export function formatDate(isoDate: string, pattern: string): string | null {
  const p = parseIsoDate(isoDate);
  if (!p) return null;
  return pattern.replace(/YYYY|MM|DD/g, (token) => {
    if (token === "YYYY") return String(p.year).padStart(4, "0");
    if (token === "MM") return pad2(p.month);
    return pad2(p.day);
  });
}

/**
 * Whole years lived on the calendar date of `now` (local time). Someone turns N on
 * their birthday itself; a 29 February birthday turns on 1 March in common years.
 */
export function ageOn(isoBirthDate: string, now: Date): number | null {
  const b = parseIsoDate(isoBirthDate);
  if (!b) return null;
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const beforeBirthday = month < b.month || (month === b.month && day < b.day);
  return year - b.year - (beforeBirthday ? 1 : 0);
}

const US_STATES: Readonly<Record<string, string>> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** Two-letter US state code (any case) to its full name. Null for an unknown code. */
export function stateName(code: string): string | null {
  return US_STATES[code.trim().toUpperCase()] ?? null;
}

/**
 * Smallest numeric option that is >= value, i.e. rounds UP. Null when the value is above
 * every option or not a finite number. Non-numeric options are ignored.
 */
export function ceilToOption(value: number, options: ReadonlyArray<string | number>): number | null {
  if (!Number.isFinite(value)) return null;
  const numeric = options
    .filter((o): o is number => typeof o === "number" && Number.isFinite(o))
    .sort((a, b) => a - b);
  return numeric.find((o) => o >= value) ?? null;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Case- and whitespace-insensitive exact match of free text against fixed options.
 * Returns the option as spelled by the carrier, or `fallback` when nothing matches.
 */
export function matchOption<T>(text: string, options: ReadonlyArray<string>, fallback: T): string | T {
  const wanted = normalize(text);
  if (!wanted) return fallback;
  return options.find((o) => normalize(o) === wanted) ?? fallback;
}

/** Joins the non-empty parts with single spaces. */
export function fullName(first: string, last: string): string {
  return [first, last]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The inverse of formatDate: reads a date written in a YYYY/MM/DD-token pattern back into
 * ISO YYYY-MM-DD. Null when the text does not fit the pattern or is not a real date.
 */
export function parseDate(value: string, pattern: string): string | null {
  const order: string[] = [];
  const source = escapeRegExp(pattern).replace(/YYYY|MM|DD/g, (token) => {
    order.push(token);
    return token === "YYYY" ? "(\\d{4})" : "(\\d{2})";
  });
  const m = new RegExp(`^${source}$`).exec(value.trim());
  if (!m) return null;
  const parts: Record<string, string> = {};
  order.forEach((token, i) => {
    parts[token] = m[i + 1];
  });
  const iso = `${parts.YYYY}-${parts.MM}-${parts.DD}`;
  return parseIsoDate(iso) ? iso : null;
}

/** Accepts either ISO or the given pattern; returns ISO or null. */
export function toIsoDate(value: unknown, pattern: string): string | null {
  if (typeof value !== "string") return null;
  return isIsoDate(value) ? value.trim() : parseDate(value, pattern);
}

/** The ISO date on which someone born on `isoBirthDate` turns `years`. 29 Feb becomes 1 Mar in common years. */
export function birthdayAfterYears(isoBirthDate: string, years: number): string | null {
  const b = parseIsoDate(isoBirthDate);
  if (!b) return null;
  const year = b.year + years;
  const day = Math.min(b.day, daysInMonth(year, b.month));
  const rolls = day < b.day; // only 29 Feb in a common year
  return rolls ? `${year}-03-01` : `${year}-${pad2(b.month)}-${pad2(day)}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "January 20, 2027" from an ISO date, with no time-zone involvement. */
export function longDate(isoDate: string): string | null {
  const p = parseIsoDate(isoDate);
  return p ? `${MONTHS[p.month - 1]} ${p.day}, ${p.year}` : null;
}
