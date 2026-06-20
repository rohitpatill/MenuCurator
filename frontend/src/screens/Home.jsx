import React from "react";
import { FONT, SERIF, GRAD, Spark, Arrow, maitreIcon } from "../ui.jsx";

const heroBtn = {
  width: "100%",
  textAlign: "left",
  border: "none",
  cursor: "pointer",
  borderRadius: 24,
  padding: 22,
  marginBottom: 14,
  background: "linear-gradient(140deg,#2A2018,#1C1714 62%)",
  position: "relative",
  overflow: "hidden",
  boxShadow: "0 22px 44px -22px rgba(40,24,10,.75)",
};

function SmallCard({ onClick, title, sub, children }) {
  return (
    <button onClick={onClick} style={{ textAlign: "left", cursor: "pointer", border: "1px solid #ECE4D4", background: "#FFFEFB", borderRadius: 20, padding: "18px 16px", boxShadow: "0 8px 20px -16px rgba(40,30,15,.5)" }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: "#F4EEE2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, color: "#C7472A" }}>{children}</div>
      <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 20, color: "#1C1714", lineHeight: 1.1 }}>
        {title[0]}
        <br />
        {title[1]}
      </div>
      <div style={{ font: "500 11.5px " + FONT, color: "#9C9384", marginTop: 6, lineHeight: 1.45 }}>{sub}</div>
    </button>
  );
}

export default function Home({ onFilter, onAsk, onPick }) {
  return (
    <div className="pad" style={{ paddingTop: 8, paddingBottom: 30, animation: "vmUp .5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, margin: "6px 0 18px" }}>
        <div style={maitreIcon(42, 13)}>
          <Spark size={20} />
        </div>
        <div>
          <div style={{ font: "600 13px " + FONT, color: "#1C1714" }}>MenuCurator</div>
          <div style={{ font: "500 11.5px " + FONT, color: "#A39A8A" }}>your menu concierge</div>
        </div>
      </div>
      <h1 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: "clamp(34px, 6vw, 44px)", lineHeight: 1.05, color: "#1C1714", margin: "0 0 8px", letterSpacing: "-.01em" }}>
        Good evening.
        <br />
        What are you in the mood for?
      </h1>
      <p style={{ font: "500 14px " + FONT, color: "#8C8373", lineHeight: 1.5, margin: "0 0 22px", maxWidth: "40ch" }}>
        A 540-dish menu, made simple. Tell me what you'd like and I'll do the searching.
      </p>

      <button onClick={onFilter} style={heroBtn}>
        <div style={{ position: "absolute", right: -40, top: -50, width: 190, height: 190, borderRadius: "50%", background: "radial-gradient(circle,rgba(232,102,43,.5),transparent 65%)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,.09)", marginBottom: 14 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: GRAD }} />
            <span style={{ font: "700 10px " + FONT, letterSpacing: ".16em", color: "#F4E7D6" }}>MOST POPULAR</span>
          </div>
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 27, color: "#FCF8F1", lineHeight: 1.1 }}>Find dishes for us</div>
          <div style={{ font: "500 13px " + FONT, color: "#C7BBA8", marginTop: 6, lineHeight: 1.5, maxWidth: "34ch" }}>
            Tap a few preferences — get a tailored shortlist in seconds, each with a reason.
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 16, font: "700 13px " + FONT, color: "#fff", background: GRAD, padding: "11px 18px", borderRadius: 999, boxShadow: "0 10px 24px -8px rgba(216,90,40,.6)" }}>
            Start <Arrow />
          </div>
        </div>
      </button>

      <div className="grid-2">
        <SmallCard onClick={onAsk} title={["Ask about", "a dish"]} sub="Pieces, spice, what's in it.">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M21 11.5a8.4 8.4 0 01-12 7.6L3 21l1.9-6A8.5 8.5 0 1121 11.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M9 11.5h.01M12 11.5h.01M15 11.5h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </SmallCard>
        <SmallCard onClick={onPick} title={["Refine", "my picks"]} sub="Choose, then I'll balance it.">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M4 7h11M4 12h16M4 17h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="19.5" cy="7" r="2.3" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        </SmallCard>
      </div>
    </div>
  );
}
