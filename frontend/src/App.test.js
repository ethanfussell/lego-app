// src/App.test.js
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth";

test("renders app without crashing", () => {
  render(
    <AuthProvider>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </AuthProvider>
  );

  expect(screen.getByRole("heading", { name: /track your lego world/i })).toBeInTheDocument();
});


const warn = console.warn;

beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation((...args) => {
    const msg = String(args[0] ?? "");

    if (msg.includes("React Router Future Flag Warning")) return;

    warn(...args);
  });
});