// src/components/Block3Map.tsx
import React from 'react'
import maplibregl from 'maplibre-gl'
import ReactECharts from 'echarts-for-react'
import { PMTiles, Protocol } from 'pmtiles'
import { useFilters } from '../store/filters'
import { parquetQuery } from '../lib/duck'
import { installPMTilesProtocol, addPMSource } from '../lib/tiles'
import { PMTILES, PARQUET } from '../config'
import { asset } from '../utils/asset';

/** Variables (unified ROUTE_ASPECT) */
const VAR_OPTIONS = [
  'GRAVITE',
  'CD_GENRE_ACCDN',
  'CD_SIT_PRTCE_ACCDN',
  'CD_ETAT_SURFC',
  'CD_ECLRM',
  'CD_ENVRN_ACCDN',
  'CD_CATEG_ROUTE',
  'CD_ETAT_CHASS',
  'ROUTE_ASPECT',
  'CD_LOCLN_ACCDN',
  'CD_POSI_ACCDN',
  'CD_COND_METEO',
]

/** Built-in fallback labels if dictionary.json doesn't include one */
const FALLBACK_VAR_LABELS: Record<string, string> = {
  JR_SEMN_ACCDN: 'Day of the week',
  GRAVITE: 'Severity of the accident (based on victims)',
  CD_GENRE_ACCDN: 'Type of collision (first impact)',
  CD_SIT_PRTCE_ACCDN: 'Special situation during accident',
  CD_ETAT_SURFC: 'Road surface condition',
  CD_ECLRM: 'Lighting condition',
  CD_ENVRN_ACCDN: 'Environment (land use)',
  CD_CATEG_ROUTE: 'Road category',
  CD_ETAT_CHASS: 'Roadway condition',
  T_ROUTE: 'Road aspect (profile/slope)',
  CD_ASPCT_ROUTE: 'Road aspect (profile/slope)',
  ROUTE_ASPECT: 'Road aspect (profile/slope)',
  CD_LOCLN_ACCDN: 'Longitudinal location',
  CD_POSI_ACCDN: 'Transversal position on roadway',
  CD_CONFG_ROUTE: 'Road configuration',
  CD_ZON_TRAVX_ROUTR: 'Work zone indicator',
  CD_COND_METEO: 'Weather conditions',
}

const SEV_FR_TO_EN: Record<string,string> = {
  'Dommages matériels inférieurs au seuil de rapportage': 'Below reporting threshold',
  'Dommages matériels seulement': 'Property damage only',
  'Léger': 'Minor injury',
  'Grave': 'Serious injury',
  'Mortel': 'Fatal'
}

/** Parquet field remapping */
const PARQUET_FIELD_MAP: Record<string, string> = {
  T_ROUTE: 'ROUTE_ASPECT',
  CD_ASPCT_ROUTE: 'ROUTE_ASPECT',
}

/** Tile property aliases for detection */
const FIELD_MAP: Record<string, string[]> = {
  GRAVITE: ['gravite'],
  CD_GENRE_ACCDN: ['cd_genre_accdn'],
  CD_SIT_PRTCE_ACCDN: ['cd_sit_prtce_accdn'],
  CD_ETAT_SURFC: ['cd_etat_surfc'],
  CD_ECLRM: ['cd_eclrm'],
  CD_ENVRN_ACCDN: ['cd_envrn_accdn'],
  CD_CATEG_ROUTE: ['cd_categ_route'],
  CD_ETAT_CHASS: ['cd_etat_chass'],
  ROUTE_ASPECT: ['route_aspect','t_route','cd_aspct_route'],
  CD_LOCLN_ACCDN: ['cd_locln_accdn'],
  CD_POSI_ACCDN: ['cd_posi_accdn'],
  CD_COND_METEO: ['cd_cond_meteo'],
}

/** Diverse category palette:
 *  - warm seq (yellow→orange→red→deep red)
 *  - neutral seq (white→light grey→grey→dark→black)
 *  Enough unique swatches for many categories, still on-brand.
 */
const PALETTE = [
  // warm
  '#fff3b0','#fee08b','#fdb863','#f07c4a','#e34a33','#cc2a1f','#8E1616','#D84040',
  // neutral
  '#ffffff','#ededed','#d9d9d9','#bdbdbd','#9e9e9e','#7a7a7a','#4d4d4d','#262626','#0f0f0f','#000000'
]

