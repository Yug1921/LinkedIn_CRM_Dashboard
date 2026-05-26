import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        "category-crypto":
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300 uppercase tracking-[0.6px] text-[10px]",
        "category-crypto-influencer":
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300 uppercase tracking-[0.6px] text-[10px]",
        "category-blockchain-project":
          "border-violet-500/30 bg-violet-500/10 text-violet-500 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300 uppercase tracking-[0.6px] text-[10px]",
        "category-blockchain-expert":
          "border-sky-500/30 bg-sky-500/10 text-sky-500 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300 uppercase tracking-[0.6px] text-[10px]",
        "category-saas":
          "border-blue-500/30 bg-blue-500/10 text-blue-500 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300 uppercase tracking-[0.6px] text-[10px]",
        "category-real-estate":
          "border-cyan-500/30 bg-cyan-500/10 text-cyan-500 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300 uppercase tracking-[0.6px] text-[10px]",
        "category-ecom":
          "border-orange-500/30 bg-orange-500/10 text-orange-500 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-300 uppercase tracking-[0.6px] text-[10px]",
        "category-golf-user-org":
          "border-amber-500/30 bg-amber-500/10 text-amber-500 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300 uppercase tracking-[0.6px] text-[10px]",
        "category-golf-brand":
          "border-lime-500/30 bg-lime-500/10 text-lime-600 dark:border-lime-400/30 dark:bg-lime-400/10 dark:text-lime-300 uppercase tracking-[0.6px] text-[10px]",
        "category-travel-user-org":
          "border-rose-500/30 bg-rose-500/10 text-rose-500 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300 uppercase tracking-[0.6px] text-[10px]",
        "category-agency":
          "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-500 dark:border-fuchsia-400/30 dark:bg-fuchsia-400/10 dark:text-fuchsia-300 uppercase tracking-[0.6px] text-[10px]",
        "category-media":
          "border-indigo-500/30 bg-indigo-500/10 text-indigo-500 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-300 uppercase tracking-[0.6px] text-[10px]",
        "category-travel":
          "border-rose-500/30 bg-rose-500/10 text-rose-500 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300 uppercase tracking-[0.6px] text-[10px]",
        "category-fitness":
          "border-teal-500/30 bg-teal-500/10 text-teal-500 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300 uppercase tracking-[0.6px] text-[10px]",
        "category-unknown":
          "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 uppercase tracking-[0.6px] text-[10px]",
        "status-new":
          "border-sky-500/30 bg-sky-500/10 text-sky-500 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300",
        "status-engaged":
          "border-violet-500/30 bg-violet-500/10 text-violet-500 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300",
        "status-contacted":
          "border-indigo-500/30 bg-indigo-500/10 text-indigo-500 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-300",
        "status-replied":
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",
        "status-qualified":
          "border-amber-500/30 bg-amber-500/10 text-amber-500 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
        "status-unqualified":
          "border-rose-500/30 bg-rose-500/10 text-rose-500 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300",
        "status-do-not-contact":
          "border-rose-500/30 bg-rose-500/10 text-rose-500 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300",
        "score-low":
          "relative pl-3 font-mono border-transparent bg-rose-500/10 text-rose-500 before:absolute before:left-2 before:top-1/2 before:h-2 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-rose-500",
        "score-medium":
          "relative pl-3 font-mono border-transparent bg-amber-500/10 text-amber-500 before:absolute before:left-2 before:top-1/2 before:h-2 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-amber-500",
        "score-high":
          "relative pl-3 font-mono border-transparent bg-emerald-500/10 text-emerald-500 before:absolute before:left-2 before:top-1/2 before:h-2 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-emerald-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
