import { Badge } from "@/components/ui/badge"
import { statusLabel } from "@/lib/utils"
import type { LeadStatus } from "@/types/lead"

const STATUS_VARIANTS: Record<LeadStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  new: "status-new",
  engaged: "status-engaged",
  contacted: "status-contacted",
  replied: "status-replied",
  qualified: "status-qualified",
  unqualified: "status-unqualified",
  "do-not-contact": "status-do-not-contact",
}

export function StatusBadge({ status }: { status?: LeadStatus | null }) {
  if (!status) {
    return <Badge variant="status-new">New</Badge>
  }

  return <Badge variant={STATUS_VARIANTS[status]}>{statusLabel(status)}</Badge>
}
