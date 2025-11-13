# Salon Call Agent (Vercel-ready, ohne KI)

- Mikrofon-Dialog (Web Speech API)
- Regelbasierte FAQs (Öffnungszeiten, Preise, Adresse, Zahlung)
- Terminanfrage → E-Mail an TEAM_INBOX (iCloud SMTP)
- Gesprächsprotokoll als Text

## Schnellstart lokal
1) Node 18+ installieren
2) `npm i -g vercel` (optional)
3) `cp .env.example .env` und SMTP_PASS eintragen (nur für lokalen Test)
4) `npx vercel dev` → http://localhost:3000

## Deployment auf Vercel
1) Projekt nach GitHub pushen
2) Vercel → „New Project“ → Repo auswählen
3) **Environment Variables** in Vercel setzen:
   - SMTP_HOST=smtp.mail.me.com
   - SMTP_PORT=587
   - SMTP_SECURE=false
   - SMTP_USER=otosun750@icloud.com
   - SMTP_PASS=<app-spezifisches-Passwort>
   - TEAM_INBOX=otosun750@icloud.com
   - FROM_ADDRESS=Salon Call Agent <otosun750@icloud.com>
4) Deploy klicken – fertig

**Hinweis:** Schreiben auf `data/appointments.json` ist im Vercel-Serverless nur temporär.
Die E-Mail geht trotzdem zuverlässig raus. Für echte Speicherung: DB/KV später ergänzen.
