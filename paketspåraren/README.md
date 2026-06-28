# Paketspåraren 📦

En enkel paketspårare byggd med HTML/JS och PHP — fungerar på one.com utan extra kostnad.

## Struktur

```
paketspåraren/
├── api/
│   ├── config.php          ← Din API-nyckel (lägg INTE i git)
│   ├── config.example.php  ← Mall för config.php
│   ├── register.php        ← Proxy: registrera spårningsnummer
│   ├── track.php           ← Proxy: hämta status
│   └── .htaccess           ← Blockerar direkt åtkomst till config.php
└── public/
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## Kom igång

### 1. Skapa config.php

```bash
cp api/config.example.php api/config.php
```

Öppna `api/config.php` och ersätt `DIN_NYCKEL_HÄR` med din riktiga 17track API-nyckel.

### 2. Ladda upp till one.com

Ladda upp **alla filer** via one.coms filhanterare eller FTP:

- Mappen `api/` → till valfri plats på servern (t.ex. `paketspåraren/api/`)
- Mappen `public/` → till din webbroot (t.ex. `public_html/`)

> **OBS:** Kontrollera att sökvägen `../api` i `app.js` stämmer med hur du lagt filerna.

### 3. Klart!

Öppna `index.html` i webbläsaren och börja lägga till paket.

## Säkerhet

- `api/config.php` ligger i `.gitignore` och committas aldrig
- `.htaccess` blockerar direkt åtkomst till `config.php` från webbläsaren
- API-nyckeln syns aldrig för slutanvändaren

## API

Använder [17track API v2.2](https://www.17track.net/en/api).
100 gratis spårningar per månad ingår i gratiskontot.
