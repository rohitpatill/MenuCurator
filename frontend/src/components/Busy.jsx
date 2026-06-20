import React from "react";
import { SERIF, GRAD, Spark } from "../ui.jsx";

export default function Busy({ text }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(246,241,232,.86)",
        backdropFilter: "blur(3px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        animation: "vmFade .25s ease",
      }}
    >
      <div style={{ position: "relative", width: 62, height: 62 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid #EFE2D2", borderTopColor: "#E8662B", animation: "vmSpin .9s linear infinite" }} />
        <div style={{ position: "absolute", inset: 14, borderRadius: "50%", background: GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spark size={18} />
        </div>
      </div>
      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: 19, color: "#5A4F40" }}>{text}</div>
    </div>
  );
}
