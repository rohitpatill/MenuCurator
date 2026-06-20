import React, { useMemo, useState } from "react";
import { FONT, SERIF } from "../ui.jsx";
import MenuRow from "../components/MenuRow.jsx";

// Top-level menu categories. Beverages is split into its own sub-sections.
const CATEGORIES = [
  { key: "Starter", label: "Starters" },
  { key: "Main", label: "Mains" },
  { key: "Dessert", label: "Desserts" },
  { key: "Drink", label: "Beverages" },
];

// Sub-tabs shown inside the Beverages category. "Spirits & Beer" covers all
// neat alcohol (whisky, vodka, rum, gin, tequila, brandy, beer, wine).
const DRINK_SUBTABS = [
  { key: "mocktail", label: "Mocktails", match: (d) => d.type === "mocktail" },
  { key: "cocktail", label: "Cocktails", match: (d) => d.type === "cocktail" },
  { key: "spirit", label: "Spirits & Beer", match: (d) => d.type === "spirit" },
  { key: "beverage", label: "Tea, Coffee & Soft", match: (d) => d.type === "beverage" },
];

const DIET_TABS = [
  { key: "all", label: "All" },
  { key: "veg", label: "Veg" },
  { key: "nonveg", label: "Non-veg" },
];

function tabStyle(active) {
  return {
    flex: "none",
    padding: "8px 16px",
    borderRadius: 999,
    border: "1px solid " + (active ? "#1C1714" : "#E4DCCD"),
    background: active ? "#1C1714" : "#FFFEFB",
    color: active ? "#FBF6EC" : "#5C5448",
    font: "600 13px " + FONT,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all .16s",
  };
}

function dietPill(active) {
  return {
    flex: 1,
    padding: "7px 10px",
    borderRadius: 9,
    border: "none",
    background: active ? "#FFFEFB" : "transparent",
    color: active ? "#1C1714" : "#9C8A6E",
    font: (active ? "700" : "600") + " 12.5px " + FONT,
    cursor: "pointer",
    boxShadow: active ? "0 3px 8px -3px rgba(40,30,15,.3)" : "none",
    transition: "all .16s",
  };
}

export default function Menu({ mode, dishes, picks, pickCount, onTapAsk, onTapPick }) {
  const ask = mode === "ask";
  const [category, setCategory] = useState("Starter");
  const [diet, setDiet] = useState("all"); // all | veg | nonveg
  const [drinkTab, setDrinkTab] = useState("mocktail"); // beverage sub-tab

  const isDrink = category === "Drink";
  // Veg/Non-veg only makes sense where both exist — Starters and Mains.
  // Desserts are vegetarian and Beverages aren't diet-typed, so hide it there.
  const showDiet = category === "Starter" || category === "Main";

  const filtered = useMemo(() => {
    let list = dishes.filter((d) => d.course === category);
    if (isDrink) {
      const sub = DRINK_SUBTABS.find((t) => t.key === drinkTab);
      return sub ? list.filter(sub.match) : list;
    }
    if (showDiet && diet === "veg") list = list.filter((d) => d.diet === "veg");
    else if (showDiet && diet === "nonveg") list = list.filter((d) => d.diet === "nonveg");
    return list;
  }, [dishes, category, diet, drinkTab, isDrink, showDiet]);

  return (
    <div style={{ animation: "vmUp .45s ease both" }}>
      {/* Heading */}
      <div className="pad" style={{ paddingTop: 6 }}>
        <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 30, color: "#1C1714", margin: "6px 0 4px" }}>
          {ask ? "Browse the menu" : "Pick your dishes"}
        </h2>
        <p style={{ font: "500 13px " + FONT, color: "#9C9384", margin: "0 0 14px" }}>
          {ask
            ? "Choose a section, tap any dish to ask about it."
            : pickCount > 0
            ? `Browse any section — your ${pickCount} pick${pickCount > 1 ? "s" : ""} stay selected.`
            : "Browse by section and select what you like."}
        </p>
      </div>

      {/* Sticky category + diet controls */}
      <div style={{ position: "sticky", top: 0, zIndex: 2, background: "#F6F1E8", paddingBottom: 12, boxShadow: "0 6px 10px -8px rgba(40,30,15,.25)" }}>
        <div className="pad vm-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingTop: 4, paddingBottom: 10 }}>
          {CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCategory(c.key)} style={tabStyle(category === c.key)}>
              {c.label}
            </button>
          ))}
        </div>
        {/* Diet filter for food, OR beverage sub-tabs for drinks — both as a
            horizontal bar so nothing requires a long scroll. */}
        {showDiet ? (
          <div className="pad">
            <div style={{ display: "flex", gap: 4, padding: 4, background: "#EFE7D8", borderRadius: 12 }}>
              {DIET_TABS.map((t) => (
                <button key={t.key} onClick={() => setDiet(t.key)} style={dietPill(diet === t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ) : isDrink ? (
          <div className="pad vm-scroll" style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {DRINK_SUBTABS.map((t) => (
              <button key={t.key} onClick={() => setDrinkTab(t.key)} style={tabStyle(drinkTab === t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Dish list */}
      <div className="pad" style={{ paddingTop: 16, paddingBottom: 30 }}>
        {filtered.length ? (
          filtered.map((d) => (
            <MenuRow key={d.id} d={d} ask={ask} picked={!!picks[d.id]} onTap={() => (ask ? onTapAsk(d) : onTapPick(d.id))} />
          ))
        ) : (
          <div style={{ textAlign: "center", padding: "28px 10px", color: "#A39A8A", font: "500 13px " + FONT }}>
            No {showDiet && diet === "veg" ? "vegetarian " : showDiet && diet === "nonveg" ? "non-veg " : ""}
            {isDrink ? "beverages" : "dishes"} in this section.
          </div>
        )}
      </div>
    </div>
  );
}
