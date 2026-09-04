export type EndpointMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type EndpointAccess = 'Public' | 'Admin';

export type EndpointDocDefinition = {
  id: string;
  group: 'Authentication' | 'Patterns' | 'Mobile' | 'Users & History';
  method: EndpointMethod;
  path: string;
  access: EndpointAccess;
  summary: string;
  description: string;
  queryExample?: Record<string, string>;
  pathParams?: Record<string, string>;
  requestExample?: string;
  responseExample: string;
  errorExamples?: Array<{
    title: string;
    response: string;
  }>;
  responseContract?: string;
};

export const endpointDocs: EndpointDocDefinition[] = [
  {
    id: 'auth-login',
    group: 'Authentication',
    method: 'POST',
    path: '/api/auth/login',
    access: 'Public',
    summary: 'Login admin dan membuat session cookie.',
    description: 'Gunakan endpoint ini untuk autentikasi admin. Jika sukses, cookie session akan diset otomatis oleh browser.',
    requestExample: JSON.stringify({username: 'admin', password: 'secret123'}, null, 2),
    responseExample: JSON.stringify({status: true, message: 'Login successful', data: {id: 'uuid', username: 'admin', role: 'admin'}}, null, 2),
  },
  {
    id: 'auth-logout',
    group: 'Authentication',
    method: 'POST',
    path: '/api/auth/logout',
    access: 'Admin',
    summary: 'Menghapus session aktif.',
    description: 'Mengakhiri sesi login admin aktif dan mengosongkan cookie session.',
    responseExample: JSON.stringify({status: true, message: 'Logout successful', data: null}, null, 2),
  },
  {
    id: 'auth-me',
    group: 'Authentication',
    method: 'GET',
    path: '/api/auth/me',
    access: 'Admin',
    summary: 'Mengambil data session admin saat ini.',
    description: 'Dipakai untuk validasi sesi aktif dan mengambil identitas user login.',
    responseExample: JSON.stringify({status: true, message: 'Current session retrieved', data: {userId: 'uuid', username: 'admin', role: 'admin'}}, null, 2),
  },
  {
    id: 'patterns-list',
    group: 'Patterns',
    method: 'GET',
    path: '/api/patterns',
    access: 'Public',
    summary: 'Mengambil seluruh data pattern tersimpan.',
    description: 'Mengembalikan seluruh katalog pattern yang sudah tersimpan di database.',
    responseExample: JSON.stringify({
      status: true,
      message: 'Patterns retrieved successfully',
      data: [
        {id: 'VERIFY-001', record_id: 1, label: 'VERIFY-001', density: 45, size: 512, style: 'stochastic', payload: 'VERIFY-001', image_data: 'data:image/png;base64,...', created_at: '2026-07-20T10:00:00.000Z', updated_at: '2026-07-20T10:00:00.000Z'},
      ],
    }, null, 2),
  },
  {
    id: 'patterns-create',
    group: 'Patterns',
    method: 'POST',
    path: '/api/patterns',
    access: 'Admin',
    summary: 'Menyimpan atau update satu pattern.',
    description: 'Melakukan insert satu data pattern berdasarkan pattern_payload. Penyimpanan V3.1 membutuhkan metadata QR dari API generate.',
    requestExample: JSON.stringify({id: 'VERIFY-001', label: 'VERIFY-001', density: 45, size: 512, style: 'stochastic', payload: 'VERIFY-001', image_data: 'data:image/png;base64,...'}, null, 2),
    responseExample: JSON.stringify({
      status: true,
      message: 'Pattern saved successfully',
      data: {id: 'VERIFY-001', record_id: 1, label: 'VERIFY-001', density: 45, size: 512, style: 'stochastic', payload: 'VERIFY-001', image_data: 'data:image/png;base64,...', created_at: '2026-07-20T10:00:00.000Z', updated_at: '2026-07-20T10:00:00.000Z'},
    }, null, 2),
  },
  {
    id: 'patterns-batch',
    group: 'Patterns',
    method: 'POST',
    path: '/api/patterns/batch',
    access: 'Admin',
    summary: 'Menyimpan banyak pattern dalam satu request.',
    description: 'Menerima array `docs` untuk batch insert atau update pattern.',
    requestExample: JSON.stringify({docs: [{id: 'VERIFY-001', density: 45, size: 512, style: 'stochastic', payload: 'VERIFY-001', image_data: 'data:image/png;base64,...'}]}, null, 2),
    responseExample: JSON.stringify({
      status: true,
      message: 'Pattern batch saved successfully',
      data: [{id: 'VERIFY-001', record_id: 1, label: 'VERIFY-001', density: 45, size: 512, style: 'stochastic', payload: 'VERIFY-001', image_data: 'data:image/png;base64,...', created_at: '2026-07-20T10:00:00.000Z', updated_at: '2026-07-20T10:00:00.000Z'}],
    }, null, 2),
  },
  {
    id: 'patterns-delete',
    group: 'Patterns',
    method: 'DELETE',
    path: '/api/patterns/:id',
    access: 'Admin',
    summary: 'Menghapus satu pattern berdasarkan pattern_payload.',
    description: 'Menghapus satu record pattern berdasarkan parameter path `id` (`pattern_payload`).',
    pathParams: {id: 'VERIFY-001'},
    responseExample: JSON.stringify({
      status: true,
      message: 'Pattern deleted',
      data: {deleted: {id: 'VERIFY-001', record_id: 1, label: 'VERIFY-001', density: 45, size: 512, style: 'stochastic', payload: 'VERIFY-001', created_at: '2026-07-20T10:00:00.000Z', updated_at: '2026-07-20T10:00:00.000Z'}},
    }, null, 2),
  },
  {
    id: 'patterns-image',
    group: 'Patterns',
    method: 'GET',
    path: '/api/patterns/:id/image',
    access: 'Public',
    summary: 'Mengambil image PNG dari pattern yang tersimpan.',
    description: 'Menghasilkan file image PNG dari serial pattern tertentu.',
    pathParams: {id: 'VERIFY-001'},
    responseExample: 'Binary PNG response',
  },
  {
    id: 'users-list',
    group: 'Users & History',
    method: 'GET',
    path: '/api/users',
    access: 'Admin',
    summary: 'Mengambil daftar akun admin.',
    description: 'Dipakai untuk halaman manajemen user internal.',
    responseExample: JSON.stringify({
      status: true,
      message: 'Users retrieved successfully',
      data: [{id: 'uuid', nama: 'Admin Utama', username: 'admin', role: 'admin', created_at: '2026-07-20T10:00:00.000Z', updated_at: '2026-07-20T10:00:00.000Z', last_login: '2026-07-20T10:05:00.000Z'}],
    }, null, 2),
  },
  {
    id: 'verify-create',
    group: 'Mobile',
    method: 'POST',
    path: '/api/verify',
    access: 'Public',
    summary: 'Verifikasi decode dari scanner mobile.',
    description: 'Dipakai oleh aplikasi mobile setelah scanner berhasil decode. Client menampilkan loading, lalu menunggu hasil akhir dari server. Untuk flow mobile, respons yang disarankan cukup ringan: status hasil verifikasi dan notes.',
    requestExample: JSON.stringify({
      id: 'VERIFY-0001',
      label: 'Dokumen A',
      deviceID: 'ANDROID-001',
      image_data: 'data:image/png;base64,...',
      latitude: -6.2,
      longitude: 106.8,
      created_at: '2026-07-20T10:00:00.000Z',
      updated_at: '2026-07-20T10:00:00.000Z',
    }, null, 2),
    responseExample: JSON.stringify({
      status: true,
      message: 'Verification result: authentic.',
      data: {
        status_result: 'AUTHENTIC',
        notes: 'Registered pattern found.',
      },
    }, null, 2),
    errorExamples: [
      {
        title: 'Missing required fields',
        response: JSON.stringify({
          status: false,
          message: 'Field id, label, dan deviceID wajib diisi.',
          data: null,
        }, null, 2),
      },
      {
        title: 'Invalid JSON body',
        response: JSON.stringify({
          status: false,
          message: 'Request body harus berupa JSON yang valid.',
          data: null,
        }, null, 2),
      },
      {
        title: 'Invalid image_data format',
        response: JSON.stringify({
          status: false,
          message: 'Field image_data harus berupa string base64.',
          data: null,
        }, null, 2),
      },
    ],
    responseContract: JSON.stringify({
      request: {
        id: 'string (required)',
        label: 'string (required)',
        deviceID: 'string (required)',
        image_data: 'string base64 (optional)',
        latitude: 'number (optional)',
        longitude: 'number (optional)',
        created_at: 'ISO datetime string (optional)',
        updated_at: 'ISO datetime string (optional)',
      },
      success_response: {
        status: 'boolean',
        message: 'string',
        data: {
          status_result: 'AUTHENTIC | COUNTERFEIT',
          notes: 'string | null',
        },
      },
      error_response: {
        status: 'false',
        message: 'string',
        data: 'null',
      },
      mobile_mapping: {
        show_loading_after_decode: true,
        read_primary_result_from: 'data.status_result',
        read_secondary_message_from: 'data.notes',
      },
    }, null, 2),
  },
  {
    id: 'verify-history-by-device',
    group: 'Mobile',
    method: 'GET',
    path: '/api/verify/history',
    access: 'Public',
    summary: 'Mengambil riwayat verifikasi berdasarkan deviceID.',
    description: 'Dipakai oleh aplikasi mobile untuk menampilkan histori scan milik perangkat tertentu. Endpoint ini bersifat public untuk kebutuhan mobile app, dengan query wajib `deviceID` serta pagination ringan melalui `page` dan `limit`.',
    queryExample: {deviceID: 'ANDROID-001', page: '1', limit: '10'},
    responseExample: JSON.stringify({
      status: true,
      message: 'Verification history retrieved successfully',
      data: {
        deviceID: 'ANDROID-001',
        source: 'MOBILE',
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          total_pages: 1,
        },
        items: [
          {
            id: 'uuid-log-1',
            label: 'VERIFY-0001',
            deviceID: 'ANDROID-001',
            source: 'MOBILE',
            status_result: 'AUTHENTIC',
            notes: 'Registered pattern found.',
            image_data: 'data:image/png;base64,...',
            latitude: -6.2,
            longitude: 106.8,
            created_at: '2026-07-20T10:00:00.000Z',
            updated_at: '2026-07-20T10:00:00.000Z',
          },
        ],
      },
    }, null, 2),
    errorExamples: [
      {
        title: 'Missing deviceID query',
        response: JSON.stringify({
          status: false,
          message: 'Query deviceID wajib diisi.',
          data: null,
        }, null, 2),
      },
    ],
    responseContract: JSON.stringify({
      request: {
        method: 'GET',
        query: {
          deviceID: 'string (required)',
          page: 'number >= 1 (optional, default 1)',
          limit: 'number >= 1 (optional, default 10, max 100)',
        },
      },
      success_response: {
        status: 'boolean',
        message: 'string',
        data: {
          deviceID: 'string',
          source: 'WEB | MOBILE',
          pagination: {
            page: 'number',
            limit: 'number',
            total: 'number',
            total_pages: 'number',
          },
          items: [
            {
              id: 'string',
              label: 'string',
              deviceID: 'string',
              source: 'WEB | MOBILE',
              status_result: 'AUTHENTIC | COUNTERFEIT | MISMATCH',
              notes: 'string | null',
              image_data: 'string | null',
              latitude: 'number | null',
              longitude: 'number | null',
              created_at: 'ISO datetime string',
              updated_at: 'ISO datetime string',
            },
          ],
        },
      },
      mobile_mapping: {
        render_history_list_from: 'data.items',
        render_status_from: 'item.status_result',
        render_notes_from: 'item.notes',
        render_pagination_from: 'data.pagination',
      },
    }, null, 2),
  },
  {
    id: 'users-create',
    group: 'Users & History',
    method: 'POST',
    path: '/api/users',
    access: 'Admin',
    summary: 'Membuat akun admin baru.',
    description: 'Semua user baru otomatis menggunakan role admin.',
    requestExample: JSON.stringify({nama: 'Admin Baru', username: 'admin2', password: 'secret123'}, null, 2),
    responseExample: JSON.stringify({
      status: true,
      message: 'User created successfully',
      data: {id: 'uuid', nama: 'Admin Baru', username: 'admin2', role: 'admin', created_at: '2026-07-20T10:00:00.000Z', updated_at: '2026-07-20T10:00:00.000Z', last_login: null},
    }, null, 2),
  },
  {
    id: 'users-update',
    group: 'Users & History',
    method: 'PATCH',
    path: '/api/users/:id',
    access: 'Admin',
    summary: 'Memperbarui data akun admin.',
    description: 'Mengubah nama, username, dan password bila diberikan.',
    pathParams: {id: 'uuid-user-id'},
    requestExample: JSON.stringify({nama: 'Admin Update', username: 'admin-updated', password: 'secret456'}, null, 2),
    responseExample: JSON.stringify({
      status: true,
      message: 'User updated successfully',
      data: {id: 'uuid-user-id', nama: 'Admin Update', username: 'admin-updated', role: 'admin', created_at: '2026-07-20T10:00:00.000Z', updated_at: '2026-07-20T10:30:00.000Z', last_login: null},
    }, null, 2),
  },
  {
    id: 'users-delete',
    group: 'Users & History',
    method: 'DELETE',
    path: '/api/users/:id',
    access: 'Admin',
    summary: 'Menghapus akun admin.',
    description: 'Menghapus satu akun admin berdasarkan id.',
    pathParams: {id: 'uuid-user-id'},
    responseExample: JSON.stringify({
      status: true,
      message: 'User deleted',
      data: {deleted: {id: 'uuid-user-id', nama: 'Admin Utama', username: 'admin', role: 'admin', created_at: '2026-07-20T10:00:00.000Z', updated_at: '2026-07-20T10:30:00.000Z', last_login: '2026-07-20T10:05:00.000Z'}},
    }, null, 2),
  },
  {
    id: 'history-export',
    group: 'Users & History',
    method: 'GET',
    path: '/api/history/export',
    access: 'Admin',
    summary: 'Export riwayat verifikasi ke CSV.',
    description: 'Mendukung filter `search` dan `status` melalui query parameter.',
    queryExample: {search: 'VERIFY-001', status: 'AUTHENTIC'},
    responseExample: 'CSV file response',
  },
  {
    id: 'health-check',
    group: 'Users & History',
    method: 'GET',
    path: '/api/health',
    access: 'Public',
    summary: 'Cek koneksi database dan status service.',
    description: 'Endpoint sederhana untuk health monitoring aplikasi.',
    responseExample: JSON.stringify({status: true, message: 'Health check successful', data: {healthy: true}}, null, 2),
  },
];
