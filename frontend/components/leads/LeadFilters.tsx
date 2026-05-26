"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
// lucide-react icons were removed from this file (unused)

import { Button } from "@/components/ui/button"
// Category pills replaced dropdown — no dropdown-menu imports needed
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDebounce } from "@/hooks/useDebounce"
import { categoryLabel, statusLabel } from "@/lib/utils"
import type { LeadCategory, LeadStatus } from "@/types/lead"

const CATEGORY_OPTIONS: LeadCategory[] = [
  "crypto_influencer",
  "blockchain_project",
  "blockchain_expert",
  "golf_user_org",
  "travel_user_org",
]

const STATUS_OPTIONS: LeadStatus[] = [
  "new",
  "engaged",
  "contacted",
  "replied",
  "qualified",
  "unqualified",
  "do-not-contact",
]

const SORT_OPTIONS = [
  { value: "created_at", label: "Newest" },
  { value: "score", label: "Score" },
  { value: "full_name", label: "Name" },
]

const LIMIT_OPTIONS = [25, 50, 100]

function isLeadCategory(value: string): value is LeadCategory {
  return CATEGORY_OPTIONS.includes(value as LeadCategory)
}

function isLeadStatus(value: string): value is LeadStatus {
  return STATUS_OPTIONS.includes(value as LeadStatus)
}

type LeadFiltersProps = {
  view: "all" | "queue"
  onResetToAll?: () => void
}

export function LeadFilters({ view, onResetToAll }: LeadFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [status, setStatus] = React.useState<LeadStatus | "all">("all")
  const [categories, setCategories] = React.useState<LeadCategory[]>([])
  const [source, setSource] = React.useState("")
  const [country, setCountry] = React.useState("")
  const [minScore, setMinScore] = React.useState("")
  const [maxScore, setMaxScore] = React.useState("")
  const [sortBy, setSortBy] = React.useState("created_at")
  const [limit, setLimit] = React.useState("25")

  const debouncedSource = useDebounce(source, 300)
  const debouncedCountry = useDebounce(country, 300)
  const debouncedMinScore = useDebounce(minScore, 300)
  const debouncedMaxScore = useDebounce(maxScore, 300)

  React.useEffect(() => {
    const statusParam = searchParams.get("status")
    setStatus(statusParam && isLeadStatus(statusParam) ? statusParam : "all")

    const categoryParams = searchParams.getAll("category").filter(isLeadCategory)
    setCategories(categoryParams)

    setSource(searchParams.get("source") ?? "")
    setCountry(searchParams.get("country") ?? "")
    setMinScore(searchParams.get("score_min") ?? "")
    setMaxScore(searchParams.get("score_max") ?? "")
    setSortBy(searchParams.get("sort_by") ?? "created_at")
    setLimit(searchParams.get("limit") ?? "25")
  }, [searchParams])

  React.useEffect(() => {
    const currentSearch = window.location.search
    const currentParams = new URLSearchParams(currentSearch)
    const params = new URLSearchParams(currentSearch)

    params.delete("category")
    categories.forEach((category) => params.append("category", category))

    if (status !== "all") {
      params.set("status", status)
    } else {
      params.delete("status")
    }

    if (debouncedSource.trim()) {
      params.set("source", debouncedSource.trim())
    } else {
      params.delete("source")
    }

    if (debouncedCountry.trim()) {
      params.set("country", debouncedCountry.trim())
    } else {
      params.delete("country")
    }

    if (debouncedMinScore.trim()) {
      params.set("score_min", debouncedMinScore.trim())
    } else {
      params.delete("score_min")
    }

    if (debouncedMaxScore.trim()) {
      params.set("score_max", debouncedMaxScore.trim())
    } else {
      params.delete("score_max")
    }

    params.set("sort_by", sortBy)
    params.set("limit", limit)

    const nextQuery = params.toString()
    const currentQuery = currentParams.toString()

    if (nextQuery === currentQuery) {
      return
    }

    router.replace(`${pathname}?${nextQuery}`)
  }, [
    categories,
    debouncedCountry,
    debouncedMaxScore,
    debouncedMinScore,
    debouncedSource,
    limit,
    pathname,
    router,
    searchParams,
    sortBy,
    status,
  ])

  const toggleCategory = (category: LeadCategory) => {
    setCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((value) => value !== category)
      }
      return [...prev, category]
    })
  }

  const resetFilters = () => {
    setStatus("all")
    setCategories([])
    setSource("")
    setCountry("")
    setMinScore("")
    setMaxScore("")
    setSortBy("created_at")
    setLimit("25")
  }

  const handleReset = () => {
    if (view === "queue" && onResetToAll) {
      onResetToAll()
      return
    }

    resetFilters()
  }

  // label for selected categories is computed inline where needed

  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text">Filters</div>
          <div className="text-xs text-text-muted">Refine by status, category, and score</div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Reset
        </Button>
      </div>

      <FieldGroup className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {view !== "queue" ? (
          <Field>
            <FieldLabel>Status</FieldLabel>
            <Select value={status} onValueChange={(value) => setStatus(value as LeadStatus | "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {statusLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <Field>
          <FieldLabel>Category</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            {/* All pill */}
            <button
              type="button"
              onClick={() => setCategories([])}
              className="px-3 py-1 rounded-full text-xs border"
              style={{
                backgroundColor: categories.length === 0 ? 'var(--accent-dim)' : 'var(--gt-surface2)',
                borderColor: categories.length === 0 ? 'var(--gt-accent-bdr)' : 'var(--border)',
                color: categories.length === 0 ? 'var(--gt-accent)' : 'var(--gt-dim)'
              }}
            >
              All
            </button>

            {CATEGORY_OPTIONS.map((category) => {
              const active = categories.includes(category)
              const labelMap: Record<string, string> = {
                crypto_influencer: '🪙 Crypto',
                blockchain_project: '🔷 Blockchain Project',
                blockchain_expert: '🔐 Blockchain Expert',
                golf_user_org: '⛳ Golf',
                travel_user_org: '✈️ Travel',
              }
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="px-3 py-1 rounded-full text-xs border"
                  style={{
                    backgroundColor: active ? 'var(--accent-dim)' : 'var(--gt-surface2)',
                    borderColor: active ? 'var(--gt-accent-bdr)' : 'var(--border)',
                    color: active ? 'var(--gt-accent)' : 'var(--gt-dim)'
                  }}
                >
                  {labelMap[category] ?? categoryLabel(category)}
                </button>
              )
            })}
          </div>
          <FieldDescription>Pick one or more categories.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Source</FieldLabel>
          <Input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="apollo, web, manual"
          />
        </Field>

        <Field>
          <FieldLabel>Country</FieldLabel>
          <Input
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            placeholder="Thailand"
          />
        </Field>

        {view !== "queue" ? (
          <Field>
            <FieldLabel>Score range</FieldLabel>
            <FieldContent>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  inputMode="numeric"
                  value={minScore}
                  onChange={(event) => setMinScore(event.target.value)}
                  placeholder="Min"
                />
                <Input
                  inputMode="numeric"
                  value={maxScore}
                  onChange={(event) => setMaxScore(event.target.value)}
                  placeholder="Max"
                />
              </div>
            </FieldContent>
          </Field>
        ) : null}

        <Field>
          <FieldLabel>Sort by</FieldLabel>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Rows</FieldLabel>
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger>
              <SelectValue placeholder="Rows" />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </div>
  )
}
