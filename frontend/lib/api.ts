import type { Lead, LeadCategory, LeadFilters, LeadStatus, LeadsResponse } from "@/types/lead"
import type { DraftRequest, DraftResponse, OutreachLog, StatusUpdateRequest } from "@/types/outreach"
import type { StatsOverview } from "@/types/stats"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"

const CATEGORY_TO_BACKEND: Record<LeadCategory, string[]> = {
  crypto: ["crypto_influencer", "blockchain_project", "blockchain_expert"],
  crypto_influencer: ["crypto_influencer"],
  blockchain_project: ["blockchain_project"],
  blockchain_expert: ["blockchain_expert"],
  saas: [],
  real_estate: [],
  ecom: [],
  golf_user_org: ["golf_industry"],
  golf_brand: ["golf_industry"],
  golf_industry: ["golf_industry"],
  agency: [],
  media: [],
  travel: ["travel_industry"],
  travel_user_org: ["travel_industry"],
  travel_industry: ["travel_industry"],
  fitness: [],
}

const CATEGORY_FROM_BACKEND: Record<string, LeadCategory> = {
  crypto: "crypto",
  crypto_influencer: "crypto_influencer",
  blockchain_project: "blockchain_project",
  blockchain_expert: "blockchain_expert",
  saas: "saas",
  real_estate: "real_estate",
  ecom: "ecom",
  golf_user_org: "golf_user_org",
  golf_brand: "golf_brand",
  golf_industry: "golf_brand",
  agency: "agency",
  media: "media",
  travel: "travel",
  travel_user_org: "travel_user_org",
  travel_industry: "travel",
  fitness: "fitness",
}

const STATUS_TO_FILTER: Record<LeadStatus, string> = {
  new: "new",
  engaged: "contacted",
  contacted: "contacted",
  replied: "responded",
  qualified: "qualified",
  unqualified: "disqualified",
  "do-not-contact": "disqualified",
}

const STATUS_TO_UPDATE: Record<LeadStatus, string> = {
  new: "new",
  engaged: "contacted",
  contacted: "contacted",
  replied: "replied",
  qualified: "converted",
  unqualified: "do_not_contact",
  "do-not-contact": "do_not_contact",
}

const STATUS_FROM_BACKEND: Record<string, LeadStatus> = {
  new: "new",
  contacted: "contacted",
  replied: "replied",
  responded: "replied",
  converted: "qualified",
  qualified: "qualified",
  disqualified: "unqualified",
  do_not_contact: "do-not-contact",
  "do-not-contact": "do-not-contact",
}

type BackendLead = {
  id: string
  full_name: string
  company_or_brand?: string | null
  job_title?: string | null
  bio?: string | null
  category?: string | null
  category_hint?: string | null
  status?: string | null
  country?: string | null
  city?: string | null
  region?: string | null
  linkedin_url?: string | null
  ai_score?: number | null
  ai_outreach_template?: string | null
  ai_draft_message?: string | null
  source?: string | null
  raw_data?: Record<string, unknown> | null
  created_at?: string | null
}

type BackendLeadsResponse = {
  total: number
  items: BackendLead[]
  limit: number
  offset: number
}

function mapCategory(category?: string | null): LeadCategory | null {
  if (!category) {
    return null
  }
  return CATEGORY_FROM_BACKEND[category] ?? null
}

function mapStatus(status?: string | null): LeadStatus | null {
  if (!status) {
    return null
  }
  return STATUS_FROM_BACKEND[status] ?? null
}

function mapLead(lead: BackendLead): Lead {
  const raw = lead.raw_data ?? {}
  const headline = typeof raw.headline === "string" ? raw.headline : null
  const categoryHint =
    typeof lead.category_hint === "string"
      ? lead.category_hint
      : typeof raw.category_hint === "string"
        ? raw.category_hint
        : null
  const locationParts = [lead.city, lead.country, lead.region].filter(Boolean)
  const location = locationParts.length ? locationParts.join(", ") : null
  return {
    id: lead.id,
    name: lead.full_name,
    company: lead.company_or_brand ?? null,
    title: lead.job_title ?? null,
    headline: headline ?? lead.job_title ?? null,
    location,
    linkedin_url: lead.linkedin_url ?? null,
    ai_score: lead.ai_score ?? null,
    ai_outreach_template: lead.ai_outreach_template ?? null,
    ai_draft_message: lead.ai_draft_message ?? null,
    category: mapCategory(categoryHint ?? lead.category),
    category_hint: categoryHint,
    status: mapStatus(lead.status),
    source: lead.source ?? null,
    raw_data: lead.raw_data ?? null,
    created_at: lead.created_at ?? new Date().toISOString(),
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

function buildParams(filters: LeadFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.category?.length) {
    filters.category.forEach((category) => {
      const backendCategories = CATEGORY_TO_BACKEND[category] ?? []
      backendCategories.forEach((backendCategory) => {
        params.append("category", backendCategory)
      })
    })
  }
  if (filters.status) {
    const backendStatus = STATUS_TO_FILTER[filters.status] ?? filters.status
    params.set("status", backendStatus)
  }
  if (filters.source) {
    params.set("source", filters.source)
  }
  if (filters.country) {
    params.set("country", filters.country)
  }
  if (filters.search) {
    params.set("search", filters.search)
  }
  if (filters.min_score !== undefined) {
    params.set("score_min", String(filters.min_score))
  }
  if (filters.max_score !== undefined) {
    params.set("score_max", String(filters.max_score))
  }
  if (filters.sort_by) {
    params.set("sort_by", filters.sort_by)
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit))
  }
  if (filters.offset) {
    params.set("offset", String(filters.offset))
  }

  return params
}

export const api = {
  baseUrl: API_BASE,
  async getLeads(filters: LeadFilters): Promise<LeadsResponse> {
    const params = buildParams(filters)
    const query = params.toString()
    const data = await apiFetch<BackendLeadsResponse>(`/api/leads${query ? `?${query}` : ""}`)

    return {
      total: data.total,
      items: data.items.map(mapLead),
      limit: data.limit,
      offset: data.offset,
    }
  },
  async getStatsOverview(): Promise<StatsOverview> {
    return apiFetch<StatsOverview>("/api/stats/overview")
  },
  async generateDraft(leadId: string, payload: DraftRequest): Promise<DraftResponse> {
    const response = await apiFetch<{ draft: string; tokens_used: number }>(
      `/api/leads/${leadId}/draft`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    )

    return {
      message: response.draft,
      tokens_used: response.tokens_used,
    }
  },
  getOutreachLogs(leadId: string): Promise<OutreachLog[]> {
    return apiFetch(`/api/leads/${leadId}/outreach`)
  },
  async updateStatus(leadId: string, payload: StatusUpdateRequest): Promise<Lead> {
    const backendPayload = {
      ...payload,
      status: STATUS_TO_UPDATE[payload.status] ?? payload.status,
    }
    const data = await apiFetch<BackendLead>(`/api/leads/${leadId}/status`, {
      method: "PATCH",
      body: JSON.stringify(backendPayload),
    })
    return mapLead(data)
  },
  async deleteLead(leadId: string): Promise<void> {
    await apiFetch(`/api/leads/${leadId}`, {
      method: "DELETE",
    })
  },
}
