import { useEffect } from 'react'
import { addAuto, type DiaryKind } from '../domain/tripDiary'
import { newMemoryId, useMemory } from './useMemory'

/** Writes one line in the Trip Diary when something happens, once per sailing and key (a line the guest removed is not written again). */
export function useDiaryLine(sailingId: string | null | undefined, kind: DiaryKind, key: string, text: string, enabled = true): void {
  const { update } = useMemory()
  useEffect(() => {
    if (!enabled || !sailingId) return
    update((s) => {
      const diary = addAuto(s.diary, { id: newMemoryId(), sailingId, day: 0, at: Date.now(), kind, text, key })
      return diary === s.diary ? s : { ...s, diary }
    })
  }, [enabled, sailingId, kind, key, text, update])
}
