import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/almendra/700.css";
import "@fontsource/josefin-sans/700.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/metamorphous/400.css";
import "@fontsource/orbitron/700.css";
import "@fontsource/special-elite/400.css";
import "@fontsource/creepster/400.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/uncial-antiqua/400.css";
import "./styles.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
