# torrent_web

dipendenze da installare:
python -m pip install "pymongo[srv]"
python -m pip install flask
python -m pip install flask-cors

# Torrent Sharing Platform

Una piattaforma web per la condivisione di file torrent sviluppata con Flask e MongoDB.

## 🚀 Funzionalità

### Per tutti gli utenti
- Ricerca torrent con filtri avanzati (titolo, descrizione, categorie, date)
- Visualizzazione dettagli torrent
- Navigazione delle categorie

### Per utenti registrati
- Upload di nuovi torrent
- Download dei file torrent
- Sistema di commenti e valutazioni (1-5 stelle)
- Gestione profilo utente

### Per amministratori
- Pannello di amministrazione
- Gestione utenti (ban/unban)
- Moderazione contenuti (eliminazione torrent e commenti)
- Statistiche avanzate della piattaforma
- Classifiche e metriche di utilizzo

## 🛠 Tecnologie Utilizzate

- **Backend**: Python Flask
- **Database**: MongoDB Atlas
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Architettura**: REST API + SPA (Single Page Application)

## 📁 Struttura del Progetto
torrent_web/
├── app.py # Applicazione Flask principale
├── config.py # Configurazione e variabili d'ambiente
├── requirements.txt # Dipendenze Python
├── database_schema.json # Schema del database MongoDB
├── static/
│ ├── style.css # Stili CSS responsive
│ └── script.js # Logica frontend e chiamate API
├── templates/
│ └── index.html # Template SPA principale
└── README.md # Questa documentazione
