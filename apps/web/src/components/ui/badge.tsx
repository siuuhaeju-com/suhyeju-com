import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/** 섹터·키워드 pill (DESIGN.md components.chip) */
const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-raised text-ink-sub',
        blue: 'border-primary/40 bg-primary/10 text-blue-bright',
        red: 'border-positive/40 bg-positive/10 text-positive',
        green: 'border-negative/40 bg-negative/10 text-negative',
        teal: 'border-tier3/40 bg-tier3/10 text-tier3',
        amber: 'border-[#f2907c]/40 bg-[#f2907c]/10 text-[#f2907c]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
