import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Workspace = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [workspaces, setWorkspaces] = useState<any[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {}
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    (async () => {
      try {
        const res = await fetch("http://localhost:9000/api/workspaces", {
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
      const res = await fetch("http://localhost:9000/api/workspaces", {
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

  return (
    <AppLayout>
      <div className="min-h-full flex items-center justify-center bg-[#1A1D21] text-[#D1D2D3] p-8">
        <div className="w-full max-w-4xl">
          <div className="bg-[#111214] border border-gray-800 rounded-lg p-8 shadow-md">
            <h1 className="text-2xl font-semibold mb-4">Welcome to SolveVare</h1>
            <p className="text-sm text-gray-400 mb-6">Create or join a workspace to start collaborating — Slack-style experience will continue inside the Dashboard.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 bg-[#141619] rounded border border-gray-800 flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-medium">Add Work Space</h2>
                  <p className="text-sm text-gray-400 mt-2">Create a new workspace. Only admins can create workspaces.</p>
                </div>

                <div className="mt-4">
                  {isAdmin ? (
                    <div className="flex gap-2 items-center">
                      {!showInput ? (
                        <Button onClick={() => setShowInput(true)}>Add Work Space</Button>
                      ) : (
                        <div className="flex gap-2 w-full items-center">
                          <Input value={name} onChange={(e) => setName((e.target as HTMLInputElement).value)} placeholder="Workspace name" />
                          <Button onClick={handleCreate} disabled={creating}>{creating ? 'Saving...' : 'Create'}</Button>
                          <Button variant="ghost" onClick={() => { setShowInput(false); setName(''); }}>{/* cancel */}Cancel</Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">You don't have permission to create a workspace. Ask your admin to invite you to a workspace.</div>
                  )}

                  {msg && <div className="mt-3 text-sm text-red-500">{msg}</div>}
                </div>
              </div>

              <div className="p-6 bg-[#141619] rounded border border-gray-800">
                <h2 className="text-lg font-medium">Your Workspaces</h2>
                <div className="mt-3">
                  {workspaces.length === 0 ? (
                    <div className="text-sm text-gray-400">No workspaces yet. Create one or ask your admin to invite you.</div>
                  ) : (
                    <ul className="space-y-2">
                      {workspaces.map((ws) => (
                        <li key={ws._id}>
                          <button onClick={() => openWorkspace(ws)} className="w-full text-left px-3 py-2 rounded hover:bg-gray-800 flex items-center justify-between">
                            <span className="font-large">{ws.name}</span>
                            {/* <span className="text-xs text-gray-400">{new Date(ws.createdAt).toLocaleDateString()}</span> */}
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
