import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Users, Building2, ArrowRight, X, Sparkles, Trash2 } from "lucide-react";

const Workspace = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [hoveredWorkspace, setHoveredWorkspace] = useState<string | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {}
    
    // Show welcome message on first load
    const hasSeenWelcome = sessionStorage.getItem('hasSeenWelcome');
    if (!hasSeenWelcome) {
      setShowWelcome(true);
      setTimeout(() => {
        setShowWelcome(false);
        sessionStorage.setItem('hasSeenWelcome', 'true');
      }, 4000);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    (async () => {
      try {
        const res = await fetch("http://72.60.97.98:6006/api/workspaces", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          // token invalid or expired
          console.warn('Workspaces fetch unauthorized');
          navigate('/login');
          return;
        }
        if (!res.ok) {
          const err = await res.text();
          console.error('Workspaces fetch failed', res.status, err);
          return;
        }
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
      } catch (e) {
        console.error('Workspaces fetch error', e);
      }
    })();
  }, []);

  const isAdmin = (user?.role || user?.Role || "").toString().toLowerCase() === "admin";

  const handleCreate = async () => {
    if (creating) return;
    if (!name.trim()) {
      setMsg("Workspace name is required");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    setCreating(true);
    setMsg("");

    try {
      const body = { name: name.trim() };
      const res = await fetch("http://72.60.97.98:6006/api/workspaces", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.message || data?.msg || "Create failed");
      } else {
        // After creating workspace, save currentWorkspace and redirect to dashboard
        const ws = data.workspace;
        try {
          localStorage.setItem('currentWorkspace', JSON.stringify({ id: ws._id, name: ws.name, members: ws.members || [] }));
        } catch (e) {}
        navigate('/dashboard');
      }
    } catch (e) {
      setMsg("Server error");
    } finally {
      setCreating(false);
    }
  };

  const openWorkspace = (ws: any) => {
    try { localStorage.setItem('currentWorkspace', JSON.stringify({ id: ws._id, name: ws.name, members: ws.members || [] })); } catch (e) {}
    navigate('/dashboard');
  };

  const deleteWorkspace = async (wsId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;
    
    if (!confirm('Are you sure you want to delete this workspace? All channels and data will be removed.')) return;
    
    setDeletingWorkspace(wsId);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`http://72.60.97.98:6006/api/workspaces/${wsId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setWorkspaces(prev => prev.filter(w => w._id !== wsId));
        setMsg('Workspace deleted successfully');
        setTimeout(() => setMsg(''), 3000);
      } else {
        const data = await res.json();
        setMsg(data?.msg || 'Delete failed');
      }
    } catch (e) {
      setMsg('Server error');
    } finally {
      setDeletingWorkspace(null);
    }
  };

  return (
    <AppLayout>
      {/* Welcome Toast */}
      {showWelcome && (
        <div className="fixed top-24 right-6 z-50 animate-slideIn">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-2xl shadow-2xl border border-purple-400/30 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Welcome back, {user?.name}! 🎉</h3>
                <p className="text-sm text-purple-100">Ready to collaborate with your team</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="min-h-full flex items-center justify-center bg-gradient-to-br from-[#0a0b0d] via-[#1a1d21] to-[#0f1115] text-[#D1D2D3] p-8">
        <div className="w-full max-w-5xl">
          <div className="bg-gradient-to-br from-[#1a1d21]/80 via-[#111214]/90 to-[#0f1115]/80 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-10 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Sparkles className="w-7 h-7 text-purple-400" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Welcome to SolveVare</h1>
            </div>
            <p className="text-sm text-gray-400 mb-8 ml-14">Create or join a workspace to start collaborating — Slack-style experience will continue inside the Dashboard.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-8 bg-gradient-to-br from-[#1a1d21] to-[#141619] rounded-xl border border-purple-500/20 flex flex-col justify-between hover:border-purple-500/40 transition-all duration-300">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <Plus className="w-5 h-5 text-purple-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-purple-300">Add Work Space</h2>
                  </div>
                  <p className="text-sm text-gray-400 mt-2 ml-11">Create a new workspace. Only admins can create workspaces.</p>
                </div>

                <div className="mt-6">
                  {isAdmin ? (
                    <div className="flex gap-2 items-center">
                      {!showInput ? (
                        <Button onClick={() => setShowInput(true)} className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Add Work Space
                        </Button>
                      ) : (
                        <div className="flex gap-2 w-full items-center flex-wrap">
                          <Input value={name} onChange={(e) => setName((e.target as HTMLInputElement).value)} placeholder="Workspace name" className="flex-1 bg-[#0a0b0d] border-purple-500/30 focus:border-purple-500" />
                          <Button onClick={handleCreate} disabled={creating} className="bg-purple-600 hover:bg-purple-700 text-white">{creating ? 'Saving...' : 'Create'}</Button>
                          <Button variant="ghost" onClick={() => { setShowInput(false); setName(''); }} className="hover:bg-red-500/10 hover:text-red-400">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">You don't have permission to create a workspace. Ask your admin to invite you to a workspace.</div>
                  )}

                  {msg && <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{msg}</div>}
                </div>
              </div>

              <div className="p-8 bg-gradient-to-br from-[#1a1d21] to-[#141619] rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Building2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-purple-300">Your Workspaces</h2>
                </div>
                <div className="mt-4">
                  {workspaces.length === 0 ? (
                    <div className="text-sm text-gray-400 bg-gray-500/5 border border-gray-500/20 rounded-lg p-6 text-center">
                      <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                      <p>No workspaces yet. Create one or ask your admin to invite you.</p>
                    </div>
                  ) : (
                    <ul className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {workspaces.map((ws) => (
                        <li key={ws._id} onMouseEnter={() => setHoveredWorkspace(ws._id)} onMouseLeave={() => setHoveredWorkspace(null)}>
                          <button onClick={() => openWorkspace(ws)} className="w-full text-left px-4 py-3 rounded-lg bg-[#0a0b0d]/50 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/30 flex items-center justify-between group transition-all duration-200">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                                <Building2 className="w-4 h-4 text-purple-400" />
                              </div>
                              <span className="font-medium text-gray-200 group-hover:text-purple-300 transition-colors">{ws.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isAdmin && hoveredWorkspace === ws._id && (
                                <button
                                  onClick={(e) => deleteWorkspace(ws._id, e)}
                                  disabled={deletingWorkspace === ws._id}
                                  className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all border border-red-500/30 hover:border-red-500/50"
                                  title="Delete workspace"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                              )}
                              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Workspace;
