import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Circle, MessagesSquare, ExternalLink, Copy } from "lucide-react";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { standardDataFormat, healerUpdateFormat } from "@/lib/distant-healing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enableGroupAction, addHealerUpdateAction, addFeedbackAction } from "./actions";

export const metadata = { title: "Distant healing" };

const CHAKRAS = [
  { value: "CROWN", label: "Crown" },
  { value: "FOREHEAD", label: "Forehead" },
  { value: "AJNA", label: "Ajna" },
  { value: "THROAT", label: "Throat" },
  { value: "HEART", label: "Heart" },
  { value: "SOLAR_PLEXUS_FRONT", label: "Solar plexus (F)" },
  { value: "SOLAR_PLEXUS_BACK", label: "Solar plexus (B)" },
  { value: "NAVEL", label: "Navel" },
  { value: "MENG_MEIN", label: "Meng mein" },
  { value: "SPLEEN_FRONT", label: "Spleen (F)" },
  { value: "SPLEEN_BACK", label: "Spleen (B)" },
  { value: "SEX", label: "Sex" },
  { value: "BASIC", label: "Basic" },
] as const;

export default async function DistantHealingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [client, group, healers, updates, feedback] = await Promise.all([
    prisma.client.findUnique({ where: { id } }),
    prisma.distantHealingGroup.findUnique({ where: { clientId: id } }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["HEALER", "ADMIN"] } },
      orderBy: { name: "asc" },
    }),
    prisma.healerUpdate.findMany({
      where: { distantGroup: { clientId: id } },
      orderBy: { date: "desc" },
      take: 20,
      include: { healer: { select: { name: true } } },
    }),
    prisma.clientFeedback.findMany({
      where: { clientId: id },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),
  ]);
  if (!client) notFound();

  const standardMessage = standardDataFormat({
    name: client.name,
    age: client.age,
    area: client.area,
    issueRefined: client.issueRefined,
    issue: client.issue,
    problemAreas: group?.problemAreas,
  });

  return (
    <div className="space-y-6">
      <Link
        href={`/leads/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {client.name}
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Circle className="h-7 w-7 text-primary" />
          Distant healing
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {group
            ? "Group active. Healers post daily updates via WhatsApp; coordinator logs them here."
            : "Set up the dedicated WhatsApp group for this client's distant healing."}
        </p>
      </header>

      {sp.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Group setup */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MessagesSquare className="h-4 w-4" />
                WhatsApp group
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={enableGroupAction} className="space-y-4">
                <input type="hidden" name="clientId" value={client.id} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="whatsappGroupName" className="text-sm font-medium">
                      Group name
                    </label>
                    <input
                      id="whatsappGroupName"
                      name="whatsappGroupName"
                      defaultValue={group?.whatsappGroupName ?? `Healing – ${client.name}`}
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="whatsappGroupLink" className="text-sm font-medium">
                      Group invite link
                    </label>
                    <input
                      id="whatsappGroupLink"
                      name="whatsappGroupLink"
                      type="url"
                      placeholder="https://chat.whatsapp.com/…"
                      defaultValue={group?.whatsappGroupLink ?? ""}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="photoUrl" className="text-sm font-medium">
                    Client photo URL (optional)
                  </label>
                  <input
                    id="photoUrl"
                    name="photoUrl"
                    type="url"
                    placeholder="Paste a photo URL; leave blank if private."
                    defaultValue={group?.photoUrl ?? ""}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="problemAreas" className="text-sm font-medium">
                    Problem areas
                  </label>
                  <textarea
                    id="problemAreas"
                    name="problemAreas"
                    rows={3}
                    defaultValue={group?.problemAreas ?? ""}
                    placeholder="e.g. lower back, sleep disturbance, anxiety"
                    className={`${inputCls} min-h-20 resize-y py-2`}
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {group ? "Update" : "Enable distant healing"}
                </button>
              </form>
            </CardContent>
          </Card>

          {group && (
            <>
              {/* Copy-paste message templates */}
              <Card className="rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Copy className="h-4 w-4" />
                    Copy &amp; paste into the group
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Standard data format (intro post)
                    </p>
                    <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-sans text-sm">
                      {standardMessage}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Healer update template
                    </p>
                    <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-sans text-sm">
                      {healerUpdateFormat()}
                    </pre>
                  </div>
                  {group.whatsappGroupLink && (
                    <a
                      href={group.whatsappGroupLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open group in WhatsApp
                    </a>
                  )}
                </CardContent>
              </Card>

              {/* Healer update form */}
              <Card className="rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Log healer update
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={addHealerUpdateAction} className="space-y-4">
                    <input type="hidden" name="distantGroupId" value={group.id} />
                    <input type="hidden" name="clientId" value={client.id} />

                    <div className="space-y-1.5">
                      <label htmlFor="healerId" className="text-sm font-medium">Healer *</label>
                      <select id="healerId" name="healerId" required defaultValue="" className={inputCls}>
                        <option value="" disabled>Select…</option>
                        {healers.map((h) => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Chakras worked</label>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {CHAKRAS.map((c) => (
                          <label key={c.value} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/40">
                            <input type="checkbox" name="chakras" value={c.value} className="h-4 w-4" />
                            {c.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="process" className="text-sm font-medium">Process</label>
                        <input id="process" name="process" className={inputCls} />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="durationMinutes" className="text-sm font-medium">Duration (min)</label>
                        <input id="durationMinutes" name="durationMinutes" type="number" min={1} max={300} className={inputCls} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="remarks" className="text-sm font-medium">Remarks</label>
                      <textarea id="remarks" name="remarks" rows={3} className={`${inputCls} min-h-20 resize-y py-2`} />
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="postedToWhatsApp" value="true" className="h-4 w-4" />
                      Already posted to WhatsApp group
                    </label>

                    <button
                      type="submit"
                      className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Save update
                    </button>
                  </form>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="space-y-6">
          {/* Feedback form */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Log client feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addFeedbackAction} className="space-y-3">
                <input type="hidden" name="clientId" value={client.id} />
                <textarea
                  name="content"
                  rows={4}
                  required
                  minLength={2}
                  placeholder="Paste what the client shared — energy change, pain levels, sleep, mood…"
                  className={`${inputCls} min-h-24 resize-y py-2`}
                />
                <div className="space-y-1.5">
                  <label htmlFor="rating" className="text-xs text-muted-foreground">Rating (1–5)</label>
                  <input id="rating" name="rating" type="number" min={1} max={5} className={inputCls} />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
                >
                  Save feedback
                </button>
              </form>
            </CardContent>
          </Card>

          {/* Recent updates + feedback */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {updates.length === 0 && feedback.length === 0 && (
                <p className="text-xs text-muted-foreground">Nothing yet.</p>
              )}
              {[
                ...updates.map((u) => ({
                  kind: "update" as const,
                  at: u.date,
                  key: `u-${u.id}`,
                  title: `${u.healer.name} — healer update`,
                  detail: [
                    u.chakras.length > 0 && `${u.chakras.length} chakra${u.chakras.length > 1 ? "s" : ""}`,
                    u.durationMinutes && `${u.durationMinutes}m`,
                    u.process,
                  ].filter(Boolean).join(" · "),
                  remarks: u.remarks,
                })),
                ...feedback.map((f) => ({
                  kind: "feedback" as const,
                  at: f.submittedAt,
                  key: `f-${f.id}`,
                  title: `Client feedback${f.rating ? ` (${f.rating}★)` : ""}`,
                  detail: "",
                  remarks: f.content,
                })),
              ]
                .sort((a, b) => b.at.getTime() - a.at.getTime())
                .slice(0, 15)
                .map((e) => (
                  <div key={e.key} className="border-l-2 border-border pl-3">
                    <p className="text-xs font-medium">{e.title}</p>
                    {e.detail && <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>}
                    {e.remarks && <p className="mt-0.5 text-xs">{e.remarks}</p>}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {format(e.at, "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
