import { useEffect, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

import type { FlightAirport } from '@/services/contracts'
import { searchAirports } from '@/services/itinerary-service'

interface AirportSelectProps {
  id: string
  label: string
  value?: FlightAirport
  onChange: (airport: FlightAirport | undefined) => void
  disabled?: boolean
}

const SEARCH_DEBOUNCE_MS = 250

function airportLabel(airport: FlightAirport): string {
  const place = [airport.city, airport.country].filter(Boolean).join(', ')
  return place ? `${airport.iata} · ${airport.name} — ${place}` : `${airport.iata} · ${airport.name}`
}

// Type-ahead airport picker backed by GET /airports. A selected airport shows as
// a chip; clearing it re-opens the search field.
export function AirportSelect({ id, label, value, onChange, disabled }: AirportSelectProps): ReactElement {
  const { t } = useTranslation('common')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FlightAirport[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = query.trim()
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      if (trimmed.length < 2) {
        setResults([])
        setLoading(false)
        return
      }

      setLoading(true)
      void searchAirports(trimmed, controller.signal)
        .then((airports) => {
          setResults(airports)
          setOpen(true)
        })
        .catch(() => {
          // Aborted or failed — leave the previous results in place.
        })
        .finally(() => {
          setLoading(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const select = (airport: FlightAirport): void => {
    onChange(airport)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="activity-form-panel__field activity-form-panel__airport">
      <label htmlFor={id}>{label}</label>

      {value ? (
        <div className="activity-form-panel__airport-chip">
          <span title={airportLabel(value)}>{airportLabel(value)}</span>
          <button
            type="button"
            className="activity-form-panel__airport-clear"
            onClick={() => onChange(undefined)}
            disabled={disabled}
            aria-label={t('common:clear')}
            title={t('common:clear')}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="activity-form-panel__airport-search">
          <input
            id={id}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            placeholder={t('common:itinerary.dayEditor.flightAirportPlaceholder')}
            autoComplete="off"
            disabled={disabled}
          />
          {open && results.length > 0 ? (
            <ul className="activity-form-panel__airport-results" role="listbox">
              {results.map((airport) => (
                <li key={airport.iata}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      select(airport)
                    }}
                  >
                    {airportLabel(airport)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {!loading && open && query.trim().length >= 2 && results.length === 0 ? (
            <p className="activity-form-panel__help-text">{t('common:itinerary.dayEditor.flightAirportNoResults')}</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
