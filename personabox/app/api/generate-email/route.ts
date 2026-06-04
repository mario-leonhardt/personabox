import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { persona, numEmails, extraInstruction, previousEmails } = await req.json()
    const contentSummary = (persona.contentItems || [])
      .map((i: any) => `[${i.type}]: ${i.text}`)
      .join('\n\n')

    const previousSummary = previousEmails?.length
      ? `\nBEREITS GENERIERTE E-MAILS (diese Winkel nicht wiederholen):\n${previousEmails.map((e: any) => `E-Mail ${e.num}: ${e.angle}`).join('\n')}`
      : ''

    const fullName = [persona.firstname, persona.lastname].filter(Boolean).join(' ') || persona.name || '–'

    const prompt = `Du bist ein erfahrener B2B-Vertriebsexperte. Erstelle eine E-Mail-Sequenz.

PERSONA:
Name: ${fullName}
Geschlecht: ${persona.gender || '–'}
Position: ${persona.title || '–'}
Unternehmen: ${persona.company || '–'}
Branche: ${persona.industry || '–'}
Standort: ${persona.location || '–'}
Geburtstag: ${persona.birthday || '–'}
Sprache: ${persona.language === 'formal' ? 'Formell (Sie)' : 'Informell (Du)'}
Berufliche Ziele: ${persona.goal || '–'}
Private Ziele: ${persona.privateGoal || '–'}
Schlüsselwörter: ${(persona.keywords || []).join(', ') || '–'}
Analyse: ${persona.analysis || '–'}

MEIN ANGEBOT:
${persona.product || 'nicht angegeben'}

GESAMMELTE INHALTE ÜBER DIE PERSON:
${contentSummary || 'Keine Inhalte.'}
${previousSummary}
${extraInstruction ? `\nZUSÄTZLICHE ANWEISUNG: ${extraInstruction}` : ''}

Erstelle genau ${numEmails} E-Mail(s). Jede mit einem anderen Winkel. Erste E-Mail = erster Kontakt, weitere = Follow-ups ohne Antwort.

Regeln:
- Keine Floskeln ("Ich hoffe diese E-Mail findet Sie gut" etc.)
- Kurz, direkt, menschlich
- Jeder Einstieg aus einem anderen Winkel (persönliche Beobachtung, Branchenthema, konkretes Problem, Timing, private Verbindung)
- Ziel: Gespräch vereinbaren
- ${persona.language === 'formal' ? 'Immer "Sie" — korrekte Anrede basierend auf Geschlecht (Sehr geehrter Herr / Sehr geehrte Frau)' : 'Immer "Du"'}
- Perfekt statt Präteritum

Antworte NUR mit JSON-Array:
[
  {
    "num": 1,
    "subject": "Betreff",
    "body": "E-Mail Text",
    "angle": "Winkel in 10-15 Wörtern"
  }
]`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = message.content.map((b: any) => b.text || '').join('').replace(/```json|```/g, '').trim()
    const emails = JSON.parse(raw)
    return NextResponse.json({ emails })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
