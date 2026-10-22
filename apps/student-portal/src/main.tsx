import { AuthBoundary, KKProvider } from "@kk/shared";
import { createRoot } from "react-dom/client";
import App from "./App";
createRoot(document.getElementById("root")!).render(
  <KKProvider role="student">
    <AuthBoundary title="Your student identity">
      <App />
    </AuthBoundary>
  </KKProvider>,
);
