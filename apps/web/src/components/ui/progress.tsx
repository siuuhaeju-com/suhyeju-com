import { cn } from '@/lib/utils';

/**
 * 진행 바 — width가 아니라 transform: scaleX로 채운다.
 * (DESIGN.md Don't: 레이아웃 속성 애니메이션 금지)
 */
function Progress({ value, className, ...props }: React.ComponentProps<'div'> & { value: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn('h-1.5 w-full overflow-hidden rounded-sm bg-surface-raised', className)}
      {...props}
    >
      <div
        className="h-full w-full origin-left rounded-sm bg-primary transition-transform duration-700 ease-out"
        style={{ transform: `scaleX(${Math.min(Math.max(value, 0), 100) / 100})` }}
      />
    </div>
  );
}

export { Progress };
