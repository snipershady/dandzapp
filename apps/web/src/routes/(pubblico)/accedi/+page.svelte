<script lang="ts">
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { RispostaUtente } from '@dandzapp/shared';
  import { api } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import Campo from '#lib/componenti/Campo.svelte';
  import { StatoModulo } from '#lib/modulo.svelte.ts';
  import { destinazioneSicura } from '#lib/navigazione.ts';

  let email = $state('');
  let password = $state('');
  const modulo = new StatoModulo();

  async function accedi(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    const ok = await modulo.invia(() =>
      api('/api/auth/accesso', {
        metodo: 'POST',
        corpo: { email, password },
        schema: RispostaUtente,
      }),
    );
    if (ok) {
      // Percorso già validato da destinazioneSicura: non è una rotta nota in anticipo.
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await goto(destinazioneSicura(page.url.searchParams.get('dopo')), {
        replaceState: true,
        invalidateAll: true,
      });
    }
  }
</script>

<svelte:head><title>Accedi · Tavolo virtuale</title></svelte:head>

<h2>Accedi</h2>

{#if modulo.errore}<Avviso>{modulo.errore}</Avviso>{/if}

<form onsubmit={accedi} novalidate>
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
    autocomplete="current-password"
    required
    bind:value={password}
    errore={modulo.campi['password']}
  />
  <button class="primario" type="submit" disabled={modulo.inInvio}>
    {modulo.inInvio ? 'Accesso in corso…' : 'Accedi'}
  </button>
</form>

<p class="link"><a href={resolve('password-dimenticata')}>Hai dimenticato la password?</a></p>
<p class="link">Non hai un account? <a href={resolve('registrati')}>Registrati</a></p>
