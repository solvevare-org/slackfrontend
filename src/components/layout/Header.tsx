import { Search, X, Hash, User, ArrowLeft, ArrowRight, RotateCw } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '@/lib/config';
import { imgUrl } from '@/lib/utils';
import ProfileSession from '@/components/layout/ProfileSession';

interface IWorkspace {
  _id: string;
  name: string;
  image?: string;
  type?: string;
  createdAt?: string;
}

const Header: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('currentWorkspace');
    } catch (e) { }
    navigate('/login');
  };

  const [currentWorkspace, setCurrentWorkspace] = React.useState<IWorkspace | null>(null);
  const [showPlusMenu, setShowPlusMenu] = React.useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [user, setUser] = React.useState<any>(null);
  const [fullscreenImage, setFullscreenImage] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  const isAdmin = (user?.role || user?.Role || '').toString().toLowerCase() === 'admin';

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('currentWorkspace');
      if (raw) setCurrentWorkspace(JSON.parse(raw));
    } catch (e) { }
    
    // Listen for workspace changes in localStorage
    const handleStorageChange = () => {
      try {
        const raw = localStorage.getItem('currentWorkspace');
        if (raw) setCurrentWorkspace(JSON.parse(raw));
      } catch (e) { }
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event when workspace changes within same tab
    window.addEventListener('workspace-changed', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('workspace-changed', handleStorageChange);
    };
  }, []);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch (e) { }
  }, []);

  /* Listen for user updates (avatar, profile changes) */
  React.useEffect(() => {
    const handleUserUpdate = (event: any) => {
      if (event.detail) {
        setUser(event.detail);
      }
    };
    window.addEventListener('user-updated', handleUserUpdate);
    return () => window.removeEventListener('user-updated', handleUserUpdate);
  }, []);

  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const timer = setTimeout(async () => {
      try {
        const rawWs = localStorage.getItem('currentWorkspace');
        const ws = rawWs ? JSON.parse(rawWs) : null;
        if (!ws?.id && !ws?._id) return;
        const wsId = ws.id || ws._id;

        const res = await fetch(`${API_URL}/api/workspaces/${wsId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();

        const members = data.workspace?.members || [];
        const channels = data.workspace?.channels || [];

        const query = searchQuery.toLowerCase();
        const filteredUsers = members.filter((m: any) =>
          m.name?.toLowerCase().includes(query) || m.email?.toLowerCase().includes(query)
        );
        const filteredChannels = channels.filter((c: any) =>
          c.name?.toLowerCase().includes(query)
        );

        setSearchResults([...filteredChannels.map((c: any) => ({ ...c, type: 'channel' })), ...filteredUsers.map((u: any) => ({ ...u, type: 'user' }))]);
        setShowSearchResults(true);
      } catch (e) {
        console.error('Search error', e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchResultClick = (result: any) => {
    if (result.type === 'channel') {
      const ac = { type: 'group', id: result._id, name: result.name };
      try { localStorage.setItem('activeChat', JSON.stringify(ac)); } catch (e) { }
      // Use emitAction to trigger Dashboard to open the chat
      const { emitAction } = require('@/lib/notificationBus');
      emitAction({ action: 'open-chat', data: ac });
      // Navigate to dashboard if not already there
      if (!window.location.pathname.includes('/dashboard')) {
        navigate('/dashboard');
      }
    } else if (result.type === 'user') {
      const ac = { type: 'dm', id: result._id || result.id, name: result.name };
      try { localStorage.setItem('activeChat', JSON.stringify(ac)); } catch (e) { }
      navigate(`/dm/${result._id || result.id}`);
    }
    setSearchQuery('');
    setShowSearchResults(false);
  };

  return (
    <>
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center" onClick={() => setFullscreenImage(null)}>
          <button onClick={() => setFullscreenImage(null)} className="absolute top-2 right-2 p-1 bg-white/10 hover:bg-white/20 rounded-full transition text-white z-[101]">
            <X size={20} />
          </button>
          <img src={imgUrl(fullscreenImage)} alt="Workspace" className="max-w-[90vw] max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <div className="text-white py-3 px-3 flex items-center justify-between">

        <div className="flex items-center gap-4 relative">
          <span className="font-semibold text-white px-4 py-2">{currentWorkspace?.name || 'Workspace'}</span>
        </div>
        
        <div className="flex-1 max-w-2xl mx-8 relative">
          <div className="relative">
            
            
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users and channels..."
              className="w-full pl-4 pr-12 py-3 rounded-xl bg-[#0a0b0d]/50 border border-purple-500/30 placeholder:text-gray-500 text-sm text-white text-center outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
            
          </div>

          {showSearchResults && searchResults.length > 0 && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowSearchResults(false)} />
              <div className="absolute top-full mt-2 w-full bg-gradient-to-b from-[#1a1d21] to-[#0f1115] border border-purple-500/30 rounded-xl shadow-2xl z-30 max-h-96 overflow-auto">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearchResultClick(result)}
                    className="w-full text-left px-4 py-3 hover:bg-purple-600/10 flex items-center gap-3 transition-colors border-b border-purple-500/10"
                  >
                    {result.type === 'channel' ? (
                      result.image?.url ? (
                        <img src={result.image.url} alt={result.name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                          <Hash size={20} className="text-purple-400" />
                        </div>
                      )
                    ) : (
                      result.avatar ? (
                        <img src={result.avatar} alt={result.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white font-bold">
                          {result.name?.charAt(0)?.toUpperCase() || <User size={20} />}
                        </div>
                      )
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{result.name}</div>
                      <div className="text-xs text-gray-400">{result.type === 'channel' ? 'Channel' : result.email || 'User'}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-purple-600/20 rounded-lg transition-all hover:scale-110"
            title="Back"
          >
            <ArrowLeft size={20} className="text-purple-400" />
          </button>
          <button
            onClick={() => window.history.forward()}
            className="p-2 hover:bg-purple-600/20 rounded-lg transition-all hover:scale-110"
            title="Forward"
          >
            <ArrowRight size={20} className="text-purple-400" />
          </button>
           <button
            onClick={() => window.location.reload()}
            className="p-2 hover:bg-purple-600/20 rounded-lg transition-all hover:scale-110"
            title="Reload"
          >
            <RotateCw size={20} className="text-purple-400" />
          </button>

        </div>

      </div>

      {/* profile session popup */}
      {/* <ProfileSession isOpen={profileOpen} onClose={() => setProfileOpen(false)} user={user} isOwnProfile={true} /> */}

    </>
  );
};

export default Header;