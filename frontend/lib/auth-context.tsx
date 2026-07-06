"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"
const REFRESH_INTERVAL_MS = 50 * 60 * 1000
const SESSION_KEY = "gt_auth_user"
const LAST_REFRESH_KEY = "gt_last_refresh"

export type AuthUser = {
  id: string
  email: string
  full_name: string
  is_admin: boolean
}

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: AuthUser; token: string }
  | { status: "unauthenticated" }

type AuthContextValue = {
  state: AuthState
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  getToken: () => Promise<string | null>
  handleUnauthorized: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function writeCachedUser(user: AuthUser): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)) } catch {}
}

function clearCachedUser(): void {
  try { localStorage.removeItem(SESSION_KEY) } catch {}
  try { localStorage.removeItem(LAST_REFRESH_KEY) } catch {}
}

async function doRefreshWithRetry(): Promise<string | null> {
  const delays = [800, 1600, 3200]
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) return null
      const data: { access_token: string } = await res.json()
      return data.access_token
    } catch {
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]))
      }
    }
  }
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cachedUser = typeof window !== "undefined" ? readCachedUser() : null

  const [state, setState] = useState<AuthState>(
    cachedUser
      ? { status: "authenticated", user: cachedUser, token: "" }
      : { status: "loading" }
  )

  const tokenRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRefreshAt = useRef<number>(0)

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const token = await doRefreshWithRetry()
      if (!token) {
        tokenRef.current = null
        clearCachedUser()
        setState({ status: "unauthenticated" })
      } else {
        tokenRef.current = token
        lastRefreshAt.current = Date.now()
        scheduleRefresh()
      }
    }, REFRESH_INTERVAL_MS)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function initAuth() {
      const cached = readCachedUser()

      // If we have a cached user AND a recent refresh (< 10 min ago),
      // skip the refresh call — stay authenticated immediately.
      const lastRefresh = Number(localStorage.getItem(LAST_REFRESH_KEY) ?? "0")
      const age = Date.now() - lastRefresh
      if (cached && age < 10 * 60 * 1000) {
        setState({ status: "authenticated", user: cached, token: "" })
        doRefreshWithRetry().then((token) => {
          if (token) {
            try {
              localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()))
            } catch {}
            setState((prev) =>
              prev.status === "authenticated"
                ? { ...prev, token }
                : prev
            )
            scheduleRefresh()
          }
        })
        return
      }

      // No cache or stale — do the full refresh + /me flow
      const token = await doRefreshWithRetry()
      if (cancelled) return

      if (!token) {
        const stillCached = readCachedUser()
        if (stillCached) {
          // Cross-origin timing issue — retry once after 2s
          await new Promise((r) => setTimeout(r, 2000))
          if (cancelled) return
          const retryToken = await doRefreshWithRetry()
          if (cancelled) return
          if (!retryToken) {
            tokenRef.current = null
            clearCachedUser()
            setState({ status: "unauthenticated" })
            return
          }
          try {
            localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()))
          } catch {}
          setState({ status: "authenticated", user: stillCached, token: retryToken })
          scheduleRefresh()
          return
        }
        tokenRef.current = null
        setState({ status: "unauthenticated" })
        return
      }

      try {
        localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()))
      } catch {}
      lastRefreshAt.current = Date.now()

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error()
        if (cancelled) return
        const user: AuthUser = await res.json()
        writeCachedUser(user)
        setState({ status: "authenticated", user, token })
        scheduleRefresh()
      } catch {
        if (cancelled) return
        const cached2 = readCachedUser()
        if (cached2) {
          setState({ status: "authenticated", user: cached2, token })
          scheduleRefresh()
        } else {
          tokenRef.current = null
          setState({ status: "unauthenticated" })
        }
      }
    }

    void initAuth()

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [scheduleRefresh])

  // Visibility-based refresh — handles sleep/wake
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return
      const age = Date.now() - lastRefreshAt.current
      if (age > 45 * 60 * 1000) {
        doRefreshWithRetry().then((token) => {
          if (!token) {
            clearCachedUser()
            tokenRef.current = null
            setState({ status: "unauthenticated" })
          } else {
            tokenRef.current = token
            lastRefreshAt.current = Date.now()
          }
        })
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  // Network reconnect refresh — recovers session after dropout
  useEffect(() => {
    function handleOnline() {
      if (tokenRef.current) return
      const cached = readCachedUser()
      if (!cached) return
      doRefreshWithRetry().then((token) => {
        if (token) {
          tokenRef.current = token
          lastRefreshAt.current = Date.now()
          fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((user) => {
              if (user) {
                writeCachedUser(user)
                setState({ status: "authenticated", user, token })
                scheduleRefresh()
              }
            })
            .catch(() => {})
        }
      })
    }

    window.addEventListener("online", handleOnline)
    return () => window.removeEventListener("online", handleOnline)
  }, [scheduleRefresh])

  const login = useCallback(async (email: string, password: string) => {
    const body = new URLSearchParams()
    body.set("username", email)
    body.set("password", password)

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      credentials: "include",
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }))
      throw new Error(err.detail ?? "Login failed")
    }
    const data: { access_token: string; user: AuthUser } = await res.json()
    tokenRef.current = data.access_token
    writeCachedUser(data.user)
    setState({ status: "authenticated", user: data.user, token: data.access_token })
    scheduleRefresh()
  }, [scheduleRefresh])

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" })
    tokenRef.current = null
    clearCachedUser()
    if (timerRef.current) clearTimeout(timerRef.current)
    setState({ status: "unauthenticated" })
  }, [])

  const getToken = useCallback(async (): Promise<string | null> => {
    if (tokenRef.current) return tokenRef.current
    const token = await doRefreshWithRetry()
    if (token) {
      tokenRef.current = token
      lastRefreshAt.current = Date.now()
    }
    return token
  }, [])

  const handleUnauthorized = useCallback(() => {
    tokenRef.current = null
    clearCachedUser()
    if (timerRef.current) clearTimeout(timerRef.current)
    setState({ status: "unauthenticated" })
  }, [])

  return (
    <AuthContext.Provider value={{ state, login, logout, getToken, handleUnauthorized }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}

export function useUser(): AuthUser | null {
  const { state } = useAuth()
  return state.status === "authenticated" ? state.user : null
}
