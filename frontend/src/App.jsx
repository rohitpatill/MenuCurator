import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import {
  FONT,
  SERIF,
  GRAD,
  DIET,
  DietMark,
  Spark,
  Arrow,
  chipStyle,
  priceLabel,
  serveLabel,
  reasonBox,
  bubble,
  Typing,
} from "./ui.jsx";

const FILTER_GROUPS = [
  { key: "budget", title: "Budget", opts: ["Up to ₹1000", "Up to ₹2000", "Up to ₹5000", "Up to ₹10,000", "No limits"] },
  { key: "veg", title: "Preference", opts: ["Veg", "Non-veg", "Both", "Jain"] },
  { key: "party", title: "Party size", opts: ["2–3", "5–6", "Custom"] },
  { key: "drinks", title: "Drinks", opts: ["None", "Mocktails", "Cocktails", "Both"] },
  { key: "course", title: "Course", opts: ["Starters", "Main course", "Desserts", "Full meal"] },
  { key: "cuisine", title: "Cuisine", opts: ["Indian", "Chinese", "Continental", "Italian", "Any"] },
  { key: "spice", title: "Spice level", opts: ["Mild", "Medium", "Spicy"] },
];

const EXTRA_CHIPS = [
  ["light", "Light bite"],
  ["hearty", "Hearty meal"],
  ["nut", "Nut-free"],
  ["dairy", "Dairy-free"],
  ["gluten", "Gluten-free"],
  ["nog", "No onion-garlic"],
  ["hot", "Tea / Coffee"],
  ["best", "Bestsellers only"],
  ["chef", "Chef's specials"],
];

const DEFAULT_FILTERS = {
  budget: "Up to ₹2000",
  veg: "Both",
  party: "2–3",
  drinks: "None",
  course: "Full meal",
  cuisine: "Any",
  spice: "Medium",
};

function partySize(party) {
  return party === "5–6" ? 6 : party === "Custom" ? 4 : 3;
}

