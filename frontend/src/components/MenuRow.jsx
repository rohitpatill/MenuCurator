import React from "react";
import { FONT, SERIF, GRAD, DietMark, priceLabel } from "../ui.jsx";

// One menu line. In ask mode shows a chevron; in pick mode a checkbox.
export default function MenuRow({ d, ask, picked, onTap }) {
  return (
    <button
      onClick={onTap}
      style={{
        width: "100%",
        display: "flex",
        gap: 11,
        alignItems: "flex-start",
        textAlign: "left",
        padding: 13,
        marginBottom: 8,
        borderRadius: 16,
        cursor: "pointer",
        border: "1px solid " + (picked ? "#E8662B" : "#ECE4D4"),
        background: picked ? "#FCF3EB" : "#FFFEFB",
        transition: "all .16s",
      }}
    >
      <span style={{ marginTop: 3 }}>
        <DietMark diet={d.diet} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 18, color: "#1C1714" }}>{d.name}</span>
          {d.tag && (
            <span style={{ font: "600 9px " + FONT, letterSpacing: ".08em", color: "#C7472A", background: "#FBEAE0", padding: "2px 6px", borderRadius: 5 }}>
              {d.tag === "bestseller" ? "Bestseller" : "Chef's"}
            </span>
          )}
        </span>
        <span style={{ display: "block", font: "500 11.5px " + FONT, color: "#9C9384", marginTop: 3, lineHeight: 1.4 }}>{d.desc}</span>
      </span>
      <span style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, color: "#1C1714" }}>{priceLabel(d)}</span>
        {ask ? (
          <span style={{ color: "#C7472A", display: "inline-flex" }}>›</span>
        ) : (
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              font: "700 13px " + FONT,
              border: "1.5px solid " + (picked ? "transparent" : "#D8CDB8"),
              background: picked ? GRAD : "#fff",
              color: picked ? "#fff" : "transparent",
            }}
          >
            ✓
          </span>
        )}
      </span>
    </button>
  );
}
