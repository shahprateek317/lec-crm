// Referral rewards engine — May 2026, per dad's "Update the existing Healing" doc.
//
// Model: when a client (the referee) hits a qualifying event (centre visit,
// package purchase, course enrolment), we look up who referred them
// (`Client.referrerClientId`) and grant the referrer a free healing credit.
//
// Idempotency: the (referrerId, refereeId, reason) tuple is a UNIQUE in the DB
// (see ReferralReward), so re-firing the same hook never double-grants. We
// detect the duplicate-key error and silently swallow it.
//
// Cap (guardrail to discourage gaming):
//   • Max one credit per (referrer, referee, reason) — enforced by the unique.
//   • Max ANNUAL_CAP credits per referrer per rolling 12 months — checked here.
// Adjust these without a schema migration; this is policy, not data.

import { Prisma } from "@prisma/client";
import type { ReferralReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ANNUAL_CAP = 10; // max referral credits a single client can earn / year
const CREDITS_BY_REASON: Record<ReferralReason, number> = {
  CENTRE_VISIT:     1, // first commitment — small thank-you
  PACKAGE_PURCHASE: 2, // real money — bigger thank-you
  COURSE_ENROLMENT: 3, // top-of-funnel conversion — biggest
};

export type GrantResult =
  | { granted: true;  referrerId: string; sessionsAwarded: number }
  | { granted: false; reason: "no_referrer" | "already_granted" | "annual_cap_reached" };

/**
 * Award the referrer of `refereeClientId` a free healing credit for `reason`.
 * Safe to call multiple times — second call is a no-op via DB unique constraint.
 *
 * Designed to be invoked fire-and-forget from the qualifying event's handler:
 *   grantReferralReward(clientId, "CENTRE_VISIT").catch(console.error);
 */
export async function grantReferralReward(
  refereeClientId: string,
  reason: ReferralReason,
  note?: string,
): Promise<GrantResult> {
  const referee = await prisma.client.findUnique({
    where: { id: refereeClientId },
    select: { id: true, referrerClientId: true },
  });
  if (!referee?.referrerClientId) return { granted: false, reason: "no_referrer" };

  // Annual cap check — rolling 12 months.
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const earnedThisYear = await prisma.referralReward.aggregate({
    _sum: { sessionsAwarded: true },
    where: {
      referrerId: referee.referrerClientId,
      createdAt: { gte: oneYearAgo },
    },
  });
  if ((earnedThisYear._sum.sessionsAwarded ?? 0) >= ANNUAL_CAP) {
    return { granted: false, reason: "annual_cap_reached" };
  }

  const sessions = CREDITS_BY_REASON[reason];

  try {
    await prisma.$transaction([
      prisma.referralReward.create({
        data: {
          referrerId:      referee.referrerClientId,
          refereeId:       referee.id,
          reason,
          sessionsAwarded: sessions,
          note,
        },
      }),
      prisma.client.update({
        where: { id: referee.referrerClientId },
        data:  { healingCreditsEarned: { increment: sessions } },
      }),
    ]);
    return { granted: true, referrerId: referee.referrerClientId, sessionsAwarded: sessions };
  } catch (err) {
    // P2002 = unique constraint violation → this reason has already fired for
    // this (referrer, referee). That's the expected idempotent behaviour.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { granted: false, reason: "already_granted" };
    }
    throw err;
  }
}

/** Convenience: how many credits a client has earned + how many referrals they've sent. */
export async function getReferralSummary(clientId: string): Promise<{
  earned: number;
  referralCount: number;
  successfulReferrals: number;
}> {
  const [client, referralCount, rewardCount] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { healingCreditsEarned: true },
    }),
    prisma.client.count({ where: { referrerClientId: clientId } }),
    prisma.referralReward.count({ where: { referrerId: clientId } }),
  ]);
  return {
    earned:               client?.healingCreditsEarned ?? 0,
    referralCount,
    successfulReferrals:  rewardCount,
  };
}
