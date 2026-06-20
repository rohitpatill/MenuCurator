import React from "react";
import { FONT, SERIF, DietMark, Spark, priceLabel, serveLabel, reasonBox, cardBox } from "../ui.jsx";

const askBtn = {
  marginTop: 11,
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  padding: 10,
  borderRadius: 12,
  border: "1px solid #E6DECE",
  background: "#FFFEFB",
  cursor: "pointer",
  font: "600 12.5px " + FONT,
  color: "#1C1714",
};

// One recommended dish (Individual view).
export default function DishCard({ d, onAsk }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <DietMark diet={d.diet} />
            <span style={{ font: "600 10px " + FONT, letterSpacing: ".1em", color: "#B0A693", textTransform: "uppercase" }}>
              {d.cuisine} · {d.course}
            </span>
          </div>
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 21, color: "#1C1714", lineHeight: 1.15, marginTop: 5 }}>{d.name}</div>
        </div>
        <div style={{ flex: "none", textAlign: "right" }}>
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 19, color: "#1C1714" }}>{priceLabel(d)}</div>
          <div style={{ font: "500 10.5px " + FONT, color: "#A39A8A", marginTop: 1 }}>{serveLabel(d)}</div>
        </div>
      </div>
      <div style={{ ...reasonBox, marginTop: 12 }}>
        <Spark size={14} fill="#E8662B" />
        <span style={{ font: "500 12.5px " + FONT, color: "#7A5A3A", lineHeight: 1.45 }}>{d.why}</span>
      </div>
      <button onClick={onAsk} style={askBtn}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M21 11.5a8.4 8.4 0 01-12 7.6L3 21l1.9-6A8.5 8.5 0 1121 11.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
        Ask about this dish
      </button>
    </div>
  );
}
