import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import "./team-integration.css";
import "./glass-layout.css";
import "./theme-navigation.css";
import "./mobile-layout.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
