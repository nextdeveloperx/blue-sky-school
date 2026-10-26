import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface StudentSearchResult {
  id: string;
  admission_no: string;
  full_name: string;
  class_name: string | null;
  section_name: string | null;
}

/**
 * Searchable student picker — queries only matching rows (partial name OR
 * partial admission number, server-side ILIKE, capped at 20 results) rather
 * than loading the whole roster. RLS on `students` already scopes results
 * to whatever the signed-in role is authorized to see; this component does
 * not duplicate that logic client-side.
 */
export function StudentSearchCombobox({
  value,
  selectedLabel,
  onSelect,
}: {
  value: string;
  selectedLabel: string | null;
  onSelect: (student: StudentSearchResult) => void;
}) {
  const supabase = getSupabaseClient();
  const [open, setOpen] = useState(false);
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(rawQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const {
    data: results,
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["student_search", debouncedQuery],
    enabled: open && debouncedQuery.length > 0,
    queryFn: async (): Promise<StudentSearchResult[]> => {
      const q = debouncedQuery.replace(/[%_]/g, "\\$&");
      const { data, error } = await supabase
        .from("students")
        .select("id, admission_no, full_name, sections(name, classes(name))")
        .or(`full_name.ilike.%${q}%,admission_no.ilike.%${q}%`)
        .order("full_name")
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((s) => {
        const section = s.sections as unknown as { name: string; classes: { name: string } | null } | null;
        return {
          id: s.id,
          admission_no: s.admission_no,
          full_name: s.full_name,
          class_name: section?.classes?.name ?? null,
          section_name: section?.name ?? null,
        };
      });
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-80 justify-between font-normal"
        >
          <span className="truncate">{selectedLabel ?? "Search student by name or admission no."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Type a name or admission number..."
              value={rawQuery}
              onValueChange={setRawQuery}
              className="border-0 focus:ring-0"
            />
          </div>
          <CommandList>
            {debouncedQuery.length === 0 && (
              <CommandEmpty>Start typing a student's name or admission number.</CommandEmpty>
            )}
            {debouncedQuery.length > 0 && isFetching && (
              <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>
            )}
            {debouncedQuery.length > 0 && isError && (
              <div className="py-6 text-center text-sm text-destructive">
                Search failed — try again.
              </div>
            )}
            {debouncedQuery.length > 0 && !isFetching && !isError && results?.length === 0 && (
              <CommandEmpty>No students match "{debouncedQuery}".</CommandEmpty>
            )}
            <CommandGroup>
              {results?.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.id}
                  onSelect={() => {
                    onSelect(s);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{s.full_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.admission_no}
                      {s.class_name && ` · ${s.class_name}${s.section_name ? `-${s.section_name}` : ""}`}
                    </span>
                  </div>
                  <Check className={cn("h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
