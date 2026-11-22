import {
  Compass,
  Cookie,
  Cpu,
  CreditCard,
  FileCheck2,
  FileDown,
  FileOutput,
  Globe,
  ImageOff,
  Layers,
  LockKeyhole,
  Palette,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import type { CmsIconName } from "@/lib/cms/schema";
import { cn } from "@/lib/utils";

const LUCIDE_ICON_MAP = {
  Globe,
  FileDown,
  Layers,
  Sparkles,
  Compass,
  Cpu,
  Palette,
  FileOutput,
  ShieldCheck,
  Zap,
  Users,
  LockKeyhole,
  ImageOff,
  Cookie,
  FileCheck2,
  CreditCard,
  ShieldAlert,
} as const;

export function CmsIcon({
  iconName = "Layers",
  customIconUrl,
  className = "size-5",
  imageClassName,
}: {
  iconName?: CmsIconName;
  customIconUrl?: string;
  className?: string;
  imageClassName?: string;
}) {
  const cleanUrl = customIconUrl?.trim();
  if (cleanUrl) {
    return (
      <img
        loading="lazy"
        decoding="async"
        src={cleanUrl}
        alt=""
        className={cn("object-contain", className, imageClassName)}
      />
    );
  }

  const Icon = LUCIDE_ICON_MAP[iconName] ?? Layers;
  return <Icon className={className} aria-hidden="true" />;
}
