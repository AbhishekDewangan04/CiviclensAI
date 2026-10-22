import { useEffect, useRef, useState } from "react";

// Tracks how far a tall container has scrolled through the viewport.
// Returns 0 when the container top hits the viewport top, 1 when its
// bottom reaches the viewport bottom — the raw material for scroll-pinned stages.
export function useScrollProgress() {
  const ref = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = rect.height - vh;
      const scrolled = -rect.top;
      setProgress(total > 0 ? Math.max(0, Math.min(1, scrolled / total)) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return { ref, progress };
}