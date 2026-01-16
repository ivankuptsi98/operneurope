# OpenEurope Example Program

Questo repository contiene un programma Python che dimostra un flusso minimo di audit energetico ispirato alla piattaforma **OpenEurope** descritta nel documento allegato. L'obiettivo è fornire un prototipo semplice e trasparente che mostri le fasi principali: ingestione dati, normalizzazione, calcolo del risparmio energetico, generazione della reportistica e mantenimento di un audit trail.

## Funzionalità principali

- **Ingestione dati**: il programma carica un file CSV con i dati di consumo energetico (prima e dopo l'intervento). In un sistema reale l'ingestione avverrebbe tramite connettori ai macchinari e ai sistemi di fabbrica.
- **Normalizzazione e pulizia**: vengono eliminati i record con valori mancanti e i campi di consumo vengono convertiti in numerici per garantire la coerenza dei calcoli.
- **Algoritmo di calcolo**: vengono calcolate la media del consumo iniziale (`consumption_before`), la media del consumo successivo all'intervento (`consumption_after`), il risparmio assoluto e la percentuale di risparmio. L'algoritmo è semplice e replicabile.
- **Reportistica automatica**: il programma genera un report in formato Markdown che riassume i risultati del calcolo e include un *audit trail* con tutte le operazioni effettuate e relativi timestamp.
- **Audit trail**: ogni step (ingestione, normalizzazione, calcolo) viene registrato in un registro di controllo, a supporto della trasparenza e della conformità.

## Formato dei dati di input

Il file CSV deve contenere almeno le colonne seguenti:

| Colonna              | Descrizione                                                     |
|----------------------|----------------------------------------------------------------|
| `consumption_before` | Consumo energetico misurato prima dell'intervento              |
| `consumption_after`  | Consumo energetico misurato dopo l'intervento                  |

Eventuali colonne aggiuntive (ad esempio `timestamp`, identificativi del macchinario, ecc.) vengono mantenute ma non sono utilizzate nel calcolo.

Esempio (`sample_data.csv`):

```csv
timestamp,consumption_before,consumption_after
2025-01-01 08:00,100,80
2025-01-01 09:00,105,78
2025-01-01 10:00,102,79
2025-01-01 11:00,98,77
2025-01-01 12:00,101,82
```

## Come eseguire il programma

1. **Installare la dipendenza** (richiede Python 3.8+):

   ```bash
   pip install pandas
   ```

2. **Eseguire il programma** passando il percorso del file CSV e, facoltativamente, la directory di output per il report:

   ```bash
   python openeurope.py sample_data.csv -o report
   ```

   Al termine verrà generato un file `energy_audit_report.md` nella directory specificata.

## Avvertenze

Questo progetto ha unicamente scopo dimostrativo e non sostituisce in alcun modo l'applicazione completa **OpenEurope**. Il sistema reale comprende algoritmi di calcolo avanzati, integrazione con sistemi industriali e funzionalità di conformità non implementate in questo esempio.
