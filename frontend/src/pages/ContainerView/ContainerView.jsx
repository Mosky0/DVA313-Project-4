import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ContainerView() {
  const [activeTab, setActiveTab] = useState("details");

  // Dummy Data ----------------------------
  const container = {
    name: "ied-01",
    status: "running",
    uptime: "2h 12m",
    cpu: 22,
    memPercent: 25,
    memUsed: 512,
    memTotal: 2048,
  };

  const cpuTrend = [
    { time: "t-6", value: 14 },
    { time: "t-5", value: 18 },
    { time: "t-4", value: 15 },
    { time: "t-3", value: 28 },
    { time: "t-2", value: 22 },
    { time: "now", value: 25 },
  ];

  const processes = [
    { pid: 101, cpu: 12.2, mem: 3.1, state: "S", time: "00:01:12", cmd: "python app.py" },
    { pid: 202, cpu: 6.5, mem: 1.2, state: "S", time: "00:00:30", cmd: "gunicorn" },
    { pid: 303, cpu: 3.2, mem: 0.8, state: "R", time: "00:00:12", cmd: "redis-server" },
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-gray-500 text-sm">Container</p>
          <h1 className="text-3xl font-bold">Container {container.name}</h1>

          <div className="flex gap-4 mt-1 items-center">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm">
              {container.status}
            </span>

            <span className="text-gray-500 text-sm">
              Uptime: {container.uptime}
            </span>
          </div>
        </div>

        <div className="flex gap-4">
          <button className="text-black hover:opacity-70">Restart</button>
          <button className="text-black hover:opacity-70">Stop</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b mb-6">
        <button
          className={`pb-2 ${activeTab === "details"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-gray-600"
            }`}
          onClick={() => setActiveTab("details")}
        >
          Details
        </button>

        <button
          className={`pb-2 ${activeTab === "logs"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-gray-600"
            }`}
          onClick={() => setActiveTab("logs")}
        >
          Logs
        </button>
      </div>

      {/* DETAILS TAB */}
      {activeTab === "details" && (
        <>
          {/* Metrics Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* CPU card */}
            <div className="bg-white shadow rounded-xl p-6 flex items-center justify-center">
              <div className="text-center">
                <div className="relative w-24 h-24 mx-auto mb-3">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="50%"
                      cy="50%"
                      r="40%"
                      stroke="#e5e7eb"
                      strokeWidth="10"
                      fill="none"
                    />

                    <circle
                      cx="50%"
                      cy="50%"
                      r="40%"
                      stroke="#3b82f6"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${container.cpu * 2.5} 1000`}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="text-xl font-bold">{container.cpu}%</p>
                <p className="text-gray-500 text-sm">CPU</p>
              </div>
            </div>

            {/* Memory card */}
            <div className="bg-white shadow rounded-xl p-6">
              <p className="font-semibold text-gray-700 mb-2">Memory</p>

              <p className="text-xl font-bold mb-2">{container.memPercent}%</p>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-green-500"
                  style={{ width: `${container.memPercent}%` }}
                ></div>
              </div>

              <p className="text-sm text-gray-500 mt-2">
                {container.memUsed} MB / {container.memTotal} MB
              </p>
            </div>

            {/* CPU Trend */}
            <div className="bg-white shadow rounded-xl p-6">
              <p className="font-semibold text-gray-700 mb-3">Quick CPU trend</p>

              <div className="w-full h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cpuTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" stroke="#555" />
                    <YAxis stroke="#555" domain={[0, 30]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Processes Table */}
          <div className="bg-white shadow rounded-xl p-6">
            <p className="font-semibold mb-4 text-gray-700">Processes (top)</p>

            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-600 border-b">
                  <th className="py-2">PID</th>
                  <th>CPU%</th>
                  <th>MEM%</th>
                  <th>STATE</th>
                  <th>TIME+</th>
                  <th>COMMAND</th>
                </tr>
              </thead>

              <tbody>
                {processes.map((p) => (
                  <tr key={p.pid} className="border-b text-sm">
                    <td className="py-2">{p.pid}</td>
                    <td>{p.cpu}</td>
                    <td>{p.mem}</td>
                    <td>{p.state}</td>
                    <td>{p.time}</td>
                    <td>{p.cmd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* LOGS TAB */}
      {activeTab === "logs" && (
        <div className="bg-black text-green-400 p-4 rounded-xl shadow h-[500px] overflow-y-auto font-mono text-sm">
          {[...Array(30)].map((_, i) => (
            <p key={i}>[2025-02-12 12:{i}] Dummy log entry line {i}</p>
          ))}
        </div>
      )}
    </div>
  );
}
