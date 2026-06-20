// Shared style helpers + small presentational atoms, ported from the prototype.
import React from "react";

export const FONT = "'Plus Jakarta Sans',sans-serif";
export const SERIF = "'Cormorant Garamond',serif";
export const GRAD = "linear-gradient(135deg,#F4A12A,#E8662B 55%,#C7472A)";
export const DIET = { veg: "#1E8E4E", nonveg: "#B11D1D" };

export function chipStyle(selected) {
  return selected
    ? {
        padding: "9px 14px",
        borderRadius: "999px",
        border: "1px solid #1C1714",
        background: "#1C1714",
        color: "#FBF6EC",
        font: "600 13.5px " + FONT,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all .16s",
        boxShadow: "0 5px 14px -6px rgba(28,23,20,.5)",
      }
    : {
        padding: "9px 14px",
        borderRadius: "999px",
        border: "1px solid #E4DCCD",
        background: "#FFFEFB",
        color: "#5C5448",
        font: "500 13.5px " + FONT,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all .16s",
      };
}

// veg/non-veg square marker
export function DietMark({ diet, size = 14 }) {
  const c = DIET[diet] || DIET.veg;
  const dot = Math.round(size * 0.42);
  return (
    <span
      style={{
        flex: "none",
        width: size,
        height: size,
        borderRadius: 3,
        border: `1.6px solid ${c}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ width: dot, height: dot, borderRadius: "50%", background: c }} />
    </span>
  );
}

export function Spark({ size = 16, fill = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.5l1.9 5.4 5.6.2-4.4 3.5 1.5 5.4L12 19.3 7.9 22.4l1.5-5.4L5 13.5l5.6-.2L12 2.5z"
        fill={fill}
      />
    </svg>
  );
}

export function Arrow({ size = 15, stroke = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function priceLabel(d) {
  return "₹" + d.price;
}
export function serveLabel(d) {
  return d.pieces ? `${d.pieces} pcs · serves ${d.serves}` : `serves ${d.serves}`;
}

export const reasonBox = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 13,
  background: "#FBF3EA",
  border: "1px solid #F3E6D4",
};

// chat bubble style
export function bubble(role) {
  return role === "user"
    ? {
        maxWidth: "80%",
        padding: "11px 14px",
        borderRadius: "16px 16px 4px 16px",
        background: GRAD,
        color: "#fff",
        font: "500 13.5px " + FONT,
        lineHeight: 1.45,
        boxShadow: "0 8px 18px -8px rgba(216,90,40,.45)",
      }
    : {
        maxWidth: "82%",
        padding: "11px 14px",
        borderRadius: "16px 16px 16px 4px",
        background: "#FFFEFB",
        border: "1px solid #ECE4D4",
        color: "#3A322A",
        font: "500 13.5px " + FONT,
        lineHeight: 1.5,
      };
}

export function Typing() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 4 }}>
      <div
        style={{
          display: "flex",
          gap: 5,
          padding: "13px 16px",
          background: "#FFFEFB",
          border: "1px solid #ECE4D4",
          borderRadius: "16px 16px 16px 4px",
        }}
      >
        {[0, 0.18, 0.36].map((d, i) => (
          <span
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#E8662B",
              animation: `vmBlink 1.1s infinite ${d}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
