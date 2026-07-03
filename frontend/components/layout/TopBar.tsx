"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Bell, LogOut, Moon, Search, Settings, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebounce } from "@/hooks/useDebounce"
import { useUser, useAuth } from "@/lib/auth-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/analytics": "Analytics",
  "/settings": "Settings",
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

export function TopBar({ capturedToday = 0 }: { capturedToday?: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = React.useState(searchParams.get("search") ?? "")
  const [mounted, setMounted] = React.useState(false)
  const debouncedSearch = useDebounce(searchValue, 300)
  const { theme, setTheme } = useTheme()
  const isLeads = pathname === "/leads"

  const user = useUser()
  const { state, logout } = useAuth()
  const isLoading = state.status === "loading"

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!isLeads) return
    setSearchValue(searchParams.get("search") ?? "")
  }, [isLeads, searchParams])

  React.useEffect(() => {
    if (!isLeads) return
    const params = new URLSearchParams(searchParams.toString())
    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim())
      params.set("offset", "0")
    } else {
      params.delete("search")
      params.set("offset", "0")
    }
    const nextQuery = params.toString()
    const currentQuery = searchParams.toString()
    if (nextQuery === currentQuery) return
    router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`)
  }, [debouncedSearch, isLeads, pathname, router, searchParams])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const handleLogout = async () => {
    await logout()
    router.replace("/login")
  }

  return (
    <div className="flex w-full items-center justify-between px-6 py-4" style={{ backgroundColor: "var(--gt-surface)", borderBottom: "1px solid var(--gt-border)" }}>
      <div className="flex items-center gap-4">
        <div>
          <div className="text-lg font-semibold text-text">{titles[pathname] ?? ""}</div>
        </div>
        {isLeads ? (
          <div className="hidden w-[320px] lg:block">
            <InputGroup style={{ backgroundColor: "var(--gt-bg)", border: "1px solid var(--gt-border)" }}>
              <InputGroupAddon>
                <Search className="size-4" style={{ color: "var(--gt-muted)" }} />
              </InputGroupAddon>
              <InputGroupInput
                style={{ color: "var(--gt-text)" }}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search leads..."
                aria-label="Search leads"
                className="bg-transparent placeholder:text-[#9ca3af]"
              />
            </InputGroup>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="bg-transparent p-0 text-[var(--gt-dim)] hover:bg-transparent hover:text-text"
        >
          {mounted ? (
            theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Notifications" className="bg-transparent p-0 text-[var(--gt-dim)] hover:bg-transparent hover:text-text">
            <Bell className="size-4" />
          </Button>
          {capturedToday > 0 ? (
            <div className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-[var(--primary-foreground)]">
              {capturedToday}
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <Skeleton className="size-8 rounded-full" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full outline-none">
                <Avatar style={{ backgroundColor: "#00e5a0" }}>
                  <AvatarFallback style={{ backgroundColor: "#00e5a0", color: "#09090f", fontSize: "13px", fontWeight: 600 }}>
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
              <div className="px-2 pt-1.5 pb-1">
                <p className="text-sm font-semibold text-foreground">{user.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="px-2 pb-1.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    user.is_admin
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {user.is_admin ? "Admin" : "Member"}
                </span>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} variant="destructive">
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  )
}
