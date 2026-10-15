/** Destinazione dopo l'accesso: solo percorsi interni, mai URL di altri siti. */
export function destinazioneSicura(dopo: string | null): string {
  return dopo && dopo.startsWith('/') && !dopo.startsWith('//') ? dopo : '/';
}
