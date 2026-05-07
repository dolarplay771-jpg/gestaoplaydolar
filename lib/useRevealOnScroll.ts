import { useEffect } from 'react';

const canUseDom = () => typeof window !== 'undefined' && typeof document !== 'undefined';

export const useRevealOnScroll = (deps: Array<string | number | boolean | null | undefined> = []) => {
  useEffect(() => {
    if (!canUseDom()) return;

    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            el.classList.add('reveal-in');
            el.classList.remove('reveal-out');
          } else {
            el.classList.add('reveal-out');
            el.classList.remove('reveal-in');
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );

    elements.forEach((el) => {
      el.classList.add('reveal');
      el.classList.remove('reveal-in');
      el.classList.add('reveal-out');
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, deps);
};
