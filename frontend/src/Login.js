// frontend/src/Login.js
// Renders Clerk's SignIn component. Used on /login route.
import React from "react";
import { SignIn } from "@clerk/clerk-react";

export default function Login() {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "2rem" }}>
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/signup"
        afterSignInUrl="/collection"
      />
    </div>
  );
}
