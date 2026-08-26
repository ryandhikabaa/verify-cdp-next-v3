'use client';

import {useCallback, useState} from 'react';
import {ApiClientError, fetchApi} from '@/lib/api-client';
import type {PatternDoc} from '@/lib/types';

/** Manages stored pattern documents and selection state. */
export function usePatternLibrary(apiBase: string) {
  const [docsList, setDocsList] = useState<PatternDoc[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [dbMessage, setDbMessage] = useState('Menghubungkan database...');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  /** Loads the full stored pattern catalog from the backend. */
  const loadPatterns = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const result = await fetchApi<PatternDoc[]>(`${apiBase}/patterns`, {cache: 'no-store'});
      setDocsList(result.data);
      setDbMessage(`Database aktif: ${result.data.length} pattern tersimpan`);
      setHasLoaded(true);
    } catch (error) {
      console.error('Database fetch failed:', error);
      const message = error instanceof ApiClientError ? error.message : 'Database belum aktif. Pastikan PostgreSQL aktif lalu jalankan workspace Next.js.';
      setLoadError(message);
      setDbMessage(message);
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  /** Deletes one stored pattern and refreshes the catalog snapshot. */
  const deleteDoc = useCallback(async (docId: string) => {
    try {
      await fetchApi(`${apiBase}/patterns/${encodeURIComponent(docId)}`, {method: 'DELETE'});
      setSelectedDocIds((current) => current.filter((id) => id !== docId));
      await loadPatterns();
      setDbMessage(`Pattern ${docId} dihapus`);
    } catch (error) {
      console.error('Delete pattern failed:', error);
      setDbMessage(error instanceof ApiClientError ? error.message : 'Gagal menghapus pattern');
    }
  }, [apiBase, loadPatterns]);

  /** Deletes multiple stored patterns and refreshes the catalog snapshot once. */
  const deleteDocs = useCallback(async (docIds: string[]) => {
    const uniqueDocIds = Array.from(new Set(docIds)).filter(Boolean);
    if (uniqueDocIds.length === 0) return;

    try {
      await Promise.all(uniqueDocIds.map((docId) => fetchApi(`${apiBase}/patterns/${encodeURIComponent(docId)}`, {method: 'DELETE'})));
      setSelectedDocIds((current) => current.filter((id) => !uniqueDocIds.includes(id)));
      await loadPatterns();
      setDbMessage(`${uniqueDocIds.length} pattern dihapus`);
    } catch (error) {
      console.error('Bulk delete patterns failed:', error);
      setDbMessage(error instanceof ApiClientError ? error.message : 'Gagal menghapus beberapa pattern');
    }
  }, [apiBase, loadPatterns]);

  /** Toggles a single pattern ID in the current multi-selection set. */
  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocIds((current) =>
      current.includes(docId) ? current.filter((id) => id !== docId) : [...current, docId],
    );
  }, []);

  /** Selects or clears the entire catalog in one action. */
  const selectAllDocs = useCallback(() => {
    setSelectedDocIds((current) => (current.length === docsList.length ? [] : docsList.map((doc) => doc.id)));
  }, [docsList]);

  /** Selects or clears a filtered subset of documents. */
  const selectDocs = useCallback((docIds: string[]) => {
    setSelectedDocIds((current) => {
      const allSelected = docIds.length > 0 && docIds.every((id) => current.includes(id));
      return allSelected
        ? current.filter((id) => !docIds.includes(id))
        : Array.from(new Set([...current, ...docIds]));
    });
  }, []);

  return {
    docsList,
    selectedDocIds,
    dbMessage,
    isLoading,
    hasLoaded,
    loadError,
    setDbMessage,
    loadPatterns,
    deleteDoc,
    deleteDocs,
    toggleDocSelection,
    selectAllDocs,
    selectDocs,
  };
}
