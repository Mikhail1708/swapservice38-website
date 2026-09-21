// frontend/src/lib/next-shims.tsx
import React, { useCallback, useMemo } from 'react';
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
} from 'react-router-dom';

// ============================================================
// Image — НЕ МЕНЯЕМ
// ============================================================
interface ImageProps {
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  [key: string]: any;
}

export const Image: React.FC<ImageProps> = (props) => {
  const {
    src,
    alt,
    width,
    height,
    className,
    fill,
    priority,
    unoptimized,
    onError,
    ...rest
  } = props;

  const style: React.CSSProperties = fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%' }
    : { maxWidth: '100%' };

  return React.createElement('img', {
    src,
    alt: alt || '',
    width: fill ? undefined : width,
    height: fill ? undefined : height,
    className: `${fill ? 'object-cover' : ''} ${className || ''}`.trim(),
    style,
    loading: priority ? 'eager' : 'lazy',
    ...rest,
    onError,
  });
};

// ============================================================
// Link — НЕ МЕНЯЕМ
// ============================================================
interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const Link: React.FC<LinkProps> = ({ href, children, className, ...props }) => {
  return React.createElement(
    RouterLink,
    { to: href, className, ...props },
    children
  );
};

// ============================================================
// ХУКИ — ВЫЗЫВАЮТСЯ ТОЛЬКО ВНУТРИ КОМПОНЕНТОВ
// ============================================================
export const useRouter = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const push = useCallback((path: string) => navigate(path), [navigate]);
  const replace = useCallback((path: string) => navigate(path, { replace: true }), [navigate]);
  const back = useCallback(() => navigate(-1), [navigate]);
  const refresh = useCallback(() => window.location.reload(), []);
  const query = useMemo(
    () => Object.fromEntries(new URLSearchParams(location.search)),
    [location.search],
  );

  return useMemo(() => ({
    push,
    replace,
    back,
    refresh,
    pathname: location.pathname,
    query,
  }), [back, location.pathname, push, query, refresh, replace]);
};

export const usePathname = () => {
  const location = useLocation();
  return location.pathname;
};

// ✅ ИСПРАВЛЕНО: useSearchParams — теперь это ХУК, а не просто функция
export const useSearchParams = () => {
  const [params] = useRouterSearchParams();
  return params;
};

export const useParams = () => {
  const params = useRouterParams();
  return useMemo(() => ({
    ...params,
    id: params.id || params.orderId || '',
  }), [params.id, params.orderId]);
};

export default {
  Image,
  Link,
  useRouter,
  usePathname,
  useSearchParams,
  useParams,
};
