# Generatore di mappe

Disegna le mappe dei dungeon in stile Dyson Logos (roccia tratteggiata, pavimento a griglia, simboli della legenda `santuario_zebulon_dungeon/legenda.pdf`) e produce il file dell'avventura da importare nel tavolo.

Il motore è generico: il dungeon si descrive in `avventure/<id>/dungeon.json`, senza toccare il codice.

## Uso

Serve [uv](https://docs.astral.sh/uv/), che installa da solo Python, shapely e cairosvg.

```sh
npm run mappa:genera -- avventure/sessione-0        # dalla radice del repository
npm run avventura:importa -- avventure/sessione-0   # poi la si carica nel tavolo
```

Il comando scrive nella cartella dell'avventura:

| File                              | Contenuto                                                                  | Va nel tavolo?                         |
| --------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| `avventura.json`                  | Zone, segreti, posti di partenza, mostri, dimensioni (coordinate in pixel) | sì                                     |
| `mappa_giocatori.png`             | Mappa senza segreti, numeri e "S"                                          | sì                                     |
| `segreti/<id>.png`                | Ritagli che compaiono quando il Master scopre la zona collegata            | sì                                     |
| `master/mappa_master.png`, `.pdf` | Mappa completa per il Master                                               | **no**: non va mai caricata sul tavolo |

Con `--svg` salva anche gli SVG intermedi in `master/` (utile per il debug).

La stessa descrizione produce sempre la stessa mappa: i numeri casuali hanno semi fissi (`semi`). Cambiando un seme cambiano la trama della roccia, la forma delle grotte, i detriti e simili.

## Formato di `dungeon.json`

Tutte le coordinate sono in **quadretti** (1 quadretto = `griglia.px` pixel). L'origine `[0, 0]` è spostata di `griglia.origine` quadretti dal bordo in alto a sinistra, così si possono usare coordinate negative per i margini.

```jsonc
{
  "id": "sessione-0",                  // identificativo dell'avventura (minuscole, cifre, trattini)
  "titolo": "Il santuario sepolto",
  "sottotitolo": "Emirato di Nithia · sessione 0",   // facoltativo
  "griglia": { "px": 40, "metri": 3, "piedi": 10, "larghezza": 37, "altezza": 27, "origine": [4, 3] },
  "semi": { "tratteggio": 7, "forme": 11 },          // facoltativo

  "forme": [ ... ],          // il pavimento: stanze, corridoi, grotte
  "roccia_esclusa": [ ... ], // rettangoli senza tratteggio (es. l'uscita della scala)
  "simboli": [ ... ],        // porte, colonne, scale, acqua... disegnati nell'ordine dato
  "scala_grafica": { "pos": [-3, 21.2] },
  "nord": { "pos": [24.5, -1.5] },

  "zone": [ ... ],           // aree della nebbia di guerra
  "zone_iniziali": ["ingresso"],
  "segreti": [ ... ],        // sovrapposizioni legate a una zona
  "partenze": [[7.5, 19.0], ...],   // posti di partenza dei PG, in ordine
  "mostri": [{ "nome": "Scorpione gigante", "sigla": "Sc" }, ...]
}
```

### Forme

Ogni forma ha un `id`. Con `"segreta": true` non compare nella mappa dei giocatori: si vede solo sulla mappa del Master e nei ritagli dei segreti.

| `tipo`       | Campi                                                                      | Uso                         |
| ------------ | -------------------------------------------------------------------------- | --------------------------- |
| `rettangolo` | `da`, `a` (angoli opposti)                                                 | stanze e corridoi squadrati |
| `cerchio`    | `centro`, `raggio`, `ritaglio` facoltativo (`da`, `a`)                     | absidi, nicchie             |
| `grotta`     | `cerchi` (`[x, y, raggio]`), `arrotondamento` (0.6), `irregolarita` (0.3)  | caverne naturali            |
| `galleria`   | `punti`, `larghezza`, `spigoli` (`arrotondati`/`vivi`), `irregolarita` (0) | cunicoli, passaggi segreti  |

### Simboli

| `tipo`          | Campi                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| `porta`         | `pos`, `orientamento` (`orizzontale`/`verticale`), `larghezza` (1), `doppia`        |
| `porta_segreta` | `pos`, `orientamento`: muro continuo; "S" solo per il Master                        |
| `gradini`       | `da`, `a`, `passo` (0.4): gradini orizzontali da `da.y` verso `a.y`                 |
| `apertura`      | `da`, `a`: varco bianco nel muro                                                    |
| `testo`         | `pos`, `testo`                                                                      |
| `colonna`       | `pos`, `raggio` (0.32)                                                              |
| `statua`        | `pos`                                                                               |
| `altare`        | `pos`, `rotazione` (gradi)                                                          |
| `cassa`         | `pos` (angolo in alto a sinistra), `lato` (0.62)                                    |
| `barile`        | `pos`, `raggio` (0.27)                                                              |
| `detriti`       | `da`, `a`, `quantita` (28)                                                          |
| `numero`        | `n`, `pos`: numero della stanza, solo per il Master                                 |
| `pozza`         | `id`, `in` (forma), `centro`, `raggio`, `ritaglio`, `irregolarita` (0.18)           |
| `crepaccio`     | `id`, `in` (forma), `punti`, `larghezza` (1.5), `irregolarita` (0.28), `sassi` (25) |
| `stalattiti`    | `in` (forma), `quantita` (12), `evita` (aree)                                       |
| `ponte`         | `su` (id di un crepaccio), `y`, `cerca_tra` (`[x_min, x_max]`): ponte orizzontale   |

L'ordine conta: i simboli si disegnano nell'ordine dato, e `pozza` e `crepaccio` vanno descritti prima dei simboli che li usano.

### Aree (zone, segreti, `evita`)

Un'area è una di queste:

- `{ "rettangolo": { "da": [x, y], "a": [x, y] } }`
- `{ "cerchio": [x, y], "raggio": r }`
- `{ "forme": ["id", ...], "margine": 0.45 }`: unione di forme (o di una `pozza`/`crepaccio`) allargata del margine

Le zone (`id`, `nome`, `area`) coprono il pavimento con un po' di margine, così la nebbia nasconde anche i muri. Il generatore calcola per ogni zona un `centro` interno al poligono, dove compaiono i mostri.

Un segreto (`id`, `zona`, `area`) produce `segreti/<id>.png`: il ritaglio dell'area con il passaggio disegnato, mostrato ai giocatori solo quando `zona` è scoperta.
