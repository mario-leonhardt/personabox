'use client'
import { useState, useEffect, useRef } from 'react'
import { Persona, ContentItem, ImageItem } from '@/lib/types'

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
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [imageDragOver, setImageDragOver] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [status, setStatus] = useState('')
  const [viewItem, setViewItem] = useState<{ text: string; filename?: string } | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light' | 'pastel'>('dark')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingCanvasRef = useRef<HTMLCanvasElement>(null)
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
      keywords: [], contentItems: [], imageItems: []
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
    const filename = file.name
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      if (!text.trim() || !active) return
      const item: ContentItem = { text: text.trim(), type: 'DATEI', addedAt: new Date().toISOString(), filename }
      updateActive({ contentItems: [...(active.contentItems || []), item] })
      setContentInput('')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function downloadItem(item: { text: string; filename?: string }) {
    const blob = new Blob([item.text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = item.filename || 'datei.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleExpand(i: number) {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const MAX = 1400
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.80))
      }
      img.onerror = reject
      img.src = url
    })
  }

  async function addImage(file: File) {
    if (!active) return
    if (!file.type.startsWith('image/')) return
    try {
      const data = await compressImage(file)
      const item: ImageItem = { data, name: file.name, addedAt: new Date().toISOString() }
      updateActive({ imageItems: [...(active.imageItems || []), item] })
    } catch {
      setStatus('Bild konnte nicht geladen werden')
    }
  }

  function removeImage(i: number) {
    if (!active) return
    const items = [...(active.imageItems || [])]
    items.splice(i, 1)
    updateActive({ imageItems: items })
  }

  async function startRecording() {
    if (!active) return
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Web Audio analyser for live waveform
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      const source = audioCtx.createMediaStreamSource(audioStream)
      source.connect(analyser)
      const freqData = new Uint8Array(analyser.frequencyBinCount)

      // Show overlay FIRST so React renders the canvas into the DOM
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)

      // Wait for React to render the overlay and mount the canvas
      await new Promise(r => setTimeout(r, 200))

      const canvas = recordingCanvasRef.current
      if (!canvas) { setStatus('Canvas nicht verfügbar'); setIsRecording(false); return }
      const ctx = canvas.getContext('2d')!
      const personaName = active.name || `${active.firstname} ${active.lastname}`
      const subtitle = [active.title, active.company].filter(Boolean).join(' · ')
      const startTime = Date.now()

      function drawFrame() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        const W = canvas.width, H = canvas.height

        ctx.fillStyle = '#0d1d3a'
        ctx.fillRect(0, 0, W, H)

        ctx.fillStyle = '#ffffff'
        ctx.font = 'italic 72px Georgia, serif'
        ctx.textAlign = 'center'
        ctx.fillText(personaName, W/2, H/2 - 60)

        if (subtitle) {
          ctx.fillStyle = 'rgba(255,255,255,0.65)'
          ctx.font = '18px monospace'
          ctx.fillText(subtitle, W/2, H/2 - 8)
        }

        analyser.getByteFrequencyData(freqData)
        const bars = 40, barW = 14, gap = 8
        const totalW = bars * (barW + gap)
        const sx = (W - totalW) / 2
        for (let i = 0; i < bars; i++) {
          const val = freqData[Math.floor(i * freqData.length / bars)] / 255
          const bh = Math.max(4, val * 130 + 4)
          ctx.fillStyle = `rgba(255,255,255,${0.3 + val * 0.6})`
          const x = sx + i * (barW + gap)
          ctx.beginPath(); ctx.roundRect(x, H/2 + 55 - bh/2, barW, bh, 3); ctx.fill()
        }

        const mins = String(Math.floor(elapsed/60)).padStart(2,'0')
        const secs = String(elapsed%60).padStart(2,'0')
        ctx.fillStyle = 'rgba(255,255,255,0.28)'
        ctx.font = '14px monospace'
        ctx.textAlign = 'right'
        ctx.fillText(`${mins}:${secs}`, W - 40, H - 26)
        ctx.textAlign = 'center'

        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.fillRect(0, H - 3, W, 3)
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.fillRect(0, H - 3, W * Math.min(elapsed / 120, 1), 3)
      }

      const drawInterval = setInterval(drawFrame, 1000 / 30)
      drawFrame()

      const videoStream = canvas.captureStream(30)
      const combined = new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()])
      const mimeType =
        MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
        MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' :
        'video/webm'
      const mr = new MediaRecorder(combined, { mimeType })
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        clearInterval(drawInterval)
        const blob = new Blob(audioChunksRef.current, { type: 'video/webm' })
        const safeName = personaName.replace(/[^a-zA-Z0-9_\-]/g, '_')
        const ts = new Date().toISOString().slice(0,16).replace('T','_').replace(':','-')
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${safeName}_${ts}.webm`; a.click()
        URL.revokeObjectURL(url)
        audioStream.getTracks().forEach(t => t.stop())
        videoStream.getTracks().forEach(t => t.stop())
        audioCtx.close()
        setIsRecording(false); setRecordingTime(0)
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      }
      mr.start(200)
      mediaRecorderRef.current = mr
    } catch {
      setStatus('Mikrofon-Zugriff verweigert')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(addImage)
    e.target.value = ''
  }

  function handleImageDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setImageDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    files.forEach(addImage)
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
      }
    } catch {
      setStatus('Fehler bei der Analyse')
    } finally {
      setAnalyzing(false)
      setTimeout(() => setStatus(''), 3000)
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
          onClick={() => setTheme(t => t === 'dark' ? 'light' : t === 'light' ? 'pastel' : 'dark')}
          style={{ ...css.btnSmall, width: 'auto', padding: '6px 14px', fontSize: 16, marginLeft: 16 }}
          title="Theme wechseln">
          {theme === 'dark' ? '☀️' : theme === 'light' ? '🎊' : '🌙'}
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
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ ...css.btnSmall, width: 'auto' }} onClick={() => savePersona(active!)}>
                        ↓ Speichern
                      </button>
                      {(active.contentItems || []).length > 0 && (
                        <button style={css.btnPrimary} onClick={analyzeBox} disabled={analyzing}>
                          {analyzing ? '⟳ Analysiert...' : '◈ Box analysieren'}
                        </button>
                      )}
                    </div>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: 12, margin: '12px 0 20px', lineHeight: 1.7 }}>
                    LinkedIn-Posts, Interviews, Zitate, Beobachtungen. Claude strukturiert alles selbst.
                  </p>

                  <div onClick={() => fileInputRef.current?.click()}
                    style={{ border: '1px dashed var(--border)', borderRadius: 4, padding: 24, textAlign: 'center', color: 'var(--muted)', cursor: 'pointer', marginBottom: 16 }}>
                    ↓ Datei ablegen oder klicken (.txt, .md, .html)
                  </div>
                  <input ref={fileInputRef} type="file" accept=".txt,.md,.html" style={{ display: 'none' }} onChange={handleFile} />

                  {(active.contentItems || []).map((item, i) => {
                    const expanded = expandedItems.has(i)
                    const isLong = item.text.length > 200
                    return (
                      <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '10px 14px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', flexShrink: 0, marginTop: 3, width: 60 }}>{item.type}</div>
                          <div style={{ flex: 1, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...(isLong && !expanded ? { maxHeight: 72, overflow: 'hidden' } : {}) }}>
                            {item.filename && <span style={{ color: 'var(--muted)', fontSize: 10, display: 'block', marginBottom: 4 }}>{item.filename}</span>}
                            {item.text}
                          </div>
                          {item.type === 'DATEI' && (
                            <button onClick={() => setViewItem(item)} style={{ ...css.btnSmall, width: 'auto', fontSize: 10 }}>Anzeigen</button>
                          )}
                          {item.type === 'DATEI' && (
                            <button onClick={() => downloadItem(item)} style={{ ...css.btnSmall, width: 'auto', fontSize: 10 }}>Download</button>
                          )}
                          <button onClick={() => removeContent(i)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
                        </div>
                        {isLong && (
                          <button onClick={() => toggleExpand(i)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 10, letterSpacing: '0.08em', marginTop: 6, padding: 0 }}>
                            {expanded ? '↑ Weniger anzeigen' : '↓ Alles anzeigen'}
                          </button>
                        )}
                      </div>
                    )
                  })}

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <textarea value={contentInput} onChange={e => setContentInput(e.target.value)}
                      style={{ ...css.textarea, flex: 1, minHeight: 60 }}
                      placeholder="Text, LinkedIn-Post, Zitat, Beobachtung..." />
                    <button style={{ ...css.btnSmall, width: 'auto', alignSelf: 'flex-end' }} onClick={() => addContent(contentInput)}>+</button>
                  </div>

                  {/* IMAGE SECTION */}
                  <div style={{ ...css.sectionTitle, marginTop: 32 }}>Bilder</div>
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    onDrop={handleImageDrop}
                    onDragOver={e => { e.preventDefault(); setImageDragOver(true) }}
                    onDragLeave={() => setImageDragOver(false)}
                    style={{ border: `1px dashed ${imageDragOver ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 4, padding: 24, textAlign: 'center', color: imageDragOver ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', marginBottom: 16, background: imageDragOver ? 'rgba(200,240,80,0.04)' : 'transparent', transition: 'all 0.15s' }}>
                    ↓ Screenshot oder Bild ablegen (PNG, JPG, GIF)
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageFile} />

                  {(active.imageItems || []).length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
                      {(active.imageItems || []).map((img, i) => (
                        <div key={i} style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', aspectRatio: '4/3' }}>
                          <img src={img.data} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{img.name}</span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => { const a = document.createElement('a'); a.href = img.data; a.download = img.name; a.click() }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }} title="Download">↓</button>
                              <button onClick={() => removeImage(i)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* VOICE SECTION */}
                  <div style={{ ...css.sectionTitle, marginTop: 32 }}>Sprachaufnahme</div>
                  <button onClick={startRecording} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1a56db', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, letterSpacing: '0.05em' }}>
                    <span style={{ fontSize: 16 }}>🎙</span> Aufnahme starten
                  </button>
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

      {/* VIEW MODAL */}
      {viewItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', zIndex: 200 }}
          onClick={() => setViewItem(null)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em' }}>{viewItem.filename || 'Datei'}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...css.btnSmall, width: 'auto' }} onClick={() => downloadItem(viewItem)}>↓ Download</button>
              <button style={{ ...css.btnSmall, width: 'auto' }} onClick={() => setViewItem(null)}>✕ Schließen</button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            {(() => {
              const trimmed = viewItem.text.trimStart()
              const isHtml = viewItem.filename?.endsWith('.html') || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')
              const isMd = !isHtml && (viewItem.filename?.endsWith('.md') || trimmed.startsWith('# ') || trimmed.startsWith('## '))
              const mdSrc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script><style>html,body{margin:0;padding:0;background:#0e0e0e;color:#e8e8e0}body{display:flex;justify-content:center;padding:48px 24px 80px}#c{width:100%;max-width:680px;font-family:Georgia,serif;line-height:1.85;font-size:16px}h1,h2,h3{font-weight:600;margin-top:1.6em;margin-bottom:.4em;color:#fff}h1{font-size:1.9em}h2{font-size:1.35em}h3{font-size:1.1em}p{margin:.9em 0}code{background:#222;padding:2px 6px;border-radius:3px;font-size:.88em;color:#c8f050}pre{background:#161616;border:1px solid #2a2a2a;padding:16px;border-radius:6px;overflow-x:auto}blockquote{border-left:3px solid #c8f050;margin:0;padding:0 16px;color:#aaa}ul,ol{padding-left:1.5em}hr{border:none;border-top:1px solid #2a2a2a;margin:2em 0}img{max-width:100%}a{color:#c8f050}</style></head><body><div id="c"></div><script>document.getElementById('c').innerHTML=marked.parse(${JSON.stringify(viewItem.text)})<\/script></body></html>`
              if (isHtml) return (
                <iframe srcDoc={viewItem.text} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} sandbox="allow-scripts allow-same-origin allow-forms" title={viewItem.filename} />
              )
              if (isMd) return (
                <iframe srcDoc={mdSrc} style={{ width: '100%', height: '100%', border: 'none', background: '#0e0e0e' }} sandbox="allow-scripts" title={viewItem.filename} />
              )
              return (
                <pre style={{ margin: 0, padding: 24, color: 'var(--text)', fontFamily: 'DM Mono, monospace', fontSize: 12, lineHeight: 1.7, overflowY: 'auto', height: '100%', boxSizing: 'border-box', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {viewItem.text}
                </pre>
              )
            })()}
          </div>
        </div>
      )}

      {/* RECORDING OVERLAY */}
      {isRecording && active && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Canvas IS the background — exactly what gets recorded */}
          <canvas ref={recordingCanvasRef} width={1280} height={720}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
          {/* Stop button floats above canvas, not recorded */}
          <button onClick={stopRecording} style={{ position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '14px 44px', borderRadius: 40, fontSize: 13, fontFamily: 'DM Mono, monospace', cursor: 'pointer', letterSpacing: '0.08em' }}>
            ◼ &nbsp;Stopp & Speichern
          </button>
        </div>
      )}

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
