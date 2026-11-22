"use client"

import {MapContainer, TileLayer, Marker, Popup, Circle, useMap} from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { divIcon, type Marker as LeafletMarker } from "leaflet"
import { useRef, useMemo, useEffect } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { FaMapMarkerAlt } from "react-icons/fa"

const redIcon = divIcon({
  html: renderToStaticMarkup(<FaMapMarkerAlt size={40} color="#B91C1C" />),
  className: "",
  iconSize: [40, 40],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
})

interface AdminMapProps {
  center: [number, number]
  radius: number
  onCenterChange: (lat: number, lng: number) => void
  /** Bump this to fly the map to `center` (e.g. after picking a search result). */
  focusKey?: number
}

function FlyToCenter({ center, focusKey }: { center: [number, number]; focusKey?: number }) {
  const map = useMap()
  const centerRef = useRef(center)
  centerRef.current = center
  useEffect(() => {
    if (!focusKey) return
    map.flyTo(centerRef.current, Math.max(map.getZoom(), 17), { duration: 0.8 })
  }, [focusKey, map])
  return null
}

export default function AdminMap({center, radius, onCenterChange, focusKey}:AdminMapProps) {
    const cen = center ?? [16.41639, 120.59306]
    const markerRef = useRef<LeafletMarker>(null)
    const eventHandlers = useMemo(
    () => ({
      add(e: any) {
        e.target.openPopup()
      },
      dragend() {
        const marker = markerRef.current
        if (marker) {
          const { lat, lng } = marker.getLatLng()
          onCenterChange(lat, lng)
        }
      },
    }),
    [onCenterChange]
  )

    return (
        <MapContainer center={cen} zoom={16} style={{ height: "100%", width: "100%", borderRadius: 8 }}>
             <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker
                position={cen}
                icon={redIcon}
                draggable
                eventHandlers={eventHandlers}
                ref={markerRef}
                
            >
            <Popup>
              <div className="flex flex-col p-1" style={{ minWidth: 160 }}>
                <strong style={{margin: "0 0 4px 0", display: "block"}}>Drag me to change location</strong>
              </div>
            </Popup>
            </Marker>
            <FlyToCenter center={cen} focusKey={focusKey} />
            <Circle center={cen} pathOptions={{color: 'green'}} radius={radius}></Circle>
        </MapContainer>
    )
}