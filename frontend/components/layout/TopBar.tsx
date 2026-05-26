"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Bell, Moon, Search, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"
import { useDebounce } from "@/hooks/useDebounce"

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/analytics": "Analytics",
  "/settings": "Settings",
}

export function TopBar({ capturedToday = 0 }: { capturedToday?: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = React.useState(searchParams.get("search") ?? "")
  const [mounted, setMounted] = React.useState(false)
  const debouncedSearch = useDebounce(searchValue, 300)
  const { resolvedTheme, setTheme } = useTheme()
  const isLeads = pathname === "/leads"

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!isLeads) {
      return
    }
    setSearchValue(searchParams.get("search") ?? "")
  }, [isLeads, searchParams])

  React.useEffect(() => {
    if (!isLeads) {
      return
    }
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
    if (nextQuery === currentQuery) {
      return
    }
    router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`)
  }, [debouncedSearch, isLeads, pathname, router, searchParams])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <div className="flex w-full items-center justify-between border-b border-border bg-surface px-6 py-4">
      <div className="flex items-center gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.6px] text-text-muted">{titles[pathname] ?? ""}</div>
          <div className="text-lg font-semibold text-text">{titles[pathname] ?? ""}</div>
        </div>
        {isLeads ? (
          <div className="hidden w-[320px] lg:block">
            <InputGroup>
              <InputGroupAddon>
                <Search className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search leads..."
                aria-label="Search leads"
              />
            </InputGroup>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {mounted ? (
            resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="size-4" />
          </Button>
          {capturedToday > 0 ? (
            <div className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-[var(--primary-foreground)]">
              {capturedToday}
            </div>
          ) : null}
        </div>
        <Avatar>
          <AvatarFallback className="bg-[var(--accent-dim)] text-[var(--gt-accent)]">GT</AvatarFallback>
        </Avatar>
      </div>
    </div>
  )
}
