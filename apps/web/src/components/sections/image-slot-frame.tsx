import { CdnResponsiveImage } from "@/components/sections/cdn-responsive-image";
import {
  parseAspectRatio,
  type GalleryDeviceFrame,
  type ImageSlotValue,
  type MockupStyle,
  type SlotDevice,
  type TemplateProjectType,
  type TemplateSlotDefinition,
} from "@/lib/template/schema";
import { cn } from "@/lib/utils";

export type ResolvedDeviceChrome = "mobile" | "web" | "plain";

export type ResolvedDeviceModel =
  | "iphone"
  | "iphone-notch"
  | "android"
  | "tablet"
  | "macbook"
  | "browser"
  | "plain";

function mapSlotDeviceToModel(device: SlotDevice): ResolvedDeviceModel {
  if (device === "none") return "plain";
  return device;
}

export function resolveDeviceModel(options: {
  overrideDevice?: GalleryDeviceFrame;
  imageDevice?: SlotDevice;
  slotDef?: TemplateSlotDefinition;
  projectType?: TemplateProjectType;
  preferDeviceChrome?: boolean;
}): ResolvedDeviceModel {
  const {
    overrideDevice,
    imageDevice,
    slotDef,
    projectType,
    preferDeviceChrome = false,
  } = options;

  if (overrideDevice && overrideDevice !== "auto") {
    return mapSlotDeviceToModel(overrideDevice);
  }

  if (imageDevice) {
    return mapSlotDeviceToModel(imageDevice);
  }

  if (slotDef?.device) {
    return mapSlotDeviceToModel(slotDef.device);
  }

  if (!preferDeviceChrome) {
    return "plain";
  }

  if (projectType === "mobile") {
    return "iphone";
  }

  if (projectType === "web") {
    return "browser";
  }

  return "plain";
}

export function deviceModelToChrome(model: ResolvedDeviceModel): ResolvedDeviceChrome {
  if (model === "iphone" || model === "iphone-notch" || model === "android") {
    return "mobile";
  }
  if (model === "tablet" || model === "macbook" || model === "browser") {
    return "web";
  }
  return "plain";
}

export function resolveDeviceChrome(
  slotDef?: TemplateSlotDefinition,
  projectType?: TemplateProjectType,
  preferDeviceChrome = false,
): ResolvedDeviceChrome {
  return deviceModelToChrome(
    resolveDeviceModel({
      slotDef,
      projectType,
      preferDeviceChrome,
    }),
  );
}

function SlotPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2.75"
        stroke="currentColor"
        strokeWidth="1.65"
      />
      <circle cx="8.5" cy="8.5" r="1.65" stroke="currentColor" strokeWidth="1.65" />
      <path
        d="M3.5 17.5L9.5 12L14.5 16.5L17.5 14L20.5 17"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface ImageSlotFrameProps {
  image?: ImageSlotValue;
  slotDefinition?: TemplateSlotDefinition;
  overrideDevice?: GalleryDeviceFrame;
  fallbackRatio?: string;
  projectType?: TemplateProjectType;
  preferDeviceChrome?: boolean;
  presentation?: MockupStyle;
  glow?: boolean;
  accentToken?: string;
  compact?: boolean;
  bezelColor?: string;
  className?: string;
  innerClassName?: string;
  toolbarClassName?: string;
  dotClassName?: string;
  placeholderIconClassName?: string;
}

