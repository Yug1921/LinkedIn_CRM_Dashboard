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
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format } from "date-fns"
import { Users, Zap, MessageSquare, MapPin, Radio } from "lucide-react"

import { api } from "@/lib/api"
import { categoryLabel, statusLabel, timeAgo } from "@/lib/utils"
import { wsManager } from "@/lib/websocket"
import { Skeleton } from "@/components/ui/skeleton"
import type { LeadStatus } from "@/types/lead"
import type { StatsOverview } from "@/types/stats"

// ─── theme tokens (use CSS vars from globals.css to match analytics page) ────
const T = {
  bg:        "var(--gt-bg)",       // page background
  surface:   "var(--gt-surface)",  // card background
  surface2:  "var(--gt-surface2)", // nested / feed item bg
  border:    "var(--gt-border)",   // card border
  border2:   "var(--gt-border)",    // subtle inner border
  accent:    "var(--gt-accent)",   // neon green accent
  accentDim: "var(--gt-accent-dim)",
  text:      "var(--gt-text)",
  textMuted: "var(--gt-dim)",
  textDim:   "#9ca3af",
}

// ─── category + status colors (matching your horizontal bar chart palette) ────
const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  golf_user_org:      { label: "Golf",               color: "#f5a623" },
  blockchain_expert:  { label: "Blockchain Expert",  color: "#4fa3ff" },
  crypto_influencer:  { label: "Crypto",             color: "#00e5a0" },
  blockchain_project: { label: "Blockchain Project", color: "#9994e8" },
  travel_user_org:    { label: "Travel Industry",    color: "#D4537E" },
}

const STATUS_COLORS: Record<string, string> = {
  New: "#4fa3ff",
  Contacted: "#a78bfa",
  Replied: "#00e5a0",
  Qualified: "#f5a623",
  Engaged: "#00bcd4",
  Unqualified: "#444",
}

function formatRegionName(region?: string | null) {
  const value = (region ?? "").trim()
  if (!value) return "-"
  if (/^[a-z]{2,3}$/i.test(value)) {
    try {
      const displayNames = new Intl.DisplayNames(["en"], { type: "region" })
      return displayNames.of(value.toUpperCase()) ?? value.toUpperCase()
    } catch {
      return value.toUpperCase()
    }
  }
  return value
}

interface CaptureTimelinePoint {
  date: string
  fullDate: string
  count: number
  tickLabel: string
  isMajorTick: boolean
}

interface CategorySeriesPoint {
  key: string
  category: string
  count: number
  color: string
}

interface StatusSeriesPoint {
  key: string
  status: string
  count: number
  color: string
}

interface DarkTooltipItem {
  value?: number | string
  payload?: CaptureTimelinePoint
}

interface DarkTooltipProps {
  active?: boolean
  payload?: DarkTooltipItem[]
  label?: string | number
}

interface BarTipItem {
  value?: number | string
}

interface BarTipProps {
  active?: boolean
  payload?: BarTipItem[]
  label?: string | number
}

interface CaptureAxisTickProps {
  x?: number
  y?: number
  payload?: {
    payload?: Pick<CaptureTimelinePoint, "tickLabel" | "isMajorTick">
  }
}

interface CategoryAxisTickProps {
  x?: number
  y?: number
  payload?: { value?: string | number }
}

// ─── animation variants ───────────────────────────────────────────────────────
const containerVariants: Variants = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
}
const staggerVariants: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const cardVariants: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32 } },
}

