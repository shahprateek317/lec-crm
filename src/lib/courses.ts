// Course catalog + enrolment helpers.
// Key rule: a client can only enrol if they've completed all prerequisites.

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/providers/payment";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import { transitionStage } from "@/lib/pipeline";

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; missing: Array<{ id: string; name: string }>; completed: string[] };

/** Check whether a client can enrol in a course (all prereqs completed). */
export async function checkEligibility(clientId: string, courseId: string): Promise<EligibilityResult> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: { prerequisites: { include: { prerequisite: true } } },
  });
  if (course.prerequisites.length === 0) return { eligible: true };

  const clientEnrolments = await prisma.enrollment.findMany({
    where: { clientId, status: { in: ["COMPLETED", "IN_PROGRESS", "ENROLLED"] } },
  });
  const completedIds = new Set(clientEnrolments.filter((e) => e.status === "COMPLETED").map((e) => e.courseId));

  const missing = course.prerequisites
    .filter((p) => !completedIds.has(p.prerequisiteId))
    .map((p) => ({ id: p.prerequisiteId, name: p.prerequisite.name }));

  if (missing.length === 0) return { eligible: true };
  return { eligible: false, missing, completed: [...completedIds] };
}

export const enrolSchema = z.object({
  clientId: z.string().min(1),
  courseId: z.string().min(1),
  applyCreditsToFee: z.boolean().default(false),
  byUserId: z.string().min(1),
});

/**
 * Enrol a client. Creates a PENDING payment for the course fee (optionally
 * reduced by the value of their remaining healing credits at ₹500/credit,
 * per the spec's "prepaid amount adjustable in course fee" rule).
 */
export async function enrolClient(input: z.infer<typeof enrolSchema>) {
  const parsed = enrolSchema.parse(input);

  const eligibility = await checkEligibility(parsed.clientId, parsed.courseId);
  if (!eligibility.eligible) {
    throw new Error(
      `Missing prerequisite${eligibility.missing.length > 1 ? "s" : ""}: ${eligibility.missing.map((m) => m.name).join(", ")}`,
    );
  }

  const course = await prisma.course.findUniqueOrThrow({ where: { id: parsed.courseId } });
  const client = await prisma.client.findUniqueOrThrow({ where: { id: parsed.clientId } });

  return prisma.$transaction(async (tx) => {
    // "Already enrolled" + credit balance must be read inside the
    // transaction (Serializable below), otherwise two concurrent calls
    // (double-click, retried POST) can both pass the check and both debit
    // the same credit balance, driving the ledger negative.
    const existing = await tx.enrollment.findUnique({
      where: { clientId_courseId: { clientId: parsed.clientId, courseId: parsed.courseId } },
    });
    if (existing && existing.status !== "DROPPED") {
      throw new Error("Client is already enrolled in this course.");
    }

    let creditsToAdjust = 0;
    if (parsed.applyCreditsToFee) {
      const bal = await tx.creditLedgerEntry.aggregate({
        where: { clientId: parsed.clientId },
        _sum: { delta: true },
      });
      creditsToAdjust = Math.max(0, bal._sum.delta ?? 0);
    }
    const rupeeAdjust = creditsToAdjust * 500; // post-credit rate per spec
    const feeToPay = Math.max(0, course.fee - rupeeAdjust);

    const enrolment = await tx.enrollment.upsert({
      where: { clientId_courseId: { clientId: parsed.clientId, courseId: parsed.courseId } },
      create: {
        clientId: parsed.clientId,
        courseId: parsed.courseId,
        status: feeToPay === 0 ? "ENROLLED" : "PENDING_PAYMENT",
        feePaid: 0,
        creditsAdjustedAmount: rupeeAdjust,
        enrolledAt: feeToPay === 0 ? new Date() : null,
      },
      update: {
        status: feeToPay === 0 ? "ENROLLED" : "PENDING_PAYMENT",
        creditsAdjustedAmount: rupeeAdjust,
        enrolledAt: feeToPay === 0 ? new Date() : null,
      },
    });

    // Burn the adjusted credits from the ledger so they can't be reused.
    if (creditsToAdjust > 0) {
      const prior = await tx.creditLedgerEntry.aggregate({
        where: { clientId: parsed.clientId },
        _sum: { delta: true },
      });
      const balanceAfter = (prior._sum.delta ?? 0) - creditsToAdjust;
      await tx.creditLedgerEntry.create({
        data: {
          clientId: parsed.clientId,
          delta: -creditsToAdjust,
          balanceAfter,
          reason: `Adjusted toward ${course.name} fee`,
        },
      });
    }

    // If there's a balance to collect, create a payment link.
    let payment = null;
    if (feeToPay > 0) {
      payment = await tx.payment.create({
        data: {
          clientId: parsed.clientId,
          amount: feeToPay,
          creditsGranted: 0,
          status: "PENDING",
          notes: `Course enrolment: ${course.name}`,
        },
      });
      await tx.enrollment.update({
        where: { id: enrolment.id },
        data: { paymentId: payment.id },
      });
    }

    // Everything above is in the transaction. Side-effects (provider link,
    // WhatsApp, stage transition) happen after commit — see below.
    return { enrolment, payment, course, client, feeToPay };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).then(async (txResult) => {
    if (txResult.payment && txResult.feeToPay > 0) {
      const link = await getPaymentProvider().createPaymentLink({
        amount: txResult.feeToPay,
        description: `Course: ${txResult.course.name}`,
        client: {
          id: txResult.client.id,
          name: txResult.client.name,
          phone: txResult.client.phone,
          email: txResult.client.email,
        },
        reference: txResult.payment.id,
      });
      const updatedPayment = await prisma.payment.update({
        where: { id: txResult.payment.id },
        data: {
          providerPaymentLinkId: link.providerLinkId,
          providerPaymentLinkUrl: link.url,
        },
      });
      getWhatsAppProvider()
        .sendTemplate({
          clientId: txResult.client.id,
          phone: txResult.client.phone,
          templateName: "payment_link",
          variables: [
            txResult.client.name.split(" ")[0],
            txResult.course.name,
            String(txResult.feeToPay),
            "0",
            link.url,
          ],
        })
        .catch((err) => console.error("[courses] WhatsApp failed", err));
      return { ...txResult, payment: updatedPayment };
    } else {
      // Fully adjusted via credits — mark client converted now.
      await transitionStage({
        clientId: txResult.client.id,
        toStage: "CONVERTED",
        byUserId: parsed.byUserId,
        note: `Enrolled in ${txResult.course.name} (fully credit-adjusted)`,
      }).catch(() => void 0);
      return txResult;
    }
  });
}

/** Mark a course enrolment completed (unlocks downstream prerequisites). */
export async function markEnrolmentCompleted(enrolmentId: string) {
  return prisma.enrollment.update({
    where: { id: enrolmentId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}
