import { AuthBoundary, KKProvider } from "@kk/shared";
import { createRoot } from "react-dom/client";
import App from "./App";
createRoot(document.getElementById("root")!).render(
  <KKProvider role="terminal">
    <AuthBoundary title="Authorised gate terminal">
      <App />
    </AuthBoundary>
  </KKProvider>,
);
