"use client"

import * as React from "react"
import { m as motion, AnimatePresence } from "framer-motion"
import { Loader2, SendHorizonal, X } from "lucide-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { cn, initials, timeAgo } from "@/lib/utils"
import type { DraftRequest, DraftTone, OutreachLog, OutreachType } from "@/types/outreach"
import type { Lead, LeadStatus } from "@/types/lead"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { CategoryPill } from "@/components/leads/CategoryPill"
import { ScoreBadge } from "@/components/leads/ScoreBadge"
import { StatusBadge } from "@/components/leads/StatusBadge"

interface LeadDrawerProps {
  lead: Lead | null
  onClose: () => void
  onStatusChange?: () => void
}

type DrawerTab = "overview" | "history" | "draft"
type OverviewStatusOption = "new" | "contacted" | "replied" | "converted" | "do_not_contact"
type SaveState = "idle" | "saving" | "saved"
type GenerateState = "idle" | "loading" | "error"
type SendState = "idle" | "sending" | "sent"
type ManualOutreachType = "connection_request" | "direct_message" | "follow_up" | "email" | "inmail"

const MANUAL_OUTREACH_TYPES: Array<{ value: ManualOutreachType; label: string }> = [
  { value: "connection_request", label: "Connection Request" },
  { value: "direct_message", label: "Direct Message" },
  { value: "follow_up", label: "Follow-up" },
  { value: "email", label: "Email" },
  { value: "inmail", label: "InMail" },
]

const OUTREACH_TYPE_LABELS: Record<string, string> = {
  connection_request: "Connection Request",
  direct_message: "Direct Message",
  follow_up: "Follow-up",
  email: "Email",
  inmail: "InMail",
}

const CATEGORY_TONES: Record<string, { background: string; color: string }> = {
  crypto_influencer: { background: "#1D9E7520", color: "#00e5a0" },
  blockchain_project: { background: "#534AB720", color: "#9994e8" },
  blockchain_expert: { background: "#185FA520", color: "#4fa3ff" },
  golf_user_org: { background: "#f5a62320", color: "#f5a623" },
  travel_user_org: { background: "#D4537E20", color: "#D4537E" },
}

const OUTREACH_TYPES: Array<{ value: OutreachType; label: string }> = [
  { value: "connection_request", label: "Connection Request" },
  { value: "direct_message", label: "Direct Message" },
  { value: "follow_up", label: "Follow-up" },
]

const TONES: Array<{ value: DraftTone; label: string }> = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "friendly", label: "Friendly" },
]

const STATUS_OPTIONS: Array<{ value: OverviewStatusOption; label: string }> = [
  { value: "new", label: "new" },
  { value: "contacted", label: "contacted" },
  { value: "replied", label: "replied" },
  { value: "converted", label: "converted" },
  { value: "do_not_contact", label: "do_not_contact" },
]

const STATUS_TO_LEAD_STATUS: Record<OverviewStatusOption, LeadStatus> = {
  new: "new",
  contacted: "contacted",
  replied: "replied",
  converted: "qualified",
  do_not_contact: "do-not-contact",
}

const LEAD_STATUS_TO_OPTION: Record<LeadStatus, OverviewStatusOption> = {
  new: "new",
  engaged: "contacted",
  contacted: "contacted",
  replied: "replied",
  qualified: "converted",
  unqualified: "do_not_contact",
  "do-not-contact": "do_not_contact",
}

const MAX_LENGTHS: Record<OutreachType, number> = {
  connection_request: 300,
  direct_message: 500,
  follow_up: 500,
}

function getCategoryTone(category?: string | null) {
  if (!category) {
    return { background: "#252530", color: "#00e5a0" }
  }

  const tone = CATEGORY_TONES[category.trim().toLowerCase()]
  return tone ?? { background: "#252530", color: "#9494b0" }
}

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function getLeadNote(lead: Lead | null): string | null {
  if (!lead) {
    return null
  }

  const rawData = lead.raw_data ?? {}
  return (
    getStringValue((rawData as Record<string, unknown>).notes) ??
    getStringValue((rawData as Record<string, unknown>).about) ??
    getStringValue(lead.ai_outreach_template) ??
    null
  )
}

