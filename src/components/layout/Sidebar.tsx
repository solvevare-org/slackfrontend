import React, { useState, useEffect } from "react";
import { onNotification, emitAction, onAction, NotificationPayload } from "@/lib/notificationBus";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  MessageSquare,
  Bell,
  MoreHorizontal,
  Plus,
  Paperclip,
  X,
  Trash2,
  Hash,
  User,
  Sparkles,
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
      className={`flex flex-col items-center justify-center w-full py-2.5 px-3 transition-all rounded-lg ${
        active
          ? "bg-[#2d0a2e] text-white shadow-lg border-l-4 border-purple-400"
          : "text-gray-300 hover:bg-purple-900/30 hover:text-white"
      }`}
    >
      <div className="w-6 h-6 flex items-center justify-center mb-1">
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

type ActivityItem = NotificationPayload & { id: string; ts: number };

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

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

  /* 🔔 Clear Notifications Listener */
  useEffect(() => {
    const handler = (payload: any) => {
      if (payload?.action === 'clear-notifications' && payload?.data) {
        const { chatId, chatType } = payload.data;
        setActivities((prev) => {
          const filtered = prev.filter(item => {
            if (chatType === 'dm' && item.type === 'private') {
              return item.from !== chatId;
            } else if (chatType === 'group' && item.type === 'group') {
              return item.groupId !== chatId;
            }
            return true;
          });
          const removedCount = prev.length - filtered.length;
          if (removedCount > 0) {
            setUnread((u) => Math.max(0, u - removedCount));
          }
          return filtered;
        });
      }
    };
    const offAction = onAction(handler);
    return offAction;
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
    <div className="h-screen overflow-hidden">
      {/* LEFT SIDEBAR */}
      <div className="w-[75px] h-full bg-gradient-to-b from-[#4A154B] via-[#5B1A5C] to-[#4A154B] flex flex-col items-center py-4 text-white shadow-2xl border-r border-purple-500/20">

        {/* Logo */}
        <div
          onClick={() => navigate("/dashboard")}
          className="w-14 h-14 bg-gradient-to-br from-white to-gray-100 rounded-xl flex items-center justify-center mb-8 cursor-pointer shadow-lg hover:scale-105 transition-transform"
        >
          <span className="text-[#4A154B] font-bold text-2xl">SV</span>
        </div>

        {/* NAVIGATION */}
        <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

          <IconButton
            icon={<Home size={22} />}
            label="Home"
            active={location.pathname.includes('/dashboard')}
            onClick={() => navigate("/dashboard")}
          />

          <IconButton
            icon={<MessageSquare size={22} />}
            label="DMs"
            active={location.pathname.includes('/dm')}
            onClick={() => navigate("/dm/id")}
          />

          {/* ✅ ADMIN ONLY BUTTON */}
          {isAdmin && (
            <IconButton
              icon={<Plus size={22} />}
              label="Add Workspace"
              active={location.pathname.includes('/workspace')}
              onClick={() => navigate("/workspace")}
            />
          )}

          {/* Activity */}
          <div className="relative w-full">
            <button
              onClick={openActivity}
              className="flex flex-col items-center justify-center w-full py-2 px-3 text-gray-300 hover:bg-purple-900/30 transition-colors rounded-lg"
            >
              <div className="w-6 h-6 flex items-center justify-center mb-1">
                <Bell size={22} />
              </div>
              <span className="text-xs font-medium">Activity</span>
            </button>

            {unread > 0 && (
              <span className="absolute top-1 right-3 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white shadow-lg animate-pulse">
                {unread > 9 ? "9+" : unread}
              </span>
            )}

            {/* Activity modal (centered) */}
            {activityOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setActivityOpen(false)} />
                <div className="relative w-[580px] max-h-[75vh] bg-gradient-to-br from-[#1a1d21]/95 via-[#0f1115]/98 to-[#1a1d21]/95 backdrop-blur-xl border border-purple-500/40 rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
                  {/* Header */}
                  <div className="flex items-center justify-between p-5 border-b border-purple-500/30 bg-gradient-to-r from-purple-600/20 to-pink-600/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Bell className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Activity Center</h3>
                        <p className="text-xs text-purple-300">{activities.length} notification{activities.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {activities.length > 0 && (
                        <button onClick={clearAll} className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-white transition-all hover:scale-105 shadow-lg text-sm font-medium">
                          <Trash2 size={14} />
                          Clear All
                        </button>
                      )}
                      <button onClick={() => setActivityOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all hover:scale-105">
                        <X size={18} className="text-white" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="overflow-y-auto max-h-[calc(75vh-80px)]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9333ea #1a1d21' }}>
                    {activities.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="w-20 h-20 mx-auto mb-4 bg-purple-500/10 rounded-full flex items-center justify-center">
                          <Sparkles className="w-10 h-10 text-purple-400" />
                        </div>
                        <p className="text-gray-400 text-sm font-medium">No notifications yet</p>
                        <p className="text-gray-500 text-xs mt-2">You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="p-3 space-y-2">
                        {activities.map((it) => (
                          <div 
                            key={it.id} 
                            onClick={() => handleClickActivity(it)} 
                            className="group flex items-start gap-4 p-4 hover:bg-purple-600/15 cursor-pointer border border-transparent hover:border-purple-500/30 rounded-xl transition-all duration-200 hover:scale-[1.02] bg-[#0a0b0d]/30"
                          >
                            <div className="relative flex-shrink-0">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform">
                                {it.type === 'private' ? <User size={20} /> : it.type === 'group' ? <Hash size={20} /> : <Bell size={20} />}
                              </div>
                              {it.file?.filename && (
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-pink-600 rounded-full flex items-center justify-center shadow-lg">
                                  <Paperclip size={12} className="text-white" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors">
                                  {it.title || (it.type === 'private' ? 'Direct message' : 'Channel message')}
                                </div>
                                <div className="text-[10px] text-gray-500 whitespace-nowrap">
                                  {(() => {
                                    const now = Date.now();
                                    const diff = now - (it.ts || now);
                                    const mins = Math.floor(diff / 60000);
                                    const hrs = Math.floor(diff / 3600000);
                                    if (mins < 1) return 'Just now';
                                    if (mins < 60) return `${mins}m ago`;
                                    if (hrs < 24) return `${hrs}h ago`;
                                    return new Date(it.ts || now).toLocaleDateString();
                                  })()}
                                </div>
                              </div>
                              <div className="text-xs text-gray-400 mt-1.5 line-clamp-2">
                                {it.file?.filename ? (
                                  <span className="flex items-center gap-1.5">
                                    <Paperclip size={12} className="text-purple-400" />
                                    <span className="font-medium text-purple-300">{it.file.filename}</span>
                                  </span>
                                ) : (
                                  (it.message || 'New notification').replace(/<[^>]*>/g, '')
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  it.type === 'private' 
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                }`}>
                                  {it.type === 'private' ? 'Direct Message' : 'Channel Message'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* <IconButton
            icon={<MoreHorizontal size={22} />}
            label="More"
          /> */}
        </div>

        {/* PROFILE - Fixed at bottom */}
        <div className="w-full pt-4 border-t border-purple-500/30">
          <div className="text-center cursor-pointer px-2" onClick={() => { setViewingUser(null); setProfileOpen(true); }}>
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" className="w-14 h-14 rounded-full object-cover hover:ring-2 hover:ring-purple-400 transition-all mx-auto shadow-lg" />
            ) : (
              <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center hover:ring-2 hover:ring-purple-400 transition-all mx-auto shadow-lg">
                <span className="text-white font-bold text-xl">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
            )}
            <div className="text-[10px] mt-2 text-gray-300 font-medium truncate">{user?.name || "User"}</div>
          </div>
        </div>

      </div>

      {/* Profile Session */}
      <ProfileSession isOpen={profileOpen} onClose={() => { setProfileOpen(false); setViewingUser(null); }} user={viewingUser || user} isOwnProfile={!viewingUser} />
    </div>
  );
};

export default Sidebar;
