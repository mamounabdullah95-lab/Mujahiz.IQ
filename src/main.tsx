import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { FirebaseConfigurationErrorScreen } from "./components/FirebaseConfigurationErrorScreen";
import { firebaseRuntime } from "./config/firebase";

const locale = localStorage.getItem("mujahiz-iq-locale") || "en";
document.documentElement.lang = locale;
document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Application root element is missing.");

if (firebaseRuntime.target === "configuration_error") {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <FirebaseConfigurationErrorScreen />
    </React.StrictMode>,
  );
} else {
  void import("./bootstrap").then(({ renderApplication }) => {
    renderApplication(rootElement);
  });
}
