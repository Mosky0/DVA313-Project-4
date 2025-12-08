import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config"; // make sure this exists


export default function Logs() {
  const navigate = useNavigate();


  /** -------------------------------------------------------- **/

  // List of containers fetched from the backend: [{ id, name, status, image }, ...]
  const [containers, setContainers] = useState([]);

  // The ID of the currently selected container from the dropdown
  const [selectedContainer, setSelectedContainer] = useState("");

  // Array of log lines for the selected container: ["[time] log line...", ...]
  const [logs, setLogs] = useState([]);

  // Current text in the "Search logs…" input (used to filter the logs)
  const [search, setSearch] = useState("");

  // Are we currently loading the containers list from /api/containers?
  const [loadingContainers, setLoadingContainers] = useState(false);

  // Are we currently loading logs for the selected container?
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Error message to show in the UI if any fetch (containers/logs) fails
  const [error, setError] = useState("");



  // Load containers list from backend
  useEffect(() => {
    let isCancelled = false;

    async function fetchContainers() {
      try {
        setLoadingContainers(true);
        setError("");
        const res = await fetch(`${API_BASE_URL}/containers`);

        console.log("Containers response status:", res.status);

        if (!res.ok) {
          throw new Error(`Failed to load containers: ${res.status}`);
        }

        const data = await res.json(); // [{ id, name, status, image }]
        console.log("Containers data:", data);

        if (!isCancelled) {
          setContainers(data);
        }
      } catch (err) {
        console.error("Error loading containers:", err);
        if (!isCancelled) {
          setError("Could not load containers.");
        }
      } finally {
        if (!isCancelled) {
          setLoadingContainers(false);
        }
      }
    }

    fetchContainers();

    const interval = setInterval(fetchContainers, 3000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);


  // Load logs for selected container and poll every 3s
  useEffect(() => {
    if (!selectedContainer) {
      setLogs([]);
      return;
    }

    console.log("Selected container:", selectedContainer);

    let isCancelled = false;

    async function fetchLogs() {
      try {
        setLoadingLogs(true);
        setError("");
        const res = await fetch(
          `${API_BASE_URL}/containers/${selectedContainer}/logs`
        );

        console.log("Logs response status:", res.status);

        if (!res.ok) {
          throw new Error(`Failed to load logs: ${res.status}`);
        }

        const data = await res.json(); // { container, logs: [...] }
        console.log("Logs data:", data);

        if (!isCancelled) {
          setLogs(data.logs || []);
        }
      } catch (err) {
        console.error(err);
        if (!isCancelled) {
          setError("Could not load logs for this container.");
        }
      } finally {
        if (!isCancelled) {
          setLoadingLogs(false);
        }
      }
    }

    // initial load
    fetchLogs();

    // poll
    const interval = setInterval(fetchLogs, 3000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [selectedContainer]);



  // Filter logs in real-time
  const filteredLogs = logs.filter((line) =>
    line.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ---------------------- TABS ---------------------- */}
      <div className="flex gap-3 mb-6 bg-blue-600 p-2 rounded-xl shadow">
        <button
          onClick={() => navigate("/containers")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
            window.location.pathname === "/containers"
              ? "bg-white text-blue-600 shadow"
              : "text-white hover:bg-blue-500"
          }`}
        >
          Containers
        </button>

        <button
          onClick={() => navigate("/logs")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
            window.location.pathname === "/logs"
              ? "bg-white text-blue-600 shadow"
              : "text-white hover:bg-blue-500"
          }`}
        >
          Logs
        </button>
      </div>

      {/* ---------------------- SEARCH + FILTER ---------------------- */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4 items-center">

          {/* Container dropdown */}
          <select
            className="w-full md:w-64 border border-gray-300 px-3 py-2 rounded-lg bg-gray-50 shadow-sm focus:ring-2 focus:ring-blue-400"
            value={selectedContainer}
            onChange={(e) => setSelectedContainer(e.target.value)}
          >
            <option value="">Select container</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Search input */}
          <input
            type="text"
            placeholder="Search logs…"
            className="w-full md:w-72 border border-gray-300 px-3 py-2 rounded-lg bg-gray-50 shadow-sm focus:ring-2 focus:ring-blue-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ---------------------- LOG VIEWER ---------------------- */}
      <div className="bg-[#1e1e1e] text-green-400 p-5 rounded-xl h-[450px] overflow-y-auto shadow-inner border border-gray-700 font-mono text-sm whitespace-pre-wrap">
        {selectedContainer ? (
          filteredLogs.length ? (
            filteredLogs.map((line, i) => (
              <div key={i} className="py-0.5">{line}</div>
            ))
          ) : (
            <div className="text-gray-400">No logs found…</div>
          )
        ) : (
          <div className="text-gray-400">Select a container to view logs</div>
        )}
      </div>
    </div>
  );
}
