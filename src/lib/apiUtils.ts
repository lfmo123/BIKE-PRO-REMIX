export async function parseResponseJson<T = any>(
  res: Response,
  defaultError = 'Erro na requisição'
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (res.ok) {
    if (isJson) {
      try {
        const data = await res.json();
        return { ok: true, data };
      } catch (e) {
        return { ok: false, error: 'Resposta do servidor possui formato JSON inválido.' };
      }
    } else {
      return { ok: true, data: {} as T };
    }
  } else {
    if (isJson) {
      try {
        const data = await res.json();
        return { ok: false, error: data.error || data.message || defaultError, data };
      } catch (e) {
        return { ok: false, error: defaultError };
      }
    } else {
      return { ok: false, error: `${defaultError} (Status ${res.status})` };
    }
  }
}