/** Canonicalize categories */
const canon = (v: any) => {
  if (v === null || v === undefined) return 'NA'
  let s = String(v).trim()
  if (s === '') return 'NA'
  const n = Number(s)
  if (!Number.isNaN(n) && Number.isFinite(n)) {
    if (Number.isInteger(n)) return String(n)
    return String(n)
  }
  return s
}

const qstr = (arr?: (string|number)[]) =>
  !arr || arr.length===0 ? '' : arr.map(v => typeof v==='number' ? v : `'${String(v)}'`).join(',')

type DictTable = Record<string, Record<string,string>>

/** Small utility to register a diagonal grey hatch for "not significant" LISA */
function addDiagonalPattern(map: maplibregl.Map, name = 'diag-gray', stroke = '#808080'){
  if ((map as any).hasImage && (map as any).hasImage(name)) return
  const size = 8
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0,0,size,size)
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, size-1); ctx.lineTo(size-1, 0)
  ctx.stroke()
  // add twice for denser hatch
  ctx.beginPath()
  ctx.moveTo(1, size-1); ctx.lineTo(size-1, 1)
  ctx.stroke()
  map.addImage(name, { width:size, height:size, data: ctx.getImageData(0,0,size,size).data as any })
}

export default function Block3Map(){
  const { filters } = useFilters()

  // UI state
  const [field, setField] = React.useState<string>('GRAVITE')
  const [showBase, setShowBase] = React.useState(true)
  const [showIncidents, setShowIncidents] = React.useState(true)
  const [showLISA, setShowLISA] = React.useState(false)
  const [pieOpen, setPieOpen] = React.useState(true)
  const [showQuartiers, setShowQuartiers] = React.useState<boolean>(false)

  // Refs & derived
  const mapRef = React.useRef<maplibregl.Map|null>(null)
  const containerRef = React.useRef<HTMLDivElement|null>(null)
  const [incSrcLayer, setIncSrcLayer] = React.useState<string>('incidents')
  const lisaSrcLayer = 'lisa'
  const schemaKeysRef = React.useRef<string[]>([])

  // Neighborhood hover state
  const qrHoverIdRef = React.useRef<number|null>(null)
  const qrPopupRef = React.useRef<maplibregl.Popup|null>(null)

  const [pieRows, setPieRows] = React.useState<{k:string, cnt:number}[]>([])
  const [colorMap, setColorMap] = React.useState<Record<string,string>>({})
  const [cats, setCats] = React.useState<string[]>([])

  // Optional dictionary (var labels + code labels)
  const [dict, setDict] = React.useState<DictTable | any>({})
  const [dictLoaded, setDictLoaded] = React.useState<boolean>(false)
  React.useEffect(()=>{
    fetch(asset('data/dictionary.json'))
      .then(r => r.ok ? r.json() : {})
      .then((j)=>{ setDict(j||{}); setDictLoaded(true) })
      .catch(()=> setDictLoaded(true))
  },[])

  // Variable label helper
  const varLabel = React.useCallback((varName: string) => {
    const fromDict = (dict?.__labels__ && dict.__labels__[varName]) || undefined
    return fromDict || FALLBACK_VAR_LABELS[varName] || varName
  }, [dict])

  const labelFor = React.useCallback((varName: string, key: string) => {
    const table = (dict as DictTable)[varName] || {}
    if (table[key] !== undefined) return table[key]
    const n = Number(key)
    if (!Number.isNaN(n) && Number.isInteger(n) && table[String(n)] !== undefined) return table[String(n)]
    return key
  },[dict])

  // Build WHERE for parquet
  const where = React.useMemo(()=>{
    const w: string[] = []
    if (filters.years?.length)      w.push(`AN IN (${qstr(filters.years)})`)
    if (filters.months?.length)     w.push(`month IN (${qstr(filters.months)})`)
    if (filters.quarters?.length)   w.push(`quarter IN (${qstr(filters.quarters)})`)
    if (filters.dows?.length)       w.push(`CAST(JR_SEMN_ACCDN AS VARCHAR) IN (${qstr(filters.dows)})`)
    if (filters.severities?.length) w.push(`GRAVITE IN (${qstr(filters.severities)})`)
    if (filters.quartiers?.length)  w.push(`no_qr IN (${qstr(filters.quartiers)})`)
    if (filters.arrs?.length)       w.push(`no_arr IN (${qstr(filters.arrs)})`)
    return w.length ? `WHERE ${w.join(' AND ')}` : ''
  },[filters])

  // Ensure unified option if old key sneaks in
  React.useEffect(()=>{
    if (field === 'T_ROUTE' || field === 'CD_ASPCT_ROUTE') setField('ROUTE_ASPECT')
  },[field])

  // One-time protocol install
  React.useEffect(()=>{
    try {
      installPMTilesProtocol()
    } catch {
      try {
        const protocol = new Protocol()
        maplibregl.addProtocol('pmtiles', protocol.tile)
      } catch {}
    }
  },[])

  // Map init
  React.useEffect(()=>{
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          dark: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap © CARTO'
          }
        },
        layers: [{ id:'dark', type:'raster', source:'dark' }],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
      },
      center: [-73.5673, 45.5017],
      zoom: 10.5
    })
    mapRef.current = map

    map.on('load', async ()=>{
      // INCIDENTS / LISA sources (pmtiles)
      addPMSource(map, 'incidents', PMTILES.incidents, 'vector')
      addPMSource(map, 'lisa', PMTILES.lisa, 'vector')

      // INCIDENTS schema from metadata
      try {
        const incidentsUrl = PMTILES.incidents.replace(/^pmtiles:\/\//,'')
        const p = new PMTiles(incidentsUrl)
        const meta = await p.getMetadata()
        const vls:any[] = (meta as any)?.vector_layers || []
        const layer0 = vls[0]
        if (layer0?.fields) schemaKeysRef.current = Object.keys(layer0.fields)
        if (layer0?.id) setIncSrcLayer(layer0.id)
        console.log('[pmtiles schema fields]', schemaKeysRef.current)
      } catch (e) {
        console.warn('Could not fetch PMTiles metadata:', e)
      }

      // INCIDENTS layer (base red; dynamic color applied later by refreshAll)
      map.addLayer({
        id:'inc-pts', type:'circle', source:'incidents', 'source-layer': incSrcLayer,
        paint: {
          'circle-radius': 3.2,
          'circle-opacity': 0.85,
          'circle-color': '#D84040'
        },
        layout: { visibility: showIncidents ? 'visible' : 'none' }
      })

      // ----- LISA layers (split significant vs not significant) -----
      // 1) Significant (HH/HL/LH/LL)
      map.addLayer({
        id:'lisa-fill', type:'fill', source:'lisa', 'source-layer': lisaSrcLayer,
        filter: ['in', ['get','cluster'], ['literal',['HH','HL','LH','LL']]],
        paint: {
          'fill-color': [
            'match', ['get','cluster'],
            'HH', '#8B0000',   // darker red
            'HL', '#FF6B6B',   // lighter red
            'LL', '#0B3D91',   // darker blue
            'LH', '#5DA9FF',   // lighter blue
            /* other */ '#3A3A3A'
          ],
          'fill-opacity': 0.45
        },
        layout: { visibility: showLISA ? 'visible' : 'none' }
      })
      map.addLayer({
        id:'lisa-line', type:'line', source:'lisa', 'source-layer': lisaSrcLayer,
        filter: ['in', ['get','cluster'], ['literal',['HH','HL','LH','LL']]],
        paint: { 'line-color':'#262626', 'line-width':0.6 },
        layout: { visibility: showLISA ? 'visible' : 'none' }
      })

      // 2) Not significant = white
      map.addLayer({
        id:'lisa-ns-fill', type:'fill', source:'lisa', 'source-layer': lisaSrcLayer,
        filter: ['!in', ['get','cluster'], ['literal',['HH','HL','LH','LL']]],
        paint: { 'fill-color': '#FFFFFF', 'fill-opacity': 0.35 },
        layout: { visibility: showLISA ? 'visible' : 'none' }
      })
      map.addLayer({
        id:'lisa-ns-line', type:'line', source:'lisa', 'source-layer': lisaSrcLayer,
        filter: ['!in', ['get','cluster'], ['literal',['HH','HL','LH','LL']]],
        paint: { 'line-color':'#BDBDBD', 'line-width':0.4, 'line-opacity':0.6 },
        layout: { visibility: showLISA ? 'visible' : 'none' }
      })


      // NEIGHBORHOODS (Quartiers)
      map.addSource('quartiers', {
        type: 'geojson',
        data: asset('data/basemap/MTL_quartier.geojson'),
        generateId: true
      } as any)

      map.addLayer({
        id: 'qr-fill',
        type: 'fill',
        source: 'quartiers',
        paint: { 'fill-color': '#000000', 'fill-opacity': 0 },
        layout: { visibility: showQuartiers ? 'visible' : 'none' }
      })

      map.addLayer({
        id: 'qr-line',
        type: 'line',
        source: 'quartiers',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#FFFFFF',
            '#CFD8DC'
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            2.5,
            1.6
          ],
          'line-opacity': 0.95
        },
        layout: { visibility: showQuartiers ? 'visible' : 'none' }
      })

      map.setLayoutProperty('dark','visibility', showBase ? 'visible' : 'none')

      // Click inspect (incidents)
      map.on('click','inc-pts', (e)=>{ const f=e.features?.[0]; if(f) console.log('props sample:', f.properties) })

      // Neighborhood hover handlers
      const ensurePopup = () => {
        if (!qrPopupRef.current) {
          qrPopupRef.current = new maplibregl.Popup({ closeButton:false, closeOnClick:false, anchor:'top' })
        }
        return qrPopupRef.current
      }

      const hoverHtml = (p: any) => {
        const nom_qr = p?.nom_qr ?? p?.NOM_QR ?? p?.name ?? ''
        const no_qr  = p?.no_qr ?? p?.NO_QR ?? ''
        const nom_arr = p?.nom_arr ?? p?.NOM_ARR ?? ''
        const no_arr  = p?.no_arr ?? p?.NO_ARR ?? ''
        const rows: string[] = []
        if (nom_qr || no_qr) rows.push(`<tr><td><b>Quartier</b></td><td>${nom_qr || ''}${no_qr ? ` (#${no_qr})` : ''}</td></tr>`)
        if (nom_arr || no_arr) rows.push(`<tr><td><b>Arr.</b></td><td>${nom_arr || ''}${no_arr ? ` (#${no_arr})` : ''}</td></tr>`)
        ;['pop','population','area','surface','code'].forEach(k=>{
          if (p?.[k] !== undefined) rows.push(`<tr><td><b>${k}</b></td><td>${p[k]}</td></tr>`)
        })
        if (!rows.length) {
          const entries = Object.entries(p || {}).slice(0,6)
          entries.forEach(([k,v]) => rows.push(`<tr><td><b>${k}</b></td><td>${String(v)}</td></tr>`))
        }
        return `<div style="font-size:12px;color:#EDEDED;"><table>${rows.join('')}</table></div>`
      }

      const onMove = (e: maplibregl.MapMouseEvent & {}) => {
        if (!showQuartiers) return
        const feats = map.queryRenderedFeatures(e.point, { layers: ['qr-fill'] })
        if (!feats.length) {
          if (qrHoverIdRef.current !== null) {
            map.setFeatureState({ source:'quartiers', id: qrHoverIdRef.current }, { hover:false })
            qrHoverIdRef.current = null
          }
          if (qrPopupRef.current) qrPopupRef.current.remove()
          map.getCanvas().style.cursor = ''
          return
        }
        const f = feats[0]
        const id = f.id as number
        if (qrHoverIdRef.current !== id) {
          if (qrHoverIdRef.current !== null) {
            map.setFeatureState({ source:'quartiers', id: qrHoverIdRef.current }, { hover:false })
          }
          qrHoverIdRef.current = id
          map.setFeatureState({ source:'quartiers', id }, { hover:true })
        }
        map.getCanvas().style.cursor = 'pointer'

        const popup = ensurePopup()
        popup.setLngLat(e.lngLat).setHTML(hoverHtml(f.properties)).addTo(map)
      }

      const onLeave = () => {
        if (!showQuartiers) return
        if (qrHoverIdRef.current !== null) {
          map.setFeatureState({ source:'quartiers', id: qrHoverIdRef.current }, { hover:false })
          qrHoverIdRef.current = null
        }
        if (qrPopupRef.current) qrPopupRef.current.remove()
        map.getCanvas().style.cursor = ''
      }

      map.on('mousemove', 'qr-fill', onMove)
      map.on('mouseleave', 'qr-fill', onLeave)
      ;(window as any).__qrHandlers = { onMove, onLeave }

      applyFilter()
      refreshAll()
    })

    return ()=>{ 
      const m = mapRef.current
      if (m) {
        try {
          const h = (window as any).__qrHandlers
          if (h) {
            m.off('mousemove', 'qr-fill', h.onMove)
            m.off('mouseleave', 'qr-fill', h.onLeave)
          }
        } catch {}
        m.remove()
      }
      mapRef.current = null 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  // If source-layer id changes post-meta load, rebuild incidents layer
  React.useEffect(()=>{
    const map = mapRef.current; if (!map) return
    if (!map.getSource('incidents')) return
    const lyr = map.getLayer('inc-pts'); if (!lyr) return
    // @ts-ignore
    if (lyr['source-layer'] !== incSrcLayer) {
      map.removeLayer('inc-pts')
      map.addLayer({
        id:'inc-pts', type:'circle', source:'incidents', 'source-layer': incSrcLayer,
        paint: { 'circle-radius': 3.2, 'circle-opacity': 0.85, 'circle-color': '#D84040' },
        layout: { visibility: showIncidents ? 'visible' : 'none' }
      })
      applyFilter()
      refreshAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[incSrcLayer])

  // Toggles
  React.useEffect(()=>{
    const map = mapRef.current; if (!map) return
    if (map.getLayer('dark'))      map.setLayoutProperty('dark','visibility', showBase?'visible':'none')
    if (map.getLayer('inc-pts'))   map.setLayoutProperty('inc-pts','visibility', showIncidents?'visible':'none')
    if (map.getLayer('lisa-fill')) map.setLayoutProperty('lisa-fill','visibility', showLISA?'visible':'none')
    if (map.getLayer('lisa-line')) map.setLayoutProperty('lisa-line','visibility', showLISA?'visible':'none')
    if (map.getLayer('lisa-ns-fill')) map.setLayoutProperty('lisa-ns-fill','visibility', showLISA?'visible':'none')
    if (map.getLayer('lisa-ns-line')) map.setLayoutProperty('lisa-ns-line','visibility', showLISA?'visible':'none')
    if (map.getLayer('qr-fill'))   map.setLayoutProperty('qr-fill','visibility', showQuartiers?'visible':'none')
    if (map.getLayer('qr-line'))   map.setLayoutProperty('qr-line','visibility', showQuartiers?'visible':'none')
    if (!showQuartiers && qrPopupRef.current) qrPopupRef.current.remove()
  },[showBase, showIncidents, showLISA, showQuartiers])

  // Apply map filter based on current filters
  function applyFilter(){
    const map = mapRef.current
    if (!map || !map.getLayer('inc-pts')) return
    const clauses:any[] = ['all']
    if (filters.years?.length)      clauses.push(['in',['get','AN'],['literal',filters.years]])
    if (filters.months?.length)     clauses.push(['in',['get','month'],['literal',filters.months]])
    if (filters.quarters?.length)   clauses.push(['in',['get','quarter'],['literal',filters.quarters]])
    if (filters.dows?.length)       clauses.push(['in',['get','JR_SEMN_ACCDN'],['literal',filters.dows.map(String)]])
    if (filters.severities?.length) clauses.push(['in',['get','GRAVITE'],['literal',filters.severities]])
    if (filters.quartiers?.length)  clauses.push(['in',['get','no_qr'],['literal',filters.quartiers]])
    if (filters.arrs?.length)       clauses.push(['in',['get','no_arr'],['literal',filters.arrs]])
    map.setFilter('inc-pts', clauses)
  }

  // Convert UI var -> parquet col
  const sqlField = React.useCallback((f:string)=> PARQUET_FIELD_MAP[f] ?? f, [])

  // Main refresh: parquet pie, detect tile field, palette
  async function refreshAll(attempt=0){
    const map = mapRef.current
    if (!map || !map.getLayer('inc-pts')) return

    const feats = (map as any).querySourceFeatures?.('incidents', { sourceLayer: incSrcLayer })
              || map.queryRenderedFeatures({ layers:['inc-pts'] })
    if ((!feats || feats.length === 0) && attempt < 1) {
      map.once('idle', () => refreshAll(attempt+1))
      return
    }

    // PIE data
    const col = sqlField(field)
    const rows = await parquetQuery<{k:any, cnt:number}>(`
      SELECT ${col} AS k, CAST(COUNT(*) AS INT) AS cnt
      FROM read_parquet('${PARQUET.incidentVars}')
      ${where}
      GROUP BY ${col}
      ORDER BY cnt DESC
      LIMIT 20
    `)
    const pie = rows.map(r => ({ k: canon(r.k), cnt: Number(r.cnt) }))

    // tile property
    const sampleProps = feats[0]?.properties || {}
    const sampleKeys = Object.keys(sampleProps)
    const schemaKeys = schemaKeysRef.current || []
    const availableKeySet = new Set<string>([...schemaKeys, ...sampleKeys])
    const candidates = [field, ...(FIELD_MAP[field] ?? []), field.toLowerCase()]
    const effectiveField = candidates.find(n => availableKeySet.has(n))

    // categories present in tiles
    let tileCats: string[] = []
    if (effectiveField) {
      const s = new Set<string>()
      for (const f of feats) {
        const v = canon((f.properties as any)?.[effectiveField])
        s.add(v); if (s.size >= 20) break
      }
      tileCats = Array.from(s)
    }

    const union = Array.from(new Set([...pie.map(p=>p.k), ...tileCats]))
    setCats(union)

    const cmap: Record<string,string> = {}
    union.forEach((c,i)=>{ cmap[c] = PALETTE[i % PALETTE.length] })
    if (!cmap['NA']) cmap['NA'] = '#bdbdbd'
    setColorMap(cmap)

    setPieRows(pie)

    if (effectiveField) {
      const valueExpr:any = [
        'let','v',['to-string',['coalesce',['get',effectiveField],'']],
        ['case', ['==',['var','v'],''],'NA',['var','v']]
      ]
      const pairs:any[] = []
      union.forEach(c=>pairs.push(c, cmap[c]))
      const expr:any = ['match', valueExpr, ...pairs, cmap['NA']]
      map.setPaintProperty('inc-pts','circle-color', expr)
      ;(window as any).__INC_TILE_FIELD_MISSING__ = null
    } else {
      map.setPaintProperty('inc-pts','circle-color', '#9e9e9e')
      ;(window as any).__INC_TILE_FIELD_MISSING__ = field
    }

    ;(window as any).__DBG = {
      field,
      sqlCol: col,
      effectiveField: effectiveField || null,
      categories_union: union,
      pie_categories: pie.map(p=>p.k),
      tile_categories: tileCats,
      filters_snapshot: filters,
      tile_props: sampleKeys,
      schema_keys: schemaKeys,
      have_union: [...availableKeySet],
      rendered_features: feats.length,
      missing_in_tiles: !effectiveField ? { tried: candidates, have: [...availableKeySet] } : null
    }
  }

  React.useEffect(()=>{
    applyFilter()
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[field, where, showIncidents])
  
  const translateSeverity = (v:string) => (
    SEV_FR_TO_EN[v] ?? v
  )
  // Pie option
  const pieOpt = React.useMemo(() => ({
    tooltip: { trigger: 'item' },
    legend: {
      type: 'plain',
      orient: 'horizontal',
      top: 0,
      left: 0,
      width: 340,
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 10,
      textStyle: { fontSize: 12, color: '#EDEDED' },
      data: pieRows.map(r => field === 'GRAVITE' ? translateSeverity(labelFor(field, r.k)) : labelFor(field, r.k)),

    },
    series: [{
      type: 'pie' as const,
      radius: ['15%', '50%'],
      center: ['40%', '60%'],
      avoidLabelOverlap: true,
      label: { show: false },
      labelLine: { show: false },
      data: pieRows.map(r => ({
        name: field === 'GRAVITE' ? translateSeverity(labelFor(field, r.k)) : labelFor(field, r.k),
        value: r.cnt,
        itemStyle: { color: colorMap[r.k] || colorMap['NA'] || '#ccc' }
      }))
    }]
  }), [pieRows, colorMap, field, labelFor])

  return (
    <div className="card map-card" style={{ position:'relative' }}>
      {/* Controls */}
      <div style={{position:'absolute', left:10, top:10, zIndex:10, display:'flex', gap:8, flexWrap:'wrap'}}>
        <div style={{background:'#101010', padding:'6px 8px', borderRadius:8, border:'1px solid #262626', boxShadow:'0 2px 8px rgba(0,0,0,.35)', color:'#EDEDED'}}>
          <span className="label" style={{marginRight:8}}>Variable</span>
          <select value={field} onChange={e=>setField(e.target.value)}>
            {VAR_OPTIONS.map(v=>{
              const label = v === 'ROUTE_ASPECT'
                ? `${varLabel(v)}`
                : varLabel(v)
              return <option key={v} value={v}>{label}</option>
            })}
          </select>
        </div>
        <div style={{background:'#101010', padding:'6px 8px', borderRadius:8, border:'1px solid #262626', boxShadow:'0 2px 8px rgba(0,0,0,.35)', color:'#EDEDED'}}>
          <strong style={{marginRight:8}}>Layers</strong>
          <label style={{marginRight:10}}>
            <input type="checkbox" checked={showBase} onChange={e=>setShowBase(e.target.checked)} /> Basemap
          </label>
          <label style={{marginRight:10}}>
            <input type="checkbox" checked={showIncidents} onChange={e=>setShowIncidents(e.target.checked)} /> Incidents
          </label>
          <label style={{marginRight:10}}>
            <input type="checkbox" checked={showLISA} onChange={e=>setShowLISA(e.target.checked)} /> LISA
          </label>
          <label>
            <input type="checkbox" checked={showQuartiers} onChange={e=>setShowQuartiers(e.target.checked)} /> Neighborhoods
          </label>
        </div>
      </div>

      {/* Map container */}
      <div ref={containerRef} className="fill" />

      {showIncidents && (
        <details className="floating" style={{ left: 10, top: 60, right: 'auto' }} open={pieOpen}
                onToggle={e => setPieOpen((e.target as HTMLDetailsElement).open)}>
          <summary>Distribution — {varLabel(field)}</summary>
          <ReactECharts option={pieOpt} style={{ height: 460, width: 380 }} notMerge />

        </details>
      )}


      {/* LISA legend */}
      {showLISA && (
        <details className="floating" style={{ right: 12, top: 12, left: 'auto', width: 'auto', padding: 8 }}>
          <summary>LISA legend</summary>
          <div style={{ fontSize:13, lineHeight:1.4, marginTop:6 }}>
            <div><span style={{display:'inline-block',width:12,height:12,background:'#8B0000',marginRight:6}}/> HH: High–High cluster</div>
            <div><span style={{display:'inline-block',width:12,height:12,background:'#FF6B6B',marginRight:6}}/> HL: High–Low outlier</div>
            <div><span style={{display:'inline-block',width:12,height:12,background:'#0B3D91',marginRight:6}}/> LL: Low–Low cluster</div>
            <div><span style={{display:'inline-block',width:12,height:12,background:'#5DA9FF',marginRight:6}}/> LH: Low–High outlier</div>
            <div><span style={{display:'inline-block',width:12,height:12,background:'#FFFFFF',border:'1px solid #BDBDBD',marginRight:6}}/> Not significant</div>
          </div>
        </details>
      )}


      {/* Missing-variable banner */}
      {(window as any).__INC_TILE_FIELD_MISSING__ && showIncidents && (
        <div style={{
          position:'absolute', left:12, bottom:12, zIndex: 15,
          background:'#101010', border:'1px solid #262626', borderRadius:8,
          boxShadow:'0 12px 24px rgba(0,0,0,.45)', padding:'8px 10px', maxWidth: 520, color:'#EDEDED'
        }}>
          <div style={{fontSize:13}}>
            <b style={{color:'#D84040'}}>Tiles missing “{(window as any).__INC_TILE_FIELD_MISSING__}”.</b><br/>
            Points are grey to avoid incorrect colors.<br/>
            <span className="small">Schema keys: <code>{((window as any).__DBG?.schema_keys || []).join(', ')}</code></span>
          </div>
        </div>
      )}
    </div>
  )
}
