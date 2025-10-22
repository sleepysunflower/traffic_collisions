import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFilters } from '../store/filters'
import { parquetQuery } from '../lib/duck'
import { PARQUET } from '../config'

type Cnt = { n: number }
type Val = { v: string }

function SafePre({ value }: { value: any }) {
  let txt = ''
  try { txt = JSON.stringify(value, null, 2) } catch { txt = String(value) }
  return (
    <pre style={{ background:'#f6f6f6', padding:8, borderRadius:6, maxHeight:200, overflow:'auto', margin:0 }}>
      {txt}
    </pre>
  )
}

export default function DebugPanel() {
  const { filters } = useFilters()
  const [tot, setTot] = useState<number | null>(null)
  const [match, setMatch] = useState<number | null>(null)
  const [distinctDow, setDistinctDow] = useState<string[]>([])
  const [distinctSev, setDistinctSev] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [ts, setTs] = useState<string>('—')
  const prevFiltersRef = useRef<any>(null)
  const [diff, setDiff] = useState<Record<string, { before: any; after: any }>>({})

  // Build WHERE exactly as the blocks should
  const where = useMemo(() => {
    const w: string[] = []
    if (filters?.years?.length) w.push(`AN IN (${filters.years.join(',')})`)
    if (filters?.quarters?.length) w.push(`quarter IN (${filters.quarters.join(',')})`)
    if (filters?.months?.length) w.push(`month IN (${filters.months.join(',')})`)
    if (filters?.dows?.length) {
      const q = filters.dows.map(d => `'${String(d).replace(/'/g, "''")}'`).join(',')
      w.push(`JR_SEMN_ACCDN IN (${q})`)
    }
    if (filters?.severities?.length) {
      const q = filters.severities.map(s => `'${String(s).replace(/'/g, "''")}'`).join(',')
      w.push(`GRAVITE IN (${q})`)
    }
    if (filters?.quartiers?.length) w.push(`no_qr IN (${filters.quartiers.join(',')})`)
    if (filters?.arrs?.length) w.push(`no_arr IN (${filters.arrs.join(',')})`)
    return w.length ? `WHERE ${w.join(' AND ')}` : ''
  }, [filters])

  // Live expose for quick console peek
  useEffect(() => {
    ;(window as any).__DBG_FILTERS = {
      filters_snapshot: JSON.parse(JSON.stringify(filters || {})),
      where,
    }
  }, [filters, where])

  // Track diffs so we can see if TopBar actually updates the store
  useEffect(() => {
    const prev = prevFiltersRef.current
    const cur = filters || {}
    const d: Record<string, { before: any; after: any }> = {}
    const keys = Array.from(new Set([...(prev ? Object.keys(prev) : []), ...Object.keys(cur)]))
    keys.forEach(k => {
      const a = prev?.[k]
      const b = (cur as any)[k]
      const aStr = JSON.stringify(a)
      const bStr = JSON.stringify(b)
      if (aStr !== bStr) d[k] = { before: a, after: b }
    })
    setDiff(d)
    prevFiltersRef.current = JSON.parse(JSON.stringify(cur))
  }, [filters])

  const run = async () => {
    setErr(null)
    try {
      const [{ n: total }] = await parquetQuery<Cnt>(`
        SELECT COUNT(*) AS n FROM read_parquet('${PARQUET.incidentVars}')
      `)
      setTot(total)

      const [{ n: matched }] = await parquetQuery<Cnt>(`
        SELECT COUNT(*) AS n FROM read_parquet('${PARQUET.incidentVars}') ${where}
      `)
      setMatch(matched)

      const dows = await parquetQuery<Val>(`
        SELECT DISTINCT CAST(JR_SEMN_ACCDN AS VARCHAR) AS v
        FROM read_parquet('${PARQUET.incidentVars}')
        WHERE JR_SEMN_ACCDN IS NOT NULL
        ORDER BY v
      `)
      setDistinctDow(dows.map(r => r.v))

      const sevs = await parquetQuery<Val>(`
        SELECT DISTINCT CAST(GRAVITE AS VARCHAR) AS v
        FROM read_parquet('${PARQUET.incidentVars}')
        WHERE GRAVITE IS NOT NULL
        ORDER BY v
      `)
      setDistinctSev(sevs.map(r => r.v))

      setTs(new Date().toLocaleString())
    } catch (e: any) {
      setErr(String(e?.message || e))
    }
  }

  return (
    <div className="card" style={{ margin: 12 }}>
      <div className="card-body">
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <h3 style={{ margin:0 }}>Debug Panel</h3>
          <button onClick={run}>Run diagnostics</button>
          <span style={{ color:'#666' }}>Last run: {ts}</span>
          {err && <span style={{ color:'#b71c1c' }}>Error: {err}</span>}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <div style={{ fontWeight:600, marginBottom:4 }}>Current filters (live)</div>
            <SafePre value={filters} />
          </div>
          <div>
            <div style={{ fontWeight:600, marginBottom:4 }}>Computed WHERE</div>
            <SafePre value={where || '(no filters)'} />
          </div>
        </div>

        <div style={{ marginTop:12 }}>
          <div style={{ fontWeight:600, marginBottom:4 }}>Store change diff (TopBar → Zustand)</div>
          <SafePre value={diff} />
          <div style={{ color:'#666', marginTop:6, fontSize:12 }}>
            If this stays empty while you click checkboxes, your TopBar isn’t calling <code>setFilters</code> or the store ignores updates.
          </div>
        </div>

        <div style={{ display:'flex', gap:24, marginTop:12, flexWrap:'wrap' }}>
          <div><b>Total rows</b><div>{tot ?? '—'}</div></div>
          <div><b>Rows matching filters</b><div>{match ?? '—'}</div></div>
          <div>
            <b>Distinct JR_SEMN_ACCDN</b>
            <div style={{ fontSize:13 }}>{distinctDow.join(', ') || '—'}</div>
          </div>
          <div>
            <b>Distinct GRAVITE</b>
            <div style={{ fontSize:13 }}>{distinctSev.join(' · ') || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
