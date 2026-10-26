import { Fragment } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RowAction {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Insert a visual separator above this item (e.g. before a destructive action). */
  separatorBefore?: boolean;
}

/**
 * Consistent three-dot row action menu used across Classes/Sections/Subjects/
 * Staff. Built on Radix DropdownMenu, which already provides full keyboard
 * support (Enter/Space to open, arrow keys to navigate, Escape to close) and
 * a focus-visible trigger — so this is usable by keyboard and touch, not
 * just mouse hover. `collisionPadding`/Radix's own positioning keeps the
 * menu inside the viewport automatically.
 */
export function RowActionsMenu({
  label,
  actions,
  className,
}: {
  label: string;
  actions: RowAction[];
  /** Optional size override for the trigger button, e.g. "h-5 w-5" for a compact chip. */
  className?: string;
}) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label={`Actions for ${label}`}>
          <MoreVertical className={className ? "h-3 w-3" : "h-4 w-4"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, i) => (
          // A Fragment (not a <div>) keeps every item/separator a direct
          // DOM child of the menu, matching the ARIA menu/menuitem parent-
          // child relationship screen readers expect — a wrapping element
          // here would be a structural accessibility violation even though
          // Radix's own keyboard handling (DOM-query-based) still works
          // either way.
          <Fragment key={action.label}>
            {action.separatorBefore && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onSelect={action.onSelect}
              disabled={action.disabled}
              className={action.destructive ? "text-destructive focus:text-destructive" : undefined}
            >
              {action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
