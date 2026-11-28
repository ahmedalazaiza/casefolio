import type {
  CustomMediaItem,
  ImageSlotValue,
  TemplateSlotDefinition,
} from "@/lib/template/schema";

export type SmartSlotKind =
  | "Logo"
  | "Avatar"
  | "Icon"
  | "Watch"
  | "Widget"
  | "Wireframe"
  | "Card"
  | "Logo Grid"
  | "Slide"
  | "Banner"
  | "Photo"
  | "Screen"
  | "Visual";

const SCREEN_DEVICES = new Set([
  "iphone",
  "iphone-notch",
  "android",
  "browser",
  "macbook",
  "tablet",
]);

export function inferSmartSlotKind(
  image: Partial<ImageSlotValue> | undefined,
  slotDefinition?: TemplateSlotDefinition,
  fallbackSlotKey?: string,
): SmartSlotKind {
  const slot = (image?.slot || fallbackSlotKey || "").trim().toLowerCase();
  const device = (image?.device || slotDefinition?.device || "").trim().toLowerCase();
  const alt = (image?.alt || "").trim().toLowerCase();

  if (slot.includes("logo") || /\blogo\b/.test(alt)) {
    return "Logo";
  }
  if (slot.includes("avatar") || /\bavatar\b/.test(alt)) {
    return "Avatar";
  }
  if (slot.includes("icon") || /\bapp icon\b|\bicon\b/.test(alt)) {
    return "Icon";
  }
  if (slot.includes("watch") || /\bsmartwatch\b|\bwatch\b/.test(alt)) {
    return "Watch";
  }
  if (slot.includes("widget") || /\bwidget\b/.test(alt)) {
    return "Widget";
  }
  if (slot.includes("wireframe") || /\bwireframe\b/.test(alt)) {
    return "Wireframe";
  }
  if (slot.includes("construction") || /\bconstruction\b/.test(alt)) {
    return "Logo Grid";
  }
  if (slot.includes("slide") || /\bguideline\b|\bslide\b/.test(alt)) {
    return "Slide";
  }
  if (slot.includes("card") || /\bpayment card\b|\bdebit card\b/.test(alt)) {
    return "Card";
  }
  if (slot.includes("banner") || /\bbanner\b/.test(alt)) {
    return "Banner";
  }
  if (slot.includes("photo") || /\bportrait\b|\blifestyle\b|\bphoto\b/.test(alt)) {
    return "Photo";
  }
  if (
    slot.includes("screen") ||
    slot.includes("phone") ||
    slot.includes("mockup") ||
    slot.includes("desktop") ||
    slot.includes("mobile") ||
    SCREEN_DEVICES.has(device)
  ) {
    return "Screen";
  }

  return "Visual";
}

function stripRedundantKindPrefix(text: string, kind: SmartSlotKind): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const escapedKind = kind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const numberedPrefix = new RegExp(
    `^(?:${escapedKind}|screen|slide|step|item|icon|logo|wireframe)\\s*#?0*\\d+\\s*(?:[·:\\-–—]\\s*)?`,
    "i",
  );
  const cleaned = trimmed.replace(numberedPrefix, "").trim();
  if (!cleaned) return "";
  if (cleaned.toLowerCase() === kind.toLowerCase()) return "";
  return cleaned;
}

export function formatGalleryItemSummary(
  item: { caption?: string; image?: ImageSlotValue } | undefined,
  index = 0,
  slots?: Record<string, TemplateSlotDefinition>,
): string {
  const slotKey = item?.image?.slot || "gallery.screen";
  const kind = inferSmartSlotKind(item?.image, slots?.[slotKey], slotKey);
  const num = index + 1;
  const base = `${kind} ${num}`;
  const detail = stripRedundantKindPrefix(item?.caption ?? "", kind);
  return detail ? `${base} · ${detail}` : base;
}

export function formatCustomMediaItemSummary(
  item: Partial<CustomMediaItem> | undefined,
  index = 0,
  slots?: Record<string, TemplateSlotDefinition>,
): string {
  const slotKey = item?.image?.slot || "custom.image";
  const kind = inferSmartSlotKind(item?.image, slots?.[slotKey], slotKey);
  const num = index + 1;

  const singletonKinds = new Set<SmartSlotKind>([
    "Logo",
    "Avatar",
    "Watch",
    "Widget",
    "Card",
    "Logo Grid",
    "Banner",
    "Photo",
  ]);

  const base = singletonKinds.has(kind) ? kind : `${kind} ${num}`;
  const rawTitle = item?.title?.trim() || "";
  const detail = stripRedundantKindPrefix(rawTitle, kind);

  if (!detail) {
    return base;
  }
  if (detail.toLowerCase().includes(kind.toLowerCase())) {
    return detail;
  }
  return `${base} · ${detail}`;
}

export function resolveSmartFieldSlotLabel(options: {
  image: ImageSlotValue | undefined;
  slotDefinition?: TemplateSlotDefinition;
  fallbackSlotKey: string;
  secondary?: boolean;
}): string {
  const { image, slotDefinition, fallbackSlotKey, secondary = false } = options;
  const kind = inferSmartSlotKind(image, slotDefinition, fallbackSlotKey);
  if (secondary) {
    return `${kind} 2`;
  }
  if (fallbackSlotKey === "hero.mockup") {
    return kind === "Screen" ? "Hero screen" : `Hero ${kind.toLowerCase()}`;
  }
  return kind;
}
