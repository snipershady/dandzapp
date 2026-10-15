<script lang="ts">
  import { resolve } from '$app/paths';
  import { z } from 'zod';
  import { api } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import Campo from '#lib/componenti/Campo.svelte';
  import { StatoModulo } from '#lib/modulo.svelte.ts';

  let email = $state('');
  let conferma = $state<string | null>(null);
  const modulo = new StatoModulo();

  async function richiedi(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    await modulo.invia(async () => {
      const { messaggio } = await api('/api/auth/password-dimenticata', {
        metodo: 'POST',
        corpo: { email },
        schema: z.object({ messaggio: z.string() }),
      });
      conferma = messaggio;
    });
  }
</script>

<svelte:head><title>Password dimenticata · Tavolo virtuale</title></svelte:head>

<h2>Password dimenticata</h2>

{#if conferma}
  <Avviso tipo="successo">{conferma}</Avviso>
  <p class="link"><a href={resolve('accedi')}>Torna all'accesso</a></p>
{:else}
  <p>Scrivi l'email del tuo account: ti invieremo un link per sceglierne una nuova.</p>
  {#if modulo.errore}<Avviso>{modulo.errore}</Avviso>{/if}
  <form onsubmit={richiedi} novalidate>
    <Campo
      etichetta="Email"
      name="email"
      type="email"
      autocomplete="email"
      required
      bind:value={email}
      errore={modulo.campi['email']}
    />
    <button class="primario" type="submit" disabled={modulo.inInvio}>Invia il link</button>
  </form>
  <p class="link"><a href={resolve('accedi')}>Torna all'accesso</a></p>
{/if}
