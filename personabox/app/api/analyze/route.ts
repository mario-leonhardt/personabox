import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { persona } = await req.json()
    const contentSummary = (persona.contentItems || [])
      .map((i: any) => `[${i.type}]: ${i.text}`)
      .join('\n\n')

    const prompt = `Du analysierst Inhalte über eine Person und extrahierst strukturierte Erkenntnisse für eine Persona Card.

GESAMMELTE INHALTE:
${contentSummary || 'Keine Inhalte vorhanden.'}

BEREITS BEKANNTE DATEN:
Vorname: ${persona.firstname || '–'}
Nachname: ${persona.lastname || '–'}
Position: ${persona.title || '–'}
Unternehmen: ${persona.company || '–'}
Branche: ${persona.industry || '–'}

Analysiere die Inhalte und antworte NUR mit einem JSON-Objekt. Kein Text davor oder danach:
{
  "firstname": "erkannter Vorname falls leer",
  "lastname": "erkannter Nachname falls leer",
  "gender": "männlich oder weiblich oder divers — aus Name/Sprache ableiten",
  "title": "erkannte Position falls leer",
  "company": "erkanntes Unternehmen falls leer",
  "industry": "erkannte Branche falls leer",
  "location": "erkannter Standort falls leer",
  "language": "formal oder informal basierend auf Schreibstil der Person",
  "goal": "Berufliche Ziele: Was treibt diese Person beruflich an? Prioritäten, Ambitionen (2-3 Sätze)",
  "privateGoal": "Private Ziele: Was lässt sich über persönliche Interessen, Werte, Lebensziele ableiten? (1-2 Sätze, oder leer lassen wenn unklar)",
  "keywords": ["Keyword1", "Keyword2", "Keyword3", "Keyword4", "Keyword5"],
  "analysis": "Persönlichkeitsprofil: Kommunikationsstil, Werte, Muster, Besonderheiten (3-4 Sätze)"
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = message.content.map((b: any) => b.text || '').join('').replace(/```json|```/g, '').trim()
    const result = JSON.parse(raw)
    // Compute full name
    result.name = [result.firstname || persona.firstname, result.lastname || persona.lastname].filter(Boolean).join(' ')
    return NextResponse.json({ result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
