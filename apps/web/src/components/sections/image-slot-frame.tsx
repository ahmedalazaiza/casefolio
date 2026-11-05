import { ImageIcon } from "lucide-react";
import { CdnResponsiveImage } from "@/components/sections/cdn-responsive-image";
import {
  parseAspectRatio,
  type ImageSlotValue,
  type TemplateProjectType,
  type TemplateSlotDefinition,
} from "@/lib/template/schema";
import { cn } from "@/lib/utils";

export type ResolvedDeviceChrome = "mobile" | "web" | "plain";

export function resolveDeviceChrome(
  slotDef?: TemplateSlotDefinition,
  projectType?: TemplateProjectType,
  preferDeviceChrome = false,
): ResolvedDeviceChrome {
  if (slotDef?.device === "iphone" || slotDef?.device === "android") {
    return "mobile";
  }
  if (slotDef?.device === "browser") {
    return "web";
  }
  if (!preferDeviceChrome) {
    return "plain";
  }
  if (projectType === "mobile") {
    return "mobile";
  }
  if (projectType === "web") {
    return "web";
  }
  return "plain";
}

export interface ImageSlotFrameProps {
  image?: ImageSlotValue;
  slotDefinition?: TemplateSlotDefinition;
  fallbackRatio?: string;
  projectType?: TemplateProjectType;
  preferDeviceChrome?: boolean;
  compact?: boolean;
  className?: string;
}

export function ImageSlotFrame({
  image,
  slotDefinition,
  fallbackRatio = "16:9",
  projectType,
  preferDeviceChrome = false,
  compact = false,
  className,
}: ImageSlotFrameProps) {
  const ratioText = slotDefinition?.ratio ?? fallbackRatio;
  const parsedRatio = parseAspectRatio(ratioText) ?? { width: 16, height: 9, numeric: 16 / 9 };
  const chrome = resolveDeviceChrome(slotDefinition, projectType, preferDeviceChrome);
  const hasSrc = Boolean(image?.src && image.src.trim().length > 0);
  const altText = image?.alt || image?.slot || "Case study visual";

  const viewportContent = (
    <div
      data-slot="image-slot-viewport"
      data-slot-key={image?.slot ?? "unbound"}
      data-ratio={ratioText}
      data-cropped={image?.crop ? "true" : "false"}
      style={{ aspectRatio: `${parsedRatio.width} / ${parsedRatio.height}` }}
      className="bg-sunken/70 relative flex w-full items-center justify-center overflow-hidden"
    >
      {hasSrc ? (
        <CdnResponsiveImage
          src={image!.src}
          alt={altText}
          assetId={image?.assetId}
          crop={image?.crop}
          deviceChrome={chrome}
          fallbackAspectWidth={parsedRatio.width}
          fallbackAspectHeight={parsedRatio.height}
        />
      ) : compact ? (
        <span
          title={altText}
          aria-label={altText}
          className="text-muted-foreground inline-flex items-center justify-center"
        >
          <ImageIcon className="size-4" />
        </span>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
          <span className="bg-elevated/90 text-muted-foreground inline-flex size-10 items-center justify-center rounded-full">
            <ImageIcon className="size-4" />
          </span>
          <span className="text-foreground type-caption font-medium">{altText}</span>
          <span className="text-tertiary type-overline">
            {image?.slot ? `${image.slot} · ${ratioText}` : ratioText}
          </span>
        </div>
      )}
    </div>
  );

  if (chrome === "mobile") {
    return (
      <div
        data-device-frame="mobile"
        className={cn(
          "border-border-strong/50 bg-inverse shadow-modal mx-auto w-full max-w-72 rounded-3xl border-4 p-2",
          className,
        )}
      >
        <div className="bg-inverse-foreground/20 mx-auto mb-1.5 h-1 w-14 rounded-full" />
        <div className="overflow-hidden rounded-2xl">{viewportContent}</div>
      </div>
    );
  }

  if (chrome === "web") {
    return (
      <div
        data-device-frame="web"
        className={cn(
          "border-border bg-elevated shadow-card w-full overflow-hidden rounded-xl border",
          className,
        )}
      >
        <div className="border-border bg-surface flex h-8 items-center gap-2 border-b px-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="bg-border-strong size-2.5 rounded-full" />
            <span className="bg-border-strong size-2.5 rounded-full" />
            <span className="bg-border-strong size-2.5 rounded-full" />
          </div>
          <div className="bg-sunken text-tertiary type-caption mx-auto truncate rounded-full px-4 py-0.5">
            {altText}
          </div>
        </div>
        {viewportContent}
      </div>
    );
  }

  return (
    <div
      data-device-frame="plain"
      className={cn("border-border w-full overflow-hidden rounded-xl border", className)}
    >
      {viewportContent}
    </div>
  );
}
