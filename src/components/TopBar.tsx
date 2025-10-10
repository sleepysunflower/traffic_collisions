import React, { useEffect, useState } from 'react'
import { useFilters } from '../store/filters'
import { parquetQuery } from '../lib/duck'
import { PARQUET, SEVERITIES, BASEMAP } from '../config'

export default function TopBar() {
  const { filters, set, reset } = useFilters()
  const [years, setYears] = useState<number[]>([])
  const [months] = useState<number[]>([1,2,3,4,5,6,7,8,9,10,11,12])
  const [quarters] = useState<number[]>([1,2,3,4])
  const [dows] = useState<(number|string)[]>([0,1,2,3,4,5,6])
  const [quartiers, setQuartiers] = useState<(string|number)[]>([])
  const [arrs, setArrs] = useState<(string|number)[]>([])

  useEffect(() => {
    // load years from series_yearly
    parquetQuery<{AN:number}>(`SELECT DISTINCT AN FROM read_parquet('${PARQUET.seriesYearly}') ORDER BY AN`).then(r=>setYears(r.map(x=>x.AN)))
    // load quartier/arr ids from basemap
    fetch(BASEMAP).then(r=>r.json()).then(gj=>{
      const qs = new Set<any>(), as = new Set<any>()
      for (const f of gj.features) { qs.add(f.properties.no_qr); as.add(f.properties.no_arr) }
      setQuartiers([...qs]); setArrs([...as])
    })
  },[])

  return (
    <div className="bar">
      <div className="row">
        <span className="label">Year</span>
        <select multiple value={filters.years?.map(String) ?? []} onChange={e=>{
          const vals=[...e.target.selectedOptions].map(o=>Number(o.value)); set({years:vals.length?vals:null})
        }}>
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>

        <span className="label">Quarter</span>
        <select multiple value={filters.quarters?.map(String) ?? []} onChange={e=>{
          const vals=[...e.target.selectedOptions].map(o=>Number(o.value)); set({quarters:vals.length?vals:null})
        }}>
          {quarters.map(q=><option key={q} value={q}>{q}</option>)}
        </select>

        <span className="label">Month</span>
        <select multiple value={filters.months?.map(String) ?? []} onChange={e=>{
          const vals=[...e.target.selectedOptions].map(o=>Number(o.value)); set({months:vals.length?vals:null})
        }}>
          {months.map(m=><option key={m} value={m}>{m}</option>)}
        </select>

        <span className="label">Day of week</span>
        <select multiple value={filters.dows?.map(String) ?? []} onChange={e=>{
          const vals=[...e.target.selectedOptions].map(o=>o.value); set({dows:vals.length?vals:null})
        }}>
          {dows.map(d=><option key={String(d)} value={String(d)}>{String(d)}</option>)}
        </select>

        <span className="label">Severity</span>
        <select multiple value={filters.severities ?? []} onChange={e=>{
          const vals=[...e.target.selectedOptions].map(o=>o.value); set({severities:vals.length?vals:null})
        }}>
          {SEVERITIES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>

        <span className="label">Quartier</span>
        <select multiple value={filters.quartiers?.map(String) ?? []} onChange={e=>{
          const vals=[...e.target.selectedOptions].map(o=>o.value); set({quartiers:vals.length?vals:null})
        }}>
          {quartiers.map(q=><option key={String(q)} value={String(q)}>{String(q)}</option>)}
        </select>

        <span className="label">Arrondissement</span>
        <select multiple value={filters.arrs?.map(String) ?? []} onChange={e=>{
          const vals=[...e.target.selectedOptions].map(o=>o.value); set({arrs:vals.length?vals:null})
        }}>
          {arrs.map(a=><option key={String(a)} value={String(a)}>{String(a)}</option>)}
        </select>

        <button className="pill" onClick={()=>reset()}>Reset</button>
      </div>
    </div>
  )
}
