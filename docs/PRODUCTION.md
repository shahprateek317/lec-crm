# Going to production

This project runs fine in dev with the WhatsApp + Razorpay stubs. To go live,
complete the steps below — code changes are nearly zero; it's mostly paperwork
and flipping env flags.

## 1. Hosting

Recommended: **Vercel** (Next.js-native) + **Neon** (free Postgres, same region).

```bash
# One-time setup
vercel link
vercel env add DATABASE_URL        # paste Neon connection string
vercel env add AUTH_SECRET         # openssl rand -base64 32
vercel env add WHATSAPP_PROVIDER meta
vercel env add WHATSAPP_PHONE_NUMBER_ID
vercel env add WHATSAPP_ACCESS_TOKEN
vercel env add WHATSAPP_VERIFY_TOKEN
vercel env add RAZORPAY_PROVIDER razorpay
vercel env add RAZORPAY_KEY_ID
vercel env add RAZORPAY_KEY_SECRET
vercel env add RAZORPAY_WEBHOOK_SECRET

# Deploy
vercel --prod
```

Apply migrations on the production DB:
```bash
DATABASE_URL="…neon…" npx prisma migrate deploy
DATABASE_URL="…neon…" npx prisma db seed   # first time only
```

## 2. WhatsApp Cloud API

Timeline: **7–14 days** due to Meta business verification.

1. Create a **Meta Business account** at business.facebook.com and verify the
   Life Energy Centre as a legal business (need PAN / GST / incorporation doc).
2. In Meta for Developers, create an app with the **WhatsApp Business**
   product attached.
3. Register a **phone number** dedicated to the API (cannot be used on the
   regular WhatsApp app simultaneously).
4. Submit the 10 message templates (see `prisma/seed.ts`, `WhatsAppTemplate`
   table) for approval. Each is a UTILITY template; approval is usually within
   24 hours.
5. Generate a **permanent access token** via a System User.
6. In the app's WhatsApp → Configuration, set the webhook to:
   ```
   https://<your-domain>/api/webhook/whatsapp
   ```
   with a shared secret for `WHATSAPP_VERIFY_TOKEN`.
7. Subscribe to `messages` and `message_status` webhook fields.
8. Update Vercel env: `WHATSAPP_PROVIDER=meta` plus `PHONE_NUMBER_ID`,
   `ACCESS_TOKEN`, `VERIFY_TOKEN`.

No code changes required. The stub becomes the live client automatically.

### Group creation note

The official Business API cannot create WhatsApp groups. For distant healing,
the coordinator creates each client's group manually in their phone's WhatsApp,
then pastes the invite link into the CRM on that client's distant-healing page.
The CRM provides copy-paste templates (client intro, healer update format) and
records structured updates / feedback regardless of whether they're also posted
to the group.

## 3. Razorpay

Timeline: **3–7 days** for KYC + activation.

1. Sign up at razorpay.com with the centre's bank account + PAN.
2. Submit KYC docs (PAN, bank proof, business proof).
3. Once activated, grab **Key ID** and **Key Secret** from Dashboard → Settings
   → API Keys.
4. Enable **Payment Links** in Dashboard → Products.
5. Add a webhook at Dashboard → Settings → Webhooks:
   ```
   https://<your-domain>/api/webhook/razorpay
   ```
   Events to subscribe: `payment_link.paid`, `payment.captured`, `payment.failed`.
   Generate a webhook secret and add it as `RAZORPAY_WEBHOOK_SECRET`.
6. Update Vercel env: `RAZORPAY_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`,
   `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

Test end-to-end in Razorpay's **Test mode** first (same flow, test keys). When
confident, switch to live keys.

## 4. Cron / scheduled tasks

Follow-ups regenerate on every `/follow-ups` page load (idempotent). For more
aggressive checking (especially outside working hours), add a Vercel Cron:

`vercel.json`:
```json
{
  "crons": [{ "path": "/api/cron/follow-ups", "schedule": "0 9 * * *" }]
}
```

Then create `src/app/api/cron/follow-ups/route.ts` that calls
`generateFollowUps()` (not built yet — easy add when needed).

## 5. Backups

Neon has automatic point-in-time restore. For extra safety, schedule a daily
`pg_dump` to S3 / Google Drive via GitHub Actions:

```yaml
# .github/workflows/backup.yml
name: DB backup
on: { schedule: [{ cron: "30 18 * * *" }] }  # 00:00 IST
jobs:
  dump:
    runs-on: ubuntu-latest
    steps:
      - run: |
          pg_dump "$DATABASE_URL" | gzip > backup.sql.gz
          # Upload to your chosen target
```

## 6. Domain & SSL

Use Vercel's free `*.vercel.app` domain initially, or connect a custom domain
(e.g. `crm.lifeenergycentre.com`) — SSL is automatic.

## 7. Monitoring

- Vercel dashboard: request logs, error rate.
- Sentry (optional): add `@sentry/nextjs` for error tracking.
- Meta's Business Manager: WhatsApp template-approval status, delivery rates.
- Razorpay dashboard: payment success rate.

## 8. Data import (one-time)

If existing client data lives in a spreadsheet, write a one-off import script
in `scripts/import-clients.ts` using the same `createLead()` helper. Keep it
idempotent on phone number so re-runs are safe.
