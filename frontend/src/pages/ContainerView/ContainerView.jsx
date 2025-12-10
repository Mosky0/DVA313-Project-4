import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useParams, useLocation } from "react-router-dom";
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
  const { id } = useParams(); // from route /containers/:id
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("details");
  const containerName = location.state?.name || "";
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  const [cpuHistory, setCpuHistory] = useState([]); 

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");

  // --------- FETCH STATS (poll every 5s) ----------
  useEffect(() => {
    let intervalId;
    const TOAST_ID= "status-error-container-view";
    const POL_TIME_MS = 3000;

    const fetchStats = async () => {
      const statsCacheKey = `container_stats_${id}`;
      const cachedStats = containerCache.get(statsCacheKey);
      
      if (cachedStats) {
        setStatsError("");
        setStats(cachedStats);
        setStatsLoading(false);
      }
      
      fetch(`${API_BASE_URL}/containers/${id}/stats`)
        .then(async (res) => {
          var payload = await res.json();
          if (res.status === 410) {
            if (!toast.isActive(TOAST_ID)) {
              toast.error(payload?.message ?? "Container has been removed from environment", { toastId: TOAST_ID, autoClose: 5000 });
            } 
            setStats(payload);
            
            setStatsError("Container deleted or removed.");
            setStatsLoading(false);

            clearInterval(intervalId)
            return payload;
          }
          else if (!res.ok) {
            const message = payload.message || "Failed to fetch container stats";

            if (!toast.isActive(TOAST_ID)) {
              toast.error(message, { toastId: TOAST_ID, autoClose: 5000 });
            }

            setStatsError("No data from Docker — metrics unavailable.");
            setStatsLoading(false);
            setStats(payload);
            return payload;
          }
          return payload;
        })
        .then((data) => {
          containerCache.set(statsCacheKey, data);
          setStatsError("");
          setStats(data);
          setStatsLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setStatsError("Could not load container stats.");
          setStatsLoading(false);
        });
    };

    fetchStats();
    intervalId = setInterval(fetchStats, POL_TIME_MS);

    return () => clearInterval(intervalId);
  }, [id]);

  // --------- FETCH STORED METRICS ----------
  useEffect(() => {
    const fetchHistoricalMetrics = () => {
      const historyCacheKey = `container_history_${id}`;
      const cachedHistory = containerCache.get(historyCacheKey);
      
      if (cachedHistory) {
        const cpuHistoryData = (cachedHistory.cpuHistory || []).map(item => ({
          time: new Date(item.timestamp).toLocaleTimeString(),
          value: item.value
        }));
        setCpuHistory(cpuHistoryData);
        return;
      }
      
      fetch(`${API_BASE_URL}/containers/${id}/metrics/history`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch stored metrics");
          return res.json();
        })
        .then((data) => {
          containerCache.set(historyCacheKey, data);
          
          const cpuHistoryData = (data.cpuHistory || []).map(item => ({
            time: new Date(item.timestamp).toLocaleTimeString(),
            value: item.value
          }));
          setCpuHistory(cpuHistoryData);
        })
        .catch((err) => {
          console.error("Failed to fetch stored metrics:", err);
        });
    };

    fetchHistoricalMetrics();
    const interval = setInterval(fetchHistoricalMetrics, 1000);

    return () => clearInterval(interval);
  }, [id]);


  // --------- FETCH LOGS WHEN TAB = "logs" ----------
  useEffect(() => {
    if (activeTab !== "logs") return;

    const logsCacheKey = `container_logs_${id}`;
    const cachedLogs = containerCache.get(logsCacheKey);
    
    if (cachedLogs) {
      setLogsLoading(false);
      setLogsError("");
      setLogs(Array.isArray(cachedLogs) ? cachedLogs : []);
      return;
    }

    setLogsLoading(true);
    setLogsError("");

    fetch(`${API_BASE_URL}/containers/${id}/logs`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch logs");
        return res.json();
      })
      .then((data) => {
        containerCache.set(logsCacheKey, data.logs);
        
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

  const memPercent = (() => {
    if (!stats || !stats.mem_usage_bytes || !stats.mem_limit_bytes) return 0;
    if (stats.mem_limit_bytes === 0) return 0;
    return Math.min(
      100,
      (stats.mem_usage_bytes / stats.mem_limit_bytes) * 100
    );
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
                <p className="text-xl font-bold">
                  {cpuValue.toFixed(1)}%
                </p>
                <p className="text-gray-500 text-sm">CPU</p>
              </div>
            </div>

            {/* Memory card */}
            <div className="bg-white shadow rounded-xl p-6">
              <p className="font-semibold text-gray-700 mb-2">Memory</p>

              <p className="text-xl font-bold mb-2">
                {memPercent.toFixed(1)}%
              </p>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-green-500"
                  style={{ width: `${memPercent}%` }}
                ></div>
              </div>

              <p className="text-sm text-gray-500 mt-2">
                {memUsedMB.toFixed(1)} MB /{" "}
                {memTotalMB.toFixed(1)} MB
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
                    <XAxis dataKey="time" stroke="#555" hide={cpuHistory.length === 0} />
                    <YAxis stroke="#555" domain={[0, 1]} tickFormatter={(value) => `${value.toFixed(2)}%`} />
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

          {/* Processes Table (still dummy for now) */}
          <div className="bg-white shadow rounded-xl p-6">
            <p className="font-semibold mb-4 text-gray-700">
              Processes (top) – placeholder
            </p>

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
                <tr className="border-b text-sm">
                  <td className="py-2">—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>No process data (not in API yet)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* LOGS TAB */}
      {activeTab === "logs" && (
        <div className="bg-black text-green-400 p-4 rounded-xl shadow h-[500px] overflow-y-auto font-mono text-sm">
          {logsLoading && (
            <p className="text-gray-400">Loading logs…</p>
          )}
          {logsError && (
            <p className="text-red-400">{logsError}</p>
          )}
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
  if (s === "deleted") return "Deleted";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
