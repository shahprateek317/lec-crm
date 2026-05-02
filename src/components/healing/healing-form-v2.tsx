"use client";

import { useMemo, useState, useTransition } from "react";
import { Calendar, Sparkles, User as UserIcon, Wallet } from "lucide-react";
import { ChipMultiSelect } from "@/components/chip-multi-select";
import { ChakraStateRow } from "@/components/healing/chakra-state-row";
import { ImprovementSummary } from "@/components/healing/improvement-summary";
import { DateTimePicker } from "@/components/date-picker";
import {
  CHAKRA_KEYS,
  CLEANSING_OPTIONS,
  ENERGISING_OPTIONS,
  PRANIC_COLORS,
  COLOR_LABEL,
  type ChakraKey,
  type ChakraState,
  type ChakraStateMap,
} from "@/lib/healing";
import { logHealingSessionAction } from "@/app/(app)/leads/[id]/healing/new/actions";

type Healer = { id: string; name: string };

export function HealingFormV2({
  clientId,
  clientName,
  healers,
  defaultHealerId,
  creditBalance,
}: {
  clientId: string;
  clientName: string;
  healers: ReadonlyArray<Healer>;
  defaultHealerId?: string;
  creditBalance: number;
}) {
  const [sessionType, setSessionType] = useState<"DEMO" | "PAID" | "FOLLOW_UP">(
    creditBalance > 0 ? "PAID" : "DEMO",
  );
  const [mode, setMode] = useState<"IN_PERSON" | "DISTANT">("IN_PERSON");
  const [healerId, setHealerId] = useState<string>(defaultHealerId ?? "");
  const [before, setBefore] = useState<ChakraStateMap>({});
  const [after, setAfter] = useState<ChakraStateMap>({});
  const [colorsOn, setColorsOn] = useState<boolean>(false);
  const [pending, startTransition] = useTransition();

  const creditUsed = useMemo(() => sessionType === "PAID", [sessionType]);
  const showCreditWarning = creditUsed && creditBalance <= 0;

  // We submit via a plain <form action> so the server action handles the
  // multipart formdata directly. Any client-only state (chakra maps,
  // colorsOn) gets serialised into hidden inputs below.
  return (
    <form
      action={(fd) => startTransition(() => void logHealingSessionAction(fd))}
      className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="chakraStatesBefore" value={JSON.stringify(before)} />
      <input type="hidden" name="chakraStatesAfter" value={JSON.stringify(after)} />

      {/* ── Section 1: Auto details ──────────────────────────────── */}
      <Section number={1} title="Session details">
        <div className="rounded-lg bg-muted/30 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5" />{clientName}</span>
            <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
            <span className="inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" />Balance: <strong className={creditBalance <= 0 ? "text-destructive" : "text-foreground"}>{creditBalance}</strong></span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Healer" required>
            <select
              name="healerId"
              required
              value={healerId}
              onChange={(e) => setHealerId(e.target.value)}
              className={inputCls}
            >
              <option value="" disabled>Select…</option>
              {healers.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Mode">
            <select
              name="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
              className={inputCls}
            >
              <option value="IN_PERSON">In-person (at centre)</option>
              <option value="DISTANT">Distant (via WhatsApp group)</option>
            </select>
          </Field>
        </div>

        <Field label="Session type">
          <PillRadio
            name="sessionType"
            value={sessionType}
            options={[
              { value: "DEMO", label: "Demo (free)" },
              { value: "PAID", label: "Paid (uses 1 credit)" },
              { value: "FOLLOW_UP", label: "Follow-up (free)" },
            ]}
            onChange={(v) => setSessionType(v as typeof sessionType)}
          />
        </Field>

        <input type="hidden" name="creditUsed" value={creditUsed ? "true" : ""} />
        {showCreditWarning && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Client has 0 credits. Saving as Paid will fail — switch to Demo / Follow-up,
            or record a payment first.
          </p>
        )}
      </Section>

      {/* ── Section 2: Chakra status BEFORE ─────────────────────── */}
      <Section number={2} title="Chakra status — before">
        <div className="space-y-2">
          {CHAKRA_KEYS.map((c) => (
            <ChakraStateRow
              key={`b-${c}`}
              chakra={c}
              value={before[c]}
              onChange={(v) =>
                setBefore((prev) => {
                  const n = { ...prev };
                  if (v) n[c] = v;
                  else delete n[c];
                  return n;
                })
              }
            />
          ))}
        </div>
      </Section>

      {/* ── Section 3: Healing actions ──────────────────────────── */}
      <Section number={3} title="Healing actions">
        <Field label="Cleansing">
          <ChipMultiSelect
            name="cleansingActions"
            options={CLEANSING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            ariaLabel="Cleansing techniques"
          />
        </Field>
        <Field label="Energising">
          <ChipMultiSelect
            name="energisingActions"
            options={ENERGISING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            ariaLabel="Energising techniques"
          />
        </Field>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input
              type="checkbox"
              checked={colorsOn}
              onChange={(e) => setColorsOn(e.target.checked)}
              className="h-4 w-4"
            />
            Colours of prana used
          </label>
          {colorsOn && (
            <ChipMultiSelect
              name="colorsUsed"
              options={PRANIC_COLORS.map((c) => ({ value: c, label: COLOR_LABEL[c] }))}
              ariaLabel="Pranic colours"
              columns={3}
            />
          )}
        </div>
      </Section>

      {/* ── Section 4: Chakra status AFTER ──────────────────────── */}
      <Section number={4} title="Chakra status — after">
        <div className="space-y-2">
          {CHAKRA_KEYS.map((c) => (
            <ChakraStateRow
              key={`a-${c}`}
              chakra={c}
              value={after[c]}
              onChange={(v) =>
                setAfter((prev) => {
                  const n = { ...prev };
                  if (v) n[c] = v;
                  else delete n[c];
                  return n;
                })
              }
            />
          ))}
        </div>
      </Section>

      {/* ── Section 5: Auto improvement ─────────────────────────── */}
      <Section number={5} title="Improvement (auto-calculated)">
        <ImprovementSummary before={before} after={after} />
      </Section>

      {/* ── Notes & next steps ─────────────────────────────────── */}
      <Section title="Notes &amp; next session">
        <Field label="Remarks (optional)">
          <textarea
            name="remarks"
            rows={3}
            className={`${inputCls} min-h-20 resize-y py-2`}
            placeholder="Anything worth noting for next session."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client response (optional)">
            <input
              name="clientResponse"
              className={inputCls}
              placeholder="What the client said after."
            />
          </Field>
          <Field label="Duration (minutes)">
            <input
              name="durationMinutes"
              type="number"
              min={1}
              max={300}
              className={inputCls}
            />
          </Field>
          <Field label="Next session recommended on">
            <DateTimePicker name="nextSessionRecommendedAt" fromDate={new Date()} />
          </Field>
          <Field label="Follow-up needed?">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm">
              <input type="checkbox" name="followUpNeeded" value="true" className="h-4 w-4" />
              Yes — create a follow-up reminder
            </label>
          </Field>
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {pending ? "Saving…" : "Save healing session"}
        </button>
        {creditUsed && !showCreditWarning && (
          <p className="text-xs text-muted-foreground">
            1 credit will be deducted on save (balance becomes {creditBalance - 1}).
          </p>
        )}
      </div>
    </form>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Section({
  number,
  title,
  children,
}: {
  number?: number;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-border pt-5 first:border-0 first:pt-0">
      <div className="flex items-center gap-2">
        {number !== undefined && (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {number}
          </span>
        )}
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      <div className="space-y-3 pl-0 sm:pl-8">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </p>
      {children}
    </div>
  );
}

function PillRadio({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label
            key={o.value}
            className={
              "inline-flex cursor-pointer items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
              (on
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:bg-muted")
            }
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={on}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
