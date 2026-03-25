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
  const [currentWsId, setCurrentWsId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) setUser(JSON.parse(raw));
    try {
      const ws = JSON.parse(localStorage.getItem('currentWorkspace') || 'null');
      if (ws?.id) setCurrentWsId(ws.id);
    } catch {}
  }, []);

  useEffect(() => {
    const handleWsChange = () => {
      try {
        const ws = JSON.parse(localStorage.getItem('currentWorkspace') || 'null');
        if (ws?.id) setCurrentWsId(ws.id);
      } catch {}
    };
    window.addEventListener('workspace-changed', handleWsChange);
    window.addEventListener('storage', handleWsChange);
    return () => {
      window.removeEventListener('workspace-changed', handleWsChange);
      window.removeEventListener('storage', handleWsChange);
    };
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
      localStorage.setItem('currentWorkspace', JSON.stringify({ id: ws._id, name: ws.name, image: ws.image }));
    } catch {}
    setCurrentWsId(ws._id);
    window.dispatchEvent(new Event('workspace-changed'));
    navigate('/dashboard');
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
    <div className="fixed left-0 top-0 h-full w-[60px] bg-gradient-to-b from-[#1a1d21] via-[#0f1115] to-[#1a1d21] flex flex-col items-center py-5 text-white shadow-2xl border-r border-purple-500/20">
      <div className="flex flex-col items-center gap-4 w-full px-2">
        {workspaces.map((ws) => {
          const isSelected = ws._id === currentWsId;
          return (
          <div key={ws._id} className="relative group">
            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
            )}
            <button
              onClick={() => openWorkspace(ws)}
              className={`w-12 h-12 overflow-hidden transition-all duration-300 shadow-lg ${
                isSelected
                  ? 'rounded-2xl ring-2 ring-white/40 scale-105'
                  : 'rounded-xl hover:rounded-2xl hover:scale-110 hover:shadow-purple-500/50'
              }`}
            >
              {ws.image ? (
                <img src={imgUrl(ws.image)} alt={ws.name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center font-bold text-white text-lg ${
                  isSelected ? 'bg-purple-500' : 'bg-gradient-to-br from-purple-600 to-purple-800'
                }`}>
                  {ws.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </button>
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
              {ws.name}
            </div>
          </div>
          );
        })}

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
