import React, { useMemo, useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { parquetQuery } from '../lib/duck'
import { PARQUET } from '../config'
import { useFilters } from '../store/filters'

export default function Block2Heatmap(){
  const { filters } = useFilters()
  const [mode, setMode] = useState<'dow-hour'|'dow-month'>('dow-hour')
  const [rows, setRows] = useState<any[]>([])

  const where = useMemo(()=>{
    const w: string[] = []
    if (filters.years) w.push(`AN IN (${filters.years.join(',')})`)
    if (filters.severities) w.push(`GRAVITE IN (${filters.severities.map(s=>`'${s}'`).join(',')})`)
    if (filters.quartiers) w.push(`no_qr IN (${filters.quartiers.map(s=>`'${s}'`).join(',')})`)
    if (filters.arrs) w.push(`no_arr IN (${filters.arrs.map(s=>`'${s}'`).join(',')})`)
    return w.length? 'WHERE '+w.join(' AND ') : ''
  },[filters])

  useEffect(()=>{
    const table = mode==='dow-hour' ? PARQUET.matrixDowHour : PARQUET.matrixDowMonth
    const xcol = mode==='dow-hour' ? 'hour' : 'month'
    const sql = `
      WITH base AS (
        SELECT AN, JR_SEMN_ACCDN AS dow, ${xcol} AS x, GRAVITE, no_qr, no_arr, count
        FROM read_parquet('${table}')
        ${where}
      )
      SELECT dow, x, SUM(count) AS cnt
      FROM base
      GROUP BY dow, x
      ORDER BY dow, x
    `
    parquetQuery<any>(sql).then(setRows)
  },[mode, where])

  const xs = [...new Set(rows.map(r=>r.x))].sort((a,b)=>a-b)
  const ys = [...new Set(rows.map(r=>r.dow))]
  const data = rows.map(r=>[xs.indexOf(r.x), ys.indexOf(r.dow), r.cnt])

  const option = {
    tooltip: { position:'top' },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: { type:'category', data: xs },
    yAxis: { type:'category', data: ys },
    visualMap: { min:0, max: Math.max(1, ...rows.map(r=>r.cnt)), calculable:true, orient:'horizontal', left:'center', bottom:0 },
    series: [{ type:'heatmap', data, emphasis:{ itemStyle:{ shadowBlur:10 } } }]
  }

  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div style={{fontWeight:600}}>Heatmap</div>
        <div className="row">
          <span className="label">Mode</span>
          <select value={mode} onChange={e=>setMode(e.target.value as any)}>
            <option value="dow-hour">Days of week × Hours</option>
            <option value="dow-month">Days of week × Months</option>
          </select>
        </div>
      </div>
      <ReactECharts option={option} style={{height:'calc(100% - 40px)'}}/>
    </div>
  )
}
