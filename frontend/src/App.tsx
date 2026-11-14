import { useEffect, useState } from "react";
import Home from "./components/Home";
import CalendarPage from "./components/CalendarPage";
import About from "./components/About";

type Page = "home" | "calendar" | "about";
const PAGES: [Page, string][] = [["home", "Home"], ["calendar", "Calendar"], ["about", "About us"]];

const fromHash = (): Page => {
  const h = window.location.hash.replace("#", "");
  return PAGES.some(([p]) => p === h) ? (h as Page) : "home";
};

export default function App() {
  const [page, setPage] = useState<Page>(fromHash);

  useEffect(() => {
    const onHash = () => { setPage(fromHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="shell">
      <nav className="site-header">
        <a className="site-title" href="#home">Burnadette</a>
        <div className="nav-links">
          {PAGES.map(([p, label]) => (
            <a key={p} href={`#${p}`} aria-current={page === p ? "page" : undefined}>{label}</a>
          ))}
        </div>
      </nav>
      <main>
        {page === "home" && <Home />}
        {page === "calendar" && <CalendarPage />}
        {page === "about" && <About />}
      </main>
      <footer className="site-footer"><p>Burnadette | NASA fire data</p></footer>
    </div>
  );
}
