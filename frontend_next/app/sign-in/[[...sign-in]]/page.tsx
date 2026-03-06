import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#f59e0b",
            colorBackground: "#ffffff",
            colorText: "#18181b",
            colorInputBackground: "#ffffff",
            colorInputText: "#18181b",
            borderRadius: "0.75rem",
          },
          elements: {
            rootBox: "mx-auto",
            card: "shadow-none border border-zinc-200",
            formButtonPrimary:
              "bg-amber-500 hover:bg-amber-400 text-black font-semibold",
            footerActionLink: "text-amber-600 hover:text-amber-500",
          },
        }}
      />
    </div>
  );
}
