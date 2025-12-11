import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { API_BASE_URL } from "../../config"; // adjust path if needed
import {
  initializeContainerBuffers,
  addContainerMetrics,
  getStoredMetrics,
  DEFAULT_BUFFER_SIZE,
} from "../../utils/ringBuffer";

export default function ContainerView() {
  const { id } = useParams(); // from route /containers/:id
  const [activeTab, setActiveTab] = useState("details");

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  const [cpuHistory, setCpuHistory] = useState([]); // for chart

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");

  const [processes, setProcesses] = useState([]);
  const [processesLoading, setProcessesLoading] = useState(false);
  const [processesError, setProcessesError] = useState("");

  // --------- FETCH STATS (poll every 5s) ----------
  useEffect(() => {
    let intervalId;

    const fetchStats = () => {
      initializeContainerBuffers(id, DEFAULT_BUFFER_SIZE);

      fetch(`${API_BASE_URL}/containers/${id}/stats`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch stats");
          return res.json();
        })
        .then((data) => {
          setStatsError("");
          setStats(data);
          setStatsLoading(false);

          addContainerMetrics(id, data); // Store metrics in the ring buffer

          // Get updated history from ring buffer
          const metrics = getStoredMetrics(id);

          // Debug logging
          console.log("Ring buffer metrics:", metrics);

          const updatedCpuHistory = metrics?.cpuHistory || [];
          setCpuHistory(
            updatedCpuHistory.map((item) => ({
              time: item?.timestamp
                ? new Date(item.timestamp).toLocaleTimeString()
                : "",
              value: item?.value || 0,
            }))
          );
        })
        .catch((err) => {
          console.error(err);
          setStatsError("Could not load container stats.");
          setStatsLoading(false);
        });
    };

    fetchStats();
    intervalId = setInterval(fetchStats, 5000);

    return () => clearInterval(intervalId);
  }, [id]);

  // --------- FETCH LOGS WHEN TAB = "logs" ----------
  useEffect(() => {
    if (activeTab !== "logs") return;

    setLogsLoading(true);
    setLogsError("");

    fetch(`${API_BASE_URL}/containers/${id}/logs`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch logs");
        return res.json();
      })
      .then((data) => {
        setLogsLoading(false);
        setLogsError("");
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      })
      .catch((err) => {
        console.error(err);
        setLogsError("Could not load logs.");
        setLogsLoading(false);
      });
  }, [activeTab, id]);

  // --------- FETCH PROCESSES ----------
  useEffect(() => {
    //execute in details page
    if (activeTab !== "details") return;

    const fetchProcesses = () => {
      setProcessesLoading(true);
      setProcessesError("");

      fetch(`${API_BASE_URL}/containers/${id}/processes`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch processes");
          return res.json();
        })
        .then((data) => {
          setProcessesLoading(false);
          setProcessesError("");
          //the backend returns the processes
          setProcesses(Array.isArray(data.processes) ? data.processes : []);
        })
        .catch((err) => {
          console.error(err);
          setProcessesError("Could not load processes.");
          setProcessesLoading(false);
          setProcesses([]);
        });
    };

    // Carga inicial
    fetchProcesses();

    // Poll cada 5 segundos para actualizar
    const intervalId = setInterval(fetchProcesses, 5000);

    // Cleanup: cancelar el interval cuando el componente se desmonte
    return () => clearInterval(intervalId);
  }, [activeTab, id]);
  const memPercent = (() => {
    if (!stats || !stats.mem_usage_bytes || !stats.mem_limit_bytes) return 0;
    if (stats.mem_limit_bytes === 0) return 0;
    return Math.min(100, (stats.mem_usage_bytes / stats.mem_limit_bytes) * 100);
  })();

  const memUsedMB = stats?.mem_usage_bytes
    ? stats.mem_usage_bytes / (1024 * 1024)
    : 0;
  const memTotalMB = stats?.mem_limit_bytes
    ? stats.mem_limit_bytes / (1024 * 1024)
    : 0;

  const statusLabel = stats ? formatStatus(stats.status) : "Unknown";

  if (statsLoading && !stats) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen w-full">
        <p className="text-gray-500 text-sm">Loading container data…</p>
      </div>
    );
  }

  if (statsError && !stats) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen w-full">
        <p className="text-red-500 text-sm">{statsError}</p>
      </div>
    );
  }

  const cpuValue = stats?.cpu_percent ?? 0;

  return (
    <div className="p-8 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-gray-500 text-sm">Container</p>
          <h1 className="text-3xl font-bold">Container {stats?.name || id}</h1>

          <div className="flex gap-4 mt-1 items-center">
            <span
              className={`px-3 py-1 rounded-lg text-sm ${
                statusLabel === "Running"
                  ? "bg-green-100 text-green-700"
                  : statusLabel === "Stopped"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {statusLabel}
            </span>

            <span className="text-gray-500 text-sm">
              Uptime: N/A {/* can be added later from backend */}
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
          className={`pb-2 ${
            activeTab === "details"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-gray-600"
          }`}
          onClick={() => setActiveTab("details")}
        >
          Details
        </button>

        <button
          className={`pb-2 ${
            activeTab === "logs"
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
                      strokeDasharray={`${cpuValue * 2.5} 1000`}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="text-xl font-bold">{cpuValue.toFixed(1)}%</p>
                <p className="text-gray-500 text-sm">CPU</p>
              </div>
            </div>

            {/* Memory card */}
            <div className="bg-white shadow rounded-xl p-6">
              <p className="font-semibold text-gray-700 mb-2">Memory</p>

              <p className="text-xl font-bold mb-2">{memPercent.toFixed(1)}%</p>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-green-500"
                  style={{ width: `${memPercent}%` }}
                ></div>
              </div>

              <p className="text-sm text-gray-500 mt-2">
                {memUsedMB.toFixed(1)} MB / {memTotalMB.toFixed(1)} MB
              </p>
            </div>

            {/* CPU Trend */}
            <div className="bg-white shadow rounded-xl p-6">
              <p className="font-semibold text-gray-700 mb-3">
                Quick CPU trend
              </p>

              <div className="w-full h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cpuHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="time"
                      stroke="#555"
                      hide={cpuHistory.length === 0}
                    />
                    <YAxis
                      stroke="#555"
                      domain={[0, 1]}
                      tickFormatter={(value) => `${value.toFixed(2)}%`}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Processes Table */}
          <div className="bg-white shadow rounded-xl p-6">
            <p className="font-semibold mb-4 text-gray-700">Processes</p>

            {/*Error in case there are*/}
            {processesError && (
              <p className="text-red-500 text-sm mb-3">{processesError}</p>
            )}

            {/*Show loading if there are no processes yet*/}
            {processesLoading && processes.length === 0 ? (
              <p className="text-gray-500 text-sm">Loading processes…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-gray-600 border-b bg-gray-50">
                      <th className="py-3 px-3 text-center">PID</th>
                      <th className="py-3 px-3 text-center">CPU%</th>
                      <th className="py-3 px-3 text-center">MEM%</th>
                      <th className="py-3 px-3 text-center">State</th>
                      <th className="py-3 px-3 text-center">CPU Time</th>
                      <th className="py-3 px-3 text-center">Command</th>
                    </tr>
                  </thead>

                  <tbody>
                    {processes.length === 0 ? (
                      <tr className="border-b text-sm">
                        <td className="py-2 text-center" colSpan="6">
                          <span className="text-gray-500">
                            No process data available
                          </span>
                        </td>
                      </tr>
                    ) : (
                      processes.map((proc, idx) => (
                        <tr
                          key={idx}
                          className="border-b text-sm hover:bg-gray-50"
                        >
                          <td className="py-2 text-center">
                            {proc.pid || "—"}
                          </td>
                          <td className="text-center">
                            {proc.cpu_percent != null
                              ? `${proc.cpu_percent}%`
                              : "—"}
                          </td>
                          <td className="text-center">
                            {proc.mem_percent != null
                              ? `${proc.mem_percent}%`
                              : "—"}
                          </td>
                          <td className="text-center">{proc.state || "—"}</td>
                          <td className="text-center">{proc.time || "—"}</td>
                          <td className="truncate max-w-xs text-center">
                            {proc.command || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* LOGS TAB */}
      {activeTab === "logs" && (
        <div className="bg-black text-green-400 p-4 rounded-xl shadow h-[500px] overflow-y-auto font-mono text-sm">
          {logsLoading && <p className="text-gray-400">Loading logs…</p>}
          {logsError && <p className="text-red-400">{logsError}</p>}
          {!logsLoading &&
            !logsError &&
            logs.map((line, i) => <p key={i}>{line}</p>)}
          {!logsLoading && !logsError && logs.length === 0 && (
            <p className="text-gray-400">
              No logs available for this container.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatStatus(status) {
  if (!status) return "Unknown";
  const s = status.toLowerCase();
  if (s === "running") return "Running";
  if (s === "exited" || s === "stopped") return "Stopped";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
