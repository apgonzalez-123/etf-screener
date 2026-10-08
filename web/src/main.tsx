import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { CommandK } from "./components/CommandK";
import { Freshness } from "./components/bits";
import { AppProvider, useApp } from "./lib/app";
import { useUniverses } from "./lib/data";
import { Compare } from "./pages/Compare";
import { Data } from "./pages/Data";
import { LookThrough } from "./pages/LookThrough";
import { Movers } from "./pages/Movers";
import { Screener } from "./pages/Screener";
import { TearSheet } from "./pages/TearSheet";
import { Watchlists } from "./pages/Watchlists";
import "./styles.css";

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

function Shell() {
  const { mode, setMode, theme, setTheme, setPaletteOpen } = useApp();
  const u = useUniverses();
  return (
    <div className="shell">
      <aside className="rail">
        <NavLink to="/" className="brand" aria-label="Safra Equities and ETF Screener, home">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <b>Safra</b>
            <span>Equities &amp; ETFs</span>
          </span>
        </NavLink>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end><Icon d="M4 6h16M7 12h10M10 18h4" />Screener</NavLink>
          <NavLink to="/look-through"><Icon d="M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4" />Look-through</NavLink>
          <NavLink to="/movers"><Icon d="M3 17l6-6 4 4 8-8M15 7h6v6" />Movers</NavLink>
          <NavLink to="/watchlists"><Icon d="M6 3h12v18l-6-4-6 4z" />Watchlists</NavLink>
          <NavLink to="/data"><Icon d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v.01M11 12h1v5h1" />Data</NavLink>
        </nav>
        <div className="rail-foot">
          <span>Prototype for internal review</span>
          <button className="btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light theme" : "Dark theme"}</button>
        </div>
      </aside>
      <header className="top">
        <button className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Search, Command K">
          <Icon d="M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-3.5-3.5" />
          <span>Search tickers, ETFs, “who holds NVDA”</span>
          <kbd>⌘K</kbd>
        </button>
        <div className="top-right">
          <span className="hide-sm"><Freshness iso={u.data?.stocks.as_of} /></span>
          <div className="seg" role="group" aria-label="View mode">
            <button aria-pressed={mode === "client"} onClick={() => setMode("client")}>Client</button>
            <button aria-pressed={mode === "desk"} onClick={() => setMode("desk")}>Desk</button>
          </div>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Screener />} />
          <Route path="/look-through" element={<LookThrough />} />
          <Route path="/movers" element={<Movers />} />
          <Route path="/watchlists" element={<Watchlists />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/data" element={<Data />} />
          <Route path="/s/:ticker" element={<TearSheet />} />
        </Routes>
      </main>
      <CommandK />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AppProvider>
  </React.StrictMode>,
);
