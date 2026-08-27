// Public healing summary — the URL sent to the client after session end.
// No login required; the summaryToken is the auth.

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  CHAKRA_LABEL,
  STATE_LABEL,
  CLEANSING_OPTIONS,
  ENERGISING_OPTIONS,
  COLOR_LABEL,
  parseChakraStates,
  computeImprovement,
  CHAKRA_KEYS,
} from "@/lib/healing";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "Your Healing Summary — Life Energy Centre" };
}

const STATE_COLOR: Record<string, string> = {
  BALANCED:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  OVERACTIVE: "bg-amber-50 text-amber-700 border-amber-200",
  BLOCKED:    "bg-rose-50 text-rose-700 border-rose-200",
  WEAK:       "bg-slate-50 text-slate-600 border-slate-200",
};

function deltaLabel(delta: number) {
  if (delta > 0) return { text: "Improved", cls: "text-emerald-600" };
  if (delta < 0) return { text: "Needs attention", cls: "text-rose-500" };
  return { text: "Stable", cls: "text-slate-500" };
}

export default async function HealingSummaryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const session = await prisma.healingSession.findUnique({
    where: { summaryToken: token },
    include: {
      client: { select: { name: true } },
      healer: { select: { name: true } },
    },
  });

  if (!session) return notFound();

  const before = parseChakraStates(session.chakraStatesBefore);
  const after  = parseChakraStates(session.chakraStatesAfter);
  const { perChakra } = computeImprovement(before, after);
  const workedChakras = CHAKRA_KEYS.filter((k) => before[k] || after[k]);

  const colorLabels = (session.colorsUsed ?? []).map(
    (c) => COLOR_LABEL[c as keyof typeof COLOR_LABEL] ?? c
  );
  const cleansingLabels = (session.cleansingActions ?? []).map(
    (a) => CLEANSING_OPTIONS.find((o) => o.value === a)?.label ?? a
  );
  const energisingLabels = (session.energisingActions ?? []).map(
    (a) => ENERGISING_OPTIONS.find((o) => o.value === a)?.label ?? a
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Life Energy Centre</p>
          <h1 className="font-serif text-2xl font-medium text-foreground">Your Healing Summary</h1>
          <p className="text-sm text-muted-foreground">
            Session on {format(session.date, "dd MMMM yyyy")} with {session.healer.name}
          </p>
        </div>

        {/* Chakra before / after */}
        {workedChakras.length > 0 && (
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Chakras Worked On</h2>
            <div className="space-y-3">
              {workedChakras.map((k) => {
                const b = before[k];
                const a = after[k];
                const delta = perChakra.find((p) => p.key === k)?.delta ?? 0;
                const dl = deltaLabel(delta);
                return (
                  <div key={k} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{CHAKRA_LABEL[k]}</span>
                      <span className={`text-xs font-medium ${dl.cls}`}>{dl.text}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {b ? (
                        <span className={`rounded-full border px-2.5 py-0.5 font-medium ${STATE_COLOR[b]}`}>
                          Before: {STATE_LABEL[b]}
                        </span>
                      ) : null}
                      {b && a && <span className="text-muted-foreground">→</span>}
                      {a ? (
                        <span className={`rounded-full border px-2.5 py-0.5 font-medium ${STATE_COLOR[a]}`}>
                          After: {STATE_LABEL[a]}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Techniques used */}
        {(cleansingLabels.length > 0 || energisingLabels.length > 0 || colorLabels.length > 0) && (
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Techniques Applied</h2>
            {cleansingLabels.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cleansing</p>
                <div className="flex flex-wrap gap-1.5">
                  {cleansingLabels.map((l) => (
                    <span key={l} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700">{l}</span>
                  ))}
                </div>
              </div>
            )}
            {energisingLabels.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Energising</p>
                <div className="flex flex-wrap gap-1.5">
                  {energisingLabels.map((l) => (
                    <span key={l} className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs text-violet-700">{l}</span>
                  ))}
                </div>
              </div>
            )}
            {colorLabels.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pranic Colors Used</p>
                <div className="flex flex-wrap gap-1.5">
                  {colorLabels.map((l) => (
                    <span key={l} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700">{l}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Healer remarks */}
        {session.remarks && (
          <div className="rounded-xl border bg-card p-5 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Healer&apos;s Notes</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{session.remarks}</p>
          </div>
        )}

        {/* Overall position / client response */}
        {session.clientResponse && (
          <div className="rounded-xl border bg-card p-5 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Your Response During Session</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{session.clientResponse}</p>
          </div>
        )}

        {/* Next session recommendation */}
        {session.nextSessionRecommendedAt && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Recommended Next Session</h2>
            <p className="text-sm text-muted-foreground">
              {format(session.nextSessionRecommendedAt, "dd MMMM yyyy")}
            </p>
          </div>
        )}

        {/* Follow-up notice */}
        {session.followUpNeeded && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Your healer has flagged that a follow-up is recommended. Our team will be in touch.
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-6">
          Life Energy Centre · Pecon Tower, New Town, Kolkata
        </p>
      </div>
    </div>
  );
}
