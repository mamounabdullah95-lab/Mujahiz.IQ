import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./i18n";
import "./index.css";
import { AppV2 } from "./AppV2";
import { AuthProvider } from "./contexts/AuthContext";
import { TaxonomyProvider } from "./contexts/TaxonomyContext";

const locale = localStorage.getItem("mujahiz-iq-locale") || "en";
document.documentElement.lang = locale;
document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <TaxonomyProvider>
        <AuthProvider>
          <AppV2 />
        </AuthProvider>
      </TaxonomyProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
