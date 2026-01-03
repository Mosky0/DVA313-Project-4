import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useParams, useLocation } from "react-router-dom";
import { FaDocker } from "react-icons/fa";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { API_BASE_URL } from "../../config";
import { containerCache } from "../../utils/cache";

export default function ContainerView() {
  const { id } = useParams(); 
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("details");
  const containerName = location.state?.name || "";
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [isStopping, setIsStopping] = useState(false);

  const [cpuHistory, setCpuHistory] = useState([]);

  const [logs, setLogs] = useState([]); // array of { msg: string, seenAt: number }
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");

  const statsIntervalRef = useRef(null);
  const logsIntervalRef = useRef(null);
  const logsBoxRef = useRef(null);

  function formatUptime(startedAt) {
  if (!startedAt) return "N/A";

  const start = new Date(startedAt).getTime();
  const now = Date.now();

  if (isNaN(start) || now < start) return "N/A";

  let seconds = Math.floor((now - start) / 1000);

  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}


  const stampLogs = (prevStamped, nextRaw) => {
    const pool = new Map();
    for (const item of prevStamped) {
      const arr = pool.get(item.msg) || [];
      arr.push(item.seenAt);
      pool.set(item.msg, arr);
    }

    const now = Date.now();
    return (nextRaw || []).map((msg, i) => {
      const arr = pool.get(msg);
      const reused = arr && arr.length ? arr.shift() : null;
      if (arr && arr.length === 0) pool.delete(msg);
      return { msg, seenAt: reused ?? (now + i) };
    });
  };

  const [processes, setProcesses] = useState([]);
  const [processesLoading, setProcessesLoading] = useState(false);
  const [processesError, setProcessesError] = useState("");

  // --------- STOP A CONTAINER ----------
  const stopContainer = async () => {
    setIsStopping(true);
    const TOAST_ID = "stop-container";

    try {
      const response = await fetch(`${API_BASE_URL}/containers/${id}/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();

      if (response.ok) {
        toast.success("Container stopped successfully.", {
          toastId: TOAST_ID,
          autoClose: 2000,
        });
        setStats((prevStats) => ({
          ...prevStats,
          status: "exited",
          cpu_percent: 0,
        }));
        setProcesses([]); 
      } else {
        toast.error(data.message || "Failed to stop container.", {
          toastId: TOAST_ID,
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Error stopping container:", error);
      toast.error("An error occurred while stopping the container.", {
        toastId: TOAST_ID,
        autoClose: 3000,
      });
    } finally {
      setIsStopping(false);
    }
  };

  // --------- FETCH STATS----------
  useEffect(() => {
    const TOAST_ID = "status-error-container-view";

    const POLL_MS = 5000;
    const controller = new AbortController();

    const fetchStats = async () => {
      const statsCacheKey = `container_stats_${id}`;
      const cachedStats = containerCache.get(statsCacheKey);

      if (cachedStats) {
        setStatsError("");
        setStats(cachedStats);
        setStatsLoading(false);
      }

      try {
        const res = await fetch(`${API_BASE_URL}/containers/${id}/stats`, {
          signal: controller.signal,
        });

        let payload = {};
        try {
          payload = await res.json();
        } catch {
          payload = {};
        }

        if (res.status === 410) {
          if (!toast.isActive(TOAST_ID)) {
            toast.error(
              payload?.message ?? "Container has been removed from environment",
              { toastId: TOAST_ID, autoClose: 5000 }
            );
          }

          setStats(payload);
          setStatsError("Container deleted or removed.");
          setStatsLoading(false);

          if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
          statsIntervalRef.current = null;
          return;
        }

        if (!res.ok) {
          const message = payload.message || "Failed to fetch container stats";

          if (!toast.isActive(TOAST_ID)) {
            toast.error(message, { toastId: TOAST_ID, autoClose: 5000 });
          }

          setStatsError("No data from Docker — metrics unavailable.");
          setStatsLoading(false);
          setStats(payload);
          return;
        }

        containerCache.set(statsCacheKey, payload);
        setStatsError("");
        setStats(payload);
        setStatsLoading(false);

        const cpu = Number(payload?.cpu_percent ?? 0);
        const point = { time: new Date().toLocaleTimeString(), value: cpu };
        setCpuHistory((prev) => [...prev, point].slice(-30));
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error(err);
        setStatsError("Could not load container stats.");
        setStatsLoading(false);
      }
    };

    fetchStats();
    statsIntervalRef.current = setInterval(fetchStats, POLL_MS);

    return () => {
      controller.abort();
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    };
  }, [id]);

  // --------- FETCH STORED METRICS (fetch once; don't overwrite live history) ----------
  useEffect(() => {
    const fetchHistoricalMetrics = () => {
      const historyCacheKey = `container_history_${id}`;
      const cachedHistory = containerCache.get(historyCacheKey);

      if (cachedHistory) {
        const cpuHistoryData = (cachedHistory.cpuHistory || []).map((item) => ({
          time: new Date(item.timestamp).toLocaleTimeString(),
          value: Number(item.value ?? 0),
        }));
        setCpuHistory((prev) => (prev.length ? prev : cpuHistoryData));
        return;
      }

      fetch(`${API_BASE_URL}/containers/${id}/metrics/history`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch stored metrics");
          return res.json();
        })
        .then((data) => {
          containerCache.set(historyCacheKey, data);

          const cpuHistoryData = (data.cpuHistory || []).map((item) => ({
            time: new Date(item.timestamp).toLocaleTimeString(),
            value: Number(item.value ?? 0),
          }));
          setCpuHistory((prev) => (prev.length ? prev : cpuHistoryData));
        })
        .catch((err) => {
          console.error("Failed to fetch stored metrics:", err);
        });
    };

    fetchHistoricalMetrics();
  }, [id]);

  // --------- FETCH LOGS WHEN TAB = "logs" (poll while active) ----------
  useEffect(() => {
    if (activeTab !== "logs") {
      if (logsIntervalRef.current) clearInterval(logsIntervalRef.current);
      logsIntervalRef.current = null;
      return;
    }

    const logsCacheKey = `container_logs_${id}`;
    const cachedLogs = containerCache.get(logsCacheKey);

    if (cachedLogs) {
      const raw = Array.isArray(cachedLogs) ? cachedLogs : [];
      setLogsLoading(false);
      setLogsError("");
      setLogs((prev) => stampLogs(prev, raw));
    }

    const POLL_MS = 3000;
    const controller = new AbortController();

    const fetchLogs = async () => {
      try {
        setLogsLoading(true);
        setLogsError("");

        const res = await fetch(`${API_BASE_URL}/containers/${id}/logs`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch logs");
        const data = await res.json();

        containerCache.set(logsCacheKey, data.logs);

        const raw = Array.isArray(data.logs) ? data.logs : [];
        setLogs((prev) => stampLogs(prev, raw));

        setLogsLoading(false);
        setLogsError("");

        requestAnimationFrame(() => {
          if (logsBoxRef.current) {
            logsBoxRef.current.scrollTop = logsBoxRef.current.scrollHeight;
          }
        });
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error(err);
        setLogsError("Could not load logs.");
        setLogsLoading(false);
      }
    };

    fetchLogs();
    logsIntervalRef.current = setInterval(fetchLogs, POLL_MS);

    return () => {
      controller.abort();
      if (logsIntervalRef.current) clearInterval(logsIntervalRef.current);
      logsIntervalRef.current = null;
    };
  }, [activeTab, id]);

  // --------- FETCH PROCESSES ----------
  useEffect(() => {
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
          setProcesses(Array.isArray(data.processes) ? data.processes : []);
        })
        .catch((err) => {
          console.error(err);
          setProcessesError("Could not load processes.");
          setProcessesLoading(false);
          setProcesses([]);
        });
    };
  


    // Initial fetch
    fetchProcesses();

    // Poll every 5 seconds
    const intervalId = setInterval(fetchProcesses, 5000);

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
  const isRunning = statusLabel === "Running";

  if (statsLoading && !stats) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center gap-6 bg-white p-8 rounded-2xl shadow-lg">
          <div className="relative">
            <FaDocker className="text-6xl text-blue-600 animate-pulse" />
            <div className="absolute inset-0 w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mt-2"></div>
          </div>
          <div className="text-lg font-semibold text-gray-700">Loading container data…</div>
          <div className="text-sm text-gray-500">Fetching latest data</div>
        </div>
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
          <h1 className="text-3xl font-bold">
            Container {containerName || id}
          </h1>

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
{/*uptime */}
  <span className="text-gray-500 text-sm">
  Uptime: {stats?.started_at ? formatUptime(stats.started_at) : (stats?.uptime ?? "N/A")}
</span>



          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={stopContainer}
            disabled={!isRunning || isStopping}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
              isRunning && !isStopping
                ? "bg-red-500 text-white hover:bg-red-600 shadow-sm hover:shadow-md active:scale-95"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isStopping ? "Stopping..." : "Stop Container"}
          </button>
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
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
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

            {processesError && (
              <p className="text-red-500 text-sm mb-3">{processesError}</p>
            )}

            {processesLoading && processes.length === 0 ? (
              <p className="text-gray-500 text-sm">Loading processes…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-gray-600 border-b bg-gray-50">
                      <th className="py-3 px-3">PID</th>
                      <th className="py-3 px-3">CPU%</th>
                      <th className="py-3 px-3">MEM%</th>
                      <th className="py-3 px-3">State</th>
                      <th className="py-3 px-3">CPU Time</th>
                      <th className="py-3 px-3">Command</th>
                    </tr>
                  </thead>

                  <tbody>
                    {processes.length === 0 ? (
                      <tr className="border-b text-sm">
                        <td className="py-2" colSpan="6">
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
                          <td className="py-2 px-3">{proc.pid || "—"}</td>
                          <td className="px-3">
                            {proc.cpu_percent != null
                              ? `${proc.cpu_percent}%`
                              : "—"}
                          </td>
                          <td className="px-3">
                            {proc.mem_percent != null
                              ? `${proc.mem_percent}%`
                              : "—"}
                          </td>
                          <td className="px-3">{proc.state || "—"}</td>
                          <td className="px-3">{proc.time || "—"}</td>
                          <td className="px-3 truncate max-w-xs">
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
        <div ref={logsBoxRef} className="bg-black text-green-400 p-4 rounded-xl shadow h-[500px] overflow-y-auto font-mono text-sm">
          {logsLoading && <p className="text-gray-400">Loading logs…</p>}
          {logsError && <p className="text-red-400">{logsError}</p>}
          {!logsLoading &&
            !logsError &&
            logs.map((item, i) => (
              <p key={i}>
                <span className="text-gray-400">[{new Date(item.seenAt).toLocaleTimeString()}]</span>{" "}
                {item.msg}
              </p>
            ))}
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
  if (s === "deleted") return "Deleted";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
