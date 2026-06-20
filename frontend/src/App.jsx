import React from "react";
import { useMenuApp } from "./useMenuApp.js";
import { GRAD, Spark } from "./ui.jsx";
import { SUGGESTED_DISH_QS, SUGGESTED_REFINE_QS } from "./constants.js";

import Header from "./components/Header.jsx";
import Footer, { ctaBase } from "./components/Footer.jsx";
import ChatBar from "./components/ChatBar.jsx";
import Busy from "./components/Busy.jsx";

import Home from "./screens/Home.jsx";
import Filter from "./screens/Filter.jsx";
import Results from "./screens/Results.jsx";
import Menu from "./screens/Menu.jsx";
import Refine from "./screens/Refine.jsx";
import Dish from "./screens/Dish.jsx";

const ctaPrimary = { ...ctaBase, background: GRAD, color: "#fff", boxShadow: "0 14px 30px -10px rgba(216,90,40,.6)" };

export default function App() {
  const a = useMenuApp();
  const { screen, menu } = a;

  return (
    <div className="app">
      <div className="app__glow" />
      <Header showBack={screen !== "home"} onBack={a.back} restaurant={menu.restaurant} tagline={menu.tagline} />

      <div className="app__body vm-scroll">
        {screen === "home" && <Home onFilter={() => a.setScreen("filter")} onAsk={() => a.openMenu("ask")} onPick={() => a.openMenu("pick")} />}
        {screen === "filter" && (
          <Filter
            filters={a.filters}
            setFilter={(k, v) => a.setFilters((f) => ({ ...f, [k]: v }))}
            partyCustom={a.partyCustom}
            setPartyCustom={a.setPartyCustom}
            extras={a.extras}
            toggleExtra={(k) => a.setExtras((e) => ({ ...e, [k]: !e[k] }))}
            note={a.note}
            setNote={a.setNote}
            showMore={a.showMore}
            toggleMore={() => a.setShowMore((s) => !s)}
          />
        )}
        {screen === "results" && (
          <Results data={a.results} view={a.resultView} setView={a.setResultView} onAsk={(d) => a.openDish(d, "results")} onBack={() => a.setScreen("filter")} />
        )}
        {screen === "menu" && (
          <Menu mode={a.menuMode} dishes={menu.dishes} picks={a.picks} pickCount={a.pickCount} onTapAsk={(d) => a.openDish(d, "menu")} onTapPick={a.togglePick} />
        )}
        {screen === "refine" && <Refine picked={menu.dishes.filter((d) => a.picks[d.id])} chat={a.refineChat} typing={a.refineTyping} />}
        {screen === "dish" && a.dish && <Dish dish={a.dish} chat={a.chat} typing={a.dishTyping} />}
      </div>

      {screen === "filter" && (
        <Footer>
          <button onClick={a.runFilter} style={ctaPrimary}>
            <Spark /> Find my picks
          </button>
        </Footer>
      )}
      {screen === "menu" && a.menuMode === "pick" && (
        <Footer>
          <button
            onClick={a.runRefine}
            style={{
              ...ctaBase,
              background: a.pickCount > 0 ? GRAD : "#EDE5D6",
              color: a.pickCount > 0 ? "#fff" : "#A99B82",
              boxShadow: a.pickCount > 0 ? "0 14px 30px -10px rgba(216,90,40,.6)" : "none",
            }}
          >
            {a.pickCount > 0 ? `Refine my ${a.pickCount} pick${a.pickCount > 1 ? "s" : ""}` : "Select dishes to refine"}
          </button>
        </Footer>
      )}
      {screen === "dish" && (
        <ChatBar suggested={SUGGESTED_DISH_QS} onChip={(q) => a.ask(q)} value={a.input} onChange={a.setInput} onSend={a.sendInput} placeholder="Ask anything about this dish…" />
      )}
      {screen === "refine" && (
        <ChatBar suggested={SUGGESTED_REFINE_QS} onChip={(q) => a.askRefine(q)} value={a.refineInput} onChange={a.setRefineInput} onSend={a.sendRefine} placeholder="Ask about your picks…" />
      )}

      {a.busy && <Busy text={a.busyText} />}
    </div>
  );
}
