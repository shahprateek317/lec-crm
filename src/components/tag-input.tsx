"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

/**
 * Modern tag input. Type a value, press Enter (or comma), and it becomes a
 * chip. Backspace on an empty input removes the last chip. Optional
 * `suggestions` provide an autocomplete-style dropdown.
 *
 * Submits as a single hidden input named `<name>` with comma-separated
 * values, matching the existing `csvList` parser used by server actions.
 */
export function TagInput({
  name,
  defaultValue = [],
  suggestions = [],
  placeholder = "Type and press Enter…",
  ariaLabel,
}: {
  name: string;
  defaultValue?: ReadonlyArray<string>;
  suggestions?: ReadonlyArray<string>;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [tags, setTags] = useState<string[]>(() =>
    Array.from(new Set(defaultValue.map((s) => s.trim()).filter(Boolean))),
  );
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    setTags((prev) => (prev.some((t) => t.toLowerCase() === v.toLowerCase()) ? prev : [...prev, v]));
    setDraft("");
  };

  const remove = (v: string) => setTags((prev) => prev.filter((t) => t !== v));

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
      return;
    }
    if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      e.preventDefault();
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const filteredSuggestions = useMemo(() => {
    if (!draft) return suggestions.filter((s) => !tags.includes(s)).slice(0, 6);
    const q = draft.toLowerCase();
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && !tags.some((t) => t.toLowerCase() === s.toLowerCase()))
      .slice(0, 6);
  }, [draft, suggestions, tags]);

  // Close suggestions when clicking outside.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <div
        role="group"
        aria-label={ariaLabel}
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5",
          "focus-within:ring-2 focus-within:ring-ring",
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(tag);
              }}
              className="rounded-full hover:bg-primary/20"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setOpen(true)}
          onBlur={() => add(draft)}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[8ch] bg-transparent text-sm outline-none"
        />
      </div>

      {open && filteredSuggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {filteredSuggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(s);
                  inputRef.current?.focus();
                }}
                className="flex w-full items-center px-3 py-1.5 text-sm hover:bg-muted"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Server actions read via formData.get(name) and split on comma. */}
      <input type="hidden" name={name} value={tags.join(",")} />
    </div>
  );
}