function getStatusDotColor(status: string) {
  if (status === "sent" || status === "contacted") {
    return "bg-accent"
  }

  if (status === "replied") {
    return "bg-[#4fa3ff]"
  }

  if (status === "bounced") {
    return "bg-[#ff4d6d]"
  }

  return "bg-gt-muted"
}

function formatPreview(entry: OutreachLog) {
  const text = entry.message_body ?? ""
  if (!text) {
    return "No message body"
  }

  return text.length > 120 ? `${text.slice(0, 120).trimEnd()}...` : text
}

function getOutreachTypeLabel(type?: string | null) {
  if (!type) {
    return "Unknown"
  }

  return OUTREACH_TYPE_LABELS[type] ?? type.replace(/_/g, " ")
}

function getOutreachStatusBadgeProps(status: string): {
  variant: React.ComponentProps<typeof Badge>["variant"]
  className: string
} {
  if (status === "sent" || status === "contacted") {
    return {
      variant: "status-contacted",
      className: "h-5 border border-transparent px-2 py-0.5 text-[10px] font-medium",
    }
  }

  if (status === "replied") {
    return {
      variant: "status-replied",
      className: "h-5 border border-transparent px-2 py-0.5 text-[10px] font-medium",
    }
  }

  if (status === "bounced") {
    return {
      variant: "destructive",
      className: "h-5 border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-500",
    }
  }

  return {
    variant: "outline",
    className: "h-5 border-border bg-surface2 px-2 py-0.5 text-[10px] font-medium text-gt-dim",
  }
}

function formatStatusLabel(status: string) {
  return status
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 border-b border-white/5 py-2 last:border-b-0">
      <div className="text-xs uppercase tracking-[0.18em] text-[#55556a]">{label}</div>
      <div className="min-w-0 text-sm text-white/90">{children}</div>
    </div>
  )
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-b-2 px-1 py-3 text-sm font-medium transition-colors",
        active ? "border-[#00e5a0] text-[#00e5a0]" : "border-transparent text-[#55556a] hover:text-white"
      )}
    >
      {children}
    </button>
  )
}

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-[#00e5a0] bg-[#00e5a020] text-[#00e5a0]"
          : "border-[#252530] bg-[#18181f] text-[#77778f] hover:bg-[#202028]"
      )}
    >
      {children}
    </button>
  )
}

function TimelineItem({ entry, isLast }: { entry: OutreachLog; isLast: boolean }) {
  const statusBadgeProps = getOutreachStatusBadgeProps(entry.status)

  return (
    <div className="flex gap-3">
      <div className="flex w-4 flex-col items-center py-1">
        <span className={cn("size-2 rounded-full", getStatusDotColor(entry.status))} />
        {!isLast ? <span className="mt-1 h-full w-0.5 flex-1 bg-border" /> : null}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-border bg-surface2 px-2 py-0.5 text-[10px] font-medium text-gt-dim">
            {getOutreachTypeLabel(entry.outreach_type)}
          </Badge>
          {entry.ai_generated ? (
            <Badge variant="outline" className="border-[#00e5a030] bg-[#00e5a020] px-2 py-0.5 text-[10px] font-medium text-[#00e5a0]">
              AI
            </Badge>
          ) : null}
          <span className="ml-auto text-xs text-gt-dim">{timeAgo(entry.sent_at ?? entry.created_at)}</span>
        </div>
        <div className="mt-2 text-xs leading-5 text-gt-dim">{formatPreview(entry)}</div>
        <div className="mt-2">
          <Badge variant={statusBadgeProps.variant} className={statusBadgeProps.className}>
            {formatStatusLabel(entry.status)}
          </Badge>
        </div>
      </div>
    </div>
  )
}

