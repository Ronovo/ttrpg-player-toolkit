import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/700.css";
import "./styles.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
