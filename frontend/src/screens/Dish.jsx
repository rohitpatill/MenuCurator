import React from "react";
import { FONT, SERIF, DietMark, priceLabel, serveLabel, Bubble, Typing } from "../ui.jsx";

export default function Dish({ dish, chat, typing }) {
  return (
    <>
      <div className="pad" style={{ paddingTop: 6, paddingBottom: 16, animation: "vmUp .4s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DietMark diet={dish.diet} />
          <span style={{ font: "600 10px " + FONT, letterSpacing: ".1em", color: "#B0A693", textTransform: "uppercase" }}>
            {dish.cuisine} · {dish.course}
          </span>
        </div>
        <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 28, color: "#1C1714", margin: "6px 0 4px", lineHeight: 1.1 }}>{dish.name}</h2>
        <div style={{ display: "flex", gap: 14, font: "600 12px " + FONT, color: "#7A715F", marginBottom: 4 }}>
          <span>{priceLabel(dish)}</span>
          <span style={{ color: "#D8CDB8" }}>·</span>
          <span>{serveLabel(dish)}</span>
          <span style={{ color: "#D8CDB8" }}>·</span>
          <span>{dish.spice ? dish.spice + " heat" : "no chilli"}</span>
        </div>
      </div>
      <div className="pad" style={{ paddingTop: 8, paddingBottom: 20 }}>
        {chat.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
        {typing && <Typing />}
      </div>
    </>
  );
}
