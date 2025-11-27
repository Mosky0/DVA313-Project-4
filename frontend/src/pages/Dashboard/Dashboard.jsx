import React from "react";
import ContainerListPanel from "../../components/containers/ContainerListPanel";
import ChartCard from "../../components/ui/ChartCard";
import CircleMetric from "../../components/ui/CircleMetric";
import { FaMicrochip, FaMemory, FaBoxes, FaHdd } from "react-icons/fa";

/* Dummy data for charts */
const cpuData = [
  { time: "10:00", value: 20 },
  { time: "10:05", value: 30 },
  { time: "10:10", value: 25 },
  { time: "10:15", value: 45 },
  { time: "10:20", value: 35 },
  { time: "10:25", value: 55 },
  { time: "10:30", value: 40 },
];

const memData = [
  { time: "10:00", value: 40 },
  { time: "10:05", value: 42 },
  { time: "10:10", value: 41 },
  { time: "10:15", value: 47 },
  { time: "10:20", value: 44 },
  { time: "10:25", value: 50 },
  { time: "10:30", value: 48 },
];

/* Dummy table data */
const processes = [
  { pid: 123, name: "procA", cpu: "12%", mem: "3%" },
  { pid: 456, name: "procB", cpu: "8%", mem: "1%" },
  { pid: 789, name: "procC", cpu: "6%", mem: "2%" },
];

const events = [
  "[11:50] ied-05 high CPU alert",
  "[11:45] ied-03 restarted",
  "[10:12] ied-11 memory spike",
];

export default function Dashboard() {
  // top metrics (dummy values)
  const totalContainers = 24;
  const running = 20;
  const cpuAvg = 37; 
  const memAvg = 54; 
  const storagePct = 62; 

  return (
    <div className="flex gap-6">
      {/* left panel */}
      <div className="w-80 shrink-0">
        <ContainerListPanel />
      </div>

      {/* main content */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Overview header with 5 quick metrics */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">System Overview</h2>

          <div className="grid grid-cols-5 gap-4 items-stretch">
            <div className="bg-white rounded-xl p-1 shadow-sm flex flex-col">
              <div className="flex items-center justify-between flex-1  ">
                
                <div  >
                  <div className="text-xs text-gray-500 ">Total Containers</div>
                  <div className="text-2xl font-semibold text-slate-900">{totalContainers}</div>
                </div>
                <div className="text-2xl text-slate-700"><FaBoxes /></div>
              </div>
            </div>

          <div className="bg-white rounded-xl p-1 shadow-sm flex items-center justify-between">
           <div className="flex flex-col">
           <div className="text-xs text-gray-500">Running</div>
           <div className="text-2xl font-semibold text-slate-900">{running}</div>
         </div>

  <div className="text-2xl text-slate-700">
    <FaMicrochip />
  </div>
</div>


            <div className="bg-white rounded-xl p-1 shadow-sm flex flex-col items-start">
              <div className="text-xs text-gray-500">CPU Average</div>
              <div className="mt-2">
                <CircleMetric value={cpuAvg} size={62} stroke={8} label="CPU Avg" color="#2496ED" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-1 shadow-sm flex flex-col items-start">
              <div className="text-xs text-gray-500">Memory Average</div>
              <div className="mt-2">
                <CircleMetric value={memAvg} size={62} stroke={8} label="Memory" color="#16A34A" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-1 shadow-sm flex flex-col items-start">
              <div className="text-xs text-gray-500">Storage</div>
              <div className="mt-2">
                <CircleMetric value={storagePct} size={62} stroke={8} label="Storage" color="#F59E0B" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats & Charts */}
        <div className="grid grid-cols-2 gap-6">
          <ChartCard title="CPU Activity (Last 30 min)" data={cpuData} type="line" />
          <ChartCard title="Memory Consumption (Last 30 min)" data={memData} type="area" />
        </div>

        {/* Bottom: processes table & recent events */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Top Processes</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="pb-2">PID</th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">CPU%</th>
                  <th className="pb-2">MEM%</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {processes.map((p) => (
                  <tr key={p.pid}>
                    <td className="py-2">{p.pid}</td>
                    <td>{p.name}</td>
                    <td>{p.cpu}</td>
                    <td>{p.mem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Events</h3>
            <ul className="text-sm text-gray-600 space-y-3">
              {events.map((e, i) => (
                <li key={i} className="p-3 bg-gray-50 rounded-lg">{e}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
