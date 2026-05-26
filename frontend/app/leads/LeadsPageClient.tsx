"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { m } from "framer-motion"
import type { Variants } from "framer-motion"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { wsManager } from "@/lib/websocket"
import { LeadFilters } from "@/components/leads/LeadFilters"
import { LeadDrawer } from "@/components/leads/LeadDrawer"
import { LeadTable } from "@/components/leads/LeadTable"
import { Badge } from "@/components/ui/badge"
import type { Lead, LeadCategory, LeadFilters as LeadFiltersType, LeadStatus } from "@/types/lead"

const CATEGORY_VALUES: LeadCategory[] = [
  "crypto_influencer",
  "blockchain_project",
  "blockchain_expert",
  "golf_user_org",
  "travel_user_org",
]

const STATUS_VALUES: LeadStatus[] = [
  "new",
  "engaged",
  "contacted",
  "replied",
  "qualified",
  "unqualified",
  "do-not-contact",
]

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
}

function toNumber(value: string | null) {
  if (!value) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

export default function LeadsPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const view = searchParams.get("view") ?? "all"
  const limit = Number(searchParams.get("limit") ?? "25")
  const offset = (currentPage - 1) * limit

  React.useEffect(() => {
    setCurrentPage(1)
  }, [
    searchParams.get("category"),
    searchParams.get("status"),
    searchParams.get("search"),
    searchParams.get("country"),
    searchParams.get("score_min"),
    searchParams.get("score_max"),
    searchParams.get("sort_by"),
  ])

  const categoryKey = searchParams.getAll("category").join(",")

  const baseFilters = React.useMemo<LeadFiltersType>(() => {
    const categoryParams = searchParams
      .getAll("category")
      .filter((value) => CATEGORY_VALUES.includes(value as LeadCategory)) as LeadCategory[]

    const statusParam = searchParams.get("status")
    const status = statusParam && STATUS_VALUES.includes(statusParam as LeadStatus)
      ? (statusParam as LeadStatus)
      : undefined

    return {
      category: categoryParams.length ? categoryParams : undefined,
      status,
      source: searchParams.get("source") ?? undefined,
      country: searchParams.get("country") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      min_score: toNumber(searchParams.get("score_min")),
      max_score: toNumber(searchParams.get("score_max")),
      sort_by: searchParams.get("sort_by") ?? undefined,
      limit,
      offset,
    }
  }, [searchParams, limit, offset])

  const effectiveFilters = React.useMemo<LeadFiltersType>(() => {
    if (view === "queue") {
      return {
        ...baseFilters,
        status: "new" as LeadStatus,
        min_score: 70,
        sort_by: "score" as const,
        limit,
        offset: (currentPage - 1) * limit,
      }
    }

    return {
      ...baseFilters,
      limit,
      offset: (currentPage - 1) * limit,
    }
  }, [baseFilters, currentPage, limit, view])

  const { data: queueCount } = useQuery({
    queryKey: ["queue-count"],
    queryFn: async () => {
      const res = await api.getLeads({
        status: "new",
        min_score: 70,
        limit: 1,
        offset: 0,
      })
      return res.total
    },
    staleTime: 30_000,
  })

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: [
      "leads",
      view,
      searchParams.get("category"),
      searchParams.get("status"),
      searchParams.get("search"),
      searchParams.get("country"),
      searchParams.get("score_min"),
      searchParams.get("score_max"),
      searchParams.get("sort_by"),
      categoryKey,
      limit,
      currentPage,
    ],
    queryFn: () => api.getLeads(effectiveFilters),
    placeholderData: (previous) => previous,
  })

  function switchTab(tab: "all" | "queue") {
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", tab)
    params.delete("status")
    params.delete("score_min")
    params.delete("score_max")
    params.set("sort_by", tab === "queue" ? "score" : "created_at")
    router.replace(`?${params.toString()}`, { scroll: false })
    setCurrentPage(1)
  }

  React.useEffect(() => {
    const baseUrl = api.baseUrl
    const wsBase = baseUrl.startsWith("https")
      ? baseUrl.replace("https", "wss")
      : baseUrl.replace("http", "ws")
    const wsUrl = `${wsBase}/ws/leads/live`

    wsManager.connect(wsUrl, (payload) => {
      if (typeof payload === "object" && payload && "event" in payload) {
        const message = payload as { event: string }
        if (message.event === "new_lead") {
          queryClient.invalidateQueries({ queryKey: ["leads"] })
          queryClient.invalidateQueries({ queryKey: ["queue-count"] })
          toast.message("New lead captured")
        }
      }
    })

    return () => {
      wsManager.disconnect()
    }
  }, [queryClient])

  const leads = React.useMemo(() => data?.items ?? [], [data?.items])

  React.useEffect(() => {
    if (!selectedLead) {
      return
    }

    const freshLead = data?.items.find((lead) => lead.id === selectedLead.id) ?? null
    if (!freshLead) {
      setSelectedLead(null)
      return
    }

    if (freshLead !== selectedLead) {
      setSelectedLead(freshLead)
    }
  }, [data, selectedLead])

  return (
    <m.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-bg"
    >
      <div className="relative overflow-hidden px-6 py-8">
        <div className="pointer-events-none absolute -left-24 -top-16 size-72 rounded-full bg-[radial-gradient(circle_at_center,var(--accent-dim),transparent_70%)]" />
        <div className="pointer-events-none absolute right-0 top-0 h-52 w-80 bg-[radial-gradient(circle_at_top,var(--accent-dim),transparent_70%)]" />

        <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-text">Lead pipeline</div>
              <div className="text-xs text-text-muted">Live lead updates and AI scoring</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Live feed</Badge>
              {isFetching ? <Badge variant="secondary">Refreshing</Badge> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#252530] bg-[#111115] p-2">
            <button
              type="button"
              onClick={() => switchTab("all")}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                border: view === "all" ? "1px solid rgba(0,229,160,0.4)" : "1px solid #252530",
                background: view === "all" ? "rgba(0,229,160,0.1)" : "#18181f",
                color: view === "all" ? "#00e5a0" : "#9494b0",
                transition: "all 0.15s",
              }}
            >
              All Leads
            </button>

            <button
              type="button"
              onClick={() => switchTab("queue")}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                border: view === "queue" ? "1px solid rgba(0,229,160,0.4)" : "1px solid #252530",
                background: view === "queue" ? "rgba(0,229,160,0.1)" : "#18181f",
                color: view === "queue" ? "#00e5a0" : "#9494b0",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <span>🎯 Ready to Contact</span>
              {queueCount != null && queueCount > 0 ? (
                <span
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: 11,
                    padding: "0 7px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,229,160,0.14)",
                    color: "#00e5a0",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {queueCount}
                </span>
              ) : null}
            </button>
          </div>

          <LeadFilters view={view === "queue" ? "queue" : "all"} onResetToAll={() => switchTab("all")} />

          {view === "queue" ? (
            <div className="rounded-xl border border-[#252530] bg-[#111115] px-5 py-4 text-sm text-[#c8c8da]">
              <div className="flex items-start gap-3">
                <div className="text-xl leading-none">🎯</div>
                <div>
                  <div>
                    Showing {data?.total ?? 0} high-priority leads (score ≥ 70, not yet contacted) — sorted by relevance score.
                  </div>
                  <div className="mt-1 text-xs text-[#9494b0]">
                    Click any row to open and generate an outreach message.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <LeadTable
            leads={leads}
            totalCount={data?.total ?? 0}
            limit={limit}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            onLeadClick={(lead) => setSelectedLead(lead)}
          />

          <LeadDrawer
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onStatusChange={() => {
              queryClient.invalidateQueries({ queryKey: ["leads"] })
              queryClient.invalidateQueries({ queryKey: ["queue-count"] })
              setSelectedLead(null)
            }}
          />

          {/* TODO(phase-2): Add lead detail drawer, bulk actions, and saved filters. */}
        </div>
      </div>
    </m.div>
  )
}
