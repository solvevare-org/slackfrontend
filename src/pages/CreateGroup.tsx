import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Hash, Users, Image as ImageIcon, ArrowLeft, Check, X } from "lucide-react";

interface IUser {
  _id: string;
  name?: string;
}

const CreateGroup = () => {
  const navigate = useNavigate();
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [visibleUsers, setVisibleUsers] = useState<IUser[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<any>(null);

  const API_URL = "http://localhost:9000";

  /* ================= FETCH WORKSPACE MEMBERS ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const raw = localStorage.getItem("currentWorkspace");

    if (!token) {
      navigate("/login");
      return;
    }

    if (!raw) {
      setVisibleUsers([]);
      return;
    }

    const cw = JSON.parse(raw);
    setCurrentWorkspace(cw);

    if (!cw?.id) {
      setVisibleUsers([]);
      return;
    }

    fetch(`${API_URL}/api/workspaces/${cw.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && Array.isArray(d.workspace?.members)) {
          setVisibleUsers(
            d.workspace.members.map((m: any) => ({
              _id: m._id,
              name: m.name,
            }))
          );
        } else {
          setVisibleUsers([]);
        }
      })
      .catch(() => setVisibleUsers([]));
  }, [navigate]);

  /* ================= CLOSE PICKER ================= */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!pickerRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!pickerRef.current.contains(e.target)) {
        setShowUserPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ================= TOGGLE MEMBER ================= */
  const toggleMember = (id: string) => {
    setMembers((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  /* ================= CREATE GROUP ================= */
  const handleCreate = async () => {
    if (!name.trim()) {
      setMessage("Channel name is required");
      return;
    }

    if (!currentWorkspace?.id) {
      alert("Please Select Workspace First");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    setCreating(true);
    setMessage("");

    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("members", JSON.stringify(members));
      fd.append("admins", JSON.stringify(admins));
      fd.append("workspaceId", currentWorkspace.id);
      if (image) fd.append("image", image);

      const res = await fetch(`${API_URL}/api/group`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.msg || "Create failed");
      } else {
        navigate("/dashboard");
      }
    } catch {
      setMessage("Server error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#0f1115] p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => navigate("/dashboard")} className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-white">Create Channel</h1>
          </div>

          <div className="bg-[#1A1D21] border border-white/10 rounded-xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-600/20 rounded-lg">
                <Hash className="text-purple-400" size={24} />
              </div>
              <h2 className="text-xl font-semibold text-white">Channel Details</h2>
            </div>

            <div className="space-y-6">
              {/* CHANNEL NAME */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block flex items-center gap-2">
                  <Hash size={16} />
                  Channel Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 bg-[#0f1115] border border-white/10 rounded-lg text-white focus:border-purple-600 focus:outline-none transition"
                  placeholder="general"
                />
              </div>

              {/* MEMBERS */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block flex items-center gap-2">
                  <Users size={16} />
                  Members
                </label>

                <div className="relative">
                  <div className="flex items-center justify-between p-3 bg-[#0f1115] border border-white/10 rounded-lg">
                    <div className="text-sm text-gray-400">
                      {members.length
                        ? `${members.length} member${members.length > 1 ? 's' : ''} selected`
                        : "No members selected"}
                    </div>

                    <button
                      onClick={() => setShowUserPicker((s) => !s)}
                      className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
                    >
                      Add Members
                    </button>
                  </div>

                  {showUserPicker && (
                    <div
                      ref={pickerRef}
                      className="absolute left-0 right-0 mt-2 bg-[#1A1D21] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto p-4 z-50"
                    >
                      {!currentWorkspace?.id ? (
                        <div className="text-sm text-gray-500">
                          Please select workspace first.
                        </div>
                      ) : visibleUsers.length === 0 ? (
                        <div className="text-sm text-gray-500">
                          No members found in this workspace.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {visibleUsers.map((u) => (
                            <label
                              key={u._id}
                              className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition"
                            >
                              <input
                                type="checkbox"
                                checked={members.includes(u._id)}
                                onChange={() => toggleMember(u._id)}
                                className="w-4 h-4 accent-purple-600"
                              />
                              <span className="text-white">{u.name}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-end mt-4 pt-3 border-t border-white/10">
                        <button
                          onClick={() => setShowUserPicker(false)}
                          className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition text-sm"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* IMAGE */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block flex items-center gap-2">
                  <ImageIcon size={16} />
                  Channel Image (optional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 p-3 bg-[#0f1115] border border-white/10 rounded-lg text-gray-400 hover:border-purple-600 transition cursor-pointer">
                    <input
                      type="file"
                      onChange={(e) => setImage(e.target.files ? e.target.files[0] : null)}
                      className="hidden"
                      accept="image/*"
                    />
                    <span className="text-sm">{image ? image.name : "Choose an image..."}</span>
                  </label>
                  {image && (
                    <button onClick={() => setImage(null)} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition">
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>

              {message && (
                <div className="p-4 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                  {message}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition font-medium shadow-lg disabled:opacity-50"
                >
                  <Check size={18} />
                  {creating ? "Creating..." : "Create Channel"}
                </button>

                <button
                  onClick={() => navigate("/dashboard")}
                  className="px-6 py-3 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateGroup;
