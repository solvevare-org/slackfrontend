import React, { useState, useEffect } from "react";
import { X, Hash, Users, Crown, Edit2, UserMinus, Upload, UserPlus } from "lucide-react";
import { SOCKET_URL } from "@/lib/config";
import UserAvatar from "@/components/common/UserAvatar";
import { emitAction } from "@/lib/notificationBus";
import { useToast } from "@/components/ui/toast";

interface GroupProfileSessionProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string | null;
}

const GroupProfileSession: React.FC<GroupProfileSessionProps> = ({ isOpen, onClose, groupId }) => {
  const { show } = useToast();
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) setCurrentUser(JSON.parse(raw));
  }, []);

  useEffect(() => {
    if (!isOpen || !groupId) return;

    const fetchGroup = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${SOCKET_URL}/api/group/${groupId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setGroup(data.group);
          setNewName(data.group.name || "");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, [isOpen, groupId]);

  useEffect(() => {
    if (!showAddMember || !group?.workspace) return;
    const fetchWorkspaceMembers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${SOCKET_URL}/api/workspaces/${group.workspace}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          const existingIds = new Set(group.members.map((m: any) => String(m._id || m.id)));
          const available = data.workspace.members.filter((m: any) => !existingIds.has(String(m._id || m.id)));
          setWorkspaceMembers(available);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchWorkspaceMembers();
  }, [showAddMember, group]);

  const isAdmin = () => {
    const myId = currentUser?._id || currentUser?.id;
    return group?.admins?.some((a: any) => String(a._id || a) === String(myId));
  };

  const updateGroupName = async () => {
    if (!newName.trim() || newName === group.name) {
      setEditingName(false);
      setNewName(group.name);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${SOCKET_URL}/api/group/${groupId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      });
      const data = await res.json();
      if (data.group) {
        setGroup(data.group);
        setEditingName(false);
        emitAction({ action: 'group-updated', data: { groupId: data.group._id, name: data.group.name, image: data.group.image } });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const cancelEdit = () => {
    setNewName(group.name);
    setEditingName(false);
  };

  const updateGroupPicture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${SOCKET_URL}/api/group/${groupId}/picture`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
        emitAction({ action: 'group-updated', data: { groupId: data.group._id, name: data.group.name, image: data.group.image } });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const removeMember = async (userId: string) => {
    const member = group?.members?.find((m: any) => String(m._id || m.id) === String(userId));
    const memberName = member?.name || 'User';
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${SOCKET_URL}/api/group/${groupId}/remove-member`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        setGroup((prev: any) => ({
          ...prev,
          members: prev.members.filter((m: any) => String(m._id || m.id) !== String(userId))
        }));
        show(`${memberName} Removed Successfully`, "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addMembers = async () => {
    if (selectedMembers.size === 0) return;
    const addedNames = workspaceMembers.filter((m: any) => selectedMembers.has(m._id || m.id)).map((m: any) => m.name).join(', ');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${SOCKET_URL}/api/group/${groupId}/add-members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: Array.from(selectedMembers) })
      });
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
        setShowAddMember(false);
        setSelectedMembers(new Set());
        show(`${addedNames} Added Successfully`, "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const admin = group?.members?.find((m: any) => 
    group.admins?.some((a: any) => String(a._id || a) === String(m._id || m.id))
  );

  return (
    <>
      {/* Fullscreen Image Viewer */}
      {fullscreenImage && group?.image?.url && (
        <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center" onClick={() => setFullscreenImage(false)}>
          <button onClick={() => setFullscreenImage(false)} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition text-white z-[101]">
            <X size={24} />
          </button>
          <img src={group.image.url} alt="Group" className="max-w-[90vw] max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className={`fixed top-0 right-0 h-full w-[420px] bg-[#1A1D21] shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Channel Info</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto h-[calc(100%-80px)]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9333ea #1a1d21' }}>
          
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
            </div>
          ) : group ? (
            <>
              {/* Group Picture */}
              <div className="flex justify-center mb-8 relative group">
                {group.image?.url ? (
                  <img 
                    src={group.image.url} 
                    alt="Group" 
                    className="w-28 h-28 rounded-full object-cover border-4 border-purple-600 cursor-pointer hover:opacity-80 transition" 
                    onClick={() => setFullscreenImage(true)} 
                  />
                ) : (
                  <div className="w-28 h-28 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white text-4xl font-bold border-4 border-purple-500">
                    <Hash size={48} />
                  </div>
                )}
                {isAdmin() && (
                  <label className="absolute bottom-0 right-1/2 translate-x-14 bg-purple-600 p-2 rounded-full cursor-pointer hover:bg-purple-700 transition opacity-0 group-hover:opacity-100">
                    <Upload size={16} className="text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={updateGroupPicture} />
                  </label>
                )}
              </div>

              {/* Group Name */}
              <div className="text-center mb-8">
                {editingName ? (
                  <div className="flex flex-col items-center gap-3">
                    <input 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateGroupName();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                      className="text-2xl font-bold text-white bg-white/10 px-3 py-1 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-center"
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={updateGroupName}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                      >
                        Save
                      </button>
                      <button 
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 group">
                    <h3 className="text-2xl font-bold text-white">{group.name || "Group"}</h3>
                    {isAdmin() && (
                      <button onClick={() => setEditingName(true)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition">
                        <Edit2 size={16} className="text-purple-400" />
                      </button>
                    )}
                  </div>
                )}
                <span className="inline-block mt-2 px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-xs font-medium flex items-center gap-1 w-fit mx-auto">
                  <Hash size={12} />
                  Channel
                </span>
              </div>

              {/* Admin */}
              {admin && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <span className="w-1 h-4 bg-purple-600 rounded"></span>
                    Admin
                  </h4>
                  <div className="bg-[#0f1115] p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={admin} size="sm" />
                      <div className="flex-1">
                        <p className="text-white font-medium">{admin.name}</p>
                        <p className="text-xs text-gray-400">{admin.email}</p>
                      </div>
                      <Crown size={18} className="text-yellow-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* Members */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-purple-600 rounded"></span>
                  Members ({group.members?.filter((m: any) => !group.admins?.some((a: any) => String(a._id || a) === String(m._id || m.id))).length || 0})
                  {isAdmin() && (
                    <button 
                      onClick={() => setShowAddMember(true)} 
                      className="ml-auto p-1.5 bg-purple-600 hover:bg-purple-700 rounded-full transition"
                      title="Add members"
                    >
                      <UserPlus size={14} className="text-white" />
                    </button>
                  )}
                </h4>
                <div className="space-y-2 bg-[#0f1115] p-4 rounded-lg max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9333ea #1a1d21' }}>
                  {group.members?.filter((m: any) => !group.admins?.some((a: any) => String(a._id || a) === String(m._id || m.id))).map((member: any) => {
                    const memberId = member._id || member.id;
                    const canRemove = isAdmin() && String(memberId) !== String(currentUser?._id || currentUser?.id);
                    return (
                      <div 
                        key={memberId} 
                        className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition relative cursor-pointer"
                        onMouseEnter={() => setHoveredMember(memberId)}
                        onMouseLeave={() => setHoveredMember(null)}
                        onClick={async () => {
                          const token = localStorage.getItem('token');
                          const res = await fetch(`${SOCKET_URL}/api/user/${memberId}`, { headers: { Authorization: `Bearer ${token}` } });
                          const data = await res.json();
                          emitAction({ action: 'open-profile', data: { user: data.user || member } });
                        }}
                      >
                        <UserAvatar user={member} size="sm" />
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-gray-400">{member.email}</p>
                        </div>
                        {canRemove && hoveredMember === memberId && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeMember(memberId); }} 
                            className="absolute right-2 p-1.5 bg-red-600 hover:bg-red-700 rounded-full transition"
                            title="Remove member"
                          >
                            <UserMinus size={14} className="text-white" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 mt-12">
              <p>Group not found</p>
            </div>
          )}

        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[60]" onClick={() => { setShowAddMember(false); setSelectedMembers(new Set()); }} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] bg-[#1a1d21] rounded-xl shadow-2xl z-[70] border border-purple-500/30">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="text-xl font-semibold text-white">Add Members</h3>
              <button onClick={() => { setShowAddMember(false); setSelectedMembers(new Set()); }} className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9333ea #1a1d21' }}>
              {workspaceMembers.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No available members to add</p>
              ) : (
                <div className="space-y-2">
                  {workspaceMembers.map((member: any) => {
                    const memberId = member._id || member.id;
                    const isSelected = selectedMembers.has(memberId);
                    return (
                      <div 
                        key={memberId}
                        onClick={() => {
                          setSelectedMembers(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(memberId)) newSet.delete(memberId);
                            else newSet.add(memberId);
                            return newSet;
                          });
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                          isSelected ? 'bg-purple-600/30 border border-purple-500' : 'bg-[#0f1115] hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <UserAvatar user={member} size="sm" />
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-gray-400">{member.email}</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          readOnly
                          className="w-5 h-5 rounded border-2 border-purple-500 bg-purple-900/30 checked:bg-purple-600 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-white/10">
              <button 
                onClick={addMembers}
                disabled={selectedMembers.size === 0}
                className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
              >
                Add {selectedMembers.size > 0 ? `(${selectedMembers.size})` : ''}
              </button>
              <button 
                onClick={() => { setShowAddMember(false); setSelectedMembers(new Set()); }}
                className="px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default GroupProfileSession;
