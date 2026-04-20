import { z } from "zod";

// Validate env once at boot. Fail fast if required vars are missing in production.
const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: z.string().optional(),

  WHATSAPP_PROVIDER: z.enum(["stub", "meta"]).default("stub"),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  RAZORPAY_PROVIDER: z.enum(["stub", "razorpay"]).default("stub"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  TZ: z.string().default("Asia/Kolkata"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = schema.parse(process.env);

// Force the process timezone to IST regardless of host. Vercel reserves TZ
// as an env var, so we set it programmatically on first import. Must run
// before any date is formatted.
if (process.env.TZ !== "Asia/Kolkata") {
  process.env.TZ = "Asia/Kolkata";
}
