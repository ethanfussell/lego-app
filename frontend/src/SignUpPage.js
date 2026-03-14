// frontend/src/SignUpPage.js
// Renders Clerk's SignUp component. Used on /signup route.
import React from "react";
import { SignUp } from "@clerk/clerk-react";

export default function SignUpPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "2rem" }}>
      <SignUp
        routing="path"
        path="/signup"
        signInUrl="/login"
        afterSignUpUrl="/collection"
      />
    </div>
  );
}
