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
import GroupProfileSession from "./GroupProfileSession";
import { API_URL} from "@/lib/config";
import { imgUrl } from "@/lib/utils";

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
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [groupProfileOpen, setGroupProfileOpen] = useState(false);
  const [viewingGroupId, setViewingGroupId] = useState<string | null>(null);

  /* 🔥 Load User */
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      setUser(JSON.parse(raw));
    }
  }, []);

  /* 🔥 Listen for user updates (avatar, profile changes) */
  useEffect(() => {
    const handleUserUpdate = (event: any) => {
      if (event.detail) {
        setUser(event.detail);
      }
    };
    window.addEventListener('user-updated', handleUserUpdate);
    return () => window.removeEventListener('user-updated', handleUserUpdate);
  }, []);

  /* 🔐 Role Check */
  const roleStr = (user?.role || user?.Role || "").toLowerCase();
  const isAdmin = roleStr === "admin";

  /* � Notification Listener */
  useEffect(() => {
    const off = onNotification((payload: NotificationPayload) => {
      const item: ActivityItem = { id: `${Date.now()}-${Math.random()}`, ts: Date.now(), ...payload };
      setActivities((prev) => {
        // Check for duplicates
        const isDuplicate = prev.some(existing => {
          if (item.type === 'private' && existing.type === 'private') {
            return existing.from === item.from && existing.message === item.message;
          } else if (item.type === 'group' && existing.type === 'group') {
            return existing.groupId === item.groupId && existing.message === item.message;
          }
          return false;
        });
        if (isDuplicate) return prev;
        return [item, ...prev];
      });
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
    // Show profile when clicking on notification avatar
    // Don't navigate, just show profile modal
  };

  const handleAvatarClick = (e: React.MouseEvent, it: ActivityItem) => {
    e.stopPropagation();
    if (it.type === 'private' && it.from) {
      // Fetch and show user profile
      const token = localStorage.getItem('token');
      fetch(`${API_URL}/api/user/${it.from}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          setViewingUser(data.user);
          setProfileOpen(true);
        })
        .catch(() => {});
    } else if (it.type === 'group' && it.groupId) {
      // Show group profile
      setViewingGroupId(it.groupId);
      setGroupProfileOpen(true);
    }
  };
// console.log("API_URL:", API_URL);
// console.log("ENV:", import.meta.env);
// console.log("API_URL:", API_URL);
  const handleNotificationClick = (it: ActivityItem) => {
    // open chat inside Dashboard by emitting an action that Dashboard listens to
    if (it.type === "private" && it.from) {
      const ac = { type: 'dm', id: it.from, name: it.fromName || it.title || '' };
      try { localStorage.setItem('activeChat', JSON.stringify(ac)); } catch (e) {}
      emitAction({ action: 'open-chat', data: ac });
      navigate('/dashboard');
    } else if (it.type === "group" && it.groupId) {
      const ac = { type: 'group', id: it.groupId, name: it.groupName || it.title || '' };
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
    <div className="h-screen overflow-hidden ">
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
            onClick={() => navigate("/dm")}
          />

          {/* ✅ ADMIN ONLY BUTTON
          {isAdmin && (
            <IconButton
              icon={<Plus size={22} />}
              label="Add Workspace"
              active={location.pathname.includes('/workspace')}
              onClick={() => navigate("/workspace")}
            />
          )} */}

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

            {/* Activity Panel - right side slide-in like ProfileSession */}
            {activityOpen && (
              <>
                <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setActivityOpen(false)} />
                <div className="fixed top-0 right-0 h-full w-[380px] z-50 flex flex-col" style={{background:'#1a1d21', borderLeft:'1px solid rgba(255,255,255,0.1)'}}>
                  
                  {/* Header */}
                  <div className="flex-shrink-0 flex items-center justify-between px-6 py-5" style={{borderBottom:'1px solid rgba(255,255,255,0.1)', background:'rgba(147,51,234,0.08)'}}>
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-purple-400" />
                      <div>
                        <h3 className="text-base font-bold text-white">Activity</h3>
                        <p className="text-xs text-gray-400">{activities.length} notification{activities.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activities.length > 0 && (
                        <button onClick={clearAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-xs font-medium transition">
                          <Trash2 size={13} /> Clear All
                        </button>
                      )}
                      <button onClick={() => setActivityOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white">
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto px-4 py-4" style={{scrollbarWidth:'thin', scrollbarColor:'#522653 #1a1d21'}}>
                    {activities.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-16">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{background:'rgba(147,51,234,0.1)'}}>
                          <Bell className="w-8 h-8 text-purple-400" />
                        </div>
                        <p className="text-gray-300 font-medium">No notifications yet</p>
                        <p className="text-gray-500 text-sm mt-1">You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {activities.map((it) => (
                          <div
                            key={it.id}
                            onClick={() => handleNotificationClick(it)}
                            className="flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer hover:bg-white/5 transition group"
                          >
                            {/* Avatar */}
                            <div className="relative flex-shrink-0" onClick={(e) => handleAvatarClick(e, it)}>
                              <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-bold" style={{background:'#522653'}}>
                                {it.type === 'private' ? (
                                  it.fromAvatar ? <img src={imgUrl(it.fromAvatar)} alt="" className="w-full h-full object-cover" /> : <User size={18} />
                                ) : it.type === 'group' ? (
                                  it.groupPicture ? <img src={imgUrl(it.groupPicture)} alt="" className="w-full h-full object-cover" /> : <Hash size={18} />
                                ) : <Bell size={18} />}
                              </div>
                              {it.file?.filename && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-pink-600 rounded-full flex items-center justify-center">
                                  <Paperclip size={10} className="text-white" />
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-semibold text-white truncate">
                                  {it.type === 'private' ? (it.fromName || 'Direct message') : (it.groupName || 'Channel')}
                                </span>
                                <span className="text-[10px] text-gray-500 whitespace-nowrap flex-shrink-0">
                                  {(() => { const diff = Date.now()-(it.ts||Date.now()); const m=Math.floor(diff/60000); const h=Math.floor(diff/3600000); if(m<1)return'Just now'; if(m<60)return`${m}m`; if(h<24)return`${h}h`; return new Date(it.ts||Date.now()).toLocaleDateString(); })()}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                                {it.file?.filename ? (
                                  <span className="flex items-center gap-1 text-purple-300"><Paperclip size={11} />{it.file.filename}</span>
                                ) : (it.message||'New notification').replace(/<[^>]*>/g,'')}
                              </p>
                              <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full ${
                                it.type==='private' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                              }`}>
                                {it.type==='private' ? 'DM' : 'Channel'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* <IconButton
            icon={<MoreHorizontal size={22} />}
            label="More"
          /> */}
        </div>

        {/* PLUS MENU - Admin only, above profile */}
        {isAdmin && (
          <div className="w-full px-3 pb-2 relative">
            <button
              onClick={() => setShowPlusMenu(s => !s)}
              className={`w-full flex items-center justify-center py-2.5 rounded-xl transition-all duration-200 ${
                showPlusMenu
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                  : 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 hover:text-white border border-purple-500/30 hover:border-purple-500/60'
              }`}
              title="Admin Actions"
            >
              <Plus size={18} className={`transition-transform duration-200 ${showPlusMenu ? 'rotate-45' : ''}`} />
            </button>
            {showPlusMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowPlusMenu(false)} />
                <div className="fixed bottom-20 left-20 w-56 z-30 rounded-xl overflow-hidden shadow-2xl" style={{background:'#1e1f24', border:'1px solid rgba(147,51,234,0.3)'}}>
                  <div className="px-3 py-2 border-b" style={{borderColor:'rgba(255,255,255,0.06)'}}>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Admin Actions</p>
                  </div>
                  <button
                    onClick={() => { navigate('/admin'); setShowPlusMenu(false); }}
                    className="w-full text-left px-3 py-3 hover:bg-purple-600/15 text-white text-sm transition-colors flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'rgba(147,51,234,0.2)'}}>
                      <User size={15} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-white">Invite Member</p>
                      <p className="text-[11px] text-gray-500">Add people to workspace</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { navigate('/create-channel'); setShowPlusMenu(false); }}
                    className="w-full text-left px-3 py-3 hover:bg-purple-600/15 text-white text-sm transition-colors flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'rgba(147,51,234,0.2)'}}>
                      <Hash size={15} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-white">Create Channel</p>
                      <p className="text-[11px] text-gray-500">New channel for your team</p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* PROFILE - Fixed at bottom */}
        <div className="w-full pt-4 border-t border-purple-500/30">
          <div className="text-center cursor-pointer px-2" onClick={() => {
            const raw = localStorage.getItem('user');
            const u = raw ? JSON.parse(raw) : user;
            setViewingUser(u);
            setProfileOpen(true);
          }}>
            {user?.avatar ? (
              <img src={imgUrl(user.avatar)} alt="Profile" className="w-14 h-14 rounded-full object-cover hover:ring-2 hover:ring-purple-400 transition-all mx-auto shadow-lg" />
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
      <ProfileSession isOpen={profileOpen} onClose={() => { setProfileOpen(false); setViewingUser(null); }} user={viewingUser} isOwnProfile={!viewingUser || viewingUser?._id === user?._id || viewingUser?.id === user?.id} />
      <GroupProfileSession isOpen={groupProfileOpen} onClose={() => { setGroupProfileOpen(false); setViewingGroupId(null); }} groupId={viewingGroupId} />
    </div>
  );
};

export default Sidebar;
