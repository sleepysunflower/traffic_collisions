import { create } from 'zustand'

export type Filters = {
  years: number[] | null
  quarters: number[] | null
  months: number[] | null
  dows: (number|string)[] | null
  severities: string[] | null
  quartiers: (string|number)[] | null
  arrs: (string|number)[] | null
}

export const useFilters = create<{
  filters: Filters,
  set: (patch: Partial<Filters>) => void,
  reset: () => void
}>(set => ({
  filters: {
    years: null, quarters: null, months: null, dows: null,
    severities: null, quartiers: null, arrs: null
  },
  set: (patch) => set(s => ({ filters: { ...s.filters, ...patch } })),
  reset: () => set({
    filters: { years:null, quarters:null, months:null, dows:null, severities:null, quartiers:null, arrs:null }
  })
}))
