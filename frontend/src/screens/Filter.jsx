import React from "react";
import { FONT, SERIF, chipStyle } from "../ui.jsx";
import { FILTER_GROUPS, EXTRA_CHIPS } from "../constants.js";

const moreBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  marginTop: 8,
  padding: "13px 4px",
  background: "none",
  border: "none",
  cursor: "pointer",
  borderTop: "1px solid #ECE4D4",
};

const stepBtn = (disabled) => ({
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "1px solid #E6DECE",
  background: disabled ? "#F4EFE6" : "#FFFEFB",
  color: disabled ? "#CFC6B4" : "#1C1714",
  font: "600 20px " + FONT,
  cursor: disabled ? "default" : "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
});

export default function Filter({ filters, setFilter, partyCustom, setPartyCustom, extras, toggleExtra, note, setNote, showMore, toggleMore }) {
  const clampCustom = (n) => Math.max(1, Math.min(50, n));
  return (
    <div className="pad" style={{ paddingTop: 6, paddingBottom: 28, animation: "vmUp .45s ease both" }}>
      <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 30, color: "#1C1714", margin: "6px 0 4px" }}>Find dishes for us</h2>
      <p style={{ font: "500 13px " + FONT, color: "#9C9384", margin: "0 0 20px" }}>A few taps is all it takes.</p>

      {FILTER_GROUPS.map((g) => (
        <div key={g.key} style={{ marginBottom: 18 }}>
          <div style={{ font: "700 11px " + FONT, letterSpacing: ".13em", color: "#B5852F", marginBottom: 9 }}>{g.title.toUpperCase()}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {g.opts.map((v) => (
              <button key={v} onClick={() => setFilter(g.key, v)} style={chipStyle(filters[g.key] === v)}>
                {v}
              </button>
            ))}
          </div>
          {g.key === "party" && filters.party === "Custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, animation: "vmFade .3s ease both" }}>
              <button onClick={() => setPartyCustom((n) => clampCustom(n - 1))} disabled={partyCustom <= 1} style={stepBtn(partyCustom <= 1)}>−</button>
              <div style={{ minWidth: 70, textAlign: "center" }}>
                <div style={{ font: "700 24px " + FONT, color: "#1C1714", lineHeight: 1 }}>{partyCustom}</div>
                <div style={{ font: "500 11px " + FONT, color: "#9C9384", marginTop: 3 }}>{partyCustom === 1 ? "guest" : "guests"}</div>
              </div>
              <button onClick={() => setPartyCustom((n) => clampCustom(n + 1))} disabled={partyCustom >= 50} style={stepBtn(partyCustom >= 50)}>+</button>
            </div>
          )}
        </div>
      ))}

      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
          <span style={{ font: "700 11px " + FONT, letterSpacing: ".13em", color: "#B5852F" }}>ANYTHING SPECIFIC?</span>
          <span style={{ font: "500 11px " + FONT, color: "#C0B6A4" }}>optional</span>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. it's my daughter's birthday · no peanuts · not too heavy"
          rows={2}
          style={{ width: "100%", resize: "none", border: "1px solid #E6DECE", background: "#FFFEFB", borderRadius: 16, padding: "13px 14px", font: "500 13.5px " + FONT, color: "#1C1714", outline: "none", lineHeight: 1.5 }}
        />
      </div>

      <button onClick={toggleMore} style={moreBtn}>
        <span style={{ font: "600 13px " + FONT, color: "#1C1714" }}>{showMore ? "Fewer options" : "Show more options"}</span>
        <span style={{ color: "#B5852F", transform: showMore ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .25s", display: "inline-flex" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {showMore && (
        <div style={{ animation: "vmFade .3s ease both", paddingTop: 2, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {EXTRA_CHIPS.map(([k, l]) => (
            <button key={k} onClick={() => toggleExtra(k)} style={chipStyle(!!extras[k])}>
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
