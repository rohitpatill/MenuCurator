// All diner-app state + actions in one hook, so App.jsx stays a thin router.
import { useEffect, useState } from "react";
import { api } from "./api";
import { DEFAULT_FILTERS, partySize } from "./constants.js";

const NETWORK_ERR = "Couldn't reach the kitchen — is the backend running?";

export function useMenuApp() {
  const [screen, setScreen] = useState("home");
  const [menuMode, setMenuMode] = useState("ask");
  const [busy, setBusy] = useState(null);
  const [busyText, setBusyText] = useState("");

  const [menu, setMenu] = useState({ restaurant: "Marigold", tagline: "Flavours, curated", dishes: [] });

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [partyCustom, setPartyCustom] = useState(4);
  const [extras, setExtras] = useState({});
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);

  const [results, setResults] = useState({ individual: [], combos: [], summary: "" });
  const [resultView, setResultView] = useState("combos");

  const [picks, setPicks] = useState({});
  const [refineChat, setRefineChat] = useState([]);
  const [refineTyping, setRefineTyping] = useState(false);
  const [refineInput, setRefineInput] = useState("");

  const [dish, setDish] = useState(null);
  const [dishReturn, setDishReturn] = useState("home");
  const [chat, setChat] = useState([]);
  const [dishTyping, setDishTyping] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    api.getMenu().then(setMenu).catch(() => {});
  }, []);

  const pickCount = Object.keys(picks).filter((k) => picks[k]).length;
  const party = partySize(filters.party, partyCustom);

  function back() {
    if (screen === "dish") setScreen(dishReturn || "home");
    else if (screen === "results") setScreen("filter");
    else if (screen === "refine") setScreen("menu");
    else setScreen("home");
  }

  async function runFilter() {
    setBusy(true);
    setBusyText("Reading the menu for you…");
    try {
      const r = await api.recommend({ filters, extras, note, party_size: party });
      const summary = [filters.veg, filters.course, filters.cuisine, "party of " + party].join(" · ");
      setResults({ individual: r.individual || [], combos: r.combos || [], summary });
      setResultView("combos");
      setScreen("results");
    } catch {
      setResults({ individual: [], combos: [], summary: NETWORK_ERR });
      setScreen("results");
    }
    setBusy(null);
  }

  function openMenu(mode) {
    setMenuMode(mode);
    setPicks({});
    setScreen("menu");
  }
  const togglePick = (id) => setPicks((p) => ({ ...p, [id]: !p[id] }));

  async function runRefine() {
    if (pickCount === 0) return;
    setBusy(true);
    setBusyText("Looking at your selection…");
    const picked = menu.dishes.filter((d) => picks[d.id]);
    try {
      const r = await api.refine({ picked_ids: picked.map((d) => d.id), question: "", party_size: party });
      setRefineChat([{ role: "ai", text: r.answer }]);
    } catch {
      setRefineChat([{ role: "ai", text: NETWORK_ERR }]);
    }
    setRefineInput("");
    setRefineTyping(false);
    setBusy(null);
    setScreen("refine");
  }
  async function askRefine(text) {
    if (!text) return;
    const picked = menu.dishes.filter((d) => picks[d.id]);
    const history = refineChat; // thread so far (before this question) for context
    setRefineChat((c) => [...c, { role: "user", text }]);
    setRefineTyping(true);
    try {
      const r = await api.refine({ picked_ids: picked.map((d) => d.id), question: text, party_size: party, history });
      setRefineChat((c) => [...c, { role: "ai", text: r.answer }]);
    } catch {
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

  function openDish(d, from) {
    setDish(d);
    setDishReturn(from);
    setInput("");
    setChat([{ role: "ai", text: `Hi! Ask me anything about the ${d.name} — pieces, spice, what's in it, whether it suits your group.` }]);
    setScreen("dish");
  }
  async function ask(text) {
    if (!dish || !text) return;
    const history = chat; // thread so far (before this question) for context
    setChat((c) => [...c, { role: "user", text }]);
    setDishTyping(true);
    try {
      const r = await api.askDish(dish.id, text, history);
      setChat((c) => [...c, { role: "ai", text: r.answer }]);
    } catch {
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

  return {
    screen, setScreen, menuMode, busy, busyText, menu,
    filters, setFilters, partyCustom, setPartyCustom, extras, setExtras, note, setNote, showMore, setShowMore,
    results, resultView, setResultView,
    picks, togglePick, pickCount, refineChat, refineTyping, refineInput, setRefineInput,
    dish, chat, dishTyping, input, setInput,
    party, back, runFilter, openMenu, runRefine, askRefine, sendRefine,
    openDish, ask, sendInput,
  };
}
