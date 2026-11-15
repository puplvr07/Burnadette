import { useEffect, useRef, useState } from "react";
import Home from "./components/Home";
import CalendarPage from "./components/CalendarPage";
import About from "./components/About";
import ThemeToggle from "./components/ThemeToggle";

type ExploreView = "map" | "heatmap" | "calendar";
type Page = "home" | ExploreView | "about";
const isExplore = (page: Page): page is ExploreView => page === "map" || page === "heatmap" || page === "calendar";
const EXPLORE_VIEWS: [ExploreView, string][] = [["map", "Map"], ["heatmap", "Heatmap"], ["calendar", "Calendar"]];

const fromHash = (): Page => {
  const h = window.location.hash.replace("#", "");
  return h === "home" || h === "about" || EXPLORE_VIEWS.some(([p]) => p === h) ? (h as Page) : "home";
};

export default function App() {
  const [page, setPage] = useState<Page>(fromHash);
  const [navVisible, setNavVisible] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const revealNav = () => {
    setNavVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!nav.current?.contains(document.activeElement)) setNavVisible(false);
    }, 3000);
  };
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  const [exploreView, setExploreView] = useState<ExploreView>(() => {
    const initial = fromHash();
    return isExplore(initial) ? initial : "map";
  });
  const [exploreVisited, setExploreVisited] = useState(() => isExplore(fromHash()));

  useEffect(() => {
    const onHash = () => {
      const next = fromHash();
      setPage(next);
      setNavVisible(false);
      if (isExplore(next)) { setExploreView(next); setExploreVisited(true); }
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className={`shell${page === "map" ? " map-shell" : ""}${navVisible ? " navigation-visible" : ""}`}>
      {page === "map" && <button className="map-nav-handle" type="button" aria-controls="main-navigation" aria-expanded={navVisible}
        onPointerEnter={revealNav} onFocus={revealNav} onClick={revealNav}>
        <span aria-hidden="true">⌃</span> Navigation
      </button>}
      <header ref={nav} id="main-navigation" className="site-header"
        onPointerEnter={() => { clearTimeout(hideTimer.current); setNavVisible(true); }}
        onPointerLeave={() => { if (!nav.current?.contains(document.activeElement)) setNavVisible(false); }}
        onFocusCapture={() => { clearTimeout(hideTimer.current); setNavVisible(true); }}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setNavVisible(false); }}>

        <div className="primary-header-row">
          <a className="site-title" href="#home">Burnadette</a>
          <div className="header-actions">
          <nav className="nav-links" aria-label="Main navigation">
            <a href="#home" aria-current={page === "home" ? "page" : undefined}>Home</a>
            <a href={`#${exploreView}`} aria-current={isExplore(page) ? "page" : undefined}>Explore</a>
            <a href="#about" aria-current={page === "about" ? "page" : undefined}>About</a>
          </nav>
          <ThemeToggle />
          </div>
        </div>
        {isExplore(page) && <div className="explore-section-nav">
          <span className="explore-section-label">EXPLORE</span>
          <nav className="nav-links explore-view-links" aria-label="Explore views">
            {EXPLORE_VIEWS.map(([route, label]) => (
              <a key={route} href={`#${route}`} aria-current={page === route ? "page" : undefined}>{label}</a>
            ))}
          </nav>
        </div>}
      </header>
      <main>
        {page === "home" && <Home />}
        {exploreVisited && <CalendarPage view={exploreView} hidden={!isExplore(page)} />}
        {page === "about" && <About />}
      </main>
      <footer className="site-footer"><p>Burnadette | NASA fire data</p></footer>
    </div>
  );
}
