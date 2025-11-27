import React from "react";

/**
 * props:
 *  - value (0..100)
 *  - size (px)
 *  - stroke (px)
 *  - label (string)
 *  - color (hex)
 */
export default function CircleMetric({ value = 0, size = 72, stroke = 8, label, color = "#2496ED" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} className="block">
        <defs>
          <linearGradient id="g1" x1="0" x2="1">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <g transform={`translate(${size / 2}, ${size / 2})`}>
          <circle
            r={radius}
            fill="transparent"
            stroke="#e6eef9"
            strokeWidth={stroke}
            strokeLinecap="round"
            transform="rotate(-90)"
          />
          <circle
            r={radius}
            fill="transparent"
            stroke="url(#g1)"
            strokeWidth={stroke}
            strokeLinecap="round"
            transform="rotate(-90)"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
          />
        </g>
      </svg>

      <div className="flex flex-col">
        <div className="text-lg font-semibold">{value}%</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}
