"use client"

import { useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { apiFetch } from "@/lib/api-fetch"

export function useApiFetch() {
  const { getToken, handleUnauthorized } = useAuth()
  return useCallback(
    <T>(path: string, options?: RequestInit) =>
      apiFetch<T>(path, getToken, handleUnauthorized, options),
    [getToken, handleUnauthorized]
  )
}
