import { ErroreApi } from './api';

/**
 * Stato di un modulo inviato all'API: invio in corso, errore generale ed errori per campo.
 */
export class StatoModulo {
  inInvio = $state(false);
  errore = $state<string | null>(null);
  campi = $state<Record<string, string>>({});

  /** Esegue l'azione mostrando gli errori dell'API; restituisce `true` se è andata a buon fine. */
  async invia(azione: () => Promise<unknown>): Promise<boolean> {
    if (this.inInvio) return false;
    this.inInvio = true;
    this.errore = null;
    this.campi = {};
    try {
      await azione();
      return true;
    } catch (e) {
      if (e instanceof ErroreApi) {
        this.errore = e.message;
        this.campi = e.campi;
      } else {
        this.errore = 'Errore imprevisto: riprova';
      }
      return false;
    } finally {
      this.inInvio = false;
    }
  }
}
