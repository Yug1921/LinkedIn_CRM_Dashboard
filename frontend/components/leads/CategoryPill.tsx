"use client"

interface Props {
  category: string | null | undefined
  categoryHint?: string | null | undefined
}

const CATEGORY_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  crypto_influencer: { label: "🪙 Crypto", bg: "#1D9E7520", text: "#00e5a0", border: "#00e5a030" },
  blockchain_project: { label: "🔷 Blockchain", bg: "#534AB720", text: "#9994e8", border: "#534AB730" },
  blockchain_expert: { label: "🔐 Blockchain Expert", bg: "#185FA520", text: "#4fa3ff", border: "#185FA530" },
  golf_user_org: { label: "⛳ Golf", bg: "#f5a62320", text: "#f5a623", border: "#f5a62330" },
  travel_user_org: { label: "✈️ Travel", bg: "#D4537E20", text: "#D4537E", border: "#D4537E30" },
}

export function CategoryPill({ category, categoryHint }: Props) {
  const displayCategory = categoryHint ?? category

  if (!displayCategory) {
    return (
      <span
        style={{
          background: "#25253020",
          color: "#55556a",
          border: "1px solid #25253040",
          borderRadius: 20,
          padding: "2px 8px",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.4px",
          whiteSpace: "nowrap",
        }}
      >
        Unknown
      </span>
    )
  }

  const key = displayCategory.trim().toLowerCase()
  const config = CATEGORY_MAP[key]

  if (!config) {
    return (
      <span
        style={{
          background: "#25253020",
          color: "#9494b0",
          border: "1px solid #25253040",
          borderRadius: 20,
          padding: "2px 8px",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.4px",
          whiteSpace: "nowrap",
        }}
      >
        {displayCategory}
      </span>
    )
  }

  return (
    <span
      style={{
        background: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        borderRadius: 20,
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.4px",
        whiteSpace: "nowrap",
      }}
    >
      {config.label}
    </span>
  )
}

export default CategoryPill
