export function getPublicOrganizationId(): string | null {
  const id = process.env.PITCHBRAIN_PUBLIC_ORG_ID?.trim();
  return id || null;
}
