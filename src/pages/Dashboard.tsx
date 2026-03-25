import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import AppLayout from "@/components/layout/AppLayout";
import { ChevronRight, ChevronDown, Hash, Send, Plus, X, MessageSquare, Sparkles } from "lucide-react";
import { emitNotification, onAction, clearNotifications } from "@/lib/notificationBus";
import { useToast } from "@/components/ui/toast";
import { hideUrls, imgUrl } from '@/lib/utils'
import UserAvatar from "@/components/common/UserAvatar";
import ProfileSession from "@/components/layout/ProfileSession";
import GroupProfileSession from "@/components/layout/GroupProfileSession";
import ForwardSession from "@/components/layout/ForwardSession";
import RichTextEditor from "@/components/common/RichTextEditor";
import { SOCKET_URL, API_URL } from "@/lib/config";


interface IUser {
  _id?: string;
  id?: string;
  name?: string;
  role?: string;
  Role?: string;
  avatar?: string;
}

interface IMessage {
  id?: string;
  from: string;
  fromName?: string;
  content?: string;
  edited?: boolean;
  createdAt?: string;
  group?: string;
  isSystemMessage?: boolean;
  systemMessageType?: 'group-name-updated' | 'group-picture-updated' | 'member-removed';
  file?: {
    url: string;
    filename?: string;
    mimetype?: string;
    size?: number;
    thumbnail?: string;
  };
}

interface IChannel {
  _id: string;
  name: string;
  image?: { url: string; filename: string };
  members?: IUser[];
}



