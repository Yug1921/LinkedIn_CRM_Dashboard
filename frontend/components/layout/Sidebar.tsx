"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { m } from "framer-motion"
import { BarChart3, LayoutDashboard, Settings, Users, ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = React.useState(true)

  React.useEffect(() => {
    const stored = window.localStorage.getItem("sidebar_expanded")
    if (stored) {
      setExpanded(stored === "true")
    }
  }, [])

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev
      window.localStorage.setItem("sidebar_expanded", String(next))
      return next
    })
  }

  return (
    <m.aside
      layout
      initial={false}
      animate={{ width: expanded ? 260 : 72 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      data-expanded={expanded}
      className="hidden min-h-screen flex-col lg:flex sidebar"
      style={{
        backgroundColor: "var(--gt-surface)",
        borderRight: "1px solid var(--gt-border)",
        boxShadow: "2px 0 12px rgba(0,0,0,0.6)",
      }}
    >
      {/* ── Logo section ── */}
      <div
        className={cn(
          "flex items-center border-b border-[var(--gt-border)]",
          expanded ? "gap-4 px-5 py-5" : "justify-center min-h-[72px]"
        )}
      >
        <div
          onClick={!expanded ? toggle : undefined}
          className={cn(!expanded && "cursor-pointer")}
        >
          <Image
            src="/GoteeOff_logo.png"
            alt="GoTeeOff"
            width={expanded ? 56 : 44}
            height={expanded ? 56 : 44}
            className="rounded-lg"
            style={{ objectFit: "contain" }}
            priority
          />
        </div>
        {expanded ? (
          <>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-base font-bold truncate" style={{ color: "var(--gt-accent)" }}>
                GoTeeOff
              </span>
              <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--gt-muted)" }}>
                CRM Platform
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Collapse sidebar"
              className="size-7 rounded-md hover:bg-[var(--gt-surface2)] shrink-0"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </>
        ) : null}
      </div>

      {/* ── Navigation ── */}
      {expanded && (
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg transition-all duration-150 nav-link px-4 py-2.5",
                  isActive
                    ? "bg-[var(--gt-accent)] text-[hsl(var(--primary-foreground))]"
                    : "text-[var(--gt-dim)] hover:bg-[var(--gt-surface2)] hover:text-[var(--gt-text)]"
                )}
                data-active={isActive}
              >
                <Icon className="shrink-0 size-4" />
                <span className="text-sm font-medium truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}

      {/* ── Footer ── */}
      {expanded && (
        <div className="flex items-center justify-end border-t border-[var(--gt-border)] px-5 py-3">
          <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--gt-muted)" }}>
            GoTeeOff 2024
          </span>
        </div>
      )}
    </m.aside>
  )
}
