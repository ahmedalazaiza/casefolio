export const SUPPORTED_SECTION_TYPES = [
  "Hero",
  "Overview",
  "Problem",
  "Process",
  "ScreensGallery",
  "Results",
  "Quote",
  "CTA",
  "Custom",
] as const;

export type SupportedSectionType = (typeof SUPPORTED_SECTION_TYPES)[number];

