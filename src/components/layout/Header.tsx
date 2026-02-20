import { LogOut, Search, ChevronDown, Plus } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';





interface IWorkspace {
  _id: string;
  name: string;
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
        const res = await fetch('http://localhost:9000/api/workspaces', {
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
        socket = io('http://localhost:9000', { auth: { token }, transports: ['websocket'] });
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
      const res = await fetch('http://localhost:9000/api/group', {
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
      const res = await fetch(`http://localhost:9000/api/workspaces/${id}`, {
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
      const res = await fetch('http://localhost:9000/api/auth/invite', {
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
    try { localStorage.setItem('currentWorkspace', JSON.stringify({ id: ws._id, name: ws.name })); } catch(e){}
    setCurrentWorkspace(ws);
    navigate(`/dashboard/${namePart}/${ws._id}`);
  };

  return (
    <>
      <div className="text-white py-4 px-6 flex items-center justify-between">

        {/* LEFT LOGO + WORKSPACE */}
        <div className="flex items-center gap-4 w-1/4">
          {/* <div className="text-lg font-semibold">WORK SPACE</div> */}
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setOpen(!open)}
              className="text-l text-gray-300 bg-white/5 px-3 font-bold py-1 rounded flex items-center gap-2"
            >
              {currentWorkspace ? currentWorkspace.name : 'Select workspace'} <ChevronDown className="w-4 h-4" />
            </button>
       

            {open && (
              <div className="absolute left-0 top-0 mt-2 w-64 bg-[#111214] border border-gray-800 rounded shadow z-30">
                <div className="p-2 text-sm text-gray-400">Your Workspaces</div>
                <div className="max-h-64 overflow-auto">
                  {workspaces.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">No workspaces</div>
                  ) : (
                    workspaces.map(ws => (
                      <button
                        key={ws._id}
                        onClick={() => { openWorkspace(ws); setOpen(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-800 flex items-center justify-between">
                        <span className="text-sm">{ws.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER SEARCH */}
        <div className="w-1/2 flex justify-center">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              placeholder="Search SolveVare"
              className="w-full pl-10 pr-4 py-2 rounded bg-black placeholder:text-gray-400 text-sm outline-none"
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
            className="flex items-center gap-2 px-3 py-1 hover:bg-white/10 rounded bg-white/5"
          >
            <Plus className="w-4 h-4 text-green-300" />
          </button>

          {showPlusMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-[#111214] border border-gray-800 rounded shadow z-40">
              <button
                onClick={() => { setShowPlusMenu(false); navigate('/create-channel'); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-800"
              >
                Create Channel
              </button>
              <button
                onClick={() => { setShowPlusMenu(false); navigate('/admin'); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-800"
              >
                Invite Member
              </button>
            </div>
          )}
        </div>
      )}
        
          {/* invite moved into split control on the left for admins */}
          <button onClick={handleLogout} title="Logout" className="p-2 rounded hover:bg-white/10 transition">
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
