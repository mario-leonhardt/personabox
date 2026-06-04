export interface ContentItem {
  text: string
  type: string
  addedAt: string
}

export interface Persona {
  id: string
  firstname: string
  lastname: string
  name: string // computed: firstname + lastname
  gender: string
  title: string
  company: string
  industry: string
  location: string
  birthday: string
  language: 'formal' | 'informal'
  goal: string // berufliche Ziele
  privateGoal: string // private Ziele
  product: string
  keywords: string[]
  contentItems: ContentItem[]
  analysis?: string
  created_at?: string
}
