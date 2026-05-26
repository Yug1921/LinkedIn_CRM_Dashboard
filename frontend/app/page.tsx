"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { m } from "framer-motion"
import type { Variants } from "framer-motion"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format } from "date-fns"
import { TrendingUp } from "lucide-react"

import { api } from "@/lib/api"
import { categoryLabel, statusLabel, timeAgo } from "@/lib/utils"
import { wsManager } from "@/lib/websocket"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { LeadStatus } from "@/types/lead"
import type { StatsOverview } from "@/types/stats"

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

function buildCaptureSeries(data: StatsOverview) {
  return data.capture_rate_7d.map((entry) => ({
    date: format(new Date(entry.date), "MMM d"),
    count: entry.count,
  }))
}

function buildCategorySeries(data: StatsOverview) {
  return Object.entries(data.by_category).map(([key, value]) => ({
    category: categoryLabel(key),
    count: value,
  }))
}

function buildStatusSeries(data: StatsOverview) {
  return Object.entries(data.by_status).map(([key, value]) => ({
    status: statusLabel(key as LeadStatus),
    count: value,
  }))
}

export default function DashboardPage() {
  const [mounted, setMounted] = React.useState(false)
  const [feed, setFeed] = React.useState<Array<{ id: string; name: string; category?: string | null; time: string }>>( [])
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: api.getStatsOverview,
  })

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    const raw = process.env.NEXT_PUBLIC_API_BASE ?? api.baseUrl
    const wsBase = raw.startsWith("https")
      ? raw.replace("https", "wss")
      : raw.replace("http", "ws")
    const wsUrl = `${wsBase}/ws/leads/live`

    wsManager.connect(wsUrl, (payload) => {
      try {
        queryClient.invalidateQueries({ queryKey: ["stats"] })
        queryClient.invalidateQueries({ queryKey: ["leads"] })
        const source = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {}
        const dataObj =
          source.data && typeof source.data === "object"
            ? (source.data as Record<string, unknown>)
            : source.lead && typeof source.lead === "object"
              ? (source.lead as Record<string, unknown>)
              : source
        const getStringField = (key: string) => {
          const value = dataObj[key]
          return typeof value === "string" && value.trim() ? value : undefined
        }
        const name = getStringField("full_name") ?? getStringField("name") ?? "Lead"
        const category = getStringField("category") ?? getStringField("category_hint") ?? null
        const item = { id: String(Date.now()) + Math.random(), name, category, time: new Date().toISOString() }
        setFeed((prev) => [item, ...prev].slice(0, 10))
      } catch {
        // ignore
      }
    })

    return () => {
      wsManager.disconnect()
    }
  }, [queryClient])

  const captureSeries = data ? buildCaptureSeries(data) : []
  const categorySeries = data ? buildCategorySeries(data) : []
  const statusSeries = data ? buildStatusSeries(data) : []
  const replyRate = data ? Math.round(data.reply_rate * 100) : 0

  return (
    <m.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-bg"
    >
      <div className="relative overflow-hidden px-6 py-8">
        <div className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-[radial-gradient(circle_at_center,var(--accent-dim),transparent_70%)]" />
        <div className="pointer-events-none absolute right-0 top-6 h-60 w-80 bg-[radial-gradient(circle_at_top,var(--accent-dim),transparent_65%)]" />

        <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-text">GoTeeOff overview</div>
              <div className="text-xs text-text-muted">Snapshot of pipeline health and AI capture</div>
            </div>
            <Badge variant="secondary">
              <TrendingUp className="size-3" />
              Live
            </Badge>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full rounded-xl" />
              ))
            ) : (
              [
                {
                  label: "Total leads",
                  value: data?.total_leads ?? 0,
                  helper: "All captured leads",
                },
                {
                  label: "Captured today",
                  value: data?.captured_today ?? 0,
                  helper: "New in last 24h",
                },
                {
                  label: "Reply rate",
                  value: `${replyRate}%`,
                  helper: "Responded vs contacted",
                },
                {
                  label: "Top region",
                  value: data?.top_locations?.[0]?.location ?? "-",
                  helper: "Highest lead count",
                },
              ].map((metric) => (
                <m.div key={metric.label} variants={cardVariants}>
                  <Card className="border border-border bg-surface">
                    <CardHeader>
                      <CardTitle>{metric.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold text-text">{metric.value}</div>
                      <div className="text-xs text-text-muted">{metric.helper}</div>
                    </CardContent>
                  </Card>
                </m.div>
              ))
              )}
            </div>

            <aside className="w-80">
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-text">Live feed</div>
                  <div className="text-xs text-text-muted">Last {feed.length} events</div>
                </div>

                <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
                  {feed.length === 0 ? (
                    <div className="text-xs text-text-muted">Waiting for leads...</div>
                  ) : (
                    feed.map((item) => (
                      <m.div
                        key={item.id}
                        initial={{ x: 16, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.28 }}
                        className="rounded-md border border-border bg-surface2 p-2"
                        style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: item.category ? 'var(--cat-' + (String(item.category).replaceAll(' ', '-')) + '-text)' : 'var(--gt-accent)' }}
                      >
                        <div className="text-sm font-medium text-text">{item.name}</div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-text-muted">{categoryLabel(item.category ?? null)}</div>
                          <div className="text-xs text-text-muted">{timeAgo(item.time)}</div>
                        </div>
                      </m.div>
                    ))
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-xs text-text-muted">Captured today</div>
                  <div className="mt-2">
                    <Progress value={Math.min(100, Math.round(((data?.captured_today ?? 0) / 80) * 100))} />
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <m.div variants={cardVariants}>
              <Card className="border border-border bg-surface">
                <CardHeader>
                  <CardTitle>Capture momentum</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  {isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={captureSeries} margin={{ left: -8, right: 8 }}>
                        <defs>
                          <linearGradient id="capture" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--gt-accent)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--gt-accent)" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <RechartsTooltip
                          cursor={{ fill: "var(--gt-accent-dim)" }}
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            color: "hsl(var(--popover-foreground))",
                            borderRadius: "10px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="var(--gt-accent)"
                          fill="url(#capture)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-text-muted">
                      Loading chart...
                    </div>
                  )}
                </CardContent>
              </Card>
            </m.div>

            <m.div variants={cardVariants}>
              <Card className="border border-border bg-surface">
                <CardHeader>
                  <CardTitle>Reply rate</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="text-sm text-text-muted">Conversions from contacted leads</div>
                      <div className="flex items-end gap-3">
                        <div className="text-3xl font-semibold text-text">{replyRate}%</div>
                        <div className="text-xs text-text-muted">Goal 35%</div>
                      </div>
                      <Progress value={replyRate} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </m.div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <m.div variants={cardVariants}>
              <Card className="border border-border bg-surface">
                <CardHeader>
                  <CardTitle>Category volume</CardTitle>
                </CardHeader>
                <CardContent className="h-56">
                  {isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categorySeries} margin={{ left: -16, right: 12 }}>
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <RechartsTooltip
                          cursor={{ fill: "var(--gt-accent-dim)" }}
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            color: "hsl(var(--popover-foreground))",
                            borderRadius: "10px",
                          }}
                        />
                        <Bar dataKey="count" fill="var(--gt-accent)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-text-muted">
                      Loading chart...
                    </div>
                  )}
                </CardContent>
              </Card>
            </m.div>

            <m.div variants={cardVariants}>
              <Card className="border border-border bg-surface">
                <CardHeader>
                  <CardTitle>Status mix</CardTitle>
                </CardHeader>
                <CardContent className="h-56">
                  {isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusSeries} margin={{ left: -16, right: 12 }}>
                        <XAxis dataKey="status" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <RechartsTooltip
                          cursor={{ fill: "var(--gt-accent-dim)" }}
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            color: "hsl(var(--popover-foreground))",
                            borderRadius: "10px",
                          }}
                        />
                        <Bar dataKey="count" fill="var(--gt-accent)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-text-muted">
                      Loading chart...
                    </div>
                  )}
                </CardContent>
              </Card>
            </m.div>
          </div>

          {/* TODO(phase-2): Add cohort retention and outreach attribution panels. */}
        </div>
      </div>
    </m.div>
  )
}