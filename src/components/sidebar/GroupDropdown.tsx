import React, { useState } from "react";

interface Group {
  _id: string;
  name: string;
}

interface GroupDropdownProps {
  groups: Group[];
  activeGroup: Group | null;
  setActiveGroup: (g: Group) => void;
}

const GroupDropdown: React.FC<GroupDropdownProps> = ({ groups, activeGroup, setActiveGroup }) => {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        className="w-full text-left px-3 py-2 rounded text-sm font-bold mb-2"
        style={{
          background: "linear-gradient(to bottom, #3f0f40, #2b0a2c)",
          color: "white"
        }}
        onClick={() => setOpen((v) => !v)}
      >
        # Channels
        <span className="float-right">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="space-y-2">
          {groups.map((g) => (
            <button
              key={g._id}
              onClick={() => setActiveGroup(g)}
              className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-white/10 ${activeGroup?._id === g._id ? "bg-white/10" : ""}`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupDropdown;
