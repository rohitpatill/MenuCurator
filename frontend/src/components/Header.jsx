import React from "react";
import { FONT } from "../ui.jsx";

const circleBtn = {
  flex: "none",
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "1px solid #E6DECE",
  background: "#FFFEFB",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#1C1714",
};

export default function Header({ showBack, onBack, restaurant, tagline, table = "Table 14" }) {
  return (
    <header
      className="pad"
      style={{ flex: "none", position: "relative", zIndex: 3, display: "flex", alignItems: "center", gap: 12, paddingTop: 20, paddingBottom: 14 }}
    >
      {showBack && (
        <button onClick={onBack} aria-label="Back" style={circleBtn}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "700 11px " + FONT, letterSpacing: ".22em", color: "#B5852F" }}>{restaurant.toUpperCase()}</div>
        {tagline ? (
          <div style={{ font: "500 12px " + FONT, color: "#9C9384", marginTop: 2, letterSpacing: ".04em" }}>{tagline}</div>
        ) : null}
      </div>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 999, background: "#FFFEFB", border: "1px solid #ECE4D4" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1E8E4E", boxShadow: "0 0 0 3px rgba(30,142,78,.14)" }} />
        <span style={{ font: "600 12px " + FONT, color: "#1C1714" }}>{table}</span>
      </div>
    </header>
  );
}
