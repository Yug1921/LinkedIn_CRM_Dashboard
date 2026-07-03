"use client"

/**
 * components/auth/AuthGuard.tsx
 *
 * "loading" only blocks render when there is genuinely no cached session
 * (first visit / after logout). The spinner has a 600ms delay so fast
 * refreshes never show a flash.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { state } = useAuth()
  const router = useRouter()
  const [showSpinner, setShowSpinner] = useState(false)

  useEffect(() => {
    if (state.status !== "loading") {
      setShowSpinner(false)
      return
    }
    const t = setTimeout(() => setShowSpinner(true), 600)
    return () => clearTimeout(t)
  }, [state.status])

  useEffect(() => {
    if (state.status === "unauthenticated") {
      router.replace("/login")
    }
  }, [state.status, router])

  if (state.status === "loading") {
    if (!showSpinner) return null
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#09090f",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: "2px solid #252530",
            borderTopColor: "#00e5a0",
            animation: "gt-spin 0.75s linear infinite",
          }}
        />
        <style>{`@keyframes gt-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (state.status === "unauthenticated") return null

  return <>{children}</>
}
