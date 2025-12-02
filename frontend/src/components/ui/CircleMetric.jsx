import React from "react";

export default function CircleMetric({ value = 0, size = 64, stroke = 8, label, color = "#2496ED" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size}>
        <g transform={`translate(${size/2},${size/2})`}>
          <circle r={radius} fill="transparent" stroke="#e6eef9" strokeWidth={stroke} />
          <circle r={radius} fill="transparent" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={offset} transform="rotate(-90)" />
        </g>
      </svg>
      <div className="flex flex-col">
        <div className="text-xl font-semibold">{Math.round(value)}%</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}
