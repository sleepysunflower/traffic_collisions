import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { installPMTilesProtocol, addPMSource } from '../lib/tiles'
import { PMTILES } from '../config'

export default function Block4LISA(){
  const ref = useRef<HTMLDivElement>(null)
  useEffect(()=>{
    installPMTilesProtocol()
    const map = new maplibregl.Map({
      container: ref.current!,
      style: { version:8, sources:{}, layers:[] },
      center: [-73.5673,45.5017], zoom: 10
    })
    map.on('load', ()=>{
      addPMSource(map, 'lisa', PMTILES.lisa, 'vector')
      map.addLayer({ id:'lisa-fill', type:'fill', source:'lisa', 'source-layer':'lisa',
        paint: {
          'fill-color': [
            'match', ['get','cluster'],
            'HH', '#b71c1c',
            'HL', '#ef6c00',
            'LH', '#1976d2',
            'LL', '#1b5e20',
            /* other */ '#bdbdbd'
          ],
          'fill-opacity': 0.45
        }
      })
      map.addLayer({ id:'lisa-line', type:'line', source:'lisa', 'source-layer':'lisa', paint:{ 'line-color':'#333','line-width':0.5 } })
    })
    return ()=>{ map.remove() }
  },[])
  return <div className="card"><div id="mapLisa" ref={ref} /></div>
}
