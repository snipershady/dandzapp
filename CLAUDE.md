# CLAUDE.md — Tavolo Virtuale per D&D (BECMI)

> File di contesto per lo sviluppo con Claude Code.
> Stato: **raccolta requisiti dell'MVP**. Lo stack tecnico verrà definito in seguito: le sezioni che lo riguardano sono segnate come *da decidere*.
> Lingua del progetto, dell'interfaccia e della documentazione: **italiano**.

---

## 1. Visione

Un **tavolo di gioco virtuale** per giocare a Dungeons & Dragons a distanza con un gruppo di amici. Tutti aprono la stessa pagina nel browser e vedono, in tempo reale e sempre allineati:

- la **mappa del dungeon**, che si scopre man mano che il gruppo esplora (nebbia di guerra);
- le **pedine** dei personaggi e dei mostri;
- i **tiri di dado** di tutti, in uno storico condiviso;
- i **testi** che il Master legge ad alta voce.

Il Master controlla cosa vedono i giocatori; i giocatori tirano i dadi e muovono le proprie pedine. La voce resta fuori dal tavolo (Discord, Meet o simili).

Il progetto nasce da un **prototipo funzionante** (una pagina web pubblicata su claude.ai, link: https://claude.ai/artifact/8F3mGLarh24Ek9rnsqmMsG) usato per la "Sessione 0 – Il santuario sepolto". Questo documento descrive quel prototipo come base dei requisiti dell'MVP e raccoglie quanto imparato usandolo.

### Principi guida

1. **Semplice prima di tutto.** Deve funzionare per un gruppo di amici senza installazioni e senza configurazioni complicate. Non vuole competere con Roll20 o Foundry.
2. **Una sola verità condivisa.** Lo stato del tavolo vive in un unico posto; ogni schermo ne è una vista. Nessuno deve mai vedere una situazione diversa dagli altri per più di pochi secondi.
3. **Niente spoiler.** Ciò che i giocatori non hanno ancora scoperto non deve essere visibile, né sulla mappa né nei dati che arrivano al loro browser.
4. **Il Master ha l'ultima parola.** Solo il Master scopre la mappa, gestisce i mostri e pubblica i testi.
5. **Fedeltà al regolamento BECMI** (scatola rossa Base + Expert, edizione italiana) e all'ambientazione Mystara.

---

## 2. Contesto d'uso

- **Gioco:** D&D edizione BECMI (Base, Expert), campagna su Mystara, attualmente negli Emirati di Ylaruam.
- **Gruppo:** 1 Master (Marco, proprietario del tavolo) + 6 giocatori, tutti da remoto.
- **Sessioni:** circa 2 ore, serali, con chiamata vocale in parallelo.
- **Dispositivi:** soprattutto computer; il tavolo deve restare utilizzabile anche da telefono o tablet.
- **Competenze dei giocatori:** utenti comuni, non tecnici. Ogni passaggio di accesso deve essere ovvio.

### Il gruppo attuale (dati di esempio reali)

| Personaggio | Giocatore | Classe | Sigla | Colore pedina |
| --- | --- | --- | --- | --- |
| Shania | Irene | Guerriera | Sh | rosso `#a8322a` |
| Duronin | Fabio | Nano | Du | ocra `#8a5a1c` |
| Dworgin | Enzo | Nano | Dw | verde `#4f6b2a` |
| Gilmares | Lara | Chierica | Gi | azzurro `#2c6a8f` |
| Meriadoc | Gianluca | Halfling | Me | viola `#6b3f86` |
| Annevar | Luca | Mago | An | blu `#1f4f8f` |

Tutti di 5° livello. Le schede sono file Excel nella cartella `d&d_international/Personaggi`.

---

## 3. Glossario

| Termine | Significato nel progetto |
| --- | --- |
| **Tavolo** | La pagina condivisa in cui si gioca una sessione. |
| **Master** | Chi conduce il gioco. Nel prototipo coincide con il **proprietario** del tavolo. |
| **Giocatore** | Partecipante che controlla un personaggio. |
| **Osservatore** | Chi ha accesso al tavolo ma non può modificarlo (sola lettura). |
| **PG** | Personaggio giocante. |
| **Avventura** | Un insieme di mappa, zone, mostri e testi preparati per una o più sessioni. |
| **Mappa del Master** | Versione completa della mappa: porte segrete ("S"), numeri delle stanze, trappole. Non va mai mostrata ai giocatori. |
| **Mappa dei giocatori** | Versione senza segreti, quella caricata sul tavolo. |
| **Zona** | Area della mappa (stanza, corridoio, grotta) descritta da un poligono, che il Master può scoprire o coprire. |
| **Nebbia di guerra** | Copertura che nasconde le zone non ancora scoperte. |
| **Sovrapposizione segreta** | Ritaglio di immagine (es. il passaggio segreto) che compare sulla mappa dei giocatori solo quando la zona corrispondente viene scoperta. |
| **Pedina** | Segnalino sulla mappa: tondo per i PG, rombo per i mostri. |
| **Tiro nascosto** | Tiro di dado del Master che vedono solo il Master. |
| **Quadretto** | Unità della griglia: 1 quadretto = 3 m (10 ft). |

---

## 4. Ruoli e permessi

| Azione | Master | Giocatore | Osservatore |
| --- | :---: | :---: | :---: |
| Vedere la mappa scoperta, le pedine, lo storico tiri | ✔ | ✔ | ✔ |
| Vedere la nebbia in trasparenza (zone non scoperte) | ✔ | ✘ | ✘ |
| Scoprire / coprire le zone | ✔ | ✘ | ✘ |
| Aggiungere, spostare, togliere mostri | ✔ | ✘ | ✘ |
| Vedere i mostri nelle zone non scoperte | ✔ | ✘ | ✘ |
| Muovere le pedine dei PG | ✔ | ✔ | ✘ |
| Tirare i dadi (visibili a tutti) | ✔ | ✔ | ✘ |
| Tiri nascosti | ✔ | ✘ | ✘ |
| Pubblicare / nascondere il testo da leggere | ✔ | ✘ | ✘ |
| Riportare le pedine all'ingresso | ✔ | ✘ | ✘ |
| Svuotare lo storico tiri | ✔ | ✘ | ✘ |
| Chiedere a Claude (risposta privata) | ✔ | ✔ | ✔ (se ha un account) |

Regole:
- Il **Master** è un ruolo esplicito, non una conseguenza dei permessi di modifica. *(Lezione del prototipo: usare "chi può modificare" come criterio dava il pannello del Master anche ai giocatori invitati come Editor.)*
- I permessi vanno **imposti dal server**, non solo nascosti nell'interfaccia: un giocatore non deve poter scoprire la nebbia neanche manipolando la pagina.
- Nell'MVP un giocatore può muovere **qualsiasi** pedina PG (comodo se qualcuno è assente). Valutare in seguito il vincolo "solo la propria".

---

## 5. Requisiti funzionali dell'MVP

Ogni requisito ha un codice (RF-xx) per riferimento in issue e commit.

### 5.1 Accesso e identità

- **RF-01 Accesso con account.** Ogni partecipante entra con un'identità riconosciuta (nome visualizzato, eventuale avatar). Senza identità non si può scrivere sul tavolo.
- **RF-02 Invito.** Il Master invita i giocatori; deve essere chiaro e semplice. *(Lezione del prototipo: la condivisione tramite link pubblico rendeva i giocatori di sola lettura senza che se ne accorgessero; l'invito andava fatto per email con un ruolo preciso. L'MVP deve rendere impossibile questo equivoco o segnalarlo in modo evidente.)*
- **RF-03 Scelta del personaggio.** Ogni partecipante sceglie da un elenco "Giochi come: <PG> / Master". La scelta etichetta i suoi tiri ed evidenzia la sua pedina. Viene ricordata sul suo dispositivo.
- **RF-04 Avviso di sola lettura.** Chi non può scrivere vede un avviso ben visibile (in rosso) che spiega perché e cosa fare. Lo stesso se non ha effettuato l'accesso.

### 5.2 Mappa

- **RF-10 Mappa dei giocatori.** Immagine della mappa senza segreti, con griglia (1 quadretto = 3 m), scala grafica e indicazione del nord. Si adatta alla larghezza dello schermo.
- **RF-11 Stile grafico.** Le mappe seguono lo stile "Dyson Logos" in bianco e nero (roccia tratteggiata, pavimenti a griglia), con i simboli della legenda di riferimento (`santuario_zebulon_dungeon/legenda.pdf`): porte, doppie porte, porte segrete, scale, colonne, statue, altare, casse e barili, detriti, crepaccio, ponte di corda e legno, pozza; le stalattiti come cerchietti con punto.
- **RF-12 Coordinate.** Tutte le posizioni (zone, pedine, mostri) sono espresse nelle coordinate dell'immagine della mappa, indipendenti dalla dimensione dello schermo.

### 5.3 Nebbia di guerra

- **RF-20 Zone.** Ogni avventura definisce un elenco di zone con id, nome leggibile e poligono. Esempio (Sessione 0): Scala d'ingresso, 1 · Sala d'ingresso, Corridoio est (porta ostruita), Corridoio nord, 3 · Sacrario del falco, Passaggio segreto, 2 · Sala delle colonne, Corridoio sud, 4 · Grotta del crepaccio, Cunicolo est, 5 · Caverna della pozza.
- **RF-21 Copertura.** Le zone non scoperte sono completamente coperte per giocatori e osservatori; il Master le vede in trasparenza (circa 55% di opacità).
- **RF-22 Pannello zone.** Il Master ha un elenco di caselle, una per zona: spuntarla scopre la zona per tutti, togliere la spunta la ricopre.
- **RF-23 Stato iniziale.** All'avvio di un'avventura è scoperta solo la zona d'ingresso.
- **RF-24 Sovrapposizioni segrete.** Elementi come il passaggio segreto non compaiono nella mappa dei giocatori; vengono mostrati da un'immagine sovrapposta legata a una zona, visibile solo quando quella zona è scoperta.
- **RF-25 La nebbia non blocca l'interazione.** La copertura non deve intercettare clic e trascinamenti sugli elementi sottostanti. *(Bug reale del prototipo: le pedine dei mostri sotto la nebbia non si potevano afferrare.)*

### 5.4 Pedine dei personaggi

- **RF-30** Una pedina tonda per ogni PG, con colore e sigla (vedi tabella del gruppo), più il nome al passaggio del mouse.
- **RF-31** Le pedine si trascinano con mouse o dito; la nuova posizione arriva a tutti.
- **RF-32** La pedina del personaggio scelto dall'utente è evidenziata (bordo dorato).
- **RF-33** Le pedine stanno **sopra** la nebbia (i PG sono sempre visibili a tutti).
- **RF-34** Il Master può riportare tutte le pedine alla posizione iniziale definita dall'avventura (es. in fondo alla scala d'ingresso).
- **RF-35** Una legenda sotto la mappa associa colori e nomi.

