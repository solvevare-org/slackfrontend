import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import AppLayout from "@/components/layout/AppLayout";
import { emitNotification } from "@/lib/notificationBus";
import { useToast } from "@/components/ui/toast";
import { hideUrls } from "@/lib/utils";


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
  to?: string;               // ✅ added
  group?: string;            // ✅ added
  workspace?: string | null; // ✅ added
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

/* ================= CONSTANT ================= */

const SOCKET_URL = "http://localhost:9000";

/* ================= COMPONENT ================= */

const GroupChat = () => {
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { show } = useToast();

  const [user, setUser] = useState<IUser | null>(null);
  const [activeChat, setActiveChat] = useState<{
    type: "dm" | "group" | "community";
    id: string;
    name: string;
  } | null>(null);

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [text, setText] = useState("");

  const myId = useMemo(() => user?._id || user?.id || "", [user]);

  /* ================= USER INIT ================= */

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (!storedUser || !token) {
      navigate("/login");
      return;
    }

    setUser(JSON.parse(storedUser));
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

    // ===== DM MESSAGE =====
    socket.on("private message", (msg: IMessage) => {
      if (!activeChat || activeChat.type !== "dm") return;

      if (
        String(msg.from) === String(activeChat.id) ||
        String(msg.to) === String(activeChat.id)
      ) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    // ===== GROUP MESSAGE =====
    socket.on("group message", (msg: IMessage) => {
      if (
        activeChat &&
        (activeChat.type === "group" ||
          activeChat.type === "community") &&
        String(msg.group) === String(activeChat.id)
      ) {
        setMessages((prev) => [...prev, msg]);
      } else if (msg.from !== myId) {
        emitNotification({
          type: "group",
          groupId: msg.group,
          title: msg.fromName || "New message",
          message: msg.content,
        });
      }
    });

    return () => socket.disconnect();
  }, [myId, activeChat]);

  /* ================= AUTO SCROLL ================= */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ================= SEND ================= */

  const sendMessage = () => {
    if (!socketRef.current || !activeChat || !text.trim()) return;

    if (activeChat.type === "dm") {
      socketRef.current.emit("private message", {
        to: activeChat.id,
        content: text.trim(),
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
        id: crypto.randomUUID(), // ✅ prevent key warning
        from: myId,
        to: activeChat.type === "dm" ? activeChat.id : undefined,
        group:
          activeChat.type !== "dm"
            ? activeChat.id
            : undefined,
        content: text.trim(),
        createdAt: new Date().toISOString(),
      },
    ]);

    setText("");
  };

  /* ================= UI ================= */

  return (
    <AppLayout>
      <div className="flex h-screen bg-[#1a1d21] text-white">

        {/* MAIN */}
        <main className="flex-1 flex flex-col">

          {!activeChat ? (
            <div className="flex items-center justify-center h-full">
              Select a chat
            </div>
          ) : (
            <>
              <div className="p-4 border-b bg-white text-black font-semibold">
                {activeChat.name}
              </div>

              {/* MESSAGES */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m, index) => {
                  const isMine = m.from === myId;
                  const safeContent = m.content || "";

                  return (
                    <div key={m.id || index}>
                      <div
                        className={`max-w-md p-3 rounded ${
                          isMine
                            ? "bg-purple-200 ml-auto"
                            : "bg-gray-200"
                        }`}
                      >
                        {safeContent && (
                          <div>
                            {hideUrls(safeContent)}
                            {m.edited && (
                              <span className="text-xs ml-2 text-gray-500">
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

              {/* INPUT */}
              <div className="p-4 border-t bg-white flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && sendMessage()
                  }
                  className="flex-1 border rounded px-3 py-2 text-black"
                  placeholder="Type a message..."
                />
                <button
                  onClick={sendMessage}
                  className="bg-purple-600 text-white px-4 rounded"
                >
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