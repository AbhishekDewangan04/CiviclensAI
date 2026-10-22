import React, { useEffect, useRef, useState } from "react";

/**
 * IntersectionObserver-backed reveal: children fade and lift into view the
 * first time they enter the viewport, then the transform is dropped entirely
 * so interactive children (maps, drag handles) get a clean box.
 */
export default function ScrollReveal({ children, delay = 0, y = 22, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setVisible(true);
      setSettled(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setSettled(true), 900 + delay);
    return () => window.clearTimeout(timer);
  }, [visible, delay]);

  const style =
    visible && settled
      ? undefined
      : {
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0px)" : `translateY(${y}px)`,
          transition: `opacity 820ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 820ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
          willChange: "opacity, transform",
        };

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}