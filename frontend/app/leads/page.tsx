import { Suspense } from "react"

import LeadsPageClient from "./LeadsPageClient"

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsPageClient />
    </Suspense>
  )
}
