import { useState } from 'react';

const ACKNOWLEDGEMENT_KEY = 'swapservice38:necessary-cookies-notice:v1';

export function CookieBanner() {
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(ACKNOWLEDGEMENT_KEY) !== 'acknowledged'; }
    catch { return true; }
  });
  if (!visible) return null;
  const acknowledge = () => {
    try { localStorage.setItem(ACKNOWLEDGEMENT_KEY, 'acknowledged'); } catch { /* Unavailable storage must not block the site. */ }
    setVisible(false);
  };
  return <aside aria-label="Информация о cookie" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl rounded-lg border border-border bg-card p-5 shadow-xl">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <p className="text-sm leading-6 text-muted-foreground">
        Мы используем файлы cookie, необходимые для работы сайта.
        Подробнее — в{' '}<a href="/privacy#cookies" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">Политике конфиденциальности</a>.
      </p>
      <button type="button" onClick={acknowledge} className="shrink-0 rounded-sm bg-foreground px-6 py-3 text-sm font-semibold text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Понятно</button>
    </div>
  </aside>;
}
