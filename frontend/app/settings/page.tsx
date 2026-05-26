"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { m } from "framer-motion"
import { useMutation } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000"

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
}

type LeadSummary = {
  ai_score: number | null
}

type LeadsResponse = {
  total: number
  items: LeadSummary[]
  limit: number
  offset: number
}

type StatsOverviewResponse = {
  total_leads?: number
}

type ScoreAllResponse = {
  processed: number
  scored: number
  failed: number
  skipped: number
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export default function SettingsPage() {
  const router = useRouter()
  const [totalLeads, setTotalLeads] = React.useState<number | null>(null)
  const [leadsToScore, setLeadsToScore] = React.useState<number | null>(null)
  const [statsLoading, setStatsLoading] = React.useState(true)
  const [statsError, setStatsError] = React.useState<string | null>(null)
  const [scoreResult, setScoreResult] = React.useState<ScoreAllResponse | null>(null)
  const [scoreError, setScoreError] = React.useState<string | null>(null)

  const loadScoringStats = React.useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)

    try {
      const [overview, firstPage] = await Promise.all([
        fetchJson<StatsOverviewResponse>(`${API_BASE}/api/stats/overview`),
        fetchJson<LeadsResponse>(`${API_BASE}/api/leads?limit=1`),
      ])

      const total = typeof overview.total_leads === "number" ? overview.total_leads : firstPage.total
      setTotalLeads(total)

      let unscoredCount = 0
      const batchSize = 100
      for (let offset = 0; offset < total; offset += batchSize) {
        const page = await fetchJson<LeadsResponse>(`${API_BASE}/api/leads?limit=${batchSize}&offset=${offset}`)
        unscoredCount += page.items.filter((lead) => lead.ai_score === null || lead.ai_score === undefined).length
      }

      setLeadsToScore(unscoredCount)
    } catch (error) {
      setStatsError(error instanceof Error ? error.message : "Unable to load lead scoring stats.")
      setTotalLeads(null)
      setLeadsToScore(null)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadScoringStats()
  }, [loadScoringStats])

  const scoreAllMutation = useMutation({
    mutationFn: async () =>
      fetchJson<ScoreAllResponse>(`${API_BASE}/api/leads/score-all`, {
        method: "POST",
      }),
    onMutate: () => {
      setScoreError(null)
      setScoreResult(null)
    },
    onSuccess: async (result) => {
      setScoreResult(result)
      await loadScoringStats()
    },
    onError: (error) => {
      setScoreError(error instanceof Error ? error.message : "Scoring failed.")
    },
  })

  return (
    <m.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-bg"
    >
      <div className="relative overflow-hidden px-6 py-8">
        <div className="pointer-events-none absolute right-0 top-10 h-60 w-80 bg-[radial-gradient(circle_at_top,var(--accent-dim),transparent_70%)]" />
        <div className="mx-auto flex max-w-[900px] flex-col gap-6">
          <div>
            <div className="text-lg font-semibold text-text">Settings</div>
            <div className="text-xs text-text-muted">Configure API connectivity and AI lead scoring</div>
          </div>

          <Card className="border border-border bg-surface">
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldSet>
                <FieldLegend>Connection</FieldLegend>
                <FieldDescription>Configured via environment variables.</FieldDescription>
                <FieldGroup>
                  <Field>
                    <FieldLabel>API base URL</FieldLabel>
                    <Input value={process.env.NEXT_PUBLIC_API_BASE ?? ""} readOnly />
                    <FieldDescription>Configured via NEXT_PUBLIC_API_BASE.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>Workspace notes</FieldLabel>
                    <Input placeholder="Add internal notes" />
                  </Field>
                </FieldGroup>
              </FieldSet>
              <div className="mt-4 flex justify-end">
                <Button>Save settings</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-surface">
            <CardHeader>
              <CardTitle>AI Lead Scoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="text-sm text-text-muted">
                Automatically score all unscored leads using AI. Scores range from 0 (poor fit) to 100 (perfect fit)
                based on headline, category, location and company.
              </div>

              {statsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-56" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ) : statsError ? (
                <div className="rounded-xl border border-border bg-surface2 p-3 text-sm text-text-muted">
                  {statsError}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-4 py-3 text-sm">
                    <span className="text-text-muted">Leads to score</span>
                    <span className="font-semibold text-text">{leadsToScore ?? 0}</span>
                  </div>
                  {typeof totalLeads === "number" ? (
                    <div className="text-xs text-text-muted">Total leads available: {totalLeads}</div>
                  ) : null}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="flex-1 bg-[#00e5a0] text-[#09090f] hover:bg-[#18f1ae]"
                  onClick={() => {
                    scoreAllMutation.mutate()
                  }}
                  disabled={scoreAllMutation.isPending}
                >
                  {scoreAllMutation.isPending ? "Scoring leads..." : "Score All Unscored Leads"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push("/leads?sort_by=score&score_min=70")}
                >
                  View Top Leads
                </Button>
              </div>

              {scoreResult ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                  ✓ Done — scored {scoreResult.scored} leads. Failed: {scoreResult.failed}.{' '}
                  <a href="/leads?sort_by=score" className="underline underline-offset-4">
                    Go to Leads to see results.
                  </a>
                </div>
              ) : null}

              {scoreError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                  {scoreError}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </m.div>
  )
}
