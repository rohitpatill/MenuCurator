import React from "react";
import { FONT, SERIF, Spark, maitreIcon } from "../ui.jsx";
import ComboCard from "../components/ComboCard.jsx";
import DishCard from "../components/DishCard.jsx";

const adjustBtn = {
  marginTop: 18,
  width: "100%",
  padding: 13,
  borderRadius: 14,
  border: "1px dashed #D8CDB8",
  background: "none",
  cursor: "pointer",
  font: "600 13px " + FONT,
  color: "#9C8A6E",
};

function Empty() {
  return (
    <div style={{ textAlign: "center", padding: "28px 10px", color: "#A39A8A", font: "500 13px " + FONT }}>
      No matches for these filters. Try widening your budget or preferences.
    </div>
  );
}

export default function Results({ data, view, setView, onAsk, onBack }) {
  const combosView = view !== "individual";
  const tabOn = { flex: 1, padding: 9, borderRadius: 10, border: "none", cursor: "pointer", background: "#FFFEFB", color: "#1C1714", font: "700 13px " + FONT, boxShadow: "0 3px 8px -3px rgba(40,30,15,.3)" };
  const tabOff = { flex: 1, padding: 9, borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: "#9C8A6E", font: "600 13px " + FONT };

  return (
    <div className="pad" style={{ padding: "6px var(--pad-x) 30px", animation: "vmUp .45s ease both" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11, margin: "4px 0 6px" }}>
        <div style={maitreIcon(34, 11)}>
          <Spark />
        </div>
        <div style={{ paddingTop: 1 }}>
          <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 25, color: "#1C1714", margin: 0, lineHeight: 1.1 }}>Here's what I'd order</h2>
          <div style={{ font: "500 12px " + FONT, color: "#A39A8A", marginTop: 3 }}>{data.summary}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginTop: 14, padding: 4, background: "#EFE7D8", borderRadius: 14 }}>
        <button onClick={() => setView("combos")} style={combosView ? tabOn : tabOff}>Combos</button>
        <button onClick={() => setView("individual")} style={combosView ? tabOff : tabOn}>Individual</button>
      </div>

      {combosView ? (
        data.combos.length ? data.combos.map((c, i) => <ComboCard key={i} c={c} num={i + 1} />) : <Empty />
      ) : data.individual.length ? (
        data.individual.map((d, i) => <DishCard key={i} d={d} onAsk={() => onAsk(d)} />)
      ) : (
        <Empty />
      )}

      <button onClick={onBack} style={adjustBtn}>Adjust my preferences</button>
    </div>
  );
}
