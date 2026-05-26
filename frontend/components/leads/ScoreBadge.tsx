import { Badge } from "@/components/ui/badge"
import { scoreVariant, scoreColor } from "@/lib/utils"

export function ScoreBadge({ score }: { score?: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-text-muted">-</span>
  }

  const rounded = Math.round(score)
  const colors = scoreColor(rounded)

  return (
    <Badge
      variant={scoreVariant(rounded)}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: colors.border,
        fontFamily: "'Space Mono', monospace",
      }}
    >
      {rounded}
    </Badge>
  )
}
