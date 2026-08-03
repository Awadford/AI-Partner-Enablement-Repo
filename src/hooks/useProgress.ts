import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { LmsUserProgress, ProgressStatus } from '../types'

export function useProgress(userId: string | null) {
  const [progress, setProgress] = useState<Record<string, LmsUserProgress>>({})
  const [loading, setLoading] = useState(false)

  const fetchProgress = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('lms_user_progress')
      .select('*')
      .eq('user_id', userId)

    if (!error && data) {
      const map: Record<string, LmsUserProgress> = {}
      for (const row of data as LmsUserProgress[]) {
        map[row.module_id] = row
      }
      setProgress(map)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  const markComplete = async (moduleId: string): Promise<boolean> => {
    if (!userId) return false

    const now = new Date().toISOString()
    const existing = progress[moduleId]

    const upsertData = {
      user_id: userId,
      module_id: moduleId,
      status: 'completed' as ProgressStatus,
      started_at: existing?.started_at ?? now,
      completed_at: now,
      updated_at: now,
    }

    const { data, error } = await supabase
      .from('lms_user_progress')
      .upsert(upsertData, { onConflict: 'user_id,module_id' })
      .select()
      .single()

    if (error) {
      console.error('Error marking complete:', error)
      return false
    }

    setProgress(prev => ({ ...prev, [moduleId]: data as LmsUserProgress }))
    return true
  }

  const markInProgress = async (moduleId: string): Promise<void> => {
    if (!userId) return
    const existing = progress[moduleId]
    if (existing?.status === 'completed') return

    const now = new Date().toISOString()
    const upsertData = {
      user_id: userId,
      module_id: moduleId,
      status: 'in_progress' as ProgressStatus,
      started_at: existing?.started_at ?? now,
      completed_at: null,
      updated_at: now,
    }

    const { data, error } = await supabase
      .from('lms_user_progress')
      .upsert(upsertData, { onConflict: 'user_id,module_id' })
      .select()
      .single()

    if (!error && data) {
      setProgress(prev => ({ ...prev, [moduleId]: data as LmsUserProgress }))
    }
  }

  return { progress, loading, markComplete, markInProgress, refetch: fetchProgress }
}
