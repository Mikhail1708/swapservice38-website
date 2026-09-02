// frontend/src/lib/csrf.ts

let csrfToken: string | null = null;
let lastFetchTime: number = 0;
let csrfFetchPromise: Promise<string> | null = null;
const TOKEN_TTL = 4 * 60 * 1000; // 4 минуты

export const getCsrfToken = async (): Promise<string> => {
  if (csrfToken && (Date.now() - lastFetchTime) < TOKEN_TTL) {
    return csrfToken;
  }

  if (csrfFetchPromise) return csrfFetchPromise;

  csrfFetchPromise = (async () => {
    const response = await fetch('/api/csrf-token', {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Ошибка получения CSRF токена: ${response.status}`);
    }

    const data: unknown = await response.json();
    const receivedToken = typeof data === 'object' && data !== null && 'csrfToken' in data
      ? (data as { csrfToken?: unknown }).csrfToken
      : undefined;
    if (typeof receivedToken !== 'string' || !receivedToken) {
      throw new Error('CSRF токен не получен');
    }

    csrfToken = receivedToken;
    lastFetchTime = Date.now();
    return receivedToken;
  })().finally(() => { csrfFetchPromise = null; });

  return csrfFetchPromise;
};

export const clearCsrfToken = () => {
  csrfToken = null;
  lastFetchTime = 0;
  csrfFetchPromise = null;
};

export const fetchWithCsrf = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const execute = async (token: string): Promise<Response> => {

  // ✅ БАЗОВЫЕ ЗАГОЛОВКИ
  const headers = new Headers(options.headers);
  headers.set('X-CSRF-Token', token);
  headers.set('CSRF-Token', token);

  // ✅ ПРОВЕРЯЕМ — ЭТО FormData?
  const isFormData = options.body instanceof FormData;
  
  // ✅ ДЛЯ FormData НЕ ДОБАВЛЯЕМ Content-Type
  if (!isFormData && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  let finalBody = options.body;
  
  // ✅ ЕСЛИ ЭТО JSON — ДОБАВЛЯЕМ _csrf В БОДИ
  if (!isFormData && options.body && typeof options.body === 'string') {
    try {
      const parsed = JSON.parse(options.body);
      finalBody = JSON.stringify({
        ...parsed,
        _csrf: token,
      });
    } catch (e) {
      // Если не JSON — оставляем как есть
    }
  }

  // ✅ ДЛЯ FormData — ДОБАВЛЯЕМ _csrf КАК ПОЛЕ
  if (isFormData) {
    const formData = new FormData();
    (options.body as FormData).forEach((value, key) => formData.append(key, value));
    formData.set('_csrf', token);
    finalBody = formData;
  }

  return fetch(url, {
    ...options,
    headers,
    body: finalBody,
    credentials: 'include',
  });
  };

  let response = await execute(await getCsrfToken());
  if (response.status === 403) {
    clearCsrfToken();
    response = await execute(await getCsrfToken());
  }
  return response;
};

export const deleteWithCsrf = async (url: string): Promise<Response> => {
  return fetchWithCsrf(url, { method: 'DELETE' });
};

export const putWithCsrf = async (url: string, body: any): Promise<Response> => {
  return fetchWithCsrf(url, { 
    method: 'PUT', 
    body: JSON.stringify(body) 
  });
};

export const patchWithCsrf = async (url: string, body: any): Promise<Response> => {
  return fetchWithCsrf(url, { 
    method: 'PATCH', 
    body: JSON.stringify(body) 
  });
};
