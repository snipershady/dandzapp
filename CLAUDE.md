# CLAUDE.md — Tavolo Virtuale per D&D (BECMI)

> File di contesto per lo sviluppo con Claude Code.
> Stato: **raccolta requisiti dell'MVP**, stack tecnico definito (§15). L'applicazione è **autonoma**: gestisce da sé utenti, autenticazione, permessi e persistenza (MySQL), e ospita **più partite** in parallelo.
> Lingua del progetto, dell'interfaccia e della documentazione: **italiano**.

---

## 1. Visione

Un **tavolo di gioco virtuale** per giocare a Dungeons & Dragons a distanza con un gruppo di amici. Tutti aprono la stessa pagina nel browser e vedono, in tempo reale e sempre allineati:

- la **mappa del dungeon**, che si scopre man mano che il gruppo esplora (nebbia di guerra);
- le **pedine** dei personaggi e dei mostri;
- i **tiri di dado** di tutti, in uno storico condiviso;
- i **testi** che il Master legge ad alta voce.

Il Master controlla cosa vedono i giocatori; i giocatori tirano i dadi e muovono le proprie pedine. La voce resta fuori dal tavolo (Discord, Meet o simili).

Il progetto nasce da un **prototipo di prova** usato per la "Sessione 0 – Il santuario sepolto". Il prototipo è solo un **riferimento funzionale** (cosa fa il tavolo, come appare, quali problemi di gioco sono emersi): la sua piattaforma, il suo sistema di accesso e il suo modo di salvare i dati **non sono vincoli** e non vanno riprodotti.

### Principi guida

1. **Semplice prima di tutto.** Deve funzionare per un gruppo di amici senza installazioni e senza configurazioni complicate. Non vuole competere con Roll20 o Foundry.
2. **Una sola verità condivisa.** Lo stato del tavolo vive in un unico posto; ogni schermo ne è una vista. Nessuno deve mai vedere una situazione diversa dagli altri per più di pochi secondi.
3. **Niente spoiler.** Ciò che i giocatori non hanno ancora scoperto non deve essere visibile, né sulla mappa né nei dati che arrivano al loro browser.
4. **Il Master ha l'ultima parola.** Solo il Master scopre la mappa, gestisce i mostri e pubblica i testi.
5. **Fedeltà al regolamento BECMI** (scatola rossa Base + Expert, edizione italiana) e all'ambientazione Mystara.

---

## 2. Contesto d'uso

- **Gioco:** D&D edizione BECMI (Base, Expert), campagna su Mystara, attualmente negli Emirati di Ylaruam.
- **Gruppo tipo:** 1 Master (un utente `ROLE_MASTER`) + circa 6 giocatori (utenti `ROLE_PLAYER`), tutti da remoto. Il gruppo descritto sotto è il primo caso d'uso, non l'unico: il software ospita **più partite indipendenti**, ciascuna con il proprio Master e i propri giocatori; lo stesso giocatore può partecipare a più partite (relazione molti-a-molti, vedi §4 e RF-05).
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
| **Utente** | Persona registrata sull'applicazione (email, password, nome visualizzato) con un ruolo applicativo: `ROLE_MASTER` o `ROLE_PLAYER`. |
| **ROLE_MASTER** | Ruolo applicativo di chi può **creare e condurre partite**. |
| **ROLE_PLAYER** | Ruolo applicativo di chi può **partecipare alle partite** su invito. |
| **Partita** | Un'istanza di gioco indipendente: ha un Master, dei partecipanti, un'avventura corrente e il proprio stato (nebbia, pedine, mostri, narrazione, tiri). |
| **Partecipazione** | Legame tra un utente e una partita, con il ruolo nella partita (giocatore o osservatore) e l'eventuale personaggio assegnato. |
| **Tavolo** | La pagina condivisa in cui si gioca una sessione di una partita. |
| **Master** | Chi conduce una partita: l'utente `ROLE_MASTER` che l'ha creata. |
| **Giocatore** | Partecipante che controlla un personaggio in una partita. |
| **Osservatore** | Partecipante di una partita in sola lettura. |
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

### 4.1 Ruoli applicativi

Ogni utente registrato ha **uno** ruolo applicativo, salvato nel database:

| Azione applicativa | ROLE_MASTER | ROLE_PLAYER |
| --- | :---: | :---: |
| Registrarsi, accedere, gestire il proprio profilo | ✔ | ✔ |
| Vedere l'elenco delle **proprie** partite | ✔ | ✔ |
| Creare una nuova partita (diventandone il Master) | ✔ | ✘ |
| Amministrare gli utenti: vedere l'elenco, promuovere un `ROLE_PLAYER` a `ROLE_MASTER`, disattivare un account | ✔ | ✘ |
| Invitare utenti in una propria partita, assegnare i PG, togliere partecipanti | ✔ (solo nelle proprie) | ✘ |
| Archiviare / eliminare una propria partita | ✔ | ✘ |
| Partecipare a una partita su invito | ✔ | ✔ |

