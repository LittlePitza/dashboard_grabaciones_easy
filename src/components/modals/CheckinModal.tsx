'use client';

import { useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { useData } from '@/hooks/useData';
import { genId, today, ESTADOS } from '@/lib/utils';
import type { Checkin, Location } from '@/types';

interface Props {
  /** Si se pasa, la locacion viene preseleccionada y no se puede cambiar */
  locationId?: string;
  onClose: () => void;
}

export function CheckinModal({ locationId, onClose }: Props) {
  const { locations, addCheckin } = useAppStore() as any;
  const { saveCheckin } = useData();

  const [locId, setLocId]       = useState(locationId ?? '');
  const [fecha, setFecha]       = useState(today());
  const [estado, setEstado]     = useState<Checkin['estado']>('grabado');
  const [notes, setNotes]       = useState('');
  const [link, setLink]         = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sortedLocs = [...(locations as Location[])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFotoFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!locId) return;
    setLoading(true);

    const ci: Checkin = {
      id:          genId(),
      location_id: locId,
      date:        fecha,
      estado,
      notes:       notes.trim() || null,
      link:        link.trim() || null,
      foto_url:    null,
      created_at:  new Date().toISOString(),
      estado_history: [],
    };

    // Optimistic insert so the list updates immediately
    addCheckin(ci);

    const ok = await saveCheckin(ci, fotoFile);
    setLoading(false);

    if (ok) {
      onClose();
    } else {
      // Revert optimistic insert on failure — store will overwrite on next loadAll
    }
  };

  const ESTADO_COLOR: Record<string, string> = {
    grabado:    'var(--color-primary)',
    en_edicion: 'var(--color-gold)',
    editado:    'var(--color-orange)',
    publicado:  'var(--color-success)',
  };

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Nuevo check-in</h2>
          <button className="icon-btn" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {/* Locacion */}
          <div className="field">
            <label>Locacion *</label>
            {locationId ? (
              <div style={{
                padding: '8px 12px',
                background: 'var(--color-surface-offset)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                border: '1px solid var(--color-border)',
              }}>
                {sortedLocs.find((l: Location) => l.id === locationId)?.name ?? locationId}
              </div>
            ) : (
              <select
                className="field-input"
                value={locId}
                onChange={e => setLocId(e.target.value)}
              >
                <option value="">Seleccionar locacion…</option>
                {sortedLocs.map((l: Location) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Fecha + Estado */}
          <div className="field-row">
            <div className="field">
              <label>Fecha</label>
              <input
                type="date"
                className="field-input"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                max={today()}
              />
            </div>
            <div className="field">
              <label>Estado inicial</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ESTADOS.map(s => {
                  const active = estado === s.key;
                  const color  = ESTADO_COLOR[s.key];
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setEstado(s.key)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 99,
                        border: `1px solid ${active ? color : 'var(--color-border)'}`,
                        background: active
                          ? `color-mix(in srgb,${color} 20%,transparent)`
                          : 'transparent',
                        color: active ? color : 'var(--color-text-muted)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all .12s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="field">
            <label>Notas</label>
            <textarea
              className="field-input"
              rows={2}
              placeholder="Observaciones, contexto, etc."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Link */}
          <div className="field">
            <label>Link (video, drive, etc.)</label>
            <input
              type="url"
              className="field-input"
              placeholder="https://…"
              value={link}
              onChange={e => setLink(e.target.value)}
            />
          </div>

          {/* Foto */}
          <div className="field">
            <label>Foto</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFoto}
            />
            {preview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={preview}
                  alt="preview"
                  style={{
                    width: '100%',
                    maxHeight: 180,
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => { setFotoFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,.6)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  x
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileRef.current?.click()}
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Adjuntar foto
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || !locId}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Guardando…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Guardar check-in
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
