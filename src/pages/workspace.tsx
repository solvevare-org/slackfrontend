import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Users, Building2, ArrowRight, X, Sparkles, Trash2, Image as ImageIcon, Briefcase, Clock, Shield } from "lucide-react";
import { API_URL } from "@/lib/config";
import { imgUrl } from "@/lib/utils";

const Workspace = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [hoveredWorkspace, setHoveredWorkspace] = useState<string | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {}
    
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
        const res = await fetch(`${API_URL}/api/workspaces`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
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
      const formData = new FormData();
      formData.append('name', name.trim());
      if (image) formData.append('image', image);
      
      const res = await fetch(`${API_URL}/api/workspaces`, {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.message || data?.msg || "Create failed");
      } else {
        const ws = data.workspace;
        try {
          localStorage.setItem('currentWorkspace', JSON.stringify({ id: ws._id, name: ws.name, image: ws.image, members: ws.members || [] }));
        } catch (e) {}
        setShowInput(false);
        setName('');
        setImage(null);
        setWorkspaces(prev => [...prev, ws]);
        navigate('/dashboard');
      }
    } catch (e) {
      setMsg("Server error");
    } finally {
      setCreating(false);
    }
  };

  const openWorkspace = (ws: any) => {
    try { localStorage.setItem('currentWorkspace', JSON.stringify({ id: ws._id, name: ws.name, image: ws.image, members: ws.members || [] })); } catch (e) {}
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
      const res = await fetch(`${API_URL}/api/workspaces/${wsId}`, {
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
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center backdrop-blur-sm" onClick={() => setFullscreenImage(null)}>
          <button onClick={() => setFullscreenImage(null)} className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all hover:rotate-90 duration-300 text-white z-[101]">
            <X size={24} />
          </button>
          <img src={imgUrl(fullscreenImage)} alt="Workspace" className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      
      {showWelcome && (
        <div className="fixed top-24 right-8 z-50 animate-slideIn">
          <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Hey {user?.name}! 👋</h3>
                <p className="text-sm text-white/90">Let's build something amazing today</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#1a1d21] to-[#0f1115] text-white p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500 blur-xl opacity-50 rounded-full"></div>
                <div className="relative p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-lg">
                  <Briefcase className="w-8 h-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                  Workspaces
                </h1>
                <p className="text-gray-400 mt-1">Organize your team and projects in one place</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Building2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{workspaces.length}</p>
                    <p className="text-sm text-gray-400">Active Workspaces</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{workspaces.reduce((acc, ws) => acc + (ws.members?.length || 0), 0)}</p>
                    <p className="text-sm text-gray-400">Team Members</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border border-pink-500/20 rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-500/20 rounded-lg">
                    <Shield className="w-5 h-5 text-pink-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{isAdmin ? 'Admin' : 'Member'}</p>
                    <p className="text-sm text-gray-400">Your Role</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-[#1a1d21]/90 to-[#141619]/90 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-6 shadow-2xl h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Plus className="w-5 h-5 text-purple-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">New Workspace</h2>
                </div>
                
                <p className="text-sm text-gray-400 mb-6">Create a dedicated space for your team to collaborate and communicate.</p>

                {isAdmin ? (
                  !showInput ? (
                    <Button 
                      onClick={() => setShowInput(true)} 
                      className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium py-6 rounded-xl shadow-lg shadow-purple-900/50 transition-all hover:scale-[1.02]"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create Workspace
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-300 mb-2 block">Workspace Name</label>
                        <Input 
                          value={name} 
                          onChange={(e) => setName((e.target as HTMLInputElement).value)} 
                          placeholder="e.g., Marketing Team" 
                          className="bg-[#0a0b0d] border-purple-500/30 focus:border-purple-500 text-white placeholder:text-gray-500 h-12 rounded-xl"
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-300 mb-2 block">Workspace Icon</label>
                        <div className="flex items-center gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => setImage(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 bg-[#0a0b0d] border-purple-500/30 hover:border-purple-500 hover:bg-purple-500/10 text-gray-300 h-12 rounded-xl"
                          >
                            <ImageIcon className="w-4 h-4 mr-2" />
                            {image ? image.name.substring(0, 20) : 'Choose Image'}
                          </Button>
                          {image && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setImage(null)}
                              className="hover:bg-red-500/10 hover:text-red-400 h-12 px-4 rounded-xl"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button 
                          onClick={handleCreate} 
                          disabled={creating} 
                          className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium h-12 rounded-xl shadow-lg"
                        >
                          {creating ? 'Creating...' : 'Create'}
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={() => { setShowInput(false); setName(''); setImage(null); }} 
                          className="hover:bg-red-500/10 hover:text-red-400 h-12 px-4 rounded-xl"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-300 mb-1">Admin Access Required</p>
                        <p className="text-xs text-yellow-400/80">Contact your administrator to create new workspaces or get invited to existing ones.</p>
                      </div>
                    </div>
                  </div>
                )}

                {msg && (
                  <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <p className="text-sm text-red-400">{msg}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-[#1a1d21]/90 to-[#141619]/90 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Building2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Your Workspaces</h2>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>Recently accessed</span>
                  </div>
                </div>
                
                {workspaces.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="relative inline-block mb-6">
                      <div className="absolute inset-0 bg-purple-500 blur-2xl opacity-20 rounded-full"></div>
                      <div className="relative p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl border border-purple-500/30">
                        <Users className="w-16 h-16 text-purple-400" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">No workspaces yet</h3>
                    <p className="text-gray-400 max-w-md mx-auto">Create your first workspace to start collaborating with your team, or wait for an admin to invite you.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9333ea #1a1d21' }}>
                    {workspaces.map((ws) => (
                      <div
                        key={ws._id}
                        onMouseEnter={() => setHoveredWorkspace(ws._id)}
                        onMouseLeave={() => setHoveredWorkspace(null)}
                        onClick={() => openWorkspace(ws)}
                        className="group relative bg-gradient-to-br from-[#0a0b0d]/80 to-[#0f1115]/80 hover:from-purple-500/10 hover:to-purple-600/5 border border-purple-500/20 hover:border-purple-500/40 rounded-xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-900/20"
                      >
                        <div className="flex items-center gap-4">
                          {ws.image ? (
                            <div className="relative">
                              <div className="absolute inset-0 bg-purple-500 blur-lg opacity-30 rounded-xl"></div>
                              <img 
                                src={imgUrl(ws.image)} 
                                alt={ws.name} 
                                className="relative w-14 h-14 rounded-xl object-cover border-2 border-purple-500/30 group-hover:border-purple-500/60 transition-all shadow-lg"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFullscreenImage(imgUrl(ws.image));
                                }}
                              />
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="absolute inset-0 bg-purple-500 blur-lg opacity-30 rounded-xl"></div>
                              <div className="relative p-3 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl border border-purple-500/30 group-hover:border-purple-500/60 transition-all">
                                <Building2 className="w-8 h-8 text-purple-400" />
                              </div>
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors truncate">
                              {ws.name}
                            </h3>
                            <div className="flex items-center gap-4 mt-1">
                              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                                <Users className="w-4 h-4" />
                                <span>{ws.members?.length || 0} members</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                                <Clock className="w-4 h-4" />
                                <span>Active</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {isAdmin && hoveredWorkspace === ws._id && (
                              <button
                                onClick={(e) => deleteWorkspace(ws._id, e)}
                                disabled={deletingWorkspace === ws._id}
                                className="p-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all border border-red-500/30 hover:border-red-500/50 hover:scale-110"
                                title="Delete workspace"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            )}
                            <div className="p-2.5 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-all">
                              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Workspace;
