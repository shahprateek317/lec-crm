import Link from "next/link";
import { t } from "@/lib/i18n";
import { EnquiryForm } from "./enquiry-form";

export const metadata = { title: "Book free counselling" };

export default async function EnquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="pranic-glow min-h-screen px-6 py-12">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="font-serif text-2xl font-medium text-foreground hover:opacity-80"
          >
            {t.common.appName}
          </Link>
          <h1 className="mt-4 font-serif text-3xl font-medium tracking-tight">
            Book your free counselling
          </h1>
          <p className="mt-2 text-balance text-muted-foreground">
            Share a few details — a coordinator will reach out on WhatsApp within 24 hours.
          </p>
        </div>

        <EnquiryForm initialError={sp.error} />
      </div>
    </main>
  );
}
