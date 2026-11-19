"use client";

import { useEffect } from "react";

export function PublicViewTracker({ projectId }: { projectId: string }) {
  useEffect(() => {
    const payload = JSON.stringify({
      projectId,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    });

    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        const queued = navigator.sendBeacon("/api/track", blob);
        if (queued) return;
      }
    } catch {
      // Fall back to fetch keepalive
    }

    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  }, [projectId]);

  return null;
}

