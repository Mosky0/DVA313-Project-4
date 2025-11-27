import { FaSearch } from "react-icons/fa";

export default function Header() {
    
  return (
    <header className="w-full h-16 bg-white shadow-sm flex items-center justify-between px-6">
      
      {/* Logo / Title */}
      <div className="flex items-center gap-3">
        <img 
          src="/hitachi_logo_icon_168125.svg" 
          alt="Hitachi Logo" 
          className="h-8 w-auto object-contain"
        />
        <h1 className="text-l font-semibold text-[#0D2940] tracking-wide">
          Monitoring Tool
        </h1>
      </div>

      {/* Search Bar */}
      <div className="flex items-center bg-gray-100 px-4 py-2 rounded-xl w-80">
        
        <input
          type="text"
          placeholder="Search..."
          className="bg-transparent outline-none text-sm w-full"
        />
         <FaSearch className="text-gray-400 text-sm" />
      </div>

     
    </header>
  );
}
