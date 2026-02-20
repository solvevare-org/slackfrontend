import React, { useState, useEffect } from "react";
import { onNotification, emitAction, NotificationPayload } from "@/lib/notificationBus";
import { useNavigate } from "react-router-dom";
import {
  Home,
  MessageSquare,
  Bell,
  MoreHorizontal,
  Plus,
  Paperclip,
} from "lucide-react";
import ProfileSession from "./ProfileSession";

/* 🔥 Icon Button */
interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function IconButton({ icon, label, active, onClick }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full py-2 px-3 transition-colors ${
        active
          ? "bg-purple-700/50 text-white"
          : "text-gray-300 hover:bg-purple-900/30"
      }`}
    >
      <div className="w-6 h-6 flex items-center justify-center mb-1">
        {icon}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

type ActivityItem = NotificationPayload & { id: string; ts: number };

const Sidebar: React.FC = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [unread, setUnread] = useState<number>(0);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<any>(null);

  /* 🔥 Load User */
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      setUser(JSON.parse(raw));
    }
  }, []);

  /* 🔐 Role Check */
  const roleStr = (user?.role || user?.Role || "").toLowerCase();
  const isAdmin = roleStr === "admin";

  /* 🔔 Notification Listener */
  useEffect(() => {
    const off = onNotification((payload: NotificationPayload) => {
      const item: ActivityItem = { id: `${Date.now()}-${Math.random()}`, ts: Date.now(), ...payload };
      setActivities((prev) => [item, ...prev]);
      setUnread((prev) => prev + 1);
    });
    return off;
  }, []);

  // close activity modal on ESC
  useEffect(() => {
    if (!activityOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivityOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activityOpen]);

  const openActivity = () => setActivityOpen((s) => !s);

  const clearAll = () => {
    setActivities([]);
    setUnread(0);
  };

  const handleClickActivity = (it: ActivityItem) => {
    // open chat inside Dashboard by emitting an action that Dashboard listens to
    if (it.type === "private" && it.from) {
      const ac = { type: 'dm', id: it.from, name: it.title || '' };
      try { localStorage.setItem('activeChat', JSON.stringify(ac)); } catch (e) {}
      emitAction({ action: 'open-chat', data: ac });
      navigate('/dashboard');
    } else if (it.type === "group" && it.groupId) {
      const ac = { type: 'group', id: it.groupId, name: it.title || '' };
      try { localStorage.setItem('activeChat', JSON.stringify(ac)); } catch (e) {}
      emitAction({ action: 'open-chat', data: ac });
      navigate('/dashboard');
    }

    // remove this notification and decrement unread
    setActivities((prev) => prev.filter((p) => p.id !== it.id));
    setUnread((prev) => Math.max(0, prev - 1));
    setActivityOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* LEFT SIDEBAR */}
      <div className="w-[65px] bg-[#4A154B] flex flex-col items-center py-4 text-white relative">

        {/* Logo */}
        <div
          onClick={() => navigate("/dashboard")}
          className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-6 cursor-pointer"
        >
          
          <span className="text-[#4A154B] font-bold text-xl" >SV</span>
        </div>

        {/* NAVIGATION */}
        <div className="flex-1 w-full flex flex-col items-center gap-4">

          <IconButton
            icon={<Home size={22} />}
            label="Home"
            onClick={() => navigate("/dashboard")}
          />

          <IconButton
            icon={<MessageSquare size={22} />}
            label="DMs"
            onClick={() => navigate("/dm/id")}
          />

          {/* ✅ ADMIN ONLY BUTTON */}
          {isAdmin && (
            <IconButton
              icon={<Plus size={22} />}
              label="Add Workspace"
              onClick={() => navigate("/workspace")}
            />
          )}

          {/* Activity */}
          <div className="relative w-full">
            <button
              onClick={openActivity}
              className="flex flex-col items-center justify-center w-full py-2 px-3 text-gray-300 hover:bg-purple-900/30"
            >
              <div className="w-6 h-6 flex items-center justify-center mb-1">
                <Bell size={22} />
              </div>
              <span className="text-xs font-medium">Activity</span>
            </button>

            {unread > 0 && (
              <span className="absolute top-1 right-3 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}

            {/* Activity modal (centered) */}
            {activityOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/50" onClick={() => setActivityOpen(false)} />
                <div className="relative w-[520px] max-h-[70vh] bg-[#0f1115] border border-white/10 rounded shadow-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b border-white/5">
                    <div className="text-sm font-semibold">Activity</div>
                    <div className="flex gap-2">
                      <button onClick={clearAll} className="text-xs px-2 py-1 bg-red-600/90 rounded text-white">All Clear</button>
                      <button onClick={() => setActivityOpen(false)} className="text-xs px-2 py-1 bg-white/5 rounded">Close</button>
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-[60vh]">
                    {activities.length === 0 ? (
                      <div className="p-4 text-sm text-gray-400">No notifications</div>
                    ) : (
                      activities.map((it) => (
                        <div key={it.id} onClick={() => handleClickActivity(it)} className="flex items-start gap-3 p-3 hover:bg-white/3 cursor-pointer border-b border-white/5">
                          <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-sm text-white">
                            {it.type === 'private' ? 'DM' : it.type === 'group' ? 'G' : 'N'}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{it.title || (it.type === 'private' ? 'Direct message' : 'Group message')}</div>
                            <div className="text-xs text-gray-400 truncate mt-1">{it.file?.filename ? `Attachment: ${it.file.filename}` : (it.message || '')}</div>
                            <div className="text-[10px] text-gray-500 mt-1">{new Date(it.ts || Date.now()).toLocaleString()}</div>
                          </div>
                          {it.file?.filename && (
                            <div className="text-gray-400">
                              <Paperclip size={14} />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <IconButton
            icon={<MoreHorizontal size={22} />}
            label="More"
          />
        </div>

        {/* PROFILE */}
        <div className="mb-4 text-center cursor-pointer" onClick={() => { setViewingUser(null); setProfileOpen(true); }}>
          {user?.avatar ? (
            <img src={user.avatar} alt="Profile" className="w-12 h-12 rounded-full object-cover hover:ring-2 hover:ring-white transition" />
          ) : (
            <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center hover:ring-2 hover:ring-white transition">
              <span className="text-black font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
          )}
          <div className="text-xs mt-1">{user?.name || "User"}</div>
        </div>

      </div>

      {/* Profile Session */}
      <ProfileSession isOpen={profileOpen} onClose={() => { setProfileOpen(false); setViewingUser(null); }} user={viewingUser || user} isOwnProfile={!viewingUser} />
    </div>
  );
};

export default Sidebar;
