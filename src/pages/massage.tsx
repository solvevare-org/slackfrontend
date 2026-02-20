import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import { emitNotification } from "@/lib/notificationBus";
import { ChevronDown, Send } from "lucide-react";
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
  createdAt?: string;
  file?: { url?: string; filename?: string };
}

const SOCKET_URL = "http://localhost:9000";

/* ================= COMPONENT ================= */
const Massage = () => {
  const navigate = useNavigate();
  const params = useParams();

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [user, setUser] = useState<IUser | null>(null);
  const [dmUsers, setDmUsers] = useState<IUser[]>([]);
  const [activeDM, setActiveDM] = useState<IUser | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [text, setText] = useState("");
  const [directMessagesExpanded, setDirectMessagesExpanded] = useState(true);

  // context / edit
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string | null } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { show } = useToast();

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

    // ✅ Fetch workspace members only
    if (currentWs?.id) {
      fetch(`${SOCKET_URL}/api/workspaces/${currentWs.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d?.success && Array.isArray(d.workspace?.members)) {
            const members = d.workspace.members;

            // Remove self
            const filtered = members.filter(
              (u: IUser) =>
                (u._id || u.id) !== (parsed._id || parsed.id)
            );

            setDmUsers(filtered);
          } else {
            setDmUsers([]);
          }
        })
        .catch(() => setDmUsers([]));
    } else {
      setDmUsers([]);
    }
  }, [navigate]);

  /* ================= AUTO OPEN FROM ROUTE ================= */
  useEffect(() => {
    const uid = params.userId;
    if (!uid) return;

    const found = dmUsers.find(
      (u) => u._id === uid || u.id === uid
    );
    if (found) {
      setActiveDM(found);
    }
  }, [params.userId, dmUsers]);

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

      if (activeDM && msg.from === activeDM._id) {
        setMessages((prev) => [...prev, msg]);
      } else if (msg.from !== myId) {
        emitNotification({
          type: "private",
          from: msg.from,
          title: msg.fromName
            ? `DM from ${msg.fromName}`
            : "New DM",
          message: msg.content,
          file: msg.file
        });
      }
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
  }, [activeDM]);

  /* ================= AUTO SCROLL ================= */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ================= SEND ================= */
  const sendMessage = () => {
    if (!socketRef.current || !activeDM || !text.trim()) return;

    const rawWs = localStorage.getItem('currentWorkspace');
    const currentWs = rawWs ? JSON.parse(rawWs) : null;

    socketRef.current.emit("private message", {
      to: activeDM._id,
      content: text.trim(),
      workspaceId: currentWs?.id || null
    });

    setMessages((prev) => [
      ...prev,
      {
        from: myId,
        fromName: user?.name,
        content: text.trim(),
        workspace: currentWs?.id || null,
        createdAt: new Date().toISOString(),
      },
    ]);

    setText("");
  };

  /* ================= UI ================= */
  return (

      <div className="flex h-screen bg-[#1a1d21] text-white">

        {/* SIDEBAR */}
        <aside className="w-[330px] bg-[#1A1D21] flex flex-col border-r border-white/10">
          <div className="px-3 mt-4">
            <button
              onClick={() =>
                setDirectMessagesExpanded(!directMessagesExpanded)
              }
              className="flex items-center gap-2 w-full px-3 py-1 text-lg font-semibold"
            >
              <ChevronDown size={16} />
              Direct Messages
            </button>

            {directMessagesExpanded && (
              <div className="mt-1 space-y-1">
                {dmUsers.length === 0 ? (
                  <div className="px-3 py-1 text-xs text-gray-400">
                    No workspace members
                  </div>
                ) : (
                  dmUsers.map((u) => (
                    <div
                      key={u._id}
                      onClick={() => setActiveDM(u)}
                      className={`px-3 py-1 rounded cursor-pointer text-sm ${
                        activeDM?._id === u._id
                          ? "bg-[#1164A3]"
                          : "hover:bg-white/5"
                      }`}
                    >
                      {u.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col relative bg-[#0f1115]">
          {!activeDM ? (
            <div className="flex flex-col items-center justify-center h-full">
              <h1 className="text-2xl font-semibold mb-4">
                Welcome Back {user?.name}
              </h1>
              <p className="text-gray-400">
                Select a workspace member to start chatting.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-[#1A1D21] p-4 font-semibold border-b border-white/10">
                {activeDM.name}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 mb-16">
                {messages.map((m) => (
                  <div
                    key={m.id || Math.random()}
                    onContextMenu={(e) => { e.preventDefault(); if (!m.id) return; const role = ((user?.role || user?.Role || '') as string).toLowerCase(); if (String(m.from) !== String(myId) && role !== 'admin') return; setContextMenu({ x: e.clientX, y: e.clientY, id: m.id }); }}
                    className={`max-w-md p-3 rounded ${
                      m.from === myId
                        ? "ml-auto bg-[#1164A3] relative"
                        : "bg-[#2b2f36] relative"
                    }`}
                  >
                    {m.fromName && (
                      <div className="text-xs text-gray-400 mb-1">
                        {m.fromName}
                      </div>
                    )}

                    {editingId === m.id ? (
                      <div className="flex gap-2">
                        <input autoFocus value={editingText} onChange={(e) => setEditingText(e.target.value)} onKeyDown={async (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); const token = localStorage.getItem('token'); if (!token) return; try { const res = await fetch(`${SOCKET_URL}/api/message/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: editingText }) }); if (!res.ok) { const err = await res.json().catch(()=>({})); show(err?.msg || 'Update failed', 'error'); return; } const d = await res.json(); const updated = d?.message; setMessages(prev => prev.map(x => x.id === updated.id ? { ...x, content: updated.content, edited: updated.edited } : x)); setEditingId(null); setEditingText(''); show('Message updated', 'success'); } catch (e) { console.error(e); show('Update failed', 'error'); } } else if (ev.key === 'Escape') { setEditingId(null); setEditingText(''); } }} className="flex-1 bg-white/5 px-2 py-1 rounded text-sm outline-none" />
                        <button onClick={async () => { const token = localStorage.getItem('token'); if (!token) return; try { const res = await fetch(`${SOCKET_URL}/api/message/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: editingText }) }); if (!res.ok) { const err = await res.json().catch(()=>({})); show(err?.msg || 'Update failed', 'error'); return; } const d = await res.json(); const updated = d?.message; setMessages(prev => prev.map(x => x.id === updated.id ? { ...x, content: updated.content, edited: updated.edited } : x)); setEditingId(null); setEditingText(''); show('Message updated', 'success'); } catch (e) { console.error(e); show('Update failed', 'error'); } }} className="px-2 bg-green-600 text-white rounded">Save</button>
                        <button onClick={() => { setEditingId(null); setEditingText(''); }} className="px-2 bg-white/10 text-white rounded">Cancel</button>
                      </div>
                    ) : (
                      <>
                        {/* hide URLs from message text */}
                        {hideUrls(m.content) ? <div>{hideUrls(m.content)} {m.edited && <span className="text-[10px] text-gray-300">(edited)</span>}</div> : null}

                        {/* attachments */}
                        {m.file && (/\.(png|jpe?g|gif|webp|svg)$/i.test((m.file.filename || m.file.url || ''))) ? (
                          <img src={m.file!.url} alt={m.file!.filename || 'image'} className="max-w-[320px] rounded mt-2 block" onClick={() => window.open(m.file!.url, '_blank')} />
                        ) : m.file ? (
                          <div className="mt-2 inline-flex items-center gap-2 bg-white/5 px-3 py-2 rounded">
                            <div className="text-sm text-gray-200">{m.file!.filename || 'Attachment'}</div>
                            <button onClick={() => window.open(m.file!.url, '_blank')} className="px-2 py-1 bg-white/5 rounded text-xs">Open</button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ))}
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
                              try { const res = await fetch(`${SOCKET_URL}/api/message/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) { const err = await res.json().catch(()=>({})); show(err?.msg || 'Delete failed', 'error'); return; } setMessages(prev => prev.filter(x => x.id !== id)); show('Message deleted', 'success'); } catch (e) { console.error(e); show('Delete failed', 'error'); }
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

              <div className="absolute bottom-0 w-full border-t border-white/10 p-4 bg-[#0f1115]">
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

                  <button
                    onClick={sendMessage}
                    disabled={!text.trim()}
                    className={`p-3 rounded-lg ${
                      text.trim()
                        ? "bg-[#1164A3] hover:bg-[#0d4f82]"
                        : "bg-gray-600 cursor-not-allowed"
                    }`}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

  );
};

export default Massage;
