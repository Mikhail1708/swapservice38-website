import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function RouteScroll() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === 'POP') return;
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return;
    }
    let anchor: string;
    try { anchor = decodeURIComponent(hash.slice(1)); } catch { return; }
    const scrollToAnchor = () => {
      const target = document.getElementById(anchor);
      if (!target) return false;
      target.scrollIntoView();
      return true;
    };
    if (scrollToAnchor()) return;
    const observer = new MutationObserver(() => {
      if (scrollToAnchor()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => observer.disconnect(), 5000);
    return () => { observer.disconnect(); window.clearTimeout(timeout); };
  }, [pathname, hash, navigationType]);

  return null;
}
