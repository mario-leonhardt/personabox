'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Persona, ContentItem, ImageItem, VoiceItem } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'content' | 'sprache' | 'sequence'>('info')
  const [showModal, setShowModal] = useState(false)
  const [newFirstname, setNewFirstname] = useState('')
  const [newLastname, setNewLastname] = useState('')
  const [contentInput, setContentInput] = useState('')
  const [linkInput, setLinkInput] = useState('')
  const [kwInput, setKwInput] = useState('')
  const [emails, setEmails] = useState<any[]>([])
  const [numEmails, setNumEmails] = useState(3)
  const [extraInstruction, setExtraInstruction] = useState('')
  const [generating, setGenerating] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [imageDragOver, setImageDragOver] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [status, setStatus] = useState('')
  const [viewItem, setViewItem] = useState<{ text: string; filename?: string } | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light' | 'pastel'>('pastel')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [saving, setSaving] = useState(false)
  const [exportingIdx, setExportingIdx] = useState<number | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingTimeRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const firstnameRef = useRef<HTMLInputElement>(null)
  const isSavingRef = useRef(false)
  const pendingSaveRef = useRef<Persona | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const creatingRef = useRef(false)

  const active = personas.find(p => p.id === activeId) || null

  useEffect(() => { loadPersonas() }, [])
  useEffect(() => {
    if (showModal) setTimeout(() => firstnameRef.current?.focus(), 100)
  }, [showModal])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  async function loadPersonas() {
    const { data } = await supabase.from('personas').select('*').order('created_at', { ascending: false })
    if (data) setPersonas(data)
  }

  async function executeSave(p: Persona) {
    if (isSavingRef.current) { pendingSaveRef.current = p; return }
    isSavingRef.current = true
    setSaving(true)
    setStatus('Speichert...')
    try {
      const { error } = await supabase.from('personas').upsert(p, { onConflict: 'id' })
      if (error) setStatus('❌ ' + error.message)
      else { setStatus('Gespeichert ✓'); setTimeout(() => setStatus(''), 2000) }
    } catch (err: any) {
      setStatus('❌ ' + err.message)
    } finally {
      isSavingRef.current = false
      setSaving(false)
      if (pendingSaveRef.current) {
        const next = pendingSaveRef.current
        pendingSaveRef.current = null
        executeSave(next)
      }
    }
  }

  function savePersona(p: Persona) {
    pendingSaveRef.current = p
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const toSave = pendingSaveRef.current
      pendingSaveRef.current = null
      if (toSave) executeSave(toSave)
    }, 600)
  }

  function updateActive(fields: Partial<Persona>) {
    if (!activeId) return
    setPersonas(prev => {
      const updated = prev.map(p => {
        if (p.id !== activeId) return p
        const merged = { ...p, ...fields }
        merged.name = [merged.firstname, merged.lastname].filter(Boolean).join(' ')
        return merged
      })
      const p = updated.find(x => x.id === activeId)!
      setTimeout(() => savePersona(p), 0)
      return updated
    })
  }

  async function createPersona() {
    if (!newFirstname.trim()) return
    const firstname = newFirstname.trim()
    const lastname = newLastname.trim()
    const exists = personas.some(p => p.firstname.toLowerCase() === firstname.toLowerCase() && p.lastname.toLowerCase() === lastname.toLowerCase())
    if (exists) { setStatus(`Persona ${firstname} ${lastname} existiert bereits`); setTimeout(() => setStatus(``), 3000); return }
    const p: Persona = {
      id: crypto.randomUUID(),
      firstname, lastname,
      name: [firstname, lastname].filter(Boolean).join(' '),
      gender: '', email: '', mobile: '',
      title: '', company: '', industry: '', location: '', birthday: '',
      language: 'formal', goal: '', privateGoal: '', product: '',
      keywords: [], contentItems: [], imageItems: [], voiceItems: [],
      linkedinHeadline: '', linkedinInfo: ''
    }
    const { error } = await supabase.from('personas').insert(p)
    if (!error) {
      await loadPersonas()
      setActiveId(p.id)
      setShowModal(false)
      setNewFirstname('')
      setNewLastname('')
      setActiveTab('info')
      setEmails([])
    }
    creatingRef.current = false
  }

  async function deletePersona(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Persona löschen?')) return
    await supabase.from('personas').delete().eq('id', id)
    if (activeId === id) setActiveId(null)
    await loadPersonas()
  }

  function addContent(text: string, type = 'TEXT') {
    if (!text.trim() || !active) return
    const item: ContentItem = { text: text.trim(), type, addedAt: new Date().toISOString() }
    updateActive({ contentItems: [...(active.contentItems || []), item] })
    setContentInput('')
  }

  function addLink() {
    if (!linkInput.trim() || !active) return
    const item: ContentItem = { text: linkInput.trim(), type: 'LINK', addedAt: new Date().toISOString() }
    updateActive({ contentItems: [...(active.contentItems || []), item] })
    setLinkInput('')
  }

  function removeContent(i: number) {
    if (!active) return
    const items = [...(active.contentItems || [])]
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
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.80))
      }
      img.onerror = reject
      img.src = url
    })
  }

  async function addImages(files: File[]) {
    if (!active) return
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (!imageFiles.length) return
    try {
      const newItems: ImageItem[] = await Promise.all(
        imageFiles.map(async f => ({
          data: await compressImage(f),
          name: f.name,
          addedAt: new Date().toISOString()
        }))
      )
      updateActive({ imageItems: [...(active.imageItems || []), ...newItems] })
    } catch { setStatus('Bild konnte nicht geladen werden') }
  }

  function removeImage(i: number) {
    if (!active) return
    const items = [...(active.imageItems || [])]
    items.splice(i, 1)
    updateActive({ imageItems: items })
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    addImages(Array.from(files))
    e.target.value = ''
  }

  function handleImageDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setImageDragOver(false)
    addImages(Array.from(e.dataTransfer.files))
  }

  async function startRecording() {
    if (!active) return
    const capturedActiveId = activeId
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const duration = recordingTimeRef.current
        const reader = new FileReader()
        reader.onload = ev => {
          const audioData = ev.target?.result as string
          const item: VoiceItem = { audioData, duration, createdAt: new Date().toISOString() }
          setPersonas(prev => {
            const updated = prev.map(p => {
              if (p.id !== capturedActiveId) return p
              return { ...p, voiceItems: [...(p.voiceItems || []), item] }
            })
            const p = updated.find(x => x.id === capturedActiveId)
            if (p) setTimeout(() => executeSave(p), 0)
            return updated
          })
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach(t => t.stop())
        setIsRecording(false)
        setRecordingTime(0)
        recordingTimeRef.current = 0
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimeRef.current = 0
      recordingTimerRef.current = setInterval(() => {
        recordingTimeRef.current += 1
        setRecordingTime(t => t + 1)
      }, 1000)
    } catch { setStatus('Mikrofon-Zugriff verweigert') }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
  }

  async function exportVideo(item: VoiceItem, index: number) {
    if (!active) return
    setExportingIdx(index)
    try {
      // --- Cover zeichnen ---
      const W = 640, H = 480
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')!

      const personaName = (active.name || `${active.firstname} ${active.lastname}`).trim()
      const subtitle = [active.title, active.company].filter(Boolean).join(' · ')

      // Premium radial gradient — deep navy
      const grad = ctx.createRadialGradient(W * 0.38, H * 0.42, 0, W * 0.5, H * 0.5, W * 0.72)
      grad.addColorStop(0, '#0e2152')
      grad.addColorStop(1, '#04091a')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      // Subtle light bloom center
      const bloom = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.35)
      bloom.addColorStop(0, 'rgba(60,100,220,0.12)')
      bloom.addColorStop(1, 'rgba(60,100,220,0)')
      ctx.fillStyle = bloom
      ctx.fillRect(0, 0, W, H)

      ctx.textAlign = 'center'
      // Name — large, italic, serif
      ctx.fillStyle = '#ffffff'
      ctx.font = 'italic 72px Georgia, serif'
      const nameY = subtitle ? H / 2 - 18 : H / 2 + 24
      ctx.fillText(personaName, W / 2, nameY)

      if (subtitle) {
        // No divider line — spacing does the work
        ctx.fillStyle = 'rgba(255,255,255,0.32)'
        ctx.font = '13px -apple-system, Helvetica Neue, sans-serif'
        ctx.fillText(subtitle.toUpperCase(), W / 2, nameY + 48)
      }

      // Tiny play hint — bottom right, very restrained
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.font = '11px -apple-system, Helvetica Neue, sans-serif'
      ctx.fillText('▶  Tippen zum Anhören', W / 2, H - 36)

      // --- Audio dekodieren ---
      const base64 = item.audioData.split(',')[1]
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      const audioCtx = new AudioContext()
      const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer)
      await audioCtx.close()

      // --- mp4-muxer: echter H.264/AAC MP4 ---
      const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
      const target = new ArrayBufferTarget()
      const muxer = new Muxer({
        target,
        video: { codec: 'avc', width: W, height: H },
        audio: { codec: 'aac', sampleRate: audioBuffer.sampleRate, numberOfChannels: 1 },
        fastStart: 'in-memory',
      })

      // Video: ein einzelner H.264-Keyframe (statisches Cover)
      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => console.error('VideoEncoder:', e),
      })
      videoEncoder.configure({
        codec: 'avc1.42001f',
        width: W, height: H,
        bitrate: 800_000,
        framerate: 1,
      })
      const duration_us = Math.round(audioBuffer.duration * 1_000_000)
      const extra_us = 1_000_000 // 1s extra so cover stays visible after audio ends
      const bitmap = await createImageBitmap(canvas)
      // Single keyframe covering audio + 1s extra — no black flash
      const vframe = new VideoFrame(bitmap, { timestamp: 0, duration: duration_us + extra_us })
      videoEncoder.encode(vframe, { keyFrame: true })
      vframe.close()
      bitmap.close()
      await videoEncoder.flush()
      videoEncoder.close()

      // Audio: AAC mono — with 80ms fade-out to prevent pop
      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: e => console.error('AudioEncoder:', e),
      })
      audioEncoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: 1,
        bitrate: 128_000,
      })
      const CHUNK = 4096
      const rawCh = audioBuffer.getChannelData(0)
      const ch = new Float32Array(rawCh) // mutable copy
      const fadeOutSamples = Math.floor(audioBuffer.sampleRate * 0.08) // 80ms
      for (let i = Math.max(0, ch.length - fadeOutSamples); i < ch.length; i++) {
        ch[i] *= (ch.length - i) / fadeOutSamples
      }
      for (let i = 0; i < ch.length; i += CHUNK) {
        const count = Math.min(CHUNK, ch.length - i)
        const ts = Math.round((i / audioBuffer.sampleRate) * 1_000_000)
        const adata = new AudioData({
          format: 'f32',
          sampleRate: audioBuffer.sampleRate,
          numberOfFrames: count,
          numberOfChannels: 1,
          timestamp: ts,
          data: ch.slice(i, i + count),
        })
        audioEncoder.encode(adata)
        adata.close()
      }
      await audioEncoder.flush()
      audioEncoder.close()

      // MP4 finalisieren + Download
      muxer.finalize()
      const blob = new Blob([target.buffer], { type: 'video/mp4' })
      const safeName = personaName.replace(/[^a-zA-Z0-9_-]/g, '_')
      const ts = new Date(item.createdAt).toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${safeName}_${ts}.mp4`; a.click()
      URL.revokeObjectURL(url)
      setExportingIdx(null)
    } catch (e: any) {
      console.error('exportVideo:', e)
      setStatus('Video-Export fehlgeschlagen')
      setExportingIdx(null)
    }
  }

  function removeVoiceItem(i: number) {
    if (!active) return
    const items = [...(active.voiceItems || [])]
    items.splice(i, 1)
    updateActive({ voiceItems: items })
  }

  function updateVoiceSentNote(i: number, note: string) {
    if (!active) return
    const items = [...(active.voiceItems || [])]
    items[i] = { ...items[i], sentNote: note }
    updateActive({ voiceItems: items })
  }

  function formatDur(s: number) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
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
    } catch { setStatus('Fehler bei der Analyse') }
    finally { setAnalyzing(false); setTimeout(() => setStatus(''), 3000) }
  }

  async function generateSequence() {
    if (!active) return
    setGenerating(true); setEmails([]); setStatus('Generiert E-Mails...')
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: active, numEmails, extraInstruction, previousEmails: [] })
      })
      const data = await res.json()
      if (data.emails) setEmails(data.emails)
      setStatus('')
    } catch { setStatus('Fehler beim Generieren') }
    finally { setGenerating(false) }
  }

  async function addNextEmail() {
    if (!active) return
    setGenerating(true); setStatus('Nächste E-Mail wird generiert...')
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: active, numEmails: 1, extraInstruction, previousEmails: emails })
      })
      const data = await res.json()
      if (data.emails) setEmails(prev => [...prev, { ...data.emails[0], num: prev.length + 1 }])
      setStatus('')
    } catch { setStatus('Fehler') }
    finally { setGenerating(false) }
  }

  function copyEmail(i: number) {
    const e = emails[i]
    navigator.clipboard.writeText('Betreff: ' + e.subject + '\n\n' + e.body)
  }

  function openInMail(i: number) {
    const e = emails[i]
    window.location.href = 'mailto:' + (active?.email || '') + '?subject=' + encodeURIComponent(e.subject) + '&body=' + encodeURIComponent(e.body)
  }

  const css = {
    input: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '10px 14px', color: 'var(--text)', fontFamily: 'DM Mono, monospace', fontSize: 13 } as React.CSSProperties,
    textarea: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '10px 14px', color: 'var(--text)', fontFamily: 'DM Mono, monospace', fontSize: 13, resize: 'vertical' as const, minHeight: 80 } as React.CSSProperties,
    label: { display: 'block', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 6 } as React.CSSProperties,
    field: { marginBottom: 20 } as React.CSSProperties,
    sectionTitle: { fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 16, marginTop: 32, paddingBottom: 8, borderBottom: '1px solid var(--border)' } as React.CSSProperties,
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
          onClick={() => setTheme(t => t === 'pastel' ? 'dark' : t === 'dark' ? 'light' : 'pastel')}
          style={{ ...css.btnSmall, width: 'auto', padding: '6px 14px', fontSize: 16, marginLeft: 16 }}
          title="Theme wechseln">
          {theme === 'dark' ? '☀️' : theme === 'light' ? '🎊' : '🌙'}
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', minHeight: 'calc(100vh - 73px)' }}>
        <aside style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
            <button style={css.btn} onClick={() => setShowModal(true)}>+ Neue Persona</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {personas.length === 0 && (
              <div style={{ padding: 24, color: 'var(--muted)', fontSize: 11, textAlign: 'center', lineHeight: 1.8 }}>
                Noch keine Personas.<br />Klick auf &quot;+ Neue Persona&quot;.
              </div>
            )}
            {personas.map(p => {
              const pName = [p.firstname, p.lastname].filter(Boolean).join(' ') || p.name
              const contentCount = (p.contentItems || []).length + (p.imageItems || []).length
              return (
                <div key={p.id}
                  style={{ padding: '12px 16px', border: '1px solid ' + (p.id === activeId ? 'var(--accent)' : 'transparent'), borderRadius: 4, cursor: 'pointer', marginBottom: 4, background: p.id === activeId ? 'rgba(200,240,80,0.05)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  onClick={() => { setActiveId(p.id); setActiveTab('info'); setEmails([]) }}>
                  <div>
                    <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 15, fontStyle: 'italic' }}>{pName}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {p.gender ? p.gender + ' · ' : ''}{p.company || p.title || '–'} · {contentCount} Inhalte
                    </div>
                    {p.email && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{p.email}</div>}
                  </div>
                  <button onClick={e => deletePersona(p.id, e)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>
              )
            })}
          </div>
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column' }}>
          {!active ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--muted)' }}>
              <div style={{ fontSize: 40, opacity: 0.2 }}>◻</div>
              <div style={{ fontSize: 12 }}>Persona auswählen oder neu anlegen</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {([['info','Persona'], ['content','Box'], ['sprache','Sprache'], ['sequence','E-Mail Sequenz']] as const).map(([tab, label]) => (
                  <div key={tab}
                    style={{ padding: '16px 24px', cursor: 'pointer', color: activeTab === tab ? 'var(--accent)' : 'var(--muted)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '2px solid ' + (activeTab === tab ? 'var(--accent)' : 'transparent'), marginBottom: -1 }}
                    onClick={() => setActiveTab(tab)}>
                    {label}
                  </div>
                ))}
              </div>

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
                      <label style={css.label}>Mobilnummer</label>
                      <input style={css.input} type="tel" value={active.mobile || ''} onChange={e => updateActive({ mobile: e.target.value })} placeholder="+49 170 ..." />
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

                  <div style={css.sectionTitle}>LinkedIn</div>
                  <div style={css.field}>
                    <label style={css.label}>Profilbeschreibung (Headline)</label>
                    <input style={css.input} value={active.linkedinHeadline || ''} onChange={e => updateActive({ linkedinHeadline: e.target.value })} placeholder="z.B. CEO @ Acme | Scale-up Experte" />
                  </div>
                  <div style={css.field}>
                    <label style={css.label}>Info (About-Sektion)</label>
                    <textarea style={{ ...css.textarea, minHeight: 140 }} value={active.linkedinInfo || ''} onChange={e => updateActive({ linkedinInfo: e.target.value })} placeholder="Der vollständige LinkedIn Info-Text..." />
                  </div>

                  <div style={css.sectionTitle}>Sprache &amp; Stil</div>
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

              {activeTab === 'content' && (
                <div style={{ padding: '32px 40px', flex: 1, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ ...css.sectionTitle, marginTop: 0, marginBottom: 0, flex: 1 }}>Inhalte in die Box legen</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        disabled={saving}
                        style={{ ...css.btnSmall, width: 'auto', minWidth: 110, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={async () => {
                          if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                          pendingSaveRef.current = null
                          isSavingRef.current = false
                          await executeSave(active!)
                          await loadPersonas()
                        }}>
                        {saving ? <><span className="spinning">⟳</span> Speichert</> : '💾 Speichern'}
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

                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <input
                      style={{ ...css.input, flex: 1 }}
                      value={linkInput}
                      onChange={e => setLinkInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addLink()}
                      placeholder="🔗 LinkedIn-URL einfügen..." />
                    <button style={{ ...css.btnSmall, width: 'auto' }} onClick={addLink}>+</button>
                  </div>

                  {(active.contentItems || []).map((item, i) => {
                    const expanded = expandedItems.has(i)
                    const isLong = item.text.length > 200
                    return (
                      <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '10px 14px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', flexShrink: 0, marginTop: 3, width: 60 }}>{item.type}</div>
                          {item.type === 'LINK' ? (
                            <a href={item.text} target="_blank" rel="noopener noreferrer"
                              style={{ flex: 1, color: 'var(--accent)', textDecoration: 'underline', fontSize: 12, wordBreak: 'break-all' }}>
                              {item.text}
                            </a>
                          ) : (
                            <div style={{ flex: 1, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...(isLong && !expanded ? { maxHeight: 72, overflow: 'hidden' } : {}) }}>
                              {item.filename && <span style={{ color: 'var(--muted)', fontSize: 10, display: 'block', marginBottom: 4 }}>{item.filename}</span>}
                              {item.text}
                            </div>
                          )}
                          {item.type === 'DATEI' && (
                            <button onClick={() => setViewItem(item)} style={{ ...css.btnSmall, width: 'auto', fontSize: 10 }}>Anzeigen</button>
                          )}
                          {item.type === 'DATEI' && (
                            <button onClick={() => downloadItem(item)} style={{ ...css.btnSmall, width: 'auto', fontSize: 10 }}>Download</button>
                          )}
                          <button onClick={() => removeContent(i)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
                        </div>
                        {isLong && item.type !== 'LINK' && (
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

                  <div style={{ ...css.sectionTitle, marginTop: 32 }}>Bilder</div>
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    onDrop={handleImageDrop}
                    onDragOver={e => { e.preventDefault(); setImageDragOver(true) }}
                    onDragLeave={() => setImageDragOver(false)}
                    style={{ border: '1px dashed ' + (imageDragOver ? 'var(--accent)' : 'var(--border)'), borderRadius: 4, padding: 24, textAlign: 'center', color: imageDragOver ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', marginBottom: 16, background: imageDragOver ? 'rgba(200,240,80,0.04)' : 'transparent', transition: 'all 0.15s' }}>
                    ↓ Screenshot oder Bild ablegen (PNG, JPG, GIF)
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageFile} />

                  {(active.imageItems || []).length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
                      {(active.imageItems || []).map((img, i) => (
                        <div key={i} style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', aspectRatio: '4/3' }}>
                          <img src={img.data} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{img.name}</span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => { const a = document.createElement('a'); a.href = img.data; a.download = img.name; a.click() }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 12 }} title="Download">↓</button>
                              <button onClick={() => removeImage(i)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 14 }}>×</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'sprache' && (
                <div style={{ padding: '32px 40px', flex: 1, overflowY: 'auto' }}>
                  <div style={{ ...css.sectionTitle, marginTop: 0 }}>Sprachaufnahmen für {displayName}</div>

                  <button onClick={startRecording}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#1a56db', color: '#fff', border: 'none', borderRadius: 4, padding: '12px 24px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, letterSpacing: '0.05em', marginBottom: 32 }}>
                    <span style={{ fontSize: 18 }}>🎙</span> Neue Aufnahme starten
                  </button>

                  {(active.voiceItems || []).length === 0 && (
                    <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.9 }}>
                      Noch keine Aufnahmen.<br />
                      Starte eine Aufnahme und exportiere sie als 1080×1080 Video für LinkedIn.
                    </div>
                  )}

                  {(active.voiceItems || []).map((item, i) => (
                    <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>Aufnahme {i + 1}</span>
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{formatDur(item.duration)}</span>
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                            {new Date(item.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            onClick={() => exportVideo(item, i)}
                            disabled={exportingIdx === i}
                            style={{ ...css.btnSmall, minWidth: 120, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {exportingIdx === i ? <><span className="spinning">⟳</span> Exportiert...</> : '↓ Als Video'}
                          </button>
                          <button onClick={() => removeVoiceItem(i)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                        </div>
                      </div>

                      <audio src={item.audioData} controls style={{ width: '100%', marginBottom: 12, height: 36 }} />

                      <div>
                        <label style={css.label}>Versand-Notiz</label>
                        <input
                          style={css.input}
                          value={item.sentNote || ''}
                          onChange={e => updateVoiceSentNote(i, e.target.value)}
                          placeholder="z.B. Über LinkedIn verschickt am 05.06.2026..." />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'sequence' && (
                <div style={{ padding: '32px 40px', flex: 1, overflowY: 'auto' }}>
                  <div style={{ ...css.sectionTitle, marginTop: 0 }}>E-Mail Sequenz für {displayName}</div>
                  {active.email && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20, marginTop: -8 }}>→ {active.email}</div>
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
                          {active.email && <button style={css.btnSmall} onClick={() => openInMail(i)}>↗ Öffnen</button>}
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
              const mdSrc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script><style>html,body{margin:0;padding:0;background:#0e0e0e;color:#e8e8e0}body{display:flex;justify-content:center;padding:48px 24px 80px}#c{width:100%;max-width:680px;font-family:Georgia,serif;line-height:1.85;font-size:16px}h1,h2,h3{font-weight:600;margin-top:1.6em;margin-bottom:.4em;color:#fff}p{margin:.9em 0}code{background:#222;padding:2px 6px;border-radius:3px;font-size:.88em;color:#c8f050}pre{background:#161616;border:1px solid #2a2a2a;padding:16px;border-radius:6px;overflow-x:auto}blockquote{border-left:3px solid #c8f050;margin:0;padding:0 16px;color:#aaa}a{color:#c8f050}</style></head><body><div id="c"></div><script>document.getElementById(\'c\').innerHTML=marked.parse(' + JSON.stringify(viewItem.text) + ')<\/script></body></html>'
              if (isHtml) return <iframe srcDoc={viewItem.text} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} sandbox="allow-scripts allow-same-origin allow-forms" title={viewItem.filename} />
              if (isMd) return <iframe srcDoc={mdSrc} style={{ width: '100%', height: '100%', border: 'none', background: '#0e0e0e' }} sandbox="allow-scripts" title={viewItem.filename} />
              return <pre style={{ margin: 0, padding: 24, color: 'var(--text)', fontFamily: 'DM Mono, monospace', fontSize: 12, lineHeight: 1.7, overflowY: 'auto', height: '100%', boxSizing: 'border-box', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{viewItem.text}</pre>
            })()}
          </div>
        </div>
      )}

      {isRecording && active && (
        <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 38% 44%, #0d1f4e 0%, #04091a 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 76, fontStyle: 'italic', color: '#ffffff', marginBottom: 20, textAlign: 'center', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            {displayName}
          </div>
          {(active.title || active.company) && (
            <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, marginBottom: 72, letterSpacing: '0.28em', textTransform: 'uppercase' as const, fontFamily: 'DM Mono, monospace' }}>
              {[active.title, active.company].filter(Boolean).join('  \u00b7  ')}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 72 }}>
            <span className="blink" style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff3b30', display: 'inline-block' }} />
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 34, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.06em', fontWeight: 300 }}>
              {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:{String(recordingTime % 60).padStart(2, '0')}
            </span>
          </div>
          <button onClick={stopRecording} style={{ background: 'rgba(255,255,255,0.92)', color: '#04091a', border: 'none', padding: '13px 52px', borderRadius: 50, fontSize: 11, fontFamily: 'DM Mono, monospace', cursor: 'pointer', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' as const }}>
            Stopp
          </button>
        </div>
      )}

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
