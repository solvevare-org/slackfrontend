import React, { useState } from "react";
import { X, Instagram, Facebook, Linkedin, MessageCircle, Upload } from "lucide-react";

interface ProfileSessionProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  isOwnProfile?: boolean;
}

const ProfileSession: React.FC<ProfileSessionProps> = ({ isOpen, onClose, user, isOwnProfile = true }) => {
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(false);
  const [formData, setFormData] = useState({
    description: user?.description || '',
    phone: user?.phone || '',
    instagram: user?.socialLinks?.instagram || '',
    facebook: user?.socialLinks?.facebook || '',
    linkedin: user?.socialLinks?.linkedin || '',
    whatsapp: user?.socialLinks?.whatsapp || ''
  });

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const userId = user?._id || user?.id;
    if (!userId) {
      alert('User ID not found');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://72.60.97.98:6006/api/user/${userId}/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.user) {
        const updatedUser = { ...user, avatar: data.user.avatar };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const userId = user?._id || user?.id;
    if (!userId) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://72.60.97.98:6006/api/user/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description: formData.description,
          phone: formData.phone,
          socialLinks: {
            instagram: formData.instagram,
            facebook: formData.facebook,
            linkedin: formData.linkedin,
            whatsapp: formData.whatsapp
          }
        })
      });
      const data = await res.json();
      if (data.data) {
        localStorage.setItem('user', JSON.stringify(data.data));
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      alert('Update failed');
    }
  };

  const socialLinks = user?.socialLinks || {};

  return (
    <>
      {/* Fullscreen Image Viewer */}
      {fullscreenImage && user?.avatar && (
        <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center" onClick={() => setFullscreenImage(false)}>
          <button onClick={() => setFullscreenImage(false)} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition text-white z-[101]">
            <X size={24} />
          </button>
          <img src={user.avatar} alt="Profile" className="max-w-[90vw] max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className={`fixed top-0 right-0 h-full w-[420px] bg-[#1A1D21] shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Profile</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto h-[calc(100%-80px)]" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          
          {/* Profile Picture */}
          <div className="flex justify-center mb-8 relative">
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" className="w-28 h-28 rounded-full object-cover border-4 border-purple-600 cursor-pointer hover:opacity-80 transition" onClick={() => setFullscreenImage(true)} />
            ) : (
              <div className="w-28 h-28 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white text-4xl font-bold border-4 border-purple-500">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            )}
            {isOwnProfile && (
              <label className="absolute bottom-0 right-[calc(50%-56px)] bg-purple-600 rounded-full p-2.5 shadow-lg cursor-pointer hover:bg-purple-700 transition">
                {uploading ? <span className="text-xs text-white">...</span> : <Upload size={18} className="text-white" />}
                <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} className="hidden" />
              </label>
            )}
          </div>

          {/* Name */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white">{user?.name || "User"}</h3>
            {user?.fullName && <p className="text-sm text-gray-400 mt-1">{user.fullName}</p>}
            <span className="inline-block mt-2 px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-xs font-medium">{user?.Role || user?.role || "User"}</span>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-purple-600 rounded"></span>
              About
            </h4>
            {editing ? (
              <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full p-3 bg-[#0f1115] border border-white/10 rounded-lg text-sm text-white focus:border-purple-600 focus:outline-none" rows={3} placeholder="Tell us about yourself..." />
            ) : (
              <p className="text-sm text-gray-400 bg-[#0f1115] p-3 rounded-lg">{user?.description || 'No description added yet'}</p>
            )}
          </div>

          {/* Contact Information */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-purple-600 rounded"></span>
              Contact Information
            </h4>
            <div className="space-y-3 bg-[#0f1115] p-4 rounded-lg">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 font-medium min-w-[60px]">Email:</span>
                <span className="text-white">{user?.email || "N/A"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 font-medium min-w-[60px]">Phone:</span>
                {editing ? (
                  <input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="flex-1 p-2 bg-[#1A1D21] border border-white/10 rounded text-sm text-white focus:border-purple-600 focus:outline-none" placeholder="Add phone number" />
                ) : (
                  <span className="text-white">{user?.phone || 'Not added'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-purple-600 rounded"></span>
              Social Links
            </h4>
            {editing ? (
              <div className="space-y-3">
                <input value={formData.instagram} onChange={(e) => setFormData({...formData, instagram: e.target.value})} placeholder="Instagram URL" className="w-full p-3 bg-[#0f1115] border border-white/10 rounded-lg text-sm text-white focus:border-purple-600 focus:outline-none" />
                <input value={formData.facebook} onChange={(e) => setFormData({...formData, facebook: e.target.value})} placeholder="Facebook URL" className="w-full p-3 bg-[#0f1115] border border-white/10 rounded-lg text-sm text-white focus:border-purple-600 focus:outline-none" />
                <input value={formData.linkedin} onChange={(e) => setFormData({...formData, linkedin: e.target.value})} placeholder="LinkedIn URL" className="w-full p-3 bg-[#0f1115] border border-white/10 rounded-lg text-sm text-white focus:border-purple-600 focus:outline-none" />
                <input value={formData.whatsapp} onChange={(e) => setFormData({...formData, whatsapp: e.target.value})} placeholder="WhatsApp URL" className="w-full p-3 bg-[#0f1115] border border-white/10 rounded-lg text-sm text-white focus:border-purple-600 focus:outline-none" />
              </div>
            ) : (
              <div className="flex gap-3 bg-[#0f1115] p-4 rounded-lg">
                {socialLinks.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-xl hover:opacity-80 transition shadow-lg">
                    <Instagram size={22} />
                  </a>
                )}
                {socialLinks.facebook && (
                  <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-600 text-white rounded-xl hover:opacity-80 transition shadow-lg">
                    <Facebook size={22} />
                  </a>
                )}
                {socialLinks.whatsapp && (
                  <a href={socialLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="p-3 bg-green-500 text-white rounded-xl hover:opacity-80 transition shadow-lg">
                    <MessageCircle size={22} />
                  </a>
                )}
                {socialLinks.linkedin && (
                  <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-700 text-white rounded-xl hover:opacity-80 transition shadow-lg">
                    <Linkedin size={22} />
                  </a>
                )}
                {!socialLinks.instagram && !socialLinks.facebook && !socialLinks.whatsapp && !socialLinks.linkedin && (
                  <p className="text-sm text-gray-500">No social links added yet</p>
                )}
              </div>
            )}
          </div>

          {/* Edit/Save Button */}
          {isOwnProfile && (
            <>
              <button onClick={() => { if (editing) handleSave(); else setEditing(true); }} className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition font-medium shadow-lg">
                {editing ? 'Save Changes' : 'Edit Profile'}
              </button>
              {editing && (
                <button onClick={() => setEditing(false)} className="w-full py-3 mt-3 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition font-medium">
                  Cancel
                </button>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
};

export default ProfileSession;
