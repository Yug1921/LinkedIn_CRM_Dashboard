"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ExternalLink,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
} from "lucide-react"

import type { Lead, LeadStatus } from "@/types/lead"
import type { DraftRequest, OutreachType } from "@/types/outreach"
import { api } from "@/lib/api"
import { initials, timeAgo } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { CategoryPill } from "@/components/leads/CategoryPill"
import { ScoreBadge } from "@/components/leads/ScoreBadge"
import { StatusBadge } from "@/components/leads/StatusBadge"

const STATUS_ACTIONS: Array<{ label: string; value: LeadStatus }> = [
  { label: "Mark engaged", value: "engaged" },
  { label: "Mark contacted", value: "contacted" },
  { label: "Mark replied", value: "replied" },
  { label: "Mark qualified", value: "qualified" },
  { label: "Mark unqualified", value: "unqualified" },
  { label: "Do not contact", value: "do-not-contact" },
]

const DRAFT_ACTIONS: Array<{ label: string; outreachType: OutreachType }> = [
  { label: "Connection request", outreachType: "connection_request" },
  { label: "Direct message", outreachType: "direct_message" },
  { label: "Follow up", outreachType: "follow_up" },
]

type LeadTableProps = {
  leads: Lead[]
  totalCount: number
  limit: number
  currentPage: number
  onPageChange: (page: number) => void
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  onLeadClick: (lead: Lead) => void
}

