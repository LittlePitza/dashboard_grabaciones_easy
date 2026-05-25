'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/lib/store';
import type { Location, Checkin } from '@/types';

const STORAGE_BUCKET = 'checkin-fotos';

export function useData() {
  const {
    setLocations, setCheckins, updateLastCheckins,
    setSyncStatus, addToast,
    updateLocation, removeLocation,
    updateCheckin, removeCheckin, addCheckin,
  } = useAppStore();

  const loadAll = useCallback(async () => {
    const sb = createClient();
    try {
      const [locRes, ciRes] = await Promise.all([
        sb.from('locations').select('*').order('name'),
        sb.from('checkins').select('*').order('date', { ascending: false }),
      ]);
      if (locRes.error) throw locRes.error;
      if (ciRes.error) throw ciRes.error;
      setLocations(locRes.data as Location[]);
      setCheckins(ciRes.data as Checkin[]);
      updateLastCheckins();
      setSyncStatus('online');
    } catch (e: any) {
      addToast('Error cargando datos: ' + e.message, 'error');
      setSyncStatus('local');
    }
  }, [setLocations, setCheckins, updateLastCheckins, setSyncStatus, addToast]);

  const saveLoc = useCallback(async (loc: Location): Promise<boolean> => {
    const sb = createClient();
    const { error } = await sb.from('locations').upsert(loc);
    if (error) { addToast('Error: ' + error.message, 'error'); return false; }
    updateLocation(loc);
    updateLastCheckins();
    addToast(loc.created_at ? 'Locación actualizada' : 'Locación creada', 'success');
    return true;
  }, [updateLocation, updateLastCheckins, addToast]);

  const deleteLoc = useCallback(async (id: string): Promise<boolean> => {
    const sb = createClient();
    const { error } = await sb.from('checkins').delete().eq('location_id', id);
    if (error) { addToast('Error: ' + error.message, 'error'); return false; }
    const { error: e2 } = await sb.from('locations').delete().eq('id', id);
    if (e2) { addToast('Error: ' + e2.message, 'error'); return false; }
    removeLocation(id);
    addToast('Locación eliminada', 'success');
    return true;
  }, [removeLocation, addToast]);

  const saveCheckin = useCallback(async (
    ci: Checkin,
    fotoFile?: File | null
  ): Promise<boolean> => {
    const sb = createClient();
    let fotoUrl = ci.foto_url ?? null;

    // Subir foto si hay archivo
    if (fotoFile) {
      const ext = (fotoFile.name.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${ci.id}.${ext}`;
      const { error: uploadErr } = await sb.storage
        .from(STORAGE_BUCKET)
        .upload(path, fotoFile, { upsert: true, contentType: fotoFile.type });
      if (uploadErr) {
        addToast('Error subiendo foto: ' + uploadErr.message, 'error');
        return false;
      }
      const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      fotoUrl = data.publicUrl;
    }

    const finalCi = { ...ci, foto_url: fotoUrl };
    const { error } = await sb.from('checkins').upsert(finalCi);
    if (error) { addToast('Error: ' + error.message, 'error'); return false; }

    updateCheckin(finalCi);
    updateLastCheckins();
    addToast('Check-in guardado', 'success');
    return true;
  }, [updateCheckin, updateLastCheckins, addToast]);

  const deleteCheckin = useCallback(async (id: string): Promise<boolean> => {
    const sb = createClient();
    const { error } = await sb.from('checkins').delete().eq('id', id);
    if (error) { addToast('Error: ' + error.message, 'error'); return false; }
    removeCheckin(id);
    updateLastCheckins();
    addToast('Check-in eliminado', 'success');
    return true;
  }, [removeCheckin, updateLastCheckins, addToast]);

  const updateCheckinEstado = useCallback(async (
    id: string,
    estado: Checkin['estado']
  ): Promise<boolean> => {
    const sb = createClient();
    const { error } = await sb.from('checkins').update({ estado }).eq('id', id);
    if (error) { addToast('Error: ' + error.message, 'error'); return false; }
    const { checkins } = useAppStore.getState();
    const ci = checkins.find((c) => c.id === id);
    if (ci) updateCheckin({ ...ci, estado });
    return true;
  }, [updateCheckin, addToast]);

  return {
    loadAll,
    saveLoc,
    deleteLoc,
    saveCheckin,
    deleteCheckin,
    updateCheckinEstado,
  };
}
