export interface Partner {
  id: string
  name: string
  enbl_stage: 'pre' | 'active' | 'post'
  category_type: string | null
  pdm: string | null
  notes: string | null
}

export interface LmsPartnerDomain {
  id: string
  partner_id: string
  domain: string
  created_at: string
}

export interface ModuleDoc {
  title: string
  url: string
}

export interface ModuleRecording {
  title: string
  url: string
}

export interface ModuleScenario {
  title: string
  description: string
}

export interface ModuleContent {
  synopsis?: string
  why_it_matters?: string
  video_url?: string | null
  docs?: ModuleDoc[]
  scenario?: ModuleScenario
  recordings?: ModuleRecording[]
  exec_prompt?: string
  exec_url?: string | null   // iframe URL for an embedded exec.com session
}

export interface LmsModule {
  id: string
  slug: string
  title: string
  description: string
  category: 'delivery' | 'product' | 'services'
  default_order: number
  content: ModuleContent
  created_at: string
  updated_at: string
}

export interface LmsPartnerModule {
  id: string
  partner_id: string
  module_id: string
  enabled: boolean
  order_index: number
  created_at: string
}

export interface LmsProfile {
  id: string
  email: string
  full_name: string | null
  partner_id: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed'

export interface LmsUserProgress {
  id: string
  user_id: string
  module_id: string
  status: ProgressStatus
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// Composed types for UI
export interface ModuleWithProgress extends LmsModule {
  order_index: number
  enabled: boolean
  status: ProgressStatus
  locked: boolean
}

export interface LearnerWithProgress {
  id: string
  email: string
  full_name: string | null
  completed_count: number
  total_count: number
}
