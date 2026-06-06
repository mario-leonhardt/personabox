export interface ContentItem {
  text: string
  type: string
  addedAt: string
}

export interface ImageItem {
  data: string      // base64 data URL (compressed JPEG)
  name: string
  addedAt: string
}

export interface VoiceItem {
  audioData: string  // base64 data URL (audio/webm)
  duration: number   // seconds
  createdAt: string
  sentNote?: string  // z.B. "LinkedIn 05.06.26"
}

export interface Persona {
  id: string
  firstname: string
  lastname: string
  name: string
  gender: string
  email: string
  mobile: string
  title: string
  company: string
  industry: string
  location: string
  birthday: string
  language: 'formal' | 'informal'
  goal: string
  privateGoal: string
  product: string
  keywords: string[]
  linkedinHeadline: string
  linkedinInfo: string
  contentItems: ContentItem[]
  imageItems: ImageItem[]
  voiceItems: VoiceItem[]
  analysis?: string
  created_at?: string
}
