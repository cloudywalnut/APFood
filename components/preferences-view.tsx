"use client";

import { useState, type ReactNode } from "react";
import { Bell, ChevronRight, Info, Settings } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import { MobileTour } from "./ui/shell";
import { SectionCard } from "./ui/primitives";

export function PreferencesView({ sessionAction }: { sessionAction: ReactNode }) {
  const [preferences, save] = usePreferences();
  const [tour, setTour] = useState(0);
  return (
    <>
      <div className="page-heading">
        <h1>Settings</h1>
        {sessionAction}
      </div>
      <div className="ap-preferences-grid">
        <SectionCard title="Appearance">
          <h3>APFoods theme</h3>
          <p className="muted small">Cream surfaces, espresso text and mustard accents.</p>
          <fieldset className="ap-radio-group">
            <legend>List density</legend>
            {(["comfortable", "compact"] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="density"
                  checked={preferences.density === value}
                  onChange={() => save({ ...preferences, density: value })}
                />
                {value === "comfortable" ? "Comfortable" : "Compact"}
              </label>
            ))}
          </fieldset>
          <div className="ap-palette" aria-label="APFoods colour palette">
            <span />
            <span />
            <span />
          </div>
        </SectionCard>
        <SectionCard title="Preferences">
          <div className="ap-settings-list">
            <label>
              <Bell size={20} />
              <span>
                Show in-app order updates<small>See order updates in APFoods.</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.inAppUpdates}
                onChange={(event) => save({ ...preferences, inAppUpdates: event.target.checked })}
              />
            </label>
            <label>
              <Settings size={20} />
              <span>
                Use local display timezone
                <small>Updates and reports only. Pickup operations remain in Malaysia time.</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.localTimezone}
                onChange={(event) => save({ ...preferences, localTimezone: event.target.checked })}
              />
            </label>
            <button onClick={() => setTour(tour + 1)}>
              <Info size={20} />
              <span>
                Replay introduction<small>Find meals, schedule a pickup and collect with a code.</small>
              </span>
              <ChevronRight size={18} />
            </button>
          </div>
        </SectionCard>
        <SectionCard title="Session" className="ap-session-card">
          <div className="ap-session-row">
            <div>
              <h3>End your session</h3>
              <p className="muted small">Log out of your current APFoods session on this browser.</p>
            </div>
            {sessionAction}
          </div>
        </SectionCard>
      </div>
      {tour > 0 && <MobileTour key={tour} force />}
    </>
  );
}
