'use client';

import 'leaflet/dist/leaflet.css';
import {useEffect, useMemo, useState} from 'react';
import {MapPin, Radar} from 'lucide-react';
import {MapContainer, Marker, Popup, TileLayer, useMap} from 'react-leaflet';
import L, {type DivIcon} from 'leaflet';

type VerificationMapPoint = {
  id: string;
  label: string;
  status: 'AUTHENTIC' | 'COUNTERFEIT' | 'MISMATCH' | string;
  latitude: number;
  longitude: number;
  source: string;
  createdAt: string;
};

const jakartaCenter: [number, number] = [-6.2, 106.816666];

function MapAutoFit({points}: {points: VerificationMapPoint[]}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return undefined;

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 15, {animate: true});
      return undefined;
    }

    const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude] as [number, number]));
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    const latSpread = Math.abs(northEast.lat - southWest.lat);
    const lngSpread = Math.abs(northEast.lng - southWest.lng);
    const spread = Math.max(latSpread, lngSpread);

    const maxZoom = spread < 0.03 ? 15 : spread < 0.08 ? 14 : spread < 0.2 ? 13 : spread < 0.6 ? 11 : 9;

    map.fitBounds(bounds, {padding: [24, 24], maxZoom, animate: true});
    return undefined;
  }, [map, points]);

  return null;
}

function getMarkerClassName(status: VerificationMapPoint['status']) {
  if (status === 'AUTHENTIC') return 'verification-map-marker verification-map-marker--authentic';
  if (status === 'COUNTERFEIT') return 'verification-map-marker verification-map-marker--counterfeit';
  return 'verification-map-marker verification-map-marker--mismatch';
}

function createMarkerIcon(status: VerificationMapPoint['status']): DivIcon {
  return L.divIcon({
    className: 'verification-map-marker-wrapper',
    html: `<span class="${getMarkerClassName(status)}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function VerificationMapCard({points}: {points: VerificationMapPoint[]}) {
  const hasPoints = points.length > 0;
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'AUTHENTIC' | 'COUNTERFEIT' | 'MISMATCH'>('ALL');
  const center: [number, number] = hasPoints ? [points[0].latitude, points[0].longitude] : jakartaCenter;
  const filteredPoints = useMemo(() => {
    if (activeFilter === 'ALL') return points;
    return points.filter((point) => point.status === activeFilter);
  }, [activeFilter, points]);
  const topAreas = useMemo(() => {
    const buckets = new Map<string, {label: string; count: number}>();
    for (const point of filteredPoints) {
      const label = `${point.latitude.toFixed(2)}, ${point.longitude.toFixed(2)}`;
      const key = `${point.latitude.toFixed(2)}|${point.longitude.toFixed(2)}`;
      const current = buckets.get(key);
      buckets.set(key, {label, count: (current?.count ?? 0) + 1});
    }

    return [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [filteredPoints]);

  return (
    <div className="mt-4 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] lg:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-500 shadow-[0_6px_18px_rgba(15,23,42,0.03)] backdrop-blur-sm">
            <Radar className="h-3.5 w-3.5 text-cyan-700" />
            Geo Intelligence
          </div>
          <div className="mt-3 text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Peta Persebaran Verifikasi</div>
          <div className="mt-1 max-w-xl text-[13px] font-medium leading-6 text-slate-500">
            Visual persebaran yang ringkas, eksklusif, dan fokus pada insight lokasi yang paling relevan.
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            {label: 'All', value: 'ALL'},
            {label: 'Authentic', value: 'AUTHENTIC'},
            {label: 'Counterfeit', value: 'COUNTERFEIT'},
            {label: 'Mismatch', value: 'MISMATCH'},
          ].map((filter) => {
            const isActive = activeFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value as 'ALL' | 'AUTHENTIC' | 'COUNTERFEIT' | 'MISMATCH')}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${isActive ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] font-semibold text-slate-600">
          Menampilkan <span className="font-black text-slate-950">{filteredPoints.length}</span> titik aktif
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[1.45rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.98))]">
        {filteredPoints.length > 0 ? (
          <>
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="h-[420px] w-full verification-map-surface xl:h-[460px]">
                <MapContainer center={center} zoom={8} scrollWheelZoom className="h-full w-full" attributionControl={false}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapAutoFit points={filteredPoints} />
                  {filteredPoints.map((point) => (
                  <Marker key={point.id} position={[point.latitude, point.longitude]} icon={createMarkerIcon(point.status)}>
                    <Popup>
                      <div className="min-w-[180px] text-sm text-slate-700">
                        <div className="font-black text-slate-950">{point.label}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">{point.status}</div>
                        <div className="mt-2 text-xs text-slate-500">Source: {point.source || '-'}</div>
                        <div className="text-xs text-slate-500">{formatDateTime(point.createdAt)}</div>
                        <div className="mt-2 font-mono text-[11px] text-slate-600">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</div>
                      </div>
                    </Popup>
                  </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className="border-t border-slate-200 bg-white/90 xl:border-t-0 xl:border-l">
                <div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.98))] px-4 py-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Area Highlights</div>
                  <div className="mt-1 text-sm font-medium leading-6 text-slate-600">Konsentrasi titik aktif paling dominan.</div>
                </div>
                <div className="space-y-3 p-4">
                  {topAreas.length > 0 ? topAreas.map((area, index) => (
                    <div key={area.label} className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Zone {index + 1}</div>
                          <div className="mt-1 font-mono text-[12px] font-bold text-slate-900">{area.label}</div>
                        </div>
                        <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                          {area.count} titik
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">Belum ada cluster area.</div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-3 border-t border-slate-200 bg-white/85 px-4 py-4 md:grid-cols-3 lg:grid-cols-4">
              <LegendItem tone="authentic" label="Authentic" />
              <LegendItem tone="counterfeit" label="Counterfeit" />
              <LegendItem tone="mismatch" label="Mismatch" />
              <div className="hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 lg:block">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Insight</div>
                <div className="mt-1 text-sm font-medium text-slate-700">Zoom otomatis difokuskan pada area paling relevan.</div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <div className="text-base font-black text-slate-950">Belum ada titik verifikasi</div>
              <div className="mt-1 text-sm text-slate-500">Data lokasi akan tampil setelah verifikasi mengirim latitude dan longitude.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendItem({tone, label}: {tone: 'authentic' | 'counterfeit' | 'mismatch'; label: string}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
      <span className={`verification-map-marker ${tone === 'authentic' ? 'verification-map-marker--authentic' : tone === 'counterfeit' ? 'verification-map-marker--counterfeit' : 'verification-map-marker--mismatch'}`} />
      <span className="text-sm font-semibold text-slate-700">{label}</span>
    </div>
  );
}
