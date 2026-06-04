'use client'
import { useState, useEffect, useRef } from 'react'
import { Persona, ContentItem } from '@/lib/types'

export default function Home() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'content' | 'sequence'>('info')
  const [showModal, setShowModal] = useState(false)
  const [newFirstname, setNewFirstname] = useState('')
  const [newLastname, setNewLastname] = useState('')
  const [contentInput, setContentInput] = useState('')
  const [kwInput, setKwInput] = useState('')
  const [emails, setEmails] = useState<any[]>([])
  const [numEmails, setNumEmails] = useState(3)
  const [extraInstruction, setExtraInstruction] = useState('')
  const [generating, setGenerating] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [status, setStatus] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const firstnameRef = useRef<HTMLInputElement>(null)

  const active = personas.find(p => p.id === activeId) || null

  useEffect(() => { loadPersonas() }, [])
  useEffect(() => {
    if (showModal) setTimeout(() => firstnameRef.current?.focus(), 100)
  }, [showModal])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  async function loadPersonas() {
    const res = await fetch('/api/personas')
    const data = await res.json()
    if (data.personas) setPersonas(data.personas)
  }

  async function savePersona(p: Persona) {
    setStatus('Speichert...')
    await fetch('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    })
    setStatus('Gespeichert')
    setTimeout(() => setStatus(''), 2000)
  }

  function updateActive(fields: Partial<Persona>) {
    if (!activeId) return
    const updated = personas.map(p => {
      if (p.id !== activeId) return p
      const merged = { ...p, ...fields }
      merged.name = [merged.firstname, merged.lastname].filter(Boolean).join(' ')
      return merged
    })
    setPersonas(updated)
    const p = updated.find(x => x.id === activeId)!
    savePersona(p)
  }

  async function createPersona() {
    if (!newFirstname.trim()) return
    const firstname = newFirstname.trim()
    const lastname = newLastname.trim()
    const p: Persona = {
      id: Date.now().toString(),
      firstname, lastname,
      name: [firstname, lastname].filter(Boolean).join(' '),
      gender: '', email: '',
      title: '', company: '', industry: '', location: '', birthday: '',
      language: 'formal', goal: '', privateGoal: '', product: '',
      keywords: [], contentItems: []
    }
    await fetch('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    })
    await loadPersonas()
    setActiveId(p.id)
    setShowModal(false)
    setNewFirstname('')
    setNewLastname('')
    setActiveTab('info')
    setEmails([])
  }

  async function deletePersona(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Persona löschen?')) return
    await fetch('/api/personas', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (activeId === id) setActiveId(null)
    await loadPersonas()
  }

  function addContent(text: string, type = 'TEXT') {
    if (!text.trim() || !active) return
    const item: ContentItem = { text: text.trim(), type, addedAt: new Date().toISOString() }
    updateActive({ contentItems: [...(active.contentItems || []), item] })
    setContentInput('')
  }

  function removeContent(i: number) {
    if (!active) return
    const items = [...active.contentItems]
    items.splice(i, 1)
    updateActive({ contentItems: items })
  }

  function addKeyword() {
    if (!kwInput.trim() || !active) return
    const kws = [...(active.keywords || [])]
    if (!kws.includes(kwInput.trim())) kws.push(kwInput.trim())
    updateActive({ keywords: kws })
    setKwInput('')
  }

  function removeKeyword(kw: string) {
    if (!active) return
    updateActive({ keywords: active.keywords.filter(k => k !== kw) })
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => addContent(ev.target?.result as string, 'DATEI')
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => addContent(ev.target?.result as string, 'DATEI')
    reader.readAsText(file)
  }

  async function analyzeBox() {
    if (!active || !active.contentItems.length) return
    setAnalyzing(true)
    setStatus('Box wird analysiert...')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: active })
      })
      const data = await res.json()
      if (data.error) {
        setStatus(`Fehler: ${data.error}`)
        return
      }
      if (data.result) {
        const r = data.result
        updateActive({
          firstname: r.firstname || active.firstname,
          lastname: r.lastname || active.lastname,
          gender: r.gender || active.gender,
          email: r.email || active.email,
          title: r.title || active.title,
          company: r.company || active.company,
          industry: r.industry || active.industry,
          location: r.location || active.location,
          language: r.language || active.language,
          goal: r.goal || active.goal,
          privateGoal: r.privateGoal || active.privateGoal,
          keywords: r.keywords?.length ? r.keywords : active.keywords,
          analysis: r.analysis
        })
        setStatus('Analyse abgeschlossen')
        setActiveTab('info')
      } else {
        setStatus('Fehler: Kein Ergebnis von der API')
      }
    } catch (err: any) {
      setStatus(`Fehler: ${err.message}`)
    } finally {
      setAnalyzing(false)
      setTimeout(() => setStatus(''), 8000)
    }
  }

  async function generateSequence() {
    if (!active) return
    setGenerating(true)
    setEmails([])
    setStatus('Generiert E-Mails...')
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: active, numEmails, extraInstruction, previousEmails: [] })
      })
      const data = await res.json()
      if (data.emails) setEmails(data.emails)
      setStatus('')
    } catch {
      setStatus('Fehler beim Generieren')
    } finally {
      setGenerating(false)
    }
  }

  async function addNextEmail() {
    if (!active) return
    setGenerating(true)
    setStatus('Nächste E-Mail wird generiert...')
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: active, numEmails: 1, extraInstruction, previousEmails: emails })
      })
      const data = await res.json()
      if (data.emails) setEmails(prev => [...prev, { ...data.emails[0], num: prev.length + 1 }])
      setStatus('')
    } catch {
      setStatus('Fehler')
    } finally {
      setGenerating(false)
    }
  }

  function copyEmail(i: number) {
    const e = emails[i]
    navigator.clipboard.writeText(`Betreff: ${e.subject}\n\n${e.body}`)
  }

  function openInMail(i: number) {
    const e = emails[i]
    const to = active?.email || ''
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`
  }

  const css = {
    input: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '10px 14px', color: 'var(--text)', fontFamily: 'DM Mono, monospace', fontSize: 13 } as React.CSSProperties,
    textarea: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '10px 14px', color: 'var(--text)', fontFamily: 'DM Mono, monospace', fontSize: 13, resize: 'vertical', minHeight: 80 } as React.CSSProperties,
    label: { display: 'block', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 } as React.CSSProperties,
    field: { marginBottom: 20 } as React.CSSProperties,
    sectionTitle: { fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, marginTop: 32, paddingBottom: 8, borderBottom: '1px solid var(--border)' } as React.CSSProperties,
    btn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 3, fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', letterSpacing: '0.05em', width: '100%', justifyContent: 'center' } as React.CSSProperties,
    btnPrimary: { background: 'var(--accent)', color: theme === 'dark' ? '#0e0e0e' : '#ffffff', border: '1px solid var(--accent)', fontWeight: 500, padding: '10px 20px', borderRadius: 3, fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
    btnSmall: { padding: '7px 12px', fontSize: 11, borderRadius: 3, fontFamily: 'DM Mono, monospace', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' } as React.CSSProperties,
    tag: { background: 'rgba(200,240,80,0.1)', border: '1px solid rgba(200,240,80,0.3)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 20, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  }

  const displayName = active ? [active.firstname, active.lastname].filter(Boolean).join(' ') || active.name : ''

  return (
    <>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '24px 40px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 28, fontWeight: 400, color: 'var(--accent)', flex: 1 }}>Persona Box</h1>
        <span style={{ color: 'var(--muted)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Outreach Intelligence</span>
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          style={{ ...css.btnSmall, width: 'auto', padding: '6px 14px', fontSize: 16, marginLeft: 16 }}
          title="Theme wechseln">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', minHeight: 'calc(100vh - 73px)' }}>
        {/* SIDEBAR */}
        <aside style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
            <button style={css.btn} onClick={() => setShowModal(true)}>+ Neue Persona</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {personas.length === 0 && (
              <div style={{ padding: 24, color: 'var(--muted)', fontSize: 11, textAlign: 'center', lineHeight: 1.8 }}>
                Noch keine Personas.<br />Klick auf "+ Neue Persona".
              </div>
            )}
            {personas.map(p => {
              const pName = [p.firstname, p.lastname].filter(Boolean).join(' ') || p.name
              return (
                <div key={p.id}
                  style={{ padding: '12px 16px', border: `1px solid ${p.id === activeId ? 'var(--accent)' : 'transparent'}`, borderRadius: 4, cursor: 'pointer', marginBottom: 4, background: p.id === activeId ? 'rgba(200,240,80,0.05)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  onClick={() => { setActiveId(p.id); setActiveTab('info'); setEmails([]) }}>
                  <div>
                    <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 15, fontStyle: 'italic' }}>{pName}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {p.gender ? `${p.gender} · ` : ''}{p.company || p.title || '–'} · {(p.contentItems || []).length} Inhalte
                    </div>
                    {p.email && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{p.email}</div>}
                  </div>
                  <button onClick={e => deletePersona(p.id, e)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>
              )
            })}
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ display: 'flex', flexDirection: 'column' }}>
          {!active ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--muted)' }}>
              <div style={{ fontSize: 40, opacity: 0.2 }}>◻</div>
              <div style={{ fontSize: 12 }}>Persona auswählen oder neu anlegen</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {([['info','Persona'], ['content','Box'], ['sequence','E-Mail Sequenz']] as const).map(([tab, label]) => (
                  <div key={tab}
                    style={{ padding: '16px 24px', cursor: 'pointer', color: activeTab === tab ? 'var(--accent)' : 'var(--muted)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`, marginBottom: -1 }}
                    onClick={() => setActiveTab(tab)}>
                    {label}
                  </div>
                ))}
              </div>

              {/* TAB: INFO */}
              {activeTab === 'info' && (
                <div style={{ padding: '32px 40px', flex: 1, overflowY: 'auto' }}>
                  <div style={{ ...css.sectionTitle, marginTop: 0 }}>Grunddaten</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={css.field}>
                      <label style={css.label}>Vorname</label>
                      <input style={css.input} value={active.firstname || ''} onChange={e => updateActive({ firstname: e.target.value })} />
                    </div>
                    <div style={css.field}>
                      <label style={css.label}>Nachname</label>
                      <input style={css.input} value={active.lastname || ''} onChange={e => updateActive({ lastname: e.target.value })} />
                    </div>
                    <div style={css.field}>
                      <label style={css.label}>Geschlecht</label>
                      <input style={css.input} value={active.gender || ''} onChange={e => updateActive({ gender: e.target.value })} placeholder="männlich, weiblich, divers" />
                    </div>
                    <div style={css.field}>
                      <label style={css.label}>E-Mail</label>
                      <input style={css.input} type="email" value={active.email || ''} onChange={e => updateActive({ email: e.target.value })} placeholder="name@unternehmen.de" />
                    </div>
                    <div style={css.field}>
                      <label style={css.label}>Geburtstag</label>
                      <input style={css.input} value={active.birthday || ''} onChange={e => updateActive({ birthday: e.target.value })} placeholder="z.B. 12. März" />
                    </div>
                    <div style={css.field}>
                      <label style={css.label}>Position</label>
                      <input style={css.input} value={active.title || ''} onChange={e => updateActive({ title: e.target.value })} />
                    </div>
                    <div style={css.field}>
                      <label style={css.label}>Unternehmen</label>
                      <input style={css.input} value={active.company || ''} onChange={e => updateActive({ company: e.target.value })} />
                    </div>
                    <div style={css.field}>
                      <label style={css.label}>Branche</label>
                      <input style={css.input} value={active.industry || ''} onChange={e => updateActive({ industry: e.target.value })} />
                    </div>
                    <div style={css.field}>
                      <label style={css.label}>Standort</label>
                      <input style={css.input} value={active.location || ''} onChange={e => updateActive({ location: e.target.value })} />
                    </div>
                  </div>

                  <div style={css.sectionTitle}>Sprache & Stil</div>
                  <div style={css.field}>
                    <label style={css.label}>Ansprache</label>
                    <select style={{ ...css.input, cursor: 'pointer' }} value={active.language} onChange={e => updateActive({ language: e.target.value as any })}>
                      <option value="formal">Formell (Sie)</option>
                      <option value="informal">Informell (Du)</option>
                    </select>
                  </div>

                  <div style={css.sectionTitle}>Ziele</div>
                  <div style={css.field}>
                    <label style={css.label}>Berufliche Ziele</label>
                    <textarea style={css.textarea} value={active.goal || ''} onChange={e => updateActive({ goal: e.target.value })} placeholder="Was treibt diese Person beruflich an?" />
                  </div>
                  <div style={css.field}>
                    <label style={css.label}>Private Ziele</label>
                    <textarea style={css.textarea} value={active.privateGoal || ''} onChange={e => updateActive({ privateGoal: e.target.value })} placeholder="Persönliche Interessen, Werte, Lebensziele..." />
                  </div>

                  <div style={css.sectionTitle}>Mein Angebot</div>
                  <div style={css.field}>
                    <textarea style={css.textarea} value={active.product || ''} onChange={e => updateActive({ product: e.target.value })} placeholder="Was genau biete ich an? Warum passt das zu dieser Person?" />
                  </div>

                  {active.analysis && (
                    <>
                      <div style={css.sectionTitle}>Claude Analyse</div>
                      <div style={{ background: 'rgba(200,240,80,0.05)', border: '1px solid rgba(200,240,80,0.2)', borderRadius: 4, padding: '14px 18px', fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
                        {active.analysis}
                      </div>
                    </>
                  )}

                  <div style={css.sectionTitle}>Schlüsselwörter</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {(active.keywords || []).map(k => (
                      <span key={k} style={css.tag}>{k}
                        <button onClick={() => removeKeyword(k)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...css.input, flex: 1 }} value={kwInput} onChange={e => setKwInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addKeyword()} placeholder="Stichwort hinzufügen..." />
                    <button style={{ ...css.btnSmall, width: 'auto' }} onClick={addKeyword}>+</button>
                  </div>
                </div>
              )}

              {/* TAB: CONTENT */}
              {activeTab === 'content' && (
                <div style={{ padding: '32px 40px', flex: 1, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ ...css.sectionTitle, marginTop: 0, marginBottom: 0, flex: 1 }}>Inhalte in die Box legen</div>
                    {(active.contentItems || []).length > 0 && (
                      <button style={css.btnPrimary} onClick={analyzeBox} disabled={analyzing}>
                        {analyzing ? '⟳ Analysiert...' : '◈ Box analysieren'}
                      </button>
                    )}
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: 12, margin: '12px 0 20px', lineHeight: 1.7 }}>
                    LinkedIn-Posts, Interviews, Zitate, Beobachtungen. Claude strukturiert alles selbst.
                  </p>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    style={{ border: '1px dashed var(--border)', borderRadius: 4, padding: 24, textAlign: 'center', color: 'var(--muted)', cursor: 'pointer', marginBottom: 16 }}>
                    ↓ Datei ablegen oder klicken (.txt, .md)
                  </div>
                  <input ref={fileInputRef} type="file" accept=".txt,.md" style={{ display: 'none' }} onChange={handleFile} />

                  {(active.contentItems || []).map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '10px 14px', marginBottom: 8 }}>
                      <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', flexShrink: 0, marginTop: 3, width: 60 }}>{item.type}</div>
                      <div style={{ flex: 1, fontSize: 12, maxHeight: 80, overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.text}</div>
                      <button onClick={() => removeContent(i)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <textarea value={contentInput} onChange={e => setContentInput(e.target.value)}
                      style={{ ...css.textarea, flex: 1, minHeight: 60 }}
                      placeholder="Text, LinkedIn-Post, Zitat, Beobachtung..." />
                    <button style={{ ...css.btnSmall, width: 'auto', alignSelf: 'flex-end' }} onClick={() => addContent(contentInput)}>+</button>
                  </div>
                </div>
              )}

              {/* TAB: SEQUENCE */}
              {activeTab === 'sequence' && (
                <div style={{ padding: '32px 40px', flex: 1, overflowY: 'auto' }}>
                  <div style={{ ...css.sectionTitle, marginTop: 0 }}>E-Mail Sequenz für {displayName}</div>
                  {active.email && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20, marginTop: -8 }}>
                      → {active.email}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={css.field}>
                      <label style={css.label}>Anzahl E-Mails</label>
                      <select style={{ ...css.input, width: 160 }} value={numEmails} onChange={e => setNumEmails(parseInt(e.target.value))}>
                        {[2,3,4,5].map(n => <option key={n} value={n}>{n} E-Mails</option>)}
                      </select>
                    </div>
                    <div style={{ ...css.field, flex: 1 }}>
                      <label style={css.label}>Zusätzliche Anweisung (optional)</label>
                      <input style={css.input} value={extraInstruction} onChange={e => setExtraInstruction(e.target.value)} placeholder="z.B. Fokus auf Kosteneinsparung..." />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                    <button style={css.btnPrimary} onClick={generateSequence} disabled={generating}>
                      {generating ? '⟳ Generiert...' : '▶ Sequenz generieren'}
                    </button>
                    {emails.length > 0 && (
                      <button style={{ ...css.btnSmall, width: 'auto', padding: '10px 20px' }} onClick={addNextEmail} disabled={generating}>
                        + Nächste E-Mail
                      </button>
                    )}
                  </div>

                  {emails.map((email, i) => (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
                      <div style={{ background: 'var(--surface)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>E-Mail {email.num}</span>
                        <span style={{ fontFamily: 'Instrument Serif, serif', fontSize: 15, fontStyle: 'italic', flex: 1, margin: '0 16px' }}>{email.subject}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {active.email && (
                            <button style={css.btnSmall} onClick={() => openInMail(i)}>↗ Öffnen</button>
                          )}
                          <button style={css.btnSmall} onClick={() => copyEmail(i)}>Kopieren</button>
                        </div>
                      </div>
                      <div style={{ padding: '20px 24px', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{email.body}</div>
                      <div style={{ padding: '8px 24px 14px', fontSize: 10, letterSpacing: '0.05em', color: 'var(--muted)', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                        ↗ Winkel: {email.angle}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ padding: '10px 24px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.05em', background: 'var(--surface)' }}>
                {status || 'Bereit'}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 32, width: 420, display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22, fontWeight: 400, fontStyle: 'italic' }}>Neue Persona</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={css.label}>Vorname</label>
                <input ref={firstnameRef} style={css.input} value={newFirstname} onChange={e => setNewFirstname(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createPersona(); if (e.key === 'Escape') setShowModal(false) }}
                  placeholder="Vorname" />
              </div>
              <div>
                <label style={css.label}>Nachname</label>
                <input style={css.input} value={newLastname} onChange={e => setNewLastname(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createPersona(); if (e.key === 'Escape') setShowModal(false) }}
                  placeholder="Nachname" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={css.btnPrimary} onClick={createPersona}>Anlegen</button>
              <button style={css.btn} onClick={() => setShowModal(false)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
