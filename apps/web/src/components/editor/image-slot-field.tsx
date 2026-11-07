"use client";

import {
  AlertCircle,
  AlertTriangle,
  Crop,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  persistAssetCropClient,
  UploadClientError,
  uploadSlotImageClient,
  type PutBinaryTransport,
} from "@/lib/storage/client-upload";
import {
  computeCenteredLockedCropRect,
  computeCssCropFramingStyle,
  isUrlServerPreCropped,
  parseNaturalDimensionsFromSrc,
  sanitizeCropRect,
} from "@/lib/storage/image-dimensions";
import {
  parseAspectRatio,
  type CropRect,
  type ImageSlotValue,
  type SlotDevice,
  type TemplateSlotDefinition,
} from "@/lib/template/schema";
import { cn } from "@/lib/utils";

export interface ImageSlotFieldProps {
  slotKey: string;
  label: string;
  slotDefinition?: TemplateSlotDefinition;
  projectId?: string;
  value: ImageSlotValue | undefined;
  onChange: (next: ImageSlotValue) => void;
  readOnly?: boolean;
  putTransport?: PutBinaryTransport;
}

export function ImageSlotField({
  slotKey,
  label,
  slotDefinition,
  projectId,
  value,
  onChange,
  readOnly = false,
  putTransport,
}: ImageSlotFieldProps) {
  const effectiveSlotKey = value?.slot || slotKey;
  const ratioText = slotDefinition?.ratio ?? "16:9";
  const parsedRatio = useMemo(
    () => parseAspectRatio(ratioText) ?? { width: 16, height: 9, numeric: 16 / 9 },
    [ratioText],
  );

  const currentValue: ImageSlotValue = useMemo(
    () => ({
      slot: effectiveSlotKey,
      src: value?.src ?? "",
      alt: value?.alt ?? "",
      assetId: value?.assetId ?? null,
      crop: value?.crop ?? null,
      ...(value?.device ? { device: value.device } : {}),
    }),
    [effectiveSlotKey, value?.alt, value?.assetId, value?.crop, value?.device, value?.src],
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadedNaturalDims, setLoadedNaturalDims] = useState<{
    src: string;
    width: number;
    height: number;
  } | null>(null);

  // Crop modal state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropDialogSessionKey, setCropDialogSessionKey] = useState(0);
  const [cropLocation, setCropLocation] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [initialAreaPixelsForSession, setInitialAreaPixelsForSession] = useState<Area | undefined>(
    undefined,
  );
  const [pendingCropPixels, setPendingCropPixels] = useState<CropRect | null>(null);
  const [cropTargetValue, setCropTargetValue] = useState<ImageSlotValue | null>(null);

  const hasImage = Boolean(currentValue.src && currentValue.src.trim().length > 0);

  const resolvedNaturalDims = useMemo(() => {
    const fromUrl = parseNaturalDimensionsFromSrc(currentValue.src);
    if (fromUrl) return fromUrl;
    if (loadedNaturalDims && loadedNaturalDims.src === currentValue.src) {
      return { width: loadedNaturalDims.width, height: loadedNaturalDims.height };
    }
    return null;
  }, [currentValue.src, loadedNaturalDims]);

  const previewCropStyle = useMemo(() => {
    if (!hasImage || !currentValue.crop || isUrlServerPreCropped(currentValue.src)) {
      return null;
    }
    if (!resolvedNaturalDims) {
      return null;
    }
    return computeCssCropFramingStyle(
      resolvedNaturalDims.width,
      resolvedNaturalDims.height,
      currentValue.crop,
    );
  }, [currentValue.crop, currentValue.src, hasImage, resolvedNaturalDims]);

  const effectiveCropWidth =
    currentValue.crop?.width ?? resolvedNaturalDims?.width ?? null;
  const belowMinWidth =
    Boolean(slotDefinition?.minWidth) &&
    effectiveCropWidth !== null &&
    effectiveCropWidth < (slotDefinition?.minWidth ?? 0);

  const openCropEditorFor = useCallback(
    (
      target: ImageSlotValue,
      dimsHint?: { width: number; height: number } | null,
    ) => {
      const dims =
        dimsHint ??
        parseNaturalDimensionsFromSrc(target.src) ??
        (loadedNaturalDims?.src === target.src
          ? { width: loadedNaturalDims.width, height: loadedNaturalDims.height }
          : null);

      const startingCrop =
        target.crop ??
        (dims
          ? computeCenteredLockedCropRect(dims.width, dims.height, parsedRatio.numeric)
          : {
              x: 0,
              y: 0,
              width: Math.round(parsedRatio.width * 100),
              height: Math.round(parsedRatio.height * 100),
            });

      setCropTargetValue(target);
      setCropLocation({ x: 0, y: 0 });
      setZoom(1);
      setInitialAreaPixelsForSession(target.crop ?? undefined);
      setPendingCropPixels(sanitizeCropRect(startingCrop));
      setCropDialogSessionKey((prev) => prev + 1);
      setCropDialogOpen(true);
    },
    [loadedNaturalDims, parsedRatio.height, parsedRatio.numeric, parsedRatio.width],
  );

  const handleTriggerFilePicker = useCallback(() => {
    if (readOnly || uploadingFileName) return;
    fileInputRef.current?.click();
  }, [readOnly, uploadingFileName]);

  const processSelectedFile = useCallback(
    async (file: File) => {
      if (readOnly) return;

      if (!projectId) {
        setErrorMessage("Save the project first before uploading slot screenshots.");
        return;
      }

      setErrorMessage(null);
      setUploadingFileName(file.name);
      setUploadProgress(2);

      try {
        const uploaded = await uploadSlotImageClient({
          projectId,
          slot: effectiveSlotKey,
          file,
          lockedAspect: parsedRatio.numeric,
          onProgress: (pct) => setUploadProgress(pct),
          putTransport,
        });

        const nextSlotValue: ImageSlotValue = {
          slot: effectiveSlotKey,
          src: uploaded.asset.deliveryUrl,
          alt: currentValue.alt || label,
          assetId: uploaded.asset.id,
          crop: uploaded.initialCrop,
          ...(currentValue.device ? { device: currentValue.device } : {}),
        };

        setLoadedNaturalDims({
          src: uploaded.asset.deliveryUrl,
          width: uploaded.width,
          height: uploaded.height,
        });

        onChange(nextSlotValue);
        setUploadingFileName(null);
        setUploadProgress(0);

        openCropEditorFor(nextSlotValue, {
          width: uploaded.width,
          height: uploaded.height,
        });
      } catch (err) {
        setUploadingFileName(null);
        setUploadProgress(0);
        if (err instanceof UploadClientError) {
          setErrorMessage(err.message);
        } else if (err instanceof Error && err.message) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage("Couldn't upload image. Please try again.");
        }
      }
    },
    [
      currentValue.alt,
      currentValue.device,
      effectiveSlotKey,
      label,
      onChange,
      openCropEditorFor,
      parsedRatio.numeric,
      projectId,
      putTransport,
      readOnly,
    ],
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      event.target.value = "";
      if (!selectedFile) return;
      void processSelectedFile(selectedFile);
    },
    [processSelectedFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      if (readOnly || uploadingFileName) return;
      const droppedFile = event.dataTransfer.files?.[0];
      if (droppedFile) {
        void processSelectedFile(droppedFile);
      }
    },
    [processSelectedFile, readOnly, uploadingFileName],
  );

  const handleCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    if (
      !Number.isFinite(croppedAreaPixels.x) ||
      !Number.isFinite(croppedAreaPixels.y) ||
      !Number.isFinite(croppedAreaPixels.width) ||
      !Number.isFinite(croppedAreaPixels.height) ||
      croppedAreaPixels.width <= 0 ||
      croppedAreaPixels.height <= 0
    ) {
      return;
    }
    setPendingCropPixels(sanitizeCropRect(croppedAreaPixels));
  }, []);

  const handleResetCrop = useCallback(() => {
    const activeTarget = cropTargetValue ?? currentValue;
    const dims =
      parseNaturalDimensionsFromSrc(activeTarget.src) ??
      (loadedNaturalDims?.src === activeTarget.src
        ? { width: loadedNaturalDims.width, height: loadedNaturalDims.height }
        : null);

    const centered = dims
      ? computeCenteredLockedCropRect(dims.width, dims.height, parsedRatio.numeric)
      : {
          x: 0,
          y: 0,
          width: Math.round(parsedRatio.width * 100),
          height: Math.round(parsedRatio.height * 100),
        };

    setCropLocation({ x: 0, y: 0 });
    setZoom(1);
    setInitialAreaPixelsForSession(undefined);
    setPendingCropPixels(sanitizeCropRect(centered));
    setCropDialogSessionKey((prev) => prev + 1);
  }, [
    cropTargetValue,
    currentValue,
    loadedNaturalDims,
    parsedRatio.height,
    parsedRatio.numeric,
    parsedRatio.width,
  ]);

  const handleApplyCrop = useCallback(() => {
    const activeTarget = cropTargetValue ?? currentValue;
    if (!pendingCropPixels) {
      setCropDialogOpen(false);
      return;
    }

    const sanitized = sanitizeCropRect(pendingCropPixels);
    const updatedValue: ImageSlotValue = {
      ...activeTarget,
      slot: effectiveSlotKey,
      crop: sanitized,
    };

    onChange(updatedValue);
    if (updatedValue.assetId) {
      void persistAssetCropClient(updatedValue.assetId, sanitized);
    }
    setCropDialogOpen(false);
  }, [cropTargetValue, currentValue, effectiveSlotKey, onChange, pendingCropPixels]);

  const handleRemoveImage = useCallback(() => {
    if (readOnly) return;
    setErrorMessage(null);
    onChange({
      slot: effectiveSlotKey,
      src: "",
      alt: currentValue.alt,
      assetId: null,
      crop: null,
      ...(currentValue.device ? { device: currentValue.device } : {}),
    });
  }, [currentValue.alt, currentValue.device, effectiveSlotKey, onChange, readOnly]);

  const activeCropSrc = cropTargetValue?.src || currentValue.src;
  const activeDeviceBadge = currentValue.device ?? slotDefinition?.device;
  const supportsDevicePicker =
    effectiveSlotKey !== "hero.logo" && effectiveSlotKey !== "quote.avatar";

  return (
    <div
      data-testid={`image-slot-field-${effectiveSlotKey}`}
      data-slot-key={effectiveSlotKey}
      data-slot-ratio={ratioText}
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-foreground type-body-s-strong truncate">{label}</span>
        <Badge tone="neutral" withDot={false}>
          {activeDeviceBadge ? `${activeDeviceBadge} · ${ratioText}` : ratioText}
        </Badge>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={readOnly || Boolean(uploadingFileName)}
        onChange={handleFileInputChange}
        data-testid={`slot-file-input-${effectiveSlotKey}`}
        aria-label={`Upload image for ${label}`}
        className="sr-only"
      />

      {errorMessage && (
        <div
          role="alert"
          data-testid={`slot-error-${effectiveSlotKey}`}
          className="border-destructive/35 bg-destructive-soft text-foreground flex items-start justify-between gap-2 rounded-lg border px-3 py-2"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="text-destructive mt-0.5 size-4 shrink-0" />
            <span className="type-caption">{errorMessage}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss upload error"
            onClick={() => setErrorMessage(null)}
            className="text-tertiary hover:text-foreground inline-flex size-5 shrink-0 items-center justify-center rounded"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {uploadingFileName ? (
        <div
          data-testid={`slot-uploading-${effectiveSlotKey}`}
          className="border-primary/40 bg-surface flex flex-col items-center justify-center gap-2.5 rounded-xl border p-5 text-center"
        >
          <span className="text-foreground type-body-s-strong">
            Uploading... {uploadProgress}%
          </span>
          <div className="bg-sunken h-1.5 w-full max-w-48 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <span className="text-tertiary type-caption max-w-full truncate">
            {uploadingFileName}
          </span>
        </div>
      ) : hasImage ? (
        <div className="flex flex-col gap-2.5">
          <div
            data-testid={`slot-filled-preview-${effectiveSlotKey}`}
            className="border-border bg-sunken/70 relative mx-auto w-full max-w-52 overflow-hidden rounded-lg border"
            style={{ aspectRatio: `${parsedRatio.width} / ${parsedRatio.height}` }}
          >
            <img
              src={currentValue.src}
              alt={currentValue.alt || label}
              onLoad={(event) => {
                const img = event.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setLoadedNaturalDims({
                    src: currentValue.src,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                }
              }}
              style={previewCropStyle ?? undefined}
              className={cn(!previewCropStyle && "size-full object-cover")}
            />

            {!readOnly && (
              <button
                type="button"
                onClick={handleTriggerFilePicker}
                data-testid={`slot-replace-btn-${effectiveSlotKey}`}
                className="bg-inverse/85 text-inverse-foreground hover:bg-inverse type-caption absolute right-2 bottom-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium shadow-sm transition-colors"
              >
                <RefreshCw className="size-3" />
                <span>Replace</span>
              </button>
            )}
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openCropEditorFor(currentValue, resolvedNaturalDims)}
                data-testid={`slot-crop-btn-${effectiveSlotKey}`}
                className="flex-1 gap-1.5"
              >
                <Crop className="size-3.5" />
                <span>Crop ({ratioText})</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveImage}
                data-testid={`slot-remove-btn-${effectiveSlotKey}`}
                aria-label={`Remove image from ${label}`}
                className="text-destructive hover:text-destructive gap-1"
              >
                <Trash2 className="size-3.5" />
                <span>Remove</span>
              </Button>
            </div>
          )}

          {belowMinWidth && slotDefinition?.minWidth && (
            <div className="border-warning/40 bg-warning-soft text-foreground flex items-start gap-2 rounded-lg border px-2.5 py-2">
              <AlertTriangle className="text-warning mt-0.5 size-3.5 shrink-0" />
              <span className="type-caption">
                Recommended minimum width is {slotDefinition.minWidth}px for sharp exports.
              </span>
            </div>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={readOnly ? -1 : 0}
          onClick={handleTriggerFilePicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleTriggerFilePicker();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!readOnly) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          data-testid={`slot-dropzone-${effectiveSlotKey}`}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-center transition-colors outline-none",
            isDragging
              ? "border-primary bg-primary-soft/50"
              : "border-border-strong/60 bg-surface hover:border-primary/60 hover:bg-surface/80",
            readOnly && "cursor-not-allowed opacity-60",
          )}
        >
          <span className="bg-primary-soft text-primary inline-flex size-9 items-center justify-center rounded-full">
            <Upload className="size-4" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground type-body-s-strong">Drop screenshot</span>
            <span className="text-tertiary type-caption">
              PNG / JPG / WebP · Ratio {ratioText}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`slot-alt-${effectiveSlotKey}`} className="text-tertiary type-caption">
          Alt text
        </Label>
        <Input
          id={`slot-alt-${effectiveSlotKey}`}
          type="text"
          placeholder="Describe screenshot for accessibility"
          value={currentValue.alt}
          disabled={readOnly}
          onChange={(event) =>
            onChange({
              ...currentValue,
              slot: effectiveSlotKey,
              alt: event.target.value,
            })
          }
        />
      </div>

      {supportsDevicePicker && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`slot-device-${effectiveSlotKey}`} className="text-tertiary type-caption">
            Device mockup
          </Label>
          <select
            id={`slot-device-${effectiveSlotKey}`}
            data-testid={`slot-device-select-${effectiveSlotKey}`}
            value={currentValue.device ?? ""}
            disabled={readOnly}
            onChange={(event) => {
              const nextDevice = event.target.value as "" | SlotDevice;
              const nextValue: ImageSlotValue = {
                slot: effectiveSlotKey,
                src: currentValue.src,
                alt: currentValue.alt,
                assetId: currentValue.assetId ?? null,
                crop: currentValue.crop ?? null,
                ...(nextDevice ? { device: nextDevice } : {}),
              };
              onChange(nextValue);
            }}
            className="border-border bg-background text-foreground type-body-s focus-visible:ring-ring/40 h-9 w-full rounded-lg border px-2.5 outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">
              Template default ({slotDefinition?.device ?? "auto"})
            </option>
            <option value="iphone">iPhone Pro (Dynamic Island)</option>
            <option value="iphone-notch">iPhone (Classic Notch)</option>
            <option value="android">Android Flagship</option>
            <option value="tablet">iPad Pro Tablet</option>
            <option value="macbook">MacBook Pro</option>
            <option value="browser">Browser Window</option>
            <option value="none">No Frame (Plain)</option>
          </select>
        </div>
      )}

      {/* Locked-Ratio Crop Modal (02-RULES.md §4: ratio strictly locked to template.slots[key].ratio) */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent
          data-testid="image-slot-crop-dialog"
          data-locked-ratio={ratioText}
          data-locked-aspect={String(parsedRatio.numeric)}
          data-crop-rect={pendingCropPixels ? JSON.stringify(pendingCropPixels) : ""}
          className="sm:max-w-xl"
        >
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <DialogTitle>Crop {label}</DialogTitle>
              <Badge tone="accent" withDot={false}>
                Locked ratio · {ratioText}
              </Badge>
            </div>
            <DialogDescription>
              Drag to reposition or zoom in. Aspect ratio is locked to {ratioText} to match your
              template layout.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-inverse relative h-80 w-full overflow-hidden rounded-xl sm:h-96">
            {activeCropSrc && (
              <Cropper
                key={cropDialogSessionKey}
                image={activeCropSrc}
                crop={cropLocation}
                zoom={zoom}
                aspect={parsedRatio.numeric}
                minZoom={1}
                maxZoom={3}
                roundCropAreaPixels
                initialCroppedAreaPixels={initialAreaPixelsForSession}
                onCropChange={setCropLocation}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
                onCropAreaChange={handleCropComplete}
              />
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <ZoomIn className="text-tertiary size-4 shrink-0" />
              <Label htmlFor="slot-crop-zoom-slider" className="text-tertiary type-caption w-12">
                Zoom
              </Label>
              <input
                id="slot-crop-zoom-slider"
                type="range"
                aria-label="Crop zoom"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="accent-primary h-1.5 flex-1 cursor-pointer"
              />
              <span className="text-muted-foreground type-caption w-11 text-right font-mono">
                {zoom.toFixed(2)}x
              </span>
            </div>

            {pendingCropPixels && (
              <div className="text-tertiary type-caption flex items-center justify-between">
                <span>
                  Selection: {pendingCropPixels.width} × {pendingCropPixels.height}px
                </span>
                <button
                  type="button"
                  onClick={handleResetCrop}
                  data-testid="crop-dialog-reset"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="size-3" />
                  <span>Reset crop</span>
                </button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCropDialogOpen(false)}
              data-testid="crop-dialog-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApplyCrop}
              data-testid="crop-dialog-apply"
            >
              Apply crop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
