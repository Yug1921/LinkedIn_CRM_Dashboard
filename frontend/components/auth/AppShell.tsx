"use client"

/**
 * components/auth/AppShell.tsx
 *
 * Decides whether to render the CRM shell (Sidebar + TopBar + AuthGuard)
 * or just bare children (for /login and /invite, which are public).
 *
 * This keeps layout.tsx clean — no per-page layout files needed.
 */

import { Suspense } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBarContainer } from "@/components/layout/TopBarContainer"
import { AuthGuard } from "@/components/auth/AuthGuard"

const PUBLIC_PATHS = ["/login", "/invite"]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (isPublic) {
    // Public pages: no shell, no auth check — render bare
    return <>{children}</>
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen w-full">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Suspense fallback={null}>
            <TopBarContainer />
          </Suspense>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </AuthGuard>
  )
}
