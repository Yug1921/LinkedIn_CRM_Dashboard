import type { LeadStatus } from "@/types/lead"

export type OutreachType = "connection_request" | "direct_message" | "follow_up"
export type DraftTone = "professional" | "casual" | "friendly"

export interface DraftResponse {
  message: string
  tokens_used: number
}

export interface DraftRequest {
  outreach_type: OutreachType
  tone?: DraftTone
  custom_note?: string
}

export interface StatusUpdateRequest {
  status: LeadStatus
}

export interface OutreachLog {
  id: string
  lead_id: string
  outreach_type: OutreachType
  channel: string
  status: string
  message_body: string | null
  ai_generated: boolean
  sent_at: string | null
  opened_at?: string | null
  replied_at?: string | null
  reply_content?: string | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}
