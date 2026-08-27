// "My profile" — healer (and counsellor / coordinator) self-service editing.
//
// Per dad's "Update the existing Healing" doc + UX correction: the centre
// doesn't have copies of healers' MCKS certificates — healers got them
// personally, so admin can't upload on their behalf. This page lets a
// healer add/remove certifications and edit their own availability + focus
// areas without needing admin help.
//
// Scope tonight:
//   • Edit core availability + experience + focus areas (HealerProfile)
//   • Add certification METADATA (title, issuing body, issued date)
//   • File upload itself ships in the next iteration once we have the S3
//     uploads bucket + presigned URL helper wired (the schema is already
//     in place — HealerCertificate.storageKey).

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToaster } from "@/components/flash-toaster";
import { AvailabilityGrid } from "@/components/availability-grid";
import { SubmitButton } from "@/components/submit-button";
import { ChevronLeft, UserCircle, ShieldCheck, FileText, Hourglass, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { saveMyProfileAction, addCertificationAction, deleteCertificationAction } from "./actions";
import { CertFileUploader } from "@/components/cert-file-uploader";

export const dynamic = "force-dynamic";
export const metadata = { title: "My profile" };

export default async function MyProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/me/profile");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      healerProfile: true,
      counsellorProfile: true,
      certifications: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!me) redirect("/sign-in");

  const isHealer = me.roles.includes("HEALER") || me.roles.includes("SENIOR_HEALER");

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <UserCircle className="h-7 w-7 text-primary" />
          My profile
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Update your availability, focus areas, and certifications. Changes
          take effect immediately for auto-assignment.
        </p>
      </header>

      <FlashToaster />

      {/* Identity (read-only — admin changes these via /settings/users) */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Name"          value={me.name} />
          <Field label="Email"         value={me.email} />
          <Field label="Role"          value={me.roles.map(r => r.replace(/_/g, " ").toLowerCase()).join(", ")} />
          <Field label="Employee code" value={me.employeeCode ?? "—"} />
        </CardContent>
      </Card>

      {isHealer && me.healerProfile && (
        <>
          {/* Availability + focus areas (editable) */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                Healer profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={saveMyProfileAction} className="space-y-5">
                <input type="hidden" name="userId" value={me.id} />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Labeled label="Years of experience">
                    <input
                      name="experienceYears"
                      type="number"
                      min="0"
                      max="60"
                      defaultValue={me.healerProfile.experienceYears ?? ""}
                      className={inputCls}
                    />
                  </Labeled>
                  <Labeled label="Max healings per day">
                    <input
                      name="maxHealingsPerDay"
                      type="number"
                      min="1"
                      max="20"
                      defaultValue={me.healerProfile.maxHealingsPerDay ?? ""}
                      className={inputCls}
                    />
                  </Labeled>
                </div>

                <Labeled label="Focus areas (comma-separated)">
                  <input
                    name="focusAreas"
                    defaultValue={me.healerProfile.focusAreas.join(", ")}
                    placeholder="Stress, Back pain, Anxiety, Sleep"
                    className={inputCls}
                  />
                </Labeled>

                <Labeled label="Languages (comma-separated)">
                  <input
                    name="languages"
                    defaultValue={me.healerProfile.languages.join(", ")}
                    placeholder="English, Bengali, Hindi"
                    className={inputCls}
                  />
                </Labeled>

                <div>
                  <p className="mb-2 text-sm font-medium">Available time bands</p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Tap or drag to toggle slots. The auto-assignment engine
                    only offers you sessions during selected bands.
                  </p>
                  <AvailabilityGrid defaultSelected={me.healerProfile.availabilitySlots} />
                </div>

                <SubmitButton
                  pendingLabel="Saving…"
                  className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Save changes
                </SubmitButton>
              </form>
            </CardContent>
          </Card>

          {/* Certifications */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                Certifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {me.certifications.length > 0 ? (
                <ul className="divide-y divide-border">
                  {me.certifications.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{c.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.issuingBody ?? "—"}
                          {c.issuedAt ? ` · issued ${format(c.issuedAt, "MMM yyyy")}` : ""}
                          {c.expiresAt ? ` · expires ${format(c.expiresAt, "MMM yyyy")}` : ""}
                        </p>
                        <p className="mt-1 inline-flex flex-wrap items-center gap-1 text-[11px]">
                          {c.verifiedAt ? (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-900">
                              Verified by admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
                              <Hourglass className="h-3 w-3" /> Pending verification
                            </span>
                          )}
                          {c.documentId ? (
                            <Link
                              href={`/api/documents/${c.documentId}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-900 hover:bg-emerald-200"
                            >
                              <FileText className="h-3 w-3" />
                              View file
                            </Link>
                          ) : (
                            <CertFileUploader certId={c.id} />
                          )}
                        </p>
                      </div>
                      <form action={deleteCertificationAction}>
                        <input type="hidden" name="certId" value={c.id} />
                        <SubmitButton
                          pendingLabel="…"
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Remove
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No certifications recorded yet. Add the ones you've earned
                  (MCKS Basic / Advanced Pranic Healing, Pranic Psychotherapy,
                  Arhatic Yoga, etc.) below — admin will verify when the
                  upload is checked.
                </p>
              )}

              {/* Add a new certification (metadata only for now). */}
              <form action={addCertificationAction} className="space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <FileText className="h-4 w-4" />
                  Add a certification
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Labeled label="Title">
                    <input name="title" required placeholder="Basic Pranic Healing (MCKS)" className={inputCls} />
                  </Labeled>
                  <Labeled label="Issuing body">
                    <input
                      name="issuingBody"
                      placeholder="MCKS Institute of Inner Studies"
                      className={inputCls}
                    />
                  </Labeled>
                  <Labeled label="Issued (year/month)">
                    <input name="issuedAt" type="month" className={inputCls} />
                  </Labeled>
                  <Labeled label="Expires (if applicable)">
                    <input name="expiresAt" type="month" className={inputCls} />
                  </Labeled>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Add the metadata first — once saved, an &ldquo;Attach file&rdquo; button
                  appears so you can upload the PDF/photo (max 5 MB). Files are
                  stored privately; only you, the centre admin, and the quality
                  controller can view them.
                </p>
                <SubmitButton
                  pendingLabel="Adding…"
                  className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Add certification
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm capitalize">{value}</p>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