const Dashboard = () => {
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [user, setUser] = useState<IUser | null>(null);
  const [dmUsers, setDmUsers] = useState<IUser[]>([]);
  const [dmPreviews, setDmPreviews] = useState<Record<string, IMessage>>({});
  const [channels, setChannels] = useState<IChannel[]>([]);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [text, setText] = useState("");
  const [editorHtml, setEditorHtml] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);
  const [showChannels, setShowChannels] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // helper to format preview dates
  const formatDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // format message timestamp - show date+time if older than 24h
  const formatMsgTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (diffMs < 24 * 60 * 60 * 1000) return time;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return `Yesterday ${time}`;
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
  };
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [groupProfileOpen, setGroupProfileOpen] = useState(false);
  const [viewingGroupId, setViewingGroupId] = useState<string | undefined>(undefined);
  const [downloadingFiles, setDownloadingFiles] = useState<Record<string, AbortController>>({});
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [removedFromGroups, setRemovedFromGroups] = useState<Set<string>>(new Set());
  const [shownNotifications, setShownNotifications] = useState<Set<string>>(new Set());
  const [workspaceDeleted, setWorkspaceDeleted] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardContent, setForwardContent] = useState("");
  const [forwardSenderName, setForwardSenderName] = useState("");
  const [forwardFile, setForwardFile] = useState<{ url: string; filename?: string; mimetype?: string; size?: number } | null>(null);

  // load last-message preview for each DM when users list changes
  useEffect(() => {
    if (dmUsers.length === 0) return;
    const token = localStorage.getItem('token');
    const rawWs = localStorage.getItem('currentWorkspace');
    const currentWs = rawWs ? JSON.parse(rawWs) : null;
    const wsParam = currentWs?.id ? `?workspaceId=${currentWs.id}` : '';

    dmUsers.forEach((u) => {
      if (!(u._id || u.id)) return;
      let url = `${SOCKET_URL}/api/message/${u._id || u.id}`;
      const params: string[] = [];
      if (wsParam) params.push(wsParam.replace('?', ''));
      params.push('limit=1');
      if (params.length) url += `?${params.join('&')}`;

      fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          const msgs: IMessage[] = Array.isArray(d?.messages) ? d.messages : [];
          if (msgs.length) {
            const last = msgs[msgs.length - 1];
            setDmPreviews((prev) => ({ ...prev, [u._id || u.id!]: last }));
          }
        })
        .catch(() => {});
    });
  }, [dmUsers]);
  const [deletedWorkspaceName, setDeletedWorkspaceName] = useState<string>('');

  // context / edit state for messages
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string | null } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { show } = useToast();

  const [activeChat, setActiveChat] = useState<{
    type: "dm" | "group";
    id: string;
    name: string;
  } | null>(null);

  // restore active chat after reload - but clear it when workspace changes
  useEffect(() => {
    const rawWorkspace = localStorage.getItem("currentWorkspace");
    const currentWs = rawWorkspace ? JSON.parse(rawWorkspace) : null;
    const lastWsId = localStorage.getItem("lastWorkspaceId");
    
    // If workspace changed, clear active chat
    if (currentWs?.id && lastWsId && currentWs.id !== lastWsId) {
      setActiveChat(null);
      localStorage.removeItem('activeChat');
    }
    
    if (currentWs?.id) {
      localStorage.setItem("lastWorkspaceId", currentWs.id);
    }
  }, [])

  const myId = useMemo(() => user?._id || user?.id || "", [user]);

  /* ================= INIT ================= */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    let rawWorkspace = localStorage.getItem("currentWorkspace");
    const lastWorkspaceId = localStorage.getItem("lastSelectedWorkspaceId");

    if (!storedUser || !token) {
      navigate("/login");
      return;
    }

    const parsed = JSON.parse(storedUser);
    setUser(parsed);
    // DEBUG: verify avatar URL being loaded
    console.log('Loaded user:', { id: parsed._id || parsed.id, avatar: parsed.avatar });

    // If NO currentWorkspace but lastWorkspaceId exists, restore it immediately
    if (!rawWorkspace && lastWorkspaceId) {
      try {
        const tempWs = JSON.stringify({ id: lastWorkspaceId });
        localStorage.setItem('currentWorkspace', tempWs);
        rawWorkspace = tempWs;
      } catch (e) {
        console.error('Failed to restore last workspace', e);
      }
    }

    const currentWs = rawWorkspace ? JSON.parse(rawWorkspace) : null;

    const loadWorkspace = async (workspaceId: string) => {
      try {
        const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();

        if (!d?.success) {
          setWorkspaceDeleted(true);
          setDeletedWorkspaceName(currentWs?.name || 'Workspace');
          // Clear invalid workspace and redirect to selection
          localStorage.removeItem('currentWorkspace');
          localStorage.removeItem('lastSelectedWorkspaceId');
          navigate('/workspace');
          return;
        }

        const workspace = d.workspace;
        const myUserId = parsed._id || parsed.id;

        // Update currentWorkspace with full details
        try {
          localStorage.setItem(
            'currentWorkspace',
            JSON.stringify({
              id: workspace._id,
              name: workspace.name,
              image: workspace.image,
              members: workspace.members || [],
            })
          );
          // Save as last selected workspace
          localStorage.setItem('lastSelectedWorkspaceId', workspace._id);
        } catch (e) {}

        setDmUsers(
          workspace.members.filter(
            (u: IUser) => (u._id || u.id) !== myUserId
          )
        );

        setChannels(workspace.channels || []);
        
        // Emit event to notify Header of workspace change
        try {
          window.dispatchEvent(new Event('workspace-changed'));
        } catch (e) {}
      } catch (err) {
        console.error('Failed to load workspace:', err);
        setWorkspaceDeleted(true);
        setDeletedWorkspaceName(currentWs?.name || 'Workspace');
        localStorage.removeItem('currentWorkspace');
        localStorage.removeItem('lastSelectedWorkspaceId');
        navigate('/workspace');
      }
    };

    // If workspace is selected, load it
    if (currentWs?.id) {
      loadWorkspace(currentWs.id);
      return;
    }

    // If no workspace selected and no last workspace, fetch available workspaces
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/workspaces`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const workspaces = data.workspaces || [];

        // If single workspace, auto-select it
        if (workspaces.length === 1) {
          const ws = workspaces[0];
          try {
            localStorage.setItem(
              'currentWorkspace',
              JSON.stringify({
                id: ws._id,
                name: ws.name,
                image: ws.image,
                members: ws.members || [],
              })
            );
            localStorage.setItem('lastSelectedWorkspaceId', ws._id);
          } catch (e) {}
          await loadWorkspace(ws._id);
          return;
        }
      } catch (e) {
        console.error('Failed to fetch workspaces:', e);
      }

      // No workspace to auto-select, show workspace selection page
      navigate("/workspace");
    })();

  }, [navigate]);

  /* ================= LISTEN FOR WORKSPACE CHANGES ================= */
  useEffect(() => {
    const handleWorkspaceChange = () => {
      const token = localStorage.getItem('token');
      const rawWorkspace = localStorage.getItem('currentWorkspace');
      const currentWs = rawWorkspace ? JSON.parse(rawWorkspace) : null;
      if (!token || !currentWs?.id) return;

      // Reset state
      setMessages([]);
      setActiveChat(null);
      setChannels([]);
      setDmUsers([]);
      setDmPreviews({});
      setUnreadCounts({});
      localStorage.removeItem('activeChat');

      // Reload workspace data
      fetch(`${API_URL}/api/workspaces/${currentWs.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => {
          if (!d?.success) { navigate('/workspace'); return; }
          const workspace = d.workspace;
          const myUserId = user?._id || user?.id;
          try {
            localStorage.setItem('currentWorkspace', JSON.stringify({ id: workspace._id, name: workspace.name, image: workspace.image, members: workspace.members || [] }));
            localStorage.setItem('lastSelectedWorkspaceId', workspace._id);
          } catch (e) {}
          setDmUsers(workspace.members.filter((u: IUser) => (u._id || u.id) !== myUserId));
          setChannels(workspace.channels || []);
        })
        .catch(() => navigate('/workspace'));
    };

    window.addEventListener('workspace-changed', handleWorkspaceChange);
    return () => window.removeEventListener('workspace-changed', handleWorkspaceChange);
  }, [user, navigate]);

  /* ================= LISTEN FOR USER UPDATES ================= */
  useEffect(() => {
    const handleUserUpdate = (event: any) => {
      if (event.detail) {
        setUser(event.detail);
      }
    };
    window.addEventListener('user-updated', handleUserUpdate);
    return () => window.removeEventListener('user-updated', handleUserUpdate);
  }, []);

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

    // Fetch stored notifications only after socket connects
    socket.on('connect', () => {
      const rawWorkspace = localStorage.getItem("currentWorkspace");
      const currentWs = rawWorkspace ? JSON.parse(rawWorkspace) : null;
      if (!currentWs?.id) return;
      
      const lastChecked = localStorage.getItem("lastCheckedWorkspace");
      const lastWs = lastChecked ? JSON.parse(lastChecked) : null;
      
      // Only fetch notifications if workspace changed
      if (!lastWs || String(lastWs.id) !== String(currentWs.id)) {
        localStorage.setItem("lastCheckedWorkspace", JSON.stringify(currentWs));
        
        fetch(`${SOCKET_URL}/api/notifications?workspaceId=${currentWs.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(r => r.json())
          .then(data => {
            if (data.success && data.notifications && data.notifications.length > 0) {
              data.notifications.forEach((notif: any) => {
                try {
                  const notifKey = `${notif.type}-${notif.groupId || notif.from?._id}-${notif.message}`;
                  setShownNotifications(prev => {
                    if (prev.has(notifKey)) return prev;
                    const newSet = new Set(prev);
                    newSet.add(notifKey);
                    emitNotification({
                      type: notif.type,
                      from: notif.from?._id,
                      fromName: notif.fromName || notif.from?.name,
                      fromAvatar: notif.fromAvatar || notif.from?.avatar,
                      groupId: notif.groupId,
                      groupName: notif.groupName,
                      groupPicture: notif.groupPicture,
                      title: notif.title,
                      message: notif.message
                    });
                    return newSet;
                  });
                } catch (e) {}
              });
              const ids = data.notifications.map((n: any) => n._id);
              fetch(`${SOCKET_URL}/api/notifications/mark-read`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationIds: ids })
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }
    });

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
            fromName: msg.fromName,
            fromAvatar: dmUsers.find(u => (u._id || u.id) === msg.from)?.avatar,
            title: msg.fromName ? `DM from ${msg.fromName}` : "New DM",
            message: msg.content,
            file: msg.file
          });
        } catch (e) {}
      }
    });

    socket.on("group message", (msg: IMessage) => {
      // Block all messages from groups user was removed from
      if (msg.group && removedFromGroups.has(msg.group)) return;
      
      // Only show notifications for current workspace groups
      const rawWs = localStorage.getItem('currentWorkspace');
      const currentWs = rawWs ? JSON.parse(rawWs) : null;
      const isCurrentWorkspaceGroup = channels.some(c => c._id === msg.group);
      if (!isCurrentWorkspaceGroup) return;
      
      if (activeChat?.type === "group" && msg.group === activeChat.id) {
        // Add system messages or messages from others
        if (msg.isSystemMessage || msg.from !== myId) {
          setMessages((prev) => [...prev, msg]);
        }
      } else if (msg.group && msg.from !== myId) {
        const groupId = msg.group;
        setUnreadCounts((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] || 0) + 1,
        }));
        try {
          const channel = channels.find(c => c._id === msg.group);
          emitNotification({
            type: "group",
            groupId: msg.group,
            groupName: channel?.name || 'Group',
            groupPicture: channel?.image?.url,
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
    socket.on('role-updated', ({ userId, newRole }) => {
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const u = JSON.parse(stored);
          if (String(u._id || u.id) === String(userId)) {
            localStorage.setItem('user', JSON.stringify({ ...u, Role: newRole }));
            window.dispatchEvent(new Event('user-updated'));
          }
        }
      } catch (e) {}
    });

    socket.on('new-notification', (notification: any) => {
      try {
        emitNotification({
          type: notification.type || 'system',
          title: notification.title || 'Notification',
          message: notification.message || '',
          duration: 5000
        });
      } catch (e) {
        console.error('notification emit error', e);
      }
    });

    socket.on('group-added-notification', (data: any) => {
      const notifKey = `group-${data.groupId}-${data.message}`;
      setShownNotifications(prev => {
        if (prev.has(notifKey)) return prev;
        const newSet = new Set(prev);
        newSet.add(notifKey);
        
        const rawWs = localStorage.getItem('currentWorkspace');
        const currentWs = rawWs ? JSON.parse(rawWs) : null;
        const token = localStorage.getItem('token');
        
        if (token && data.groupId) {
          fetch(`${SOCKET_URL}/api/group/${data.groupId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(r => r.json())
            .then(res => {
              if (res.success && res.group) {
                const groupWorkspaceId = res.group.workspace;
                if (currentWs?.id && String(groupWorkspaceId) === String(currentWs.id)) {
                  try {
                    emitNotification({
                      type: 'group',
                      groupId: data.groupId,
                      groupName: data.groupName,
                      groupPicture: res.group.image?.url,
                      title: data.groupName,
                      message: data.message
                    });
                  } catch (e) {}
                }
              }
            })
            .catch(() => {});
        }
        return newSet;
      });
    });

    socket.on('group-name-updated', (data: any) => {
      setChannels(prev => prev.map(c => c._id === data.groupId ? { ...c, name: data.name } : c));
      if (activeChat?.type === 'group' && activeChat.id === data.groupId) {
        setActiveChat(prev => prev ? { ...prev, name: data.name } : null);
      }
    });

    socket.on('member-removed-notification', (data: any) => {
      const notifKey = `group-${data.groupId}-${data.message}`;
      setShownNotifications(prev => {
        if (prev.has(notifKey)) return prev;
        const newSet = new Set(prev);
        newSet.add(notifKey);
        
        const isCurrentWorkspaceGroup = channels.some(c => c._id === data.groupId);
        
        if (isCurrentWorkspaceGroup) {
          try {
            emitNotification({
              type: 'group',
              groupId: data.groupId,
              groupName: data.groupName,
              groupPicture: channels.find(c => c._id === data.groupId)?.image?.url,
              title: data.groupName,
              message: data.message
            });
            setRemovedFromGroups(prevRemoved => new Set(prevRemoved).add(data.groupId));
            setChannels(prevChannels => prevChannels.filter(c => c._id !== data.groupId));
          } catch (e) {}
        }
        return newSet;
      });
    });

    socket.on('channel-deleted-notification', (data: any) => {
      const notifKey = `channel-deleted-${data.groupId}-${data.message}`;
      setShownNotifications(prev => {
        if (prev.has(notifKey)) return prev;
        const newSet = new Set(prev);
        newSet.add(notifKey);
        
        const isCurrentWorkspaceGroup = channels.some(c => c._id === data.groupId);
        
        if (isCurrentWorkspaceGroup) {
          try {
            emitNotification({
              type: 'group',
              groupId: data.groupId,
              groupName: data.groupName,
              groupPicture: channels.find(c => c._id === data.groupId)?.image?.url,
              title: data.groupName,
              message: data.message
            });
            setChannels(prevChannels => prevChannels.filter(c => c._id !== data.groupId));
            if (activeChat?.id === data.groupId) {
              setActiveChat(null);
            }
          } catch (e) {}
        }
        return newSet;
      });
    });

    socket.on('channel-deleted', (data: any) => {
      setChannels(prevChannels => prevChannels.filter(c => c._id !== data.groupId));
      if (activeChat?.id === data.groupId) {
        setActiveChat(null);
      }
    });

    return () => { 
      socket.disconnect();
    };
  }, [myId, activeChat, removedFromGroups]);

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

    // Clear notifications for this chat
    clearNotifications(activeChat.id, activeChat.type);

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
      } else if (payload?.action === 'group-updated' && payload?.data) {
        const { groupId, name, image } = payload.data;
        setChannels((prev) => prev.map(c => c._id === groupId ? { ...c, name, image } : c));
        if (activeChat?.id === groupId) {
          setActiveChat((prev) => prev ? { ...prev, name } : null);
        }
      } else if (payload?.action === 'open-profile' && payload?.data?.user) {
        setGroupProfileOpen(false);
        setViewingGroupId(undefined);
        setViewingUser(payload.data.user);
        setProfileOpen(true);
      }
    });
    return off;
  }, [activeChat]);

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
    
    // Block sending if removed from group
    if (activeChat.type === 'group' && removedFromGroups.has(activeChat.id)) {
      show('You cannot send messages. Admin removed you from this group.', 'error');
      return;
    }
    
    const plainText = editorHtml.replace(/<[^>]*>/g, '').trim();
    if (!plainText && files.length === 0) return;

    if (files.length > 0) {
      const controller = new AbortController();
      setUploadAbortController(controller);
      setUploadingFiles(true);
      let uploadError: string | null = null;

      try {
        for (const f of files) {
          if (controller.signal.aborted) break;
          try {
            await uploadFile(f, controller.signal);
          } catch (e: any) {
            uploadError = e?.message || 'Upload failed';
            break;
          }
        }

        if (uploadError) {
          show(uploadError, 'error');
        } else if (!controller.signal.aborted) {
          show('Files sent successfully', 'success');
        }
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
      if (activeChat.type === "dm") {
        const rawWs = localStorage.getItem('currentWorkspace');
        const currentWs = rawWs ? JSON.parse(rawWs) : null;
        socketRef.current.emit("private message", {
          to: activeChat.id,
          content: editorHtml,
          workspaceId: currentWs?.id || null
        });
      } else {
        socketRef.current.emit("group message", {
          group: activeChat.id,
          content: editorHtml,
        });
      }

      setMessages((prev) => [
        ...prev,
        {
          from: myId,
          fromName: user?.name,
          content: editorHtml,
          createdAt: new Date().toISOString(),
        },
      ]);

      setEditorHtml("");
      setText("");
      setContextMenu(null);
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
    } catch (e) {
      show('Delete failed', 'error');
    }
  };

  /* ================= FILE UPLOAD ================= */
  const uploadFile = async (f: File, signal?: AbortSignal) => {
    if (!activeChat) throw new Error('No chat selected');
    
    // Block file upload if removed from group
    if (activeChat.type === 'group' && removedFromGroups.has(activeChat.id)) {
      throw new Error('You cannot send files. Admin removed you from this group.');
    }

    const token = localStorage.getItem("token");
    if (!token) throw new Error('Unauthorized');

    if (f.size > 100 * 1024 * 1024) {
      throw new Error('Max file size 100MB');
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
      signal,
    });

    const contentType = res.headers.get('content-type') || '';
    let data: any;

    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = { msg: await res.text() };
    }

    if (!res.ok) {
      const msg = data?.msg || data?.message || 'Upload failed';
      throw new Error(msg);
    }

    const msg = data?.message;
    if (msg) {
      setMessages((prev) => [...prev, msg]);
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

  const roleStr = (user?.role || user?.Role || "").toLowerCase();
  const isAdmin = roleStr === "admin";

  const handleDeleteWorkspace = async () => {
    const rawWorkspace = localStorage.getItem("currentWorkspace");
    const currentWs = rawWorkspace ? JSON.parse(rawWorkspace) : null;
    if (!currentWs?.id) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`${SOCKET_URL}/api/workspaces/${currentWs.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        show('Workspace deleted successfully', 'success');
        localStorage.removeItem('currentWorkspace');
        navigate('/workspace');
      } else {
        show(data.msg || 'Failed to delete workspace', 'error');
      }
    } catch (e) {
      show('Failed to delete workspace', 'error');
    }
  };

  if (workspaceDeleted) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#0a0b0d] via-[#1a1d21] to-[#0f1115]">
          <div className="text-center p-8 bg-gradient-to-br from-[#1a1d21]/95 to-[#0f1115]/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-2xl max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
              <X size={40} className="text-red-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">No Longer Available</h1>
            <p className="text-gray-400 mb-6">
              The workspace <span className="text-purple-400 font-semibold">&quot;{deletedWorkspaceName}&quot;</span> has been deleted.
            </p>
            {isAdmin ? (
              <button
                onClick={handleDeleteWorkspace}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold transition-all hover:scale-105 shadow-lg"
              >
                Delete Workspace
              </button>
            ) : (
              <button
                onClick={() => navigate('/workspace')}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold transition-all hover:scale-105 shadow-lg"
              >
                Go to Workspaces
              </button>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center" onClick={() => setFullscreenImage(null)}>
          <button onClick={() => setFullscreenImage(null)} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white z-[101]"><X size={20} /></button>
          <img src={imgUrl(fullscreenImage)} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <div className="flex h-full overflow-hidden text-white" style={{background:'#1a1d21'}}>

        {/* ── SIDEBAR ── */}
        <aside className="w-[260px] flex-shrink-0 flex flex-col h-full overflow-hidden" style={{background:'#19171d', borderRight:'1px solid rgba(255,255,255,0.08)'}}>

          {/* Sidebar header */}
          <div className="flex-shrink-0 px-3 pt-3 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-2 mb-1">Conversations</p>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-1" style={{scrollbarWidth:'none'}}>

            {/* Channels */}
            <div
              onClick={() => setShowChannels(!showChannels)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-white/5 group mb-0.5"
            >
              {showChannels
                ? <ChevronDown size={14} className="text-gray-400" />
                : <ChevronRight size={14} className="text-gray-400" />}
              <span className="text-sm font-semibold text-gray-300 group-hover:text-white">Channels</span>
              <span className="ml-auto text-[11px] text-gray-500">{channels.length}</span>
            </div>

            {showChannels && (
              <div className="mb-2">
                {channels.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => { const ac={type:'group' as const,id:c._id,name:c.name}; setActiveChat(ac); setRemovedFromGroups(p=>{const s=new Set(p);s.delete(c._id);return s;}); try{localStorage.setItem('activeChat',JSON.stringify(ac))}catch(e){} }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors group ${
                      activeChat?.id===c._id ? 'bg-[#522653] text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {c.image?.url
                      ? <img src={imgUrl(c.image.url)} alt={c.name} className="w-5 h-5 rounded object-cover flex-shrink-0" onClick={(e)=>{e.stopPropagation();setViewingGroupId(c._id);setGroupProfileOpen(true);}} />
                      : <Hash size={16} className="flex-shrink-0 text-gray-500 group-hover:text-gray-300" />}
                    <span className="text-sm truncate flex-1">{c.name}</span>
                    {unreadCounts[c._id]>0 && <span className="text-[11px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{unreadCounts[c._id]}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* DMs */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-white/5 group mb-0.5 mt-1">
              <ChevronDown size={14} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-300 group-hover:text-white">Direct Messages</span>
              <span className="ml-auto text-[11px] text-gray-500">{dmUsers.length}</span>
            </div>

            {dmUsers.map((u) => {
              const isOnline = onlineUsers.includes(u._id||u.id||'');
              const hasUnread = unreadCounts[u._id||u.id||'']>0;
              const preview = dmPreviews[u._id||u.id||''];
              return (
                <div
                  key={u._id}
                  onClick={() => { const ac={type:'dm' as const,id:u._id!,name:u.name!}; setActiveChat(ac); try{localStorage.setItem('activeChat',JSON.stringify(ac))}catch(e){} }}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors group ${
                    activeChat?.id===u._id ? 'bg-[#522653] text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="relative flex-shrink-0" onClick={async(e)=>{e.stopPropagation();const token=localStorage.getItem('token');const res=await fetch(`${SOCKET_URL}/api/user/${u._id||u.id}`,{headers:{Authorization:`Bearer ${token}`}});const data=await res.json();setViewingUser(data.user||u);setProfileOpen(true);}}>
                    <UserAvatar user={u} size="sm" />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#19171d] ${isOnline?'bg-green-500':'bg-gray-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm truncate">{u.name}</span>
                      {preview && <span className="text-[10px] text-gray-500 ml-1 flex-shrink-0">{formatDate(preview.createdAt)}</span>}
                    </div>
                    {preview && <p className="text-[11px] text-gray-500 truncate">{preview.from===(user?._id||user?.id)?`You: ${hideUrls((preview.content||'').replace(/<[^>]+>/g,''))}`:hideUrls((preview.content||'').replace(/<[^>]+>/g,''))}</p>}
                  </div>
                  {hasUnread && <span className="text-[11px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0">{unreadCounts[u._id||u.id||'']}</span>}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="flex-1 flex flex-col h-full overflow-hidden" style={{background:'#1a1d21'}}>
          {!activeChat ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-5 mx-auto shadow-xl">
                  <span className="text-[#4A154B] font-bold text-4xl">SV</span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {user?.name}!</h1>
                <p className="text-gray-400">Select a channel or DM to start chatting</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">

              {/* ── CHAT HEADER ── */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5" style={{borderBottom:'1px solid rgba(255,255,255,0.08)',background:'#1a1d21'}}>
                <div className="flex items-center gap-3">
                  {activeChat.type==='group' ? (
                    channels.find(c=>c._id===activeChat.id)?.image?.url ? (
                      <img src={imgUrl(channels.find(c=>c._id===activeChat.id)!.image!.url)} alt={activeChat.name}
                        className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-white/10"
                        onClick={()=>{setViewingGroupId(activeChat.id);setGroupProfileOpen(true);}}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-purple-800/60 flex items-center justify-center cursor-pointer"
                        onClick={()=>{setViewingGroupId(activeChat.id);setGroupProfileOpen(true);}}
                      >
                        <Hash size={16} className="text-purple-300" />
                      </div>
                    )
                  ) : (
                    <div className="cursor-pointer" onClick={async()=>{
                      const chatUser=dmUsers.find(u=>(u._id||u.id)===activeChat.id);
                      if(!chatUser)return;
                      const token=localStorage.getItem('token');
                      const res=await fetch(`${SOCKET_URL}/api/user/${chatUser._id||chatUser.id}`,{headers:{Authorization:`Bearer ${token}`}});
                      const data=await res.json();
                      setViewingUser(data.user||chatUser);
                      setProfileOpen(true);
                    }}>
                      <UserAvatar user={dmUsers.find(u=>(u._id||u.id)===activeChat.id)} size="sm" />
                    </div>
                  )}
                  <div>
                    <h2 className="font-bold text-[15px] text-white leading-none">
                      {activeChat.type==='group' ? <span className="text-gray-300 font-normal mr-0.5">#</span> : null}{activeChat.name}
                    </h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">{activeChat.type==='group'?'Channel':'Direct Message'}</p>
                  </div>
                </div>
                {selectedMessages.size>0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{selectedMessages.size} selected</span>
                    <button onClick={()=>{const m=messages.filter(x=>x.from===myId&&x.id);setSelectedMessages(new Set(m.map(x=>x.id!)));}} className="px-2.5 py-1 bg-white/10 text-gray-300 rounded text-xs hover:bg-white/20 transition">Select Mine</button>
                    <button onClick={deleteSelectedMessages} className="px-2.5 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition">Delete</button>
                    <button onClick={()=>setSelectedMessages(new Set())} className="px-2.5 py-1 bg-white/10 text-gray-300 rounded text-xs hover:bg-white/20 transition">Cancel</button>
                  </div>
                )}
              </div>

              {/* SCROLLABLE MESSAGES */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#522653 #1a1d21' }}>
                {messages.map((m, idx) => {
                  // System messages display centered with quotes
                  if (m.isSystemMessage) {
                    return (
                      <div key={m.id || `msg-${idx}`} className="flex justify-center my-4">
                        <div className="text-center text-gray-400 text-sm italic px-4 py-2">
                          &quot;{m.content}&quot;
                        </div>
                      </div>
                    );
                  }

                  const isImage = m.file && ((m.file.mimetype && m.file.mimetype.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg)$/i.test((m.file.filename || m.file.url || '')));
                  const isMine = m.from === myId;
                  const isSelected = m.id ? selectedMessages.has(m.id) : false;
                  const msgUser = isMine ? user : dmUsers.find(u => (u._id || u.id) === m.from);
                  return (
                  <div
                    key={m.id || `msg-${idx}`}
                    className={`group flex w-full justify-start animate-fadeIn items-start gap-2 pb-4 ${idx < messages.length - 1 ? 'border-b border-gray-700/50' : ''}`}
                  >
                  {msgUser && (
                    <UserAvatar user={msgUser} size="sm" className="mt-1" />
                  )}
                  <div className="flex flex-1 items-center gap-2 relative">
                  <div
                    onContextMenu={(e) => { 
                      e.preventDefault(); 
                      if (!m.id) return;
                      setContextMenu({ x: 0, y: 0, id: m.id }); 
                    }}
                    onClick={() => {
                      if (!m.id) return;
                      if (selectedMessages.size === 0) return;
                      setSelectedMessages(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(m.id!)) {
                          newSet.delete(m.id!);
                        } else {
                          newSet.add(m.id!);
                        }
                        return newSet;
                      });
                    }}
                    onDoubleClick={() => {
                      if (!m.id) return;
                      setSelectedMessages(new Set([m.id!]));
                    }}
                    className={`relative transition-all duration-200 cursor-pointer px-3 py-2 pr-12 rounded-lg w-full max-w-full flex-1 ${
                      isImage ? 'rounded-[1.5rem]' : ''
                    } ${
                      selectedMessages.has(m.id || '') ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-[#0f1115]' : ''
                    } hover:bg-white/5`}
                  >
                    {isMine && (selectedMessages.has(m.id || '') || contextMenu?.id === m.id) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!m.id) return;
                          setSelectedMessages(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(m.id!)) {
                              newSet.delete(m.id!);
                            } else {
                              newSet.clear();
                              newSet.add(m.id!);
                            }
                            return newSet;
                          });
                        }}
                        className=""
                        title="Toggle selection"
                      >
                        {selectedMessages.has(m.id || '') ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : (
                          <span className="" />
                        )}
                      </button>
                    )}


                    {editingId === m.id ? (
                      <div className="flex flex-col gap-2 w-full">
                        <textarea 
                          autoFocus 
                          value={editingText} 
                          onChange={(e) => setEditingText(e.target.value)} 
                          onKeyDown={async (ev) => { 
                            if (ev.key === 'Enter' && !ev.shiftKey) { 
                              ev.preventDefault();
                              if (savingEdit) return;
                              setSavingEdit(true);
                              const token = localStorage.getItem('token'); 
                              if (!token) { setSavingEdit(false); return; }
                              const endpoint = activeChat?.type === 'group' ? `${SOCKET_URL}/api/group/message/${m.id}` : `${SOCKET_URL}/api/message/${m.id}`; 
                              try { 
                                const res = await fetch(endpoint, { 
                                  method: 'PUT', 
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
                                  body: JSON.stringify({ content: editingText }) 
                                }); 
                                if (!res.ok) { 
                                  const err = await res.json().catch(()=>({})); 
                                  show(err?.msg || 'Update failed', 'error');
                                  setSavingEdit(false);
                                  return; 
                                } 
                                const d = await res.json(); 
                                const updated = d?.message; 
                                setMessages(prev => prev.map(x => x.id === updated.id ? { ...x, content: updated.content, edited: true } : x)); 
                                setEditingId(null); 
                                setEditingText('');
                                setSavingEdit(false);
                                show('Message updated', 'success'); 
                              } catch (e) { 
                                console.error(e); 
                                show('Update failed', 'error');
                                setSavingEdit(false);
                              } 
                            } else if (ev.key === 'Escape') { 
                              setEditingId(null); 
                              setEditingText(''); 
                            } 
                          }} 
                          className="flex-1 bg-white/10 px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500 resize-none min-h-[60px] text-white"
                          placeholder="Edit your message..."
                        />
                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={async () => {
                              if (savingEdit) return;
                              setSavingEdit(true);
                              const token = localStorage.getItem('token'); 
                              if (!token) { setSavingEdit(false); return; }
                              const endpoint = activeChat?.type === 'group' ? `${SOCKET_URL}/api/group/message/${m.id}` : `${SOCKET_URL}/api/message/${m.id}`;
                              try {
                                const res = await fetch(endpoint, { 
                                  method: 'PUT', 
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
                                  body: JSON.stringify({ content: editingText }) 
                                });
                                if (!res.ok) { 
                                  const err = await res.json().catch(()=>({})); 
                                  show(err?.msg || 'Update failed', 'error');
                                  setSavingEdit(false);
                                  return; 
                                }
                                const d = await res.json(); 
                                const updated = d?.message;
                                setMessages(prev => prev.map(x => x.id === updated.id ? { ...x, content: updated.content, edited: true } : x));
                                setEditingId(null); 
                                setEditingText('');
                                setSavingEdit(false);
                                show('Message updated', 'success');
                              } catch (e) { 
                                console.error(e); 
                                show('Update failed', 'error');
                                setSavingEdit(false);
                              }
                            }} 
                            disabled={savingEdit}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                          >
                            {savingEdit ? (
                              <>
                                <svg className="animate-spin h-4 w-4" xmlns="https://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Saving...
                              </>
                            ) : (
                              'Save'
                            )}
                          </button>
                          <button 
                            onClick={() => { 
                              setEditingId(null); 
                              setEditingText(''); 
                            }} 
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* attachments */}
                        {m.file && ((m.file.mimetype && m.file.mimetype.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg)$/i.test((m.file.filename || m.file.url || ''))) ? (
                          <div className="flex flex-col gap-1">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-bold text-white text-sm">{m.fromName || 'Unknown'}</span>
                            <span className="text-xs text-gray-400">{m.createdAt ? formatMsgTime(m.createdAt) : ''}</span>
                          </div>
                          <div className="relative inline-block group">
                            <img
                              src={imgUrl(m.file!.url)}
                              alt="image"
                              className="w-[360px] h-[290px] object-cover cursor-pointer rounded-2xl transition-all duration-200 transform group-hover:scale-[1.02]"
                              onClick={() => window.open(imgUrl(m.file!.url), '_blank')}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (m.file) downloadFile(imgUrl(m.file.url), m.file.filename || 'image', m.id || '');
                              }}
                              className="absolute inset-x-0 bottom-3 mx-auto w-[90%] opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/60 text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              Download
                            </button>
                          </div>
                          </div>
                        ) : m.file && /\.pdf$/i.test(m.file.filename || '') ? (
                          <div className="flex flex-col gap-1">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-bold text-white text-sm">{m.fromName || 'Unknown'}</span>
                            <span className="text-xs text-gray-400">{m.createdAt ? formatMsgTime(m.createdAt) : ''}</span>
                          </div>
                          <div className="w-[280px] rounded-xl overflow-hidden border border-white/10 relative">
                            {downloadingFiles[m.id || ''] ? (
                              <div className="h-full p-6 flex flex-col items-center justify-center bg-green-900/20">
                                <div className="relative">
                                  <svg className="animate-spin h-16 w-16 text-green-500" xmlns="https://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <button onClick={(e) => { e.stopPropagation(); cancelDownload(m.id || ''); }} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition">
                                    <svg xmlns="https://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                </div>
                                <div className="text-sm text-green-400 mt-4 font-medium">Downloading...</div>
                              </div>
                            ) : (
                              <div className="h-full p-6 flex flex-col items-center justify-center cursor-pointer" onClick={() => m.file && window.open(imgUrl(m.file.url), '_blank')}>
                                {m.file?.thumbnail ? (
                                  <img src={imgUrl(m.file.thumbnail)} alt="PDF preview" className="w-full h-[160px] object-cover rounded-lg mb-3" />
                                ) : (
                                  <svg xmlns="https://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                )}
                                {!m.file?.thumbnail && <span className="text-red-400 font-bold text-2xl mt-3">PDF</span>}
                                <div className="text-sm font-medium text-white truncate w-full text-center mt-4">{m.file.filename || 'File'}</div>
                                <div className="flex gap-2 mt-4">
                                  <button onClick={(e) => { e.stopPropagation(); m.file && window.open(imgUrl(m.file.url), '_blank'); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                                    <svg xmlns="https://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                    Preview
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); m.file && downloadFile(imgUrl(m.file.url), m.file.filename || 'file.pdf', m.id || ''); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium">
                                    <svg xmlns="https://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    Download
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          </div>
                        ) : m.file && /\.(xlsx?|docx?|txt|mp4|avi|mov|mkv|rar|zip)$/i.test(m.file.filename || '') ? (
                          <div className="flex flex-col gap-1">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-bold text-white text-sm">{m.fromName || 'Unknown'}</span>
                            <span className="text-xs text-gray-400">{m.createdAt ? formatMsgTime(m.createdAt) : ''}</span>
                          </div>
                          <div className="w-[280px] rounded-xl overflow-hidden border border-white/10 relative">
                            {downloadingFiles[m.id || ''] ? (
                              <div className="h-full p-6 flex flex-col items-center justify-center bg-green-900/20">
                                <div className="relative">
                                  <svg className="animate-spin h-16 w-16 text-green-500" xmlns="https://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <button onClick={(e) => { e.stopPropagation(); cancelDownload(m.id || ''); }} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition">
                                    <svg xmlns="https://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                </div>
                                <div className="text-sm text-green-400 mt-4 font-medium">Downloading...</div>
                              </div>
                            ) : (
                              <div className="h-full p-6 flex flex-col items-center justify-center">
                                {/\.(mp4|avi|mov|mkv)$/i.test(m.file?.filename || '') ? (
                                  <>
                                    <svg xmlns="https://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    <span className="text-blue-400 font-bold text-2xl mt-3">VIDEO</span>
                                  </>
                                ) : /\.(xlsx?|csv)$/i.test(m.file?.filename || '') ? (
                                  <>
                                    <svg xmlns="https://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="12" y1="9" x2="12" y2="17"/></svg>
                                    <span className="text-green-400 font-bold text-2xl mt-3">EXCEL</span>
                                  </>
                                ) : /\.(docx?|odt)$/i.test(m.file?.filename || '') ? (
                                  <>
                                    <svg xmlns="https://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                    <span className="text-blue-400 font-bold text-2xl mt-3">WORD</span>
                                  </>
                                ) : /\.txt$/i.test(m.file?.filename || '') ? (
                                  <>
                                    <svg xmlns="https://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                    <span className="text-purple-400 font-bold text-2xl mt-3">TEXT</span>
                                  </>
                                ) : (
                                  <>
                                    <svg xmlns="https://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    <span className="text-purple-400 font-bold text-2xl mt-3">{m.file?.filename?.split('.').pop()?.toUpperCase()}</span>
                                  </>
                                )}
                                <div className="text-sm font-medium text-white truncate w-full text-center mt-4">{m.file.filename || 'File'}</div>
                                <button onClick={(e) => { e.stopPropagation(); m.file && downloadFile(m.file.url, m.file.filename || 'file', m.id || ''); }} className="flex items-center justify-center gap-2 mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium">
                                  <svg xmlns="https://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  Download
                                </button>
                              </div>
                            )}
                          </div>
                          </div>
                        ) : (
                          m.content && (
                            <div className="flex flex-col">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="font-bold text-white text-sm">{m.fromName || 'Unknown'}</span>
                                <span className="text-xs text-gray-400">{m.createdAt ? formatMsgTime(m.createdAt) : ''}</span>
                              </div>
                              <div className="text-white text-sm" dangerouslySetInnerHTML={{ __html: hideUrls(m.content) || '' }} />
                              {m.edited && <span className="text-[10px] text-gray-400 italic mt-1 block">(edited)</span>}
                            </div>
                          )
                        )}
                      </>
                    )}
                  {(contextMenu && contextMenu.id === m.id) && (
                    <div 
                      ref={menuRef} 
                      style={{ position: 'absolute', right: 0, top: 0, zIndex: 60 }}
                    >
                      <div className="flex flex-col bg-gradient-to-br from-[#1a1d21] to-[#0f1115] border border-purple-500/30 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
                      {confirmDeleteId === contextMenu!.id ? (
                        <div className="p-5 text-sm text-white min-w-[280px]">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/20 rounded-full">
                              <svg xmlns="https://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            </div>
                            <div>
                              <p className="font-bold text-white text-base">Delete Message?</p>
                              <p className="text-xs text-gray-400 mt-0.5">This action cannot be undone</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-semibold transition-all hover:scale-105 shadow-lg" onClick={async () => {
                              const id = contextMenu!.id; setContextMenu(null); setConfirmDeleteId(null); if (!id) return; const token = localStorage.getItem('token'); if (!token) return;
                              const endpoint = activeChat?.type === 'group' ? `${SOCKET_URL}/api/group/message/${id}` : `${SOCKET_URL}/api/message/${id}`;
                              try {
                                const res = await fetch(endpoint, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                                if (!res.ok) { const err = await res.json().catch(()=>({})); show(err?.msg || 'Delete failed', 'error'); return; }
                                setMessages(prev => prev.filter(x => x.id !== id));
                                show('Message deleted', 'success');
                              } catch (e) { console.error(e); show('Delete failed', 'error'); }
                            }}>
                              <svg xmlns="https://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              Yes
                            </button>
                            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-600 hover:bg-gray-700 rounded-lg text-white text-sm font-semibold transition-all hover:scale-105 shadow-lg" onClick={() => { setConfirmDeleteId(null); setContextMenu(null); }}>
                              <svg xmlns="https://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              No
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {(() => { const found = messages.find(x => x.id === contextMenu!.id); const isOwn = found && String(found.from) === String(myId); return (
                            <>
                              {isOwn && (
                                <button className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg hover:shadow-green-900/50" onClick={() => {
                                  const id = contextMenu!.id; const found = messages.find(x => x.id === id); if (!found) return setContextMenu(null);
                                  const plainText = (found.content || '').replace(/<[^>]*>/g, '');
                                  setEditingId(id); setEditingText(plainText); setContextMenu(null);
                                }}>
                                  <div className="p-1.5 bg-white/20 rounded-lg">
                                    <svg xmlns="https://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  </div>
                                  <span>Edit Message</span>
                                </button>
                              )}
                              <button className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg hover:shadow-blue-900/50" onClick={() => {
                                const id = contextMenu!.id; const found = messages.find(x => x.id === id); if (!found) return setContextMenu(null);
                                setForwardContent(found.content || '');
                                setForwardSenderName(found.fromName || 'Unknown');
                                setForwardFile(found.file || null);
                                setContextMenu(null);
                                setForwardOpen(true);
                              }}>
                                <div className="p-1.5 bg-white/20 rounded-lg">
                                  <svg xmlns="https://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
                                </div>
                                <span>Forward</span>
                              </button>
                              {isOwn && (
                                <button className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg hover:shadow-red-900/50" onClick={() => { setConfirmDeleteId(contextMenu!.id); }}>
                                  <div className="p-1.5 bg-white/20 rounded-lg">
                                    <svg xmlns="https://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                  </div>
                                  <span>Delete Message</span>
                                </button>
                              )}
                            </>
                          ); })()}
                        </>
                      )}
                    </div>
                    </div>
                  )}
                  </div>
                  </div>
                  </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* FIXED INPUT */}
              <div className="flex-shrink-0 px-4 py-3 border-t border-white/10 bg-[#1a1d21]">
                {activeChat.type === 'group' && removedFromGroups.has(activeChat.id) ? (
                  <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-center">
                    <p className="text-red-400 font-medium">You are not in the group. Admin removed you.</p>
                  </div>
                ) : (
                  <>
                    {uploadingFiles && (
                  <div className="mb-3 p-4 bg-green-900/20 rounded-xl border border-green-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <svg className="animate-spin h-6 w-6 text-green-500" xmlns="https://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-green-400 font-medium">Sending files...</span>
                      </div>
                      <button onClick={cancelUpload} className="p-2 bg-red-600 rounded-lg hover:bg-red-700 transition">
                        <svg xmlns="https://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
                          <svg xmlns="https://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <RichTextEditor
                    content={editorHtml}
                    onChange={setEditorHtml}
                    onSubmit={sendMessage}
                    placeholder={activeChat.type === 'dm' ? `Message ${activeChat.name}` : `Message #${activeChat.name}`}
                    disabled={uploadingFiles}
                    rightButtons={
                      <>
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
                          className="p-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-all hover:scale-105 disabled:opacity-50"
                        >
                          <Plus size={18} className="text-purple-400" />
                        </button>
                        <button
                          onClick={sendMessage}
                          disabled={(!editorHtml.trim() || editorHtml === '<p></p>') && files.length === 0 || uploadingFiles}
                          className="p-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 shadow-lg shadow-purple-900/50"
                        >
                          <Send size={18} />
                        </button>
                      </>
                    }
                  />
                </div>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
      <ProfileSession isOpen={profileOpen} onClose={() => { setProfileOpen(false); setViewingUser(null); }} user={viewingUser} isOwnProfile={false} />
      <GroupProfileSession isOpen={groupProfileOpen} onClose={() => { setGroupProfileOpen(false); setViewingGroupId(undefined); }} groupId={viewingGroupId} />
      <ForwardSession isOpen={forwardOpen} onClose={() => { setForwardOpen(false); setForwardFile(null); }} messageContent={forwardContent} originalSenderName={forwardSenderName} file={forwardFile} />
    </AppLayout>
  );
};

export default Dashboard;
