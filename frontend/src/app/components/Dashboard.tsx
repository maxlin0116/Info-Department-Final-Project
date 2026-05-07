import { useState } from "react";
import { Users, Hammer, Printer, Zap, Plus, Info } from "lucide-react";
import { ReservationModal } from "./ReservationModal";

type Status = "available" | "occupied" | "maintenance";

const getStatusColor = (status: Status) => {
  switch (status) {
    case "available":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30 shadow-[0_0_15px_rgba(52,211,153,0.15)] ring-1 ring-emerald-400/20";
    case "occupied":
      return "text-rose-400 bg-rose-400/10 border-rose-400/30 shadow-[0_0_15px_rgba(251,113,133,0.15)] ring-1 ring-rose-400/20";
    case "maintenance":
      return "text-amber-400 bg-amber-400/10 border-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/20";
  }
};

const getStatusGlow = (status: Status) => {
  switch (status) {
    case "available": return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]";
    case "occupied": return "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]";
    case "maintenance": return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]";
  }
};

const getStatusLabel = (status: Status) => {
  switch (status) {
    case "available": return "Available";
    case "occupied": return "In Use";
    case "maintenance": return "Maintenance";
  }
};

interface EquipmentProps {
  name: string;
  status: Status;
  icon: React.ElementType;
  details?: string;
  onReserve: () => void;
}

function EquipmentCard({ name, status, icon: Icon, details, onReserve }: EquipmentProps) {
  return (
    <div className={`relative p-5 rounded-xl border flex flex-col transition-all duration-300 ${getStatusColor(status)} group`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-700">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">{name}</h3>
            {details && <p className="text-xs text-slate-400 mt-0.5">{details}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium uppercase tracking-wider opacity-80 whitespace-nowrap">{getStatusLabel(status)}</span>
          <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusGlow(status)}`} />
        </div>
      </div>
      
      <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-700/50">
        <button className="text-slate-400 hover:text-slate-200 transition-colors">
          <Info className="w-4 h-4" />
        </button>
        <button 
          onClick={onReserve}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-all text-slate-200"
        >
          <Plus className="w-3.5 h-3.5" />
          Reserve
        </button>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string>("");

  const handleReserve = (resource: string) => {
    setSelectedResource(resource);
    setModalOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column (25%): Meeting Table Area */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1 pb-2 border-b border-slate-800">
            <Users className="w-5 h-5 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Meeting Area</h2>
          </div>
          
          <EquipmentCard 
            name="Main Collab Table" 
            status="occupied" 
            icon={Users} 
            details="Capacity: 6 people"
            onReserve={() => handleReserve("Main Collab Table")} 
          />
          <EquipmentCard 
            name="Side Desk A" 
            status="available" 
            icon={Users} 
            details="Capacity: 2 people"
            onReserve={() => handleReserve("Side Desk A")} 
          />
        </div>

        {/* Middle Column (50%): Welding & 3DP Area */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1 pb-2 border-b border-slate-800">
            <Hammer className="w-5 h-5 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Welding & 3D Printing</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Welding Stations</h3>
              {[1, 2, 3, 4].map((num) => (
                <EquipmentCard 
                  key={`weld-${num}`}
                  name={`Welding Station ${num}`} 
                  status={num === 2 ? "occupied" : num === 4 ? "maintenance" : "available"} 
                  icon={Hammer} 
                  details="Includes 2 safety chairs"
                  onReserve={() => handleReserve(`Welding Station ${num}`)} 
                />
              ))}
            </div>
            
            <div className="space-y-4">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">3D Printers</h3>
              {["Prusa i3 MK3S+", "Ender 3 Pro", "Formlabs Form 3", "Ultimaker S5"].map((printer, idx) => (
                <EquipmentCard 
                  key={`printer-${idx}`}
                  name={printer} 
                  status={idx === 0 || idx === 3 ? "occupied" : "available"} 
                  icon={Printer} 
                  details="PLA / PETG / Resin"
                  onReserve={() => handleReserve(printer)} 
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (25%): Heavy Processing Area */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1 pb-2 border-b border-slate-800">
            <Zap className="w-5 h-5 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Heavy Processing</h2>
          </div>
          
          <EquipmentCard 
            name="CNC Router" 
            status="available" 
            icon={Zap} 
            details="Wood & Soft Metals"
            onReserve={() => handleReserve("CNC Router")} 
          />
          <EquipmentCard 
            name="Laser Cutter" 
            status="occupied" 
            icon={Zap} 
            details="Acrylic & Wood"
            onReserve={() => handleReserve("Laser Cutter")} 
          />
          <EquipmentCard 
            name="Drill Press" 
            status="available" 
            icon={Zap} 
            details="Variable Speed"
            onReserve={() => handleReserve("Drill Press")} 
          />
        </div>
      </div>

      <ReservationModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        resourceName={selectedResource}
      />
    </>
  );
}
