import maplibregl, { Map } from 'maplibre-gl'
import { PMTiles, Protocol } from 'pmtiles'

let protocolInstalled = false
export function installPMTilesProtocol() {
  if (protocolInstalled) return
  const protocol = new Protocol()
  // @ts-ignore
  maplibregl.addProtocol('pmtiles', protocol.tile)
  protocolInstalled = true
  return protocol
}

export function addPMSource(map: Map, id: string, url: string, type: 'vector'|'raster' = 'vector') {
  if (map.getSource(id)) return
  map.addSource(id, {
    type, url: `pmtiles://${url}`
  } as any)
}
