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

export default function Header({ showBack, onBack, restaurant, tagline }) {
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
    </header>
  );
}