export function LeadDrawer({ lead, onClose, onStatusChange }: LeadDrawerProps) {
  const [activeTab, setActiveTab] = React.useState<DrawerTab>("overview")
  const [selectedStatus, setSelectedStatus] = React.useState<OverviewStatusOption>("new")
  const [statusSaveState, setStatusSaveState] = React.useState<SaveState>("idle")
  const [outreachType, setOutreachType] = React.useState<OutreachType>("connection_request")
  const [tone, setTone] = React.useState<DraftTone>("professional")
  const [customNote, setCustomNote] = React.useState("")
  const [draft, setDraft] = React.useState("")
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [generateState, setGenerateState] = React.useState<GenerateState>("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [tokenCount, setTokenCount] = React.useState(0)
  const [hasGeneratedDraft, setHasGeneratedDraft] = React.useState(false)
  const [copyState, setCopyState] = React.useState(false)
  const [sendState, setSendState] = React.useState<SendState>("idle")
  const [manualOutreachOpen, setManualOutreachOpen] = React.useState(false)
  const [manualOutreachType, setManualOutreachType] = React.useState<ManualOutreachType>("connection_request")
  const [manualOutreachMessage, setManualOutreachMessage] = React.useState("")
  const [manualOutreachError, setManualOutreachError] = React.useState<string | null>(null)
  const saveTimeoutRef = React.useRef<number | null>(null)
  const copyTimeoutRef = React.useRef<number | null>(null)
  const sendTimeoutRef = React.useRef<number | null>(null)
  const leadId = lead?.id ?? ""
  const leadStatus = lead?.status ?? "new"

  const categoryTone = React.useMemo(() => getCategoryTone(lead?.category_hint ?? lead?.category), [
    lead?.category,
    lead?.category_hint,
  ])

  const noteText = React.useMemo(() => getLeadNote(lead), [lead])
  const currentMaxLength = MAX_LENGTHS[outreachType]

  const {
    data: logs,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["outreach", lead?.id],
    queryFn: () => api.getOutreachLogs(lead!.id),
    enabled: !!lead?.id && activeTab === "history",
    staleTime: 30_000,
  })

  const createManualOutreach = useMutation({
    mutationFn: async (payload: {
      outreach_type: ManualOutreachType
      message_body: string | null
      ai_generated: false
      status: "sent"
      channel: "linkedin"
    }) => {
      if (!lead?.id) {
        throw new Error("Missing lead id")
      }

      const response = await fetch(`${api.baseUrl}/api/leads/${lead.id}/outreach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || "Failed to save outreach log")
      }
    },
    onSuccess: () => {
      setManualOutreachOpen(false)
      setManualOutreachMessage("")
      setManualOutreachType("connection_request")
      setManualOutreachError(null)
      void refetch()
    },
    onError: (error) => {
      setManualOutreachError(error instanceof Error ? error.message : "Failed to save outreach log")
    },
  })

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    if (!leadId) {
      return undefined
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [leadId, onClose])

  React.useEffect(() => {
    if (!leadId) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [leadId])

  React.useEffect(() => {
    if (!leadId) {
      setActiveTab("overview")
      setSelectedStatus("new")
      setStatusSaveState("idle")
      setOutreachType("connection_request")
      setTone("professional")
      setCustomNote("")
      setDraft("")
      setGenerateState("idle")
      setError(null)
      setTokenCount(0)
      setHasGeneratedDraft(false)
      setCopyState(false)
      setSendState("idle")
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = null
      }
      if (sendTimeoutRef.current) {
        window.clearTimeout(sendTimeoutRef.current)
        sendTimeoutRef.current = null
      }
      return
    }

    setActiveTab("overview")
    setSelectedStatus(LEAD_STATUS_TO_OPTION[leadStatus as LeadStatus])
    setStatusSaveState("idle")
    setOutreachType("connection_request")
    setTone("professional")
    setCustomNote("")
    setDraft("")
    setGenerateState("idle")
    setError(null)
    setTokenCount(0)
    setHasGeneratedDraft(false)
    setCopyState(false)
    setSendState("idle")
    setManualOutreachOpen(false)
    setManualOutreachType("connection_request")
    setManualOutreachMessage("")
    setManualOutreachError(null)

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = null
    }
    if (sendTimeoutRef.current) {
      window.clearTimeout(sendTimeoutRef.current)
      sendTimeoutRef.current = null
    }
  }, [leadId, leadStatus])

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current)
      }
      if (sendTimeoutRef.current) {
        window.clearTimeout(sendTimeoutRef.current)
      }
    }
  }, [])

  const saveStatus = async (nextValue: OverviewStatusOption) => {
    if (!lead) {
      return
    }

    const previousValue = selectedStatus
    setSelectedStatus(nextValue)
    setStatusSaveState("saving")

    try {
      await api.updateStatus(lead.id, {
        status: STATUS_TO_LEAD_STATUS[nextValue],
      })
      setStatusSaveState("saved")
      onStatusChange?.()

      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        setStatusSaveState("idle")
      }, 2000)
    } catch (updateError) {
      setSelectedStatus(previousValue)
      setStatusSaveState("idle")
      toast.error("Failed to update status", { description: String(updateError) })
    }
  }

  const generateDraft = async () => {
    if (!lead) {
      return
    }

    setIsGenerating(true)
    setGenerateState("loading")
    setError(null)

    try {
      const response = await api.generateDraft(lead.id, {
        outreach_type: outreachType,
        tone,
        custom_note: customNote.trim() || undefined,
      } satisfies DraftRequest)

      setDraft(response.message)
      setTokenCount(response.tokens_used)
      setHasGeneratedDraft(true)
      setGenerateState("idle")
    } catch {
      setDraft("")
      setHasGeneratedDraft(false)
      setGenerateState("error")
      setError("Generation failed — check OpenRouter API key in settings.")
    } finally {
      setIsGenerating(false)
    }
  }

  const copyDraft = async () => {
    if (!draft) {
      return
    }

    await navigator.clipboard.writeText(draft)
    setCopyState(true)

    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current)
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopyState(false)
    }, 2000)
  }

  const markAsSent = async () => {
    if (!lead) {
      return
    }

    setSendState("sending")

    try {
      await api.updateStatus(lead.id, { status: "contacted" })
      onStatusChange?.()
      setSendState("sent")
      toast.success("Marked as sent")

      if (sendTimeoutRef.current) {
        window.clearTimeout(sendTimeoutRef.current)
      }
      sendTimeoutRef.current = window.setTimeout(() => {
        setSendState("idle")
      }, 2000)
    } catch (sendError) {
      setSendState("idle")
      toast.error("Failed to mark as sent", { description: String(sendError) })
    }
  }

  return (
    <AnimatePresence>
      {lead ? (
        <>
          <motion.div
            key="lead-drawer-overlay"
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={onClose}
          />
          <motion.aside
            key="lead-drawer"
            className="fixed top-0 right-0 z-50 flex h-full w-[480px] flex-col border-l border-[#252530] bg-[#111118] text-white shadow-[0_0_40px_rgba(0,0,0,0.35)]"
            initial={{ x: 480, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 480, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-12 items-center justify-between border-b border-white/5 px-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-8 shrink-0 border border-white/10">
                  <AvatarFallback
                    className="text-[11px] font-semibold uppercase"
                    style={{
                      backgroundColor: categoryTone.background,
                      color: categoryTone.color,
                    }}
                  >
                    {initials(lead.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{lead.name}</div>
                  <div className="truncate text-xs text-[#9494b0]">
                    {lead.headline ?? lead.title ?? "No headline"}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-[#9494b0] hover:text-white"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex gap-6 border-b border-white/5 px-4">
              <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</TabButton>
              <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>Outreach History</TabButton>
              <TabButton active={activeTab === "draft"} onClick={() => setActiveTab("draft")}>AI Draft</TabButton>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {activeTab === "overview" ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <div className="grid gap-1">
                      <FieldRow label="Full name">{lead.name}</FieldRow>
                      <FieldRow label="Headline">{lead.headline ?? lead.title ?? "-"}</FieldRow>
                      <FieldRow label="Location">{lead.location ?? "-"}</FieldRow>
                      <FieldRow label="Company">{lead.company ?? "-"}</FieldRow>
                      <FieldRow label="Category">
                        <CategoryPill
                          category={lead.category ?? undefined}
                          categoryHint={lead.category_hint ?? undefined}
                        />
                      </FieldRow>
                      <FieldRow label="Score">
                        <ScoreBadge score={lead.ai_score} />
                      </FieldRow>
                      <FieldRow label="Status">
                        <StatusBadge status={lead.status ?? undefined} />
                      </FieldRow>
                      <FieldRow label="Source">{lead.source ?? "-"}</FieldRow>
                      <FieldRow label="LinkedIn URL">
                        {lead.linkedin_url ? (
                          <a
                            href={lead.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[#00e5a0] hover:underline"
                          >
                            <span className="truncate">Open profile</span>
                          </a>
                        ) : (
                          "-"
                        )}
                      </FieldRow>
                      <FieldRow label="Captured">{timeAgo(lead.created_at)}</FieldRow>
                    </div>

                    <div className="mt-4 border-t border-white/5 pt-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#55556a]">Notes / About</div>
                      <div className="mt-2 rounded-xl border border-white/5 bg-[#0c0c12] p-3 text-sm leading-6 text-white/85">
                        {noteText ? noteText : <span className="text-[#77778f]">No notes available.</span>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">Update status</div>
                        <div className="text-xs text-[#9494b0]">Save changes directly from the drawer.</div>
                      </div>
                      {statusSaveState === "saving" ? (
                        <span className="text-xs text-[#9494b0]">Saving...</span>
                      ) : statusSaveState === "saved" ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                          ✓ Saved
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#55556a]">
                        Change status →
                      </span>
                      <Select
                        value={selectedStatus}
                        onValueChange={(value) => {
                          void saveStatus(value as OverviewStatusOption)
                        }}
                        disabled={statusSaveState === "saving"}
                      >
                        <SelectTrigger className="min-w-44 border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.05]">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "history" ? (
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    Outreach history
                  </div>

                  {isLoading ? (
                    <div className="mt-4 space-y-4">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                          <Skeleton className="size-8 rounded-full bg-white/15" />
                          <div className="flex-1 space-y-2 pt-0.5">
                            <Skeleton className="h-3.5 w-32 bg-white/15" />
                            <Skeleton className="h-3 w-4/5 bg-white/10" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : isError ? (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface2 px-4 py-3">
                      <div className="text-xs text-gt-dim">Could not load outreach history</div>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void refetch()}>
                        Retry
                      </Button>
                    </div>
                  ) : logs?.length ? (
                    <div className="mt-4">
                      {logs.map((entry, index) => (
                        <TimelineItem
                          key={entry.id}
                          entry={entry}
                          isLast={index === logs.length - 1}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-6 flex flex-col items-center justify-center gap-2 py-8 text-center text-gt-dim">
                      <SendHorizonal className="size-4 text-gt-muted" />
                      <div className="text-sm text-gt-dim">No outreach logged yet</div>
                      <div className="max-w-64 text-xs text-gt-dim">
                        Generate and send a draft from the AI Draft tab to log activity here.
                      </div>
                    </div>
                  )}

                  <div className="mt-4 space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 w-full border-border bg-transparent text-xs text-gt-dim hover:bg-surface2 hover:text-foreground"
                      onClick={() => {
                        setManualOutreachOpen(true)
                        setManualOutreachError(null)
                      }}
                    >
                      + Log manual outreach
                    </Button>

                    {manualOutreachOpen ? (
                      <div className="space-y-3 rounded-2xl border border-border bg-surface2 p-3">
                        <Select
                          value={manualOutreachType}
                          onValueChange={(value) => setManualOutreachType(value as ManualOutreachType)}
                        >
                          <SelectTrigger className="h-8 border-border bg-background text-xs text-foreground">
                            <SelectValue placeholder="Outreach type" />
                          </SelectTrigger>
                          <SelectContent>
                            {MANUAL_OUTREACH_TYPES.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Textarea
                          value={manualOutreachMessage}
                          onChange={(event) => setManualOutreachMessage(event.target.value)}
                          rows={3}
                          placeholder="Optional message body"
                          className="border-border bg-background text-sm text-foreground placeholder:text-gt-muted"
                        />

                        {manualOutreachError ? (
                          <div className="text-xs text-rose-500">{manualOutreachError}</div>
                        ) : null}

                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            disabled={createManualOutreach.isPending}
                            onClick={() => {
                              setManualOutreachError(null)
                              createManualOutreach.mutate({
                                outreach_type: manualOutreachType,
                                message_body: manualOutreachMessage.trim() ? manualOutreachMessage.trim() : null,
                                ai_generated: false,
                                status: "sent",
                                channel: "linkedin",
                              })
                            }}
                          >
                            Save
                          </Button>
                          <button
                            type="button"
                            className="text-xs text-gt-dim underline underline-offset-4 hover:text-foreground"
                            onClick={() => {
                              setManualOutreachOpen(false)
                              setManualOutreachError(null)
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeTab === "draft" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 text-xs uppercase tracking-[0.18em] text-[#55556a]">Outreach type</div>
                        <div className="flex flex-wrap gap-2">
                          {OUTREACH_TYPES.map((option) => (
                            <ToggleButton
                              key={option.value}
                              active={outreachType === option.value}
                              onClick={() => setOutreachType(option.value)}
                            >
                              {option.label}
                            </ToggleButton>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-xs uppercase tracking-[0.18em] text-[#55556a]">Tone</div>
                        <div className="flex flex-wrap gap-2">
                          {TONES.map((option) => (
                            <ToggleButton
                              key={option.value}
                              active={tone === option.value}
                              onClick={() => setTone(option.value)}
                            >
                              {option.label}
                            </ToggleButton>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-xs uppercase tracking-[0.18em] text-[#55556a]">Optional custom note</div>
                        <Textarea
                          value={customNote}
                          onChange={(event) => setCustomNote(event.target.value)}
                          placeholder="Add context (optional) — e.g. saw your post about X"
                          rows={3}
                          className="border-[#252530] bg-[#18181f] text-white placeholder:text-[#55556a]"
                        />
                      </div>

                      <div>
                        <Button
                          type="button"
                          onClick={() => {
                            void generateDraft()
                          }}
                          disabled={isGenerating}
                          className="w-full bg-[#00e5a0] text-[#09090f] hover:bg-[#18f1ae]"
                        >
                          {isGenerating ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="size-4 animate-spin" />
                              Generating...
                            </span>
                          ) : (
                            "Generate Draft"
                          )}
                        </Button>
                        {generateState === "error" && error ? (
                          <div className="mt-2 text-sm text-[#ff5b6e]">{error}</div>
                        ) : null}
                      </div>

                      {hasGeneratedDraft ? (
                        <div className="space-y-3">
                          <div className="relative">
                            <Textarea
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              minLength={6}
                              rows={6}
                              maxLength={currentMaxLength}
                              className="min-h-[160px] border-[#252530] bg-[#18181f] text-white placeholder:text-[#55556a]"
                            />
                            <div className="pointer-events-none absolute right-3 bottom-2 text-xs text-[#77778f]">
                              {draft.length} / {currentMaxLength}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                void copyDraft()
                              }}
                              className="border-[#252530] bg-[#18181f] text-white hover:bg-[#202028]"
                            >
                              {copyState ? "✓ Copied!" : "Copy to clipboard"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                void markAsSent()
                              }}
                              disabled={sendState === "sending"}
                              className="border-[#252530] bg-[#18181f] text-white hover:bg-[#202028]"
                            >
                              {sendState === "sending" ? (
                                "Marking..."
                              ) : sendState === "sent" ? (
                                "✓ Sent"
                              ) : (
                                "Mark as Sent"
                              )}
                            </Button>
                          </div>

                          <div className="text-xs text-[#9494b0]">Tokens used: {tokenCount}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}

export default LeadDrawer
