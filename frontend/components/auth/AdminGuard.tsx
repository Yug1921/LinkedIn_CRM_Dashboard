"use client"

import { useRouter } from "next/navigation"
import { ShieldAlert } from "lucide-react"

import { useUser, useAuth } from "@/lib/auth-context"

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const user = useUser()
  const { state } = useAuth()
  const router = useRouter()

  if (state.status === "loading") return null

  if (!user || !user.is_admin) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100%",
          padding: "48px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "16px",
            maxWidth: "360px",
            width: "100%",
            background: "#111118",
            border: "1px solid #252530",
            borderRadius: "16px",
            padding: "48px 36px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f87171",
            }}
          >
            <ShieldAlert size={26} strokeWidth={2} />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#e8e8f0", letterSpacing: "-0.03em", marginBottom: "8px" }}>
              Access restricted
            </h2>
            <p style={{ fontSize: "14px", color: "#9494b0", lineHeight: 1.55 }}>
              This area is for admins only.
            </p>
          </div>
          <button
            onClick={() => router.back()}
            style={{
              height: "40px",
              padding: "0 20px",
              background: "#00e5a0",
              color: "#09090f",
              fontSize: "14px",
              fontWeight: 600,
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontFamily: "inherit",
              marginTop: "4px",
            }}
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
