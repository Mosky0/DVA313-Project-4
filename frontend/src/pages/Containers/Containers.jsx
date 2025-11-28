import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { PiMicrosoftExcelLogoFill } from "react-icons/pi";
import { FaChevronUp, FaChevronDown, FaChevronRight } from "react-icons/fa";

const tabs = ["Containers", "Logs"];
const filterOptions = ["All", "Running", "Stopped"];

const dummyData = [
  { id: "ied-01", name: "Container A", cpu: 12, mem: 34, status: "Running" },
  { id: "ied-02", name: "Container B", cpu: 0, mem: 0, status: "Stopped" },
  { id: "ied-03", name: "Container C", cpu: 6, mem: 22, status: "Running" },
];

export default function Containers() {
  const [activeTab, setActiveTab] = useState("Containers");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");

  const navigate = useNavigate();

  // ---- SORT HANDLER ----
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // ---- FILTER + SEARCH + SORT LOGIC ----
  const filtered = dummyData
    .filter((c) => (filter === "All" ? true : c.status === filter))
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    const valA = a[sortField];
    const valB = b[sortField];
    if (sortOrder === "asc") return valA > valB ? 1 : -1;
    return valA < valB ? 1 : -1;
  });

  // ---- EXPORT EXCEL ----
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(sorted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Containers");
    XLSX.writeFile(wb, "containers.xlsx");
  };

  return (
    <div className="p-6">

      {/* -------------------- TABS -------------------- */}
<div className="flex gap-2 mb-4 bg-blue-600 p-1 rounded-lg">
  <button
    onClick={() => navigate("/containers")}
    className={`px-4 py-2 rounded-md text-sm transition ${
      window.location.pathname === "/containers"
        ? "bg-white text-blue-700 font-semibold"
        : "text-white hover:bg-blue-500"
    }`}
  >
    Containers
  </button>

  <button
    onClick={() => navigate("/logs")}
    className={`px-4 py-2 rounded-md text-sm transition ${
      window.location.pathname === "/logs"
        ? "bg-white text-blue-700 font-semibold"
        : "text-white hover:bg-blue-500"
    }`}
  >
    Logs
  </button>
</div>


      {/* -------------------- SEARCH + FILTER + EXPORT -------------------- */}
    <div className="bg-white pt-3 px-4 rounded-xl shadow mb-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">

        {/* search */}
        <input
          type="text"
          placeholder="Search containers name..."
          className="px-3 py-2 rounded-md border border-gray-300 w-64 bg-gray-50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* filter */}
        <select
          className="px-3 py-2 rounded-md border border-gray-300 bg-white"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {filterOptions.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>

        {/* export */}
        <button
          onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          <PiMicrosoftExcelLogoFill size={20} />
          Export
        </button>
      </div>
    </div>


      {/* -------------------- TABLE -------------------- */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-blue-600 text-white">
            <tr>
              {["id", "name", "cpu", "mem", "status"].map((col) => (
                <th
                  key={col}
                  className="py-3 px-4 cursor-pointer select-none"
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    {col.toUpperCase()}
                    {sortField === col ? (
                      sortOrder === "asc" ? (
                        <FaChevronUp className="text-xs" />
                      ) : (
                        <FaChevronDown className="text-xs" />
                      )
                    ) : null}
                  </div>
                </th>
              ))}

              <th className="py-3 px-4">View</th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((row) => (
              <tr key={row.id} className="border-b hover:bg-gray-100">
                <td className="py-3 px-4">{row.id}</td>
                <td className="py-3 px-4">{row.name}</td>
                <td className="py-3 px-4">{row.cpu}%</td>
                <td className="py-3 px-4">{row.mem}%</td>
                <td className="py-3 px-4">{row.status}</td>

                {/* View button */}
                <td className="py-3 px-4 text-right">
                  <button
                    className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                    onClick={() => navigate(`/containers/${row.id}`)}
                  >
                    <FaChevronRight />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* -------------------- PAGINATION -------------------- */}
      <div className="flex justify-end mt-4 gap-2">
        <button className="px-3 py-1 rounded border">Previous</button>
        <button className="px-3 py-1 rounded border">Next</button>
      </div>
    </div>
  );
}
