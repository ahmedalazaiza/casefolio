import { ImageIcon } from "lucide-react";
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
  className?: string;
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
  className,
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

  const viewportContent = (
    <div
      data-slot="image-slot-viewport"
      data-slot-key={image?.slot ?? "unbound"}
      data-ratio={ratioText}
      data-cropped={image?.crop ? "true" : "false"}
      style={{ aspectRatio: `${parsedRatio.width} / ${parsedRatio.height}` }}
      className="bg-sunken relative flex w-full items-center justify-center overflow-hidden"
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
          role="img"
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

  let frameElement: React.ReactNode;

  if (model === "iphone") {
    frameElement = (
      <div
        data-device-frame="mobile"
        data-device-model="iphone"
        className={cn(
          "border-border-strong/60 bg-inverse shadow-modal relative mx-auto w-full max-w-72 rounded-[2.25rem] border-4 p-2",
          presentationClass,
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="bg-border-strong/70 pointer-events-none absolute top-20 -left-1.5 h-7 w-1 rounded-l-sm"
        />
        <span
          aria-hidden="true"
          className="bg-border-strong/70 pointer-events-none absolute top-30 -left-1.5 h-11 w-1 rounded-l-sm"
        />
        <span
          aria-hidden="true"
          className="bg-border-strong/70 pointer-events-none absolute top-26 -right-1.5 h-14 w-1 rounded-r-sm"
        />
        <div className="relative overflow-hidden rounded-[1.75rem]">
          <div
            aria-hidden="true"
            className="bg-inverse pointer-events-none absolute top-[1.4%] left-1/2 z-10 flex h-[2.6%] w-[28%] -translate-x-1/2 items-center justify-end rounded-full px-1.5 shadow-xs"
          >
            <span className="bg-inverse-foreground/25 size-1 rounded-full" />
          </div>
          {viewportContent}
          <div
            aria-hidden="true"
            className="bg-inverse-foreground/35 pointer-events-none absolute bottom-[1.2%] left-1/2 z-10 h-1 w-[34%] -translate-x-1/2 rounded-full"
          />
        </div>
      </div>
    );
  } else if (model === "iphone-notch") {
    frameElement = (
      <div
        data-device-frame="mobile"
        data-device-model="iphone-notch"
        className={cn(
          "border-border-strong/60 bg-inverse shadow-modal relative mx-auto w-full max-w-72 rounded-[2.25rem] border-4 p-2",
          presentationClass,
          className,
        )}
      >
        <div className="relative overflow-hidden rounded-[1.75rem]">
          <div
            aria-hidden="true"
            className="bg-inverse pointer-events-none absolute top-0 left-1/2 z-10 flex h-[3.2%] w-[42%] -translate-x-1/2 items-center justify-center rounded-b-xl"
          >
            <span className="bg-inverse-foreground/25 h-1 w-[34%] rounded-full" />
          </div>
          {viewportContent}
          <div
            aria-hidden="true"
            className="bg-inverse-foreground/35 pointer-events-none absolute bottom-[1.2%] left-1/2 z-10 h-1 w-[34%] -translate-x-1/2 rounded-full"
          />
        </div>
      </div>
    );
  } else if (model === "android") {
    frameElement = (
      <div
        data-device-frame="mobile"
        data-device-model="android"
        className={cn(
          "border-border-strong/60 bg-inverse shadow-modal relative mx-auto w-full max-w-72 rounded-3xl border-[3px] p-1.5",
          presentationClass,
          className,
        )}
      >
        <div className="relative overflow-hidden rounded-[1.25rem]">
          <span
            aria-hidden="true"
            className="bg-inverse ring-inverse-foreground/15 pointer-events-none absolute top-2 left-1/2 z-10 size-2.5 -translate-x-1/2 rounded-full ring-1"
          />
          {viewportContent}
          <div
            aria-hidden="true"
            className="bg-inverse-foreground/30 pointer-events-none absolute bottom-1.5 left-1/2 z-10 h-0.5 w-16 -translate-x-1/2 rounded-full"
          />
        </div>
      </div>
    );
  } else if (model === "tablet") {
    frameElement = (
      <div
        data-device-frame="web"
        data-device-model="tablet"
        className={cn(
          "border-border-strong/60 bg-inverse shadow-modal relative mx-auto w-full max-w-3xl rounded-3xl border-4 p-3",
          presentationClass,
          className,
        )}
      >
        <div
          aria-hidden="true"
          className="bg-inverse-foreground/25 mx-auto mb-1.5 size-1.5 rounded-full"
        />
        <div className="overflow-hidden rounded-xl">{viewportContent}</div>
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
        <div className="border-border-strong/70 bg-inverse shadow-modal w-[92%] overflow-hidden rounded-t-2xl border-x-4 border-t-4 pt-2">
          <div
            aria-hidden="true"
            className="bg-inverse-foreground/25 mx-auto mb-1.5 size-1.5 rounded-full"
          />
          <div className="overflow-hidden">{viewportContent}</div>
          <div
            aria-hidden="true"
            className="bg-inverse flex h-4 items-center justify-center"
          >
            <span className="bg-inverse-foreground/15 h-1 w-10 rounded-full" />
          </div>
        </div>
        <div
          aria-hidden="true"
          className="border-border-strong bg-border-strong shadow-card relative flex h-3.5 w-full items-start justify-center rounded-b-xl border-t"
        >
          <span className="bg-inverse/45 h-1.5 w-16 rounded-b-md" />
        </div>
      </div>
    );
  } else if (model === "browser") {
    frameElement = (
      <div
        data-device-frame="web"
        data-device-model="browser"
        className={cn(
          "border-border bg-elevated shadow-card w-full overflow-hidden rounded-xl border",
          presentationClass,
          className,
        )}
      >
        <div className="border-border bg-surface flex h-8 items-center gap-2 border-b px-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="bg-border-strong size-2.5 rounded-full" />
            <span className="bg-border-strong size-2.5 rounded-full" />
            <span className="bg-border-strong size-2.5 rounded-full" />
          </div>
          <div className="bg-sunken text-tertiary type-caption mx-auto max-w-xs truncate rounded-full px-4 py-0.5">
            {altText}
          </div>
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
          "border-border/35 w-full overflow-hidden rounded-xl border",
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
