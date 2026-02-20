// GroupList component for Dashboard sidebar
import React from "react";

interface Group {
  _id: string;
  name: string;
}

interface GroupListProps {
  groups: Group[];
  activeGroup: Group | null;
  setActiveGroup: (g: Group) => void;
}

const GroupList: React.FC<GroupListProps> = ({ groups, activeGroup, setActiveGroup }) => (
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
);

export default GroupList;
