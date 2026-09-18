/**
 * SearchableSelect — a combobox with inline type-to-search.
 * Drop-in replacement for shadcn <Select> when the list is long.
 *
 * Usage:
 *   <SearchableSelect
 *     value={value}
 *     onValueChange={setValue}
 *     options={[{ value: "a", label: "Option A" }]}
 *     placeholder="Choose…"
 *     searchPlaceholder="Search…"
 *     emptyText="No results"
 *     className="w-full"         // applied to the trigger button
 *     size="sm"                  // "sm" | "default" — adjusts height/text
 *   />
 */

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** Optional secondary text shown in a lighter colour */
  sub?: string;
  /** Arbitrary keywords to search on in addition to label/sub/value */
  keywords?: string;
};

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
  size?: "sm" | "default";
  disabled?: boolean;
  /** Show a "(none)" / clear option at top of list */
  allowClear?: boolean;
  clearLabel?: string;
  /** Show a trailing "+ Create new…" row that calls this instead of selecting an option */
  onCreateNew?: () => void;
  createNewLabel?: string;
  /** Require at least one character before listing options. */
  requireSearch?: boolean;
};

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found",
  className,
  triggerClassName,
  size = "default",
  disabled = false,
  allowClear = false,
  clearLabel = "None",
  onCreateNew,
  createNewLabel = "Create new…",
  requireSearch = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = options.find((o) => o.value === value);

  const handleSelect = (val: string) => {
    onValueChange(val === value ? "" : val);
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between font-normal",
            size === "sm" ? "h-8 text-xs px-2" : "h-9 text-sm",
            !selected && "text-muted-foreground",
            triggerClassName ?? className,
          )}
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-1 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[220px] max-w-sm"
        align="start"
        sideOffset={4}
      >
        <Command
          onValueChange={setSearch}
          filter={(itemValue, search) => {
            if (requireSearch && search.trim() === "") return 0;
            const opt = options.find((o) => o.value === itemValue);
            if (!opt) return 0;
            const hay = [opt.label, opt.sub, opt.keywords, opt.value]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return hay.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={requireSearch ? `${searchPlaceholder} (type to search)` : searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{requireSearch && search.trim() === "" ? "Type to search" : emptyText}</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => { onValueChange(""); setOpen(false); }}
                  className="text-muted-foreground italic"
                >
                  <Check className={cn("mr-2 size-3.5", value ? "opacity-0" : "opacity-100")} />
                  {clearLabel}
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 size-3.5 shrink-0",
                      value === opt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {opt.sub && (
                    <span className="ml-2 max-w-[45%] truncate text-xs text-muted-foreground shrink-0">
                      {opt.sub}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreateNew && (
              <CommandGroup>
                <CommandItem
                  value="__create_new__"
                  onSelect={() => { setOpen(false); onCreateNew(); }}
                  className="text-primary font-medium"
                >
                  <Plus className="mr-2 size-3.5" />
                  {createNewLabel}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
