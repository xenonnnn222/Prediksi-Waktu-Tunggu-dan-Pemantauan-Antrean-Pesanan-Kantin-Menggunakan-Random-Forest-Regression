// Fungsi untuk memanggil API Flask. Semua halaman memakai fungsi ini.
export async function api(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (_) {
    throw new Error('Tidak bisa terhubung ke server. Coba lagi.');
  }

  let body = {};
  try {
    body = await response.json();
  } catch (_) {
    // Respons bukan JSON; pakai pesan umum di bawah.
  }

  if (!response.ok) {
    const error = new Error(body.error || 'Permintaan gagal. Silakan coba lagi.');
    error.status = response.status;
    throw error;
  }
  return body;
}

export const post = (url, data) => api(url, { method: 'POST', body: JSON.stringify(data) });
export const patch = (url, data) => api(url, { method: 'PATCH', body: JSON.stringify(data) });
