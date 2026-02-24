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
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [user, setUser] = useState<IUser | null>(null);
  const [dmUsers, setDmUsers] = useState<IUser[]>([]);
  const [channels, setChannels] = useState<IChannel[]>([]);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);
  const [showChannels, setShowChannels] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [downloadingFiles, setDownloadingFiles] = useState<Record<string, AbortController>>({});
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

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
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
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

    setTimeout(() => inputRef.current?.focus(), 100);
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
  const sendMessage = async () => {
    if (!socketRef.current || !activeChat) return;
    if (!text.trim() && files.length === 0) return;

    if (files.length > 0) {
      const controller = new AbortController();
      setUploadAbortController(controller);
      setUploadingFiles(true);
      
      try {
        for (const f of files) {
          if (controller.signal.aborted) break;
          await uploadFile(f, controller.signal);
        }
        show('Files sent successfully', 'success');
      } catch (err: any) {
        if (err.name === 'AbortError') {
          show('Upload cancelled', 'info');
        } else {
          show('Upload failed', 'error');
        }
      }
      
      setUploadingFiles(false);
      setUploadAbortController(null);
      setFiles([]);
    }

    if (text.trim()) {
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
    }
  };

  const cancelUpload = () => {
    if (uploadAbortController) {
      uploadAbortController.abort();
      setUploadAbortController(null);
      setUploadingFiles(false);
      setFiles([]);
    }
  };

  const toggleMessageSelection = (msgId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(msgId)) {
        newSet.delete(msgId);
      } else {
        newSet.add(msgId);
      }
      return newSet;
    });
  };

  const deleteSelectedMessages = async () => {
    const token = localStorage.getItem('token');
    if (!token || selectedMessages.size === 0) return;

    // Separate own messages and other's messages
    const myMessages = messages.filter(m => m.id && selectedMessages.has(m.id) && m.from === myId);
    const otherMessages = messages.filter(m => m.id && selectedMessages.has(m.id) && m.from !== myId);

    try {
      // Delete own messages from backend
      for (const msg of myMessages) {
        const endpoint = activeChat?.type === 'group' ? `${SOCKET_URL}/api/group/message/${msg.id}` : `${SOCKET_URL}/api/message/${msg.id}`;
        await fetch(endpoint, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      }
      
      // Remove all selected messages from UI (both own and others)
      setMessages(prev => prev.filter(m => !selectedMessages.has(m.id || '')));
      
      const totalDeleted = myMessages.length + otherMessages.length;
      show(`${totalDeleted} message(s) removed from chat`, 'success');
      setSelectedMessages(new Set());
      setSelectionMode(false);
    } catch (e) {
      show('Delete failed', 'error');
    }
  };

  /* ================= FILE UPLOAD ================= */
  const uploadFile = async (f: File, signal?: AbortSignal) => {
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

    const res = await fetch(`${SOCKET_URL}/api/message/upload`, {
      method: "POST",
      body: fd,
      headers: { Authorization: `Bearer ${token}` },
      signal
    });

    const data = await res.json();
    const msg = data?.message;

    if (msg) {
      setMessages((prev) => [...prev, msg]);
      setFile(null);
    }
  };

  const downloadFile = async (url: string, filename: string, fileId: string) => {
    const controller = new AbortController();
    setDownloadingFiles(prev => ({ ...prev, [fileId]: controller }));

    try {
      const res = await fetch(url, { signal: controller.signal });
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      setDownloadingFiles(prev => { const newState = { ...prev }; delete newState[fileId]; return newState; });
      show('File Downloaded', 'success');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        show('Download cancelled', 'info');
      } else {
        show('Download failed', 'error');
      }
      setDownloadingFiles(prev => { const newState = { ...prev }; delete newState[fileId]; return newState; });
    }
  };

  const cancelDownload = (fileId: string) => {
    const controller = downloadingFiles[fileId];
    if (controller) {
      controller.abort();
      setDownloadingFiles(prev => { const newState = { ...prev }; delete newState[fileId]; return newState; });
    }
  };

  return (
    <AppLayout>
      <div className="flex h-screen bg-gradient-to-br from-[#0a0b0d] via-[#1a1d21] to-[#0f1115] text-white">

        {/* SIDEBAR */}
        <aside className="w-[280px] bg-[#1A1D21]/80 backdrop-blur-sm border-r border-purple-500/20 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9333ea #1a1d21' }}>

          <div
            onClick={() => setShowChannels(!showChannels)}
            className="flex items-center gap-2 cursor-pointer mb-3 px-3 py-2 rounded-lg hover:bg-purple-600/10 transition-all group"
          >
            {showChannels ? <ChevronDown size={18} className="text-purple-400 group-hover:text-purple-300" /> : <ChevronRight size={18} className="text-purple-400 group-hover:text-purple-300" />}
            <span className="font-semibold text-gray-200 group-hover:text-white"># Channels</span>
          </div>

          {showChannels && (
            <div className="space-y-1 mb-4">
              {channels.map((c) => (
                <div
                  key={c._id}
                  onClick={() => {
                    const ac = { type: "group", id: c._id, name: c.name }
                    setActiveChat(ac)
                    try { localStorage.setItem('activeChat', JSON.stringify(ac)) } catch (e) {}
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer transition-all ${
                    activeChat?.id === c._id 
                      ? 'bg-purple-600/20 text-white border border-purple-500/30' 
                      : 'hover:bg-white/5 text-gray-300 hover:text-white'
                  }`}
                >
                  <Hash size={16} className="text-purple-400" />
                  <span className="text-sm font-medium">{c.name}</span>
                  {unreadCounts[c._id] > 0 && (
                    <span className="ml-auto bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {unreadCounts[c._id]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <hr className="my-4 border-purple-500/20" />

          <div className="text-xs font-semibold text-gray-400 mb-3 px-3">
            Direct Messages
          </div>

          <div className="space-y-1">
            {dmUsers.map((u) => {
              const isOnline = onlineUsers.includes(u._id || u.id || '');
              const hasUnread = unreadCounts[u._id || u.id || ''] > 0;
              return (
                <div
                  key={u._id}
                  onClick={() => {
                    const ac = { type: "dm", id: u._id!, name: u.name! }
                    setActiveChat(ac)
                    try { localStorage.setItem('activeChat', JSON.stringify(ac)) } catch (e) {}
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                    activeChat?.id === u._id 
                      ? 'bg-purple-600/20 border border-purple-500/30' 
                      : 'hover:bg-white/5'
                  }`}
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
                  <span className="text-sm font-medium text-gray-200">{u.name}</span>
                  {hasUnread && (
                    <span className="ml-auto bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {unreadCounts[u._id || u.id || '']}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </aside>

     {/* MAIN */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0f1115]">
          {!activeChat ? (
            <div className="flex items-center justify-center h-full">
              <h1 className="text-2xl">Welcome Back {user?.name}</h1>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* FIXED HEADER */}
              <div className="flex-shrink-0 p-5 border-b border-purple-500/20 bg-gradient-to-r from-[#1a1d21]/90 to-[#0f1115]/90 backdrop-blur-md shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {activeChat.type === 'group' ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold shadow-lg">
                        <Hash size={20} />
                      </div>
                    ) : (
                      <div 
                        className="cursor-pointer"
                        onClick={async () => {
                          const chatUser = dmUsers.find(u => (u._id || u.id) === activeChat.id);
                          if (!chatUser) return;
                          const token = localStorage.getItem('token');
                          const res = await fetch(`${SOCKET_URL}/api/user/${chatUser._id || chatUser.id}`, { headers: { Authorization: `Bearer ${token}` } });
                          const data = await res.json();
                          setViewingUser(data.user || chatUser);
                          setProfileOpen(true);
                        }}
                      >
                        <UserAvatar user={dmUsers.find(u => (u._id || u.id) === activeChat.id)} size="md" />
                      </div>
                    )}
                    <div>
                      <h2 className="font-bold text-lg text-white">{activeChat.name}</h2>
                      <p className="text-xs text-purple-300">{activeChat.type === 'group' ? '# Channel' : 'Direct Message'}</p>
                    </div>
                  </div>
                  {selectedMessages.size > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-purple-300 font-medium">{selectedMessages.size} selected</span>
                      <button 
                        onClick={() => {
                          const myMessages = messages.filter(m => m.from === myId && m.id);
                          setSelectedMessages(new Set(myMessages.map(m => m.id!)));
                        }} 
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
                      >
                        Select All
                      </button>
                      <button onClick={deleteSelectedMessages} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium">
                        Delete
                      </button>
                      <button onClick={() => { setSelectedMessages(new Set()); setSelectionMode(false); }} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm font-medium">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* SCROLLABLE MESSAGES */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9333ea #1a1d21' }}>
                {messages.map((m, idx) => {
                  const isImage = m.file && ((m.file.mimetype && m.file.mimetype.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg)$/i.test((m.file.filename || m.file.url || '')));
                  const isMine = m.from === myId;
                  const msgUser = isMine ? user : dmUsers.find(u => (u._id || u.id) === m.from);
                  return (
                  <div
                    key={m.id || `msg-${idx}`}
                    className={`group flex ${isMine ? 'justify-end' : 'justify-start'} animate-fadeIn items-start gap-2`}
                    onMouseEnter={() => m.id && setSelectionMode(true)}
                  >
                  {!isMine && msgUser && (
                    <UserAvatar user={msgUser} size="sm" className="mt-1" />
                  )}
                  <div className="flex items-center gap-2">
                  {isMine && (
                    <div className={selectedMessages.has(m.id || '') ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} style={{transition: 'opacity 0.2s'}}>
                      <input
                        type="checkbox"
                        checked={selectedMessages.has(m.id || '')}
                        onChange={() => m.id && toggleMessageSelection(m.id)}
                        className="w-5 h-5 rounded border-2 border-purple-500 bg-transparent checked:bg-purple-600 cursor-pointer"
                      />
                    </div>
                  )}
                  <div
                    onContextMenu={(e) => { 
                      e.preventDefault(); 
                      if (!m.id) return; 
                      const role = ((user?.role || user?.Role || '') as string).toLowerCase(); 
                      if (String(m.from) !== String(myId) && role !== 'admin') return; 
                      setContextMenu({ x: e.clientX, y: e.clientY, id: m.id }); 
                    }}
                    onClick={(e) => {
                      if (selectedMessages.size > 0 && m.id) {
                        toggleMessageSelection(m.id);
                      } else if (m.id && String(m.from) === String(myId)) {
                        const role = ((user?.role || user?.Role || '') as string).toLowerCase();
                        if (String(m.from) === String(myId) || role === 'admin') {
                          setContextMenu({ x: e.clientX, y: e.clientY, id: m.id });
                        }
                      }
                    }}
                    className={`relative transition-all duration-200 hover:scale-[1.02] cursor-pointer ${
                      isImage ? 'rounded-[1.5rem]' : 'p-4 rounded-[1.25rem]'
                    } ${
                      !isImage && isMine ? 'bg-gradient-to-br from-purple-600 to-purple-700 shadow-lg shadow-purple-900/50' : ''
                    } ${
                      !isImage && !isMine ? 'bg-gradient-to-br from-[#2b2f36] to-[#1f2329] shadow-lg' : ''
                    } ${
                      selectedMessages.has(m.id || '') ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-[#0f1115]' : ''
                    }`}
                    style={{ maxWidth: '19rem' }}
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
                        ) : m.file && /\.pdf$/i.test(m.file?.filename || '') ? (
                          <div className="w-[280px] rounded-xl overflow-hidden border border-white/10 relative">
                            {downloadingFiles[m.id || ''] ? (
                              <div className="h-full p-6 flex flex-col items-center justify-center bg-green-900/20">
                                <div className="relative">
                                  <svg className="animate-spin h-16 w-16 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <button onClick={(e) => { e.stopPropagation(); cancelDownload(m.id || ''); }} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                </div>
                                <div className="text-sm text-green-400 mt-4 font-medium">Downloading...</div>
                              </div>
                            ) : (
                              <div className="h-full p-6 flex flex-col items-center justify-center cursor-pointer" onClick={() => window.open(m.file.url, '_blank')}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                <span className="text-red-400 font-bold text-2xl mt-3">PDF</span>
                                <div className="text-sm font-medium text-white truncate w-full text-center mt-4">{m.file.filename || 'File'}</div>
                                <div className="flex gap-2 mt-4">
                                  <button onClick={(e) => { e.stopPropagation(); window.open(m.file.url, '_blank'); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                    Preview
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); downloadFile(m.file.url, m.file.filename || 'file.pdf', m.id || ''); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    Download
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : m.file && /\.(rar|zip)$/i.test(m.file?.filename || '') ? (
                          <div className="w-[280px] rounded-xl overflow-hidden border border-white/10 relative">
                            {downloadingFiles[m.id || ''] ? (
                              <div className="h-full p-6 flex flex-col items-center justify-center bg-green-900/20">
                                <div className="relative">
                                  <svg className="animate-spin h-16 w-16 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <button onClick={(e) => { e.stopPropagation(); cancelDownload(m.id || ''); }} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                </div>
                                <div className="text-sm text-green-400 mt-4 font-medium">Downloading...</div>
                              </div>
                            ) : (
                              <div className="h-full p-6 flex flex-col items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                <span className="text-purple-400 font-bold text-2xl mt-3">{m.file?.filename?.split('.').pop()?.toUpperCase()}</span>
                                <div className="text-sm font-medium text-white truncate w-full text-center mt-4">{m.file.filename || 'File'}</div>
                                <button onClick={(e) => { e.stopPropagation(); downloadFile(m.file.url, m.file.filename || 'file', m.id || ''); }} className="flex items-center justify-center gap-2 mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  Download
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          hideUrls(m.content) && <div>{hideUrls(m.content)} {m.edited && <span className="text-[10px] text-gray-300">(edited)</span>}</div>
                        )}
                      </>
                    )}
                  </div>
                  </div>
                  {isMine && msgUser && (
                    <UserAvatar user={msgUser} size="sm" className="mt-1" />
                  )}
                  </div>
                  );
                })}

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
                <div ref={bottomRef} />
              </div>

              {/* FIXED INPUT FIELD */}
              <div className="flex-shrink-0 p-5 border-t border-purple-500/20 bg-gradient-to-r from-[#1a1d21]/95 to-[#0f1115]/95 backdrop-blur-md shadow-2xl">
                {uploadingFiles && (
                  <div className="mb-3 p-4 bg-green-900/20 rounded-xl border border-green-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <svg className="animate-spin h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-green-400 font-medium">Sending files...</span>
                      </div>
                      <button onClick={cancelUpload} className="p-2 bg-red-600 rounded-lg hover:bg-red-700 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                )}
                {files.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 bg-purple-600/20 px-3 py-2 rounded-lg border border-purple-500/30">
                        <span className="text-sm text-white truncate max-w-[150px]">{f.name}</span>
                        <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {selectionMode && (
                    <button
                      onClick={() => {
                        if (selectedMessages.size === messages.length) {
                          setSelectedMessages(new Set());
                        } else {
                          setSelectedMessages(new Set(messages.map(m => m.id || '').filter(Boolean)));
                        }
                      }}
                      className="p-3.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-all hover:scale-105"
                      title="Select All"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMessages.size === messages.length && messages.length > 0}
                        readOnly
                        className="w-5 h-5 rounded border-2 border-purple-500 bg-transparent checked:bg-purple-600 cursor-pointer"
                      />
                    </button>
                  )}

                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !uploadingFiles && sendMessage()
                    }
                    disabled={uploadingFiles}
                    className="flex-1 bg-[#2b2f36] border border-purple-500/20 rounded-xl px-5 py-3.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all placeholder:text-gray-500 disabled:opacity-50"
                    placeholder="Type a message..."
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const selectedFiles = Array.from(e.target.files || []);
                      setFiles(prev => [...prev, ...selectedFiles]);
                      e.target.value = '';
                    }}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFiles}
                    className="p-3.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-all hover:scale-105 disabled:opacity-50"
                  >
                    <Plus size={20} className="text-purple-400" />
                  </button>

                  <button
                    onClick={sendMessage}
                    disabled={(!text.trim() && files.length === 0) || uploadingFiles}
                    className="p-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 shadow-lg shadow-purple-900/50"
                  >
                    <Send size={20} />
                  </button>

                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <ProfileSession isOpen={profileOpen} onClose={() => { setProfileOpen(false); setViewingUser(null); }} user={viewingUser} isOwnProfile={false} />
    </AppLayout>
  );
};

export default Dashboard;