- **Molti-a-molti:** N giocatori distinti possono giocare N partite distinte. Ogni partita ha **un solo** Master e da 0 a N partecipanti; ogni utente può partecipare a qualsiasi numero di partite.
- Un utente `ROLE_MASTER` può partecipare come giocatore alle partite di un altro Master; il ruolo di **Master di una partita** deriva solo dall'esserne il creatore (`partita.master_id`), non dal ruolo applicativo.
- **Isolamento:** ogni dato di gioco appartiene a una partita. Il server verifica a ogni richiesta e a ogni messaggio in tempo reale che l'utente partecipi a quella partita; chi non partecipa non ne vede nemmeno l'esistenza.

### 4.2 Ruoli all'interno di una partita

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
| Chiedere a Claude (risposta privata) | ✔ | ✔ | ✔ |

Regole:
- Il **Master** di una partita è l'utente `ROLE_MASTER` che l'ha creata (`partite.master_id`): un ruolo esplicito, mai dedotto da altri permessi.
- I permessi vanno **imposti dal server**, non solo nascosti nell'interfaccia: un giocatore non deve poter scoprire la nebbia neanche manipolando la pagina.
- Nell'MVP un giocatore può muovere **qualsiasi** pedina PG (comodo se qualcuno è assente). Valutare in seguito il vincolo "solo la propria".

---

## 5. Requisiti funzionali dell'MVP

Ogni requisito ha un codice (RF-xx) per riferimento in issue e commit.

### 5.1 Accesso e identità

- **RF-01 Registrazione e accesso.** L'applicazione gestisce i propri utenti: registrazione con email, password e nome visualizzato (avatar facoltativo), accesso, uscita, recupero password. Ogni utente ha il ruolo applicativo `ROLE_MASTER` o `ROLE_PLAYER` (§4.1). Le password sono salvate solo come hash (argon2id). Senza accesso non si vede nessuna partita.
- **RF-01b Assegnazione del ruolo.** Chi si registra diventa `ROLE_PLAYER`. L'amministrazione degli utenti spetta agli utenti `ROLE_MASTER`, che da un pannello possono promuovere un `ROLE_PLAYER` a `ROLE_MASTER`. Non esiste un amministratore predefinito né un utente con nome fisso: il **primo** `ROLE_MASTER` si crea all'installazione con un comando (es. `npm run utente:crea-master -- email`). Il sistema impedisce di rimuovere o declassare l'ultimo `ROLE_MASTER`.
- **RF-02 Invito.** Il Master invita gli utenti nella propria partita indicando **esplicitamente** il ruolo nella partita (giocatore / osservatore) e, facoltativamente, il PG. L'invito avviene per email o con link personale monouso legato all'email; se l'invitato non è registrato, il link porta alla registrazione e poi direttamente nella partita. Non esistono link pubblici: ogni accesso a una partita passa da una partecipazione con un ruolo preciso, visibile al Master nell'elenco dei partecipanti.
- **RF-03 Scelta del personaggio.** Ogni partecipante sceglie da un elenco "Giochi come: <PG>" (il Master è automaticamente "Master"). Se il Master ha assegnato un PG all'utente, è preselezionato. La scelta etichetta i suoi tiri ed evidenzia la sua pedina, ed è salvata nella partecipazione (vale su tutti i suoi dispositivi).
- **RF-04 Avviso di sola lettura.** Chi non può scrivere vede un avviso ben visibile (in rosso) che spiega perché e cosa fare. Se la sessione è scaduta, l'utente torna alla pagina di accesso e poi alla partita.
- **RF-05 Più partite.** Dopo l'accesso l'utente vede "Le mie partite": quelle che conduce (se `ROLE_MASTER`) e quelle a cui partecipa, con titolo, Master, avventura corrente e chi è collegato. Un `ROLE_MASTER` crea una nuova partita scegliendo titolo e avventura; lo stato iniziale segue RF-23 e RF-34. Ogni partita ha un indirizzo proprio (es. `/partite/42`).
- **RF-06 Isolamento tra partite.** Nebbia, pedine, mostri, narrazione, tiri e presenza sono separati per partita. Un messaggio in tempo reale di una partita arriva solo ai collegati di quella partita; nessuna richiesta può leggere o modificare una partita a cui l'utente non partecipa (verifica lato server).

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

- **RF-80** Riquadro "Al tavolo": chi ha aperta in questo momento la pagina **di questa partita**, con avatar, nome, personaggio scelto ed etichetta di stato: **Master**, **gioca**, **sola lettura**.
- **RF-81** Si aggiorna all'istante quando qualcuno entra, esce o cambia personaggio. Più schede della stessa persona contano una volta.

### 5.10 Sincronizzazione e affidabilità

