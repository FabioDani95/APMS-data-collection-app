import type { CSSProperties } from "react";

const confettiPieces = [
  { left: "4%", delay: "0s", duration: "8.5s", color: "#f97316", rotate: "-18deg" },
  { left: "12%", delay: "1.5s", duration: "9.8s", color: "#0ea5e9", rotate: "12deg" },
  { left: "21%", delay: "0.8s", duration: "7.6s", color: "#22c55e", rotate: "-12deg" },
  { left: "29%", delay: "2.2s", duration: "10.2s", color: "#eab308", rotate: "18deg" },
  { left: "36%", delay: "0.3s", duration: "8.1s", color: "#ef4444", rotate: "-24deg" },
  { left: "44%", delay: "1.8s", duration: "9.1s", color: "#8b5cf6", rotate: "14deg" },
  { left: "52%", delay: "0.6s", duration: "8.9s", color: "#14b8a6", rotate: "-10deg" },
  { left: "61%", delay: "2.6s", duration: "10.5s", color: "#f43f5e", rotate: "22deg" },
  { left: "69%", delay: "1.1s", duration: "7.9s", color: "#84cc16", rotate: "-16deg" },
  { left: "77%", delay: "2.1s", duration: "9.3s", color: "#06b6d4", rotate: "10deg" },
  { left: "85%", delay: "0.4s", duration: "8.4s", color: "#fb7185", rotate: "-20deg" },
  { left: "93%", delay: "1.7s", duration: "9.9s", color: "#f59e0b", rotate: "16deg" },
];

const balloons = [
  { left: "12%", delay: "0s", duration: "5.5s", color: "#38bdf8" },
  { left: "32%", delay: "0.8s", duration: "6.2s", color: "#fb7185" },
  { left: "68%", delay: "0.4s", duration: "5.8s", color: "#f59e0b" },
  { left: "86%", delay: "1.2s", duration: "6.5s", color: "#4ade80" },
];

export function CelebrationScene() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {confettiPieces.map((piece, index) => (
        <span
          key={`confetti-${index}`}
          className="celebration-confetti"
          style={
            {
              left: piece.left,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              backgroundColor: piece.color,
              rotate: piece.rotate,
            } as CSSProperties
          }
        />
      ))}

      {balloons.map((balloon, index) => (
        <div
          key={`balloon-${index}`}
          className="celebration-balloon"
          style={
            {
              left: balloon.left,
              animationDelay: balloon.delay,
              animationDuration: balloon.duration,
              ["--balloon-color" as string]: balloon.color,
            } as CSSProperties
          }
        >
          <span className="celebration-balloon-knot" />
          <span className="celebration-balloon-string" />
        </div>
      ))}
    </div>
  );
}
