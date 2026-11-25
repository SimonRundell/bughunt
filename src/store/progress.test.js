import { beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEY, createEmptyProgress, exportProgress, importProgress, loadProgress, recordSolve, saveProgress } from './progress'

describe('progress integrity check', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a save/load with no tampering', () => {
    const progress = recordSolve(createEmptyProgress(), { slug: 'a', trackSlug: 't', bugType: 'logic', xpAwarded: 10 })
    saveProgress(progress)
    const loaded = loadProgress()
    expect(loaded.xp).toBe(10)
    expect(loaded.puzzles.a.solvedAt).not.toBeNull()
  })

  it('resets to empty when the saved XP is hand-edited without updating the signature', () => {
    const progress = recordSolve(createEmptyProgress(), { slug: 'a', trackSlug: 't', bugType: 'logic', xpAwarded: 10 })
    saveProgress(progress)

    const tampered = JSON.parse(localStorage.getItem(STORAGE_KEY))
    tampered.xp = 999999
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tampered))

    const loaded = loadProgress()
    expect(loaded.xp).toBe(0) // reset, not 999999
  })

  it('accepts a pre-existing save with no _sig at all (from before this check existed)', () => {
    const legacy = { ...createEmptyProgress(), xp: 42 }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

    const loaded = loadProgress()
    expect(loaded.xp).toBe(42)
  })

  it('does not require a matching signature to re-import an exported file on a different browser', () => {
    const progress = recordSolve(createEmptyProgress(), { slug: 'a', trackSlug: 't', bugType: 'logic', xpAwarded: 10 })
    const exported = exportProgress(progress)

    localStorage.clear() // simulate "a different browser" with no prior state
    const result = importProgress(exported)
    expect(result.ok).toBe(true)
    expect(result.progress.xp).toBe(10)
  })

  it('is insensitive to the insertion order of progress.puzzles keys', () => {
    let progress = createEmptyProgress()
    progress = recordSolve(progress, { slug: 'a', trackSlug: 't', bugType: 'logic', xpAwarded: 5 })
    progress = recordSolve(progress, { slug: 'b', trackSlug: 't', bugType: 'logic', xpAwarded: 5 })
    saveProgress(progress)

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    const reordered = { ...saved, puzzles: { b: saved.puzzles.b, a: saved.puzzles.a } }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reordered))

    const loaded = loadProgress()
    expect(loaded.xp).toBe(10) // still accepted, not reset
  })
})
