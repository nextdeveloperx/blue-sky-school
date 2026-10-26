import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Circle } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type ChartKind = "bar" | "line" | "pie" | "doughnut";

export interface ChartDatum {
  name: string;
  value: number;
}

const CHART_KIND_ICON: Record<ChartKind, typeof BarChart3> = {
  bar: BarChart3,
  line: LineChartIcon,
  pie: PieChartIcon,
  doughnut: Circle,
};

const CHART_KIND_LABEL: Record<ChartKind, string> = {
  bar: "Bar",
  line: "Line",
  pie: "Pie",
  doughnut: "Doughnut",
};

// Recharts click handlers receive different shapes depending on which chart
// primitive fires them — Bar/Pie entries have the original data fields
// spread onto the top level, Line's `dot` only exposes them under
// `.payload`. Reading both defensively (payload first, since it's always
// the authoritative original row when present) means a future recharts
// version or a different mark type can't silently break the click target.
function extractName(d: unknown): string | undefined {
  const obj = d as { name?: unknown; payload?: { name?: unknown } };
  const name = obj?.payload?.name ?? obj?.name;
  return typeof name === "string" ? name : undefined;
}

/**
 * A single-series chart (one value per category) that the user can switch
 * between bar/line/pie/doughnut, with click-to-inspect on any bar/point/
 * slice. Intentionally only handles single-series {name, value} data —
 * multi-series stacked data (like fee status breakdown) stays a plain bar
 * chart elsewhere, since a pie/doughnut can't represent a stack meaningfully
 * and a line chart implies a trend that doesn't exist for category data.
 */
export function ChartTypeSwitcher({
  title,
  description,
  data,
  valueLabel = "Value",
  valueFormatter = (v: number) => String(v),
  onElementClick,
  availableTypes = ["bar", "line", "pie", "doughnut"],
  defaultType = "bar",
  emptyMessage = "No data yet.",
  isLoading = false,
  isError = false,
  errorMessage = "Could not load this data — try refreshing the page.",
  extraControls,
}: {
  title: string;
  description?: string;
  data: ChartDatum[];
  valueLabel?: string;
  valueFormatter?: (v: number) => string;
  onElementClick?: (name: string) => void;
  availableTypes?: ChartKind[];
  defaultType?: ChartKind;
  emptyMessage?: string;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  /** Extra controls (e.g. a granularity toggle) rendered next to the chart-type switcher. */
  extraControls?: ReactNode;
}) {
  const [kind, setKind] = useState<ChartKind>(defaultType);

  const config = useMemo(() => {
    const c: ChartConfig = {
      value: { label: valueLabel, color: "hsl(var(--chart-1))" },
    };
    data.forEach((d, i) => {
      c[d.name] = { label: d.name, color: `hsl(var(--chart-${(i % 5) + 1}))` };
    });
    return c;
  }, [data, valueLabel]);

  const colorFor = (i: number) => `hsl(var(--chart-${(i % 5) + 1}))`;

  return (
    <section className="card-elevated p-4 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading font-semibold text-lg">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {extraControls}
          <ToggleGroup
            type="single"
            value={kind}
            onValueChange={(v) => v && setKind(v as ChartKind)}
            aria-label={`Chart type for ${title}`}
          >
            {availableTypes.map((t) => {
              const Icon = CHART_KIND_ICON[t];
              return (
                <ToggleGroupItem key={t} value={t} aria-label={CHART_KIND_LABEL[t]} size="sm">
                  <Icon className="h-4 w-4" />
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center" role="status">
          Loading…
        </p>
      ) : isError ? (
        <p className="text-sm text-destructive py-8 text-center" role="alert">
          {errorMessage}
        </p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{emptyMessage}</p>
      ) : (
        <ChartContainer config={config} className="max-h-72 w-full">
          {kind === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(v) => valueFormatter(Number(v))} />}
              />
              <Bar
                dataKey="value"
                radius={4}
                onClick={(d) => {
                  const name = extractName(d);
                  if (name) onElementClick?.(name);
                }}
                className={onElementClick ? "cursor-pointer" : undefined}
              >
                {data.map((d, i) => (
                  <Cell key={d.name} fill={colorFor(i)} />
                ))}
              </Bar>
            </BarChart>
          ) : kind === "line" ? (
            <LineChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(v) => valueFormatter(Number(v))} />}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={{
                  r: 4,
                  onClick: (d: unknown) => {
                    const name = extractName(d);
                    if (name) onElementClick?.(name);
                  },
                  className: onElementClick ? "cursor-pointer" : undefined,
                }}
              />
            </LineChart>
          ) : (
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => valueFormatter(Number(v))} />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={kind === "doughnut" ? "55%" : 0}
                outerRadius="80%"
                onClick={(d) => {
                  const name = extractName(d);
                  if (name) onElementClick?.(name);
                }}
                className={onElementClick ? "cursor-pointer" : undefined}
              >
                {data.map((d, i) => (
                  <Cell key={d.name} fill={colorFor(i)} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          )}
        </ChartContainer>
      )}

      {/* Recharts marks (bars/points/slices) are plain SVG with no keyboard
          focus — clicking to drill down only works with a mouse or touch.
          This row of real buttons gives keyboard users an equivalent way to
          open the same detail view, and doubles as the textual summary a
          chart alone can't provide. */}
      {onElementClick && data.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1" aria-label={`${title} — view details by category`}>
          {data.map((d) => (
            <button
              key={d.name}
              type="button"
              onClick={() => onElementClick(d.name)}
              className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/70 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {d.name}: {valueFormatter(d.value)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
