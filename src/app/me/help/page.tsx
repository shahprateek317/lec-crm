"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ChevronLeft, HelpCircle, Search, ChevronDown, ChevronUp, Phone, MessageCircle, CalendarHeart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type FaqEntry = {
  id: string; faqCode: string; category: string;
  question: string; answer: string; keywords: string[];
};

export default function MeHelpPage() {
  const [faqs, setFaqs] = useState<FaqEntry[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/faq").then((r) => r.json()).then(setFaqs);
  }, []);

  const categories = Array.from(new Set(faqs.map((f) => f.category)));

  const filtered = faqs.filter((f) => {
    const matchCat = !activeCategory || f.category === activeCategory;
    const q = query.toLowerCase();
    const matchQ = !q ||
      f.question.toLowerCase().includes(q) ||
      f.answer.toLowerCase().includes(q) ||
      f.keywords.some((k) => k.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  const grouped = filtered.reduce<Record<string, FaqEntry[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Link href="/me" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to your portal
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-2xl font-medium tracking-tight">
          <HelpCircle className="h-6 w-6 text-primary" />
          Help & FAQ
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find answers about your sessions, payments and wellness journey.
        </p>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveCategory(""); }}
          placeholder="Search questions…"
          className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Category chips */}
      {!query && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory("")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!activeCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c === activeCategory ? "" : c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${activeCategory === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* FAQ accordion */}
      {Object.entries(grouped).map(([category, entries]) => (
        <div key={category} className="space-y-2">
          {(!activeCategory || query) && (
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">{category}</p>
          )}
          <Card className="rounded-2xl">
            <CardContent className="py-1 divide-y divide-border">
              {entries.map((f) => (
                <div key={f.id}>
                  <button
                    className="flex w-full items-start justify-between gap-3 py-4 text-left"
                    onClick={() => setOpenId(openId === f.id ? null : f.id)}
                  >
                    <span className="text-sm font-medium text-foreground">{f.question}</span>
                    {openId === f.id
                      ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                      : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />}
                  </button>
                  {openId === f.id && (
                    <div className="pb-4 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                      {f.answer}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}

      {filtered.length === 0 && faqs.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No results for &ldquo;{query}&rdquo;. Try a different word or browse categories.
          </CardContent>
        </Card>
      )}

      {/* Still have a question? */}
      <Card className="rounded-2xl border-primary/20 bg-primary/5">
        <CardContent className="py-5 space-y-3">
          <p className="text-sm font-medium text-foreground text-center">Still have a question?</p>
          <p className="text-xs text-muted-foreground text-center">We&rsquo;re happy to help personally.</p>
          <div className="flex flex-col gap-2">
            <a
              href="tel:+919163315936"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Phone className="h-4 w-4" />
              Call the Centre
            </a>
            <a
              href="https://wa.me/919163315936"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              WhatsApp Counsellor
            </a>
            <Link
              href="/me"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted"
            >
              <CalendarHeart className="h-4 w-4 text-primary" />
              Book Counselling
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Important notice:</strong> Life Energy Centre provides complementary wellness practices, counselling, meditation and educational programmes. Pranic Healing is not a substitute for appropriate medical diagnosis, treatment or emergency medical care. Clients should continue consulting qualified healthcare professionals regarding medical conditions and prescribed treatments.
      </div>
    </div>
  );
}
