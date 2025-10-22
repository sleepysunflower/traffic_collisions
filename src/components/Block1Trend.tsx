import React, { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { parquetQuery } from '../lib/duck'
import { useFilters } from '../store/filters'
import { PARQUET } from '../config'

const qstr = (arr?: (string|number)[]) =>
  !arr || arr.length===0 ? '' : arr.map(v => typeof v==='number' ? v : `'${String(v)}'`).join(',')

type Pt = { t: string; n: number }
type Series = { label: string; data: [string|number, number][] }

export default function Block1Trend(){
  const { filters } = useFilters()
  const [series, setSeries] = useState<Series[]>([])
  const [meta, setMeta] = useState<{mode:'daily'|'monthly'; dailyCol?:string}>({mode:'monthly'})

  const where = useMemo(()=>{
    const w: string[] = []
    if (filters.years?.length)    w.push(`AN IN (${qstr(filters.years)})`)
    if (filters.months?.length)   w.push(`month IN (${qstr(filters.months)})`)
    if (filters.quarters?.length) w.push(`quarter IN (${qstr(filters.quarters)})`)
    if (filters.dows?.length)     w.push(`CAST(JR_SEMN_ACCDN AS VARCHAR) IN (${qstr(filters.dows)})`)
    if (filters.severities?.length) w.push(`GRAVITE IN (${qstr(filters.severities)})`)
    if (filters.quartiers?.length)  w.push(`no_qr IN (${qstr(filters.quartiers)})`)
    if (filters.arrs?.length)       w.push(`no_arr IN (${qstr(filters.arrs)})`)
    return w.length? 'WHERE '+w.join(' AND ') : ''
  },[filters])

  useEffect(()=>{
    let cancelled = false
    async function run(){
      // Try real daily first
      const candidates = ['date','DATE','dt_accdn','DT_ACCDN']
      let usedCol: string | undefined
      let daily: Pt[] | null = null
      for (const col of candidates) {
        try {
          const test = await parquetQuery<{d:string; n:number}>(`
            SELECT CAST(${col} AS DATE) AS d, COUNT(*)::INT AS n
            FROM read_parquet('${PARQUET.incidentVars}')
            ${where}
            GROUP BY d
            ORDER BY d
          `)
          if (test && test.length) {
            daily = test.map(r => ({ t: r.d, n: r.n }))
            usedCol = col
            break
          }
        } catch { /* next */ }
      }

      if (!daily) {
        // monthly totals (proxy) + rolling avg (3m, 12m)
        const mo = await parquetQuery<{y:number; m:number; n:number}>(`
          SELECT AN AS y, month AS m, COUNT(*)::INT AS n
          FROM read_parquet('${PARQUET.incidentVars}')
          ${where}
          GROUP BY y, m
          ORDER BY y, m
        `)
        const monthly = mo.map(r => ({ t: `${r.y}-${String(r.m).padStart(2,'0')}-01`, n: r.n }))
        const ma3  = rolling(monthly, 3)
        const ma12 = rolling(monthly, 12)
        if (!cancelled) {
          setSeries([
            { label: 'Monthly total (proxy for Daily)', data: monthly.map(p=>[p.t, p.n]) },
            { label: 'Monthly avg (3m)', data: ma3.map(p=>[p.t, p.n]) },
            { label: 'Yearly avg (12m)', data: ma12.map(p=>[p.t, p.n]) },
          ])
          setMeta({mode:'monthly'})
          ;(window as any).__DBG_TREND = { mode:'monthly', count: monthly.length, first: monthly[0], last: monthly.at(-1) }
        }
        return
      }

      // true daily + rolling (~30d, ~365d)
      const ma30  = rolling(daily, 30)
      const ma365 = rolling(daily, 365)
      if (!cancelled) {
        setSeries([
          { label: 'Daily', data: daily.map(p=>[p.t, p.n]) },
          { label: 'Monthly avg (~30d)', data: ma30.map(p=>[p.t, p.n]) },
          { label: 'Yearly avg (~365d)', data: ma365.map(p=>[p.t, p.n]) },
        ])
        setMeta({mode:'daily', dailyCol: usedCol})
        ;(window as any).__DBG_TREND = { mode:'daily', dailyCol: usedCol, count: daily.length, first: daily[0], last: daily.at(-1) }
      }
    }
    run()
    return ()=>{ cancelled = true }
  },[where])

  const option = useMemo(()=>({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: series.map(s=>s.label) },
    grid: { left: 50, right: 20, top: 40, bottom: 50, containLabel: true },
    xAxis: {
      type: 'time',
      axisLabel: { formatter: (val:any) => new Date(val).toISOString().slice(0,10) }
    },
    yAxis: { type: 'value' },
    series: series.map(s => ({
      name: s.label,
      type: 'line',
      showSymbol: false,
      data: s.data
    }))
  }), [series])

  return (
    <div className="card">
      <div className="card-body">
        <ReactECharts
          option={option}
          theme="noir"
          style={{ width:'100%', height: 440 }}
          notMerge={true}
          opts={{ renderer:'canvas' }}
        />
      </div>
    </div>
  )
}

function rolling(xs: Pt[], windowSize: number): Pt[] {
  const out: Pt[] = []
  let sum = 0
  const q: number[] = []
  xs.forEach((p) => {
    q.push(p.n); sum += p.n
    if (q.length > windowSize) sum -= q.shift()!
    const avg = Math.round(sum / q.length)
    out.push({ t: p.t, n: avg })
  })
  return out
}
