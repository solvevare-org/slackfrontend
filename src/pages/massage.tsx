import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import { emitNotification } from "@/lib/notificationBus";
import { ChevronDown, Send } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { hideUrls } from "@/lib/utils";
import UserAvatar from "@/components/common/UserAvatar";

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
  to?: string;
  workspace?: string | null; // ✅ added
  fromName?: string;
  content?: string;
  edited?: boolean;
  createdAt?: string;
  file?: { url?: string; filename?: string };
}

const SOCKET_URL = "http://72.60.97.98:6006";

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

  const { show } = useToast();
  const myId = useMemo(() => user?._id || user?.id || "", [user]);

  /* ================= INIT ================= */

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (!storedUser || !token) {
      navigate("/login");
      return;
    }

    const parsed = JSON.parse(storedUser);
    setUser(parsed);

    const rawWs = localStorage.getItem("currentWorkspace");
    const currentWs = rawWs ? JSON.parse(rawWs) : null;

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
          } else {
            setDmUsers([]);
          }
        })
        .catch(() => setDmUsers([]));
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

  /* ================= SOCKET ================= */

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !myId) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("private message", (msg: IMessage) => {
      const rawWs = localStorage.getItem("currentWorkspace");
      const currentWs = rawWs ? JSON.parse(rawWs) : null;

      if (
        msg.workspace &&
        currentWs?.id &&
        String(msg.workspace) !== String(currentWs.id)
      ) return;

      if (
        activeDM &&
        (String(msg.from) === String(activeDM._id) ||
          String(msg.to) === String(activeDM._id))
      ) {
        setMessages((prev) => [...prev, msg]);
      } else if (msg.from !== myId) {
        emitNotification({
          type: "private",
          from: msg.from,
          title: msg.fromName
            ? `DM from ${msg.fromName}`
            : "New DM",
          message: msg.content,
        });
      }
    });

    return () => socket.disconnect();
  }, [myId, activeDM]);

  /* ================= LOAD MESSAGES ================= */

  useEffect(() => {
    if (!activeDM) return;

    const token = localStorage.getItem("token");
    const rawWs = localStorage.getItem("currentWorkspace");
    const currentWs = rawWs ? JSON.parse(rawWs) : null;
    const wsParam = currentWs?.id
      ? `?workspaceId=${currentWs.id}`
      : "";

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
    if (!socketRef.current || !activeDM || !text.trim())
      return;

    const rawWs = localStorage.getItem("currentWorkspace");
    const currentWs = rawWs ? JSON.parse(rawWs) : null;

    socketRef.current.emit("private message", {
      to: activeDM._id,
      content: text.trim(),
      workspaceId: currentWs?.id || null,
    });

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(), // ✅ fix key issue
        from: myId,
        to: activeDM._id,
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
      <aside className="w-[330px] bg-[#1A1D21] border-r border-white/10">
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
            <div className="mt-2 space-y-1">
              {dmUsers.map((u) => (
                <div
                  key={u._id || u.id}
                  onClick={() => setActiveDM(u)}
                  className={`px-3 py-1 rounded cursor-pointer ${
                    activeDM?._id === u._id
                      ? "bg-[#1164A3]"
                      : "hover:bg-white/5"
                  }`}
                >
                  {u.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col bg-[#0f1115] relative">

        {!activeDM ? (
          <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-2xl font-semibold mb-4">
              Welcome Back {user?.name}
            </h1>
          </div>
        ) : (
          <>
            <div className="bg-[#1A1D21] p-4 border-b border-white/10">
              {activeDM.name}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 mb-16">
              {messages.map((m) => {
                const isMine = m.from === myId;
                const safeContent = m.content || "";

                return (
                  <div key={m.id}>
                    <div
                      className={`max-w-md p-3 rounded ${
                        isMine
                          ? "ml-auto bg-[#1164A3]"
                          : "bg-[#2b2f36]"
                      }`}
                    >
                      {safeContent && (
                        <div>
                          {hideUrls(safeContent)}
                          {m.edited && (
                            <span className="text-xs ml-2 text-gray-300">
                              (edited)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
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
                  className="p-3 rounded-lg bg-[#1164A3] disabled:opacity-50"
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