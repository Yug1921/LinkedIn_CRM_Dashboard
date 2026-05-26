import { formatDistanceToNowStrict } from "date-fns"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { LeadStatus } from "@/types/lead"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(value?: string | null): string {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "-"
  }
  const seconds = (Date.now() - date.getTime()) / 1000
  if (seconds < 60) {
    return "just now"
  }
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

export function categoryLabel(category?: string | null): string {
  switch (category) {
    case "crypto":
      return "Crypto"
    case "crypto_influencer":
      return "Crypto Influencer"
    case "blockchain_project":
      return "Blockchain Project"
    case "blockchain_expert":
      return "Blockchain Expert"
    case "saas":
      return "SaaS"
    case "real_estate":
      return "Real Estate"
    case "ecom":
      return "Ecom"
    case "golf_user_org":
      return "Golf User / Org"
    case "golf_brand":
    case "golf_industry":
      return "Golf Brand"
    case "travel_user_org":
      return "Travel User / Org"
    case "travel_industry":
      return "Travel"
    case "agency":
      return "Agency"
    case "media":
      return "Media"
    case "travel":
      return "Travel"
    case "fitness":
      return "Fitness"
    default:
      return "Uncategorized"
  }
}

export function statusLabel(status?: LeadStatus | null): string {
  switch (status) {
    case "new":
      return "New"
    case "engaged":
      return "Engaged"
    case "contacted":
      return "Contacted"
    case "replied":
      return "Replied"
    case "qualified":
      return "Qualified"
    case "unqualified":
      return "Unqualified"
    case "do-not-contact":
      return "Do not contact"
    default:
      return "Unknown"
  }
}

export function scoreVariant(score?: number | null): "score-low" | "score-medium" | "score-high" {
  if (score === null || score === undefined) {
    return "score-low"
  }
  if (score >= 70) {
    return "score-high"
  }
  if (score >= 40) {
    return "score-medium"
  }
  return "score-low"
}

export function scoreColor(score?: number | null): { bg: string; text: string; border: string } {
  if (score === null || score === undefined) {
    return { bg: "transparent", text: "#55556a", border: "transparent" }
  }
  if (score >= 70) {
    return { bg: "#00e5a020", text: "#00e5a0", border: "#00e5a030" }
  }
  if (score >= 40) {
    return { bg: "#f5a62320", text: "#f5a623", border: "#f5a62330" }
  }
  return { bg: "#ff4d6d20", text: "#ff4d6d", border: "#ff4d6d30" }
}

export function initials(name?: string | null): string {
  if (!name) {
    return "?"
  }
  const parts = name.trim().split(" ").filter(Boolean)
  if (parts.length === 0) {
    return "?"
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}
