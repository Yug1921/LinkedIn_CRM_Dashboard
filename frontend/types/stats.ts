export interface TopLocation {
  location: string
  count: number
}

export interface CaptureRatePoint {
  date: string
  count: number
}

export interface StatsOverview {
  total_leads: number
  captured_today: number
  capture_rate_7d: CaptureRatePoint[]
  by_category: Record<string, number>
  by_status: Record<string, number>
  top_locations: TopLocation[]
  reply_rate: number
}
