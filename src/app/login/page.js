"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowser();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // Redirect to dashboard on success
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-wrapper" style={{ maxWidth: 420, paddingTop: 60 }}>
      <div
        className="card"
        style={{
          padding: "40px 32px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "1.6rem",
            color: "var(--color-primary)",
            marginBottom: 4,
          }}
        >
          Foster &amp; Keys
        </h1>
        <p
          className="text-muted"
          style={{ marginBottom: 28, fontSize: ".92rem" }}
        >
          Sign in to access your dashboard
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16, textAlign: "left" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: 6,
                fontSize: ".88rem",
                fontWeight: 600,
                color: "var(--color-text)",
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="lorenzo@fosterandkeys.com"
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                fontSize: ".95rem",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 24, textAlign: "left" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: 6,
                fontSize: ".88rem",
                fontWeight: 600,
                color: "var(--color-text)",
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                fontSize: ".95rem",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                marginBottom: 16,
                borderRadius: "var(--radius)",
                background: "#fee2e2",
                color: "#991b1b",
                fontSize: ".88rem",
                textAlign: "left",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", padding: "12px 0", fontSize: "1rem" }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
