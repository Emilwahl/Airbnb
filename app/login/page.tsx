import Link from "next/link";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const hasError = searchParams?.error === "1";

  return (
    <main className="container">
      <div className="nav">
        <div className="brand">
          <span className="badge">Rental Tax Tracker</span>
          <h1>Welcome back</h1>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Log in</h2>
          <p>
            Enter the shared password to access your rental dashboard. No data is
            exposed until you log in.
          </p>
          {hasError ? (
            <p className="notice">Password incorrect. Try again.</p>
          ) : null}
          <form method="post" action="/api/login" className="form-grid">
            <label className="form-field">
              <span className="label">Shared password</span>
              <input
                className="input"
                type="password"
                name="password"
                placeholder="••••••••"
                required
              />
            </label>
            <button className="button" type="submit">
              Unlock dashboard
            </button>
          </form>
        </div>

        <div className="card">
          <h2>What you can do</h2>
          <ul>
            <li>Track bookings and net revenue for two apartments.</li>
            <li>See annual tax estimates with the bundfradrag method.</li>
            <li>Review monthly seasonality and past-year comparisons.</li>
          </ul>
          <p>
            Powered by Supabase. You can migrate to full user accounts later if
            needed.
          </p>
          <Link className="button secondary" href="/">
            Preview (requires login)
          </Link>
        </div>
      </div>
    </main>
  );
}
