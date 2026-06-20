import React from "react";
import { FONT } from "../ui.jsx";

export const ctaBase = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  padding: 16,
  border: "none",
  borderRadius: 18,
  cursor: "pointer",
  font: "700 15px " + FONT,
  transition: "all .2s",
};

export default function Footer({ children }) {
  return (
    <div
      className="pad"
      style={{ flex: "none", position: "relative", zIndex: 4, paddingTop: 14, paddingBottom: 18, background: "linear-gradient(rgba(246,241,232,0),#F6F1E8 38%)" }}
    >
      {children}
    </div>
  );
}
