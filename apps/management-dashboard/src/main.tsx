import { AuthBoundary, KKProvider } from "@kk/shared";
import { createRoot } from "react-dom/client";
import App from "./App";
createRoot(document.getElementById("root")!).render(
  <KKProvider role="management">
    <AuthBoundary title="Residential management">
      <App />
    </AuthBoundary>
  </KKProvider>,
);
