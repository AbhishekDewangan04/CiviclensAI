import React, { useEffect, useRef, useState } from "react";

// Reveals children the first time they scroll into view. Supports sliding in
// from the left/right, scaling up from 0.9x, or lifting up.
export default function Reveal({ children, mode = "up", distance = 60, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(true);
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
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  let transform = "none";
  if (!visible) {
    if (mode === "left") transform = `translateX(${-distance}px)`;
    else if (mode === "right") transform = `translateX(${distance}px)`;
    else if (mode === "scale") transform = "scale(0.9)";
    else transform = `translateY(${distance}px)`;
  }

  const style = visible
    ? undefined
    : {
        opacity: 0,
        transform,
        transition: `opacity 800ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 800ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
        willChange: "opacity, transform",
      };

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}