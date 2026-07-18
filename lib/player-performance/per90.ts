export function calculatePer90(totalEvents: number, totalMinutes: number): number {
  if (totalMinutes <= 0) return 0;
  return (totalEvents / totalMinutes) * 90;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function round0(value: number): number {
  return Math.round(value);
}
