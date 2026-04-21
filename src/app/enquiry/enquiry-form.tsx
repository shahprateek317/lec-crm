"use client";

import { useState, useTransition } from "react";
import { submitEnquiry } from "./actions";

const AGE_BUCKETS = [
  { v: "UNDER_18",    label: "Below 18" },
  { v: "AGE_18_25",   label: "18 – 25" },
  { v: "AGE_26_40",   label: "26 – 40" },
  { v: "AGE_41_60",   label: "41 – 60" },
  { v: "AGE_60_PLUS", label: "60+" },
] as const;

const AREAS = [
  { v: "NEW_TOWN",        label: "New Town" },
  { v: "SALT_LAKE",       label: "Salt Lake" },
  { v: "RAJARHAT",        label: "Rajarhat" },
  { v: "DUMDUM",          label: "Dum Dum" },
  { v: "BARASAT",         label: "Barasat" },
  { v: "OTHER_KOLKATA",   label: "Other area in Kolkata" },
  { v: "OUTSIDE_KOLKATA", label: "Outside Kolkata" },
] as const;

const ISSUES = [
  { v: "STRESS_ANXIETY",  label: "Stress / Anxiety" },
  { v: "PHYSICAL_HEALTH", label: "Physical health issue" },
  { v: "EMOTIONAL",       label: "Emotional concern" },
  { v: "RELATIONSHIP",    label: "Relationship issue" },
  { v: "FINANCIAL",       label: "Financial stress" },
  { v: "WELLBEING",       label: "General well-being" },
  { v: "OTHER",           label: "Other" },
] as const;

const DURATIONS = [
  { v: "DAYS",       label: "Few days" },
  { v: "WEEKS",      label: "Few weeks" },
  { v: "MONTHS",     label: "Few months" },
  { v: "OVER_YEAR",  label: "More than 1 year" },
] as const;

const TIMES = [
  { v: "MORNING",   label: "Morning" },
  { v: "AFTERNOON", label: "Afternoon" },
  { v: "EVENING",   label: "Evening" },
  { v: "WEEKEND",   label: "Weekend" },
] as const;

const inputCls =
  "flex h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function EnquiryForm({ initialError }: { initialError?: string }) {
  const [areaCategory, setAreaCategory] = useState<string>("");
  const [issueCategory, setIssueCategory] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const needsAreaSpecify =
    areaCategory === "OTHER_KOLKATA" || areaCategory === "OUTSIDE_KOLKATA";
  const needsIssueSpecify = issueCategory === "OTHER";

  return (
    <form
      action={(fd) => startTransition(() => void submitEnquiry(fd))}
      className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      {/* 1. Full Name */}
      <Field id="name" label="Full name" required>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={50}
          pattern="[A-Za-z\s.'-]+"
          autoComplete="name"
          autoCapitalize="words"
          className={inputCls}
          placeholder="Your full name"
        />
      </Field>

      {/* 2. Phone */}
      <Field id="phone" label="Phone (WhatsApp preferred)" required>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel"
          defaultValue="+91 "
          pattern="^\+?\d[\d\s\-]{7,}$"
          className={inputCls}
          placeholder="+91 98765 43210"
        />
      </Field>

      {/* 3. Age */}
      <Field id="ageBucket" label="Age">
        <select id="ageBucket" name="ageBucket" defaultValue="" className={inputCls}>
          <option value="" disabled>Select age range</option>
          {AGE_BUCKETS.map((a) => (
            <option key={a.v} value={a.v}>{a.label}</option>
          ))}
        </select>
      </Field>

      {/* 4. Area */}
      <Field id="areaCategory" label="Area / locality" required>
        <select
          id="areaCategory"
          name="areaCategory"
          required
          value={areaCategory}
          onChange={(e) => setAreaCategory(e.target.value)}
          className={inputCls}
        >
          <option value="" disabled>Select your area</option>
          {AREAS.map((a) => (
            <option key={a.v} value={a.v}>{a.label}</option>
          ))}
        </select>
      </Field>
      {needsAreaSpecify && (
        <Field id="area" label="Please specify your area" required>
          <input
            id="area"
            name="area"
            required
            maxLength={120}
            className={inputCls}
            placeholder="e.g. Behala, Howrah, Durgapur"
          />
        </Field>
      )}

      {/* 5. Issue category */}
      <Field label="What brings you to us?" required>
        <div className="space-y-2">
          {ISSUES.map((it) => (
            <label
              key={it.v}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40"
            >
              <input
                type="radio"
                name="issueCategory"
                value={it.v}
                required
                checked={issueCategory === it.v}
                onChange={(e) => setIssueCategory(e.target.value)}
                className="h-4 w-4"
              />
              <span className="text-sm">{it.label}</span>
            </label>
          ))}
        </div>
      </Field>
      {needsIssueSpecify && (
        <Field id="issue" label="Please tell us a bit more">
          <textarea
            id="issue"
            name="issue"
            rows={3}
            maxLength={150}
            className={`${inputCls} min-h-20 resize-y py-2`}
            placeholder="A few words — max 150 characters."
          />
        </Field>
      )}

      {/* 6. Duration */}
      <Field id="durationBucket" label="Since how long are you facing this?">
        <select
          id="durationBucket"
          name="durationBucket"
          defaultValue=""
          className={inputCls}
        >
          <option value="" disabled>Select duration</option>
          {DURATIONS.map((d) => (
            <option key={d.v} value={d.v}>{d.label}</option>
          ))}
        </select>
      </Field>

      {/* 7. Preferred time */}
      <Field label="Preferred time for counselling" required>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIMES.map((t) => (
            <label
              key={t.v}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary"
            >
              <input type="radio" name="preferredTimeSlot" value={t.v} required className="sr-only" />
              {t.label}
            </label>
          ))}
        </div>
      </Field>

      {initialError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(initialError)}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {isPending ? "Booking…" : "Book my free counselling"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