export default function App() {
  const [screen, setScreen] = useState("home"); // home|filter|results|menu|refine|dish
  const [menuMode, setMenuMode] = useState("ask"); // ask|pick
  const [busy, setBusy] = useState(null);
  const [busyText, setBusyText] = useState("");

  // menu data
  const [menu, setMenu] = useState({ restaurant: "Vermillion", tagline: "Kitchen & Bar", dishes: [] });

  // filters
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [extras, setExtras] = useState({});
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);

  // results
  const [results, setResults] = useState({ individual: [], combos: [], summary: "" });
  const [resultView, setResultView] = useState("combos");

  // picks / refine
  const [picks, setPicks] = useState({});
  const [refineChat, setRefineChat] = useState([]);
  const [refineTyping, setRefineTyping] = useState(false);
  const [refineInput, setRefineInput] = useState("");

  // dish q&a
  const [dish, setDish] = useState(null);
  const [dishReturn, setDishReturn] = useState("home");
  const [chat, setChat] = useState([]);
  const [dishTyping, setDishTyping] = useState(false);
  const [input, setInput] = useState("");

  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    api
      .getMenu()
      .then((m) => setMenu(m))
      .catch(() => {});
  }, []);

  const dishesByCourse = useMemo(() => {
    const order = ["Starter", "Main", "Dessert"];
    const titleMap = { Starter: "Starters", Main: "Main Course", Dessert: "Desserts" };
    return order
      .map((c) => ({ title: titleMap[c], items: menu.dishes.filter((d) => d.course === c) }))
      .filter((s) => s.items.length);
  }, [menu]);

  const pickCount = Object.keys(picks).filter((k) => picks[k]).length;
  const party = partySize(filters.party);

  function go(s) {
    setScreen(s);
  }
  function back() {
    if (screen === "dish") go(dishReturn || "home");
    else if (screen === "results") go("filter");
    else if (screen === "refine") go("menu");
    else go("home");
  }

  // ---- Feature 2: recommend ----
  async function runFilter() {
    setBusy(true);
    setBusyText("Reading the menu for you…");
    const payload = { filters, extras, note, party_size: party };
    try {
      const r = await api.recommend(payload);
      const summary = [filters.veg, filters.course, filters.cuisine, "party of " + party].join(" · ");
      setResults({ individual: r.individual || [], combos: r.combos || [], summary });
      setResultView("combos");
      setBusy(null);
      go("results");
    } catch (e) {
      setBusy(null);
      setResults({ individual: [], combos: [], summary: "Couldn't reach the kitchen — is the backend running?" });
      go("results");
    }
  }

  // ---- menu / picks ----
  function openMenu(mode) {
    setMenuMode(mode);
    setPicks({});
    go("menu");
  }
  function togglePick(id) {
    setPicks((p) => ({ ...p, [id]: !p[id] }));
  }

  // ---- Feature 3: refine ----
  async function runRefine() {
    if (pickCount === 0) return;
    setBusy(true);
    setBusyText("Looking at your selection…");
    const picked = menu.dishes.filter((d) => picks[d.id]);
    try {
      const r = await api.refine({ picked_ids: picked.map((d) => d.id), question: "", party_size: party });
      setRefineChat([{ role: "ai", text: r.answer }]);
    } catch (e) {
      setRefineChat([{ role: "ai", text: "Couldn't reach the kitchen — is the backend running?" }]);
    }
    setRefineInput("");
    setRefineTyping(false);
    setBusy(null);
    go("refine");
  }
  async function askRefine(text) {
    if (!text) return;
    const picked = menu.dishes.filter((d) => picks[d.id]);
    setRefineChat((c) => [...c, { role: "user", text }]);
    setRefineTyping(true);
    try {
      const r = await api.refine({ picked_ids: picked.map((d) => d.id), question: text, party_size: party });
      setRefineChat((c) => [...c, { role: "ai", text: r.answer }]);
    } catch (e) {
      setRefineChat((c) => [...c, { role: "ai", text: "Sorry — I couldn't reach the kitchen just now." }]);
    }
    setRefineTyping(false);
  }
  function sendRefine() {
    const v = refineInput.trim();
    if (!v) return;
    setRefineInput("");
    askRefine(v);
  }

  // ---- Feature 1: dish q&a ----
  function openDish(d, from) {
    setDish(d);
    setDishReturn(from);
    setInput("");
    setChat([
      {
        role: "ai",
        text: `Hi! Ask me anything about the ${d.name} — pieces, spice, what's in it, whether it suits your group.`,
      },
    ]);
    go("dish");
  }
  async function ask(text) {
    if (!dish || !text) return;
    setChat((c) => [...c, { role: "user", text }]);
    setDishTyping(true);
    try {
      const r = await api.askDish(dish.id, text);
      setChat((c) => [...c, { role: "ai", text: r.answer }]);
    } catch (e) {
      setChat((c) => [...c, { role: "ai", text: "Sorry — I couldn't reach the kitchen just now." }]);
    }
    setDishTyping(false);
  }
  function sendInput() {
    const v = input.trim();
    if (!v) return;
    setInput("");
    ask(v);
  }

  const showFilterCta = screen === "filter";
  const showPickCta = screen === "menu" && menuMode === "pick";

  return (
    <div className="vm-stage">
      <Pitch restaurant={menu.restaurant} tagline={menu.tagline} />
      <div className="vm-phone">
        <BackdropGlow />
        <Header showBack={screen !== "home"} onBack={back} restaurant={menu.restaurant} tagline={menu.tagline} />

        <div className="vm-body vm-scroll">
          {screen === "home" && <Home onFilter={() => go("filter")} onAsk={() => openMenu("ask")} onPick={() => openMenu("pick")} />}
          {screen === "filter" && (
            <Filter
              filters={filters}
              setFilter={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
              extras={extras}
              toggleExtra={(k) => setExtras((e) => ({ ...e, [k]: !e[k] }))}
              note={note}
              setNote={setNote}
              showMore={showMore}
              toggleMore={() => setShowMore((s) => !s)}
            />
          )}
          {screen === "results" && (
            <Results
              data={results}
              view={resultView}
              setView={setResultView}
              onAsk={(d) => openDish(d, "results")}
              onBack={() => go("filter")}
            />
          )}
          {screen === "menu" && (
            <Menu
              mode={menuMode}
              sections={dishesByCourse}
              picks={picks}
              onTapAsk={(d) => openDish(d, "menu")}
              onTapPick={togglePick}
            />
          )}
          {screen === "refine" && (
            <Refine picked={menu.dishes.filter((d) => picks[d.id])} chat={refineChat} typing={refineTyping} />
          )}
          {screen === "dish" && dish && <Dish dish={dish} chat={chat} typing={dishTyping} />}

          {busy && <Busy text={busyText} />}
        </div>

        {showFilterCta && (
          <Footer>
            <button onClick={runFilter} style={ctaPrimary}>
              <Spark /> Find my picks
            </button>
          </Footer>
        )}
        {showPickCta && (
          <Footer>
            <button
              onClick={runRefine}
              style={{
                ...ctaBase,
                background: pickCount > 0 ? GRAD : "#EDE5D6",
                color: pickCount > 0 ? "#fff" : "#A99B82",
                boxShadow: pickCount > 0 ? "0 14px 30px -10px rgba(216,90,40,.6)" : "none",
              }}
            >
              {pickCount > 0 ? `Refine my ${pickCount} pick${pickCount > 1 ? "s" : ""}` : "Select dishes to refine"}
            </button>
          </Footer>
        )}
        {screen === "dish" && (
          <ChatBar
            suggested={[
              ["What's in it?", "What does it contain?"],
              ["How many pieces?", "How many pieces?"],
              ["Enough for 3?", "Is it enough for 3 of us?"],
              ["How spicy?", "How spicy is it?"],
              ["Veg or Jain?", "Is it veg or Jain?"],
            ]}
            onChip={(q) => ask(q)}
            value={input}
            onChange={setInput}
            onSend={sendInput}
            placeholder="Ask anything about this dish…"
          />
        )}
        {screen === "refine" && (
          <ChatBar
            suggested={[
              ["Is this enough for us?", "Is this enough for our group?"],
              ["Suggest a dessert", "Can you suggest a dessert that suits us?"],
              ["What pairs well?", "What would pair well with these?"],
              ["Anything better?", "Is there anything I should swap for something better?"],
            ]}
            onChip={(q) => askRefine(q)}
            value={refineInput}
            onChange={setRefineInput}
            onSend={sendRefine}
            placeholder="Ask about your picks…"
          />
        )}
      </div>
    </div>
  );
}

