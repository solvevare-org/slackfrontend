import React, { useState, useEffect } from "react";
import { X, Hash, Send, Users, MessageSquare } from "lucide-react";
import { SOCKET_URL } from "@/lib/config";
import UserAvatar from "@/components/common/UserAvatar";
import { useToast } from "@/components/ui/toast";
import { imgUrl } from "@/lib/utils";

interface ForwardTarget {
  type: "dm" | "group";
  id: string;
  name: string;
  image?: string;
}

interface ForwardSessionProps {
  isOpen: boolean;
  onClose: () => void;
  messageContent: string;
  originalSenderName: string;
  file?: { url: string; filename?: string; mimetype?: string; size?: number } | null;
}

const ForwardSession: React.FC<ForwardSessionProps> = ({ isOpen, onClose, messageContent, originalSenderName, file }) => {
  const { show } = useToast();
  const [dmUsers, setDmUsers] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) { setSelected(new Set()); return; }
    const token = localStorage.getItem("token");
    const rawWs = localStorage.getItem("currentWorkspace");
    const currentWs = rawWs ? JSON.parse(rawWs) : null;
    if (!currentWs?.id || !token) return;

    setLoading(true);
    fetch(`${SOCKET_URL}/api/workspaces/${currentWs.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const rawUser = localStorage.getItem("user");
          const me = rawUser ? JSON.parse(rawUser) : null;
          const myId = me?._id || me?.id;
          setDmUsers(d.workspace.members.filter((u: any) => (u._id || u.id) !== myId));
          setChannels(d.workspace.channels || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0) return;
    const token = localStorage.getItem("token");
    const rawWs = localStorage.getItem("currentWorkspace");
    const currentWs = rawWs ? JSON.parse(rawWs) : null;

    const targets: { type: string; id: string }[] = [];
    selected.forEach((id) => {
      const isDm = dmUsers.some((u) => (u._id || u.id) === id);
      targets.push({ type: isDm ? "dm" : "group", id });
    });

    setSending(true);
    try {
      const res = await fetch(`${SOCKET_URL}/api/message/forward`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          content: messageContent,
          originalSenderName,
          file: file || null,
          targets,
          workspaceId: currentWs?.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        show(`Message forwarded to ${data.forwarded} place${data.forwarded !== 1 ? "s" : ""}`, "success");
        onClose();
      } else {
        show(data.msg || "Forward failed", "error");
      }
    } catch {
      show("Forward failed", "error");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[420px] bg-[#1A1D21] shadow-2xl z-50 transform transition-transform duration-300 translate-x-0 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Send size={18} className="text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Forward Message</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Message / File Preview */}
        <div className="mx-5 mt-5 p-4 bg-[#0f1115] rounded-xl border border-purple-500/20 flex-shrink-0">
          <p className="text-xs text-purple-400 font-medium mb-2">Forwarding from <span className="text-white">{originalSenderName}</span></p>
          {file ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
                {file.mimetype?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.filename || '') ? (
                  <img src={imgUrl(file.url)} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{file.filename || 'File'}</p>
                <p className="text-xs text-gray-400">{file.mimetype || 'File'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-300 line-clamp-3" dangerouslySetInnerHTML={{ __html: messageContent.replace(/<[^>]*>/g, " ").trim() }} />
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: "thin", scrollbarColor: "#9333ea #1a1d21" }}>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-600" />
            </div>
          ) : (
            <>
              {/* Channels */}
              {channels.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2 px-1">
                    <span className="w-1 h-4 bg-purple-600 rounded" />
                    <Hash size={13} className="text-purple-400" />
                    Channels
                    <span className="ml-auto text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">{channels.length}</span>
                  </h4>
                  <div className="space-y-1.5">
                    {channels.map((c: any) => {
                      const isSelected = selected.has(c._id);
                      return (
                        <div
                          key={c._id}
                          onClick={() => toggle(c._id)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                            isSelected
                              ? "bg-purple-600/25 border-purple-500/50"
                              : "bg-[#0f1115] hover:bg-white/5 border-transparent hover:border-purple-500/20"
                          }`}
                        >
                          {c.image?.url ? (
                            <img src={imgUrl(c.image.url)} alt={c.name} className="w-9 h-9 rounded-lg object-cover" />
                          ) : (
                            <div className="w-9 h-9 bg-purple-600/30 rounded-lg flex items-center justify-center">
                              <Hash size={16} className="text-purple-400" />
                            </div>
                          )}
                          <span className="flex-1 text-sm font-medium text-white">{c.name}</span>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            isSelected ? "bg-purple-600 border-purple-500" : "border-gray-600"
                          }`}>
                            {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DM Users */}
              {dmUsers.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2 px-1">
                    <span className="w-1 h-4 bg-green-500 rounded" />
                    <MessageSquare size={13} className="text-green-400" />
                    Direct Messages
                    <span className="ml-auto text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">{dmUsers.length}</span>
                  </h4>
                  <div className="space-y-1.5">
                    {dmUsers.map((u: any) => {
                      const uid = u._id || u.id;
                      const isSelected = selected.has(uid);
                      return (
                        <div
                          key={uid}
                          onClick={() => toggle(uid)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                            isSelected
                              ? "bg-purple-600/25 border-purple-500/50"
                              : "bg-[#0f1115] hover:bg-white/5 border-transparent hover:border-purple-500/20"
                          }`}
                        >
                          <UserAvatar user={u} size="sm" />
                          <span className="flex-1 text-sm font-medium text-white">{u.name}</span>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            isSelected ? "bg-purple-600 border-purple-500" : "border-gray-600"
                          }`}>
                            {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {channels.length === 0 && dmUsers.length === 0 && (
                <div className="text-center text-gray-500 py-12">
                  <Users size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No channels or members found</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 p-5 border-t border-white/10 flex-shrink-0 bg-[#1A1D21]">
            <button
              onClick={onClose}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition text-gray-300 hover:text-white"
            >
              <X size={20} />
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-purple-900/40"
            >
              {sending ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Send to {selected.size} {selected.size === 1 ? "place" : "places"}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default ForwardSession;
