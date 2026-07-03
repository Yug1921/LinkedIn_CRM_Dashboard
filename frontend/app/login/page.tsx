"use client"

/**
 * app/login/page.tsx
 *
 * Split-panel login page.
 * Left: branding panel (hidden on mobile).
 * Right: email + password form.
 * Uses GoTeeOff design tokens (gt-bg, gt-surface, gt-accent, etc.)
 */

import { useState, useEffect, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"

export default function LoginPage() {
  const { state, login } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Already authenticated → go straight to dashboard
  useEffect(() => {
    if (state.status === "authenticated") router.replace("/")
  }, [state.status, router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email.trim(), password)
      router.replace("/")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  // Avoid flash while session check is in progress
  if (state.status === "loading" || state.status === "authenticated") return null

  return (
    <>
      <style>{css}</style>
      <div className="gt-login-root">

        {/* ── Left brand panel ─────────────────────────────── */}
        <div className="gt-brand">
          <div className="gt-brand-inner">
            <div className="gt-logo">
              <Image src="/GoteeOff_logo.png" alt="GoTeeOff" width={36} height={36} className="rounded-lg" style={{ objectFit: "contain" }} />
              <div className="gt-logo-text">
                <span className="gt-logo-name">GoTeeOff</span>
                <span className="gt-logo-sub">CRM</span>
              </div>
            </div>

            <div className="gt-brand-copy">
              <h2>AI-powered lead intelligence for your team.</h2>
              <p>
                Score, track, and reach your best leads — all in one workspace
                built for speed and precision.
              </p>
            </div>

            <div className="gt-stats">
              <div className="gt-stat">
                <span className="gt-stat-num">94%</span>
                <span className="gt-stat-label">outreach open rate</span>
              </div>
              <div className="gt-stat-sep" />
              <div className="gt-stat">
                <span className="gt-stat-num">3×</span>
                <span className="gt-stat-label">faster qualification</span>
              </div>
            </div>
          </div>
          {/* dot grid texture */}
          <div className="gt-brand-grid" aria-hidden="true" />
        </div>

        {/* ── Right form panel ──────────────────────────────── */}
        <div className="gt-form-panel">
          <div className="gt-card">
            <div className="gt-card-head">
              <h1>Welcome back</h1>
              <p>Sign in to your GoTeeOff workspace</p>
            </div>

            <form onSubmit={handleSubmit} className="gt-form" noValidate>
              <div className="gt-field">
                <label htmlFor="gt-email">Email</label>
                <input
                  id="gt-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="gt-field">
                <label htmlFor="gt-password">Password</label>
                <input
                  id="gt-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="gt-error" role="alert">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle cx="7.5" cy="7.5" r="6.5" stroke="#f87171" strokeWidth="1.5" />
                    <path d="M7.5 4.5v3M7.5 10h.01" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" className="gt-btn" disabled={loading}>
                {loading ? <span className="gt-spinner" /> : "Sign in"}
              </button>
            </form>

            <p className="gt-hint">
              No account?{" "}
              <span>Ask your team admin to send you an invite link.</span>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

const css = `
  .gt-login-root {
    display: flex;
    min-height: 100vh;
    background: #09090f;
    font-family: var(--font-sans, Inter, sans-serif);
  }

  /* ── Brand panel ─────────────────────── */
  .gt-brand {
    display: none;
    position: relative;
    flex: 1;
    overflow: hidden;
    background: #111118;
    border-right: 1px solid #252530;
  }
  @media (min-width: 1024px) { .gt-brand { display: flex; } }

  .gt-brand-inner {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 48px;
    padding: 64px 56px;
  }

  .gt-logo { display: flex; align-items: center; gap: 12px; }

  .gt-logo-mark {
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: 8px;
    background: rgba(0,229,160,0.12);
    color: #00e5a0; font-size: 13px; font-weight: 700;
    letter-spacing: 0.03em;
  }

  .gt-logo-text { display: flex; flex-direction: column; gap: 1px; }
  .gt-logo-name { font-size: 16px; font-weight: 700; color: #00e5a0; }
  .gt-logo-sub  { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #55556a; }

  .gt-brand-copy h2 {
    font-size: 30px; font-weight: 700; color: #e8e8f0;
    line-height: 1.25; letter-spacing: -0.03em; margin-bottom: 14px;
  }
  .gt-brand-copy p { font-size: 15px; color: #9494b0; line-height: 1.6; max-width: 340px; }

  .gt-stats { display: flex; align-items: center; gap: 28px; }
  .gt-stat  { display: flex; flex-direction: column; gap: 3px; }
  .gt-stat-num {
    font-family: var(--font-mono, 'Space Mono', monospace);
    font-size: 26px; font-weight: 700; color: #00e5a0; letter-spacing: -0.03em;
  }
  .gt-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #55556a; }
  .gt-stat-sep   { width: 1px; height: 36px; background: #252530; }

  .gt-brand-grid {
    position: absolute; inset: 0;
    background-image: radial-gradient(circle, #252530 1px, transparent 1px);
    background-size: 26px 26px; opacity: 0.55;
    mask-image: radial-gradient(ellipse at 65% 40%, black 25%, transparent 68%);
    -webkit-mask-image: radial-gradient(ellipse at 65% 40%, black 25%, transparent 68%);
  }

  /* ── Form panel ──────────────────────── */
  .gt-form-panel {
    flex: 0 0 auto; width: 100%;
    display: flex; align-items: center; justify-content: center;
    padding: 40px 24px;
  }
  @media (min-width: 1024px) { .gt-form-panel { width: 460px; } }

  .gt-card { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 30px; }

  .gt-card-head h1 {
    font-size: 24px; font-weight: 700; color: #e8e8f0;
    letter-spacing: -0.03em; margin-bottom: 6px;
  }
  .gt-card-head p { font-size: 14px; color: #9494b0; }

  .gt-form { display: flex; flex-direction: column; gap: 18px; }

  .gt-field { display: flex; flex-direction: column; gap: 7px; }
  .gt-field label { font-size: 12px; font-weight: 500; color: #9494b0; letter-spacing: 0.01em; }

  .gt-field input {
    height: 42px; width: 100%;
    background: #18181f; border: 1px solid #252530; border-radius: 8px;
    padding: 0 13px; font-size: 14px; color: #e8e8f0; outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    font-family: inherit;
  }
  .gt-field input::placeholder { color: #55556a; }
  .gt-field input:focus {
    border-color: #00e5a0;
    box-shadow: 0 0 0 3px rgba(0,229,160,0.1);
  }
  .gt-field input:disabled { opacity: 0.5; cursor: not-allowed; }

  .gt-error {
    display: flex; align-items: center; gap: 8px;
    background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.22);
    border-radius: 8px; padding: 9px 13px;
    font-size: 13px; color: #f87171;
  }

  .gt-btn {
    height: 42px; width: 100%;
    background: #00e5a0; color: #09090f;
    font-size: 14px; font-weight: 600; border: none; border-radius: 8px;
    cursor: pointer; transition: background 0.15s, transform 0.1s;
    display: flex; align-items: center; justify-content: center;
    margin-top: 2px; font-family: inherit;
  }
  .gt-btn:hover:not(:disabled)  { background: #00ccad; }
  .gt-btn:active:not(:disabled) { transform: scale(0.99); }
  .gt-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .gt-spinner {
    display: inline-block; width: 17px; height: 17px;
    border: 2px solid rgba(9,9,15,0.25); border-top-color: #09090f;
    border-radius: 50%; animation: gt-spin 0.7s linear infinite;
  }
  @keyframes gt-spin { to { transform: rotate(360deg); } }

  .gt-hint { font-size: 13px; color: #55556a; text-align: center; }
  .gt-hint span { color: #9494b0; }
`
