import React from "react";
import { FONT, SERIF, GRAD, DietMark, Spark, priceLabel, reasonBox, cardBox } from "../ui.jsx";

const comboNum = {
  flex: "none",
  width: 24,
  height: 24,
  borderRadius: 8,
  background: GRAD,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  font: "700 12px " + FONT,
};

// One curated set (Combos view): grouped by course, with a "why" and set total.
export default function ComboCard({ c, num }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={comboNum}>{num}</span>
        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 21, color: "#1C1714", lineHeight: 1 }}>{c.title}</span>
      </div>
      <div style={{ ...reasonBox, marginTop: 11, padding: "9px 11px", borderRadius: 12 }}>
        <Spark size={13} fill="#E8662B" />
        <span style={{ font: "500 12px " + FONT, color: "#7A5A3A", lineHeight: 1.45 }}>{c.why}</span>
      </div>
      {c.groups.map((g, gi) => (
        <div key={gi} style={{ marginTop: 11 }}>
          <div style={{ font: "700 9.5px " + FONT, letterSpacing: ".12em", color: "#B0A693", textTransform: "uppercase", marginBottom: 4 }}>{g.course}</div>
          {g.items.map((it, ii) => (
            <div key={ii} style={{ display: "flex", alignItems: "center", gap: 9, padding: "3px 0" }}>
              <DietMark diet={it.diet} size={12} />
              <span style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontWeight: 600, fontSize: 16.5, color: "#1C1714", lineHeight: 1.25 }}>{it.name}</span>
              <span style={{ flex: "none", font: "500 11.5px " + FONT, color: "#A39A8A" }}>{priceLabel(it)}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #F0E8DA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ font: "600 11px " + FONT, letterSpacing: ".08em", color: "#B0A693", textTransform: "uppercase" }}>Set total</span>
        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 18, color: "#1C1714" }}>₹{c.total}</span>
      </div>
    </div>
  );
}
