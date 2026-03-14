// frontend/src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import { ToastProvider } from "./Toast";
import { AuthProvider } from "./auth";
import "./index.css";

const clerkPubKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  console.warn(
    "REACT_APP_CLERK_PUBLISHABLE_KEY is not set. Auth will not work."
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ClerkProvider publishableKey={clerkPubKey || ""}>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </ClerkProvider>
    </BrowserRouter>
  </React.StrictMode>
);
