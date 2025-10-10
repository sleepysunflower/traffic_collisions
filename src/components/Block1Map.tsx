import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { installPMTilesProtocol, addPMSource } from '../lib/tiles'
import { PMTILES, BASEMAP } from '../config'
import { useFilters } from '../store/filters'

export default function Block1Map(){
  const { filters } = useFilters()
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map|null>(null)

  useEffect(()=>{
    installPMTilesProtocol()
    const map = new maplibregl.Map({
      container: ref.current!,
      style: {
        version: 8,
        sources: {
          osm: { type:'raster', tiles:[
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          ], tileSize:256 }
        },
        layers: [{ id:'osm', type:'raster', source:'osm' }]
      },
      center: [-73.5673,45.5017], zoom: 10.5
    })
    mapRef.current = map

    map.on('load', async ()=>{
      // PMTiles incidents
      addPMSource(map, 'incidents', PMTILES.incidents, 'vector')
      map.addLayer({
        id:'incidents_circ', type:'circle', source:'incidents', 'source-layer':'incidents',
        paint:{ 'circle-radius': 3, 'circle-color':'#c62828', 'circle-opacity':0.5 }
      })

      // Neighborhood outline (for context)
      const gj = await fetch(BASEMAP).then(r=>r.json())
      map.addSource('quartiers', { type:'geojson', data: gj })
      map.addLayer({ id:'quartiers-line', type:'line', source:'quartiers', paint:{ 'line-color':'#222','line-width':1 } })
    })

    return ()=>{ map.remove() }
  },[])