export function ImageSlotFrame({
  image,
  slotDefinition,
  overrideDevice,
  fallbackRatio = "16:9",
  projectType,
  preferDeviceChrome = false,
  presentation = "straight",
  glow = false,
  accentToken = "primary",
  compact = false,
  bezelColor,
  className,
  innerClassName,
  toolbarClassName,
  dotClassName,
  placeholderIconClassName,
}: ImageSlotFrameProps) {
  const ratioText = slotDefinition?.ratio ?? fallbackRatio;
  const parsedRatio = parseAspectRatio(ratioText) ?? { width: 16, height: 9, numeric: 16 / 9 };
  const model = resolveDeviceModel({
    overrideDevice,
    imageDevice: image?.device,
    slotDef: slotDefinition,
    projectType,
    preferDeviceChrome,
  });
  const chrome = deviceModelToChrome(model);
  const hasSrc = Boolean(image?.src && image.src.trim().length > 0);
  const altText = image?.alt || image?.slot || "Case study visual";

  const presentationClass =
    presentation === "tilt-right"
      ? "rotate-3 sm:rotate-6 transition-transform duration-300"
      : presentation === "tilt-left"
         ? "-rotate-3 sm:-rotate-6 transition-transform duration-300"
        : "";

  const defaultIconSizeClass = compact
    ? "size-[16px] lg:size-[22px]"
    : chrome === "mobile"
      ? "size-[28px] lg:size-[38px]"
      : "size-[28px] lg:size-[56px]";

  const viewportContent = (
    <div
      data-slot="image-slot-viewport"
      data-slot-key={image?.slot ?? "unbound"}
      data-ratio={ratioText}
      data-cropped={image?.crop ? "true" : "false"}
      style={{
        aspectRatio: `${parsedRatio.width} / ${parsedRatio.height}`,
        backgroundColor: "var(--tpl-color-surfaceAlt, var(--sunken))",
      }}
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden",
        innerClassName,
      )}
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
      ) : (
        <span
          role="img"
          title={altText}
          aria-label={altText}
          style={{
            color:
              "color-mix(in oklab, var(--tpl-color-textMuted, var(--muted-foreground)) 55%, transparent)",
          }}
          className="inline-flex items-center justify-center"
        >
          <SlotPlaceholderIcon
            className={placeholderIconClassName ?? defaultIconSizeClass}
          />
        </span>
      )}
    </div>
  );

  let frameElement: React.ReactNode;

  if (model === "iphone" || model === "iphone-notch" || model === "android") {
    frameElement = (
      <div
        data-device-frame="mobile"
        data-device-model={model}
        style={{
          ...(bezelColor ? { backgroundColor: bezelColor } : {}),
          borderColor: "var(--tpl-color-line, var(--border))",
        }}
        className={cn(
          !bezelColor && "bg-[var(--tpl-color-surfaceAlt,var(--sunken))]",
          "relative mx-auto flex w-full max-w-[276px] flex-col items-start rounded-[30px] border border-solid p-[8px]",
          presentationClass,
          className,
        )}
      >
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-[22px]",
            innerClassName,
          )}
        >
          {viewportContent}
        </div>
      </div>
    );
  } else if (model === "tablet") {
    frameElement = (
      <div
        data-device-frame="web"
        data-device-model="tablet"
        style={{
          backgroundColor: "var(--tpl-color-surfaceAlt, var(--sunken))",
          borderColor: "var(--tpl-color-line, var(--border))",
        }}
        className={cn(
          "relative mx-auto w-full max-w-3xl rounded-[28px] border border-solid p-3",
          presentationClass,
          className,
        )}
      >
        <div className="overflow-hidden rounded-[18px]">{viewportContent}</div>
      </div>
    );
  } else if (model === "macbook") {
    frameElement = (
      <div
        data-device-frame="web"
        data-device-model="macbook"
        className={cn(
          "mx-auto flex w-full max-w-4xl flex-col items-center",
          presentationClass,
          className,
        )}
      >
        <div
          style={{
            backgroundColor: "var(--tpl-color-surfaceAlt, var(--sunken))",
            borderColor: "var(--tpl-color-line, var(--border))",
          }}
          className="w-[92%] overflow-hidden rounded-t-2xl border-x border-t p-2.5"
        >
          <div className="overflow-hidden rounded-lg">{viewportContent}</div>
        </div>
        <div
          aria-hidden="true"
          style={{
            backgroundColor: "var(--tpl-color-surface, var(--surface))",
            borderColor: "var(--tpl-color-line, var(--border))",
          }}
          className="relative flex h-3.5 w-full items-start justify-center rounded-b-xl border"
        />
      </div>
    );
  } else if (model === "browser") {
    frameElement = (
      <div
        data-device-frame="web"
        data-device-model="browser"
        style={{
          backgroundColor: "var(--tpl-color-surface, var(--surface))",
          borderColor: "var(--tpl-color-line, var(--border))",
        }}
        className={cn(
          "w-full overflow-hidden rounded-[10px] border border-solid",
          presentationClass,
          className,
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "flex w-full items-center gap-[6px] px-[12px] py-[9px]",
            toolbarClassName,
          )}
        >
          <span
            style={{ backgroundColor: "var(--tpl-color-line, var(--border))" }}
            className={cn("size-[7px] shrink-0 rounded-full", dotClassName)}
          />
          <span
            style={{ backgroundColor: "var(--tpl-color-line, var(--border))" }}
            className={cn("size-[7px] shrink-0 rounded-full", dotClassName)}
          />
          <span
            style={{ backgroundColor: "var(--tpl-color-line, var(--border))" }}
            className={cn("size-[7px] shrink-0 rounded-full", dotClassName)}
          />
        </div>
        {viewportContent}
      </div>
    );
  } else {
    frameElement = (
      <div
        data-device-frame="plain"
        data-device-model="plain"
        className={cn(
          "w-full overflow-hidden rounded-[16px]",
          presentationClass,
          className,
        )}
      >
        {viewportContent}
      </div>
    );
  }

  if (!glow) {
    return frameElement;
  }

  const safeAccent = accentToken && accentToken.trim().length > 0 ? accentToken.trim() : "primary";

  return (
    <div className="relative mx-auto w-full">
      <div
        aria-hidden="true"
        style={{
          backgroundColor: `var(--tpl-color-${safeAccent}, var(--primary))`,
        }}
        className="pointer-events-none absolute inset-6 z-0 rounded-full opacity-25 blur-3xl"
      />
      <div className="relative z-10">{frameElement}</div>
    </div>
  );
}