// ─── data builders ────────────────────────────────────────────────────────────
function buildCaptureTimeline(leads: Array<{ created_at: string }>): CaptureTimelinePoint[] {
  if (leads.length === 0) return []
  const dayCounts = new Map<string, number>()
  let firstDay: Date | null = null
  let lastDay: Date | null = null

  for (const lead of leads) {
    const createdAt = new Date(lead.created_at)
    if (Number.isNaN(createdAt.getTime())) continue
    const dayKey = format(createdAt, "yyyy-MM-dd")
    dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1)
    const d = new Date(createdAt); d.setHours(0, 0, 0, 0)
    if (!firstDay || d < firstDay) firstDay = new Date(d)
    if (!lastDay  || d > lastDay)  lastDay  = new Date(d)
  }

  if (!firstDay || !lastDay) return []
  const timeline: CaptureTimelinePoint[] = []
  const cursor = new Date(firstDay)
  let index = 0

  while (cursor <= lastDay) {
    const dayKey     = format(cursor, "yyyy-MM-dd")
    const isMonthStart = cursor.getDate() === 1
    const isWeeklyTick = index % 7 === 0
    timeline.push({
      date:        format(cursor, "MMM d"),
      fullDate:    format(cursor, "PPP"),
      count:       dayCounts.get(dayKey) ?? 0,
      tickLabel:   isMonthStart ? format(cursor, "MMM d") : isWeeklyTick ? format(cursor, "d") : "",
      isMajorTick: isMonthStart,
    })
    cursor.setDate(cursor.getDate() + 1)
    index++
  }
  return timeline
}

async function fetchAllLeadCaptureTimeline(): Promise<CaptureTimelinePoint[]> {
  const pageSize = 100; let offset = 0; let total = Infinity
  const leads: Array<{ created_at: string }> = []
  while (offset < total) {
    const r = await api.getLeads({ sort_by: "created_at", limit: pageSize, offset })
    leads.push(...r.items); total = r.total; offset += r.items.length
    if (r.items.length === 0) break
  }
  return buildCaptureTimeline(leads)
}

function toCategorySeries(d: StatsOverview): CategorySeriesPoint[] {
  return Object.entries(d.by_category)
    .map(([k, v]) => ({
      key: k,
      category: CATEGORY_CONFIG[k]?.label ?? k.replace(/_/g, " "),
      count: Number(v) || 0,
      color: CATEGORY_CONFIG[k]?.color ?? T.accent,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
}

function buildStatusSeries(data: StatsOverview): StatusSeriesPoint[] {
  return Object.entries(data.by_status).map(([key, value]) => ({
    status: statusLabel(key as LeadStatus),
    key,
    count: value,
    color: STATUS_COLORS[statusLabel(key as LeadStatus)] ?? T.textMuted,
  }))
}

// ─── custom tooltip ───────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }: DarkTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: T.surface2, border: `1px solid ${T.border}`,
      borderRadius: 8, padding: "8px 12px",
      fontSize: 12, color: T.text, boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
    }}>
      <div style={{ color: T.textMuted, marginBottom: 4 }}>{payload[0]?.payload?.fullDate ?? label}</div>
      <div style={{ color: T.accent, fontWeight: 600 }}>{payload[0]?.value} leads</div>
    </div>
  )
}

function BarTip({ active, payload, label }: BarTipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: T.surface2, border: `1px solid ${T.border}`,
      borderRadius: 8, padding: "8px 12px",
      fontSize: 12, color: T.text, boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
    }}>
      <div style={{ color: T.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{payload[0]?.value} leads</div>
    </div>
  )
}

// ─── axis ticks ───────────────────────────────────────────────────────────────
function CaptureAxisTick({ x = 0, y = 0, payload }: CaptureAxisTickProps) {
  const label = payload?.payload?.tickLabel ?? ""; if (!label) return null
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle"
        fill={payload?.payload?.isMajorTick ? T.textDim : T.textMuted}
        fontSize={payload?.payload?.isMajorTick ? 11 : 10}
        fontWeight={payload?.payload?.isMajorTick ? "500" : "400"}
      >{label}</text>
    </g>
  )
}

