"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
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
  LabelList,
} from "recharts"
import { Cell } from "recharts"
import { format } from "date-fns"

import { api } from "@/lib/api"
import { statusLabel } from "@/lib/utils"
import type { LeadStatus } from "@/types/lead"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
}

export default function AnalyticsPage() {
  const [mounted, setMounted] = React.useState(false)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stats"],
    queryFn: api.getStatsOverview,
  })

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const captureSeries = data
    ? data.capture_rate_7d.map((entry) => ({
        date: format(new Date(entry.date), "MMM d"),
        count: entry.count,
      }))
    : []

  const categorySeries = data
    ? Object.entries(data.by_category).map(([key, value]) => {
        // normalize incoming key to lower/underscore form
        const norm = String(key ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")
        const nameMap: Record<string, string> = {
          crypto_influencer: "Crypto",
          blockchain_project: "Blockchain",
          blockchain_expert: "Blockchain Expert",
          golf_user_org: "Golf",
          travel_user_org: "Travel",
          travel: "Travel",
          golf_brand: "Golf",
          golf_industry: "Golf",
        }
        const name = nameMap[norm] ?? norm.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        return { key: norm, name, value }
      })
    : []

  const statusOrder = ["new", "contacted", "replied", "qualified", "do-not-contact", "engaged", "unqualified"]
  const statusColors: Record<string, string> = {
    new: "#4fa3ff",
    contacted: "#a78bfa",
    replied: "#00e5a0",
    converted: "#f5a623",
    do_not_contact: "#ff4d6d",
  }

  const statusSeriesOrdered = data
    ? statusOrder
        .map((k) => ({ status: statusLabel(k as LeadStatus), key: k, count: data.by_status[k] ?? 0 }))
        .filter((s) => s.status !== "Unknown")
    : []

  const topLocations = data ? (data.top_locations ?? []).slice(0, 8) : []

  return (
    <m.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-bg"
    >
      <div className="relative overflow-hidden px-6 py-8">
        <div className="pointer-events-none absolute -left-16 top-10 size-64 rounded-full bg-[radial-gradient(circle_at_center,var(--accent-dim),transparent_70%)]" />
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
          <div>
            <div className="text-lg font-semibold text-text">Analytics</div>
            <div className="text-xs text-text-muted">Pipeline performance and reply health</div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* SECTION 1 — Capture Trend */}
            <Card className="border border-border bg-surface rounded-[12px]">
              <CardHeader>
                <CardTitle>Capture Trend</CardTitle>
                <div className="text-xs text-text-muted">Last 7 days</div>
              </CardHeader>
              <CardContent className="p-5">
                {isError ? (
                  <div className="flex flex-col items-start gap-3">
                    <div className="text-sm font-semibold text-text">Failed to load analytics</div>
                    <div className="text-xs text-text-muted">There was an error fetching stats.</div>
                    <div>
                      <Button onClick={() => refetch()}>Retry</Button>
                    </div>
                  </div>
                ) : isLoading ? (
                  <Skeleton className="h-56 w-full" />
                ) : mounted ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={captureSeries} margin={{ left: 0, right: 8 }}>
                      <defs>
                        <linearGradient id="capture-analytics" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={`hsl(var(--accent))`} stopOpacity={0.18} />
                          <stop offset="100%" stopColor={`hsl(var(--accent))`} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gt-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--gt-text)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "var(--gt-text)" }} axisLine={false} tickLine={false} />
                      <RechartsTooltip cursor={{ fill: "var(--gt-accent-dim)" }} contentStyle={{ backgroundColor: "var(--gt-surface)", border: "1px solid var(--gt-border)", color: "var(--gt-text)" }} />
                      <Area type="monotone" dataKey="count" stroke={`var(--gt-accent)`} fill="url(#capture-analytics)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-text-muted">Loading chart...</div>
                )}
              </CardContent>
            </Card>

            {/* SECTION 2 — Leads by Category */}
            <Card className="border border-border bg-surface rounded-[12px]">
              <CardHeader>
                <CardTitle>Leads by Category</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {isError ? (
                  <div className="flex flex-col items-start gap-3">
                    <div className="text-sm font-semibold text-text">Failed to load analytics</div>
                    <div className="text-xs text-text-muted">There was an error fetching stats.</div>
                    <div>
                      <Button onClick={() => refetch()}>Retry</Button>
                    </div>
                  </div>
                ) : isLoading ? (
                  <Skeleton className="h-56 w-full" />
                ) : mounted ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart layout="vertical" data={categorySeries} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gt-border)" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--gt-text)" }} />
                      <YAxis width={100} type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--gt-text)", dy: 6 }} />
                      <RechartsTooltip cursor={{ fill: "var(--gt-accent-dim)" }} contentStyle={{ backgroundColor: "var(--gt-surface)", border: "1px solid var(--gt-border)", color: "var(--gt-text)" }} />
                      <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                        {categorySeries.map((entry) => {
                          const map: Record<string, string> = {
                            crypto_influencer: "#00e5a0",
                            blockchain_project: "#9994e8",
                            blockchain_expert: "#4fa3ff",
                            golf_user_org: "#f5a623",
                            travel_user_org: "#D4537E",
                            golf_brand: "var(--gt-accent)",
                            travel: "var(--gt-accent)",
                          }
                          const norm = String(entry.key).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_")
                          const fill = map[entry.key] ?? map[norm] ?? "#999"
                          return <Cell key={entry.key} fill={fill} />
                        })}
                        <LabelList dataKey="value" position="right" fill="var(--gt-text)" style={{ fontSize: 12, fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-text-muted">Loading chart...</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border border-border bg-surface rounded-[12px]">
              <CardHeader>
                <CardTitle>Pipeline Status</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {isError ? (
                  <div className="flex flex-col items-start gap-3">
                    <div className="text-sm font-semibold text-text">Failed to load analytics</div>
                    <div className="text-xs text-text-muted">There was an error fetching stats.</div>
                    <div>
                      <Button onClick={() => refetch()}>Retry</Button>
                    </div>
                  </div>
                ) : isLoading ? (
                  <Skeleton className="h-56 w-full" />
                ) : mounted ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={statusSeriesOrdered} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gt-border)" />
                      <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--gt-text)" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--gt-text)" }} />
                      <RechartsTooltip cursor={{ fill: "var(--gt-accent-dim)" }} contentStyle={{ backgroundColor: "var(--gt-surface)", border: "1px solid var(--gt-border)", color: "var(--gt-text)" }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {statusSeriesOrdered.map((entry) => (
                          <Cell key={entry.key} fill={statusColors[entry.key] ?? "#999"} />
                        ))}
                        <LabelList dataKey="count" position="top" fill="var(--gt-text)" style={{ fontSize: 12, fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-text-muted">Loading chart...</div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border bg-surface rounded-[12px]">
              <CardHeader>
                <CardTitle>Top Locations</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {isError ? (
                  <div className="flex flex-col items-start gap-3">
                    <div className="text-sm font-semibold text-text">Failed to load analytics</div>
                    <div className="text-xs text-text-muted">There was an error fetching stats.</div>
                    <div>
                      <Button onClick={() => refetch()}>Retry</Button>
                    </div>
                  </div>
                ) : isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : topLocations.length ? (
                  <div className="grid gap-3">
                    {(() => {
                      const max = Math.max(...topLocations.map((t) => t.count), 1)
                      return topLocations.map((loc, idx) => {
                        const pct = Math.round((loc.count / max) * 100)
                        const opacity = Math.max(0.18, 0.9 - idx * 0.1)
                        const countryMap: Record<string, string> = {
                          IN: "India",
                        }
                        const display = countryMap[String(loc.location).toUpperCase()] ?? loc.location
                        return (
                          <div key={loc.location} className="flex items-center gap-3">
                            <div className="w-40 text-sm text-text">{display}</div>
                            <div className="flex-1 h-3 rounded-full bg-[var(--gt-surface2)] overflow-hidden">
                              <div style={{ width: `${pct}%`, background: `var(--gt-accent)`, opacity, height: '100%' }} />
                            </div>
                            <div className="w-12 text-right text-sm text-text-muted">{loc.count}</div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                ) : (
                  <div className="text-xs text-text-muted">No location data yet.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* TODO(phase-2): Add conversion funnels, cohort analysis, and outreach attribution. */}
        </div>
      </div>
    </m.div>
  )
}