### 5.5 Pedine dei mostri

- **RF-40** Il Master aggiunge mostri scegliendo: tipo (elenco predefinito dell'avventura, es. Scorpione gigante, Spettro, Stirge, Gargolla; oppure "Altro" con nome libero), quantità (1–12) e zona di comparsa.
- **RF-41** I mostri compaiono raggruppati al centro della zona scelta, come rombi rossi con sigla numerata (Sc1, Sc2, Sp1…), così si capisce chi attacca chi.
- **RF-42** I mostri stanno **sotto** la nebbia: i giocatori li vedono solo nelle zone scoperte. Il Master può quindi prepararli in anticipo.
- **RF-43** Solo il Master li sposta e li toglie (uno alla volta o tutti, con conferma).
- **RF-44** I dati dei mostri in zone non scoperte non devono arrivare ai giocatori. *(Nel prototipo arrivavano ma restavano nascosti dalla grafica: da correggere.)*

### 5.6 Dadi

- **RF-50** Pulsanti per d4, d6, d8, d10, d12, d20, d100 e una scorciatoia 3d6.
- **RF-51** Campi: numero di dadi (1–20), modificatore (−20…+50), motivo del tiro (testo breve, es. "attacco", "TS veleno").
- **RF-52** Generazione casuale crittograficamente sicura e senza distorsioni.
- **RF-53** Il risultato appare subito in grande ("1d20+2 → 16"); su d20 singolo il 20 naturale è evidenziato in verde e l'1 naturale in rosso.
- **RF-54** Tiro nascosto (solo Master): visibile solo al Master, segnato come "nascosto" nel suo storico.

### 5.7 Storico tiri

- **RF-60** Storico condiviso degli ultimi 40 tiri, dal più recente: personaggio, nome dell'account, motivo, formula, risultati dei singoli dadi, totale, ora.
- **RF-61** Il Master vede anche i propri tiri nascosti, mescolati in ordine di tempo.
- **RF-62** Il Master può svuotare lo storico, con conferma in due passaggi (niente finestre di dialogo del browser).
- **RF-63** I tiri non si possono modificare né falsificare da parte di altri utenti.

### 5.8 Narrazione

- **RF-70** Il Master scrive un testo e lo pubblica: appare a tutti in un riquadro "Il Master legge" sopra la mappa, in corsivo. Può nasconderlo.

### 5.9 Presenza

- **RF-80** Riquadro "Al tavolo": chi ha la pagina aperta in questo momento, con avatar, nome, personaggio scelto ed etichetta di stato: **Master**, **gioca**, **sola lettura**.
- **RF-81** Si aggiorna all'istante quando qualcuno entra, esce o cambia personaggio. Più schede della stessa persona contano una volta.

### 5.10 Sincronizzazione e affidabilità

- **RF-90 Tempo reale.** Ogni modifica (nebbia, pedine, mostri, testo, tiri) arriva a tutti entro **3 secondi**, idealmente all'istante.
- **RF-91 Ripiego.** Se l'aggiornamento in diretta si interrompe, la pagina ricontrolla lo stato a intervalli regolari e si riallinea da sola. *(Lezione del prototipo: senza questo ripiego gli aggiornamenti potevano arrivare dopo ~30 secondi.)*
- **RF-92 Stato del collegamento.** Riga sotto la mappa: account collegato / non collegato, permessi (può giocare / sola lettura), ora dell'ultimo aggiornamento, eventuali errori. Pulsante "Aggiorna ora".
- **RF-93 Persistenza.** Lo stato del tavolo sopravvive alla chiusura delle pagine e tra una sessione e l'altra.
- **RF-94 Trascinamenti concorrenti.** Mentre un utente trascina una pedina, gli aggiornamenti in arrivo non devono farla "saltare"; dopo il rilascio vince la posizione salvata.
- **RF-95 Backup.** Il Master può esportare lo stato del tavolo (nebbia, pedine, mostri, testo, tiri) in un file. *(Nel prototipo: `backup_database.json`, fatto a mano.)*

### 5.11 Chiedi a Claude

- **RF-100** Riquadro "Chiedi a Claude": il partecipante scrive una domanda sulle regole e riceve una risposta breve (massimo 8 righe), in italiano, mostrata mentre viene scritta, con pulsante "Ferma".
- **RF-101** Le risposte si basano sulla conoscenza generale di Claude del regolamento BECMI (Base/Expert) e di Mystara. **Non** cercano su internet e **non** leggono i manuali del gruppo. *(Decisione presa: la variante "solo dai manuali", con testo estratto via OCR dai PDF, è stata provata e scartata dal Master. Il testo estratto resta in `regole.json` se si volesse riprenderla.)*
- **RF-102** Claude non rivela segreti dell'avventura: alle domande su cosa c'è nel dungeon risponde che lo decide il Master.
- **RF-103** La risposta è visibile solo a chi ha chiesto e usa il suo account Claude.
- **RF-104** Avvertenza implicita: su valori precisi (tabelle, tiri salvezza) le risposte vanno verificate sul manuale.

---

## 6. Modello dei dati (descrittivo)

Entità e informazioni minime. I nomi tra parentesi sono quelli usati nel prototipo, utili come riferimento.

- **Avventura**: titolo, sottotitolo (es. "Emirato di Nithia · sessione 0"), mappa, elenco zone, sovrapposizioni segrete, posizioni iniziali dei PG, tipi di mostro disponibili.
- **Mappa**: immagine per i giocatori, dimensioni in pixel (prototipo: 1480 × 1080), scala (40 px = 1 quadretto = 3 m). La mappa del Master è un file separato, mai caricato sul tavolo.
- **Zona**: id, nome, poligono (percorso SVG in coordinate mappa).
- **Sovrapposizione segreta**: immagine, rettangolo di posizionamento, zona che la attiva.
- **Stato nebbia** (`gm/fog`): elenco degli id delle zone scoperte.
- **Pedine PG** (`tokens/all`): per ogni PG, coordinate x, y.
- **Mostri** (`gm/monsters`): elenco di { id, nome, sigla, x, y }.
- **Narrazione** (`gm/narr`): testo, data di pubblicazione.
- **Tiro** (`rolls`): id utente, personaggio, motivo, numero dadi, facce, modificatore, risultati, totale, data/ora.
- **Tiro nascosto**: come un tiro, salvato in uno spazio privato del Master.
- **Presenza**: effimera, non salvata: utente, personaggio scelto, ruolo, può scrivere.

Nel prototipo i dati del Master (`gm/*`) sono leggibili da tutti e scrivibili solo dal proprietario. Per l'MVP: i dati che sono spoiler (mostri in zone coperte, zone non scoperte, futuri appunti del Master) devono restare lato server o essere filtrati prima di arrivare ai giocatori.

---

## 7. Requisiti non funzionali

- **RNF-01 Nessuna installazione** per i giocatori: si gioca da browser.
- **RNF-02 Responsive:** utilizzabile fino a ~400 px di larghezza; su schermi stretti le colonne si impilano; nessuno scorrimento orizzontale della pagina.
- **RNF-03 Tema chiaro e scuro** che segue le impostazioni del dispositivo. Palette del prototipo: sabbia del deserto, papiro, lapislazzuli nithiano (accento), corniola (errori, 1 naturale). Caratteri: Marcellus SC (titoli), Alegreya Sans (testo), JetBrains Mono (dadi e numeri).
- **RNF-04 Accessibilità:** focus visibile da tastiera, contrasti adeguati, rispetto di "riduci movimento", testi alternativi per la mappa.
- **RNF-05 Privacy:** il tavolo non è pubblico; accede solo chi è invitato.
- **RNF-06 Sicurezza dei contenuti:** ogni testo inserito dagli utenti (motivi dei tiri, nomi dei mostri, narrazione) viene mostrato come testo, mai interpretato come HTML.
- **RNF-07 Costi:** gratuito o quasi per un gruppo di 7 persone.
- **RNF-08 Lingua:** interfaccia interamente in italiano, con il lessico BECMI italiano (Tiro Salvezza, Punti Ferita, Classe d'Armatura, scacciare i non morti…).
- **RNF-09 Nessun dialogo del browser** (alert/confirm/prompt): le conferme sono nell'interfaccia.

---

## 8. Preparare una nuova avventura

Oggi la preparazione si fa con l'aiuto di Claude, non dal tavolo. Flusso attuale:

1. **Disegno della mappa** con `genera_mappa.py`, che produce tre versioni:
   - `master`: mappa completa con "S" delle porte segrete e numeri delle stanze;
   - `base`: mappa dei giocatori, senza passaggi segreti, "S" e numeri;
   - `passage`: versione con il passaggio segreto, da cui si ritaglia la sovrapposizione.
2. **Definizione delle zone** e delle posizioni iniziali in `meta.json` (dimensioni, poligoni, rettangolo della sovrapposizione, posizioni dei PG).
3. **Montaggio della pagina** a partire da `tavolo_template.html`, sostituendo i segnaposto con i dati di `meta.json`.
4. **Azzeramento dello stato** (nebbia, pedine, mostri, storico) per la nuova avventura.

Requisito per l'MVP: questo flusso deve essere ripetibile e documentato. Il caricamento di un'avventura come pacchetto (immagini + file di descrizione) è il primo candidato dopo l'MVP.

---

## 9. Lezioni apprese dal prototipo

| Problema riscontrato | Causa | Requisito che ne deriva |
| --- | --- | --- |
| I giocatori tiravano ma il Master non vedeva nulla | Pagina condivisa con link pubblico → giocatori in sola lettura senza saperlo | RF-02, RF-04, RF-80 |
| Gli amici invitati come Editor vedevano il pannello del Master | Ruolo Master dedotto dai permessi di modifica | Ruolo Master esplicito (§4) |
| Le pedine dei mostri non si potevano spostare | La nebbia intercettava i clic | RF-25 |
| Aggiornamenti lenti o assenti | Solo aggiornamento in diretta, senza ripiego | RF-90, RF-91, RF-92 |
| Pedina che "salta" durante il trascinamento | Aggiornamenti in arrivo durante il drag | RF-94 |
| Pedine troppo piccole su mappe grandi | Dimensione fissa | Dimensione leggibile, eventualmente zoom |
| I file della mappa segreta erano raggiungibili conoscendo l'indirizzo | Sovrapposizione pubblicata come file statico | La sovrapposizione deve arrivare solo a zona scoperta |

---

## 10. Fuori dall'MVP (backlog)

In ordine indicativo di priorità:

1. Caricamento di una nuova avventura dal pannello del Master (mappa, zone, mostri) senza intervento tecnico.
2. Editor delle zone della nebbia (disegnare poligoni sulla mappa).
3. Punti ferita e stato dei mostri visibili solo al Master; segni di "ferito/morto".
4. Iniziativa e turni di combattimento.
5. Righello per misurare distanze in quadretti e metri.
6. Zoom e spostamento della mappa.
7. Più mappe o livelli per avventura.
8. Schede dei personaggi integrate (oggi file Excel).
9. Chat testuale e note del Master private.
10. Esportazione del diario di sessione (tiri, eventi).
11. Illuminazione e linea di vista.
12. Ripresa della variante "Chiedi a Claude dai manuali", se il Master cambiasse idea.

Esplicitamente **non** previsti: audio/video integrati, mercato di contenuti, automazione delle regole di combattimento.

---

## 11. Risorse esistenti

Cartella del progetto: `C:\Users\Marco\Dropbox\d&d_online`

| Percorso | Contenuto |
| --- | --- |
| `tavolo_sorgenti/tavolo_template.html` | Prototipo completo del tavolo (riferimento funzionale) |
| `tavolo_sorgenti/meta.json` | Zone, sovrapposizione e posizioni iniziali della Sessione 0 |
| `tavolo_sorgenti/genera_mappa.py` | Generatore della mappa (versioni master / giocatori / passaggio) |
| `tavolo_sorgenti/mappa_giocatori.png`, `passaggio.png` | Immagini usate dal tavolo |
| `tavolo_sorgenti/backup_database.json` | Esempio reale dello stato del tavolo |
| `tavolo_sorgenti/regole.json` | Testo dei manuali BECMI estratto via OCR (variante scartata) |
| `santuario_zebulon_dungeon/` | Avventura Sessione 0: documento, mappa del Master, legenda dei simboli |
| `regole/` | Manuali BECMI in PDF (scansioni) e Schermo del Master |
| `d&d_international/Personaggi/` | Schede dei PG (Excel) e immagini |
| `atlanti/`, `avventure_D&D/` | Atlanti di Ylaruam e Karameikos, moduli X4 e X5 |

---

## 12. Criteri di accettazione dell'MVP

L'MVP è pronto quando, in una prova con il Master e almeno due giocatori su dispositivi diversi:

- [ ] ogni giocatore entra dall'invito e compare in "Al tavolo" con l'etichetta **gioca**;
- [ ] un giocatore che non ha i permessi vede l'avviso di sola lettura;
- [ ] il Master scopre una zona e tutti la vedono entro 3 secondi;
- [ ] un giocatore sposta una pedina e tutti la vedono spostata entro 3 secondi;
- [ ] un tiro di un giocatore compare nello storico di tutti con nome, formula, risultati e totale;
- [ ] un tiro nascosto del Master non compare ai giocatori;
- [ ] un mostro piazzato in una zona coperta non è visibile ai giocatori finché la zona non viene scoperta (né sullo schermo né nei dati ricevuti);
- [ ] il passaggio segreto compare solo dopo che il Master scopre la sua zona;
- [ ] chiudendo e riaprendo la pagina il giorno dopo, lo stato è identico;
- [ ] la pagina è utilizzabile da telefono;
- [ ] "Chiedi a Claude" risponde in italiano a una domanda sulle regole senza rivelare segreti.

---

## 13. Domande aperte

- **Stack tecnico** (frontend, backend, database in tempo reale, autenticazione, hosting): *da decidere*.
- Restare sulla piattaforma degli artifact di claude.ai o diventare un'applicazione autonoma?
- Come autenticare giocatori senza account Claude?
- Più tavoli/avventure per lo stesso Master: un tavolo per avventura o un tavolo con più avventure?
- Un giocatore può muovere solo la propria pedina?
- Quanto storico tiri conservare (sessione, campagna)?
- "Chiedi a Claude" deve restare nell'MVP se l'app diventa autonoma (costi API)?

---

## 14. Indicazioni per Claude Code

- Scrivi interfaccia, testi e commenti rivolti all'utente in **italiano**; usa la terminologia BECMI italiana.
- Tratta i **segreti dell'avventura** (mappa del Master, zone non scoperte, mostri nascosti) come dati sensibili: mai inviarli al client di un giocatore.
- Ogni controllo di permesso va fatto anche lato server.
- Mantieni coordinate e dati delle avventure **separati dal codice** (file di descrizione dell'avventura), così una nuova avventura non richiede di modificare il codice.
- Prima di cambiare il comportamento di una funzione del prototipo, controlla la sezione 9: molti dettagli rispondono a problemi già incontrati.
- Quando un requisito è ambiguo, chiedi invece di supporre: questo documento è una raccolta requisiti in evoluzione.
