import { ArrowRight, Mail } from 'lucide-react';
import { Link, usePathname, useSearchParams } from '@/lib/next-shims';
import { useAuth } from '@/lib/hooks/useAuth';

export function EmailVerificationBanner() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (isLoading || !user || user.isVerified) return null;

  const query = searchParams.toString();
  const returnUrl = `${pathname}${query ? `?${query}` : ''}`;
  const href = `/verify-email?email=${encodeURIComponent(user.email)}&returnUrl=${encodeURIComponent(returnUrl)}`;

  return (
    <Link
      href={href}
      className="fixed inset-x-0 top-20 z-40 border-b border-white/10 bg-[#161618] text-foreground transition hover:bg-[#1c1c1f]"
      aria-label="Подтвердить электронную почту"
    >
      <div className="container-custom flex min-h-12 items-center justify-between gap-4 py-3">
        <span className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.1em] sm:text-sm">
          <Mail className="h-4 w-4 shrink-0" />
          Подтвердите электронную почту
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Ввести код</span>
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
