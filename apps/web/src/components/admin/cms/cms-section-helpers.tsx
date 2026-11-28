"use client";

import { Plus, Trash2 } from "lucide-react";
import { CmsAssetUploader } from "@/components/admin/cms/cms-asset-uploader";
import { CmsIcon } from "@/components/cms/cms-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CMS_ICON_NAMES, type CmsIconName } from "@/lib/cms/schema";

export function CmsSectionGroup({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--cf-border-subtle)] pb-3">
        <div>
          <h3 className="text-foreground type-heading-s">{title}</h3>
          {description && (
            <p className="text-muted-foreground type-caption mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

export function CmsField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {multiline ? (
        <Textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export function CmsIconAndUploadPicker({
  iconName,
  onIconNameChange,
  customIconUrl,
  onCustomIconUrlChange,
  label = "Icon or uploaded custom SVG/PNG",
}: {
  iconName: CmsIconName;
  onIconNameChange: (next: CmsIconName) => void;
  customIconUrl: string;
  onCustomIconUrlChange: (next: string) => void;
  label?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-semibold">Built-in Icon</Label>
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]">
            <CmsIcon iconName={iconName} customIconUrl={customIconUrl} className="size-4" />
          </span>
          <Select
            aria-label="Select built-in icon"
            value={iconName}
            onChange={(e) => onIconNameChange(e.target.value as CmsIconName)}
          >
            {CMS_ICON_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <CmsAssetUploader
        label={label}
        hint="Overrides built-in icon when set"
        value={customIconUrl}
        onChange={onCustomIconUrlChange}
        compact
      />
    </div>
  );
}

export function CmsStringListEditor({
  label,
  items,
  onChange,
  addLabel = "Add item",
  placeholder = "Enter text...",
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  addLabel?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold">{label}</Label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...items, ""])}
        >
          <Plus className="size-3.5" />
          <span>{addLabel}</span>
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={item}
              placeholder={placeholder}
              onChange={(e) => {
                const copy = [...items];
                copy[idx] = e.target.value;
                onChange(copy);
              }}
            />
            {items.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Remove item"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
