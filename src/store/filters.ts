// src/store/filters.ts
import { create } from 'zustand'

export type Filters = {
  years?: number[]
  quarters?: number[]
  months?: number[]
  dows?: string[]
  severities?: string[]
  quartiers?: number[]
  arrs?: number[]
}

type Store = {
  filters: Filters
  setFilters: (patch: Partial<Filters>) => void
  clearKey: (key: keyof Filters) => void
  clearAll: () => void
}

function normalize(patch: Partial<Filters>): Partial<Filters> {
  const out: Partial<Filters> = {}
  ;(Object.keys(patch) as (keyof Filters)[]).forEach((k) => {
    const v = patch[k] as any
    // treat null as undefined
    if (v === null || v === undefined) { out[k] = undefined; return }
    // keep only non-empty arrays
    if (Array.isArray(v)) out[k] = v.length ? v.slice() : undefined
    else out[k] = v
  })
  return out
}

export const useFilters = create<Store>((set, get) => ({
  filters: {
    years: undefined,
    quarters: undefined,
    months: undefined,
    dows: undefined,
    severities: undefined,
    quartiers: undefined,
    arrs: undefined,
  },
  setFilters: (patch) =>
    set((s) => ({
      filters: { ...s.filters, ...normalize(patch) },
    })),
  clearKey: (key) =>
    set((s) => ({
      filters: { ...s.filters, [key]: undefined },
    })),
  clearAll: () => set({ filters: {} }),
}))
