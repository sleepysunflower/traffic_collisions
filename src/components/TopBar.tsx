import React, { useEffect, useState } from 'react'
import { useFilters } from '../store/filters'
import { parquetQuery } from '../lib/duck'
import { PARQUET } from '../config'

type Pair = { id: string | number; name: string }

const DOW_CODES = ['DI','LU','MA','ME','JE','VE','SA'] as const
const DOW_EN_SHORT: Record<string,string> = { DI:'Sun', LU:'Mon', MA:'Tue', ME:'Wed', JE:'Thu', VE:'Fri', SA:'Sat' }

// FR (data) → EN (display) for severity
const SEV_FR_TO_EN: Record<string,string> = {
  'Dommages matériels inférieurs au seuil de rapportage': 'Below reporting threshold',
  'Dommages matériels seulement': 'Property damage only',
  'Léger': 'Minor injury',
  'Grave': 'Serious injury',
  'Mortel': 'Fatal'
}
// canonical order (least → most severe)
const SEV_ORDER_FR = [
  'Dommages matériels inférieurs au seuil de rapportage',
  'Dommages matériels seulement',
  'Léger',
  'Grave',
  'Mortel',
]

// 🔴 darker light→dark gradient (works with white text)
const SEV_RED = ['#E9A1A1','#E07B7B','#D84040','#B93535','#8E1616']

const Chip = ({
  active, label, onClick, bg, bgActive, borderActive = '#EDEDED'
}: { active:boolean; label: React.ReactNode; onClick:()=>void; bg?:string; bgActive?:string; borderActive?:string }) => {
  const base = bg ?? '#2a2a2a'
  const baseActive = bgActive ?? '#3a3a3a'
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? baseActive : base,
        color: '#EDEDED',
        border: `1px solid ${active ? borderActive : '#262626'}`,
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 13,
        fontWeight: 700,
        boxShadow: active ? `0 0 0 2px ${borderActive} inset` : 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}
    >{label}</button>
  )
}