/* ============================ sub-components ============================ */

function Pitch({ restaurant, tagline }) {
  return (
    <div className="vm-pitch">
      <div style={{ font: "700 12px " + FONT, letterSpacing: ".28em", color: "#E89A4E" }}>
        {restaurant.toUpperCase()}
      </div>
      <div style={{ font: "500 13px " + FONT, letterSpacing: ".06em", color: "#9A8D7B", marginTop: 4 }}>{tagline}</div>
      <h1
        style={{
          fontFamily: SERIF,
          fontWeight: 600,
          fontSize: 54,
          lineHeight: 1.02,
          letterSpacing: "-.01em",
          margin: "26px 0 0",
          color: "#FBF6EC",
        }}
      >
        The whole menu,
        <br />
        in a few taps.
      </h1>
      <p style={{ font: "500 16px " + FONT, lineHeight: 1.6, color: "#B9AC98", margin: "20px 0 0", maxWidth: "38ch" }}>
        No more flipping through 500 dishes or waving down a waiter. Guests scan the code at their table and let Maître
        find exactly what suits the group.
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 13,
          marginTop: 32,
          padding: "14px 18px",
          borderRadius: 18,
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(255,255,255,.08)",
          width: "max-content",
        }}
      >
        <div style={maitreIcon(44, 13)}>
          <Spark size={21} />
        </div>
        <div>
          <div style={{ font: "600 15px " + FONT, color: "#FBF6EC" }}>Maître</div>
          <div style={{ font: "500 13px " + FONT, color: "#9A8D7B", marginTop: 1 }}>your AI menu concierge</div>
        </div>
      </div>
    </div>
  );
}

function maitreIcon(size, radius) {
  return {
    flex: "none",
    width: size,
    height: size,
    borderRadius: radius,
    background: GRAD,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 22px -6px rgba(216,90,40,.5)",
  };
}

function BackdropGlow() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 240,
        background: "radial-gradient(420px 220px at 50% -50px,rgba(232,102,43,.12),transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

