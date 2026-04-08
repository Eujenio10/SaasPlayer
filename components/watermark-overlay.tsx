interface WatermarkOverlayProps {
  organizationName: string;
  sessionTag: string;
}

export function WatermarkOverlay({
  organizationName,
  sessionTag
}: WatermarkOverlayProps) {
  const watermarkText = `${organizationName} | SESSIONE ${sessionTag}`;

  return (
    <div
      className="watermark-layer"
      aria-hidden="true"
      data-security-overlay="true"
      data-watermark-content={watermarkText}
      suppressHydrationWarning
    >
      <div className="watermark-text">{watermarkText}</div>
    </div>
  );
}
