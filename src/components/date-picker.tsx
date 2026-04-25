"use client";

import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Modern date input — uses the shadcn Calendar inside a Popover with a
 * read-only trigger button. Submits as a hidden ISO yyyy-MM-dd input named
 * `name` so it lands cleanly in form actions. Falls back to displaying
 * "Pick a date" when nothing is set.
 *
 * For datetime fields use <DateTimePicker /> below.
 */
export function DatePicker({
  name,
  defaultValue,
  placeholder = "Pick a date",
  required,
  fromDate,
}: {
  name: string;
  defaultValue?: string; // yyyy-MM-dd
  placeholder?: string;
  required?: boolean;
  fromDate?: Date;
}) {
  const initial = defaultValue ? parse(defaultValue, "yyyy-MM-dd", new Date()) : undefined;
  const [date, setDate] = useState<Date | undefined>(isValid(initial) ? initial : undefined);

  return (
    <>
      <Popover>
        <PopoverTrigger
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-sm outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring",
            !date && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {date ? format(date, "EEE, dd MMM yyyy") : placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={fromDate ? { before: fromDate } : undefined}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <input
        type="hidden"
        name={name}
        value={date ? format(date, "yyyy-MM-dd") : ""}
        required={required}
      />
    </>
  );
}

/**
 * Datetime picker — date popover plus an inline time selector. Submits a
 * single ISO datetime-local string (yyyy-MM-ddTHH:mm) so existing form
 * actions accept it via `new Date(value)`.
 */
export function DateTimePicker({
  name,
  defaultValue,
  required,
  fromDate,
}: {
  name: string;
  defaultValue?: string; // yyyy-MM-ddTHH:mm
  required?: boolean;
  fromDate?: Date;
}) {
  const parsed = defaultValue ? new Date(defaultValue) : undefined;
  const initialValid = parsed && isValid(parsed) ? parsed : undefined;
  const [date, setDate] = useState<Date | undefined>(initialValid);
  const [time, setTime] = useState<string>(
    initialValid ? format(initialValid, "HH:mm") : "10:00",
  );

  const composed = date
    ? `${format(date, "yyyy-MM-dd")}T${time}`
    : "";

  return (
    <div className="flex gap-2">
      <Popover>
        <PopoverTrigger
          className={cn(
            "flex h-10 flex-1 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-sm outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring",
            !date && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {date ? format(date, "EEE, dd MMM yyyy") : "Pick a date"}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={fromDate ? { before: fromDate } : undefined}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="h-10 w-28 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        required={required}
      />
      <input type="hidden" name={name} value={composed} required={required} />
    </div>
  );
}
