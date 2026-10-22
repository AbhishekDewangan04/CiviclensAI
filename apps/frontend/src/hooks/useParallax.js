import { useEffect, useRef, useState } from "react";

// Translates an element on the Y axis as it travels through the viewport.
// `speed` < 1 makes the layer lag behind the scroll for a parallax depth effect.
export function useParallax(speed = 0.15) {
  const ref = useRef(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const progress = 1 - (rect.top + rect.height / 2) / vh;
      setOffset(Math.round((progress - 0.5) * vh * speed));
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
  }, [speed]);

  return { ref, offset };
}