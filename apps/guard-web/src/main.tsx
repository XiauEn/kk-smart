import { AuthBoundary, KKProvider } from "@kk/shared";
import { createRoot } from "react-dom/client";
import App from "./App";
createRoot(document.getElementById("root")!).render(
  <KKProvider role="guard">
    <AuthBoundary title="Guard operations">
      <App />
    </AuthBoundary>
  </KKProvider>,
);
