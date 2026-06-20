import { useApi } from './api'

export interface TeacherAvatar {
  id: number
  teacher_id: number
  display_name?: string | null
  photo_url?: string | null
  voice_sample_url?: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string | null
  voice_clone_warning?: string | null
  reviewed_at?: string | null
  created_at: string
}

export interface AvatarLectureSlide {
  id: number
  slide_index: number
  slide_image_url?: string | null
  narration_text?: string | null
  audio_url?: string | null
  audio_duration_seconds?: number | null
}

export interface AvatarLecture {
  id: number
  avatar_id: number
  class_id: number
  created_by: number
  title: string
  source_filename?: string | null
  duration_minutes: number
  style: 'school' | 'university' | 'professional'
  auto_summary: boolean
  status: 'pending_approval' | 'approved' | 'generating' | 'ready' | 'rejected' | 'failed'
  rejection_reason?: string | null
  error_message?: string | null
  summary_text?: string | null
  intro_video_url?: string | null
  estimated_chars: number
  estimated_cost_usd: number
  created_at: string
  updated_at?: string | null
}

export interface AvatarLectureFull extends AvatarLecture {
  slides: AvatarLectureSlide[]
}

export const useAvatarsSvc = () => {
  const api = useApi()

  return {
    // ── Аватар учителя ──────────────────────────────────────────
    getMine: async (): Promise<TeacherAvatar | null> => {
      const { data } = await api.get('/avatars/me')
      return data
    },

    create: async (body: { display_name?: string; photo_url: string; voice_sample_url: string }): Promise<TeacherAvatar> => {
      const { data } = await api.post('/avatars/me', body)
      return data
    },

    // ── Лекции ───────────────────────────────────────────────────
    createLecture: async (body: {
      class_id: number
      title: string
      source_file_url: string
      source_filename?: string
      duration_minutes: number
      style: string
      auto_summary: boolean
    }): Promise<AvatarLectureFull> => {
      const { data } = await api.post('/avatars/lectures', body)
      return data
    },

    myLectures: async (): Promise<AvatarLecture[]> => {
      const { data } = await api.get('/avatars/lectures/mine')
      return data
    },

    classLectures: async (classId: number): Promise<AvatarLecture[]> => {
      const { data } = await api.get(`/avatars/lectures/class/${classId}`)
      return data
    },

    getLectureFull: async (id: number): Promise<AvatarLectureFull> => {
      const { data } = await api.get(`/avatars/lectures/${id}/full`)
      return data
    },

    deleteLecture: async (id: number): Promise<void> => {
      await api.delete(`/avatars/lectures/${id}`)
    },

    // ── Админ-модерация ──────────────────────────────────────────
    adminListAvatars: async (status?: string): Promise<TeacherAvatar[]> => {
      const { data } = await api.get('/admin/avatars', { params: status ? { status } : {} })
      return data
    },

    adminReviewAvatar: async (id: number, approve: boolean, rejection_reason?: string): Promise<TeacherAvatar> => {
      const { data } = await api.post(`/admin/avatars/${id}/review`, { approve, rejection_reason })
      return data
    },

    adminDeleteAvatar: async (id: number): Promise<void> => {
      await api.delete(`/admin/avatars/${id}`)
    },

    adminListLectures: async (status?: string): Promise<AvatarLecture[]> => {
      const { data } = await api.get('/admin/avatar-lectures', { params: status ? { status } : {} })
      return data
    },

    adminReviewLecture: async (id: number, approve: boolean, rejection_reason?: string): Promise<AvatarLecture> => {
      const { data } = await api.post(`/admin/avatar-lectures/${id}/review`, { approve, rejection_reason })
      return data
    },
  }
}
