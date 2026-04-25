import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Camera, FileText, BarChart3 } from "lucide-react";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvailabilityGrid } from "@/components/availability-grid";
import { t } from "@/lib/i18n";
import {
  updateUserBasicsAction,
  updateHealerProfileAction,
  updateCounsellorProfileAction,
  updateCoordinatorProfileAction,
  updateAdminProfileAction,
  resetPasswordAction,
} from "../actions";

export const dynamic = "force-dynamic";

const ROLES = ["SUPER_ADMIN", "ADMIN", "COORDINATOR", "COUNSELLOR", "SENIOR_COUNSELLOR", "HEALER", "SENIOR_HEALER", "ACCOUNTS", "MARKETING_MANAGER", "VIEWER"] as const;
const PH_LEVEL_OPTIONS = [
  { v: "BPH",                label: "Basic Pranic Healing" },
  { v: "APH",                label: "Advanced Pranic Healing" },
  { v: "PSYCHOTHERAPY",      label: "Psychotherapy" },
  { v: "CRYSTAL_HEALING",    label: "Crystal Healing" },
  { v: "ARHATIC_PREP",       label: "Arhatic Prep" },
  { v: "ACPH",               label: "ACPH" },
  { v: "CPH",                label: "CPH" },
  { v: "KRIYASHAKTI",        label: "Kriyashakti" },
  { v: "TWIN_HEART_TRAINER", label: "Twin Heart Trainer" },
  { v: "OTHER",              label: "Other" },
];
const TIME_BANDS = [
  { v: "EARLY_MORNING", label: "Early morning (6–9)" },
  { v: "MORNING",       label: "Morning (9–12)" },
  { v: "AFTERNOON",     label: "Afternoon (12–4)" },
  { v: "EVENING",       label: "Evening (4–7)" },
  { v: "NIGHT",         label: "Night (7–10)" },
];
const DAYS = [
  { v: "MON", label: "Mon" }, { v: "TUE", label: "Tue" }, { v: "WED", label: "Wed" },
  { v: "THU", label: "Thu" }, { v: "FRI", label: "Fri" }, { v: "SAT", label: "Sat" },
  { v: "SUN", label: "Sun" },
];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return { title: u?.name ?? "Staff" };
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/dashboard");
  const { id } = await params;
  const sp = await searchParams;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  // Make sure the role profile exists so the form has a row to update.
  await ensureProfile(user.id, user.role);

  const [healer, counsellor, coordinator, admin, recentSessions, recentCounsellings] = await Promise.all([
    prisma.healerProfile.findUnique({ where: { userId: id } }),
    prisma.counsellorProfile.findUnique({ where: { userId: id } }),
    prisma.coordinatorProfile.findUnique({ where: { userId: id } }),
    prisma.adminProfile.findUnique({ where: { userId: id } }),
    prisma.healingSession.count({ where: { healerId: id } }),
    prisma.counselingSession.count({ where: { counsellorId: id } }),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/settings/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to staff
      </Link>

      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">{user.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.roles[user.role as keyof typeof t.roles] ?? user.role}
          {user.employeeCode ? ` · ${user.employeeCode}` : ""}
          {!user.active && " · INACTIVE"}
        </p>
      </header>

      {sp.ok && <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-900">Saved.</p>}
      {sp.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      {/* ── Basic details ── */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Basic details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateUserBasicsAction} className="space-y-4">
            <input type="hidden" name="id" value={user.id} />

            <div className="grid gap-4 md:grid-cols-2">
              <Field id="name" label="Full name" required>
                <input id="name" name="name" defaultValue={user.name} required minLength={2} className={inputCls} />
              </Field>
              <Field id="email" label="Email (login)">
                <input id="email" name="email" type="email" defaultValue={user.email} readOnly className={`${inputCls} cursor-not-allowed bg-muted`} />
              </Field>

              <Field id="phone" label="Phone">
                <input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} className={inputCls} />
              </Field>
              <Field id="whatsappPhone" label="WhatsApp number">
                <input id="whatsappPhone" name="whatsappPhone" type="tel" defaultValue={user.whatsappPhone ?? ""} className={inputCls} placeholder="If different from phone" />
              </Field>

              <Field id="role" label="Role" required>
                <select id="role" name="role" defaultValue={user.role} required className={inputCls}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{t.roles[r as keyof typeof t.roles]}</option>
                  ))}
                </select>
              </Field>
              <Field id="gender" label="Gender">
                <select id="gender" name="gender" defaultValue={user.gender ?? ""} className={inputCls}>
                  <option value="">—</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
              </Field>

              <Field id="dob" label="Date of birth">
                <input id="dob" name="dob" type="date" defaultValue={user.dob ? user.dob.toISOString().slice(0, 10) : ""} className={inputCls} />
              </Field>
              <Field id="joiningDate" label="Joining date">
                <input id="joiningDate" name="joiningDate" type="date" defaultValue={user.joiningDate ? user.joiningDate.toISOString().slice(0, 10) : ""} className={inputCls} />
              </Field>

              <Field id="areaCity" label="Area / city">
                <input id="areaCity" name="areaCity" defaultValue={user.areaCity ?? ""} className={inputCls} />
              </Field>
              <Field id="emergencyContact" label="Emergency contact">
                <input id="emergencyContact" name="emergencyContact" defaultValue={user.emergencyContact ?? ""} className={inputCls} placeholder="Name + phone" />
              </Field>
            </div>

            <Field id="address" label="Address">
              <textarea id="address" name="address" rows={2} defaultValue={user.address ?? ""} className={`${inputCls} min-h-16 resize-y py-2`} />
            </Field>

            <Field id="remarks" label="Internal remarks">
              <textarea id="remarks" name="remarks" rows={2} defaultValue={user.remarks ?? ""} className={`${inputCls} min-h-16 resize-y py-2`} placeholder="Notes only visible to admins." />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" value="true" defaultChecked={user.active} className="h-4 w-4" />
              Active (can sign in &amp; receive assignments)
            </label>

            <SaveButton />
          </form>
        </CardContent>
      </Card>

      {/* ── Role-specific profile ── */}
      {(user.role === "HEALER" || user.role === "SENIOR_HEALER") && healer && (
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Healer profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateHealerProfileAction} className="space-y-5">
              <input type="hidden" name="userId" value={user.id} />

              <Section title="Professional">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field id="experienceYears" label="Years of healing experience">
                    <input id="experienceYears" name="experienceYears" type="number" min={0} defaultValue={healer.experienceYears ?? ""} className={inputCls} />
                  </Field>
                  <Field id="languages" label="Languages (comma-separated)">
                    <input id="languages" name="languages" defaultValue={healer.languages.join(", ")} className={inputCls} placeholder="English, Hindi, Bengali" />
                  </Field>
                </div>
                <Field label="PH levels (multi-select)">
                  <CheckboxGrid name="phLevels" options={PH_LEVEL_OPTIONS} selected={healer.phLevels as string[]} />
                </Field>
              </Section>

              <Section title="Modes &amp; availability">
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle name="acceptsInPerson" label="In-person at the centre" defaultChecked={healer.acceptsInPerson} />
                  <Toggle name="acceptsDistant"  label="Distant healing" defaultChecked={healer.acceptsDistant} />
                </div>
                <Field label="Weekly availability — tap or drag to paint">
                  <AvailabilityGrid defaultSelected={healer.availabilitySlots} />
                </Field>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field id="maxHealingsPerDay" label="Max healings / day">
                    <input id="maxHealingsPerDay" name="maxHealingsPerDay" type="number" min={1} defaultValue={healer.maxHealingsPerDay ?? ""} className={inputCls} />
                  </Field>
                  <Field id="daysPriorNoticeRequired" label="Notice required (days)">
                    <input id="daysPriorNoticeRequired" name="daysPriorNoticeRequired" type="number" min={0} defaultValue={healer.daysPriorNoticeRequired} className={inputCls} />
                  </Field>
                  <Toggle name="emergencySameDay" label="Emergency / same-day" defaultChecked={healer.emergencySameDay} />
                </div>
              </Section>

              <Section title="Location">
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle name="canVisitCentre"   label="Can visit the centre" defaultChecked={healer.canVisitCentre} />
                  <Toggle name="homeVisitPossible" label="Open to home visits" defaultChecked={healer.homeVisitPossible} />
                </div>
              </Section>

              <Section title="Assignment preferences">
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle name="acceptsDemoFree"      label="Accepts demo / free sessions" defaultChecked={healer.acceptsDemoFree} />
                  <Toggle name="acceptsPaidOnly"      label="Paid only" defaultChecked={healer.acceptsPaidOnly} />
                  <Toggle name="acceptsNewLeads"      label="New leads ok" defaultChecked={healer.acceptsNewLeads} />
                  <Toggle name="prefersRepeatClients" label="Prefers repeat clients" defaultChecked={healer.prefersRepeatClients} />
                </div>
                <Field id="focusAreas" label="Focus areas (comma-separated)">
                  <input id="focusAreas" name="focusAreas" defaultValue={healer.focusAreas.join(", ")} className={inputCls} placeholder="Back pain, anxiety, sleep…" />
                </Field>
              </Section>

              <Section title="Strategic toggles">
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle name="acceptsUrgentCases"   label="Accepts urgent cases" defaultChecked={healer.acceptsUrgentCases} />
                  <Toggle name="acceptsChildCases"    label="Comfortable with children" defaultChecked={healer.acceptsChildCases} />
                  <Toggle name="acceptsElderlyCases"  label="Comfortable with elderly" defaultChecked={healer.acceptsElderlyCases} />
                  <Toggle name="weekendAvailable"     label="Available on weekends" defaultChecked={healer.weekendAvailable} />
                  <Toggle name="groupHealingAvailable" label="Open to group healing" defaultChecked={healer.groupHealingAvailable} />
                </div>
              </Section>

              <Section title="Commercial">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field id="perSessionCharge" label="Per-session charge (₹)">
                    <input id="perSessionCharge" name="perSessionCharge" type="number" min={0} defaultValue={healer.perSessionCharge ?? ""} className={inputCls} />
                  </Field>
                  <Field id="demoSessionCharge" label="Demo charge (₹)">
                    <input id="demoSessionCharge" name="demoSessionCharge" type="number" min={0} defaultValue={healer.demoSessionCharge ?? ""} className={inputCls} />
                  </Field>
                  <Field id="revenueSharePercent" label="Revenue share (%)">
                    <input id="revenueSharePercent" name="revenueSharePercent" type="number" min={0} max={100} defaultValue={healer.revenueSharePercent ?? ""} className={inputCls} />
                  </Field>
                  <Field id="paymentMode" label="Payment mode">
                    <select id="paymentMode" name="paymentMode" defaultValue={healer.paymentMode ?? ""} className={inputCls}>
                      <option value="">—</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank">Bank transfer</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </Field>
                </div>
              </Section>

              <SaveButton />
            </form>
          </CardContent>
        </Card>
      )}

      {(user.role === "COUNSELLOR" || user.role === "SENIOR_COUNSELLOR") && counsellor && (
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Counsellor profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateCounsellorProfileAction} className="space-y-5">
              <input type="hidden" name="userId" value={user.id} />

              <div className="grid gap-4 md:grid-cols-2">
                <Field id="experienceYears" label="Counselling experience (years)">
                  <input id="experienceYears" name="experienceYears" type="number" min={0} defaultValue={counsellor.experienceYears ?? ""} className={inputCls} />
                </Field>
                <Field id="maxSessionsPerDay" label="Max sessions / day">
                  <input id="maxSessionsPerDay" name="maxSessionsPerDay" type="number" min={1} defaultValue={counsellor.maxSessionsPerDay ?? ""} className={inputCls} />
                </Field>
                <Field id="languages" label="Languages (comma-separated)">
                  <input id="languages" name="languages" defaultValue={counsellor.languages.join(", ")} className={inputCls} />
                </Field>
                <Field id="specializations" label="Specialisations (comma-separated)">
                  <input id="specializations" name="specializations" defaultValue={counsellor.specializations.join(", ")} className={inputCls} placeholder="Stress, anxiety, relationships" />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Toggle name="acceptsOnline"  label="Online counselling" defaultChecked={counsellor.acceptsOnline} />
                <Toggle name="acceptsOffline" label="In-person counselling" defaultChecked={counsellor.acceptsOffline} />
              </div>

              <Field label="Weekly availability — tap or drag to paint">
                <AvailabilityGrid defaultSelected={counsellor.availabilitySlots} />
              </Field>

              <Section title="CRM permissions">
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle name="canCloseLead"      label="Can mark lead as Lost" defaultChecked={counsellor.canCloseLead} />
                  <Toggle name="canAssignVisit"    label="Can schedule visits" defaultChecked={counsellor.canAssignVisit} />
                  <Toggle name="canOffer99Program" label="Can offer ₹99 program" defaultChecked={counsellor.canOffer99Program} />
                  <Toggle name="incentiveEligible" label="Incentive-eligible" defaultChecked={counsellor.incentiveEligible} />
                </div>
              </Section>

              <SaveButton />
            </form>
          </CardContent>
        </Card>
      )}

      {user.role === "COORDINATOR" && coordinator && (
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Coordinator profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateCoordinatorProfileAction} className="space-y-5">
              <input type="hidden" name="userId" value={user.id} />

              <Section title="Responsibilities">
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle name="handlesLeads"            label="Handles leads"             defaultChecked={coordinator.handlesLeads} />
                  <Toggle name="handlesFollowUp"         label="Handles follow-ups"        defaultChecked={coordinator.handlesFollowUp} />
                  <Toggle name="handlesWhatsAppGroups"   label="Handles WhatsApp groups"   defaultChecked={coordinator.handlesWhatsAppGroups} />
                  <Toggle name="handlesPaymentFollowUp"  label="Handles payment follow-up" defaultChecked={coordinator.handlesPaymentFollowUp} />
                  <Toggle name="handlesScheduling"       label="Handles scheduling"        defaultChecked={coordinator.handlesScheduling} />
                </div>
              </Section>

              <div className="grid gap-4 md:grid-cols-2">
                <Field id="maxCallsPerDay" label="Max calls / day">
                  <input id="maxCallsPerDay" name="maxCallsPerDay" type="number" min={1} defaultValue={coordinator.maxCallsPerDay ?? ""} className={inputCls} />
                </Field>
                <Field id="shiftTiming" label="Shift timing">
                  <input id="shiftTiming" name="shiftTiming" defaultValue={coordinator.shiftTiming ?? ""} placeholder="e.g. 10:00 – 18:00" className={inputCls} />
                </Field>
                <Field id="languages" label="Languages (comma-separated)">
                  <input id="languages" name="languages" defaultValue={coordinator.languages.join(", ")} className={inputCls} />
                </Field>
              </div>

              <SaveButton />
            </form>
          </CardContent>
        </Card>
      )}

      {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && admin && (
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Admin permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateAdminProfileAction} className="space-y-4">
              <input type="hidden" name="userId" value={user.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <Toggle name="isSuperAdmin"       label="Super Admin (cannot be disabled by other admins)" defaultChecked={admin.isSuperAdmin} />
                <Toggle name="fullCrmAccess"      label="Full CRM access" defaultChecked={admin.fullCrmAccess} />
                <Toggle name="userCreationRights" label="User creation rights" defaultChecked={admin.userCreationRights} />
                <Toggle name="reportAccess"       label="Report access" defaultChecked={admin.reportAccess} />
                <Toggle name="financeAccess"      label="Finance access" defaultChecked={admin.financeAccess} />
                <Toggle name="dashboardAccess"    label="Dashboard access" defaultChecked={admin.dashboardAccess} />
              </div>
              <p className="text-xs text-muted-foreground">
                Note: granular permission enforcement is coming as the centre grows. Today, role-based
                access (Admin / Coordinator / Counsellor / Healer) governs what each person sees.
              </p>
              <SaveButton />
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Performance & uploads (placeholder) ── */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Activity at a glance
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Stat icon={<BarChart3 className="h-4 w-4" />} label="Healing sessions logged" value={recentSessions} />
          <Stat icon={<BarChart3 className="h-4 w-4" />} label="Counselling sessions logged" value={recentCounsellings} />
          <Stat icon={<BarChart3 className="h-4 w-4" />} label="Last login" value={user.lastLoginAt ? user.lastLoginAt.toLocaleString("en-IN") : "—"} />
        </CardContent>
      </Card>

      <Card className="rounded-xl border-dashed">
        <CardContent className="space-y-2 p-5 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Coming later (per master-data spec)
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Camera className="h-4 w-4" /> Profile photo upload</li>
            <li className="flex items-center gap-2"><FileText className="h-4 w-4" /> Certification upload (healers)</li>
            <li className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Auto-tracked metrics: avg rating, conversion-to-paid, repeat bookings</li>
            <li className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Auto-assignment engine (matches healer prefs to incoming clients)</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            These are scheduled for a follow-up iteration once the basic flow has user feedback.
          </p>
        </CardContent>
      </Card>

      {/* ── Reset password ── */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Reset password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={resetPasswordAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={user.id} />
            <div className="space-y-1.5">
              <label htmlFor="newPassword" className="text-sm font-medium">New temporary password</label>
              <input id="newPassword" name="newPassword" type="text" minLength={6} required className={inputCls} placeholder="at least 6 characters" />
            </div>
            <button type="submit" className="inline-flex h-10 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
              Reset
            </button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Share this with the staff member privately; ask them to change it after first sign-in.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-border pt-4 first:border-0 first:pt-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/40">
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}

function CheckboxGrid({
  name,
  options,
  selected,
}: {
  name: string;
  options: ReadonlyArray<{ v: string; label: string }>;
  selected: ReadonlyArray<string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {options.map((o) => (
        <label key={o.v} className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/40">
          <input type="checkbox" name={name} value={o.v} defaultChecked={selected.includes(o.v)} className="h-4 w-4" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function SaveButton() {
  return (
    <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
      Save changes
    </button>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon} {label}</p>
      <p className="mt-1 font-serif text-xl">{value}</p>
    </div>
  );
}
