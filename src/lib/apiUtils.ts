export async function parseResponseJson<T = any>(
  res: Response,
  defaultError = 'Erro na requisição'
): Promise<{ ok: boolean; data?: T; error?: string; isHtml?: boolean }> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const isHtml = contentType.includes('text/html');

  if (res.ok) {
    if (isJson) {
      try {
        const data = await res.json();
        return { ok: true, data };
      } catch {
        return { ok: false, error: 'Resposta do servidor possui formato JSON inválido.' };
      }
    }
    if (isHtml) {
      return {
        ok: false,
        isHtml: true,
        error: 'O servidor retornou uma página HTML em vez de JSON. Aguarde a inicialização ou recarregue.',
      };
    }
    return { ok: true, data: {} as T };
  } else {
    if (isJson) {
      try {
        const data = await res.json();
        return { ok: false, error: data.error || data.message || defaultError, data };
      } catch {
        return { ok: false, error: defaultError };
      }
    }
    return {
      ok: false,
      isHtml,
      error: `${defaultError} (Status ${res.status})`,
    };
  }
}

export async function safeFetchJson<T = any>(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; data?: T; error?: string; isHtml?: boolean }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });
    return await parseResponseJson<T>(res, 'Falha na comunicação com o servidor');
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro de conexão com o servidor.' };
  }
}
