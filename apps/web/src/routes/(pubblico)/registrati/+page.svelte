<script lang="ts">
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { PASSWORD_MIN, RispostaUtente } from '@dandzapp/shared';
  import { api } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import Campo from '#lib/componenti/Campo.svelte';
  import { StatoModulo } from '#lib/modulo.svelte.ts';
  import { destinazioneSicura } from '#lib/navigazione.ts';

  let nome = $state('');
  let email = $state(page.url.searchParams.get('email') ?? '');
  let password = $state('');
  const modulo = new StatoModulo();

  async function registrati(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    const ok = await modulo.invia(() =>
      api('/api/auth/registrazione', {
        metodo: 'POST',
        corpo: { nome, email, password },
        schema: RispostaUtente,
      }),
    );
    if (ok) {
      // Percorso già validato da destinazioneSicura (es. ritorno al link d'invito).
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await goto(destinazioneSicura(page.url.searchParams.get('dopo')), {
        replaceState: true,
        invalidateAll: true,
      });
    }
  }
</script>

<svelte:head><title>Registrati · Tavolo virtuale</title></svelte:head>

<h2>Crea il tuo account</h2>

{#if modulo.errore}<Avviso>{modulo.errore}</Avviso>{/if}

<form onsubmit={registrati} novalidate>
  <Campo
    etichetta="Nome visualizzato"
    name="nome"
    autocomplete="nickname"
    required
    maxlength={60}
    aiuto="Il nome che gli altri vedranno al tavolo."
    bind:value={nome}
    errore={modulo.campi['nome']}
  />
  <Campo
    etichetta="Email"
    name="email"
    type="email"
    autocomplete="email"
    required
    bind:value={email}
    errore={modulo.campi['email']}
  />
  <Campo
    etichetta="Password"
    name="password"
    type="password"
    autocomplete="new-password"
    required
    minlength={PASSWORD_MIN}
    aiuto="Almeno {PASSWORD_MIN} caratteri."
    bind:value={password}
    errore={modulo.campi['password']}
  />
  <button class="primario" type="submit" disabled={modulo.inInvio}>
    {modulo.inInvio ? 'Registrazione in corso…' : 'Registrati'}
  </button>
</form>

<p class="link">
  Hai già un account?
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- stessi parametri di questa pagina -->
  <a href="{resolve('accedi')}{page.url.search}">Accedi</a>
</p>
