import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { emitNotification } from "@/lib/notificationBus";
import { useToast } from "@/components/ui/toast";
import { hideUrls } from '@/lib/utils' 



/* ================= TYPES ================= */
interface IUser {
  _id?: string;
  id?: string;
  name?: string;
  role?: string;
  Role?: string;
}

interface IMessage {
  id?: string;
  from: string;
  fromName?: string;
  content?: string;
  edited?: boolean;
  file?: { url?: string; filename?: string };
  createdAt?: string;
}

interface IWorkspace {
  _id: string;
  name: string;
  type: "group" | "community";
  members?: IUser[];
}

/* ================= DASHBOARD ================= */
const SOCKET_URL = "http://localhost:9000";

const GroupChat = () => {
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [user, setUser] = useState<IUser | null>(null);
  const [dmUsers, setDmUsers] = useState<IUser[]>([]);
  const [groups, setGroups] = useState<IWorkspace[]>([]);
  const [communities, setCommunities] = useState<IWorkspace[]>([]);
    const [activeDM, setActiveDM] = useState<IUser | null>(null);

  const [activeChat, setActiveChat] = useState<{
    type: "dm" | "group" | "community";
    id: string;
    name: string;
    members?: IUser[];
  } | null>(null);

  // restore active chat after reload
  useEffect(() => {
    try {
      const raw = localStorage.getItem('activeChat')
      if (raw) {
        const ac = JSON.parse(raw)
        if (ac && ac.id) setActiveChat(ac)
      }
    } catch (e) {}
  }, [])

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // context / edit state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string | null } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { show } = useToast();

  /* ================= USER INIT ================= */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (!storedUser || !token) {
      navigate("/login");
      return;
    }

    const parsed = JSON.parse(storedUser);
    setUser(parsed);

    // fetch DM users
    fetch("http://localhost:9000/api/user/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data?.result) ? data.result : [];
        setDmUsers(list.filter((u: IUser) => u._id !== parsed._id && u._id !== parsed.id));
      });

    // fetch groups and communities
    const fetchWorkspaces = async () => {
      try {
        const [gRes, cRes] = await Promise.all([
          fetch("http://localhost:9000/api/group/me", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({})),
          fetch("http://localhost:9000/api/community/me", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({})),
        ]);
        const groupsList = Array.isArray(gRes?.groups) ? gRes.groups : Array.isArray(gRes?.result) ? gRes.result : [];
        const communitiesList = Array.isArray(cRes?.communities) ? cRes.communities : Array.isArray(cRes?.result) ? cRes.result : [];

        const role = (parsed.role || parsed.Role || "").toString().toLowerCase();
        const isAdmin = role === "admin";
        const myId = parsed._id || parsed.id;

        const filterByMembership = (list: any[]) => {
          if (isAdmin) return list;
          return list.filter((g: any) => {
            if (!g?.members) return false;
            const memIds = Array.isArray(g.members)
              ? g.members.map((m: any) => (m?._id || m?.id || m).toString())
              : [];
            return memIds.includes(String(myId));
          });
        };

        const visibleGroups = filterByMembership(groupsList);
        const visibleCommunities = filterByMembership(communitiesList);

        setGroups(visibleGroups.map((g: any) => ({ ...g, type: "group" })));
        setCommunities(visibleCommunities.map((c: any) => ({ ...c, type: "community" })));
      } catch (e) {
        console.error(e);
      }
    };

    fetchWorkspaces();
  }, [navigate]);

  const myId = useMemo(() => {
    if (!user) return "";
    return user._id || user.id || "";
  }, [user]);

  const viewerIsAdmin = useMemo(() => {
    if (!user) return false;
    const r = (user.role || user.Role || "").toString().toLowerCase();
    return r === "admin";
  }, [user]);

  const roleLabel = (u: IUser) => {
    const r = (u.role || u.Role || "").toString();
    return r ? ` (${r})` : "";
  };

  /* ================= SOCKET ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !myId) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("private message", (msg: IMessage & { workspace?: string | null }) => {
      const rawWs = localStorage.getItem('currentWorkspace');
      const currentWs = rawWs ? JSON.parse(rawWs) : null;
      if (msg.workspace && currentWs?.id && String(msg.workspace) !== String(currentWs.id)) return;
      if (!activeChat) return;
      if (activeChat.type === "dm" && String(msg.from) === String(activeChat.id)) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    socket.on("group message", (msg: IMessage & { group: string }) => {
      if ((activeChat?.type === "group" || activeChat?.type === "community") && activeChat.id === msg.group) {
        setMessages((prev) => [...prev, msg]);
      } else if (msg.from !== myId) {
        try {
          emitNotification({
            type: "group",
            groupId: msg.group,
            title: msg.fromName ? `${msg.fromName} in group` : "Group message",
            message: msg.content,
            from: msg.from,
            file: msg.file
          });
        } catch (e) {}
      }
    });

    // real-time edit/delete for group messages
    socket.on('message edited', (payload: any) => {
      setMessages(prev => prev.map(m => (String(m.id) === String(payload.id) ? { ...m, content: payload.content, edited: !!payload.edited } : m)));
    });
    socket.on('message deleted', (payload: any) => {
      setMessages(prev => prev.filter(m => String(m.id) !== String(payload.id)));
    });

    return () => { socket.disconnect(); };
  }, [myId, activeChat]);

  // close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!menuRef.current.contains(e.target)) {
        setContextMenu(null);
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [contextMenu]);

  /* ================= LOAD MESSAGES ================= */
  useEffect(() => {
    if (!activeChat) return;

    const token = localStorage.getItem("token");

    const url =
      activeChat.type === "dm"
        ? `http://localhost:9000/api/message/${activeChat.id}`
        : `http://localhost:9000/api/${activeChat.type}/${activeChat.id}/messages`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.messages)) setMessages(d.messages);
        else setMessages([]);
      });
  }, [activeChat]);

  /* ================= AUTO SCROLL ================= */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ================= SEND MESSAGE ================= */
  const sendMessage = async () => {
    if (!socketRef.current || !activeChat || !text.trim()) return;

    const token = localStorage.getItem("token");

    if (file && token && (activeChat.type === "group" || activeChat.type === "community")) {
      if (file.size > 100 * 1024 * 1024) { show("Max file size 100MB", "error"); return; }
      const fd = new FormData();
      fd.append("file", file);
      fd.append(activeChat.type, activeChat.id);

      try {
        const res = await fetch(`http://localhost:9000/api/${activeChat.type}/${activeChat.id}/upload`, {
          method: "POST",
          body: fd,
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(()=>({}));
        const msg = data?.message;
        if (msg) {
          setMessages(prev => [...prev, msg]);
        }
      } catch (e) {
        console.error('group upload error', e);
        show('Upload failed', 'error');
      }
      setFile(null);
    }

    if (text.trim()) {
      if (activeChat.type === "dm") {
        const rawWs = localStorage.getItem('currentWorkspace');
        const currentWs = rawWs ? JSON.parse(rawWs) : null;
        socketRef.current.emit("private message", { to: activeChat.id, content: text.trim(), workspaceId: currentWs?.id || null });
      } else {
        socketRef.current.emit("group message", { group: activeChat.id, content: text.trim() });
      }
      setText("");
    }
  };

  /* ================= UI ================= */
  return (
    <AppLayout>
      <div className="flex h-screen bg-[#1a1d21] text-white">
        {/* SIDEBAR */}
        <aside className="w-64 bg-gradient-to-b from-[#3f0f40] to-[#2b0a2c] p-4 overflow-y-auto">
          <h2 className="font-bold text-lg mb-4">Dashboard</h2>

          <div className="mb-6">
            <h3 className="text-xs uppercase opacity-60 mb-2">Direct Messages</h3>
            {dmUsers.map((u) => (
              <button
                key={u._id}
                onClick={() => {
                  const ac = { type: "dm", id: u._id!, name: u.name! }
                  setActiveChat(ac)
                  try { localStorage.setItem('activeChat', JSON.stringify(ac)) } catch (e) {}
                }}
                className={`w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm ${activeChat?.id === u._id ? "bg-white/10" : ""}`}
              >
                {u.name}{viewerIsAdmin ? roleLabel(u) : ''}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <h3 className="text-xs uppercase opacity-60 mb-2">Joined Groups</h3>
            {groups.map((g) => (
              <button
                key={g._id}
                onClick={() => {
                  const ac = { type: "group", id: g._id, name: g.name, members: g.members }
                  setActiveChat(ac)
                  try { localStorage.setItem('currentWorkspace', JSON.stringify({ id: g._id, name: g.name, type: 'group', members: g.members || [] })); } catch (e) {}
                  try { localStorage.setItem('activeChat', JSON.stringify(ac)) } catch (e) {}
                }}
                className={`w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm ${activeChat?.id === g._id ? "bg-white/10" : ""}`}
              >
                {g.name}
              </button>
            ))}
          </div>

          <div>
            <h3 className="text-xs uppercase opacity-60 mb-2">Joined Communities</h3>
            {communities.map((c) => (
              <button
                key={c._id}
                onClick={() => {
                  const ac = { type: "community", id: c._id, name: c.name, members: c.members }
                  setActiveChat(ac)
                  try { localStorage.setItem('activeChat', JSON.stringify(ac)) } catch (e) {}
                }}
                className={`w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm ${activeChat?.id === c._id ? "bg-white/10" : ""}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </aside>

        {/* MAIN CHAT */}
        <main className="flex-1 flex flex-col bg-[#0f172a]">
          {!activeChat ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h1 className="text-2xl font-semibold mb-4">Welcome Back {user?.name}</h1>
              <p className="text-gray-400">Select a chat to start messaging.</p>
            </div>
          ) : (
            <>
              {/* HEADER */}
              <div className="bg-white text-black p-4 font-semibold border-b">{activeChat.type === 'dm' && viewerIsAdmin ? `${activeChat.name}${roleLabel(dmUsers.find(d => d._id === activeChat.id) || {})}` : activeChat.name}</div>

              {/* MESSAGES */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    onContextMenu={(e) => { e.preventDefault(); if (!m.id) return; const role = ((user?.role || user?.Role || '') as string).toLowerCase(); if (String(m.from) !== String(myId) && role !== 'admin') return; setContextMenu({ x: e.clientX, y: e.clientY, id: m.id }); }}
                    className={`max-w-md p-3 rounded ${m.from === myId ? "bg-purple-200 ml-auto relative" : "bg-gray-200 relative"}`}
                  >
                    {m.fromName && <div className="text-xs text-gray-600">{m.fromName}</div>}

                    {editingId === m.id ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={async (ev) => {
                            if (ev.key === 'Enter') {
                              ev.preventDefault();
                              const token = localStorage.getItem('token'); if (!token) return;
                              try {
                                const res = await fetch(`${SOCKET_URL}/api/group/message/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: editingText }) });
                                if (!res.ok) { const err = await res.json().catch(()=>({})); show(err?.msg || 'Update failed', 'error'); return; }
                                const d = await res.json(); const updated = d?.message;
                                setMessages(prev => prev.map(x => x.id === updated.id ? { ...x, content: updated.content, edited: updated.edited } : x));
                                setEditingId(null); setEditingText('');
                                show('Message updated', 'success');
                              } catch (e) { console.error(e); show('Update failed', 'error'); }
                            } else if (ev.key === 'Escape') {
                              setEditingId(null); setEditingText('');
                            }
                          }}
                          className="flex-1 border rounded px-2 py-1" />
                        <button onClick={async () => {
                          const token = localStorage.getItem('token'); if (!token) return;
                          try {
                            const res = await fetch(`${SOCKET_URL}/api/group/message/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: editingText }) });
                            if (!res.ok) { const err = await res.json().catch(()=>({})); show(err?.msg || 'Update failed', 'error'); return; }
                            const d = await res.json(); const updated = d?.message;
                            setMessages(prev => prev.map(x => x.id === updated.id ? { ...x, content: updated.content, edited: updated.edited } : x));
                            setEditingId(null); setEditingText('');
                            show('Message updated', 'success');
                          } catch (e) { console.error(e); show('Update failed', 'error'); }
                        }} className="px-2 bg-green-600 text-white rounded">Save</button>
                        <button onClick={() => { setEditingId(null); setEditingText(''); }} className="px-2 bg-white/10 text-black rounded">Cancel</button>
                      </div>
                    ) : (
                      <>
                        {/* hide URLs from message text */}
                        {hideUrls(m.content) ? <div>{hideUrls(m.content)} {m.edited && <span className="text-[10px] text-gray-500">(edited)</span>}</div> : null}

                        {/* attachments */}
                        {m.file?.url && (/\.(png|jpe?g|gif|webp|svg)$/i.test((m.file.filename || m.file.url || ''))) ? (
                          <img src={m.file!.url} alt={m.file!.filename || 'image'} className="max-w-[320px] rounded mt-2 block" />
                        ) : m.file?.url ? (
                          <div className="mt-2 inline-flex items-center gap-2 bg-white/5 px-3 py-2 rounded">
                            <div className="text-sm text-black">{m.file!.filename || 'Attachment'}</div>
                            <button onClick={() => window.open(m.file!.url, '_blank')} className="px-2 py-1 bg-white/10 rounded text-sm">Open</button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />

                {contextMenu && (
                  <div ref={menuRef} style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 60 }}>
                    <div className="flex flex-col bg-white border rounded shadow-lg">
                      {confirmDeleteId === contextMenu.id ? (
                        <div className="p-3 text-sm text-black">
                          Are you sure?
                          <div className="flex gap-2 mt-3">
                            <button className="px-3 py-1 bg-red-600 rounded text-white text-sm" onClick={async () => {
                              const id = contextMenu.id; setContextMenu(null); setConfirmDeleteId(null); if (!id) return; const token = localStorage.getItem('token'); if (!token) return;
                              try {
                                const res = await fetch(`${SOCKET_URL}/api/group/message/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                                if (!res.ok) { const err = await res.json().catch(()=>({})); show(err?.msg || 'Delete failed', 'error'); return; }
                                setMessages(prev => prev.filter(x => x.id !== id));
                                show('Message deleted', 'success');
                              } catch (e) { console.error(e); show('Delete failed', 'error'); }
                            }}>Yes</button>
                            <button className="px-3 py-1 bg-white/10 rounded text-black text-sm" onClick={() => { setConfirmDeleteId(null); setContextMenu(null); }}>No</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button className="px-3 py-2 bg-green-600 text-white text-sm" onClick={() => {
                            const id = contextMenu.id; const m = messages.find(x => x.id === id); if (!m) return setContextMenu(null);
                            setEditingId(id); setEditingText(m.content || ''); setContextMenu(null);
                          }}>Edit</button>
                          <button className="px-3 py-2 bg-red-600 text-white text-sm" onClick={() => { setConfirmDeleteId(contextMenu.id); }}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* INPUT */}
              <div className="p-4 border-t bg-white flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  className="flex-1 border rounded px-3 py-2"
                  placeholder="Type a message..."
                />
                {(activeChat.type === "group" || activeChat.type === "community") && (
                  <div className="flex items-center gap-2">
                    <input ref={fileInputRef} className="hidden" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded bg-white/5">
                      <Plus size={18} />
                    </button>
                    {file && <div className="text-sm truncate max-w-xs">{file.name}</div>}
                  </div>
                )}
                <button onClick={sendMessage} className="bg-purple-600 text-white px-4 rounded">
                  Send
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </AppLayout>
  );
};

export default GroupChat;
