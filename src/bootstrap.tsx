import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./i18n";
import { AppV2 } from "./AppV2";
import { AuthProvider } from "./contexts/AuthContext";
import { TaxonomyProvider } from "./contexts/TaxonomyContext";

export function renderApplication(rootElement: HTMLElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <TaxonomyProvider>
            <AppV2 />
          </TaxonomyProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}
