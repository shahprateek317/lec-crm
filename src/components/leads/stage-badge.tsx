import type { PipelineStage } from "@prisma/client";
import { STAGE_TONE } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

export function StageBadge({
  stage,
  className,
}: {
  stage: PipelineStage;
  className?: string;
}) {
  const tone = STAGE_TONE[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone.bg,
        tone.fg,
        className,
      )}
    >
      {tone.label}
    </span>
  );
}
