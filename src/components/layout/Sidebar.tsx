import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const Icon = ({ children }: { children: React.ReactNode }) => (
  <div className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-800 cursor-pointer">{children}</div>
)

const Sidebar: React.FC = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState('')
  const [fullname, setFullname] = useState('')

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) {
      const u = JSON.parse(raw)
      setUser(u)
      setNickname(u.name || '')
      setFullname(u.fullName || u.name || '')
    }
  }, [])

  const saveProfile = async () => {
    if (!user) return
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`http://localhost:9000/api/user/${user.id || user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: nickname, fullName: fullname })
      })
      const data = await res.json()
      if (data.data) {
        const updated = data.data
        const stored = JSON.parse(localStorage.getItem('user') || '{}')
        const merged = { ...stored, ...updated }
        localStorage.setItem('user', JSON.stringify(merged))
        setUser(merged)
        setEditing(false)
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="w-20 bg-gray-900 text-white flex flex-col items-center py-4 space-y-4">
      {/* Top profile image area */}
      <div className="w-full flex flex-col items-center">
        <div className="relative w-12 h-12 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center mb-2">
          {/* Avatar */}
          {user && user.avatar ? (
            <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-gray-900">{user ? (user.name ? user.name.charAt(0).toUpperCase() : 'U') : 'U'}</span>
          )}
          {/* edit overlay */}
          <button onClick={() => (document.getElementById('avatarInput') as HTMLInputElement)?.click()} className="absolute -right-1 -bottom-1 bg-white rounded-full p-1 shadow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 21v-3a4 4 0 014-4h0" stroke="#333" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14.5 6.5l3 3L8 19l-3 0 0-3 9.5-9.5z" stroke="#333" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <input id="avatarInput" type="file" accept="image/*" onChange={async (e) => {
            const f = e.target.files ? e.target.files[0] : null
            if (!f || !user) return
            if (f.size > 5 * 1024 * 1024) { alert('Max avatar size 5MB'); return }
            const fd = new FormData()
            fd.append('avatar', f)
            const token = localStorage.getItem('token')
            try {
              const res = await fetch(`http://localhost:9000/api/user/${user.id || user._id}/avatar`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } })
              const data = await res.json()
              if (data.user) {
                const updated = data.user
                const stored = JSON.parse(localStorage.getItem('user') || '{}')
                const merged = { ...stored, ...updated }
                localStorage.setItem('user', JSON.stringify(merged))
                setUser(merged)
              }
            } catch (err) { console.error(err) }
          }} className="hidden" />
        </div>
        <div className="text-xs text-center">
          <div className="font-medium">{user ? user.name : 'User'}</div>
        </div>
      </div>

      {/* Nav icons */}
      <div className="flex-1 flex flex-col items-center gap-2 mt-4">
        <button onClick={() => navigate('/dashboard')} title="Home">
          <Icon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Icon>
        </button>

        <button onClick={() => navigate('/dashboard')} title="DMs">
          <Icon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Icon>
        </button>

        <button onClick={() => {}} title="Activity">
          <Icon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 12h3l3 8 4-16 3 8h4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Icon>
        </button>

        <button onClick={() => {}} title="Files">
          <Icon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Icon>
        </button>

        <div className="mt-4" />
        <button title="More" onClick={() => {}}>
          <Icon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="1" fill="#fff"/><circle cx="19" cy="12" r="1" fill="#fff"/><circle cx="5" cy="12" r="1" fill="#fff"/></svg>
          </Icon>
        </button>
      </div>

      {/* Bottom add button */}
      <div className="w-full flex flex-col items-center">
        <button onClick={() => alert('Add action')} className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-purple-700">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Profile editor modal-like area */}
      {editing && (
        <div className="absolute left-24 top-6 w-72 bg-white text-black p-4 rounded shadow">
          <h4 className="font-semibold mb-2">Edit Profile</h4>
          <div className="mb-2">
            <label className="text-xs">Nickname</label>
            <input className="w-full border px-2 py-1" value={nickname} onChange={e=>setNickname(e.target.value)} />
          </div>
          <div className="mb-2">
            <label className="text-xs">Full name</label>
            <input className="w-full border px-2 py-1" value={fullname} onChange={e=>setFullname(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={()=>setEditing(false)} className="px-3 py-1 border rounded">Cancel</button>
            <button onClick={saveProfile} className="px-3 py-1 bg-purple-600 text-white rounded">Save</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar