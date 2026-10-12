"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AddressComponents } from "@/types";
import { autocomplete, reverseGeocode, type PlaceSuggestion } from "@/lib/placesClient";
import { BUSINESS } from "@/lib/config";

/* ── Component ──────────────────────────────────────────────────────────── */

interface AddressPickerProps {
  /** Current structured address value (null if not yet set). */
  value: AddressComponents | null;
  /** Called whenever any field changes. Emits null when the address is cleared. */
  onChange: (addr: AddressComponents | null) => void;
}

/**
 * A structured, delivery-optimised address collection widget.
 *
 * Flow:
 *  Step 1 — Main address: Ola Maps search-as-you-type OR
 *            "📍 My location" button (GPS + reverse geocode).
 *  Step 2 — Drop-off details: mandatory Flat/Building field + optional Landmark.
 *
 * Emits a complete `AddressComponents` object containing coordinates,
 * verified address string, door/building, landmark, city, pincode, and state
 * (the state feeds the CGST+SGST vs IGST decision at checkout).
 *
 * Uses Ola Maps (https://maps.olakrutrim.com) for address search and reverse
 * geocoding, proxied server-side through /api/maps/* so the API key never
 * reaches the browser.
 */
export function AddressPicker({ value, onChange }: AddressPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Internal state — each piece can change independently.
  const [query, setQuery] = useState(value?.displayAddress ?? "");
  const [mainAddress, setMainAddress] = useState(value?.displayAddress ?? "");
  const [doorAndBuilding, setDoorAndBuilding] = useState(value?.doorAndBuilding ?? "");
  const [landmark, setLandmark] = useState(value?.landmark ?? "");
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
    placeId?: string;
  } | null>(value ? { lat: value.lat, lng: value.lng, placeId: value.placeId } : null);
  const [cityPincode, setCityPincode] = useState<{ city: string; pincode: string; state?: string }>({
    city: value?.city ?? "",
    pincode: value?.pincode ?? "",
    state: value?.state,
  });

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  /* ── Debounced search-as-you-type ───────────────────────────────────── */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Don't re-search right after picking a suggestion (query === mainAddress).
    if (!query.trim() || query === mainAddress) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearchLoading(true);
      try {
        const results = await autocomplete(query, controller.signal, BUSINESS.lat, BUSINESS.lng);
        setSuggestions(results);
        setShowSuggestions(true);
        setActiveIndex(-1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[AddressPicker] Ola Maps search failed:", err);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mainAddress]);

  /* ── Emit updated AddressComponents whenever any piece changes ──────── */
  useEffect(() => {
    if (!coords || !mainAddress) {
      onChange(null);
      return;
    }
    onChange({
      lat: coords.lat,
      lng: coords.lng,
      placeId: coords.placeId,
      displayAddress: mainAddress,
      doorAndBuilding,
      landmark: landmark.trim() || undefined,
      city: cityPincode.city,
      pincode: cityPincode.pincode,
      state: cityPincode.state ?? "",
    });
    // onChange is intentionally excluded — including it would cause infinite loops
    // if the parent re-creates the callback on every render. Parent should memoize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, mainAddress, doorAndBuilding, landmark, cityPincode.city, cityPincode.pincode, cityPincode.state]);

  const pickSuggestion = useCallback((s: PlaceSuggestion) => {
    setQuery(s.label);
    setMainAddress(s.label);
    setCoords({ lat: s.lat, lng: s.lng, placeId: s.placeId });
    setCityPincode({ city: s.city, pincode: s.pincode, state: s.state });
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);

    // Ola's autocomplete predictions don't include city/pincode/state — fill
    // them in with a reverse geocode against the picked point.
    if (!s.city && !s.pincode) {
      reverseGeocode(s.lat, s.lng)
        .then((result) => {
          if (result) setCityPincode({ city: result.city, pincode: result.pincode, state: result.state });
        })
        .catch((err) => console.error("[AddressPicker] reverse geocode after pick failed:", err));
    }
  }, []);

  /* ── Keyboard navigation for the suggestions list ───────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        pickSuggestion(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  /* ── GPS location handler ───────────────────────────────────────────── */
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const result = await reverseGeocode(lat, lng);
          setGpsLoading(false);
          if (result) {
            setMainAddress(result.label);
            setQuery(result.label);
            setCoords({ lat, lng, placeId: result.placeId });
            setCityPincode({ city: result.city, pincode: result.pincode, state: result.state });
          } else {
            setCoords({ lat, lng });
            setGpsError(
              "Got your location but couldn't look up the address. " +
                "Please type your area in the box above.",
            );
          }
        } catch (err) {
          console.error("[AddressPicker] reverse geocode failed:", err);
          setGpsLoading(false);
          setCoords({ lat, lng });
          setGpsError(
            "Got your location but couldn't look up the address. " +
              "Please type your area in the box above.",
          );
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError(
            "Location access was denied. Please type your address in the box above.",
          );
        } else {
          setGpsError("Couldn't get your location. Please type your address.");
        }
      },
      { timeout: 12000, maximumAge: 30000 },
    );
  };

  const addressConfirmed = !!coords && !!mainAddress;

  return (
    <div className="space-y-3">
      {/* ── Step 1: Main address input ─────────────────────────────────── */}
      <div className="relative">
        <input
          ref={inputRef}
          id="address-search"
          type="text"
          className="field pr-32"
          placeholder="Search your street, area or building…"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            if (!v) {
              setMainAddress("");
              setCoords(null);
              onChange(null);
              setSuggestions([]);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Delivery address search"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-autocomplete="list"
          role="combobox"
        />
        <button
          type="button"
          onClick={handleUseLocation}
          disabled={gpsLoading}
          className="absolute right-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-turmericgold/20 px-2.5 py-1 text-xs font-semibold text-paprika transition hover:bg-turmericgold/30 disabled:opacity-50"
          aria-label="Detect my location"
        >
          {gpsLoading ? "Locating…" : "📍 My location"}
        </button>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <ul
            ref={listRef}
            role="listbox"
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-paper shadow-lift"
          >
            {suggestions.map((s, i) => (
              <li key={`${s.placeId ?? `${s.lat}-${s.lng}`}-${i}`} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-cardamom/60 ${
                    i === activeIndex ? "bg-cardamom/60" : ""
                  }`}
                  onMouseDown={(e) => e.preventDefault()} // keep focus so onBlur doesn't fire first
                  onClick={() => pickSuggestion(s)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {searchLoading && (
          <p className="mt-1 text-xs text-soft" aria-live="polite">
            Searching…
          </p>
        )}
      </div>

      {gpsError && (
        <p role="alert" className="text-xs font-medium text-terracotta">
          {gpsError}
        </p>
      )}

      {/* Confirmed address badge */}
      {addressConfirmed && (
        <div className="flex items-start gap-2 rounded-xl border border-ok/30 bg-ok/5 px-3 py-2.5 text-xs">
          <span className="mt-0.5 shrink-0 text-ok" aria-hidden>
            ✓
          </span>
          <p className="font-semibold text-clove">{mainAddress}</p>
        </div>
      )}

      {/* Hint when nothing is confirmed yet */}
      {!addressConfirmed && !gpsError && (
        <p className="text-xs text-soft">
          Type your area or building name above, or tap{" "}
          <span className="font-semibold">📍 My location</span> to auto-fill.
        </p>
      )}

      {/* ── Step 2: Drop-off specifics — shown only after main address is set ── */}
      {addressConfirmed && (
        <div className="space-y-3 rounded-xl border border-line bg-cardamom/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-soft">
            Drop-off details
          </p>

          <div>
            <label
              htmlFor="door-and-building"
              className="mb-1.5 block text-sm font-semibold"
            >
              Flat / House No. / Floor / Building{" "}
              <span className="text-terracotta" aria-hidden>
                *
              </span>
            </label>
            <input
              id="door-and-building"
              type="text"
              className="field"
              placeholder="e.g. Flat 4B, 3rd Floor, Prestige Tower"
              value={doorAndBuilding}
              onChange={(e) => setDoorAndBuilding(e.target.value)}
              required
              minLength={3}
              aria-required="true"
            />
            <p className="mt-1 text-xs text-soft">
              This is what the delivery driver needs to find your exact door.
            </p>
          </div>

          <div>
            <label
              htmlFor="landmark"
              className="mb-1.5 block text-sm font-semibold"
            >
              Landmark{" "}
              <span className="text-xs font-normal text-soft">
                (optional — helps the driver)
              </span>
            </label>
            <input
              id="landmark"
              type="text"
              className="field"
              placeholder="e.g. Opposite Metro Station, Near HDFC Bank"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
