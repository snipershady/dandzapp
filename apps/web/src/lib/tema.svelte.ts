/**
 * Tema chiaro/scuro (RNF-03). Per impostazione segue il dispositivo; l'interruttore lo
 * può fissare. La scelta vale per questo browser (localStorage), non per l'account.
 */
export type Tema = 'sistema' | 'chiaro' | 'scuro';

const CHIAVE = 'tavolo.tema';

function letto(): Tema {
  try {
    const v = localStorage.getItem(CHIAVE);
    return v === 'chiaro' || v === 'scuro' ? v : 'sistema';
  } catch {
    // Archiviazione bloccata (navigazione privata, impostazioni): si segue il dispositivo.
    return 'sistema';
  }
}

function applica(tema: Tema): void {
  if (tema === 'sistema') delete document.documentElement.dataset['tema'];
  else document.documentElement.dataset['tema'] = tema;
}

class Preferenza {
  valore = $state<Tema>('sistema');

  /** Da chiamare all'avvio, prima del primo disegno, per non far lampeggiare i colori. */
  carica(): void {
    this.valore = letto();
    applica(this.valore);
  }

  imposta(tema: Tema): void {
    this.valore = tema;
    applica(tema);
    try {
      if (tema === 'sistema') localStorage.removeItem(CHIAVE);
      else localStorage.setItem(CHIAVE, tema);
    } catch {
      // Non salvata: vale finché la pagina resta aperta.
    }
  }
}

export const tema = new Preferenza();