export default function TopBar() {
  const { filters, setFilters, clearKey } = useFilters()

  const [years, setYears] = useState<number[]>([])
  const [severitiesFR, setSeveritiesFR] = useState<string[]>([])
  const [quartiers, setQuartiers] = useState<Pair[]>([])
  const [arrs, setArrs] = useState<Pair[]>([])

  const asArr = (v: any) => (Array.isArray(v) ? v : []) as any[]
  const toggleMulti = (key: keyof typeof filters, v: string | number) => {
    const cur = asArr((filters as any)[key])
    const has = cur.includes(v)
    const next = has ? cur.filter((x) => x !== v) : [...cur, v]
    setFilters({ [key]: next } as any)
  }

  useEffect(() => {
    ;(async () => {
      const ys = await parquetQuery<{ y: number }>(
        `SELECT DISTINCT CAST(AN AS INT) AS y
         FROM read_parquet('${PARQUET.incidentVars}')
         WHERE AN IS NOT NULL ORDER BY y`
      )
      setYears(ys.map(r => r.y))

      const sv = await parquetQuery<{ s: string }>(
        `SELECT DISTINCT CAST(GRAVITE AS VARCHAR) AS s
         FROM read_parquet('${PARQUET.incidentVars}')
         WHERE GRAVITE IS NOT NULL`
      )
      const vals = SEV_ORDER_FR.filter(v => sv.find(x => x.s === v))
      setSeveritiesFR(vals.length ? vals : SEV_ORDER_FR)

      const qs = await parquetQuery<{ id: number; name: string }>(
        `SELECT DISTINCT CAST(no_qr AS INT) AS id, CAST(nom_qr AS VARCHAR) AS name
         FROM read_parquet('${PARQUET.incidentVars}')
         WHERE no_qr IS NOT NULL AND nom_qr IS NOT NULL ORDER BY name`
      )
      setQuartiers(qs)

      const as = await parquetQuery<{ id: number; name: string }>(
        `SELECT DISTINCT CAST(no_arr AS INT) AS id, CAST(nom_arr AS VARCHAR) AS name
         FROM read_parquet('${PARQUET.incidentVars}')
         WHERE no_arr IS NOT NULL AND nom_arr IS NOT NULL ORDER BY name`
      )
      setArrs(as)
    })()
  }, [])

  return (
    <div className="card" style={{ margin: 12, position:'relative', zIndex:1000 }}>
      <div className="card-body" style={{ display:'grid', gap:12 }}>

        {/* Row 1: Year + Quarter */}
        <div style={{ display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span className="label">Year</span>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {years.map(y => (
                <Chip key={y}
                  active={asArr(filters.years).includes(y)}
                  label={y}
                  onClick={() => toggleMulti('years', y)}
                />
              ))}
            </div>
            <button onClick={() => clearKey('years')}>Clear</button>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span className="label">Quarter</span>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {[1,2,3,4].map(q => (
                <Chip key={q}
                  active={asArr(filters.quarters).includes(q)}
                  label={`Q${q}`}
                  onClick={() => toggleMulti('quarters', q)}
                />
              ))}
            </div>
            <button onClick={() => clearKey('quarters')}>Clear</button>
          </div>
        </div>

        {/* Row 2: Month + DoW (force same row) */}
        <div style={{ display:'flex', gap:24, alignItems:'center', flexWrap:'nowrap', overflowX:'auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flex: '0 0 auto' }}>
            <span className="label">Month</span>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <Chip key={m}
                  active={asArr(filters.months).includes(m)}
                  label={m}
                  onClick={() => toggleMulti('months', m)}
                />
              ))}
            </div>
            <button onClick={() => clearKey('months')}>Clear</button>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10, flex: '0 0 auto' }}>
            <span className="label">DoW</span>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {DOW_CODES.map(code => (
                <Chip key={code}
                  active={asArr(filters.dows).includes(code)}
                  label={DOW_EN_SHORT[code]}
                  onClick={() => toggleMulti('dows', code)}
                />
              ))}
            </div>
            <button onClick={() => clearKey('dows')}>Clear</button>
          </div>
        </div>

        {/* Row 3: Severity + Spatial (Quartier & Arr stacked) */}
        <div style={{ display:'flex', gap:24, alignItems:'flex-start', flexWrap:'nowrap', overflowX:'auto' }}>
          {/* Severity (left, grows) */}
          <div style={{ display:'flex', alignItems:'center', gap:10, flex: '1 1 auto' }}>
            <span className="label">Severity</span>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {severitiesFR.map((fr, i) => (
                <Chip
                  key={fr}
                  active={asArr(filters.severities).includes(fr)}
                  label={SEV_FR_TO_EN[fr] ?? fr}
                  onClick={() => toggleMulti('severities', fr)}
                  bg={SEV_RED[i] || '#D84040'}
                  bgActive={SEV_RED[i] || '#D84040'}
                  borderActive="#090909"
                />
              ))}
            </div>

            <button onClick={() => clearKey('severities')}>Clear</button>
          </div>

          {/* Spatial column (right, fixed width): Quartier above, Arr below */}
          {/* Spatial section: Quartier + Arrondissement side by side */}
          <div style={{ display:'flex', gap:12, flex: '0 0 720px', alignItems:'flex-start' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span className="label">Quartier</span>
              <select
                className="select-cool"
                multiple
                size={5}
                value={asArr(filters.quartiers).map(String)}
                onChange={(e) => {
                  const vals = Array.from(e.target.selectedOptions).map(o => Number(o.value))
                  setFilters({ quartiers: vals })
                }}
              >
                {quartiers.map(q => (
                  <option key={q.id} value={String(q.id)}>{q.name}</option>
                ))}
              </select>
              <button onClick={() => clearKey('quartiers')}>Clear</button>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span className="label">Arrondissement</span>
              <select
                className="select-cool"
                multiple
                size={5}
                value={asArr(filters.arrs).map(String)}
                onChange={(e) => {
                  const vals = Array.from(e.target.selectedOptions).map(o => Number(o.value))
                  setFilters({ arrs: vals })
                }}
              >
                {arrs.map(a => (
                  <option key={a.id} value={String(a.id)}>{a.name}</option>
                ))}
              </select>
              <button onClick={() => clearKey('arrs')}>Clear</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
