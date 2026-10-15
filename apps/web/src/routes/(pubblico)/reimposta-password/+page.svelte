<script lang="ts">
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { PASSWORD_MIN, RispostaUtente } from '@dandzapp/shared';
  import { api } from '#lib/api.ts';
  import Avviso from '#lib/componenti/Avviso.svelte';
  import Campo from '#lib/componenti/Campo.svelte';
  import { StatoModulo } from '#lib/modulo.svelte.ts';

  const token = page.url.searchParams.get('token') ?? '';
  let password = $state('');
  let ripeti = $state('');
  const modulo = new StatoModulo();

  async function reimposta(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    if (password !== ripeti) {
      modulo.campi = { ripeti: 'Le due password non coincidono' };
      return;
    }
    const ok = await modulo.invia(() =>
      api('/api/auth/reimposta-password', {
        metodo: 'POST',
        corpo: { token, password },
        schema: RispostaUtente,
      }),
    );
    if (ok) {
      await goto(resolve(''), { replaceState: true, invalidateAll: true });
    }
  }
</script>

<svelte:head><title>Nuova password · Tavolo virtuale</title></svelte:head>

<h2>Scegli la password</h2>

{#if !token}
  <Avviso>Il link non è completo: aprilo di nuovo dall'email o chiedine uno nuovo.</Avviso>
  <p class="link"><a href={resolve('password-dimenticata')}>Chiedi un nuovo link</a></p>
{:else}
  {#if modulo.errore}
    <Avviso>
      {modulo.errore}
      {#if modulo.campi['token'] || modulo.errore.includes('link')}
        <a href={resolve('password-dimenticata')}>Chiedi un nuovo link</a>
      {/if}
    </Avviso>
  {/if}
  <form onsubmit={reimposta} novalidate>
    <Campo
      etichetta="Nuova password"
      name="password"
      type="password"
      autocomplete="new-password"
      required
      minlength={PASSWORD_MIN}
      aiuto="Almeno {PASSWORD_MIN} caratteri."
      bind:value={password}
      errore={modulo.campi['password']}
    />
    <Campo
      etichetta="Ripeti la password"
      name="ripeti"
      type="password"
      autocomplete="new-password"
      required
      bind:value={ripeti}
      errore={modulo.campi['ripeti']}
    />
    <button class="primario" type="submit" disabled={modulo.inInvio}>Salva la password</button>
  </form>
{/if}
