import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  // fee / payment states
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  pending: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  // student states
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  inactive: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  alumni: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  // result lifecycle
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  approved: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  // payroll
  finalized: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  // enquiry / request states
  new: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  verified: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  // invitation lifecycle
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  revoked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  // expense lifecycle
  voided: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  // exam term status
  open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  locked: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  // application roles
  principal: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
  accountant: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  teacher: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  parent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {status}
    </span>
  );
}
