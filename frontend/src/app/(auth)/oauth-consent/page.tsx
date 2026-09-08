import { useEffect, useRef, useState } from 'react';
import { Link, Image, useRouter } from '@/lib/next-shims';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';
import { fetchWithCsrf } from '@/lib/csrf';
import { useAuth } from '@/lib/hooks/useAuth';
import { ConsentDocuments, personalDataAcceptance } from '@/lib/hooks/useConsentStatus';
import { getSafeInternalRedirect } from '@/lib/safe-navigation';

const restartMessage = 'Не удалось продолжить регистрацию. Срок ожидания мог истечь. Начните вход через сервис заново.';

export default function OAuthConsentPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [context, setContext] = useState<{ documents: ConsentDocuments; provider: 'yandex' | 'max' } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/auth/oauth/consent', { credentials: 'include', cache: 'no-store' });
        if (!response.ok) throw new Error('Pending context unavailable');
        const data = await response.json();
        if (!['yandex', 'max'].includes(data.provider) || !data.documents?.personalDataVersion || !data.documents?.privacyVersion || !data.documents?.offerVersion) {
          throw new Error('Invalid context');
        }
        if (!cancelled) setContext({ provider: data.provider, documents: data.documents });
      } catch {
        if (!cancelled) setError(restartMessage);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accepted || !context || error || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      // Identity and pending token remain server-side / in an HttpOnly cookie.
      const response = await fetchWithCsrf('/api/auth/oauth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalDataConsent: personalDataAcceptance(context.documents) }),
      });
      if (!response.ok) throw new Error('Registration unavailable');
      const data = await response.json();
      setSuccess(true);
      await refresh();
      router.replace(getSafeInternalRedirect(typeof data.redirect === 'string' ? data.redirect : null));
    } catch {
      // Never display provider/internal errors; pending state may already be consumed.
      setError(restartMessage);
      setBusy(false);
    }
  };

  return <main className="min-h-screen flex items-center justify-center bg-background px-5 py-12">
    <div className="w-full max-w-md space-y-8">
      <Link href="/" className="block text-center">
        <Image src="/images/logo/logo.png" alt="SWAP SERVICE 38" width={220} height={55} className="h-12 w-auto brightness-0 invert mx-auto" />
      </Link>
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6">
        <h1 className="text-2xl font-bold uppercase tracking-wide">Завершение регистрации</h1>
        {error ? <>
          <p role="alert" className="text-sm text-muted-foreground leading-6">{error}</p>
          <Link href="/login" className="block rounded-lg bg-foreground text-background py-3 text-center font-medium">Вернуться ко входу</Link>
        </> : success ? <p role="status">Регистрация завершена. Переходим в ваш аккаунт…</p> : !context ? <p role="status" className="text-muted-foreground">Загрузка…</p> : <>
          <p className="text-sm leading-6 text-muted-foreground">Вход через {context.provider === 'yandex' ? 'Яндекс' : 'MAX'} подтверждён. Для создания аккаунта необходимо ваше согласие.</p>
          <form onSubmit={submit} className="space-y-6">
            <ConsentCheckbox variant="personalData" checked={accepted} onChange={setAccepted} disabled={busy} />
            <button type="submit" disabled={!accepted || busy} className="w-full rounded-lg bg-foreground text-background py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {busy ? 'Создаём аккаунт…' : 'Создать аккаунт'}
            </button>
          </form>
          <Link href="/login" className="inline-block text-sm text-muted-foreground underline underline-offset-4">Отменить и вернуться ко входу</Link>
        </>}
      </section>
    </div>
  </main>;
}
