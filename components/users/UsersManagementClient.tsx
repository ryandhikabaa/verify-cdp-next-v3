"use client";

import {useMemo, useState} from 'react';
import {ChevronLeft, ChevronRight, Pencil, Plus, Search, Shield, Trash2, Users, X} from 'lucide-react';
import {ApiClientError, fetchApi} from '@/lib/api-client';

type UserRecord = {
  id: string;
  nama: string;
  username: string;
  role: string;
  created_at: string;
  updated_at: string;
  last_login: string | null;
};

type UserFormState = {
  nama: string;
  username: string;
  password: string;
};

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];
const roleStyles: Record<string, string> = {
  admin: 'border-cyan-100 bg-cyan-50 text-cyan-800',
};
const dateFormatter = new Intl.DateTimeFormat('id-ID', {dateStyle: 'medium', timeStyle: 'short'});

function emptyForm(): UserFormState {
  return {nama: '', username: '', password: ''};
}

function formatLastLogin(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : 'Belum login';
}

export function UsersManagementClient({initialUsers, currentUserId}: {initialUsers: UserRecord[]; currentUserId: string | null}) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm());
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter(
      (user) => keyword.length === 0 || user.nama.toLowerCase().includes(keyword) || user.username.toLowerCase().includes(keyword),
    );
  }, [search, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedUsers = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, pageSize, safeCurrentPage]);
  const pageStart = filteredUsers.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(safeCurrentPage * pageSize, filteredUsers.length);
  const pageNumbers = Array.from({length: totalPages}, (_, index) => index + 1).filter(
    (page) => page === 1 || page === totalPages || Math.abs(page - safeCurrentPage) <= 1,
  );

  const latestLogin = users
    .filter((user) => user.last_login)
    .sort((a, b) => new Date(b.last_login ?? 0).getTime() - new Date(a.last_login ?? 0).getTime())[0]?.last_login ?? null;

  const resetFeedback = () => {
    setError('');
    setSuccess('');
  };

  const openCreateModal = () => {
    resetFeedback();
    setModalMode('create');
    setEditingUserId(null);
    setForm(emptyForm());
  };

  const openEditModal = (user: UserRecord) => {
    resetFeedback();
    setModalMode('edit');
    setEditingUserId(user.id);
    setForm({nama: user.nama, username: user.username, password: ''});
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingUserId(null);
    setSubmitting(false);
    setForm(emptyForm());
    setError('');
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setSubmitting(true);

    try {
      const url = modalMode === 'edit' && editingUserId ? `/api/users/${editingUserId}` : '/api/users';
      const method = modalMode === 'edit' ? 'PATCH' : 'POST';
      const result = await fetchApi<UserRecord>(url, {
        method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...form, role: 'admin'}),
      });

      if (modalMode === 'edit') {
        setUsers((current) => current.map((user) => (user.id === result.data.id ? result.data : user)));
        setSuccess('User berhasil diperbarui.');
      } else {
        setUsers((current) => [result.data, ...current]);
        setSuccess('User baru berhasil ditambahkan.');
      }

      closeModal();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setError(error.message || 'Gagal menyimpan data user.');
      } else {
        setError('Gagal terhubung ke server.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentUserId) {
      setError('Akun yang sedang aktif tidak bisa dihapus.');
      setDeleteTarget(null);
      return;
    }

    resetFeedback();
    setSubmitting(true);

    try {
      await fetchApi(`/api/users/${deleteTarget.id}`, {method: 'DELETE'});

      setUsers((current) => current.filter((user) => user.id !== deleteTarget.id));
      setDeleteTarget(null);
      setSuccess('User berhasil dihapus.');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setError(error.message || 'Gagal menghapus user.');
      } else {
        setError('Gagal terhubung ke server.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {[
          {label: 'Total Admin', value: users.length, tone: 'bg-cyan-50 text-cyan-700', icon: <Users className="h-4 w-4" />, helper: 'Akun aktif terdaftar'},
          {label: 'Last Active', value: latestLogin ? dateFormatter.format(new Date(latestLogin)) : '—', tone: 'bg-slate-100 text-slate-700', icon: <Shield className="h-4 w-4" />, helper: 'Aktivitas login terakhir'},
        ].map((item) => (
          <div key={item.label} className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{item.label}</div>
              <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${item.tone}`}>{item.icon}</div>
            </div>
            <div className="mt-3 text-[1.7rem] font-black tracking-[-0.05em] text-slate-950">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.helper}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Admin Directory</div>
            <div className="mt-1 text-xs text-slate-500">Daftar akun admin internal.</div>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-3.5 text-sm font-semibold text-white transition hover:bg-cyan-800"
          >
            <Plus className="h-4 w-4" />
            Tambah User
          </button>
        </div>

        <div className="grid gap-3 border-b border-slate-200 bg-white px-4 py-4 lg:grid-cols-[minmax(0,1fr)_130px] lg:px-5">
          <label className="relative block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Cari</span>
            <Search className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari nama atau username"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Per page</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-300"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {success ? <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 lg:px-5">{success}</div> : null}
        {error ? <div className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 lg:px-5">{error}</div> : null}

        {paginatedUsers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Belum ada user yang sesuai filter.</div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.2fr)_180px_120px_180px_180px_92px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 lg:grid">
              <div>Nama</div>
              <div>Username</div>
              <div>Tipe</div>
              <div>Login Terakhir</div>
              <div>Dibuat</div>
              <div>Aksi</div>
            </div>

            <div className="divide-y divide-slate-200">
              {paginatedUsers.map((user) => (
                <div key={user.id} className="px-4 py-3 transition hover:bg-slate-50/70 lg:px-5">
                  <div className="rounded-[1.15rem] border border-slate-200 bg-white p-3.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
                    <div className="flex items-start justify-between gap-3 lg:hidden">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-900">{user.nama}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">@{user.username}</div>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${roleStyles.admin}`}>admin</span>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm lg:hidden">
                      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-3 py-2">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Login Terakhir</div>
                          <div className="mt-1 text-xs font-semibold text-slate-700">{formatLastLogin(user.last_login)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Dibuat</div>
                          <div className="mt-1 text-xs font-semibold text-slate-700">{dateFormatter.format(new Date(user.created_at))}</div>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500">ID {user.id.slice(0, 8)}...</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          title="Edit user"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(user)}
                          disabled={user.id === currentUserId}
                          className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
                          title={user.id === currentUserId ? 'User aktif tidak bisa dihapus' : 'Hapus user'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>
                    </div>

                    <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1.2fr)_180px_120px_180px_180px_92px] lg:items-center">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-900">{user.nama}</div>
                        <div className="mt-1 text-xs text-slate-500">ID {user.id.slice(0, 8)}...</div>
                      </div>
                      <div className="min-w-0 text-sm font-semibold text-slate-700">{user.username}</div>
                      <div>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${roleStyles.admin}`}>admin</span>
                      </div>
                      <div className="text-sm text-slate-600">{formatLastLogin(user.last_login)}</div>
                      <div className="text-sm text-slate-600">{dateFormatter.format(new Date(user.created_at))}</div>
                      <div className="flex items-center gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="inline-flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          title="Edit user"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(user)}
                          disabled={user.id === currentUserId}
                          className="inline-flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
                          title={user.id === currentUserId ? 'User aktif tidak bisa dihapus' : 'Hapus user'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-5">
              <div className="text-xs text-slate-500">
                Menampilkan <span className="font-bold text-slate-700">{pageStart}-{pageEnd}</span> dari <span className="font-bold text-slate-700">{filteredUsers.length}</span> user
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <div className="flex items-center gap-1">
                  {pageNumbers.map((pageNumber, index) => {
                    const previousPage = pageNumbers[index - 1];
                    const showEllipsis = index > 0 && previousPage !== undefined && pageNumber - previousPage > 1;

                    return (
                      <div key={pageNumber} className="flex items-center gap-1">
                        {showEllipsis ? <span className="px-1 text-xs text-slate-400">...</span> : null}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[11px] font-semibold transition ${
                            pageNumber === safeCurrentPage
                              ? 'bg-cyan-700 text-white'
                              : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" onClick={closeModal}>
          <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700">{modalMode === 'create' ? 'Tambah admin' : 'Edit admin'}</div>
                <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">
                  {modalMode === 'create' ? 'Buat akun admin baru' : 'Perbarui data admin'}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close user modal"
                onClick={closeModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={submitForm}>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Nama</span>
                <input
                  value={form.nama}
                  onChange={(event) => setForm((current) => ({...current, nama: event.target.value}))}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300"
                  placeholder="Masukkan nama user"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Username</span>
                  <input
                    value={form.username}
                    onChange={(event) => setForm((current) => ({...current, username: event.target.value}))}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300"
                    placeholder="Masukkan username"
                  />
                </label>

                <div className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Tipe Akun</span>
                  <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">admin</div>
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Password {modalMode === 'edit' ? '(opsional)' : ''}
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({...current, password: event.target.value}))}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300"
                  placeholder={modalMode === 'edit' ? 'Isi jika ingin ganti password' : 'Masukkan password'}
                />
              </label>

              {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-cyan-700 px-5 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Menyimpan...' : modalMode === 'create' ? 'Simpan User' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-rose-600">Hapus admin</div>
                <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">Hapus user ini?</h3>
              </div>
              <button
                type="button"
                aria-label="Close delete dialog"
                onClick={() => setDeleteTarget(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-500">
              User <span className="font-semibold text-slate-800">{deleteTarget.nama}</span> dengan username <span className="font-mono font-bold text-slate-800">{deleteTarget.username}</span> akan dihapus dari sistem.
            </p>

            {deleteTarget.id === currentUserId ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Akun yang sedang aktif tidak bisa dihapus.
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={submitting || deleteTarget.id === currentUserId}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Menghapus...' : 'Ya, hapus'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}