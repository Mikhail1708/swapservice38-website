interface ApiErrorBody {
  code?: string;
  error?: string;
  message?: string;
  details?: Array<{ message?: string }>;
}

const codeMessages: Record<string, string> = {
  INVALID_CREDENTIALS: 'Неверный email или пароль.',
  EMAIL_UNVERIFIED: 'Подтвердите email, чтобы продолжить.',
  VERIFICATION_RATE_LIMITED: 'Слишком много попыток. Попробуйте позже.',
  VERIFICATION_UNAVAILABLE: 'Не удалось отправить письмо. Попробуйте позже.',
  EMAIL_ALREADY_REGISTERED: 'Аккаунт с таким email уже зарегистрирован.',
  REGISTRATION_UNAVAILABLE: 'Регистрация временно недоступна. Попробуйте позже.',
  ADDRESS_RATE_LIMITED: 'Подсказки временно недоступны.',
  ORDER_CREATE_FAILED: 'Не удалось создать заказ. Попробуйте ещё раз позже.',
  ORDER_LOAD_FAILED: 'Не удалось загрузить заказы. Попробуйте позже.',
  PAYMENT_CREATE_FAILED: 'Не удалось начать оплату. Попробуйте ещё раз.',
  PAYMENT_CONFIRM_FAILED: 'Не удалось проверить оплату. Попробуйте позже.',
  SESSION_EXPIRED: 'Сессия истекла. Войдите снова.',
};

export const readApiError = async (response: Response, fallback: string): Promise<string> => {
  const data = await response.json().catch(() => null) as ApiErrorBody | null;
  if (data?.code && codeMessages[data.code]) return codeMessages[data.code];
  const validationMessage = data?.details?.find((item) => typeof item.message === 'string')?.message;
  if (validationMessage) return validationMessage;
  if (response.status === 401) return 'Сессия истекла. Войдите снова.';
  if (response.status === 429) return 'Слишком много запросов. Попробуйте позже.';
  if (typeof data?.error === 'string' && /недостаточно|нет в наличии|неверн|обязател|подтвержд|просрочен|парол|отмен|12\s*час|срок/i.test(data.error)) {
    return data.error;
  }
  return fallback;
};

export const userMessageFromError = (error: unknown, fallback: string): string => {
  if (error instanceof DOMException && error.name === 'AbortError') return fallback;
  if (error instanceof TypeError) return 'Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.';
  return fallback;
};
