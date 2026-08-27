"use client";

import { SubmitButton } from "@/components/submit-button";
import { saveFaqAction } from "./actions";

const CATEGORIES = [
  "About Life Energy Centre",
  "Pranic Healing",
  "Appointments",
  "Healing Sessions",
  "Healing Summary",
  "Meditation",
  "Courses",
  "Payments",
  "Privacy",
  "General Questions",
];

const inputCls = "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaCls = "flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y";

type Props = {
  faq?: {
    id: string; faqCode: string; category: string; question: string;
    answer: string; keywords: string[]; relatedService: string | null;
    displayOrder: number; internalNote: string | null; active: boolean; version: number;
  };
};

export function FaqForm({ faq }: Props) {
  return (
    <form action={saveFaqAction} className="space-y-5">
      {faq && <input type="hidden" name="id" value={faq.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Category *</label>
          <select name="category" defaultValue={faq?.category ?? ""} required className={inputCls}>
            <option value="">Select category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Related Service</label>
          <input name="relatedService" defaultValue={faq?.relatedService ?? ""} placeholder="e.g. Pranic Healing" className={inputCls} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Question *</label>
        <input name="question" defaultValue={faq?.question ?? ""} required placeholder="What is…" className={inputCls} />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Answer *</label>
        <textarea name="answer" defaultValue={faq?.answer ?? ""} required rows={5} placeholder="Full answer shown to client…" className={textareaCls} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Keywords</label>
          <input name="keywords" defaultValue={faq?.keywords.join(", ") ?? ""} placeholder="stress, healing, chakra (comma-separated)" className={inputCls} />
          <p className="text-[11px] text-muted-foreground">Comma-separated. Used for client search.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Display Order</label>
          <input name="displayOrder" type="number" defaultValue={faq?.displayOrder ?? 0} className={inputCls} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Internal Staff Note <span className="text-muted-foreground font-normal">(not shown to clients)</span></label>
        <textarea name="internalNote" defaultValue={faq?.internalNote ?? ""} rows={3} placeholder="Suggested staff response, CRM action, escalation notes…" className={textareaCls} />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Status</label>
        <select name="active" defaultValue={String(faq?.active ?? true)} className={inputCls}>
          <option value="true">Active — visible to clients</option>
          <option value="false">Inactive — hidden from clients</option>
        </select>
      </div>

      {faq && (
        <p className="text-xs text-muted-foreground">
          {faq.faqCode} · Version {faq.version} · Saving will increment version.
        </p>
      )}

      <SubmitButton
        pendingLabel="Saving…"
        className="h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {faq ? "Save changes" : "Create FAQ"}
      </SubmitButton>
    </form>
  );
}