function CategoryAxisTick({ x = 0, y = 0, payload }: CategoryAxisTickProps) {
  const label = String(payload?.value ?? ""); if (!label) return null
  const words = label.split(" "); const mid = Math.ceil(words.length / 2)
  const l1 = words.slice(0, mid).join(" "); const l2 = words.slice(mid).join(" ")
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill={T.textMuted} fontSize={10}>
        <tspan x={0} dy={4}>{l1}</tspan>
        {l2 ? <tspan x={0} dy={13}>{l2}</tspan> : null}
      </text>
    </g>
  )
}

// ─── metric card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, helper, icon: Icon, accent = T.accent }: {
  label: string; value: string | number; helper: string; icon: React.ElementType; accent?: string
}) {
  return (
    <m.div variants={cardVariants} style={{ height: "100%" }}>
      <div className="border border-border bg-surface" style={{ borderRadius: 10, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {label}
          </span>
          <span style={{
            width: 30, height: 30, borderRadius: 7,
            background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={14} color={accent} />
          </span>
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 600, color: T.text, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 5 }}>{helper}</div>
        </div>
      </div>
    </m.div>
  )
}

// ─── pipeline stage row ───────────────────────────────────────────────────────
function PipelineStage({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: T.textMuted }}>{label}</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: T.textMuted }}>{count}</span>
          <span style={{ fontSize: 11, color: color, fontWeight: 600, minWidth: 34, textAlign: "right" }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: 3, background: T.surface2, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.7s ease" }} />
      </div>
    </div>
  )
}

