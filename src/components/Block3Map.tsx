import React, { useEffect, useRef, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { installPMTilesProtocol, addPMSource } from '../lib/tiles'
import { PMTILES, PARQUET } from '../config'
import { useFilters } from '../store/filters'
import ReactECharts from 'echarts-for-react'
import { parquetQuery } from '../lib/duck'

const VAR_OPTIONS = [
  'GRAVITE', 'CD_GENRE_ACCDN', 'CD_SIT_PRTCE_ACCDN', 'CD_ETAT_SURFC', 'CD_ECLRM',
  'CD_ENVRN_ACCDN', 'CD_CATEG_ROUTE', 'CD_ETAT_CHASS', 'T_ROUTE', 'CD_ASPCT_ROUTE',
  'CD_LOCLN_ACCDN', 'CD_POSI_ACCDN', 'CD_COND_METEO'
]

export default function Block3Map(){
  const { filters } = useFilters()
  const [field, setField] = useState<string>('GRAVITE')
  const [pieRows, setPieRows] = useState<any[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map|null>(null)

  useEffect(()=>{
    installPMTilesProtocol()
    const map = new maplibregl.Map({
      container: ref.current!,
      style: {
        version: 8,
        sources: {},
        layers: []
      },
      center: [-73.5673,45.5017], zoom: 10.5
    })
    mapRef.current = map
    map.on('load', ()=>{
      addPMSource(map, 'incidents', PMTILES.incidents, 'vector')
      map.addLayer({ id:'inc-pts', type:'circle', source:'incidents', 'source-layer':'incidents',
        paint: { 'circle-radius': 3, 'circle-color': '#1976d2', 'circle-opacity':0.45 }
      })
    })
    return ()=>{ map.remove() }
  },[])

  const where = useMemo(()=>{
    const w: string[] = []
    if (filters.years) w.push(`AN IN (${filters.years.join(',')})`)
    if (filters.severities) w.push(`GRAVITE IN (${filters.severities.map(s=>`'${s}'`).join(',')})`)
    if (filters.quartiers) w.push(`no_qr IN (${filters.quartiers.map(s=>`'${s}'`).join(',')})`)
    if (filters.arrs) w.push(`no_arr IN (${filters.arrs.map(s=>`'${s}'`).join(',')})`)
    return w.length? 'WHERE '+w.join(' AND ') : ''
  },[filters])

  useEffect(()=>{
    // Pie from incident_vars.parquet
    const sql = `
      SELECT ${field} AS k, COUNT(*) AS cnt
      FROM read_parquet('${PARQUET.incidentVars}')
      ${where}
      GROUP BY ${field}
      ORDER BY cnt DESC
    `
    parquetQuery<any>(sql).then(setPieRows)
  },[field, where])

  const pieOpt = {
    tooltip: { trigger:'item' },
    legend: { top: 0 },
    series: [{
      type:'pie', radius:['35%','70%'],
      data: pieRows.map(r=>({ name: String(r.k), value: r.cnt }))
    }]
  }

  return (
    <div className="card" style={{position:'relative'}}>
      <div style={{position:'absolute', left:10, top:10, background:'#fff', padding:'6px 8px', borderRadius:8, boxShadow:'0 2px 8px rgba(0,0,0,.15)'}}>
        <span className="label">Variable</span>
        <select value={field} onChange={e=>setField(e.target.value)}>
          {VAR_OPTIONS.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <div ref={ref} style={{height:'100%'}} />
      <div className="floating">
        <ReactECharts option={pieOpt} style={{height:280}}/>
      </div>
    </div>
  )
}
