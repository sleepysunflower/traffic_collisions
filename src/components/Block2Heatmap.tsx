import React, { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { parquetQuery } from '../lib/duck'
import { PARQUET } from '../config'
import { useFilters } from '../store/filters'

type Row = { dow: string; col: number; value: number }

const qstr = (arr?: (string|number)[]) =>
  !arr || arr.length===0 ? '' : arr.map(v => typeof v==='number' ? v : `'${String(v)}'`).join(',')

const DOW_LABEL = (v:any)=> {
  const m = String(v)
  // if JR_SEMN_ACCDN is numeric 1..7 or 0..6, normalize to labels
  const n = Number(m)
  if (!Number.isNaN(n)) {
    // adapt to your coding; adjust if needed
    const names = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    // try 1..7 first
    if (n>=1 && n<=7) return names[(n-1)%7]
    // else 0..6
    if (n>=0 && n<=6) return names[n]
  }
  return m
}

export default function Block2Heatmap(){
  const { filters } = useFilters()
  const [mode, setMode] = useState<'hour'|'month'>('hour')
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string|null>(null)

  const where = useMemo(()=>{
    const w: string[] = []
    if (filters.years?.length)      w.push(`AN IN (${qstr(filters.years)})`)
    if (filters.severities?.length) w.push(`GRAVITE IN (${qstr(filters.severities)})`)
    if (filters.quartiers?.length)  w.push(`no_qr IN (${qstr(filters.quartiers)})`)
    if (filters.arrs?.length)       w.push(`no_arr IN (${qstr(filters.arrs)})`)
    return w.length? 'WHERE '+w.join(' AND ') : ''
  },[filters])

  useEffect(()=>{
    let cancelled = false
    async function run(){
      setErr(null)
      const colExpr = mode==='hour' ? 'hour' : 'month'
      const notNull = mode==='hour' ? 'hour IS NOT NULL' : 'month IS NOT NULL'
      try {
        const r = await parquetQuery<Row>(`
          SELECT JR_SEMN_ACCDN AS dow,
                 ${colExpr} AS col,
                 CAST(COUNT(*) AS INT) AS value
          FROM read_parquet('${PARQUET.incidentVars}')
          ${where}
          ${where ? 'AND' : 'WHERE'} ${notNull}
          GROUP BY dow, col
          ORDER BY dow, col
        `)
        if (!cancelled) setRows(r)
      } catch (e:any) {
        setErr(e?.message || String(e))
        if (!cancelled) setRows([])
      }
      ;(window as any).__DBG_HEAT = {
        mode, where,
        count: rows.length,
        sample: rows.slice(0,5),
        error: err
      }
    }
    run()
    return ()=>{ cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[mode, where])

  const xs = useMemo(()=> Array.from(new Set(rows.map(r=>Number(r.col)))).sort((a,b)=>a-b), [rows])
  const ysRaw = useMemo(()=> Array.from(new Set(rows.map(r=>r.dow))), [rows])
  const ys = useMemo(()=> ysRaw.map(DOW_LABEL), [ysRaw])
  const z = useMemo(()=> rows.map(r=>[xs.indexOf(Number(r.col)), ys.indexOf(DOW_LABEL(r.dow)), r.value]), [rows, xs, ys])

  const option = useMemo(() => ({
    tooltip: { position: 'top', formatter: (p:any)=> `${ys[p.value[1]]} × ${xs[p.value[0]]}: ${p.value[2]}` },

    // ⬇️ Give the plot more bottom margin so the mini-bar has breathing room
    grid: { left: 60, right: 20, top: 40, bottom: 64, containLabel: true },

    xAxis: { type: 'category', data: xs, name: mode==='hour'?'Hour':'Month', nameGap: 10 },
    yAxis: { type: 'category', data: ys, name: 'Day of week', nameGap: 10 },

    // ⬇️ Lift the mini-bar off the bottom and brighten its text
    visualMap: {
      min: 0,
      max: Math.max(1, ...rows.map(r=>r.value)),
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 8,                           // was 0
      textStyle: { color: '#EDEDED' }      // brighter numbers
    },

    series: rows.length ? [{
      type: 'heatmap',
      data: z,
      progressive: 0,
      emphasis: { itemStyle: { borderColor: '#333' } }
    }] : []
  }), [xs, ys, z, rows, mode])

  return (
    <div className="card">
      <div className="card-body">
        <div style={{display:'flex', gap:8, marginBottom:8}}>
          <label><input type="radio" checked={mode==='hour'} onChange={()=>setMode('hour')} /> DoW × Hour</label>
          <label><input type="radio" checked={mode==='month'} onChange={()=>setMode('month')} /> DoW × Month</label>
        </div>
        {err && <div style={{color:'#b71c1c', marginBottom:8}}>Heatmap error: {String(err)}</div>}
        <ReactECharts
          option={option}
          theme="noir"
          style={{ width:'100%', height: 400 }}
          notMerge={true}
          opts={{ renderer:'canvas' }}
        />
      </div>
    </div>
  )
}
