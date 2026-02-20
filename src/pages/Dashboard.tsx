import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import AppLayout from "@/components/layout/AppLayout";
import { ChevronRight, ChevronDown, Hash, Send, Plus } from "lucide-react";
import { emitNotification, onAction } from "@/lib/notificationBus";
import { useToast } from "@/components/ui/toast";
import { hideUrls } from '@/lib/utils'
import UserAvatar from "@/components/common/UserAvatar";
import ProfileSession from "@/components/layout/ProfileSession";

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
  createdAt?: string;
  group?: string;
  file?: {
    url: string;
    filename?: string;
    mimetype?: string;
    size?: number;
  };
}

interface IChannel {
  _id: string;
  name: string;
  members?: IUser[];
}

const SOCKET_URL = "http://localhost:9000";

const Dashboard = () => {
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [user, setUser] = useState<IUser | null>(null);
  const [dmUsers, setDmUsers] = useState<IUser[]>([]);
  const [channels, setChannels] = useState<IChannel[]>([]);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showChannels, setShowChannels] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<any>(null);

  // context / edit state for messages
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string | null } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { show } = useToast();

  const [activeChat, setActiveChat] = useState<{
    type: "dm" | "group";
    id: string;
    name: string;
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

  const myId = useMemo(() => user?._id || user?.id || "", [user]);

  /* ================= INIT ================= */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    const rawWorkspace = localStorage.getItem("currentWorkspace");

    if (!storedUser || !token) {
      navigate("/login");
      return;
    }

    const parsed = JSON.parse(storedUser);
    setUser(parsed);

    const currentWs = rawWorkspace ? JSON.parse(rawWorkspace) : null;
    if (!currentWs?.id) return;

    fetch(`${SOCKET_URL}/api/workspaces/${currentWs.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) return;

        const workspace = d.workspace;
        const myUserId = parsed._id || parsed.id;

        setDmUsers(
          workspace.members.filter(
            (u: IUser) => (u._id || u.id) !== myUserId
          )
        );

        setChannels(workspace.channels || []);
      });
  }, [navigate]);

  /* ================= SOCKET ================= */
  useEffect(() => {
    if (!myId) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("online users", (users: string[]) => {
      setOnlineUsers(users);
    });

    socket.on("online-list", (data: { online: string[]; lastSeen: Record<string, number> }) => {
      setOnlineUsers(data.online || []);
    });

    socket.on("user-online", (userId: string) => {
      setOnlineUsers((prev) => [...new Set([...prev, userId])]);
    });

    socket.on("user-offline", (data: { id: string; lastSeen: number }) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== data.id));
    });

    socket.on("private message", (msg: IMessage & { workspace?: string | null }) => {
      const rawWs = localStorage.getItem('currentWorkspace');
      const currentWs = rawWs ? JSON.parse(rawWs) : null;
      // ignore DMs from other workspaces
      if (msg.workspace && currentWs?.id && String(msg.workspace) !== String(currentWs.id)) return;

      if (activeChat?.type === "dm" && String(msg.from) === String(activeChat.id)) {
        setMessages((prev) => [...prev, msg]);
      } else if (msg.from !== myId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.from]: (prev[msg.from] || 0) + 1,
        }));
        try {
          emitNotification({
            type: "private",
            from: msg.from,
            title: msg.fromName ? `DM from ${msg.fromName}` : "New DM",
            message: msg.content,
            file: msg.file
          });
        } catch (e) {}
      }
    });

    socket.on("group message", (msg: IMessage) => {
      if (activeChat?.type === "group" && msg.group === activeChat.id) {
        setMessages((prev) => [...prev, msg]);
      } else if (msg.group && msg.from !== myId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.group]: (prev[msg.group] || 0) + 1,
        }));
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

    // realtime edit/delete events
    socket.on('message edited', (payload: any) => {
      setMessages(prev => prev.map(m => (String(m.id) === String(payload.id) ? { ...m, content: payload.content, edited: !!payload.edited } : m)));
    });
    socket.on('message deleted', (payload: any) => {
      setMessages(prev => prev.filter(m => String(m.id) !== String(payload.id)));
    });

    return () => { socket.disconnect(); };
  }, [myId, activeChat]);

  /* ================= LOAD MESSAGES ================= */
  useEffect(() => {
    if (!activeChat) return;

    const token = localStorage.getItem("token");

    const url =
      activeChat.type === "dm"
        ? ((): string => {
            const rawWs = localStorage.getItem('currentWorkspace');
            const currentWs = rawWs ? JSON.parse(rawWs) : null;
            const wsParam = currentWs?.id ? `?workspaceId=${currentWs.id}` : '';
            return `${SOCKET_URL}/api/message/${activeChat.id}${wsParam}`;
          })()
        : `${SOCKET_URL}/api/group/${activeChat.id}/messages`;

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) =>
        setMessages(Array.isArray(d?.messages) ? d.messages : [])
      );

    setUnreadCounts((prev) => ({
      ...prev,
      [activeChat.id]: 0,
    }));
  }, [activeChat]);

  // respond to `open-chat` actions (emitted by Sidebar when user clicks an Activity item)
  useEffect(() => {
    const off = onAction((payload) => {
      if (payload?.action === 'open-chat' && payload?.data) {
        const chat = payload.data;
        if (!chat?.type || !chat?.id) return;
        setActiveChat({ type: chat.type, id: chat.id, name: chat.name || '' });
        try { localStorage.setItem('activeChat', JSON.stringify({ type: chat.type, id: chat.id, name: chat.name || '' })); } catch (e) {}
        setUnreadCounts((prev) => ({ ...prev, [chat.id]: 0 }));
      }
    });
    return off;
  }, []);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ================= SEND TEXT ================= */
  const sendMessage = () => {
    if (!socketRef.current || !activeChat || !text.trim()) return;

    if (activeChat.type === "dm") {
      const rawWs = localStorage.getItem('currentWorkspace');
      const currentWs = rawWs ? JSON.parse(rawWs) : null;
      socketRef.current.emit("private message", {
        to: activeChat.id,
        content: text.trim(),
        workspaceId: currentWs?.id || null
      });
    } else {
      socketRef.current.emit("group message", {
        group: activeChat.id,
        content: text.trim(),
      });
    }

    setMessages((prev) => [
      ...prev,
      {
        from: myId,
        fromName: user?.name,
        content: text.trim(),
        createdAt: new Date().toISOString(),
      },
    ]);

    setText("");
  };

  /* ================= FILE UPLOAD ================= */
  const uploadFile = async (f: File) => {
    if (!activeChat) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    if (f.size > 100 * 1024 * 1024) {
      show("Max file size 100MB", "error");
      return;
    }

    const fd = new FormData();
    fd.append("file", f);

    if (activeChat.type === "dm") {
      fd.append("to", activeChat.id);
      const rawWs = localStorage.getItem('currentWorkspace');
      const currentWs = rawWs ? JSON.parse(rawWs) : null;
      if (currentWs?.id) fd.append('workspaceId', currentWs.id);
    } else {
      fd.append("group", activeChat.id);
    }

    try {
      const res = await fetch(`${SOCKET_URL}/api/message/upload`, {
        method: "POST",
        body: fd,
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      const msg = data?.message;

      if (msg) {
        setMessages((prev) => [...prev, msg]);
        setFile(null);
      }
    } catch (e) {
      console.error(e);
      show("Upload error", "error");
    }
  };

  return (
    <AppLayout>
      <div className="flex h-screen bg-[#1a1d21] text-white">

        {/* SIDEBAR */}
        <aside className="w-[280px] bg-[#1A1D21] border-r border-white/10 p-3">

          <div
            onClick={() => setShowChannels(!showChannels)}
            className="flex items-center gap-2 cursor-pointer"
          >
            {showChannels ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span># Channels</span>
          </div>

          {showChannels &&
            channels.map((c) => (
              <div
                key={c._id}
                onClick={() => {
                  const ac = { type: "group", id: c._id, name: c.name }
                  setActiveChat(ac)
                  try { localStorage.setItem('activeChat', JSON.stringify(ac)) } catch (e) {}
                }}
                className="flex items-center gap-2 px-4 py-1 hover:bg-white/10 cursor-pointer"
              >
                <Hash size={14} />
                {c.name}
              </div>
            ))}

          <hr className="my-3 border-white/10" />

          <div className="text-xs text-gray-400 mb-2">
            Direct Messages
          </div>

          {dmUsers.map((u) => {
            const isOnline = onlineUsers.includes(u._id || u.id || '');
            return (
              <div
                key={u._id}
                onClick={() => {
                  const ac = { type: "dm", id: u._id!, name: u.name! }
                  setActiveChat(ac)
                  try { localStorage.setItem('activeChat', JSON.stringify(ac)) } catch (e) {}
                }}
                className="flex items-center gap-2 px-3 py-1 hover:bg-white/5 cursor-pointer"
              >
                <div className="relative" onClick={async (e) => { 
                  e.stopPropagation(); 
                  const token = localStorage.getItem('token');
                  const res = await fetch(`${SOCKET_URL}/api/user/${u._id || u.id}`, { headers: { Authorization: `Bearer ${token}` } });
                  const data = await res.json();
                  setViewingUser(data.user || u); 
                  setProfileOpen(true); 
                }}>
                  <UserAvatar user={u} size="sm" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1A1D21] ${
                      isOnline ? "bg-green-500" : "bg-gray-500"
                    }`}
                  />
                </div>
                {u.name}
              </div>
            );
          })}
        </aside>

        {/* MAIN */}
        <main className="flex-1 flex flex-col relative bg-[#0f1115]">
          {!activeChat ? (
            <div className="flex items-center justify-center h-full">
              <h1 className="text-2xl">Welcome Back {user?.name}</h1>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-white/10 font-semibold">
                {activeChat.name}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 mb-20" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {messages.map((m, idx) => {
                  const isImage = m.file && ((m.file.mimetype && m.file.mimetype.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg)$/i.test((m.file.filename || m.file.url || '')));
                  const isMine = m.from === myId;
                  return (
                  <div
                    key={m.id || `msg-${idx}`}
                    onContextMenu={(e) => { e.preventDefault(); if (!m.id) return; const role = ((user?.role || user?.Role || '') as string).toLowerCase(); if (String(m.from) !== String(myId) && role !== 'admin') return; setContextMenu({ x: e.clientX, y: e.clientY, id: m.id }); }}
                    className={`relative ${
                      isMine ? "ml-auto" : ""
                    } ${
                      isImage ? '' : 'p-3'
                    } ${
                      !isImage && isMine ? 'bg-[#1164A3]' : ''
                    } ${
                      !isImage && !isMine ? 'bg-[#2b2f36]' : ''
                    }`}
                    style={{ borderRadius: '1.25rem', maxWidth: '19rem' }}
                  >

                    {editingId === m.id ? (
                      <div className="flex gap-2">
                        <input autoFocus value={editingText} onChange={(e) => setEditingText(e.target.value)} onKeyDown={async (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); const token = localStorage.getItem('token'); if (!token) return; const endpoint = activeChat?.type === 'group' ? `${SOCKET_URL}/api/group/message/${m.id}` : `${SOCKET_URL}/api/message/${m.id}`; try { const res = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: editingText }) }); if (!res.ok) { const err = await res.json().catch(()=>({})); show(err?.msg || 'Update failed', 'error'); return; } const d = await res.json(); const updated = d?.message; setMessages(prev => prev.map(x => x.id === updated.id ? { ...x, content: updated.content, edited: updated.edited } : x)); setEditingId(null); setEditingText(''); show('Message updated', 'success'); } catch (e) { console.error(e); show('Update failed', 'error'); } } else if (ev.key === 'Escape') { setEditingId(null); setEditingText(''); } }} className="flex-1 bg-white/5 px-2 py-1 rounded text-sm outline-none" />
                        <button onClick={async () => {
                          const token = localStorage.getItem('token'); if (!token) return;
                          const endpoint = activeChat?.type === 'group' ? `${SOCKET_URL}/api/group/message/${m.id}` : `${SOCKET_URL}/api/message/${m.id}`;
                          try {
                            const res = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: editingText }) });
                            if (!res.ok) { const err = await res.json().catch(()=>({})); show(err?.msg || 'Update failed', 'error'); return; }
                            const d = await res.json(); const updated = d?.message;
                            setMessages(prev => prev.map(x => x.id === updated.id ? { ...x, content: updated.content, edited: updated.edited } : x));
                            setEditingId(null); setEditingText('');
                            show('Message updated', 'success');
                          } catch (e) { console.error(e); show('Update failed', 'error'); }
                        }} className="px-2 bg-green-600 text-white rounded">Save</button>
                        <button onClick={() => { setEditingId(null); setEditingText(''); }} className="px-2 bg-white/10 text-white rounded">Cancel</button>
                      </div>
                    ) : (
                      <>
                        {/* attachments */}
                        {m.file && ((m.file.mimetype && m.file.mimetype.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg)$/i.test((m.file.filename || m.file.url || ''))) ? (
                          <img src={m.file.url} alt="image" className="w-[320px] h-[270px] object-cover cursor-pointer" style={{ borderRadius: '1.5rem' }} onClick={() => window.open(m.file.url, '_blank')} />
                        ) : m.file && /\.(pdf|rar|zip)$/i.test(m.file?.filename || '') ? (
                          <div className="w-[280px] rounded-xl overflow-hidden border border-white/10">
                            <div className="h-32 bg-[#2b2f36] flex items-center justify-center overflow-hidden">
                              {m.file?.thumbnail ? (
                                <img src={m.file.thumbnail} alt="preview" className="w-full h-full object-cover" />
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                              )}
                            </div>
                            <div className="p-4 bg-[#2b2f36]">
                              <div className="text-sm font-medium text-white truncate mb-1">{m.file.filename || 'File'}</div>
                              <div className="text-xs text-gray-400 mb-3">{m.file?.filename?.split('.').pop()?.toUpperCase()} File</div>
                              <a href={m.file.url} download={m.file.filename || 'file'} className="flex items-center justify-center gap-2 w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Download
                              </a>
                            </div>
                          </div>
                        ) : (
                          hideUrls(m.content) && <div>{hideUrls(m.content)} {m.edited && <span className="text-[10px] text-gray-300">(edited)</span>}</div>
                        )}
                      </>
                    )}
                  </div>
                  );
                })}
                <div ref={bottomRef} />

                {contextMenu && (
                  <div ref={menuRef} style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 60 }}>
                    <div className="flex flex-col bg-[#0f1115] border border-white/10 rounded shadow-lg">
                      {confirmDeleteId === contextMenu.id ? (
                        <div className="p-3 text-sm text-white">
                          Are you sure?
                          <div className="flex gap-2 mt-3">
                            <button className="px-3 py-1 bg-red-600 rounded text-white text-sm" onClick={async () => {
                              const id = contextMenu.id; setContextMenu(null); setConfirmDeleteId(null); if (!id) return; const token = localStorage.getItem('token'); if (!token) return;
                              const endpoint = activeChat?.type === 'group' ? `${SOCKET_URL}/api/group/message/${id}` : `${SOCKET_URL}/api/message/${id}`;
                              try {
                                const res = await fetch(endpoint, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                                if (!res.ok) { const err = await res.json().catch(()=>({})); show(err?.msg || 'Delete failed', 'error'); return; }
                                setMessages(prev => prev.filter(x => x.id !== id));
                                show('Message deleted', 'success');
                              } catch (e) { console.error(e); show('Delete failed', 'error'); }
                            }}>Yes</button>
                            <button className="px-3 py-1 bg-white/10 rounded text-white text-sm" onClick={() => { setConfirmDeleteId(null); setContextMenu(null); }}>No</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button className="px-3 py-2 bg-green-600 text-white text-sm" onClick={() => {
                            const id = contextMenu.id; const found = messages.find(x => x.id === id); if (!found) return setContextMenu(null);
                            setEditingId(id); setEditingText(found.content || ''); setContextMenu(null);
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

              <div className="absolute bottom-0 w-full p-4 border-t border-white/10 bg-[#0f1115]">
                <div className="flex items-center gap-3">

                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && sendMessage()
                    }
                    className="flex-1 bg-[#2b2f36] rounded-lg px-5 py-3 outline-none"
                    placeholder="Type a message..."
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setFile(f);
                      if (f) uploadFile(f);
                    }}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-lg bg-white/5"
                  >
                    <Plus size={18} />
                  </button>

                  <button
                    onClick={sendMessage}
                    disabled={!text.trim()}
                    className="p-3 rounded-lg bg-[#1164A3]"
                  >
                    <Send size={18} />
                  </button>

                </div>
              </div>
            </>
          )}
        </main>
      </div>
      <ProfileSession isOpen={profileOpen} onClose={() => { setProfileOpen(false); setViewingUser(null); }} user={viewingUser} isOwnProfile={false} />
    </AppLayout>
  );
};

export default Dashboard;
