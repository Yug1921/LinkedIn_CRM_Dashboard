const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"

export async function apiFetch<T>(
  path: string,
  getToken: () => Promise<string | null>,
  handleUnauthorized: () => void,
  options?: RequestInit
): Promise<T> {
  const token = await getToken()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers ? Object.fromEntries(
      options.headers instanceof Headers
        ? Array.from(options.headers.entries())
        : Array.isArray(options.headers)
          ? options.headers
          : Object.entries(options.headers)
    ) : {}),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    handleUnauthorized()
    throw new Error("Session expired — please log in again")
  }

  if (!res.ok) {
    const message = await res.text()
    throw new Error(message || `Request failed with status ${res.status}`)
  }

  return res.json() as Promise<T>
}
