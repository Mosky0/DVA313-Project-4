import React from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, AreaChart, Area } from "recharts";

export default function ChartCard({ title, data, type = "line", dataKey = "value" }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 h-full flex flex-col">
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      <div className="w-full flex-grow min-h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          {type === "area" ? (
            <AreaChart data={data}>
              <defs><linearGradient id="grad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2496ED" stopOpacity={0.25}/><stop offset="100%" stopColor="#2496ED" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={30} />
              <Tooltip formatter={(value) => [`${Math.round(value)}%`, 'Usage']} />
              <Area type="monotone" dataKey={dataKey} stroke="#2496ED" fill="url(#grad)" />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={30} />
              <Tooltip formatter={(value) => [`${Math.round(value)}%`, 'Usage']} />
              <Line type="monotone" dataKey={dataKey} stroke="#2496ED" strokeWidth={2} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
