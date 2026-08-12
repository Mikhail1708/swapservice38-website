// frontend/src/lib/csrf.ts

let csrfToken: string | null = null;
let lastFetchTime: number = 0;
const TOKEN_TTL = 4 * 60 * 1000; // 4 минуты

export const getCsrfToken = async (): Promise<string> => {
  if (csrfToken && (Date.now() - lastFetchTime) < TOKEN_TTL) {
    console.log('✅ CSRF токен из кэша:', csrfToken.substring(0, 10) + '...');
    return csrfToken;
  }

  try {
    console.log('🔄 Запрос CSRF токена...');
    const response = await fetch('/api/csrf-token', {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Ошибка получения CSRF токена: ${response.status}`);
    }

    const data = await response.json();
    if (!data.csrfToken) {
      throw new Error('CSRF токен не получен');
    }

    csrfToken = data.csrfToken;
    lastFetchTime = Date.now();
    
    console.log('✅ CSRF токен получен:', csrfToken.substring(0, 10) + '...');
    return csrfToken;
  } catch (error) {
    console.error('❌ Ошибка получения CSRF токена:', error);
    throw error;
  }
};

export const clearCsrfToken = () => {
  csrfToken = null;
  lastFetchTime = 0;
};

export const fetchWithCsrf = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = await getCsrfToken();

  // ✅ БАЗОВЫЕ ЗАГОЛОВКИ
  const headers: HeadersInit = {
    'X-CSRF-Token': token,
    'CSRF-Token': token,
    ...options.headers,
  };

  // ✅ ПРОВЕРЯЕМ — ЭТО FormData?
  const isFormData = options.body instanceof FormData;
  
  // ✅ ДЛЯ FormData НЕ ДОБАВЛЯЕМ Content-Type
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
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
    const formData = options.body as FormData;
    formData.append('_csrf', token);
    finalBody = formData;
  }

  return fetch(url, {
    ...options,
    headers,
    body: finalBody,
    credentials: 'include',
  });
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