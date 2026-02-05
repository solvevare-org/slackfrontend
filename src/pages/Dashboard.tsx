import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { playNotificationSound } from '@/lib/utils'

interface IUser {
  _id?: string;
  id?: string;
  name?: string;
  role?: string;
  Role?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<IUser | null>(null);
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const roleStr = (user?.role || user?.Role || "").toLowerCase();
  const isAdmin = roleStr === "admin";

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (!storedUser || !token) {
      navigate("/login");
      return;
    }

    const parsedUser: IUser = JSON.parse(storedUser);
    setUser(parsedUser);

    // Fetch all users
    fetch("http://localhost:9000/api/user/", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.result && Array.isArray(data.result)) {
          const filteredUsers = data.result.filter(
            (u: IUser) =>
              u._id !== parsedUser._id && u._id !== parsedUser.id
          );
          setUsers(filteredUsers);
        }
      })
      .catch((err) => {
        console.error("User fetch error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate]);

  /* ================= SOCKET FOR NOTIFICATIONS ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io("http://localhost:9000", { auth: { token } });
    socketRef.current = socket;

    const meRaw = localStorage.getItem("user");
    let myId = "";
    try {
      const me = meRaw ? JSON.parse(meRaw) : null;
      myId = me?.id || me?._id || "";
    } catch {
      myId = "";
    }

    socket.on("private message", (msg: any) => {
      // only notify if message is for me
      if (!msg) return;
      if (String(msg.to) === String(myId)) {
        // if currently viewing DM with the sender, do not increment
        const viewingDM = location.pathname.startsWith("/dm/") && location.pathname.includes(msg.from);
        if (!viewingDM) {
          setUnreadCount((c) => c + 1);
          setNotifications((n) => [{ from: msg.from, fromName: msg.fromName, content: msg.content, createdAt: msg.createdAt }, ...n]);
          try {
            const fromId = String(msg.from || "")
            if (fromId && fromId !== String(myId)) {
              playNotificationSound()
            }
          } catch (e) {}
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white p-4 relative">
        <div className="flex items-center gap-3 mb-6">
          <button
            aria-label="Logout"
            title="Logout"
            onClick={handleLogout}
            className="p-2 rounded hover:bg-gray-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8v8" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold">Slack Clone</h2>
        </div>

        <div className="space-y-4">
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800">
            # general
          </Button>
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800">
            # frontend
          </Button>
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800">
            # backend
          </Button>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-700">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">
            Direct Messages
          </h3>

          {loading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : users.length > 0 ? (
            users.map((u) => (
              <Button
                key={u._id}
                variant="ghost"
                onClick={() => navigate(`/dm/${u._id}`)}
                className="w-full justify-start text-white hover:bg-gray-800 text-sm"
              >
                {u.name}
              </Button>
            ))
          ) : (
            <div className="text-sm text-gray-400">No users found</div>
          )}
        </div>
      </div>

      {/* Main Section */}
      <div className="flex-1">
        <div className="bg-gradient-to-r from-purple-800 to-purple-700 text-white py-20 px-8">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-extrabold">Welcome back <span className="ml-2">👋</span></h1>
              <p className="mt-4 text-lg text-purple-100">Choose a workspace to get started.</p>
            </div>
              <div className="hidden md:flex items-center gap-4">
                {user && (
                  <div className="text-sm text-right">
                    <div className="font-semibold">{user.name}</div>
                    <div className="text-xs text-purple-100">Role: <span className="font-medium">{user.role || user.Role || 'member'}</span></div>
                  </div>
                )}

                <div className="relative">
                  <button aria-label="Notifications" title="Notifications" onClick={() => setShowNotifications(s => !s)} className="p-2 rounded hover:bg-purple-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-xs text-white rounded-full px-1">{unreadCount}</span>}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-72 bg-white text-gray-800 rounded shadow-lg z-50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">Notifications</div>
                        <button className="text-sm text-gray-500" onClick={() => { setNotifications([]); setUnreadCount(0); }}>Clear</button>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {notifications.length === 0 && <div className="text-sm text-gray-500">No new notifications</div>}
                        {notifications.map((n, i) => (
                          <button key={i} onClick={() => { setShowNotifications(false); setUnreadCount(0); navigate(`/dm/${n.from}`); }} className="w-full text-left p-2 hover:bg-gray-100 rounded">
                            <div className="text-sm font-medium">{n.fromName || n.from}</div>
                            <div className="text-xs text-gray-500">{n.content?.slice(0,80)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isAdmin && <Button onClick={() => navigate('/admin')}>Admin</Button>}
              </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 -mt-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">My workspaces</h2>
              <div className="bg-gray-50 p-4 rounded">
                <div className="mb-4 border-b pb-3">
                  <div className="text-sm text-gray-500">Workspaces</div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-white p-3 rounded shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-teal-400 rounded flex items-center justify-center text-white font-bold">SV</div>
                      <div>
                        <div className="font-semibold">SolveVare</div>
                        <div className="text-xs text-gray-500">24 members • Last active</div>
                      </div>
                    </div>
                    <button onClick={() => navigate('/workspace/solvevare')} className="text-gray-500">→</button>
                  </div>

                  <div className="flex items-center justify-between bg-white p-3 rounded shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-300 rounded flex items-center justify-center text-white font-bold">AR</div>
                      <div>
                        <div className="font-semibold">AR</div>
                        <div className="text-xs text-gray-500">0 members</div>
                      </div>
                    </div>
                    <button onClick={() => navigate('/workspace/ar')} className="text-gray-500">→</button>
                  </div>
                </div>

                <div className="mt-4">
                  <button onClick={() => navigate('/create-workspace')} className="text-sm text-purple-600">Create a new workspace</button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold">Talk things through in real time.</h3>
                <p className="text-sm text-gray-500 mt-2">Connect over audio or video.</p>
                <div className="mt-4">
                  <Button onClick={() => alert('Start a huddle')} className="bg-white text-purple-700">Start a huddle</Button>
                </div>
              </div>

              {!isAdmin && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-semibold">Invite external partners.</h3>
                  <p className="text-sm text-gray-500 mt-2">Speed up work with outside teams.</p>
                  <div className="mt-4">
                    {!showShareOptions ? (
                      <Button onClick={() => setShowShareOptions(true)}>Invite</Button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button title="Share on WhatsApp" onClick={() => {
                          const link = `${window.location.origin}/signup`;
                          const share = `https://wa.me/?text=${encodeURIComponent('Join our workspace: ' + link)}`;
                          window.open(share, '_blank');
                        }} className="p-2 rounded-full bg-green-500 text-white">WA</button>

                        <button title="Share on Facebook" onClick={() => {
                          const link = `${window.location.origin}/signup`;
                          const share = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
                          window.open(share, '_blank');
                        }} className="p-2 rounded-full bg-blue-600 text-white">FB</button>

                        <button title="Share on Instagram (copy link)" onClick={async () => {
                          const link = `${window.location.origin}/signup`;
                          try { await navigator.clipboard.writeText(link); alert('Link copied to clipboard. Paste it in Instagram.'); } catch { alert('Could not copy. Please copy: ' + link); }
                        }} className="p-2 rounded-full bg-pink-500 text-white">IG</button>

                        <button title="Share via Email" onClick={() => {
                          const link = `${window.location.origin}/signup`;
                          window.location.href = `mailto:?subject=${encodeURIComponent("You're invited")}&body=${encodeURIComponent('Join our workspace: ' + link)}`;
                        }} className="p-2 rounded-full bg-gray-800 text-white">@</button>

                        <button onClick={() => setShowShareOptions(false)} className="text-sm text-gray-500">Close</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
