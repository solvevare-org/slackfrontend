import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { API_URL } from "@/lib/config";
import { imgUrl } from "@/lib/utils";

interface IWorkspace {
  _id: string;
  name: string;
  image?: string;
}

interface WorkspaceSidebarProps {
  onVisibilityChange?: (visible: boolean) => void;
}

const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({ onVisibilityChange }) => {
  const [workspaces, setWorkspaces] = useState<IWorkspace[]>([]);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) setUser(JSON.parse(raw));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch(`${API_URL}/api/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((d) => {
        if (Array.isArray(d.workspaces)) {
          setWorkspaces(d.workspaces);
        }
      })
      .catch((e) => {
        console.error("WorkspaceSidebar: fetch error", e);
      });
  }, []);

  const openWorkspace = (ws: IWorkspace) => {
    try {
      localStorage.setItem(
        "currentWorkspace",
        JSON.stringify({ id: ws._id, name: ws.name, image: ws.image })
      );
    } catch {}

    const namePart = encodeURIComponent(ws.name);
    window.location.href = `/dashboard/${namePart}/${ws._id}`;
  };

  const isAdmin = (user?.role || user?.Role || '').toString().toLowerCase() === 'admin';
  const shouldShow = workspaces.length > 1 || isAdmin;
  
  useEffect(() => {
    onVisibilityChange?.(shouldShow);
  }, [shouldShow, onVisibilityChange]);
  
  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed left-0 top-0 h-full w-[60px] bg-gradient-to-b from-[#1a1d21] via-[#0f1115] to-[#1a1d21] flex flex-col items-center py-6 text-white shadow-2xl border-r border-purple-500/20">
      <div className="flex flex-col items-center gap-3 w-full px-2">
        {workspaces.map((ws) => (
          <div key={ws._id} className="relative group">
            <button
              onClick={() => openWorkspace(ws)}
              className="w-12 h-12 rounded-xl overflow-hidden transition-all duration-300 hover:rounded-lg hover:scale-110 shadow-lg hover:shadow-purple-500/50"
            >
              {ws.image ? (
                <img
                  src={imgUrl(ws.image)}
                  alt={ws.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center font-bold text-white text-lg">
                  {ws.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}
            </button>
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
              {ws.name}
            </div>
          </div>
        ))}

        {isAdmin && (
          <button
            onClick={() => navigate("/workspace")}
            className="w-12 h-12 flex items-center justify-center  hover:from-purple-700 hover:to-purple-900 text-white rounded-xl transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-purple-500/50 mt-2"
          >
            <Plus size={22} />
          </button>
        )}
      </div>
    </div>
  );
};

export default WorkspaceSidebar;
