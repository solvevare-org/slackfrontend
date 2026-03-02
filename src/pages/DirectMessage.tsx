import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import AppLayout from "@/components/layout/AppLayout";
import { ChevronDown, Send, Plus } from "lucide-react";
import { emitNotification } from "@/lib/notificationBus";
import { useToast } from "@/components/ui/toast";
import { hideUrls } from '@/lib/utils'
import UserAvatar from "@/components/common/UserAvatar";
import ProfileSession from "@/components/layout/ProfileSession";
import RichTextEditor from "@/components/common/RichTextEditor";
import { API_URL, SOCKET_URL } from "@/lib/config";

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
  createdAt?: string;
  file?: {
    url: string;
    filename?: string;
    mimetype?: string;
    size?: number;
  };
}



const DirectMessage = () => {
  const navigate = useNavigate();
  const params = useParams();

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [user, setUser] = useState<IUser | null>(null);
  const [dmUsers, setDmUsers] = useState<IUser[]>([]);
  const [activeDM, setActiveDM] = useState<IUser | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [text, setText] = useState("");
  const [editorHtml, setEditorHtml] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [downloadingFiles, setDownloadingFiles] = useState<Record<string, AbortController>>({});
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [directMessagesExpanded, setDirectMessagesExpanded] = useState(true);

  // context menu / edit state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string | null } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { show } = useToast();

  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<any>(null);

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

    if (currentWs?.id) {
      fetch(`${SOCKET_URL}/api/workspaces/${currentWs.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d?.success && Array.isArray(d.workspace?.members)) {
            const filtered = d.workspace.members.filter(
              (u: IUser) =>
                (u._id || u.id) !== (parsed._id || parsed.id)
            );
            setDmUsers(filtered);
          }
        });
    }
  }, [navigate]);

  /* ================= AUTO OPEN ================= */
  useEffect(() => {
    const uid = params.userId;
    if (!uid) return;

    const found = dmUsers.find(
      (u) => u._id === uid || u.id === uid
    );
    if (found) setActiveDM(found);
  }, [params.userId, dmUsers]);

  // restore active DM after reload (when no route param)
  useEffect(() => {
    if (params.userId) return;
    try {
      const raw = localStorage.getItem('activeDM')
      if (raw) {
        const u = JSON.parse(raw)
        if (u && u._id) setActiveDM(u)
      }
    } catch (e) {}
  }, [params.userId])

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

    /* ===== ONLINE USERS ===== */
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

    /* ===== PRIVATE MESSAGE ===== */
    socket.on("private message", (msg: IMessage & { workspace?: string | null }) => {
      const rawWs = localStorage.getItem('currentWorkspace');
      const currentWs = rawWs ? JSON.parse(rawWs) : null;
      // ignore messages that belong to a different workspace
      if (msg.workspace && currentWs?.id && String(msg.workspace) !== String(currentWs.id)) return;

      if (activeDM && (msg.from === activeDM._id || (msg.to && String(msg.to) === String(activeDM._id)))) {
        // Only add message if it's from the other person, not from me
        if (msg.from !== myId) {
          setMessages((prev) => [...prev, msg]);
        }
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

        showNotification(
          msg.fromName || "New DM",
          msg.content || ""
        );
      }
    });

    // real-time message edit/delete
    socket.on('message edited', (payload: any) => {
      setMessages(prev => prev.map(m => (String(m.id) === String(payload.id) ? { ...m, content: payload.content, edited: !!payload.edited } : m)));
    });

    socket.on('message deleted', (payload: any) => {
      setMessages(prev => prev.filter(m => String(m.id) !== String(payload.id)));
    });

    return () => { socket.disconnect(); };
  }, [myId, activeDM]);

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
    if (!activeDM) return;

    const token = localStorage.getItem("token");
    const rawWs = localStorage.getItem('currentWorkspace');
    const currentWs = rawWs ? JSON.parse(rawWs) : null;
    const wsParam = currentWs?.id ? `?workspaceId=${currentWs.id}` : '';

    fetch(`${SOCKET_URL}/api/message/${activeDM._id}${wsParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) =>
        setMessages(Array.isArray(d?.messages) ? d.messages : [])
      );

    // reset unread
    setUnreadCounts((prev) => ({
      ...prev,
      [activeDM._id!]: 0,
    }));

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeDM]);

  /* ================= AUTO SCROLL ================= */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ================= SEND ================= */
  const sendMessage = async () => {
    if (!socketRef.current || !activeDM) return;
    const plainText = editorHtml.replace(/<[^>]*>/g, '').trim();
    if (!plainText && files.length === 0) return;

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

    if (editorHtml.trim() && editorHtml !== '<p></p>') {
      const rawWs = localStorage.getItem('currentWorkspace');
      const currentWs = rawWs ? JSON.parse(rawWs) : null;

      socketRef.current.emit("private message", {
        to: activeDM._id,
        content: editorHtml,
        workspaceId: currentWs?.id || null
      });

      setMessages((prev) => [
        ...prev,
        {
          from: myId,
          fromName: user?.name,
          content: editorHtml,
          workspace: currentWs?.id || null,
          createdAt: new Date().toISOString(),
        },
      ]);

      setEditorHtml("");
      setText("");
    }
  }; 

  const uploadFile = async (f: File, signal?: AbortSignal) => {
    if (!activeDM) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    if (f.size > 100 * 1024 * 1024) { show('Max file size 100MB', 'error'); return; }

    const fd = new FormData();
    fd.append('file', f);
    fd.append('to', activeDM._id!);
    const rawWs = localStorage.getItem('currentWorkspace');
    const currentWs = rawWs ? JSON.parse(rawWs) : null;
    if (currentWs?.id) fd.append('workspaceId', currentWs.id);

    const res = await fetch(`${SOCKET_URL}/api/message/upload`, {
      method: 'POST',
      body: fd,
      headers: { Authorization: `Bearer ${token}` },
      signal
    });

    const data = await res.json();
    const msg = data?.message;
    if (msg) {
      setMessages((prev) => [...prev, msg]);
    }
  }

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
      if (newSet.has(msgId)) newSet.delete(msgId);
      else newSet.add(msgId);
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
        await fetch(`${SOCKET_URL}/api/message/${msg.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
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
      if (err.name === 'AbortError') show('Download cancelled', 'info');
      else show('Download failed', 'error');
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

  /* ================= NOTIFICATION ================= */
  const showNotification = (title: string, body: string) => {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    } else {
      Notification.requestPermission();
    }
  };

  /* ================= UI ================= */
  return (
    <AppLayout>
      <div className="flex h-screen bg-gradient-to-br from-[#0a0b0d] via-[#1a1d21] to-[#0f1115] text-white">

        {/* SIDEBAR */}
        <aside className="w-[280px] bg-[#1A1D21]/80 backdrop-blur-sm border-r border-purple-500/20 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9333ea #1a1d21' }}>
 
         <div className="flex items-center gap-2 mb-3 px-3">
            <div className="p-1 bg-green-500/20 rounded">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              
            </div>
           
            <span className="text-xs font-semibold text-gray-400">Direct Messages</span>
               <hr className="my-4 border-purple-500/30" />
            <span className="ml-auto text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">{dmUsers.length}</span>
          </div>

          <div className="space-y-1">
            {dmUsers.map((u) => {
              const isOnline = onlineUsers.includes(u._id || u.id || '');
              const hasUnread = unreadCounts[u._id || u.id || ''] > 0;
              return (
                <div
                  key={u._id}
                  onClick={() => { setActiveDM(u); try { localStorage.setItem('activeDM', JSON.stringify(u)) } catch (e) {} }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                    activeDM?._id === u._id
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
          {!activeDM ? (
            <div className="flex flex-col items-center justify-center h-full">
              <h1 className="text-2xl font-semibold mb-4">
                Welcome Back {user?.name}
              </h1>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* FIXED HEADER */}
              <div className="flex-shrink-0 p-5 border-b border-purple-500/20 bg-gradient-to-r from-[#1a1d21]/90 to-[#0f1115]/90 backdrop-blur-md shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="cursor-pointer" onClick={async () => {
                      const token = localStorage.getItem('token');
                      const res = await fetch(`${SOCKET_URL}/api/user/${activeDM._id || activeDM.id}`, { headers: { Authorization: `Bearer ${token}` } });
                      const data = await res.json();
                      setViewingUser(data.user || activeDM);
                      setProfileOpen(true);
                    }}>
                      <UserAvatar user={activeDM} size="md" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg text-white">{activeDM.name}</h2>
                      <p className="text-xs text-purple-300">Direct Message</p>
                    </div>
                  </div>
                  {selectedMessages.size > 0 && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (selectedMessages.size === messages.length) {
                            setSelectedMessages(new Set());
                          } else {
                            setSelectedMessages(new Set(messages.map(m => m.id || '').filter(Boolean)));
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg transition-all"
                        title="Select All"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMessages.size === messages.length && messages.length > 0}
                          readOnly
                          className="w-4 h-4 rounded border-2 border-purple-500 bg-transparent checked:bg-purple-600 cursor-pointer"
                        />
                        <span className="text-sm text-white font-medium">Select All</span>
                      </button>
                      <span className="text-sm text-purple-300 font-medium">{selectedMessages.size} selected</span>
                      <button onClick={deleteSelectedMessages} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium">Delete</button>
                      <button onClick={() => { setSelectedMessages(new Set()); setSelectionMode(false); }} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm font-medium">Cancel</button>
                    </div>
                  )}
                </div>
              </div>

              {/* SCROLLABLE MESSAGES */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9333ea #1a1d21' }}>
                {messages.map((m, idx) => {
                  const isImage = m.file && ((m.file?.mimetype && m.file?.mimetype.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg)$/i.test((m.file?.filename || m.file?.url || '')));
                  const isMine = m.from === myId;
                  const msgUser = isMine ? user : dmUsers.find(u => (u._id || u.id) === m.from);
                  return (
                  <div key={m.id || `msg-${idx}`} className={`group flex ${isMine ? 'justify-end' : 'justify-start'} animate-fadeIn items-start gap-2`} onMouseEnter={() => m.id && setSelectionMode(true)}>
                  {!isMine && msgUser && <UserAvatar user={msgUser} size="sm" className="mt-1" />}
                  <div className="flex items-center gap-2">
                  {isMine && (
                    <div className={selectedMessages.has(m.id || '') ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} style={{transition: 'opacity 0.2s'}}>
                      <input type="checkbox" checked={selectedMessages.has(m.id || '')} onChange={() => m.id && toggleMessageSelection(m.id)} className="w-5 h-5 rounded border-2 border-purple-500 bg-transparent checked:bg-purple-600 cursor-pointer" />
                    </div>
                  )}
                  <div
                    onContextMenu={(e) => { e.preventDefault(); if (!m.id) return; const role = ((user?.role || user?.Role || '') as string).toLowerCase(); if (String(m.from) !== String(myId) && role !== 'admin') return; setContextMenu({ x: e.clientX, y: e.clientY, id: m.id }); }}
                    onClick={(e) => {
                      if (selectedMessages.size > 0 && m.id) toggleMessageSelection(m.id);
                      else if (m.id && String(m.from) === String(myId)) {
                        const role = ((user?.role || user?.Role || '') as string).toLowerCase();
                        if (String(m.from) === String(myId) || role === 'admin') setContextMenu({ x: e.clientX, y: e.clientY, id: m.id });
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
                        <input
                          autoFocus
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={async (ev) => {
                            if (ev.key === 'Enter') {
                              ev.preventDefault();
                              const token = localStorage.getItem('token'); if (!token) return;
                              try {
                                const res = await fetch(`${SOCKET_URL}/api/message/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: editingText }) });
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
                          className="flex-1 bg-white/5 px-2 py-1 rounded text-sm outline-none" />
                        <button onClick={async () => {
                          const token = localStorage.getItem('token'); if (!token) return;
                          try {
                            const res = await fetch(`${SOCKET_URL}/api/message/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: editingText }) });
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
                        {/* attachments: inline image */}
                        {m.file && ((m.file?.mimetype && m.file?.mimetype.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg)$/i.test((m.file?.filename || m.file?.url || ''))) ? (
                          <img src={m.file!.url} alt="image" className="w-[320px] h-[270px] object-cover cursor-pointer" style={{ borderRadius: '1.5rem' }} onClick={() => window.open(m.file!.url, '_blank')} />
                        ) : m.file && /\.pdf$/i.test(m.file?.filename || '') ? (
                          <div className="w-[280px] rounded-xl overflow-hidden border border-white/10 relative">
                            {downloadingFiles[m.id || ''] ? (
                              <div className="h-full p-6 flex flex-col items-center justify-center bg-green-900/20">
                                <div className="relative">
                                  <svg className="animate-spin h-16 w-16 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  <button onClick={(e) => { e.stopPropagation(); cancelDownload(m.id || ''); }} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                                </div>
                                <div className="text-sm text-green-400 mt-4 font-medium">Downloading...</div>
                              </div>
                            ) : (
                              <div className="h-full p-6 flex flex-col items-center justify-center cursor-pointer" onClick={() => window.open(m.file!.url, '_blank')}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                <span className="text-red-400 font-bold text-2xl mt-3">PDF</span>
                                <div className="text-sm font-medium text-white truncate w-full text-center mt-4">{m.file!.filename || 'File'}</div>
                                <div className="flex gap-2 mt-4">
                                  <button onClick={(e) => { e.stopPropagation(); window.open(m.file!.url, '_blank'); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>Preview</button>
                                  <button onClick={(e) => { e.stopPropagation(); downloadFile(m.file!.url, m.file!.filename || 'file.pdf', m.id || ''); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : m.file && /\.(rar|zip)$/i.test(m.file?.filename || '') ? (
                          <div className="w-[280px] rounded-xl overflow-hidden border border-white/10 relative">
                            {downloadingFiles[m.id || ''] ? (
                              <div className="h-full p-6 flex flex-col items-center justify-center bg-green-900/20">
                                <div className="relative">
                                  <svg className="animate-spin h-16 w-16 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  <button onClick={(e) => { e.stopPropagation(); cancelDownload(m.id || ''); }} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                                </div>
                                <div className="text-sm text-green-400 mt-4 font-medium">Downloading...</div>
                              </div>
                            ) : (
                              <div className="h-full p-6 flex flex-col items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                <span className="text-purple-400 font-bold text-2xl mt-3">{m.file?.filename?.split('.').pop()?.toUpperCase()}</span>
                                <div className="text-sm font-medium text-white truncate w-full text-center mt-4">{m.file!.filename || 'File'}</div>
                                <button onClick={(e) => { e.stopPropagation(); downloadFile(m.file!.url, m.file!.filename || 'file', m.id || ''); }} className="flex items-center justify-center gap-2 mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</button>
                              </div>
                            )}
                          </div>
                        ) : (
                          m.content && <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: hideUrls(m.content) || '' }} />
                        )}
                      </>
                    )} 
                  </div>
                  </div>
                  {isMine && msgUser && <UserAvatar user={msgUser} size="sm" className="mt-1" />}
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
                              try {
                                const res = await fetch(`${SOCKET_URL}/api/message/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
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

              {/* FIXED INPUT FIELD */}
              <div className="flex-shrink-0 p-5 border-t border-purple-500/20 bg-gradient-to-r from-[#1a1d21]/95 to-[#0f1115]/95 backdrop-blur-md shadow-2xl">
                {uploadingFiles && (
                  <div className="mb-3 p-4 bg-green-900/20 rounded-xl border border-green-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <svg className="animate-spin h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span className="text-green-400 font-medium">Sending files...</span>
                      </div>
                      <button onClick={cancelUpload} className="p-2 bg-red-600 rounded-lg hover:bg-red-700 transition"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                  </div>
                )}
                {files.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 bg-purple-600/20 px-3 py-2 rounded-lg border border-purple-500/30">
                        <span className="text-sm text-white truncate max-w-[150px]">{f.name}</span>
                        <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <RichTextEditor
                    content={editorHtml}
                    onChange={setEditorHtml}
                    onSubmit={sendMessage}
                    placeholder={`Message ${activeDM.name}`}
                    disabled={uploadingFiles}
                    rightButtons={
                      <>
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { const selectedFiles = Array.from(e.target.files || []); setFiles(prev => [...prev, ...selectedFiles]); e.target.value = ''; }} />
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFiles} className="p-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-all hover:scale-105 disabled:opacity-50"><Plus size={18} className="text-purple-400" /></button>
                        <button onClick={sendMessage} disabled={(!editorHtml.trim() || editorHtml === '<p></p>') && files.length === 0 || uploadingFiles} className="p-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 shadow-lg shadow-purple-900/50"><Send size={18} /></button>
                      </>
                    }
                  />
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

export default DirectMessage;