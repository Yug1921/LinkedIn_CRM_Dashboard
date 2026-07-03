"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { m } from "framer-motion"
import type { Variants } from "framer-motion"
import { useMutation } from "@tanstack/react-query"
import { Copy, Check, Mail, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth, useUser } from "@/lib/auth-context"
import { AdminGuard } from "@/components/auth/AdminGuard"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000"

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
}

// ── Types ─────────────────────────────────────────────────────────────────────

type LeadSummary = { ai_score: number | null }
type LeadsResponse = { total: number; items: LeadSummary[]; limit: number; offset: number }
type StatsOverviewResponse = { total_leads?: number }
type ScoreAllResponse = { processed: number; scored: number; failed: number; skipped: number }
type InviteResponse = { invite_link: string; invite_token: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

// ── Invite Card ───────────────────────────────────────────────────────────────

function InviteTeamCard() {
  const { getToken } = useAuth()
  const currentUser = useUser()

  const [inviteEmail, setInviteEmail]     = React.useState("")
  const [inviteName, setInviteName]       = React.useState("")
  const [inviteRole, setInviteRole]       = React.useState<"member" | "admin">("member")
  const [inviteLink, setInviteLink]       = React.useState<string | null>(null)
  const [copied, setCopied]               = React.useState(false)
  const [inviteError, setInviteError]     = React.useState<string | null>(null)

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      if (!token) throw new Error("Not authenticated")

      const res = await fetch(`${API_BASE}/auth/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          full_name: inviteName.trim(),
          is_admin: inviteRole === "admin",
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to generate invite" }))
        throw new Error(err.detail ?? "Failed to generate invite")
      }

      return res.json() as Promise<InviteResponse>
    },
    onMutate: () => {
      setInviteError(null)
      setInviteLink(null)
      setCopied(false)
    },
    onSuccess: (data) => {
      setInviteLink(data.invite_link)
      setInviteEmail("")
      setInviteName("")
      setInviteRole("member")
    },
    onError: (err) => {
      setInviteError(err instanceof Error ? err.message : "Something went wrong")
    },
  })

  function handleCopy() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteName.trim()) return
    inviteMutation.mutate()
  }

  // Only admins can see this section
  if (!currentUser?.is_admin) return null

  return (
    <Card className="border border-border bg-surface">
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[#00e5a0]" />
          <CardTitle>Invite Team Member</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="text-sm text-text-muted">
          Generate a 48-hour invite link for a new team member. They'll set their own
          password when they open it — no account is created until they do.
        </div>

        <form onSubmit={handleSubmit}>
          <FieldSet>
            <FieldLegend>New member details</FieldLegend>
            <FieldGroup>
              {/* Name + Email side by side on wider screens */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Full name</FieldLabel>
                  <Input
                    placeholder="Enter Your Name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                    disabled={inviteMutation.isPending}
                  />
                </Field>
                <Field>
                  <FieldLabel>Email address</FieldLabel>
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    disabled={inviteMutation.isPending}
                  />
                </Field>
              </div>

              {/* Role selector */}
              <Field>
                <FieldLabel>Role</FieldLabel>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as "member" | "admin")}
                  disabled={inviteMutation.isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {inviteRole === "member"
                    ? "Can view and manage leads."
                    : "Full access + can invite others."}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldSet>

          <div className="mt-5 flex justify-end">
            <Button
              type="submit"
              className="bg-[#00e5a0] text-[#09090f] hover:bg-[#18f1ae]"
              disabled={
                inviteMutation.isPending ||
                !inviteEmail.trim() ||
                !inviteName.trim()
              }
            >
              {inviteMutation.isPending ? (
                <>
                  <span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#09090f]/30 border-t-[#09090f]" />
                  Generating…
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Generate invite link
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Error */}
        {inviteError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {inviteError}
          </div>
        )}

        {/* Success — show the link */}
        {inviteLink && (
          <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <Check className="h-4 w-4" />
              Invite link generated — expires in 48 hours
            </div>
            <p className="text-xs text-text-muted">
              Copy this link and send it to the invitee. They'll set their own password
              when they open it.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-text-muted">
                {inviteLink}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const [totalLeads, setTotalLeads]     = React.useState<number | null>(null)
  const [leadsToScore, setLeadsToScore] = React.useState<number | null>(null)
  const [statsLoading, setStatsLoading] = React.useState(true)
  const [statsError, setStatsError]     = React.useState<string | null>(null)
  const [scoreResult, setScoreResult]   = React.useState<ScoreAllResponse | null>(null)
  const [scoreError, setScoreError]     = React.useState<string | null>(null)

  const loadScoringStats = React.useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const [overview, firstPage] = await Promise.all([
        fetchJson<StatsOverviewResponse>(`${API_BASE}/api/stats/overview`),
        fetchJson<LeadsResponse>(`${API_BASE}/api/leads?limit=1`),
      ])
      const total =
        typeof overview.total_leads === "number" ? overview.total_leads : firstPage.total
      setTotalLeads(total)

      let unscoredCount = 0
      const batchSize = 100
      for (let offset = 0; offset < total; offset += batchSize) {
        const page = await fetchJson<LeadsResponse>(
          `${API_BASE}/api/leads?limit=${batchSize}&offset=${offset}`
        )
        unscoredCount += page.items.filter(
          (lead) => lead.ai_score === null || lead.ai_score === undefined
        ).length
      }
      setLeadsToScore(unscoredCount)
    } catch (error) {
      setStatsError(
        error instanceof Error ? error.message : "Unable to load lead scoring stats."
      )
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
      fetchJson<ScoreAllResponse>(`${API_BASE}/api/leads/score-all`, { method: "POST" }),
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
            <div className="text-xs text-text-muted">
              Configure API connectivity, AI lead scoring and team access
            </div>
          </div>

          {/* ── Invite card — only visible to admins ── */}
          <AdminGuard>
            <InviteTeamCard />
          </AdminGuard>

          {/* ── API Configuration (unchanged) ── */}
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

          {/* ── AI Lead Scoring (unchanged) ── */}
          <Card className="border border-border bg-surface">
            <CardHeader>
              <CardTitle>AI Lead Scoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="text-sm text-text-muted">
                Automatically score all unscored leads using AI. Scores range from 0 (poor
                fit) to 100 (perfect fit) based on headline, category, location and company.
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
                    <div className="text-xs text-text-muted">
                      Total leads available: {totalLeads}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="flex-1 bg-[#00e5a0] text-[#09090f] hover:bg-[#18f1ae]"
                  onClick={() => { scoreAllMutation.mutate() }}
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
                  Done — scored {scoreResult.scored} leads. Failed: {scoreResult.failed}.{" "}
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