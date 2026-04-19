// Credit & payment helpers. Keeps the ledger consistent by always writing
// payment/credit pairs inside a single transaction.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/providers/payment";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import type { Chakra } from "@prisma/client";

/** Current credit balance for a client (signed sum of ledger deltas). */
export async function getCreditBalance(clientId: string): Promise<number> {
  const entries = await prisma.creditLedgerEntry.aggregate({
    where: { clientId },
    _sum: { delta: true },
  });
  return entries._sum.delta ?? 0;
}

/** Current credit balance for many clients at once — keyed by clientId. */
export async function getCreditBalances(clientIds: string[]): Promise<Record<string, number>> {
  if (clientIds.length === 0) return {};
  const rows = await prisma.creditLedgerEntry.groupBy({
    by: ["clientId"],
    where: { clientId: { in: clientIds } },
    _sum: { delta: true },
  });
  const out: Record<string, number> = {};
  for (const id of clientIds) out[id] = 0;
  for (const r of rows) out[r.clientId] = r._sum.delta ?? 0;
  return out;
}

// ── Payments ──────────────────────────────────────────────────────────
export const createPaymentSchema = z.object({
  clientId: z.string().min(1),
  packageId: z.string().optional(),
  amount: z.coerce.number().int().positive(),
  creditsGranted: z.coerce.number().int().min(0),
  notes: z.string().max(500).optional(),
});

/** Create a pending payment, generate a provider link, and WhatsApp it. */
export async function createPayment(input: z.infer<typeof createPaymentSchema>) {
  const parsed = createPaymentSchema.parse(input);
  const client = await prisma.client.findUniqueOrThrow({ where: { id: parsed.clientId } });

  // Step 1: create a PENDING payment row so we have an id to reference.
  const payment = await prisma.payment.create({
    data: {
      clientId: parsed.clientId,
      packageId: parsed.packageId,
      amount: parsed.amount,
      creditsGranted: parsed.creditsGranted,
      status: "PENDING",
      notes: parsed.notes,
    },
  });

  // Step 2: create the payment link with provider.
  const link = await getPaymentProvider().createPaymentLink({
    amount: parsed.amount,
    description: `Pranic healing credits (${parsed.creditsGranted})`,
    client: { id: client.id, name: client.name, phone: client.phone, email: client.email },
    reference: payment.id,
  });

  // Step 3: save provider reference.
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerPaymentLinkId: link.providerLinkId,
      providerPaymentLinkUrl: link.url,
    },
  });

  // Step 4: WhatsApp the link (fire-and-forget).
  const pkg = parsed.packageId
    ? await prisma.creditPackage.findUnique({ where: { id: parsed.packageId } })
    : null;
  getWhatsAppProvider()
    .sendTemplate({
      clientId: client.id,
      phone: client.phone,
      templateName: "payment_link",
      variables: [
        client.name.split(" ")[0],
        pkg?.name ?? "Healing credits",
        String(parsed.amount),
        String(parsed.creditsGranted),
        link.url,
      ],
    })
    .catch((err) => console.error("[credits] payment_link WhatsApp failed", err));

  return updated;
}

/**
 * Mark a payment PAID and grant credits atomically. Idempotent:
 * calling it twice for the same payment only credits once.
 */
export async function markPaymentPaid(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status === "PAID") return payment;

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: "PAID", paidAt: new Date() },
    });

    if (payment.creditsGranted > 0) {
      const prior = await tx.creditLedgerEntry.aggregate({
        where: { clientId: payment.clientId },
        _sum: { delta: true },
      });
      const balanceAfter = (prior._sum.delta ?? 0) + payment.creditsGranted;
      await tx.creditLedgerEntry.create({
        data: {
          clientId: payment.clientId,
          delta: payment.creditsGranted,
          balanceAfter,
          reason: "Package purchase",
          paymentId: payment.id,
        },
      });
    }
    return updated;
  });
}

// ── Healing sessions ──────────────────────────────────────────────────
export const logHealingSchema = z.object({
  clientId: z.string().min(1),
  healerId: z.string().min(1),
  mode: z.enum(["IN_PERSON", "DISTANT"]).default("IN_PERSON"),
  chakras: z.array(
    z.enum([
      "CROWN", "FOREHEAD", "AJNA", "THROAT", "HEART",
      "SOLAR_PLEXUS_FRONT", "SOLAR_PLEXUS_BACK", "NAVEL", "MENG_MEIN",
      "SPLEEN_FRONT", "SPLEEN_BACK", "SEX", "BASIC",
    ]),
  ).default([]),
  process: z.string().max(500).optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  remarks: z.string().max(2000).optional(),
  creditUsed: z.boolean().default(true),
});

/**
 * Record a healing session. If creditUsed, atomically deduct 1 credit from
 * the ledger. If balance would go negative, throws — caller should gate
 * the UI, but we guard the DB too.
 */
export async function logHealingSession(input: z.infer<typeof logHealingSchema>) {
  const parsed = logHealingSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const session = await tx.healingSession.create({
      data: {
        clientId: parsed.clientId,
        healerId: parsed.healerId,
        mode: parsed.mode,
        chakras: parsed.chakras as Chakra[],
        process: parsed.process,
        durationMinutes: parsed.durationMinutes,
        remarks: parsed.remarks,
        creditUsed: parsed.creditUsed,
      },
    });

    if (parsed.creditUsed) {
      const prior = await tx.creditLedgerEntry.aggregate({
        where: { clientId: parsed.clientId },
        _sum: { delta: true },
      });
      const currentBalance = prior._sum.delta ?? 0;
      if (currentBalance <= 0) {
        throw new Error("No credits available. Record a payment first or mark as complimentary.");
      }
      await tx.creditLedgerEntry.create({
        data: {
          clientId: parsed.clientId,
          delta: -1,
          balanceAfter: currentBalance - 1,
          reason: "Healing session",
          healingSessionId: session.id,
        },
      });

      // Move client to HEALING_ACTIVE if not already there.
      await tx.client.update({
        where: { id: parsed.clientId, stage: { in: ["VISIT_DONE", "HEALING_ACTIVE"] } },
        data: { stage: "HEALING_ACTIVE" },
      }).catch(() => void 0);
    }

    return session;
  });
}
