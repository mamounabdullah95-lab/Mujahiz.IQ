import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { FirebaseConfigurationErrorScreen } from "./components/FirebaseConfigurationErrorScreen";
import { redirectLegacyProductionOrigin } from "./config/canonicalOrigin";
import siteSettings from "../site.config.json";

const redirected = redirectLegacyProductionOrigin(window.location, siteSettings.primaryUrl);

if (!redirected) {
  const locale = localStorage.getItem("mujahiz-iq-locale") || "en";
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";

  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Application root element is missing.");

  void import("./config/firebase").then(({ firebaseRuntime }) => {
    if (firebaseRuntime.target === "configuration_error") {
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <FirebaseConfigurationErrorScreen />
        </React.StrictMode>,
      );
      return;
    }

    void import("./bootstrap").then(({ renderApplication }) => {
      renderApplication(rootElement);
    });
  });
}
