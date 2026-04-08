"use client";

import { useEffect, useState } from "react";

function shouldBlockShortcut(event: KeyboardEvent): boolean {
  if (event.key === "F12") return true;
  if (event.ctrlKey && event.shiftKey && ["I", "J", "C"].includes(event.key)) {
    return true;
  }
  if (event.ctrlKey && ["U", "P", "S"].includes(event.key.toUpperCase())) {
    return true;
  }
  return false;
}

export function KioskSecurityControls() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    function onContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (shouldBlockShortcut(event)) {
        event.preventDefault();
      }
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function enableFullscreen() {
    if (document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // browser policy may block fullscreen without user gesture
    }
  }

  return (
    <div className="kiosk-lock-banner">
      <span>
        Modalita kiosk protetta: menu contestuale e scorciatoie sensibili disabilitate.
      </span>
      <button
        type="button"
        onClick={enableFullscreen}
        className="rounded-lg border border-cyan-300/40 px-3 py-1 text-cyan-200 hover:border-cyan-200"
      >
        {isFullscreen ? "Fullscreen attivo" : "Attiva fullscreen"}
      </button>
    </div>
  );
}
