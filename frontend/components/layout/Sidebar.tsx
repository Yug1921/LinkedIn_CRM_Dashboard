"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { m } from "framer-motion"
import { BarChart3, LayoutDashboard, Settings, Users, ChevronLeft, ChevronRight } from "lucide-react"

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
      animate={{ width: expanded ? 240 : 64 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      data-expanded={expanded}
      className="hidden min-h-screen flex-col p-4 lg:flex sidebar"
      style={{ backgroundColor: "var(--gt-surface)", borderRight: "1px solid var(--gt-border)", boxShadow: "2px 0 12px rgba(0,0,0,0.6)" }}
      
    >
      <div className={cn("flex items-center", expanded ? "justify-start" : "justify-center")}>
        <div className={cn("flex items-center", expanded ? "gap-2" : "gap-0")}>
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-[var(--gt-accent)]">
            GT
          </div>
          {expanded ? (
            <div className="flex flex-col">
              <span className="text-sm font-semibold" style={{ color: "var(--gt-accent)" }}>GoTeeOff</span>
              <span className="text-[11px] uppercase tracking-[0.6px] text-text-muted">CRM</span>
            </div>
          ) : null}
          {/* top toggle for quick access */}
          <div className="ml-auto">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}>
              {expanded ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
            </Button>
          </div>
        </div>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-2">
          {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors nav-link",
                !expanded && "justify-center px-2",
                !isActive && "hover:bg-[var(--gt-surface2)]"
              )}
              data-active={isActive}
              style={{
                backgroundColor: isActive ? "var(--gt-accent)" : "transparent",
                borderLeft: "none",
                color: isActive ? "hsl(var(--primary-foreground))" : "var(--gt-dim)",
              }}
            >
              <Icon className="size-4" />
              {expanded ? <span className="text-[13px] font-medium">{item.label}</span> : null}
            </Link>
          )
        })}
      </nav>

      <div className={cn("flex items-center", expanded ? "justify-between" : "justify-center")}>
        {expanded ? (
          <div className="text-[11px] uppercase tracking-[0.6px] text-text-muted">GoTeeOff 2024</div>
        ) : null}
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Expand sidebar">
          {expanded ? <ChevronLeft data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
        </Button>
      </div>
    </m.aside>
  )
}
