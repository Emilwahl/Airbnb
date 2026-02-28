import Link from "next/link";
import { redirect } from "next/navigation";
import { readSessionCookie, validateSessionToken } from "@/lib/session";
import ThemeToggle from "./ThemeToggle";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = readSessionCookie();
  if (!validateSessionToken(token)) {
    redirect("/login");
  }

  return (
    <main className="container">
      <div className="nav">
        <div className="brand">
          <span className="badge">Rental Tax Tracker</span>
          <h1 className="page-title">Rental overview</h1>
        </div>
        <div className="nav-links">
          <ThemeToggle />
          <Link className="button ghost" href="/">
            Dashboard
          </Link>
          <Link className="button ghost" href="/settings">
            Tax Settings
          </Link>
        </div>
      </div>
      {children}
    </main>
  );
}
