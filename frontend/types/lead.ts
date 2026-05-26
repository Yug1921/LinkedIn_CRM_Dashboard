export type LeadCategory =
  | "crypto"
  | "crypto_influencer"
  | "blockchain_project"
  | "blockchain_expert"
  | "saas"
  | "real_estate"
  | "ecom"
  | "golf_user_org"
  | "golf_brand"
  | "golf_industry"
  | "agency"
  | "media"
  | "travel"
  | "travel_user_org"
  | "travel_industry"
  | "fitness"

export type LeadStatus =
  | "new"
  | "engaged"
  | "contacted"
  | "replied"
  | "qualified"
  | "unqualified"
  | "do-not-contact"

export interface Lead {
  id: string
  name: string
  company?: string | null
  title?: string | null
  headline?: string | null
  location?: string | null
  linkedin_url?: string | null
  ai_score?: number | null
  ai_outreach_template?: string | null
  ai_draft_message?: string | null
  category?: LeadCategory | null
  category_hint?: string | null
  status?: LeadStatus | null
  source?: string | null
  raw_data?: Record<string, unknown> | null
  created_at: string
}

export interface LeadFilters {
  limit?: number
  offset?: number
  sort_by?: string
  status?: LeadStatus
  category?: LeadCategory[]
  source?: string
  country?: string
  search?: string
  min_score?: number
  max_score?: number
}

export interface LeadsResponse {
  total: number
  items: Lead[]
  limit: number
  offset: number
}