export function LeadTable({
  leads,
  totalCount,
  limit,
  currentPage,
  onPageChange,
  isLoading,
  isError,
  onRetry,
  onLeadClick,
}: LeadTableProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})

  const updateStatus = useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: LeadStatus }) =>
      api.updateStatus(leadId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast.success("Status updated")
    },
    onError: (error) => {
      toast.error("Failed to update status", { description: String(error) })
    },
  })

  const generateDraft = useMutation({
    mutationFn: ({ leadId, payload }: { leadId: string; payload: DraftRequest }) =>
      api.generateDraft(leadId, payload),
    onSuccess: (data) => {
      toast.success("Draft generated", {
        description: `${data.tokens_used} tokens used`,
      })
    },
    onError: (error) => {
      toast.error("Draft failed", { description: String(error) })
    },
  })

  const totalPages = Math.ceil(totalCount / limit)

  const pageNumbers = React.useMemo(() => {
    const pages: number[] = []
    const start = Math.max(1, currentPage - 2)
    const end = Math.min(totalPages, start + 4)
    for (let page = start; page <= end; page += 1) {
      pages.push(page)
    }
    return pages
  }, [currentPage, totalPages])

  function handlePageChange(page: number) {
    if (page < 1 || page > totalPages) return
    onPageChange(page)
  }

  const allSelected = leads.length > 0 && leads.every((lead) => selected[lead.id])
  const selectedCount = Object.values(selected).filter(Boolean).length

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelected({})
      return
    }
    const next: Record<string, boolean> = {}
    leads.forEach((lead) => {
      next[lead.id] = true
    })
    setSelected(next)
  }

  const toggleOne = (leadId: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [leadId]: checked }))
  }

  const exportCsv = () => {
    if (!leads.length) {
      toast.message("No leads to export")
      return
    }
    const headers = [
      "Name",
      "Company",
      "Title",
      "Category",
      "Status",
      "Score",
      "Source",
      "Location",
      "Created",
    ]
    const rows = leads.map((lead) => [
      lead.name,
      lead.company ?? "",
      lead.title ?? "",
      lead.category ?? "",
      lead.status ?? "",
      lead.ai_score ?? "",
      lead.source ?? "",
      lead.location ?? "",
      lead.created_at,
    ])
    const escapeValue = (value: string | number | null | undefined) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeValue).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (isError) {
    return (
      <Empty className="border border-border bg-surface">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sparkles className="size-4" />
          </EmptyMedia>
          <EmptyTitle>Unable to load leads</EmptyTitle>
          <EmptyDescription>Check your API connection and try again.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onRetry}>Retry</Button>
        </EmptyContent>
      </Empty>
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (!leads.length) {
    return (
      <Empty className="border border-border bg-surface">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sparkles className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No leads yet</EmptyTitle>
          <EmptyDescription>When new leads arrive, they will show up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{totalCount} leads</span>
          {selectedCount ? <Badge variant="secondary">{selectedCount} selected</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["leads"] })}
            style={{ backgroundColor: "var(--gt-accent)", color: "hsl(var(--primary-foreground))", borderColor: "var(--gt-accent-bdr)" }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={(value) => toggleAll(Boolean(value))} />
            </TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow
              key={lead.id}
              data-state={selected[lead.id] ? "selected" : undefined}
              className="cursor-pointer"
              style={{ cursor: "pointer" }}
              onClick={() => onLeadClick(lead)}
            >
              <TableCell>
                <Checkbox
                  checked={Boolean(selected[lead.id])}
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={(value) => toggleOne(lead.id, Boolean(value))}
                />
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-[var(--accent-dim)] text-[var(--gt-accent)]">
                      {initials(lead.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text">{lead.name}</span>
                    <span className="text-xs text-text-muted">
                      {lead.title ?? "Role"}
                      {lead.company ? ` - ${lead.company}` : ""}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <CategoryPill
                  category={lead.category ?? undefined}
                  categoryHint={lead.category_hint ?? undefined}
                />
              </TableCell>
              <TableCell>
                <StatusBadge status={lead.status ?? undefined} />
              </TableCell>
              <TableCell>
                <ScoreBadge score={lead.ai_score} />
              </TableCell>
              <TableCell className="text-xs text-text-muted">
                {lead.source ?? "-"}
              </TableCell>
              <TableCell className="text-xs text-text-muted">
                {lead.location ?? "-"}
              </TableCell>
              <TableCell className="text-xs text-text-muted">
                {timeAgo(lead.created_at)}
              </TableCell>
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={(event) => event.stopPropagation()}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {lead.linkedin_url ? (
                      <DropdownMenuItem asChild>
                        <a href={lead.linkedin_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" />
                          Open LinkedIn
                        </a>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    {DRAFT_ACTIONS.map((action) => (
                      <DropdownMenuItem
                        key={action.outreachType}
                        onClick={() =>
                          generateDraft.mutate({
                            leadId: lead.id,
                            payload: { outreach_type: action.outreachType, tone: "professional" },
                          })
                        }
                      >
                        <MessageSquare className="size-4" />
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    {STATUS_ACTIONS.map((action) => (
                      <DropdownMenuItem
                        key={action.value}
                        onClick={() => updateStatus.mutate({ leadId: lead.id, status: action.value })}
                      >
                        <Mail className="size-4" />
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1 text-xs text-text-muted">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <span>
            Showing {totalCount ? (currentPage - 1) * limit + 1 : 0}–{Math.min(currentPage * limit, totalCount)} of {totalCount} leads
          </span>
        </div>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="ghost"
                size="default"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
            </PaginationItem>
            {pageNumbers[0] && pageNumbers[0] > 1 ? (
              <PaginationItem>
                <Button variant="ghost" size="icon" onClick={() => handlePageChange(1)}>
                  1
                </Button>
              </PaginationItem>
            ) : null}
            {pageNumbers[0] && pageNumbers[0] > 2 ? (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            ) : null}
            {pageNumbers.map((page) => (
              <PaginationItem key={page}>
                <Button
                  variant={page === currentPage ? "outline" : "ghost"}
                  size="icon"
                  onClick={() => handlePageChange(page)}
                  aria-current={page === currentPage ? "page" : undefined}
                >
                  {page}
                </Button>
              </PaginationItem>
            ))}
            {pageNumbers[pageNumbers.length - 1] && pageNumbers[pageNumbers.length - 1] < totalPages - 1 ? (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            ) : null}
            {pageNumbers[pageNumbers.length - 1] && pageNumbers[pageNumbers.length - 1] < totalPages ? (
              <PaginationItem>
                <Button variant="ghost" size="icon" onClick={() => handlePageChange(totalPages)}>
                  {totalPages}
                </Button>
              </PaginationItem>
            ) : null}
            <PaginationItem>
              <Button
                variant="ghost"
                size="default"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
