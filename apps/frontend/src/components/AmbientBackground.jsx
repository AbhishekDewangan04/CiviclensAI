import React from "react";

// Fixed page background: navy base, faint grid, soft glows and a slow green scan wave.
export default function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: "#090c13" }}>
      <style>{`
        @keyframes civic-scan {
          0% { transform: translateY(-40vh); }
          100% { transform: translateY(140vh); }
        }
        @media (prefers-reduced-motion: reduce) {
          .civic-scan { animation: none !important; opacity: 0 !important; }
        }
      `}</style>

      {/* soft glows */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 12% 18%, rgba(16,185,129,0.10), transparent 70%), radial-gradient(50% 45% at 88% 30%, rgba(59,100,210,0.09), transparent 70%), radial-gradient(70% 50% at 50% 100%, rgba(16,185,129,0.05), transparent 70%)",
        }}
      />

      {/* faint grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%)",
          maskImage: "radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%)",
        }}
      />

      {/* slow, very faint wave travelling top to bottom */}
           {/* slow, very faint wave travelling top to bottom */}
      <div
        className="civic-scan absolute inset-x-0 top-0 h-[45vh]"
        style={{
          background: "linear-gradient(180deg, transparent, rgba(16,185,129,0.12) 50%, transparent)",
          animation: "civic-scan 9s linear infinite",
        }}
      />
    </div>
  );
}