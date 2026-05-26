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
} from "recharts"
import { format } from "date-fns"

import { api } from "@/lib/api"
import { statusLabel } from "@/lib/utils"
import type { LeadStatus } from "@/types/lead"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
  const { data, isLoading } = useQuery({
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

  const statusSeries = data
    ? Object.entries(data.by_status).map(([key, value]) => ({
        status: statusLabel(key as LeadStatus),
        count: value,
      }))
    : []

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

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card className="border border-border bg-surface">
              <CardHeader>
                <CardTitle>Weekly capture trend</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={captureSeries} margin={{ left: -8, right: 8 }}>
                      <defs>
                        <linearGradient id="capture-analytics" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--gt-accent)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--gt-accent)" stopOpacity={0.05} />
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
                        fill="url(#capture-analytics)"
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

            <Card className="border border-border bg-surface">
              <CardHeader>
                <CardTitle>Status breakdown</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
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
          </div>

          <Card className="border border-border bg-surface">
            <CardHeader>
              <CardTitle>Top locations</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-28 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead>Leads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.top_locations?.length ? (
                      data.top_locations.map((location) => (
                        <TableRow key={location.location}>
                          <TableCell>{location.location}</TableCell>
                          <TableCell className="text-xs text-text-muted">{location.count}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-xs text-text-muted">
                          No location data yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* TODO(phase-2): Add conversion funnels, cohort analysis, and outreach attribution. */}
        </div>
      </div>
    </m.div>
  )
}
