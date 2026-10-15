/** Unisce le parti non vuote con " · " (es. "Il santuario sepolto · Emirato di Nithia"). */
export function conPunti(...parti: (string | null | undefined | false)[]): string {
  return parti.filter(Boolean).join(' · ');
}
