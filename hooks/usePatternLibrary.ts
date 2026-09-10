'use client';

import {useCallback, useRef, useState} from 'react';
import {ApiClientError, fetchApi} from '@/lib/api-client';
import type {PatternDoc} from '@/lib/types';

export type PatternFilters = {
  search: string;
  seedLength: number;
  day: string;
  sort: 'newest' | 'oldest';
};

export type PatternListResponse = {
  items: PatternDoc[];
  total: number;
  totalAll: number;
  page: number;
  pageSize: number;
};

export type PatternIdsResponse = {
  ids: string[];
  total: number;
  totalAll: number;
};

export const DEFAULT_PATTERN_FILTERS: PatternFilters = {
  search: '',
  seedLength: 0,
  day: '',
  sort: 'newest',
};

function buildListQuery(filters: PatternFilters, page: number, pageSize: number) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort: filters.sort === 'newest' ? 'desc' : 'asc',
  });
  if (filters.search.trim()) query.set('search', filters.search.trim());
  if (filters.seedLength > 0) query.set('seedLength', String(filters.seedLength));
  if (filters.day) query.set('day', filters.day);
  return query.toString();
}

/** Manages the server-paginated pattern catalog and selection state. */
export function usePatternLibrary(apiBase: string) {
  const [docsList, setDocsList] = useState<PatternDoc[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<PatternFilters>(DEFAULT_PATTERN_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [dbMessage, setDbMessage] = useState('Menghubungkan database...');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const requestSeq = useRef(0);

  /** Fetches one server-paginated page for the current filters. */
  const loadPatterns = useCallback(async () => {
    const seq = ++requestSeq.current;
    setIsLoading(true);
    setLoadError('');
    try {
      const result = await fetchApi<PatternListResponse>(
        `${apiBase}/patterns?${buildListQuery(filters, page, pageSize)}`,
        {cache: 'no-store'},
      );
      if (seq !== requestSeq.current) return;
      setDocsList(result.data.items);
      setTotal(result.data.total);
      setTotalAll(result.data.totalAll);
      setDbMessage(`Database aktif: ${result.data.totalAll} pattern tersimpan`);
      setHasLoaded(true);
    } catch (error) {
      if (seq !== requestSeq.current) return;
      console.error('Database fetch failed:', error);
      const message = error instanceof ApiClientError ? error.message : 'Database belum aktif. Pastikan PostgreSQL aktif lalu jalankan workspace Next.js.';
      setLoadError(message);
      setDbMessage(message);
      setHasLoaded(true);
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [apiBase, filters, page, pageSize]);

  /** Re-runs the current page query (after create/delete). */
  const refresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  /** Looks up full list docs for explicit IDs (selection preview, checks). */
  const lookupDocs = useCallback(async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return [];
    const result = await fetchApi<PatternDoc[]>(`${apiBase}/patterns/lookup`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ids: uniqueIds}),
    });
    return result.data;
  }, [apiBase]);

  /** Returns every ID matching the current filters, for select-all-filtered. */
  const fetchFilteredIds = useCallback(async () => {
    const result = await fetchApi<PatternIdsResponse>(
      `${apiBase}/patterns?${buildListQuery(filters, 1, pageSize)}&mode=ids`,
      {cache: 'no-store'},
    );
    return result.data.ids;
  }, [apiBase, filters, pageSize]);

  /** Checks which candidate seeds already exist; used for unique-seed generation. */
  const filterExistingSeeds = useCallback(async (candidates: string[]) => {
    if (candidates.length === 0) return new Set<string>();
    const result = await lookupDocs(candidates);
    return new Set(result.map((doc) => doc.id.toUpperCase()));
  }, [lookupDocs]);

  /** Deletes one stored pattern and refreshes the current page. */
  const deleteDoc = useCallback(async (docId: string) => {
    try {
      await fetchApi(`${apiBase}/patterns/${encodeURIComponent(docId)}`, {method: 'DELETE'});
      setSelectedDocIds((current) => current.filter((id) => id !== docId));
      refresh();
      setDbMessage(`Pattern ${docId} dihapus`);
    } catch (error) {
      console.error('Delete pattern failed:', error);
      setDbMessage(error instanceof ApiClientError ? error.message : 'Gagal menghapus pattern');
    }
  }, [apiBase, refresh]);

  /** Deletes multiple stored patterns and refreshes the current page once. */
  const deleteDocs = useCallback(async (docIds: string[]) => {
    const uniqueDocIds = Array.from(new Set(docIds)).filter(Boolean);
    if (uniqueDocIds.length === 0) return;

    try {
      await Promise.all(uniqueDocIds.map((docId) => fetchApi(`${apiBase}/patterns/${encodeURIComponent(docId)}`, {method: 'DELETE'})));
      setSelectedDocIds((current) => current.filter((id) => !uniqueDocIds.includes(id)));
      refresh();
      setDbMessage(`${uniqueDocIds.length} pattern dihapus`);
    } catch (error) {
      console.error('Bulk delete patterns failed:', error);
      setDbMessage(error instanceof ApiClientError ? error.message : 'Gagal menghapus beberapa pattern');
    }
  }, [apiBase, refresh]);

  /** Toggles a single pattern ID in the current multi-selection set. */
  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocIds((current) =>
      current.includes(docId) ? current.filter((id) => id !== docId) : [...current, docId],
    );
  }, []);

  /** Selects or clears a filtered subset of documents. */
  const selectDocs = useCallback((docIds: string[]) => {
    setSelectedDocIds((current) => {
      const allSelected = docIds.length > 0 && docIds.every((id) => current.includes(id));
      return allSelected
        ? current.filter((id) => !docIds.includes(id))
        : Array.from(new Set([...current, ...docIds]));
    });
  }, []);

  const updateFilters = useCallback((patch: Partial<PatternFilters>) => {
    setFilters((current) => ({...current, ...patch}));
    setPage(1);
  }, []);

  const changePage = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  const changePageSize = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_PATTERN_FILTERS);
    setPage(1);
  }, []);

  return {
    docsList,
    selectedDocIds,
    filters,
    page,
    pageSize,
    total,
    totalAll,
    dbMessage,
    isLoading,
    hasLoaded,
    loadError,
    refreshToken,
    setDbMessage,
    loadPatterns,
    refresh,
    lookupDocs,
    fetchFilteredIds,
    filterExistingSeeds,
    deleteDoc,
    deleteDocs,
    toggleDocSelection,
    selectDocs,
    updateFilters,
    changePage,
    changePageSize,
    resetFilters,
  };
}
