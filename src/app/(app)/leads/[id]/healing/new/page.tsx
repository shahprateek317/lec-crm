import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCreditBalance } from "@/lib/credits";
import { logHealingSessionAction } from "./actions";

export const metadata = { title: "Log healing session" };

const CHAKRAS = [
  { value: "CROWN", label: "Crown" },
  { value: "FOREHEAD", label: "Forehead" },
  { value: "AJNA", label: "Ajna (brow)" },
  { value: "THROAT", label: "Throat" },
  { value: "HEART", label: "Heart" },
  { value: "SOLAR_PLEXUS_FRONT", label: "Solar plexus (front)" },
  { value: "SOLAR_PLEXUS_BACK", label: "Solar plexus (back)" },
  { value: "NAVEL", label: "Navel" },
  { value: "MENG_MEIN", label: "Meng mein" },
  { value: "SPLEEN_FRONT", label: "Spleen (front)" },
  { value: "SPLEEN_BACK", label: "Spleen (back)" },
  { value: "SEX", label: "Sex" },
  { value: "BASIC", label: "Basic" },
] as const;

const COLORS = [
  { value: "WHITE",            label: "White" },
  { value: "GREEN",            label: "Green" },
  { value: "ORANGE",           label: "Orange" },
  { value: "YELLOW",           label: "Yellow" },
  { value: "BLUE",             label: "Blue" },
  { value: "VIOLET",           label: "Violet" },
  { value: "ELECTRIC_VIOLET",  label: "Electric Violet" },
  { value: "GOLD",             label: "Gold" },
  { value: "RED",              label: "Red" },
] as const;

export default async function LogHealingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [client, healers, balance] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["HEALER", "ADMIN"] } },
      orderBy: { name: "asc" },
    }),
    getCreditBalance(id),
  ]);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/leads/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {client.name}
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Sparkles className="h-7 w-7 text-primary" />
          Log healing session
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Credit balance: <span className={balance <= 0 ? "font-medium text-destructive" : "font-medium"}>{balance}</span>
        </p>
      </header>

      <form
        action={logHealingSessionAction}
        className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="clientId" value={client.id} />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="healerId" className="text-sm font-medium">Healer *</label>
            <select id="healerId" name="healerId" required defaultValue="" className={inputCls}>
              <option value="" disabled>Select…</option>
              {healers.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="mode" className="text-sm font-medium">Mode</label>
            <select id="mode" name="mode" defaultValue="IN_PERSON" className={inputCls}>
              <option value="IN_PERSON">In-person (at centre)</option>
              <option value="DISTANT">Distant (via WhatsApp group)</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Chakras worked on</label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {CHAKRAS.map((c) => (
              <label key={c.value} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/40">
                <input type="checkbox" name="chakras" value={c.value} className="h-4 w-4" />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Colours of prana used (optional)</label>
          <div className="grid grid-cols-3 gap-1.5">
            {COLORS.map((c) => (
              <label key={c.value} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/40">
                <input type="checkbox" name="colorsUsed" value={c.value} className="h-4 w-4" />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="process" className="text-sm font-medium">Process / technique</label>
            <input
              id="process"
              name="process"
              placeholder="e.g. general sweeping, localised"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="durationMinutes" className="text-sm font-medium">Duration (minutes)</label>
            <input
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              min={1}
              max={300}
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="remarks" className="text-sm font-medium">Remarks</label>
          <textarea
            id="remarks"
            name="remarks"
            rows={3}
            placeholder="Observations, energy state, changes noticed…"
            className={`${inputCls} min-h-20 resize-y py-2`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="clientResponse" className="text-sm font-medium">Client response</label>
            <input id="clientResponse" name="clientResponse" placeholder="Quick note on what they said" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="nextSessionRecommendedAt" className="text-sm font-medium">Next session recommended on</label>
            <input id="nextSessionRecommendedAt" name="nextSessionRecommendedAt" type="date" className={inputCls} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="followUpNeeded" value="true" className="h-4 w-4" />
          Follow-up needed
        </label>

        <label className="flex items-center gap-2 rounded-md bg-muted/40 p-3 text-sm">
          <input
            type="checkbox"
            name="creditUsed"
            value="true"
            defaultChecked={balance > 0}
            className="h-4 w-4"
          />
          Deduct 1 healing credit
          {balance <= 0 && <span className="text-xs text-destructive">(no credits — uncheck for complimentary)</span>}
        </label>

        {sp.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {decodeURIComponent(sp.error)}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
            Save session
          </button>
          <Link href={`/leads/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
