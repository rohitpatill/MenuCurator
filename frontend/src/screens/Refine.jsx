import React from "react";
import { FONT, SERIF, DietMark, Spark, maitreIcon, Bubble, Typing } from "../ui.jsx";

export default function Refine({ picked, chat, typing }) {
  return (
    <>
      <div className="pad" style={{ padding: "6px var(--pad-x) 6px", animation: "vmUp .45s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, margin: "4px 0 12px" }}>
          <div style={maitreIcon(34, 11)}>
            <Spark />
          </div>
          <div>
            <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 23, color: "#1C1714", margin: 0, lineHeight: 1.05 }}>Refine my picks</h2>
            <div style={{ font: "500 11.5px " + FONT, color: "#A39A8A", marginTop: 1 }}>Maître is looking at your selection</div>
          </div>
        </div>
        <div style={{ background: "#FBF3EA", border: "1px solid #F3E6D4", borderRadius: 16, padding: "12px 13px" }}>
          <div style={{ font: "700 9.5px " + FONT, letterSpacing: ".13em", color: "#B5852F", marginBottom: 8 }}>YOUR PICKS · {picked.length}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {picked.map((p) => (
              <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "#FFFEFB", border: "1px solid #EFE2D2" }}>
                <DietMark diet={p.diet} size={10} />
                <span style={{ font: "600 12px " + FONT, color: "#3A322A" }}>{p.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="pad" style={{ padding: "10px var(--pad-x) 18px" }}>
        {chat.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
        {typing && <Typing />}
      </div>
    </>
  );
}
