// frontend/src/lib/next-shims.tsx
import React from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';

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
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
    : {};

  return React.createElement('img', {
    src,
    alt: alt || '',
    width: fill ? undefined : width,
    height: fill ? undefined : height,
    className,
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

  return {
    push: (path: string) => navigate(path),
    replace: (path: string) => navigate(path, { replace: true }),
    back: () => navigate(-1),
    refresh: () => window.location.reload(),
    pathname: location.pathname,
    query: Object.fromEntries(new URLSearchParams(location.search)),
  };
};

export const usePathname = () => {
  const location = useLocation();
  return location.pathname;
};

// ✅ ИСПРАВЛЕНО: useSearchParams — теперь это ХУК, а не просто функция
export const useSearchParams = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  return {
    get: (key: string) => params.get(key),
    getAll: (key: string) => params.getAll(key),
    toString: () => params.toString(),
    entries: () => params.entries(),
  };
};

export const useParams = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const parts = pathname.split('/').filter(Boolean);
  
  return {
    id: parts[parts.length - 1] || '',
  };
};

export default {
  Image,
  Link,
  useRouter,
  usePathname,
  useSearchParams,
  useParams,
};