'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Mail, RotateCcw } from 'lucide-react';
import { Image, Link, useRouter, useSearchParams } from '@/lib/next-shims';
import { fetchWithCsrf } from '@/lib/csrf';
import { readApiError, userMessageFromError } from '@/lib/api-error';
import { useAuth } from '@/lib/hooks/useAuth';
import { getSafeInternalRedirect } from '@/lib/safe-navigation';

const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'•'.repeat(Math.max(3, Math.min(6, local.length - visible.length)))}@${domain}`;
};

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading, refresh } = useAuth();
  const returnUrl = getSafeInternalRedirect(
    searchParams.get('returnUrl') || searchParams.get('redirect'),
    '/profile',
  );
  const [email, setEmail] = useState(searchParams.get('email')?.trim() || '');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(searchParams.get('sent') === '1' ? 60 : 0);

  const verificationEmail = user?.email || email;
  const maskedEmail = useMemo(() => maskEmail(verificationEmail), [verificationEmail]);

  useEffect(() => {
    if (!authLoading && user?.isVerified) router.replace(returnUrl);
  }, [authLoading, returnUrl, router, user?.isVerified]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown > 0]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!verificationEmail || code.length !== 6) return;
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const response = await fetchWithCsrf('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: verificationEmail, code }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Неверный или просроченный код. Запросите новый код.'));
      }

      const hadSession = Boolean(user);
      await refresh();
      setSuccess(true);
      window.setTimeout(() => {
        const destination = hadSession
          ? returnUrl
          : `/login?verified=true&redirect=${encodeURIComponent(returnUrl)}`;
        router.replace(destination);
      }, 1600);
    } catch (caught) {
      setError(caught instanceof Error && !(caught instanceof TypeError)
        ? caught.message
        : userMessageFromError(caught, 'Не удалось подтвердить почту. Попробуйте ещё раз.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!verificationEmail || countdown > 0) return;
    setResending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetchWithCsrf('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: verificationEmail }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Не удалось отправить код. Попробуйте позже.'));
      }
      setCountdown(60);
      setNotice('Если подтверждение требуется, новый код отправлен на почту.');
    } catch (caught) {
      setError(caught instanceof Error && !(caught instanceof TypeError)
        ? caught.message
        : userMessageFromError(caught, 'Не удалось отправить код. Попробуйте позже.'));
    } finally {
      setResending(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background px-5 py-24 flex items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="mb-10 text-center">
          <Link href="/" aria-label="На главную">
            <Image src="/images/logo/logo.png" alt="SWAPSERVICE38" width={72} height={72} className="mx-auto h-16 w-16 object-contain brightness-0 invert" />
          </Link>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Безопасность аккаунта</p>
        </div>

        <section className="rounded-lg border border-border bg-card p-6 sm:p-9" aria-live="polite">
          {success ? (
            <div className="py-5 text-center">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted">
                <Check className="h-6 w-6 text-foreground" />
              </div>
              <h1 className="text-2xl font-bold uppercase tracking-[0.08em] text-foreground">Почта подтверждена</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Данные аккаунта обновлены. Сейчас вернём вас в интерфейс сайта.</p>
              <Link href={user ? returnUrl : `/login?verified=true&redirect=${encodeURIComponent(returnUrl)}`} className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                Продолжить <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold uppercase tracking-[0.08em] text-foreground sm:text-3xl">Подтверждение почты</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Введите шестизначный код из письма SWAPSERVICE38.</p>

              {verificationEmail ? (
                <div className="mt-6 flex items-center gap-3 rounded-md border border-border bg-muted px-4 py-3">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm text-foreground">{maskedEmail}</span>
                </div>
              ) : (
                <div className="mt-6">
                  <label htmlFor="verification-email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Email</label>
                  <input id="verification-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="name@example.com" className="w-full rounded-md border border-border bg-muted px-4 py-3 text-foreground outline-none transition focus:border-foreground/50" />
                </div>
              )}

              {error && <div role="alert" className="mt-5 rounded-md border border-border bg-background px-4 py-3 text-sm leading-5 text-foreground">{error}</div>}
              {notice && <div className="mt-5 rounded-md border border-border bg-muted px-4 py-3 text-sm leading-5 text-muted-foreground">{notice}</div>}

              <form onSubmit={handleSubmit} className="mt-6">
                <label htmlFor="verification-code" className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Код из письма</label>
                <input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  placeholder="000000"
                  aria-describedby="code-hint"
                  className="w-full rounded-md border border-border bg-background px-4 py-4 text-center font-mono text-3xl font-bold tracking-[0.42em] text-foreground outline-none transition placeholder:text-muted-foreground/30 focus:border-foreground/60"
                />
                <p id="code-hint" className="mt-2 text-center text-xs text-muted-foreground">Можно вставить весь код из письма</p>

                <button type="submit" disabled={submitting || code.length !== 6 || !verificationEmail} className="mt-6 flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-5 py-4 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Проверяем</> : <>Подтвердить почту <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>

              <div className="mt-7 border-t border-border pt-6 text-center">
                <button type="button" onClick={handleResend} disabled={resending || countdown > 0 || !verificationEmail} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                  {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  {countdown > 0 ? `Отправить код повторно через ${countdown} с` : 'Отправить код повторно'}
                </button>
                <p className="mt-3 text-xs text-muted-foreground/70">Если письма нет, проверьте папку «Спам».</p>
              </div>
            </>
          )}
        </section>

        <div className="mt-6 text-center">
          <Link href={returnUrl} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Вернуться назад</Link>
        </div>
      </div>
    </div>
  );
}