- **RF-90 Tempo reale.** Ogni modifica (nebbia, pedine, mostri, testo, tiri) arriva a tutti entro **3 secondi**, idealmente all'istante.
- **RF-91 Ripiego.** Se l'aggiornamento in diretta si interrompe, la pagina ricontrolla lo stato a intervalli regolari e si riallinea da sola.
- **RF-92 Stato del collegamento.** Riga sotto la mappa: collegato / non collegato al server, permessi (può giocare / sola lettura), ora dell'ultimo aggiornamento, eventuali errori. Pulsante "Aggiorna ora".
- **RF-93 Persistenza.** Lo stato di ogni partita è salvato in MySQL e sopravvive alla chiusura delle pagine e tra una sessione e l'altra.
- **RF-94 Trascinamenti concorrenti.** Mentre un utente trascina una pedina, gli aggiornamenti in arrivo non devono farla "saltare"; dopo il rilascio vince la posizione salvata.
- **RF-95 Backup.** Il Master può esportare lo stato di una propria partita (nebbia, pedine, mostri, testo, tiri) in un file JSON. Il backup completo è quello del database MySQL.

### 5.11 Chiedi a Claude

- **RF-100** Riquadro "Chiedi a Claude": il partecipante scrive una domanda sulle regole e riceve una risposta breve (massimo 8 righe), in italiano, mostrata mentre viene scritta, con pulsante "Ferma".
- **RF-101** Le risposte si basano sulla conoscenza generale di Claude del regolamento BECMI (Base/Expert) e di Mystara. **Non** cercano su internet e **non** leggono i manuali del gruppo. *(Decisione presa: la variante "solo dai manuali", con testo estratto via OCR dai PDF, è stata provata e scartata dal Master. Il testo estratto resta in `regole.json` se si volesse riprenderla.)*
- **RF-102** Claude non rivela segreti dell'avventura: alle domande su cosa c'è nel dungeon risponde che lo decide il Master.
- **RF-103** La risposta è visibile solo a chi ha chiesto. Con l'app autonoma la domanda passa dal server, che chiama l'API di Anthropic con una chiave del server (mai esposta al browser) e applica un limite di domande per utente. *(Costi: vedi §13.)*
- **RF-104** Avvertenza implicita: su valori precisi (tabelle, tiri salvezza) le risposte vanno verificate sul manuale.

---

## 6. Modello dei dati (descrittivo)

Entità e informazioni minime. Lo schema MySQL è in §15.4.

- **Utente**: id, email (unica), hash della password, nome visualizzato, avatar, ruolo applicativo (`ROLE_MASTER` | `ROLE_PLAYER`), data di registrazione.
- **Partita**: id, titolo, Master (utente), avventura corrente, stato (attiva / archiviata), date di creazione e aggiornamento.
- **Partecipazione**: partita, utente, ruolo nella partita (giocatore / osservatore), PG scelto o assegnato. Unica per coppia (partita, utente).
- **Invito**: partita, email, ruolo proposto, token monouso (salvato come hash), scadenza, data di accettazione.
- **Avventura**: modello riutilizzabile, indipendente dalle partite (più partite possono usare la stessa avventura): titolo, sottotitolo (es. "Emirato di Nithia · sessione 0"), mappa, elenco zone, sovrapposizioni segrete, posizioni iniziali dei PG, tipi di mostro disponibili.
- **Mappa**: immagine per i giocatori, dimensioni in pixel (Sessione 0: 1480 × 1080), scala (40 px = 1 quadretto = 3 m). La mappa del Master è un file separato, mai caricato sul tavolo.
- **Zona**: id, nome, poligono (percorso SVG in coordinate mappa).
- **Sovrapposizione segreta**: immagine, rettangolo di posizionamento, zona che la attiva.
- **Stato nebbia**: elenco degli id delle zone scoperte.
- **Pedine PG**: per ogni PG, coordinate x, y.
- **Mostri**: elenco di { id, nome, sigla, x, y }.
- **Narrazione**: testo, data di pubblicazione.
- **Tiro**: id utente, personaggio, motivo, numero dadi, facce, modificatore, risultati, totale, data/ora.
- **Tiro nascosto**: come un tiro, con il contrassegno `nascosto`; il server lo invia solo al Master.
- **Presenza**: effimera, non salvata: utente, personaggio scelto, ruolo, può scrivere.

Tutto lo stato di gioco (nebbia, pedine, mostri, narrazione, tiri, PG) è **legato a una partita** (`partita_id`).

I dati che sono spoiler (mostri in zone coperte, zone non scoperte, tiri nascosti, futuri appunti del Master) restano sul server e vengono filtrati prima di arrivare ai giocatori (§15.3).

---

## 7. Requisiti non funzionali

- **RNF-01 Nessuna installazione** per i giocatori: si gioca da browser.
- **RNF-02 Responsive:** utilizzabile fino a ~400 px di larghezza; su schermi stretti le colonne si impilano; nessuno scorrimento orizzontale della pagina.
- **RNF-03 Tema chiaro e scuro** che segue le impostazioni del dispositivo. Palette: sabbia del deserto, papiro, lapislazzuli nithiano (accento), corniola (errori, 1 naturale). Caratteri: Marcellus SC (titoli), Alegreya Sans (testo), JetBrains Mono (dadi e numeri).
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

## 9. Lezioni di gioco apprese dal prototipo

| Problema riscontrato | Causa | Requisito che ne deriva |
| --- | --- | --- |
| Le pedine dei mostri non si potevano spostare | La nebbia intercettava i clic | RF-25 |
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

