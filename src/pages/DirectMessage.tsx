import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { playNotificationSound } from '@/lib/utils'

const SOCKET_URL = "http://localhost:9000";

interface IMessage {
  from: string;
  to?: string;
  fromName?: string;
  content?: string;
  file?: {
    url?: string;
    filename?: string;
  };
  createdAt?: string;
}

interface IUser {
  _id: string;
  name: string;
}

const DirectMessage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [chatUser, setChatUser] = useState<IUser | null>(null);
  const [members, setMembers] = useState<IUser[]>([]);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, number>>({});

  const socketRef = useRef<Socket | null>(null);

  const myId = (() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return "";
      const me = JSON.parse(raw);
      return me.id || me._id || "";
    } catch {
      return "";
    }
  })();

  /* ================= SOCKET CONNECTION ================= */

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on("private message", (msg: IMessage) => {
      setMessages((prev) => [...prev, msg]);
      // play sound for incoming messages that are not sent by me
      try {
        const toId = String(msg.to || "")
        const fromId = String(msg.from || "")
        if (toId && fromId && toId === String(myId) && fromId !== String(myId)) {
          playNotificationSound()
        }
      } catch (e) {}
    });

    socket.on('online-list', (payload: any) => {
      try {
        if (payload && Array.isArray(payload.online)) {
          setOnlineIds(payload.online.map(String));
        } else if (Array.isArray(payload)) {
          setOnlineIds(payload.map(String));
        }
        if (payload && payload.lastSeen) {
          setLastSeenMap(Object.fromEntries(Object.entries(payload.lastSeen).map(([k, v]) => [String(k), Number(v)])));
        }
      } catch (e) {}
    });

    socket.on('user-online', (id: string) => {
      setOnlineIds((prev) => {
        if (!prev.includes(String(id))) return [String(id), ...prev];
        return prev;
      });
      setLastSeenMap((m) => {
        const copy = { ...m };
        delete copy[String(id)];
        return copy;
      });
    });

    socket.on('user-offline', (payload: any) => {
      // payload may be { id, lastSeen }
      const id = payload?.id || payload
      const ts = payload?.lastSeen || Date.now()
      setOnlineIds((prev) => prev.filter((x) => x !== String(id)));
      setLastSeenMap((m) => ({ ...(m || {}), [String(id)]: Number(ts) }));
    });

    return () => {
      socket.disconnect();
    };
  }, [navigate]);

  /* ================= LOAD DATA ================= */

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !userId) return;

    // Load chat history
    fetch(`http://localhost:9000/api/message/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.messages)) {
          setMessages(data.messages);
        }
      })
      .catch((err) => console.error(err));

    // Load chat user
    fetch(`http://localhost:9000/api/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.user) setChatUser(d.user);
      })
      .catch(() => {});

    // Load members
    fetch("http://localhost:9000/api/user/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.result)) {
          const me = JSON.parse(localStorage.getItem("user") || "{}");
          const list = d.result.filter(
            (u: IUser) => u._id !== (me.id || me._id)
          );
          setMembers(list);
        }
      })
      .catch(() => {});
  }, [userId]);

  /* ================= SEND MESSAGE ================= */

  const sendMessage = async () => {
    if (!socketRef.current || !userId) return;

    const raw = localStorage.getItem("user");
    if (!raw) return;

    const me = JSON.parse(raw);
    const token = localStorage.getItem("token");

    // Upload file
    if (file && token) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File too large (max 10MB)");
        return;
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("to", userId);

      try {
        const res = await fetch(
          "http://localhost:9000/api/message/upload",
          {
            method: "POST",
            body: fd,
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = await res.json();
        if (data?.message) {
          setMessages((prev) => [...prev, data.message]);
        }
      } catch (err) {
        console.error(err);
      }

      setFile(null);
    }

    // Send text
    if (text.trim()) {
      const payload = {
        content: text.trim(),
        to: userId,
      };

      // emit to server and rely on server to echo back the message to sender
      socketRef.current.emit("private message", payload);

      // clear input — do not append locally to avoid duplicate when server echoes
      setText("");
    }
  };

  /* ================= UI ================= */

  function timeAgo(timestamp: number) {
    try {
      const diff = Date.now() - Number(timestamp)
      const s = Math.floor(diff / 1000)
      if (s < 60) return `${s}s ago`
      const m = Math.floor(s / 60)
      if (m < 60) return `${m}m ago`
      const h = Math.floor(m / 60)
      if (h < 24) return `${h}h ago`
      const d = Math.floor(h / 24)
      return `${d}d ago`
    } catch (e) { return 'some time ago' }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white p-4 relative">
        <h2 className="text-2xl font-bold mb-8">Slack Clone</h2>

        <h3 className="text-sm font-semibold text-gray-400 mb-4">
          Direct Messages
        </h3>

        {members.map((m) => (
          <button
            key={m._id}
            onClick={() => navigate(`/dm/${m._id}`)}
            className={`w-full text-left px-3 py-2 rounded mb-1 flex items-center justify-between ${
              m._id === userId
                ? "bg-purple-600 text-white"
                : "hover:bg-gray-800"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">{m.name}</span>
              {onlineIds.includes(String(m._id)) ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full" aria-hidden title="Active now" />
                  <span className="text-xs text-green-300">Active now</span>
                </div>
              ) : (
                <span className="text-xs text-gray-400" title={lastSeenMap[String(m._id)] ? `Last seen ${timeAgo(lastSeenMap[String(m._id)])}` : 'Offline'}>
                  {lastSeenMap[String(m._id)] ? `Last seen ${timeAgo(lastSeenMap[String(m._id)])}` : 'Offline'}
                </span>
              )}
            </div>
            
          </button>
        ))}

        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-2 justify-center px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm"
            aria-label="Go to Dashboard"
            title="Dashboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M13 5v6h6" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21v-7a2 2 0 00-2-2H7a2 2 0 00-2 2v7" />
            </svg>
            <span>Dashboard</span>
          </button>
        </div>
      </div>

      {/* Chat Section */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">
              {chatUser?.name || "Chat"}
            </h1>
            {chatUser && onlineIds.includes(String(chatUser._id)) ? (
              <span className="inline-flex items-center gap-2 text-sm text-green-600" title="Active now">● Online</span>
            ) : chatUser && lastSeenMap[String(chatUser._id)] ? (
              <span className="inline-flex items-center gap-2 text-sm text-gray-500" title={`Last seen ${timeAgo(lastSeenMap[String(chatUser._id)])}`}>Last seen {timeAgo(lastSeenMap[String(chatUser._id)])}</span>
            ) : null}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
          {messages.length === 0 && (
            <p className="text-gray-500 text-center">
              Start conversation...
            </p>
          )}

          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`max-w-md p-3 rounded-lg ${
                m.from === myId
                  ? "bg-purple-200 self-end"
                  : "bg-gray-200 self-start"
              }`}
            >
              <div className="text-xs text-gray-600">
                {m.fromName || m.from}
              </div>

              {m.content && (
                <div className="text-sm text-gray-800">
                  {m.content}
                </div>
              )}

              {m.file?.url && (
                <a
                  href={m.file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 underline text-sm"
                >
                  {m.file.filename || "Attachment"}
                </a>
              )}

              <div className="text-xs text-gray-400 mt-1">
                {m.createdAt
                  ? new Date(m.createdAt).toLocaleString()
                  : ""}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-4 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600"
          />

          <input
            type="file"
            onChange={(e) =>
              setFile(e.target.files ? e.target.files[0] : null)
            }
            className="text-sm"
          />

          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default DirectMessage;
