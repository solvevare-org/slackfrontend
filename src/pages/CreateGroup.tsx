import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface IUser { _id: string; name?: string }

const CreateGroup = () => {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [admins, setAdmins] = useState<string[]>([])
  const [showUserPicker, setShowUserPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!pickerRef.current) return
      if (!(e.target instanceof Node)) return
      if (!pickerRef.current.contains(e.target)) setShowUserPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const [allUsers, setAllUsers] = useState<IUser[]>([])
  const [image, setImage] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch('http://localhost:9000/api/user/', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.result)) setAllUsers(d.result) })
      .catch(() => {})
  }, [])

  const toggleMember = (id: string) => setMembers(m => {
    const exists = m.includes(id)
    if (exists) {
      // remove member and also remove from admins
      setAdmins(a => a.filter(x => x !== id))
      return m.filter(x => x !== id)
    }
    return [...m, id]
  })

  const toggleAdmin = (id: string) => setAdmins(a => a.includes(id) ? a.filter(x=>x!==id) : [...a, id])

  const handleCreate = async () => {
    if (creating) return
    setMessage('')
    setCreating(true)
    try {
      const token = localStorage.getItem('token')
      const fd = new FormData()
      fd.append('name', name)
      fd.append('members', JSON.stringify(members))
      fd.append('admins', JSON.stringify(admins))
      if (image) fd.append('image', image)
      const res = await fetch('http://localhost:9000/api/group', { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) setMessage(data.msg || 'Create failed')
      else {
        setMessage('Group created')
        const id = data?.group?._id || data?.group?.id
        if (id) navigate(`/group/${id}`)
        else navigate('/dashboard')
      }
    } catch (e) { setMessage('Server error') }
    finally { setCreating(false) }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-semibold mb-4">Create Group</h1>
        <label className="text-sm">Group Name</label>
        <Input value={name} onChange={e=>setName((e.target as HTMLInputElement).value)} />

        <label className="text-sm mt-4 block">Members</label>
        <div className="relative mt-2">
          <div className="flex items-center justify-between border p-2 rounded">
            <div className="text-sm text-gray-700">{members.length ? `${members.length} selected` : 'No members selected'}</div>
            <button onClick={(e) => { e.stopPropagation(); setShowUserPicker(s => !s); }} className="p-2 rounded bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>

          {showUserPicker && (
            <div ref={pickerRef} className="absolute left-0 right-0 mt-2 bg-white border rounded shadow max-h-60 overflow-y-auto z-50 p-2">
              {allUsers.map(u => (
                <div key={u._id} className="flex items-center justify-between p-1">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={members.includes(u._id)} onChange={() => toggleMember(u._id)} />
                    <div>{u.name}</div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={admins.includes(u._id)} onChange={() => {
                      if (!admins.includes(u._id) && !members.includes(u._id)) toggleMember(u._id)
                      toggleAdmin(u._id)
                    }} />
                    <div>Admin</div>
                  </label>
                </div>
              ))}
              <div className="flex justify-end mt-2">
                <button onClick={() => setShowUserPicker(false)} className="text-sm text-gray-500">Close</button>
              </div>
            </div>
          )}
        </div>

        <label className="text-sm mt-4 block">Group Image (optional)</label>
        <input type="file" onChange={e=>setImage(e.target.files?e.target.files[0]:null)} className="mt-2" />

        {message && <div className="mt-4 text-sm text-gray-700">{message}</div>}

        <div className="mt-4 flex gap-2">
          <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creating...' : 'Create Group'}</Button>
          <Button onClick={() => navigate('/dashboard')} variant="ghost">Cancel</Button>
        </div>
      </div>
    </div>
  )
}

export default CreateGroup
