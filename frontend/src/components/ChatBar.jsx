import React from "react";
import { FONT, GRAD } from "../ui.jsx";

const qChip = {
  flex: "none",
  whiteSpace: "nowrap",
  padding: "8px 13px",
  borderRadius: 999,
  border: "1px solid #E6DECE",
  background: "#FFFEFB",
  cursor: "pointer",
  font: "600 12px " + FONT,
  color: "#5A4F40",
};
const sendBtn = {
  flex: "none",
  width: 46,
  height: 46,
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  background: GRAD,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 8px 18px -6px rgba(216,90,40,.5)",
};

export default function ChatBar({ suggested, onChip, value, onChange, onSend, placeholder }) {
  return (
    <div
      className="pad"
      style={{ flex: "none", position: "relative", zIndex: 4, paddingTop: 10, paddingBottom: 16, background: "#F6F1E8", borderTop: "1px solid #ECE4D4" }}
    >
      <div className="vm-scroll" style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 9 }}>
        {suggested.map(([label, q]) => (
          <button key={label} onClick={() => onChip(q)} style={qChip}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          style={{ flex: 1, border: "1px solid #E6DECE", background: "#FFFEFB", borderRadius: 14, padding: "13px 14px", font: "500 13.5px " + FONT, color: "#1C1714", outline: "none" }}
        />
        <button onClick={onSend} aria-label="Send" style={sendBtn}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M4 12l16-7-7 16-2-7-7-2z" fill="#fff" />
          </svg>
        </button>
      </div>
    </div>
  );
}
