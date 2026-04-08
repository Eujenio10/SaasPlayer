"use client";

import { useEffect } from "react";

interface SecurityRuntimeGuardProps {
  organizationId: string | null;
}

async function sendSecurityEvent(eventType: string) {
  try {
    await fetch("/api/security/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        eventType,
        path: window.location.pathname,
        visibility: document.visibilityState,
        fullscreen: Boolean(document.fullscreenElement)
      })
    });
  } catch {
    // best effort monitoring
  }
}

function rebuildWatermarkOverlay() {
  const body = document.body;
  const watermarkContent =
    body.getAttribute("data-watermark-content") ?? "Agency Monitor | SESSIONE N/A";

  const overlay = document.createElement("div");
  overlay.className = "watermark-layer";
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("data-security-overlay", "true");
  overlay.setAttribute("data-watermark-content", watermarkContent);

  const text = document.createElement("div");
  text.className = "watermark-text";
  text.textContent = watermarkContent;

  overlay.appendChild(text);
  body.prepend(overlay);
}

export function SecurityRuntimeGuard({ organizationId }: SecurityRuntimeGuardProps) {
  useEffect(() => {
    if (!organizationId) return;

    void sendSecurityEvent("runtime_heartbeat_boot");

    const interval = setInterval(() => {
      void sendSecurityEvent("runtime_heartbeat");
    }, 60000);

    const observer = new MutationObserver(() => {
      const existing = document.querySelector('[data-security-overlay="true"]');
      if (!existing) {
        rebuildWatermarkOverlay();
        void sendSecurityEvent("watermark_rebuild");
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, [organizationId]);

  return null;
}