function Header({ showBack, onBack, restaurant, tagline }) {
  return (
    <header
      style={{
        flex: "none",
        position: "relative",
        zIndex: 3,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "20px 20px 14px",
      }}
    >
      {showBack && (
        <button onClick={onBack} aria-label="Back" style={circleBtn}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "700 11px " + FONT, letterSpacing: ".22em", color: "#B5852F" }}>
          {restaurant.toUpperCase()}
        </div>
        <div style={{ font: "500 12px " + FONT, color: "#9C9384", marginTop: 2, letterSpacing: ".04em" }}>{tagline}</div>
      </div>
      <div
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 12px",
          borderRadius: 999,
          background: "#FFFEFB",
          border: "1px solid #ECE4D4",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1E8E4E", boxShadow: "0 0 0 3px rgba(30,142,78,.14)" }} />
        <span style={{ font: "600 12px " + FONT, color: "#1C1714" }}>Table 14</span>
      </div>
    </header>
  );
}

const circleBtn = {
  flex: "none",
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "1px solid #E6DECE",
  background: "#FFFEFB",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#1C1714",
};

function Home({ onFilter, onAsk, onPick }) {
  return (
    <div style={{ padding: "8px 20px 30px", animation: "vmUp .5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, margin: "6px 0 18px" }}>
        <div style={maitreIcon(42, 13)}>
          <Spark size={20} />
        </div>
        <div>
          <div style={{ font: "600 13px " + FONT, color: "#1C1714" }}>Maître</div>
          <div style={{ font: "500 11.5px " + FONT, color: "#A39A8A" }}>your menu concierge</div>
        </div>
      </div>
      <h1 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 38, lineHeight: 1.05, color: "#1C1714", margin: "0 0 8px", letterSpacing: "-.01em" }}>
        Good evening.
        <br />
        What are you in the mood for?
      </h1>
      <p style={{ font: "500 14px " + FONT, color: "#8C8373", lineHeight: 1.5, margin: "0 0 22px", maxWidth: "32ch" }}>
        A 540-dish menu, made simple. Tell me what you'd like and I'll do the searching.
      </p>

      <button onClick={onFilter} style={heroBtn}>
        <div style={heroGlow} />
        <div style={{ position: "relative" }}>
          <div style={pillBadge}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: GRAD }} />
            <span style={{ font: "700 10px " + FONT, letterSpacing: ".16em", color: "#F4E7D6" }}>MOST POPULAR</span>
          </div>
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 27, color: "#FCF8F1", lineHeight: 1.1 }}>
            Find dishes for us
          </div>
          <div style={{ font: "500 13px " + FONT, color: "#C7BBA8", marginTop: 6, lineHeight: 1.5, maxWidth: "30ch" }}>
            Tap a few preferences — get a tailored shortlist in seconds, each with a reason.
          </div>
          <div style={heroStart}>
            Start <Arrow />
          </div>
        </div>
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
const heroGlow = {
  position: "absolute",
  right: -40,
  top: -50,
  width: 190,
  height: 190,
  borderRadius: "50%",
  background: "radial-gradient(circle,rgba(232,102,43,.5),transparent 65%)",
};
const pillBadge = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 11px",
  borderRadius: 999,
  background: "rgba(255,255,255,.09)",
  marginBottom: 14,
  whiteSpace: "nowrap",
};
const heroStart = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  marginTop: 16,
  font: "700 13px " + FONT,
  color: "#fff",
  background: GRAD,
  padding: "11px 18px",
  borderRadius: 999,
  boxShadow: "0 10px 24px -8px rgba(216,90,40,.6)",
};

function SmallCard({ onClick, title, sub, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        cursor: "pointer",
        border: "1px solid #ECE4D4",
        background: "#FFFEFB",
        borderRadius: 20,
        padding: "18px 16px",
        boxShadow: "0 8px 20px -16px rgba(40,30,15,.5)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          background: "#F4EEE2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
          color: "#C7472A",
        }}
      >
        {children}
      </div>
      <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 20, color: "#1C1714", lineHeight: 1.1 }}>
        {title[0]}
        <br />
        {title[1]}
      </div>
      <div style={{ font: "500 11.5px " + FONT, color: "#9C9384", marginTop: 6, lineHeight: 1.45 }}>{sub}</div>
    </button>
  );
}