Materiale del gruppo, esterno a questo repository. Va usato come fonte di contenuti (mappe, zone, regole, PG), non come vincolo tecnico.

| Percorso | Contenuto |
| --- | --- |
| `tavolo_sorgenti/tavolo_template.html` | Prototipo del tavolo (solo riferimento funzionale e grafico) |
| `tavolo_sorgenti/meta.json` | Zone, sovrapposizione e posizioni iniziali della Sessione 0 |
| `tavolo_sorgenti/genera_mappa.py` | Generatore della mappa (versioni master / giocatori / passaggio) |
| `tavolo_sorgenti/mappa_giocatori.png`, `passaggio.png` | Immagini usate dal tavolo |
| `tavolo_sorgenti/regole.json` | Testo dei manuali BECMI estratto via OCR (variante scartata) |
| `santuario_zebulon_dungeon/` | Avventura Sessione 0: documento, mappa del Master, legenda dei simboli |
| `regole/` | Manuali BECMI in PDF (scansioni) e Schermo del Master |
| `d&d_international/Personaggi/` | Schede dei PG (Excel) e immagini |
| `atlanti/`, `avventure_D&D/` | Atlanti di Ylaruam e Karameikos, moduli X4 e X5 |

---

## 12. Criteri di accettazione dell'MVP

L'MVP è pronto quando, in una prova con il Master e almeno due giocatori su dispositivi diversi:

- [ ] un nuovo utente si registra, accede ed esce; chi si registra è `ROLE_PLAYER`;
- [ ] un `ROLE_MASTER` crea due partite distinte e invita giocatori diversi (con almeno un giocatore in comune);
- [ ] il giocatore in comune vede entrambe le partite in "Le mie partite"; un giocatore non invitato non ne vede nessuna, nemmeno conoscendone l'indirizzo;
- [ ] uno spostamento, un tiro o una zona scoperta in una partita non compare nell'altra;
- [ ] un `ROLE_PLAYER` non riesce a creare partite né a eseguire azioni da Master, neanche inviando messaggi costruiti a mano al server;
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

- Una partita cambia avventura nel tempo (campagna: sessione 0, X4, X5…) conservando i PG? Proposta: sì, la partita ha un'avventura corrente; cambiandola si azzerano nebbia e mostri, non i PG né lo storico.
- I PG appartengono alla partita (proposta) o all'utente e si portano da una partita all'altra?
- Un giocatore può muovere solo la propria pedina?
- Quanto storico tiri conservare (sessione, campagna)?
- "Chiedi a Claude" deve restare nell'MVP, visti i costi dell'API? In alternativa diventa una funzione attivabile per partita.

---

## 14. Indicazioni per Claude Code

