<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { RispostaPartitaCreata } from '@dandzapp/shared';
  import { api } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import { StatoModulo } from '#lib/modulo.svelte.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const invito = $derived(data.invito);
  const utente = $derived(data.utente);
  const qui = $derived(page.url.pathname);
  const emailGiusta = $derived(utente?.email === invito.email);
  const modulo = new StatoModulo();

  const MOTIVI = {
    usato: 'Questo invito è già stato usato.',
    scaduto: 'Questo invito è scaduto: chiedine uno nuovo al Master.',
    'partita archiviata': 'La partita è stata archiviata e non accetta nuovi partecipanti.',
  } as const;

  async function accetta(): Promise<void> {
    let id = 0;
    const ok = await modulo.invia(async () => {
      ({ id } = await api(`/api/inviti/${encodeURIComponent(page.params.token ?? '')}/accetta`, {
        metodo: 'POST',
        schema: RispostaPartitaCreata,
      }));
    });
    if (ok) await goto(resolve(`partite/${id}`), { replaceState: true, invalidateAll: true });
  }

  const conParametri = (pagina: 'accedi' | 'registrati') =>
    `${resolve(pagina)}?${new URLSearchParams({ dopo: qui, email: invito.email })}`;
</script>

<svelte:head><title>Invito · Tavolo virtuale</title></svelte:head>

<h2>Sei stato invitato</h2>
<p>
  <strong>{invito.master.nome}</strong> ti invita alla partita
  <strong>“{invito.partita.titolo}”</strong>
  come {invito.ruolo === 'giocatore'
    ? 'giocatore'
    : 'osservatore (sola lettura)'}{#if invito.personaggio}, con il personaggio <strong
      >{invito.personaggio}</strong
    >{/if}.
</p>

{#if invito.stato !== 'valido'}
  <Avviso>{MOTIVI[invito.stato]}</Avviso>
  <p class="link"><a href={resolve('')}>Vai alle tue partite</a></p>
{:else if !utente}
  <p>L'invito è per <strong>{invito.email}</strong>. Per unirti, entra con quell'email:</p>
  <!-- eslint-disable svelte/no-navigation-without-resolve -- percorsi già risolti, con parametri -->
  <a class="pulsante" href={conParametri('registrati')}>Crea un account</a>
  <p class="link">Hai già un account? <a href={conParametri('accedi')}>Accedi</a></p>
  <!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else if !emailGiusta}
  <Avviso>
    Hai effettuato l'accesso come {utente.email}, ma l'invito è per {invito.email}. Esci ed entra
    con l'account giusto, oppure chiedi al Master di invitare {utente.email}.
  </Avviso>
{:else}
  {#if modulo.errore}<Avviso>{modulo.errore}</Avviso>{/if}
  <button class="primario" type="button" disabled={modulo.inInvio} onclick={accetta}>
    Unisciti alla partita
  </button>
{/if}

<style>
  .pulsante {
    display: block;
    text-align: center;
    background: var(--accento);
    color: var(--su-accento);
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    text-decoration: none;
    font-weight: 700;
  }
</style>
