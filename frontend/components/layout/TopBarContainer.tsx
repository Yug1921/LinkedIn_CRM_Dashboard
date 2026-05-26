"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { TopBar } from "@/components/layout/TopBar"

export function TopBarContainer() {
  const { data } = useQuery({
    queryKey: ["stats"],
    queryFn: api.getStatsOverview,
    staleTime: 5000,
  })

  return <TopBar capturedToday={data?.captured_today ?? 0} />
}
