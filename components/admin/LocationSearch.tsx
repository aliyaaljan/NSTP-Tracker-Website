"use client"

import { useEffect, useId, useRef, useState } from "react"
import { TYPE } from "@/lib/admin-typography"

const COLORS = {
  textDark: "#2C2C2A",
  textGray: "#8C8C88",
  fieldBg: "#EBEBE8",
  headerGreen: "#14492E",
  hover: "#E8F0EB",
  error: "#7B1113",
}

/**
 * Photon (komoot) is an OpenStreetMap geocoder built for search-as-you-type.
 * Free and keyless — unlike Nominatim, whose usage policy forbids autocomplete.
 */
const PHOTON_URL = "https://photon.komoot.io/api/"
/** minLon,minLat,maxLon,maxLat — keeps results inside the Philippines. */
const PH_BBOX = "116,4,127,21"
const DEBOUNCE_MS = 350
const MIN_QUERY_LENGTH = 3

export type LocationSuggestion = {
  id: string
  name: string
  detail: string
  lat: number
  lng: number
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_type?: string
    osm_id?: number
    name?: string
    housenumber?: string
    street?: string
    locality?: string
    district?: string
    city?: string
    county?: string
    state?: string
    country?: string
  }
}

function toSuggestion(f: PhotonFeature, index: number): LocationSuggestion {
  const p = f.properties
  const [lng, lat] = f.geometry.coordinates
  const street = [p.housenumber, p.street].filter(Boolean).join(" ")
  const name = p.name || street || p.city || p.state || "Unnamed place"
  const detailParts = [
    p.name ? street : null,
    p.locality,
    p.district,
    p.city,
    p.county,
    p.state,
  ].filter((part): part is string => Boolean(part) && part !== name)
  // Drop consecutive duplicates (e.g. city === county).
  const detail = detailParts.filter((part, i) => part !== detailParts[i - 1]).join(", ")
  return {
    id: `${p.osm_type ?? "x"}${p.osm_id ?? index}-${index}`,
    name,
    detail,
    lat,
    lng,
  }
}

export default function LocationSearch({
  onSelect,
  biasCenter,
}: {
  onSelect: (suggestion: LocationSuggestion) => void
  /** Results near this point rank higher. */
  biasCenter?: [number, number]
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LocationSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  // Skip the fetch triggered by filling the box with a chosen suggestion.
  const skipNextFetch = useRef(false)
  const biasRef = useRef(biasCenter)
  biasRef.current = biasCenter

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false
      return
    }
    const q = query.trim()
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ q, limit: "6", bbox: PH_BBOX })
        const bias = biasRef.current
        if (bias) {
          params.set("lat", String(bias[0]))
          params.set("lon", String(bias[1]))
        }
        const res = await fetch(`${PHOTON_URL}?${params}`, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: { features?: PhotonFeature[] } = await res.json()
        setResults((data.features ?? []).map(toSuggestion))
        setActiveIndex(-1)
        setOpen(true)
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setResults([])
        setError("Couldn't load suggestions. Check your connection or drag the pin instead.")
        setOpen(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  // Close the list when clicking anywhere outside the search box.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  function choose(s: LocationSuggestion) {
    skipNextFetch.current = true
    setQuery(s.detail ? `${s.name}, ${s.detail}` : s.name)
    setResults([])
    setOpen(false)
    setActiveIndex(-1)
    onSelect(s)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open) {
        // Don't let Escape also close the whole modal.
        e.stopPropagation()
        e.nativeEvent.stopImmediatePropagation()
        setOpen(false)
      }
      return
    }
    if (e.key === "Enter") {
      // Never submit the surrounding form from the search box.
      e.preventDefault()
      const pick = results[activeIndex >= 0 ? activeIndex : 0]
      if (open && pick) choose(pick)
      return
    }
    if (!results.length) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1))
    }
  }

  const showList = open && (results.length > 0 || error || (!loading && query.trim().length >= MIN_QUERY_LENGTH))

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <i
          className="ti ti-search"
          aria-hidden
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 18,
            color: COLORS.textGray,
            pointerEvents: "none",
          }}
        />
        <input
          id="gps_location_search"
          type="text"
          role="combobox"
          aria-expanded={Boolean(showList)}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search a place, e.g. UP Baguio"
          style={{
            width: "100%",
            boxSizing: "border-box",
            ...TYPE.body,
            fontStyle: "normal",
            color: COLORS.textDark,
            background: COLORS.fieldBg,
            border: "1.5px solid transparent",
            borderRadius: 6,
            padding: "12px 38px 12px 40px",
            outline: "none",
          }}
        />
        {loading && (
          <i
            className="ti ti-loader-2"
            aria-label="Searching"
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              marginTop: -9,
              fontSize: 18,
              color: COLORS.textGray,
              animation: "location-search-spin 0.8s linear infinite",
            }}
          />
        )}
        {!loading && query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("")
              setResults([])
              setOpen(false)
            }}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              padding: 6,
              cursor: "pointer",
              color: COLORS.textGray,
              display: "flex",
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 1000,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            margin: 0,
            padding: 4,
            listStyle: "none",
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {error ? (
            <li style={{ ...TYPE.caption, color: COLORS.error, padding: "10px 12px" }}>{error}</li>
          ) : results.length === 0 ? (
            <li style={{ ...TYPE.caption, color: COLORS.textGray, padding: "10px 12px" }}>
              No places found
            </li>
          ) : (
            results.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                // mousedown keeps focus in the input so the list doesn't vanish first
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "9px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: i === activeIndex ? COLORS.hover : "transparent",
                }}
              >
                <i
                  className="ti ti-map-pin"
                  aria-hidden
                  style={{ fontSize: 18, color: COLORS.headerGreen, marginTop: 1 }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ ...TYPE.bodyBold, color: COLORS.textDark, display: "block" }}>
                    {s.name}
                  </span>
                  {s.detail && (
                    <span style={{ ...TYPE.caption, color: COLORS.textGray, display: "block" }}>
                      {s.detail}
                    </span>
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
      <style>{`@keyframes location-search-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