function Filter({ filters, setFilter, extras, toggleExtra, note, setNote, showMore, toggleMore }) {
  return (
    <div style={{ padding: "6px 20px 28px", animation: "vmUp .45s ease both" }}>
      <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 30, color: "#1C1714", margin: "6px 0 4px" }}>
        Find dishes for us
      </h2>
      <p style={{ font: "500 13px " + FONT, color: "#9C9384", margin: "0 0 20px" }}>A few taps is all it takes.</p>

      {FILTER_GROUPS.map((g) => (
        <div key={g.key} style={{ marginBottom: 18 }}>
          <div style={{ font: "700 11px " + FONT, letterSpacing: ".13em", color: "#B5852F", marginBottom: 9 }}>
            {g.title.toUpperCase()}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {g.opts.map((v) => (
              <button key={v} onClick={() => setFilter(g.key, v)} style={chipStyle(filters[g.key] === v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
          <span style={{ font: "700 11px " + FONT, letterSpacing: ".13em", color: "#B5852F" }}>ANYTHING SPECIFIC?</span>
          <span style={{ font: "500 11px " + FONT, color: "#C0B6A4" }}>optional</span>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. it's my daughter's birthday · no peanuts · not too heavy"
          rows={2}
          style={{
            width: "100%",
            resize: "none",
            border: "1px solid #E6DECE",
            background: "#FFFEFB",
            borderRadius: 16,
            padding: "13px 14px",
            font: "500 13.5px " + FONT,
            color: "#1C1714",
            outline: "none",
            lineHeight: 1.5,
          }}
        />
      </div>

      <button onClick={toggleMore} style={moreBtn}>
        <span style={{ font: "600 13px " + FONT, color: "#1C1714" }}>{showMore ? "Fewer options" : "Show more options"}</span>
        <span style={{ color: "#B5852F", transform: showMore ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .25s", display: "inline-flex" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {showMore && (
        <div style={{ animation: "vmFade .3s ease both", paddingTop: 2, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {EXTRA_CHIPS.map(([k, l]) => (
            <button key={k} onClick={() => toggleExtra(k)} style={chipStyle(!!extras[k])}>
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const moreBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  marginTop: 8,
  padding: "13px 4px",
  background: "none",
  border: "none",
  cursor: "pointer",
  borderTop: "1px solid #ECE4D4",
};

function Results({ data, view, setView, onAsk, onBack }) {
  const combosView = view !== "individual";
  const tabOn = {
    flex: 1,
    padding: 9,
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    background: "#FFFEFB",
    color: "#1C1714",
    font: "700 13px " + FONT,
    boxShadow: "0 3px 8px -3px rgba(40,30,15,.3)",
  };
  const tabOff = { flex: 1, padding: 9, borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: "#9C8A6E", font: "600 13px " + FONT };

  return (
    <div style={{ padding: "6px 20px 30px", animation: "vmUp .45s ease both" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11, margin: "4px 0 6px" }}>
        <div style={maitreIcon(34, 11)}>
          <Spark />
        </div>
        <div style={{ paddingTop: 1 }}>
          <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 25, color: "#1C1714", margin: 0, lineHeight: 1.1 }}>
            Here's what I'd order
          </h2>
          <div style={{ font: "500 12px " + FONT, color: "#A39A8A", marginTop: 3 }}>{data.summary}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginTop: 14, padding: 4, background: "#EFE7D8", borderRadius: 14 }}>
        <button onClick={() => setView("combos")} style={combosView ? tabOn : tabOff}>
          Combos
        </button>
        <button onClick={() => setView("individual")} style={combosView ? tabOff : tabOn}>
          Individual
        </button>
      </div>

      {combosView
        ? data.combos.map((c, i) => <ComboCard key={i} c={c} num={i + 1} />)
        : data.individual.map((d, i) => <IndividualCard key={i} d={d} onAsk={() => onAsk(d)} />)}

      {combosView && data.combos.length === 0 && <Empty />}
      {!combosView && data.individual.length === 0 && <Empty />}

      <button onClick={onBack} style={adjustBtn}>
        Adjust my preferences
      </button>
    </div>
  );
}

function Empty() {
  return (
    <div style={{ textAlign: "center", padding: "28px 10px", color: "#A39A8A", font: "500 13px " + FONT }}>
      No matches for these filters. Try widening your budget or preferences.
    </div>
  );
}

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

function ComboCard({ c, num }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={comboNum}>{num}</span>
        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 21, color: "#1C1714", lineHeight: 1 }}>{c.title}</span>
      </div>
      <div style={{ ...reasonBox, marginTop: 11, padding: "9px 11px", borderRadius: 12 }}>
        <Spark size={13} fill="#E8662B" />
        <span style={{ font: "500 12px " + FONT, color: "#7A5A3A", lineHeight: 1.45 }}>{c.why}</span>
      </div>
      {c.groups.map((g, gi) => (
        <div key={gi} style={{ marginTop: 11 }}>
          <div style={{ font: "700 9.5px " + FONT, letterSpacing: ".12em", color: "#B0A693", textTransform: "uppercase", marginBottom: 4 }}>
            {g.course}
          </div>
          {g.items.map((it, ii) => (
            <div key={ii} style={{ display: "flex", alignItems: "center", gap: 9, padding: "3px 0" }}>
              <DietMark diet={it.diet} size={12} />
              <span style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontWeight: 600, fontSize: 16.5, color: "#1C1714", lineHeight: 1.25 }}>
                {it.name}
              </span>
              <span style={{ flex: "none", font: "500 11.5px " + FONT, color: "#A39A8A" }}>{priceLabel(it)}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #F0E8DA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ font: "600 11px " + FONT, letterSpacing: ".08em", color: "#B0A693", textTransform: "uppercase" }}>Set total</span>
        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 18, color: "#1C1714" }}>₹{c.total}</span>
      </div>
    </div>
  );
}

const cardBox = {
  background: "#FFFEFB",
  border: "1px solid #ECE4D4",
  borderRadius: 20,
  padding: 16,
  marginTop: 13,
  boxShadow: "0 10px 26px -20px rgba(40,30,15,.6)",
  animation: "vmPop .4s ease both",
};
const comboNum = {
  flex: "none",
  width: 24,
  height: 24,
  borderRadius: 8,
  background: GRAD,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  font: "700 12px " + FONT,
};

function IndividualCard({ d, onAsk }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <DietMark diet={d.diet} />
            <span style={{ font: "600 10px " + FONT, letterSpacing: ".1em", color: "#B0A693", textTransform: "uppercase" }}>
              {d.cuisine} · {d.course}
            </span>
          </div>
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 21, color: "#1C1714", lineHeight: 1.15, marginTop: 5 }}>
            {d.name}
          </div>
        </div>
        <div style={{ flex: "none", textAlign: "right" }}>
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 19, color: "#1C1714" }}>{priceLabel(d)}</div>
          <div style={{ font: "500 10.5px " + FONT, color: "#A39A8A", marginTop: 1 }}>{serveLabel(d)}</div>
        </div>
      </div>
      <div style={{ ...reasonBox, marginTop: 12 }}>
        <Spark size={14} fill="#E8662B" />
        <span style={{ font: "500 12.5px " + FONT, color: "#7A5A3A", lineHeight: 1.45 }}>{d.why}</span>
      </div>
      <button onClick={onAsk} style={askBtn}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M21 11.5a8.4 8.4 0 01-12 7.6L3 21l1.9-6A8.5 8.5 0 1121 11.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
        Ask about this dish
      </button>
    </div>
  );
}

const askBtn = {
  marginTop: 11,
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  padding: 10,
  borderRadius: 12,
  border: "1px solid #E6DECE",
  background: "#FFFEFB",
  cursor: "pointer",
  font: "600 12.5px " + FONT,
  color: "#1C1714",
};

function Menu({ mode, sections, picks, onTapAsk, onTapPick }) {
  const ask = mode === "ask";
  return (
    <div style={{ padding: "6px 20px 30px", animation: "vmUp .45s ease both" }}>
      <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 30, color: "#1C1714", margin: "6px 0 4px" }}>
        {ask ? "Browse the menu" : "Pick your dishes"}
      </h2>
      <p style={{ font: "500 13px " + FONT, color: "#9C9384", margin: "0 0 18px" }}>
        {ask ? "Tap any dish to ask Maître about it." : "Select a few, then I'll balance the order."}
      </p>
      {sections.map((sec) => (
        <div key={sec.title} style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 18, color: "#B5852F" }}>{sec.title}</span>
            <span style={{ flex: 1, height: 1, background: "#E6DECE" }} />
          </div>
          {sec.items.map((d) => {
            const picked = !!picks[d.id];
            return (
              <button
                key={d.id}
                onClick={() => (ask ? onTapAsk(d) : onTapPick(d.id))}
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
                  <span style={{ display: "block", font: "500 11.5px " + FONT, color: "#9C9384", marginTop: 3, lineHeight: 1.4 }}>
                    {d.desc}
                  </span>
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
          })}
        </div>
      ))}
    </div>
  );
}

function Refine({ picked, chat, typing }) {
  return (
    <>
      <div style={{ padding: "6px 20px 6px", animation: "vmUp .45s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, margin: "4px 0 12px" }}>
          <div style={maitreIcon(34, 11)}>
            <Spark />
          </div>
          <div>
            <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 23, color: "#1C1714", margin: 0, lineHeight: 1.05 }}>
              Refine my picks
            </h2>
            <div style={{ font: "500 11.5px " + FONT, color: "#A39A8A", marginTop: 1 }}>Maître is looking at your selection</div>
          </div>
        </div>
        <div style={{ background: "#FBF3EA", border: "1px solid #F3E6D4", borderRadius: 16, padding: "12px 13px" }}>
          <div style={{ font: "700 9.5px " + FONT, letterSpacing: ".13em", color: "#B5852F", marginBottom: 8 }}>
            YOUR PICKS · {picked.length}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {picked.map((p) => (
              <span
                key={p.id}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "#FFFEFB", border: "1px solid #EFE2D2" }}
              >
                <DietMark diet={p.diet} size={10} />
                <span style={{ font: "600 12px " + FONT, color: "#3A322A" }}>{p.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: "10px 20px 18px" }}>
        {chat.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
        {typing && <Typing />}
      </div>
    </>
  );
}

function Dish({ dish, chat, typing }) {
  return (
    <>
      <div style={{ padding: "6px 20px 16px", animation: "vmUp .4s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DietMark diet={dish.diet} />
          <span style={{ font: "600 10px " + FONT, letterSpacing: ".1em", color: "#B0A693", textTransform: "uppercase" }}>
            {dish.cuisine} · {dish.course}
          </span>
        </div>
        <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 28, color: "#1C1714", margin: "6px 0 4px", lineHeight: 1.1 }}>
          {dish.name}
        </h2>
        <div style={{ display: "flex", gap: 14, font: "600 12px " + FONT, color: "#7A715F", marginBottom: 4 }}>
          <span>{priceLabel(dish)}</span>
          <span style={{ color: "#D8CDB8" }}>·</span>
          <span>{serveLabel(dish)}</span>
          <span style={{ color: "#D8CDB8" }}>·</span>
          <span>{dish.spice ? dish.spice + " heat" : "no chilli"}</span>
        </div>
      </div>
      <div style={{ padding: "8px 20px 20px" }}>
        {chat.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
        {typing && <Typing />}
      </div>
    </>
  );
}

function Bubble({ m }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: m.role === "user" ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}
    >
      <div style={bubble(m.role)}>{m.text}</div>
    </div>
  );
}

function Footer({ children }) {
  return (
    <div
      style={{
        flex: "none",
        position: "relative",
        zIndex: 4,
        padding: "14px 20px 18px",
        background: "linear-gradient(rgba(246,241,232,0),#F6F1E8 38%)",
      }}
    >
      {children}
    </div>
  );
}

const ctaBase = {
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
const ctaPrimary = { ...ctaBase, background: GRAD, color: "#fff", boxShadow: "0 14px 30px -10px rgba(216,90,40,.6)" };

function ChatBar({ suggested, onChip, value, onChange, onSend, placeholder }) {
  return (
    <div
      style={{
        flex: "none",
        position: "relative",
        zIndex: 4,
        padding: "10px 16px 16px",
        background: "#F6F1E8",
        borderTop: "1px solid #ECE4D4",
      }}
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
          style={{
            flex: 1,
            border: "1px solid #E6DECE",
            background: "#FFFEFB",
            borderRadius: 14,
            padding: "13px 14px",
            font: "500 13.5px " + FONT,
            color: "#1C1714",
            outline: "none",
          }}
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

function Busy({ text }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 6,
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
