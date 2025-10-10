import React, { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { parquetQuery } from '../lib/duck'
import { PARQUET } from '../config'
import { useFilters } from '../store/filters'
import { SEVERITIES } from '../config'

export default function Block1Trend(){
  const { filters } = useFilters()
  const [rows,setRows] = useState<any[]>([])

  const where = useMemo(() => {
    const w: string[] = []
    if (filters.years) w.push(`AN IN (${filters.years.join(',')})`)
    if (filters.months) w.push(`month IN (${filters.months.join(',')})`)
    if (filters.severities) w.push(`GRAVITE IN (${filters.severities.map(s=>`'${s}'`).join(',')})`)
    if (filters.quartiers) w.push(`no_qr IN (${filters.quartiers.map(s=>`'${s}'`).join(',')})`)
    if (filters.arrs) w.push(`no_arr IN (${filters.arrs.map(s=>`'${s}'`).join(',')})`)
    return w.length? 'WHERE '+w.join(' AND ') : ''
  },[filters])

  useEffect(()=>{
    const sql = `
      WITH base AS (
        SELECT AN, month, GRAVITE, no_qr, no_arr, count
        FROM read_parquet('${PARQUET.seriesMonthly}')
        ${where}
      )
      SELECT AN, month, GRAVITE, SUM(count) AS cnt
      FROM base
      GROUP BY AN, month, GRAVITE
      ORDER BY AN, month
    `
    parquetQuery<any>(sql).then(setRows)
  },[where])

  const x = rows.map(r=>`${r.AN}-${String(r.month).padStart(2,'0')}`)
  const series = SEVERITIES.filter(s=>!filters.severities || filters.severities.includes(s)).map(s=>({
    type:'line', name:s, showSymbol:false, data: rows.filter(r=>r.GRAVITE===s).map(r=>r.cnt)
  }))

  const option = {
    tooltip: { trigger:'axis' },
    legend: { top: 0 },
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    xAxis: { type:'category', data:x },
    yAxis: { type:'value', name: 'Collisions' },
    series
  }
  return <div className="card"><ReactECharts option={option} style={{height:'100%'}}/></div>
}
