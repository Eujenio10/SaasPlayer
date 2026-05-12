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

export function SecurityRuntimeGuard({ organizationId }: SecurityRuntimeGuardProps) {
  useEffect(() => {
    if (!organizationId) return;

    void sendSecurityEvent("runtime_heartbeat_boot");

    const interval = setInterval(() => {
      void sendSecurityEvent("runtime_heartbeat");
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [organizationId]);

  return null;
}
