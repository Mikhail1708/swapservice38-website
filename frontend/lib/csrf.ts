// frontend/lib/csrf.ts

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

  console.log(`🛡️ fetchWithCsrf: ${url}, токен: ${token.substring(0, 10)}...`);

  const headers = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,
    'CSRF-Token': token,
    ...options.headers,
  };

  console.log('📋 Заголовки fetchWithCsrf:', Object.keys(headers));

  let finalBody = options.body;
  if (options.body && typeof options.body === 'string') {
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

  return fetch(url, {
    ...options,
    headers,
    body: finalBody,
    credentials: 'include',
  });
};