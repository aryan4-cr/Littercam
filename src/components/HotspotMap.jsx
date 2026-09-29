import React, { useEffect, useRef, useState } from 'react';
import { MapPin, AlertTriangle, Users, Car, Eye, Info } from 'lucide-react';
import { SEED_VIOLATIONS, SEED_REPORTS } from '../data/seedData';

/**
 * LitterCam — Unified Hotspot Heatmap
 * ====================================================
 * SIMULATED DATA — PROTOTYPE ONLY
 *
 * Renders two layers on the same Google Maps view:
 *   🔴 Red markers = AI-detected CCTV violations (SEED_VIOLATIONS)
 *   🟡 Yellow markers = Citizen-submitted reports (SEED_REPORTS)
 *
 * Gracefully degrades to a coordinate table if VITE_GOOGLE_MAPS_API_KEY is absent.
 * ====================================================
 */

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Build marker datasets from seed data
const VIOLATION_MARKERS = SEED_VIOLATIONS.map(v => ({
  lat: v.gps.lat,
  lng: v.gps.lng,
  label: v.subType || v.type,
  detail: v.locationAddress,
  type: 'violation',
  icon: '🔴',
  fine: v.fineAmount,
  id: v.id,
}));

const REPORT_MARKERS = SEED_REPORTS.map(r => ({
  lat: r.location.lat,
  lng: r.location.lng,
  label: r.title,
  detail: r.location.address,
  type: 'report',
  icon: '🟡',
  status: r.status,
  id: r.id,
}));

const ALL_MARKERS = [...VIOLATION_MARKERS, ...REPORT_MARKERS];

// Fallback table component when no Maps API key
function CoordinateTable() {
  const [filter, setFilter] = useState('all');
  const visible = ALL_MARKERS.filter(m => filter === 'all' || m.type === filter);

  return (
    <div className="space-y-4">
      <div className="bg-amber-950/30 border border-amber-800/60 rounded-lg p-3 flex items-start gap-3">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-300">
          <span className="font-bold">Google Maps API key not configured.</span>
          {' '}Add <code className="font-mono bg-slate-900 px-1 rounded text-amber-200">VITE_GOOGLE_MAPS_API_KEY</code> to your <code className="font-mono bg-slate-900 px-1 rounded text-amber-200">.env.local</code> to enable the live heatmap.
          Showing incident coordinates in table mode below.
        </div>
      </div>

      <div className="flex gap-2 text-xs font-semibold">
        {[['all', 'All Incidents'], ['violation', '🔴 AI Violations'], ['report', '🟡 Citizen Reports']].map(([val, lab]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${filter === val
              ? 'bg-blue-900 text-blue-300 border-blue-700'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'}`}>
            {lab}
          </button>
        ))}
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-xs">
            <thead className="sticky top-0">
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="text-left px-4 py-2.5">Source</th>
                <th className="text-left px-4 py-2.5">Label</th>
                <th className="text-left px-4 py-2.5">Coordinates</th>
                <th className="text-left px-4 py-2.5">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900">
              {visible.map((m, i) => (
                <tr key={m.id || i} className="hover:bg-slate-800/30">
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                      m.type === 'violation'
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
                      {m.icon} {m.type === 'violation' ? 'AI Detect' : 'Citizen'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-200 max-w-[200px] truncate">{m.label}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-400 text-[10px]">
                    {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 max-w-[200px] truncate">{m.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Live Google Maps component
function LiveMap() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [selected, setSelected] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.google && window.google.maps) {
      initMap();
      return;
    }

    const existing = document.getElementById('gmap-script');
    if (existing) {
      existing.addEventListener('load', initMap);
      return;
    }

    const script = document.createElement('script');
    script.id = 'gmap-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=visualization`;
    script.async = true;
    script.defer = true;
    script.onload = initMap;
    document.head.appendChild(script);

    return () => script.removeEventListener('load', initMap);
  }, []);

  function initMap() {
    if (!mapRef.current || mapInstance.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 20.5937, lng: 78.9629 }, // center of India
      zoom: 5,
      mapTypeId: 'roadmap',
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c1a2e' }] },
      ],
    });
    mapInstance.current = map;

    const infoWindow = new window.google.maps.InfoWindow();

    // Place all markers
    ALL_MARKERS.forEach(m => {
      const isViolation = m.type === 'violation';
      const marker = new window.google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map,
        title: m.label,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: isViolation ? '#f87171' : '#fbbf24',
          fillOpacity: 0.95,
          strokeColor: isViolation ? '#fca5a5' : '#fde68a',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => {
        setSelected(m);
        infoWindow.setContent(`
          <div style="background:#1e293b;color:#e2e8f0;padding:10px;border-radius:8px;font-family:system-ui;max-width:220px">
            <div style="font-size:11px;font-weight:700;color:${isViolation ? '#fca5a5' : '#fde68a'};margin-bottom:4px">
              ${isViolation ? '🔴 AI Detected Violation' : '🟡 Citizen Report'}
            </div>
            <div style="font-size:12px;font-weight:600;margin-bottom:4px">${m.label}</div>
            <div style="font-size:11px;color:#94a3b8">${m.detail}</div>
            ${m.fine ? `<div style="font-size:11px;color:#f87171;margin-top:4px;font-weight:700">Fine: ₹${m.fine}</div>` : ''}
            ${m.status ? `<div style="font-size:10px;color:#94a3b8;margin-top:4px;text-transform:uppercase">${m.status}</div>` : ''}
          </div>
        `);
        infoWindow.open(map, marker);
      });
    });

    setLoaded(true);
  }

  return (
    <div className="space-y-3">
      <div ref={mapRef} className="w-full h-[460px] rounded-xl border border-slate-700 overflow-hidden bg-slate-950">
        {!loaded && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs text-slate-400">Loading Google Maps…</p>
            </div>
          </div>
        )}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-6 px-2 text-xs font-semibold text-slate-300">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-400 inline-block"></span> AI-Detected CCTV Violations ({VIOLATION_MARKERS.length})</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span> Citizen-Submitted Reports ({REPORT_MARKERS.length})</div>
      </div>
    </div>
  );
}

export default function HotspotMap() {
  const hasKey = Boolean(MAPS_API_KEY);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MapPin className="w-5 h-5 text-blue-400" />
        <div>
          <h3 className="text-sm font-bold text-slate-200">Unified Hotspot Map</h3>
          <p className="text-[11px] text-slate-400">AI-detected violations + citizen reports on one view · SIMULATED DATA</p>
        </div>
        <div className="ml-auto flex gap-3 text-[11px] font-semibold text-slate-400">
          <span><Car className="w-3.5 h-3.5 inline mr-1 text-rose-400" />{VIOLATION_MARKERS.length} violations</span>
          <span><Users className="w-3.5 h-3.5 inline mr-1 text-amber-400" />{REPORT_MARKERS.length} reports</span>
        </div>
      </div>
      {hasKey ? <LiveMap /> : <CoordinateTable />}
    </div>
  );
}
