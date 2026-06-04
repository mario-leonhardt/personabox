# Persona Box

Outreach Intelligence System — Next.js + Supabase + Anthropic

## Setup

### 1. Supabase Tabelle anlegen

Öffne dein Supabase Dashboard → SQL Editor → New Query.
Füge den Inhalt von `supabase-migration.sql` ein und klicke "Run".

### 2. Environment Variables

Bearbeite `.env.local` und trage deinen Anthropic API-Key ein:

```
NEXT_PUBLIC_SUPABASE_URL=https://jwnlmgtbanebwcwnqyab.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Lokal testen

```bash
npm install
npm run dev
```

Öffne http://localhost:3000

### 4. Deploy auf Vercel

```bash
npm install -g vercel
vercel
```

Beim ersten Deploy fragt Vercel nach den Environment Variables.
Trage dort dieselben drei Werte ein wie in `.env.local`.

Danach unter vercel.com → dein Projekt → Settings → Domains:
`personabox.vercel.app` hinzufügen.

## Funktionen

- **Persona anlegen** — Name, Position, Unternehmen, Branche, Sprache, Geburtstag
- **Box befüllen** — Texte, LinkedIn-Posts, Zitate reinkopieren oder als Datei hochladen
- **Box analysieren** — Claude liest alle Inhalte und füllt die Persona Card automatisch aus
- **E-Mail Sequenz** — Generiert 2-5 E-Mails mit je einem anderen Winkel
- **Nächste E-Mail** — Auf Klick eine weitere E-Mail mit neuem Winkel hinzufügen
- **Alles in Supabase** — Persistent, geräteübergreifend
