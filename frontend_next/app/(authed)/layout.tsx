import RequireAuth from "@/app/components/RequireAuth";

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}