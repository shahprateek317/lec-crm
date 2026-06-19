import { redirect } from "next/navigation";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`https://meet.jit.si/LEC-${code}`);
}
