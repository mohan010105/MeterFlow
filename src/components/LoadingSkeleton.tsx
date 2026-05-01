/**
 * Reusable loading skeleton components for smooth loading states.
 */

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-4 w-full ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 animate-in fade-in duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="skeleton h-10 w-10 rounded-lg" />
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="skeleton h-5 w-3/4" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-2/3" />
      <div className="flex items-center justify-between pt-4 border-t border-border/60">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-3 w-24" />
      </div>
    </div>
  );
}

export function SkeletonStatsGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card rounded-xl p-4 space-y-2 animate-in fade-in duration-300">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-8 w-12 mt-1" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border/40 last:border-0 animate-in fade-in duration-300">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`skeleton h-4 ${i === 0 ? "w-24" : "w-16"}`} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass-card overflow-x-auto rounded-2xl animate-in fade-in duration-300">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="skeleton h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-4 w-72" />
      </div>
      {/* Stats grid */}
      <SkeletonStatsGrid count={4} />
      {/* Content cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton h-4 w-56" />
          <div className="space-y-3 mt-4">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        </div>
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="skeleton h-5 w-32" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
