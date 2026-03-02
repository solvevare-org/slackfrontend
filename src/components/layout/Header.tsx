import { LogOut, Search, ChevronDown, Plus, Sparkles, Building2, X } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, SOCKET_URL } from '@/lib/config';





interface IWorkspace {
  _id: string;
  name: string;
  image?: string;
  type?: string;
  createdAt?: string;
}

const Header: React.FC = () => {
  const navigate = useNavigate();

  // Logout function
  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('currentWorkspace');
    } catch (e) {}
    navigate('/login');
  };

  const [currentWorkspace, setCurrentWorkspace] = React.useState<IWorkspace | null>(null);
  const [workspaces, setWorkspaces] = React.useState<IWorkspace[]>([]);
  const [open, setOpen] = React.useState(false);
  const [channelsOpen, setChannelsOpen] = React.useState(false);
  const [channels, setChannels] = React.useState<any[]>([]);

  const [showCreateChannel, setShowCreateChannel] = React.useState(false);
  const [showInviteUser, setShowInviteUser] = React.useState(false);
  const [showPlusMenu, setShowPlusMenu] = React.useState(false);
  const [channelName, setChannelName] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState('User');
  const [actionMsg, setActionMsg] = React.useState('');
  const [user, setUser] = React.useState<any>(null);
  const [fullscreenImage, setFullscreenImage] = React.useState<string | null>(null);
  const isAdmin = (user?.role || user?.Role || '').toString().toLowerCase() === 'admin';

  // Load current workspace from localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('currentWorkspace');
      if (raw) setCurrentWorkspace(JSON.parse(raw));
    } catch (e) {}
  }, []);

  // Load current user from localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {}
  }, []);

  // Fetch workspaces with polling fallback
  React.useEffect(() => {
    let socket: any = null;
    let polling: any = null;
    const token = localStorage.getItem('token');

    const fetchWorkspaces = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/workspaces`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          console.warn('Header: workspaces fetch unauthorized');
          navigate('/login');
          return;
        }

        if (!res.ok) {
          const txt = await res.text();
          console.error('Header: workspaces fetch failed', res.status, txt);
          return;
        }

        const data = await res.json();
        setWorkspaces(data.workspaces || []);
      } catch (e) {
        console.error('Header: fetchWorkspaces error', e);
      }
    };

    (async () => {
      fetchWorkspaces();

      try {
        const mod = await import('socket.io-client');
        const { io } = mod;
        socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
        socket.on('workspace-updated', fetchWorkspaces);
        socket.on('workspace-group-created', fetchWorkspaces);
      } catch (e) {
        polling = setInterval(fetchWorkspaces, 10000);
      }
    })();

    return () => {
      try {
        if (socket) socket.disconnect();
      } catch (e) {}
      if (polling) clearInterval(polling);
    };
  }, [navigate]);

  // Create channel
  const createChannel = async () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    if (!channelName.trim()) { setActionMsg('Channel name required'); return; }

    setActionMsg('Creating...');
    try {
      const rawUser = localStorage.getItem('user');
      const me = rawUser ? JSON.parse(rawUser).id : null;
      const rawWs = localStorage.getItem('currentWorkspace');
      const ws = rawWs ? JSON.parse(rawWs) : null;
      const body = { name: channelName.trim(), members: JSON.stringify(me ? [me] : []), workspaceId: ws?.id || ws?._id };
      const res = await fetch(`${API_URL}/api/group`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) setActionMsg(data?.msg || 'Create channel failed');
      else { setActionMsg('Channel created'); setShowCreateChannel(false); setChannelName(''); }
      // refresh channels for current workspace
      fetchWorkspaceChannels();
    } catch (e) {
      console.error('createChannel error', e);
      setActionMsg('Server error');
    }
  };

  // Fetch channels for the selected workspace
  const fetchWorkspaceChannels = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const rawWs = localStorage.getItem('currentWorkspace');
      const ws = rawWs ? JSON.parse(rawWs) : null;
      if (!ws?.id && !ws?._id) return setChannels([]);
      const id = ws.id || ws._id;
      const res = await fetch(`${API_URL}/api/workspaces/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return setChannels([]);
      const data = await res.json();
      setChannels(data.workspace?.channels || []);
    } catch (e) {
      console.error('fetchWorkspaceChannels error', e);
    }
  };

  // Invite user
  const sendInvite = async () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    if (!inviteEmail.trim()) { setActionMsg('Email required'); return; }

    setActionMsg('Sending invite...');
    try {
      const rawWs = localStorage.getItem('currentWorkspace')
      const ws = rawWs ? JSON.parse(rawWs) : null
      const workspaceId = ws?.id || ws?._id || null
      const res = await fetch(`${API_URL}/api/auth/invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, workspaceId })
      })
      const data = await res.json();
      if (!res.ok) setActionMsg(data?.msg || 'Invite failed');
      else { setActionMsg('Invite sent'); setShowInviteUser(false); setInviteEmail(''); }
    } catch (e) {
      console.error('invite error', e);
      setActionMsg('Server error');
    }
  };

  const openWorkspace = (ws: IWorkspace) => {
    const namePart = encodeURIComponent(ws.name);
    try { localStorage.setItem('currentWorkspace', JSON.stringify({ id: ws._id, name: ws.name, image: ws.image })); } catch(e){}
    setCurrentWorkspace(ws);
    navigate(`/dashboard/${namePart}/${ws._id}`);
  };

  return (
    <>
      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center" onClick={() => setFullscreenImage(null)}>
          <button onClick={() => setFullscreenImage(null)} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition text-white z-[101]">
            <X size={24} />
          </button>
          <img src={fullscreenImage} alt="Workspace" className="max-w-[90vw] max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      
      <div className="text-white py-4 px-6 flex items-center justify-between">

        {/* LEFT LOGO + WORKSPACE */}
        <div className="flex items-center gap-4 w-1/4">
          {/* <div className="text-lg font-semibold">WORK SPACE</div> */}
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setOpen(!open)}
              className="text-sm text-white bg-purple-600/20 hover:bg-purple-600/30 px-4 py-2 rounded-lg flex items-center gap-2 border border-purple-500/30 transition-all shadow-lg"
            >
              {currentWorkspace?.image ? (
                <img 
                  src={`${API_URL}${currentWorkspace.image}`} 
                  alt={currentWorkspace.name} 
                  className="w-8 h-8 rounded-lg object-cover cursor-pointer hover:opacity-80 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenImage(`${API_URL}${currentWorkspace.image}`);
                  }}
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                  {currentWorkspace?.name?.charAt(0)?.toUpperCase() || 'W'}
                </div>
              )}
              <span className="font-semibold">{currentWorkspace ? currentWorkspace.name : 'Select workspace'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
       

            {open && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
                <div className="absolute left-0 top-full mt-2 w-72 bg-gradient-to-b from-[#1a1d21] to-[#0f1115] border border-purple-500/30 rounded-xl shadow-2xl z-30 overflow-hidden">
                  <div className="p-3 border-b border-purple-500/20 bg-purple-600/10">
                    <div className="text-xs font-semibold text-purple-300">YOUR WORKSPACES</div>
                  </div>
                  <div className="max-h-80 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                    {workspaces.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">No workspaces available</div>
                    ) : (
                      workspaces.map(ws => (
                        <button
                          key={ws._id}
                          onClick={() => { openWorkspace(ws); setOpen(false); }}
                          className={`w-full text-left px-4 py-3 hover:bg-purple-600/10 flex items-center gap-3 transition-colors border-b border-purple-500/10 ${
                            currentWorkspace?._id === ws._id ? 'bg-purple-600/20' : ''
                          }`}>
                          {ws.image ? (
                            <img 
                              src={`${API_URL}${ws.image}`} 
                              alt={ws.name} 
                              className="w-10 h-10 rounded-lg object-cover shadow-lg cursor-pointer hover:opacity-80 transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFullscreenImage(`${API_URL}${ws.image}`);
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                              {ws.name?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{ws.name}</div>
                            <div className="text-xs text-gray-400">{ws.type || 'Workspace'}</div>
                          </div>
                          {currentWorkspace?._id === ws._id && (
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* CENTER SEARCH */}
        <div className="w-1/2 flex justify-center">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-400" />
            <input
              placeholder="Search SolveVare"
              className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-[#0a0b0d]/50 border border-purple-500/20 placeholder:text-gray-500 text-sm text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
          </div>
        </div>

     

        {/* RIGHT LOGOUT */}
        <div className="w-1/4 flex justify-end items-center gap-2">



         {isAdmin && currentWorkspace && (
        <div className="relative">
          <button
            onClick={() => setShowPlusMenu((s) => !s)}
            title="Create / Invite"
            className="flex items-center gap-2 px-4 py-2 hover:bg-purple-600/20 rounded-xl bg-purple-600/10 border border-purple-500/30 transition-all shadow-lg"
          >
            <Plus className="w-5 h-5 text-purple-400" />
          </button>

          {showPlusMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowPlusMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-gradient-to-b from-[#1a1d21] to-[#0f1115] border border-purple-500/30 rounded-xl shadow-2xl z-30 overflow-hidden">
                <button
                  onClick={() => { setShowPlusMenu(false); navigate('/create-channel'); }}
                  className="w-full text-left px-4 py-3 hover:bg-purple-600/10 text-white transition-colors border-b border-purple-500/10 flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4 text-purple-400" />
                  Create Channel
                </button>
                <button
                  onClick={() => { setShowPlusMenu(false); navigate('/admin'); }}
                  className="w-full text-left px-4 py-3 hover:bg-purple-600/10 text-white transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Invite Member
                </button>
              </div>
            </>
          )}
        </div>
      )}
        
          {/* invite moved into split control on the left for admins */}
          <button onClick={handleLogout} title="Logout" className="p-2.5 rounded-xl hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/30">
            <LogOut className="h-5 w-5 text-red-400" />
          </button>

        </div>

      </div>

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-[#111214] p-6 rounded border border-gray-800 w-96">
            <h3 className="text-lg font-medium mb-3">Create Channel</h3>
            <input
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Channel name"
              className="w-full text-white p-2 rounded bg-black/10 text-white mb-3"
            />
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-400">Want to add users or invite members?</div>
              <button onClick={() => { navigate('/admin'); }} className="text-sm text-blue-400 underline">Invite Members</button>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowCreateChannel(false); setChannelName(''); setActionMsg(''); }} className="px-3 py-1 rounded border">Cancel</button>
              <button onClick={createChannel} className="px-3 text-white py-1 rounded bg-purple-600">Create</button>
            </div>
            {actionMsg && <div className="mt-3 text-sm text-white text-gray-300">{actionMsg}</div>}
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-[#111214] p-6 rounded border border-gray-800 w-96">
            <h3 className="text-lg text-white font-medium mb-3">Invite User to Workspace</h3>
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="User email"
              className="w-full p-2 rounded text-white bg-black/10 mb-2"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole((e.target as HTMLSelectElement).value)}
              className="w-full p-2 rounded bg-black/10 text-white mb-3"
            >
              <option>User</option>
              <option>Developer</option>
              <option>Sales</option>
              <option>Admin</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowInviteUser(false); setInviteEmail(''); setActionMsg(''); }} className="px-3 py-1 rounded border">Cancel</button>
              <button onClick={sendInvite} className="px-3 py-1 rounded bg-green-600">Send Invite</button>
            </div>
            {actionMsg && <div className="mt-3 text-sm text-gray-300">{actionMsg}</div>}
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
