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

export interface Persona {
  id: string
  firstname: string
  lastname: string
  name: string
  gender: string
  email: string
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
  contentItems: ContentItem[]
  imageItems: ImageItem[]
  analysis?: string
  created_at?: string
}