// ─── card shell ───────────────────────────────────────────────────────────────
function Panel({ title, subtitle, children, style }: {
  title: string; subtitle?: string; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <m.div variants={cardVariants} style={{ height: "100%" }}>
      <div className="border border-border bg-surface" style={{ borderRadius: 10, padding: "20px", height: "100%", display: "flex", flexDirection: "column", ...style }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>{subtitle}</div>}
        </div>
        {children}
      </div>
    </m.div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [mounted, setMounted] = React.useState(false)
  const [feed, setFeed] = React.useState<Array<{ id: string; name: string; category?: string | null; time: string }>>([])
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ["stats"], queryFn: api.getStatsOverview })
  const { data: captureTimeline, isLoading: isTimelineLoading } = useQuery({
    queryKey: ["capture-timeline"], queryFn: fetchAllLeadCaptureTimeline,
  })

  React.useEffect(() => { setMounted(true) }, [])

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const recent = await api.getLeads({ sort_by: "created_at", limit: 5, offset: 0 })
        if (!active || !recent.items.length) return
        const seeded = recent.items
          .slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 1)
          .map((lead) => ({
            id: lead.id,
            name: lead.name || "Lead",
            category: lead.category ?? lead.category_hint ?? null,
            time: lead.created_at,
          }))
        setFeed((prev) => (prev.length ? prev : seeded))
      } catch {
        // Ignore preload failures; websocket updates still drive the feed.
      }
    })()
    return () => { active = false }
  }, [])

  React.useEffect(() => {
    const raw = process.env.NEXT_PUBLIC_API_BASE ?? api.baseUrl
    const wsBase = raw.startsWith("https") ? raw.replace("https", "wss") : raw.replace("http", "ws")
    wsManager.connect(`${wsBase}/ws/leads/live`, (payload) => {
      try {
        queryClient.invalidateQueries({ queryKey: ["stats"] })
        queryClient.invalidateQueries({ queryKey: ["leads"] })
        queryClient.invalidateQueries({ queryKey: ["capture-timeline"] })
        const source = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {}
        const dataObj =
          source.data && typeof source.data === "object" ? (source.data as Record<string, unknown>)
          : source.lead && typeof source.lead === "object" ? (source.lead as Record<string, unknown>)
          : source
        const gs = (k: string) => { const v = dataObj[k]; return typeof v === "string" && v.trim() ? v : undefined }
        const name     = gs("full_name") ?? gs("name") ?? "Lead"
        const category = gs("category") ?? gs("category_hint") ?? null
        setFeed((prev) => [{ id: String(Date.now()) + Math.random(), name, category, time: new Date().toISOString() }, ...prev].slice(0, 1))
      } catch { /* ignore */ }
    })
    return () => { wsManager.disconnect() }
  }, [queryClient])

  const categorySeries = data ? toCategorySeries(data) : []
  const statusSeries = data ? buildStatusSeries(data) : []
  const totalLeads = data?.total_leads ?? 0
  const replyRate = data ? Math.round(data.reply_rate * 100) : 0
  const capturedToday = data?.captured_today ?? 0
  const topLocation = formatRegionName(data?.top_locations?.[0]?.location)
  const totalPipeline = statusSeries.reduce((s, x) => s + x.count, 0)

  return (
    <m.div variants={containerVariants} initial="hidden" animate="visible"
      style={{ minHeight: "100vh", background: T.bg }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px" }}>

        {/* ── header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              Dashboard
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: T.text, margin: 0, letterSpacing: "-0.01em" }}>
              GoTeeOff overview
            </h1>
            <p style={{ fontSize: 12, color: T.textMuted, margin: "4px 0 0" }}>
              Snapshot of pipeline health and AI capture
            </p>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: T.accentDim, border: `1px solid ${T.accent}30`,
            borderRadius: 8, padding: "6px 12px",
          }}>
            <Radio size={11} color={T.accent} />
            <span style={{ fontSize: 11, color: T.accent, fontWeight: 600, letterSpacing: "0.04em" }}>LIVE</span>
          </div>
        </div>

        {/* ── metric cards ── */}
        <m.div variants={staggerVariants} initial="hidden" animate="visible"
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={{ height: 108, borderRadius: 10 }} />)
            : <>
                <MetricCard label="Total leads"    value={totalLeads.toLocaleString()} helper="All captured leads"    icon={Users}          accent="#4fa3ff" />
                <MetricCard label="Captured today" value={capturedToday}               helper="New in last 24 h"     icon={Zap}            accent={T.accent} />
                <MetricCard label="Reply rate"     value={`${replyRate}%`}             helper={`Goal 35% · ${replyRate >= 35 ? "On track" : "Below target"}`} icon={MessageSquare} accent={replyRate >= 35 ? T.accent : "#ff4d6d"} />
                <MetricCard label="Top region"     value={topLocation}                 helper="Highest lead density" icon={MapPin}          accent="#9994e8" />
              </>
          }
        </m.div>

        {/* ── capture trend + pipeline stages ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12, marginBottom: 12 }}>

          {/* capture trend */}
          <Panel title="Capture trend" subtitle="Daily lead captures over time">
            {isLoading || isTimelineLoading
              ? <Skeleton style={{ flex: 1, borderRadius: 8, minHeight: 220 }} />
              : mounted && captureTimeline && captureTimeline.length > 0
                ? (
                  <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden" }}>
                    <div style={{ height: 220, minWidth: Math.max(600, captureTimeline.length * 12) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={captureTimeline} margin={{ left: -8, right: 8, top: 4, bottom: 0 }}>
                          <defs>
                            <linearGradient id="captureGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor={T.accent} stopOpacity={0.25} />
                              <stop offset="100%" stopColor={T.accent} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          {/* no grid */}
                          <XAxis dataKey="date" interval={0} minTickGap={24} tick={<CaptureAxisTick />}
                            tickLine={false} axisLine={{ stroke: T.border }} height={28} />
                          <YAxis tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} width={30} />
                          <RechartsTooltip content={<DarkTooltip />} cursor={{ stroke: T.border, strokeWidth: 1 }} />
                          <Area type="monotone" dataKey="count" stroke={T.accent} fill="url(#captureGrad)"
                            strokeWidth={2} dot={false}
                            activeDot={{ r: 4, fill: T.accent, stroke: T.surface, strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
                : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.textDim, fontSize: 13 }}>
                    No data available
                  </div>
            }
          </Panel>

          {/* pipeline stages */}
          <Panel title="Pipeline stages" subtitle="Distribution by status">
            {isLoading
              ? <Skeleton style={{ flex: 1, borderRadius: 8 }} />
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1, justifyContent: "center" }}>
                  {statusSeries.map((s) => (
                    <PipelineStage key={s.status} label={s.status} count={s.count} total={totalPipeline} color={s.color} />
                  ))}
                  <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14, marginTop: 2,
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: T.textMuted }}>Total pipeline</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{totalLeads.toLocaleString()} leads</span>
                  </div>
                </div>
              )
            }
          </Panel>
        </div>

        {/* ── category + status + live feed ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 280px", gap: 12 }}>

          {/* category volume */}
          <Panel title="Category volume" subtitle="Leads by segment">
            {isLoading
              ? <Skeleton style={{ flex: 1, borderRadius: 8, minHeight: 200 }} />
              : mounted
                ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={categorySeries} margin={{ left: -20, right: 8, bottom: 36 }} barCategoryGap="28%">
                      {/* no grid */}
                      <XAxis dataKey="category" interval={0} height={52}
                        tick={<CategoryAxisTick />} tickLine={false} axisLine={{ stroke: T.border }} />
                      <YAxis tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} width={28} />
                      <RechartsTooltip content={<BarTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {categorySeries.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
                : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.textDim, fontSize: 13 }}>Loading…</div>
            }
          </Panel>

          {/* status mix */}
          <Panel title="Status mix" subtitle="Leads by stage">
            {isLoading
              ? <Skeleton style={{ flex: 1, borderRadius: 8, minHeight: 200 }} />
              : mounted
                ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={statusSeries} margin={{ left: -20, right: 8 }} barCategoryGap="28%">
                      {/* no grid */}
                      <XAxis dataKey="status" tick={{ fontSize: 11, fill: T.textMuted }}
                        axisLine={{ stroke: T.border }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} width={28} />
                      <RechartsTooltip content={<BarTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {statusSeries.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
                : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.textDim, fontSize: 13 }}>Loading…</div>
            }
          </Panel>

          {/* live feed */}
          <Panel title="Live feed">
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {feed.length === 0
                ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 8 }}>
                    <Radio size={22} color={T.textDim} />
                    <span style={{ fontSize: 12, color: T.textDim }}>No live events yet. Latest captured leads will appear here.</span>
                  </div>
                )
                : feed.map((item) => {
                  const cfg = CATEGORY_CONFIG[item.category ?? ""]
                  const accent = cfg?.color ?? T.accent
                  return (
                    <m.div key={item.id}
                      initial={{ x: 10, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.22 }}
                      style={{
                        borderRadius: 7, padding: "8px 10px",
                        background: T.surface2,
                        border: `1px solid ${T.border2}`,
                        borderLeft: `3px solid ${accent}`,
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{item.name}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                        <span style={{ fontSize: 11, color: accent, fontWeight: 500 }}>
                          {cfg?.label ?? categoryLabel(item.category ?? null)}
                        </span>
                        <span style={{ fontSize: 11, color: T.textDim }}>{timeAgo(item.time)}</span>
                      </div>
                    </m.div>
                  )
                })
              }
            </div>

            {/* captured today bar */}
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 11, color: T.textMuted }}>Captured today</span>
                <span style={{ fontSize: 11, color: T.accent, fontWeight: 600 }}>{capturedToday} / 80</span>
              </div>
              <div style={{ height: 3, background: T.surface2, borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${Math.min(100, Math.round((capturedToday / 80) * 100))}%`,
                  background: T.accent, transition: "width 0.7s ease",
                }} />
              </div>
            </div>
          </Panel>
        </div>

        {/* TODO(phase-2): cohort retention and outreach attribution panels */}
      </div>
    </m.div>
  )
}