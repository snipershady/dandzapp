import { expect, test } from '@playwright/test';
import { ENTRO_3_SECONDI, preparaTavolo } from './aiuti.ts';

test('i tiri arrivano a tutti; quelli nascosti del Master no (RF-50…RF-62)', async ({
  browser,
  request,
  page,
}) => {
  const { master, irene, scheda } = await preparaTavolo(browser, request, page);
  await master.goto(scheda);
  const dadiIrene = irene.getByRole('region', { name: 'Dadi' });
  const storicoIrene = irene.getByRole('region', { name: 'Storico dei tiri' });
  const storicoMaster = master.getByRole('region', { name: 'Storico dei tiri' });

  // Senza un PG scelto la giocatrice non tira.
  await expect(dadiIrene.getByRole('note')).toContainText('Giochi come');
  await expect(dadiIrene.getByRole('button', { name: 'd20' })).toBeDisabled();

  // Il Master le assegna Shania, che diventa il suo "Giochi come".
  await master.goto(`${scheda}/gestione`);
  const nuovoPg = master.locator('details', { hasText: 'Aggiungi un personaggio' });
  await nuovoPg.getByLabel('Nome').fill('Shania');
  await nuovoPg.getByLabel('Giocatore').selectOption({ label: 'Irene' });
  await nuovoPg.getByRole('button', { name: 'Aggiungi' }).click();
  await master.goto(scheda);
  await expect(dadiIrene.getByRole('button', { name: 'd20' })).toBeEnabled(ENTRO_3_SECONDI);

  await dadiIrene.getByLabel('Modificatore').fill('2');
  await dadiIrene.getByLabel('Motivo').fill('attacco');
  await dadiIrene.getByRole('button', { name: 'd20' }).click();
  const totale = await dadiIrene.locator('[data-totale]').textContent();
  expect(Number(totale)).toBeGreaterThanOrEqual(3);
  expect(Number(totale)).toBeLessThanOrEqual(22);

  const riga = storicoMaster.getByRole('listitem').first();
  await expect(riga).toContainText('Shania', ENTRO_3_SECONDI);
  await expect(riga).toContainText('Irene');
  await expect(riga).toContainText('attacco');
  await expect(riga).toContainText(`1d20+2`);
  await expect(riga).toContainText(`→ ${totale}`);

  // Tiro nascosto del Master: lo vede solo lui.
  const dadiMaster = master.getByRole('region', { name: 'Dadi' });
  await dadiMaster.getByLabel('Tiro nascosto').check();
  await dadiMaster.getByRole('button', { name: '3d6' }).click();
  await expect(storicoMaster.getByRole('listitem')).toHaveCount(2, ENTRO_3_SECONDI);
  await expect(storicoMaster.getByRole('listitem').first()).toContainText('nascosto');
  await irene.waitForTimeout(1000);
  await expect(storicoIrene.getByRole('listitem')).toHaveCount(1);

  // Svuota lo storico, con conferma nella pagina.
  await storicoMaster.getByRole('button', { name: 'Svuota' }).click();
  await storicoMaster.getByRole('button', { name: 'Svuota' }).click();
  await expect(storicoIrene.getByText('Ancora nessun tiro.')).toBeVisible(ENTRO_3_SECONDI);
});