- Scrivi interfaccia, testi e commenti rivolti all'utente in **italiano**; usa la terminologia BECMI italiana.
- Tratta i **segreti dell'avventura** (mappa del Master, zone non scoperte, mostri nascosti) come dati sensibili: mai inviarli al client di un giocatore.
- Ogni controllo di permesso va fatto anche lato server: ruolo applicativo (`ROLE_MASTER`/`ROLE_PLAYER`), partecipazione alla partita e ruolo nella partita. Ogni query sui dati di gioco filtra per `partita_id`.
- Rispetta lo stack di §15; per introdurre una nuova dipendenza importante, chiedi prima.
- Mantieni coordinate e dati delle avventure **separati dal codice** (file di descrizione dell'avventura), così una nuova avventura non richiede di modificare il codice.
- Il prototipo è solo un riferimento funzionale: non replicarne piattaforma, accesso o salvataggio dei dati. Prima di cambiare un comportamento di gioco, controlla la sezione 9.
- Nessun utente ha privilegi per nome: i privilegi derivano solo da `ROLE_MASTER` / `ROLE_PLAYER` e dalla partecipazione alle partite.
- Quando un requisito è ambiguo, chiedi invece di supporre: questo documento è una raccolta requisiti in evoluzione.

---

## 15. Stack tecnico

Vincolo: **MySQL 9.7** come unico database relazionale. Indicazioni di partenza: Svelte per il frontend, Node.js con WebSocket per il backend. Tutto il codice è in **TypeScript**.

### 15.1 Scelte

| Livello | Scelta | Perché |
| --- | --- | --- |
| Runtime | **Node.js 24 LTS** | Versione LTS corrente; `crypto.randomInt` per dadi sicuri e senza distorsioni (RF-52). |
| Frontend | **Svelte 5 + SvelteKit 3** in modalità SPA (`adapter-static`), **Vite** | Reattività con le *runes* adatta a uno stato che cambia in tempo reale; bundle piccolo, buono su telefono (RNF-02). SvelteKit dà routing (`/accedi`, `/partite`, `/partite/[id]`) senza introdurre un secondo server: nessuna logica lato server in SvelteKit, così i controlli di permesso stanno in un solo posto. |
| Server HTTP | **Fastify 5** | Leggero, veloce, validazione degli schemi integrata; serve l'API REST, le immagini protette e i file statici della SPA. |
| Tempo reale | **Socket.IO 4** (sopra WebSocket) | Rispetto a `ws` puro offre già: *rooms* (una per partita e una per i Master → isolamento RF-06 e filtro degli spoiler), riconnessione automatica, conferme (*ack*) dei comandi e ripiego su long-polling se il WebSocket è bloccato (RF-91). |
| Accesso al DB | **Kysely** + driver **mysql2** | Query builder tipizzato: SQL esplicito e leggibile, transazioni, migrazioni versionate in TypeScript. Niente ORM pesante. |
| Validazione | **Zod**, schemi condivisi tra client e server | Ogni comando in arrivo (REST o Socket.IO) è validato prima di toccare il DB. |
| Password | **argon2id** (`@node-rs/argon2`) | Standard attuale per l'hashing. |
| Sessioni | Cookie `httpOnly`, `Secure`, `SameSite=Lax` con token casuale; in DB solo l'hash del token | Revocabili (uscita, cambio password), lo stesso cookie autentica l'handshake di Socket.IO. Niente JWT. |
| Email | **Nodemailer** via SMTP (inviti, recupero password); in sviluppo **Mailpit** | |
| Test | **Vitest** (unità e integrazione, con MySQL reale di test), **Playwright** (end-to-end con più browser contemporanei per i criteri di §12) | |
| Qualità | ESLint + Prettier (con plugin Svelte), `svelte-check`, `tsc --noEmit` | |
| Monorepo | **npm workspaces** | Nessuno strumento in più. |
| Hosting | Server **Debian 13** con **Apache2 oppure nginx** come proxy inverso, Node gestito da systemd, MySQL 9.7 (vedi §15.5) | Pochi euro al mese per molti gruppi (RNF-07). |

Scartati: `ws` puro (andrebbero riscritti rooms, riconnessione e ripiego); NestJS (troppo apparato per il progetto); Prisma (più pesante, SQL meno controllabile); Firebase/Supabase (esclusi dal vincolo MySQL); SSR di SvelteKit (doppio server e doppi controlli di permesso senza un vero vantaggio per un'app dietro accesso).

### 15.2 Struttura del repository

```
apps/
  server/      Fastify + Socket.IO + Kysely (API, tempo reale, migrazioni)
  web/         SvelteKit SPA
packages/
  shared/      schemi Zod, tipi dei messaggi, costanti di gioco (dadi, sigle)
avventure/
  sessione-0/  meta.json (zone, sovrapposizioni, posizioni, tipi di mostro) + immagini
```

Le immagini delle avventure **non** stanno in una cartella pubblica: le serve il server dopo aver verificato la partecipazione, e una sovrapposizione segreta solo se la sua zona è scoperta (§9, ultima riga).

### 15.3 Architettura del tempo reale

- **Il server è l'unica autorità.** Il client invia *comandi* (`zona:scopri`, `pedina:sposta`, `mostro:aggiungi`, `dadi:tira`, `narrazione:pubblica`…); il server valida (Zod), controlla i permessi (ruolo applicativo, partecipazione, ruolo nella partita), scrive su MySQL in una transazione e diffonde un *evento*. I dadi si tirano **sul server** (RF-52, RF-63).
- **Rooms:** `partita:{id}` per tutti i collegati di una partita, `partita:{id}:master` per il Master. Gli eventi con spoiler (mostri in zone coperte, tiri nascosti, poligoni delle zone non scoperte) vanno solo alla room del Master; quando una zona viene scoperta, i giocatori ricevono in quel momento i mostri e la sovrapposizione che contiene (RF-44).
- **Viste filtrate:** una funzione `vistaGiocatore(stato)` e una `vistaMaster(stato)` costruiscono lo stato completo per ruolo; ogni istantanea (all'ingresso, alla riconnessione, su "Aggiorna ora") passa da lì.
- **Versione:** ogni partita ha un contatore `versione` incrementato a ogni modifica; gli eventi lo portano con sé. Se il client nota un salto, chiede l'istantanea completa. Alla riconnessione chiede sempre l'istantanea (RF-91).
- **Trascinamento (RF-94):** la posizione si salva al rilascio; durante il drag il client ignora gli aggiornamenti di quella pedina.
- **Presenza (RF-80/81):** in memoria nel processo Node, per partita e per utente (più schede contano una volta); non salvata su DB.
- Un solo processo Node basta per l'uso previsto; per scalare su più processi si aggiungerà l'adapter Redis di Socket.IO.

### 15.4 Schema MySQL (bozza)

Motore InnoDB, `utf8mb4` / `utf8mb4_0900_ai_ci`, chiavi esterne attive. Nomi di tabelle e colonne in italiano.

| Tabella | Colonne principali |
| --- | --- |
| `utenti` | `id`, `email` (unica), `password_hash` (`NULL` finché non viene scelta), `nome`, `avatar_url`, `ruolo` ENUM(`ROLE_MASTER`,`ROLE_PLAYER`), `attivo`, `creato_il` |
| `sessioni` | `token_hash` (PK, SHA-256 del token del cookie), `utente_id`, `scade_il` (30 giorni), `creato_il` |
| `recuperi_password` | `token_hash` (PK), `utente_id`, `scade_il`, `usato_il` (uso singolo), `creato_il` |
| `avventure` | `id`, `slug` (unico), `titolo`, `sottotitolo`, `definizione` JSON (dimensioni mappa, zone, sovrapposizioni, posizioni iniziali, tipi di mostro), `cartella` |
| `partite` | `id`, `titolo`, `master_id` → utenti, `avventura_id` → avventure, `stato` ENUM(`attiva`,`archiviata`), `versione`, `narrazione_testo`, `narrazione_pubblicata_il`, `creata_il`, `aggiornata_il` |
| `partecipazioni` | PK(`partita_id`, `utente_id`), `ruolo` ENUM(`giocatore`,`osservatore`), `personaggio_id` (scelto), `creata_il` |
| `inviti` | `id`, `partita_id`, `email`, `ruolo`, `personaggio_id`, `token_hash`, `scade_il`, `accettato_il` |
| `personaggi` | `id`, `partita_id`, `nome`, `classe`, `sigla`, `colore`, `utente_id` (giocatore assegnato, facoltativo), `x`, `y` |
| `zone_scoperte` | PK(`partita_id`, `zona_id`) |
| `mostri` | `id`, `partita_id`, `nome`, `sigla`, `x`, `y` |
| `tiri` | `id`, `partita_id`, `utente_id`, `personaggio_id`, `motivo`, `n_dadi`, `facce`, `modificatore`, `risultati` JSON, `totale`, `nascosto`, `creato_il`; indice (`partita_id`, `creato_il`) |

Ogni query sui dati di gioco filtra per `partita_id`, e l'accesso alla partita è verificato prima (`partecipazioni` oppure `partite.master_id`).

### 15.5 Deploy

Il server di produzione è **Debian 13 (trixie)** con **Apache2 oppure nginx**: va supportato uno qualunque dei due, e il repository contiene una configurazione di esempio per entrambi in `deploy/apache2/` e `deploy/nginx/`.

```
Browser ──HTTPS──▶ Apache2 / nginx (:443, TLS Let's Encrypt via certbot)
                        │  proxy inverso (HTTP + upgrade WebSocket)
                        ▼
                   Node 24 (systemd, ascolta solo su 127.0.0.1:3000)
                        │
                        ▼
                   MySQL 9.7 (solo locale)
```

- **Ruolo del web server:** TLS, compressione, redirect da HTTP a HTTPS, intestazioni di sicurezza (HSTS, `X-Content-Type-Options`, CSP) e proxy verso Node. Non contiene logica dell'applicazione e non fa controlli di permesso.
- **WebSocket:** Socket.IO risponde sul percorso `/socket.io/`, e il proxy deve inoltrare l'upgrade.
  - **nginx:** `proxy_http_version 1.1`, `proxy_set_header Upgrade $http_upgrade` e `proxy_set_header Connection "upgrade"`. Serve anche un `proxy_read_timeout` lungo (es. `3600s`), altrimenti nginx chiude i collegamenti inattivi.
  - **Apache2:** moduli `proxy`, `proxy_http`, `proxy_wstunnel`, `headers`, `ssl`, `rewrite`, con `ProxyPass / http://127.0.0.1:3000/ upgrade=websocket` (Apache ≥ 2.4.47, quindi va bene la versione di Debian 13) e `ProxyPreserveHost On`.
- **Intestazioni inoltrate:** il proxy passa `X-Forwarded-For` e `X-Forwarded-Proto`. Fastify usa `trustProxy` limitato a `127.0.0.1`, così riconosce l'IP reale (per il limite ai tentativi di accesso) e l'HTTPS (cookie `Secure`).
- **File statici:** la build della SPA (`apps/web/build`) può essere servita direttamente da Apache2/nginx per alleggerire Node. Le immagini delle avventure e le sovrapposizioni segrete **no**: passano sempre da Node, che verifica partecipazione e zona scoperta. Stanno fuori dalla `DocumentRoot` / `root`.
- **Un solo processo Node:** non servono sessioni "appiccicose" (*sticky*) né bilanciamento. Se in futuro si passasse a più processi, andrebbero aggiunti entrambi, insieme all'adapter Redis di Socket.IO.
- **Node 24:** Debian 13 fornisce una versione più vecchia di Node, quindi si installa Node 24 LTS dal repository NodeSource. Gira con un utente di sistema dedicato (es. `tavolo`) e un servizio systemd (`deploy/tavolo.service`) con `Restart=on-failure` e variabili prese da `/etc/tavolo/tavolo.env` (permessi 600).
- **MySQL 9.7:** Debian 13 fornisce MariaDB, non MySQL, quindi si installa dal repository APT ufficiale MySQL (`mysql-apt-config`). Va in ascolto solo su `127.0.0.1`, con un utente dedicato all'applicazione che ha i privilegi solo sul suo schema.
- **Backup:** `mysqldump --single-transaction` notturno da un timer systemd, con rotazione, più una copia della cartella delle avventure.
- **Aggiornamento:** `git pull`, `npm ci`, build, migrazioni, `systemctl restart tavolo`. Va scritto come script `deploy/aggiorna.sh`.
- **Firewall:** aperte solo le porte 22, 80 e 443.

### 15.6 Comandi

Elenco completo e primo avvio nel `README.md`. I principali:

- `npm run dev`: server Fastify (porta 3000) e Vite (porta 5173, con proxy per `/api` e `/socket.io`).
- `npm run verifica`: lint, controllo dei tipi e test. Va eseguito prima di ogni commit.
- `npm test` / `npm run test:e2e`: Vitest e Playwright, sempre sul database `DB_TEST_*`. In locale è un database MySQL dedicato (`dandzapp_test` su `127.0.0.1`); in alternativa c'è il servizio Docker facoltativo `docker compose --profile db-test up -d`. I test ne cancellano i dati, quindi il nome deve finire con `_test`: il codice si rifiuta di procedere altrimenti. **Mai** puntare i test al database di sviluppo o di staging.
- `npm run utente:crea-master -- email "Nome"`: crea il primo `ROLE_MASTER` senza password, oppure promuove un utente esistente. Stampa (e invia per email) un link valido 7 giorni per scegliere la password.
- `npm run db:migra` / `npm run db:annulla`: migrazioni Kysely in `apps/server/src/db/migrazioni/`, con nome `AAAAMMGG_HHMM_descrizione.ts`. Ogni migrazione aggiorna anche `apps/server/src/db/schema.ts`.
- Da aggiungere negli step successivi: `avventura:importa` (step 3).

Note sulle versioni:
- **SvelteKit 3:** la configurazione sta nel plugin `sveltekit({...})` di `vite.config.ts`; `svelte.config.js` non esiste più.
- **TypeScript 6.0:** la 7 non è ancora supportata da typescript-eslint e SvelteKit.
- **Kysely 0.29:** il migratore si importa da `kysely/migration`.
- **SvelteKit 3, import:** l'alias `$lib` è deprecato. Si usano i *subpath imports* di `apps/web/package.json` (`#lib/*`), con l'estensione esplicita per i `.ts` (`#lib/api.ts`).
- **SvelteKit 3, `resolve()`:** i percorsi vanno scritti senza `/` iniziale (`resolve('accedi')`, `resolve('')` per la home). Ogni `href` e ogni `goto` passa da `resolve()`, come richiede ESLint.
- **Dopo accesso e uscita:** si naviga con `goto(..., { invalidateAll: true })` e non con `invalidate()` seguito da `goto()`, altrimenti le guardie delle pagine scattano prima della navigazione.
- **Node 24:** il server esegue i `.ts` direttamente (*type stripping*). Si usa solo sintassi TypeScript cancellabile (`erasableSyntaxOnly`: niente `enum` né `namespace`) e gli import relativi hanno l'estensione `.ts`.

---

## 16. Piano di sviluppo

Ogni step è **verticale**: copre DB, server, interfaccia e test di una funzione, e alla fine l'app funziona. Si procede in ordine: ogni step dipende dai precedenti. Per gli step 4 e 6 valgono le proposte della §13 (PG legati alla partita, una sola avventura corrente) finché non vengono confermate o cambiate.

**Definizione di fatto, valida per ogni step:**
- migrazioni MySQL versionate e reversibili;
- ogni comando è validato con Zod e ogni permesso è controllato lato server;
- ci sono test Vitest per la logica e i permessi, compreso il caso "utente non autorizzato";
- c'è un test Playwright per il flusso principale;
- lint, `svelte-check` e `tsc` sono puliti;
- l'interfaccia è in italiano;
- l'RF coperto è citato nel commit.

### Traguardo 1 — Si entra e si prepara una partita

| # | Step | Contenuto | Requisiti |
| --- | --- | --- | --- |
| 0 ✔ | **Impalcatura** | Monorepo npm workspaces (`apps/server`, `apps/web`, `packages/shared`), TypeScript strict, ESLint/Prettier, Vitest, Playwright. Fastify che serve la SPA SvelteKit, Kysely con migratore, configurazione da `.env`, database di sviluppo e di test su MySQL 9.7, Mailpit per le email, endpoint `/api/salute`, CI su GitHub Actions. Si compila la §15.6 Comandi. | — |
| 1 ✔ | **Utenti e autenticazione** | Tabelle `utenti` e `sessioni`. Registrazione (sempre `ROLE_PLAYER`), accesso, uscita, recupero password via email. Hash argon2id, cookie di sessione, limite ai tentativi di accesso, controllo dell'`Origin` sulle richieste che modificano dati. Comando `utente:crea-master`. Pagine Accedi, Registrati, Password dimenticata. | RF-01, RF-01b, RNF-05, RNF-06 |
| 2 | **Amministrazione utenti** | Pannello riservato a `ROLE_MASTER`: elenco degli utenti, promozione a `ROLE_MASTER`, disattivazione (chiude anche le sessioni attive). Il sistema impedisce di declassare o disattivare l'ultimo `ROLE_MASTER`. | §4.1, RF-01b |
| 3 | **Avventure** | Schema Zod del file `meta.json` (dimensioni, zone, sovrapposizioni, posizioni iniziali, tipi di mostro). Comando `avventura:importa <cartella>`, che valida e carica in `avventure`. La Sessione 0 viene convertita in `avventure/sessione-0/`. Le immagini stanno fuori dalla cartella pubblica, con un endpoint che le serve solo ai partecipanti. | RF-11, RF-12, RF-20, §8 |
| 4 | **Partite e inviti** | Tabelle `partite`, `partecipazioni`, `inviti`, `personaggi`. Un `ROLE_MASTER` crea una partita (titolo e avventura). La pagina "Le mie partite" mostra le partite condotte e quelle a cui si partecipa. Il Master gestisce i PG (nome, classe, sigla, colore), invita per email con ruolo e PG, gestisce i partecipanti. L'invito si accetta anche passando dalla registrazione. Ogni accesso a una partita verifica la partecipazione. | RF-02, RF-03, RF-05, RF-06 |

### Traguardo 2 — Si gioca

| # | Step | Contenuto | Requisiti |
| --- | --- | --- | --- |
| 5 | **Tempo reale e presenza** | Socket.IO autenticato con il cookie di sessione. Ingresso nelle rooms `partita:{id}` e `partita:{id}:master` dopo la verifica della partecipazione. Contatore `versione`, istantanea filtrata con `vistaMaster` / `vistaGiocatore`, risincronizzazione alla riconnessione e su salto di versione. Riquadro "Al tavolo", riga di stato del collegamento con "Aggiorna ora". | RF-80, RF-81, RF-90, RF-91, RF-92, RF-93 |
| 6 | **Mappa e pedine dei PG** | Mappa in SVG con l'immagine dell'avventura, griglia, scala grafica e nord, adattata alla larghezza dello schermo. Pedine tonde con sigla, colore e nome al passaggio del mouse; la propria è evidenziata. Trascinamento con mouse e dito, salvato al rilascio, senza "salti" (RF-94). Il Master può riportarle all'ingresso. Legenda sotto la mappa. Scelta "Giochi come". | RF-03, RF-10, RF-12, RF-30…RF-35, RF-94 |
| 7 | **Nebbia di guerra** | Tabella `zone_scoperte` e pannello delle zone del Master. Copertura opaca per i giocatori e al 55% per il Master, senza intercettare i clic. All'avvio è scoperta solo la zona d'ingresso. I poligoni delle zone non scoperte non arrivano ai giocatori. Le sovrapposizioni segrete sono servite solo a zona scoperta. | RF-20…RF-25 |
| 8 | **Mostri** | Tabella `mostri`. Il Master li aggiunge (tipo o "Altro", quantità, zona), li sposta e li toglie con conferma nell'interfaccia. I mostri ricevono sigle numerate e restano sotto la nebbia. I giocatori ricevono i dati di un mostro solo quando la sua zona è scoperta, anche alla scoperta successiva e sulle istantanee. | RF-40…RF-44 |
| 9 | **Dadi e storico** | Tabella `tiri`. Tiro sul server con `crypto.randomInt`. Pulsanti da d4 a d100 e 3d6, numero di dadi, modificatore e motivo. Risultato in grande, con 20 naturale e 1 naturale evidenziati. Tiri nascosti visibili solo al Master. Storico degli ultimi 40 tiri. Svuotamento con conferma in due passaggi. | RF-50…RF-63 |
| 10 | **Narrazione e backup** | Il Master pubblica e nasconde il testo "Il Master legge". Esportazione in JSON dello stato di una partita. | RF-70, RF-95 |

### Traguardo 3 — Rilascio dell'MVP

| # | Step | Contenuto | Requisiti |
| --- | --- | --- | --- |
| 11 | **Chiedi a Claude** *(se confermato, §13)* | Endpoint lato server con chiave API nel `.env` e risposta mostrata mentre viene scritta, con "Ferma". Prompt di sistema con il vincolo dei segreti dell'avventura, limite di domande per utente, attivabile per partita. | RF-100…RF-104 |
| 12 | **Rifinitura** | Interfaccia responsive fino a 400 px, tema chiaro/scuro con la palette e i caratteri, accessibilità (focus visibile, contrasti, riduci movimento, testi alternativi), nessun dialogo del browser, verifica che i testi degli utenti siano mostrati solo come testo. | RNF-02…RNF-09 |
| 13 | **Collaudo e messa in linea** | Suite Playwright con i criteri della §12, giocata con più browser contemporanei (un Master, due giocatori, un non invitato). Test di sicurezza: comandi costruiti a mano da un `ROLE_PLAYER`, accesso a partite altrui, immagini segrete. Messa in linea su Debian 13 con Apache2 o nginx, systemd e MySQL 9.7 secondo la §15.5, con le configurazioni di esempio in `deploy/`. Partita di prova con il gruppo. | §12, RNF-07 |

Dopo il traguardo 3, il backlog della §10 riparte dal punto 1 (caricamento di un'avventura dal pannello del Master).
