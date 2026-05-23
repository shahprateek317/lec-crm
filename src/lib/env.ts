import { z } from "zod";

// Validate env once at boot. Fail fast if required vars are missing in production.
const schema = z.object({
  DATABASE_URL: z.string().url(),
  // Optional. If provided, used by `prisma migrate` etc. Prisma reads it
  // directly via the schema; surfacing here so the validator is aware.
  DIRECT_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: z.string().optional(),

  WHATSAPP_PROVIDER: z.enum(["stub", "meta"]).default("stub"),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  // App Secret from Meta App dashboard. Used to verify the X-Hub-Signature-256
  // header on /api/webhook/whatsapp. Without it, the webhook fails closed
  // (rejects every POST) — preferred over silently accepting forged inbound
  // messages into the coordinator inbox.
  WHATSAPP_APP_SECRET: z.string().optional(),

  RAZORPAY_PROVIDER: z.enum(["stub", "razorpay"]).default("stub"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  TZ: z.string().default("Asia/Kolkata"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // S3 uploads bucket (healer certs, client medical docs). On EC2 the
  // app uses the instance profile — AWS_ACCESS_KEY_ID / _SECRET stay
  // unset. For local dev (uploads disabled by default) you can opt in
  // by setting these.
  AWS_REGION: z.string().default("ap-south-1"),
  S3_UPLOADS_BUCKET: z.string().default("lec-crm-uploads-397068653443"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
});

export const env = schema.parse(process.env);

// Force the process timezone to IST regardless of host. Vercel reserves TZ
// as an env var, so we set it programmatically on first import. Must run
// before any date is formatted.
if (process.env.TZ !== "Asia/Kolkata") {
  process.env.TZ = "Asia/Kolkata";
}
