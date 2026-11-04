"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { CarrierForm } from "./CarrierForm";
import { getCarrier } from "@/lib/carriers";
import { checkEligibility } from "@/lib/eligibility";
import { parseProfile } from "@/lib/profile";
import { buildRequest } from "@/lib/request";
import { sampleProfiles } from "@/lib/sample-profiles";
import { validate } from "@/lib/validate";
import type { Answers } from "@/lib/types";

const CUSTOM = "custom";

/**
 * Today's date, created in the browser only. During prerendering and hydration the snapshot
 * is null, so no build-time date is baked into the static shell and nothing can mismatch.
 */
let browserNow: Date | null = null;
const subscribeToNothing = () => () => {};
const getBrowserNow = () => (browserNow ??= new Date());
const getServerNow = () => null;
const useNow = () => useSyncExternalStore(subscribeToNothing, getBrowserNow, getServerNow);

export function QuoteFlow({ carrierId }: { carrierId: string }) {
  const adapter = getCarrier(carrierId);
  const now = useNow();
  const [selection, setSelection] = useState<string>(sampleProfiles[0].id);
  const [customJson, setCustomJson] = useState("");

  const parsed = useMemo(() => {
    const sample = sampleProfiles.find((s) => s.id === selection);
    return sample ? { ok: true as const, profile: sample.profile } : parseProfile(customJson);
  }, [selection, customJson]);
  const profile = parsed.ok ? parsed.profile : null;

  // Resolve the profile once per change; eligibility, the form, validation and the request
  // all share the result.
  const resolutions = useMemo(() => (profile && now ? adapter.resolve(profile, now) : null), [adapter, profile, now]);
  const eligibility = useMemo(
    () => (profile && now && resolutions ? checkEligibility(adapter, profile, now, resolutions) : null),
    [adapter, profile, now, resolutions],
  );
  const profileJson = useMemo(() => (profile ? JSON.stringify(profile, null, 2) : ""), [profile]);

  // Eligibility and age depend on today's date, so the flow renders only in the browser.
  if (!now) return <p className="muted">Loading…</p>;

  return (
    <div className="quote-flow">
      <section className="panel">
        <h2>Customer profile</h2>
        <div className="choices">
          {sampleProfiles.map((s) => (
            <label key={s.id} className="choice">
              <input type="radio" name="profile" checked={selection === s.id} onChange={() => setSelection(s.id)} />
              {s.label}
            </label>
          ))}
          <label className="choice">
            <input type="radio" name="profile" checked={selection === CUSTOM} onChange={() => setSelection(CUSTOM)} />
            Paste a profile
          </label>
        </div>
        {selection === CUSTOM && (
          <>
            <textarea
              rows={8}
              value={customJson}
              onChange={(e) => setCustomJson(e.target.value)}
              placeholder='{ "first_name": "...", "last_name": "...", "date_of_birth": "YYYY-MM-DD", ... }'
              spellCheck={false}
              aria-label="Profile JSON"
            />
            {!parsed.ok && customJson.trim() !== "" && <p className="error">{parsed.error}</p>}
          </>
        )}
        {profile && <pre className="profile">{profileJson}</pre>}
      </section>

      {profile && eligibility && resolutions && (
        <>
          {!eligibility.eligible && (
            <section className="panel ineligible" role="alert">
              <h2>{adapter.name} can&apos;t quote this customer</h2>
              <ul>
                {eligibility.reasons.map((reason) => (
                  <li key={reason.fieldKey}>{reason.message}</li>
                ))}
              </ul>
              <p className="muted">The form below shows what would have been asked. It cannot be submitted.</p>
            </section>
          )}
          <CarrierForm
            key={`${selection}:${profileJson}`}
            form={adapter.form}
            resolutions={resolutions}
            disabled={!eligibility.eligible}
            exclusiveOptions={adapter.exclusiveOptions}
            validate={(answers: Answers) => validate(adapter, profile, answers, now, resolutions)}
            buildRequest={(answers: Answers) => buildRequest(adapter.form, resolutions, answers)}
            requestTitle={`${adapter.name} quote request`}
          />
        </>
      )}
    </div>
  );
}
