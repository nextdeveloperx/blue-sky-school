import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface InfoHelpContent {
  purpose: string;
  steps: string[];
  rules?: string[];
  nextSteps?: string;
}

/**
 * Consistent "what is this page / how do I use it" help button, placed next
 * to a section heading. One accessible popover, keyboard-operable (Radix
 * Popover handles focus trap/return and Escape-to-close), same shape
 * everywhere so a principal learns the pattern once.
 */
export function InfoHelp({ title, content }: { title: string; content: InfoHelpContent }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-primary"
          aria-label={`About ${title}`}
        >
          <Info className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[90vw] space-y-3" align="start">
        <div>
          <p className="font-heading font-semibold text-sm text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{content.purpose}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            How to use it
          </p>
          <ol className="text-sm text-foreground space-y-1 list-decimal list-inside">
            {content.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
        {content.rules && content.rules.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Important
            </p>
            <ul className="text-sm text-foreground space-y-1 list-disc list-inside">
              {content.rules.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
          </div>
        )}
        {content.nextSteps && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              What happens next
            </p>
            <p className="text-sm text-foreground">{content.nextSteps}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
