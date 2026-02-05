import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const Admin = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('User')
  const [message, setMessage] = useState('')
  const [previewLink, setPreviewLink] = useState('')
  const [showSocial, setShowSocial] = useState(false)

  const handleInvite = async () => {
    setMessage('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:9000/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, role })
      })
      const data = await res.json()
      if (!res.ok) setMessage(data.msg || 'Invite failed')
      else setMessage(`Invite sent. Link: ${data.link}`)
    } catch (e) {
      setMessage('Server error')
    }
  }

  const handlePreview = async () => {
    setPreviewLink('')
    setMessage('')
    try {
      const token = localStorage.getItem('token')
      const url = new URL('http://localhost:9000/api/auth/invite/preview')
      url.searchParams.set('email', email)
      url.searchParams.set('role', role)
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) setMessage(data.msg || 'Preview failed')
      else {
        setPreviewLink(data.link)
        // try to copy to clipboard
        try {
          await navigator.clipboard.writeText(data.link)
          setMessage('Link generated and copied to clipboard')
        } catch (err) {
          setMessage('Link generated (could not copy automatically)')
        }
        return data.link
      }
    } catch (e) {
      setMessage('Server error')
      return null
    }
  }

  const handleSocialShare = async (platform: 'facebook' | 'whatsapp' | 'instagram') => {
    const link = await handlePreview()
    if (!link) return
    if (platform === 'facebook') {
      const share = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`
      window.open(share, '_blank')
    } else if (platform === 'whatsapp') {
      const share = `https://wa.me/?text=${encodeURIComponent('You are invited: ' + link)}`
      window.open(share, '_blank')
    } else if (platform === 'instagram') {
      try {
        await navigator.clipboard.writeText(link)
        alert('Invite link copied to clipboard. Paste it in Instagram.')
      } catch (e) {
        alert('Could not copy link. Please copy manually: ' + link)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Admin Dashboard</h1>
          <p className="text-gray-600 mb-6">Invite users by email</p>

          <div className="space-y-4">
            <div className="border border-gray-200 rounded p-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Invite User</h2>
              <div className="grid gap-2">
                <label className="text-sm">Email</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} />
                <label className="text-sm">Role</label>
                <select value={role} onChange={e=>setRole(e.target.value)} className="p-2 border rounded">
                  <option>Developer</option>
                  <option>Sales</option>
                  <option>User</option>
                  <option>Admin</option>
                </select>
                <div className="flex gap-2">
                  <Button onClick={() => setShowSocial(s => !s)} className="mt-2">Add Via Social</Button>
                  <Button onClick={handleInvite} className="mt-2">Send Invite</Button>
                </div>
                {message && <div className="text-sm text-gray-700 mt-2">{message}</div>}
                {showSocial && (
                  <div className="flex items-center gap-3 mt-3">
                    <button title="Share via Facebook" aria-label="Share via Facebook" onClick={() => handleSocialShare('facebook')} className="p-2 rounded-full bg-blue-600 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.07C22 6.48 17.52 2 11.93 2S2 6.48 2 12.07C2 17.09 5.66 21.25 10.44 21.95v-6.96H7.9v-2.99h2.54V9.41c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.25c-1.23 0-1.61.77-1.61 1.56v1.87h2.74l-.44 2.99h-2.3V21.95C18.34 21.25 22 17.09 22 12.07z"/></svg>
                    </button>
                    <button title="Share via Instagram" aria-label="Share via Instagram (copies link)" onClick={() => handleSocialShare('instagram')} className="p-2 rounded-full bg-pink-500 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6.3A4.7 4.7 0 1 0 16.7 13 4.7 4.7 0 0 0 12 8.3zm6.4-.9a1.1 1.1 0 1 0 1.1 1.1 1.1 1.1 0 0 0-1.1-1.1z"/></svg>
                    </button>
                    <button title="Share via WhatsApp" aria-label="Share via WhatsApp" onClick={() => handleSocialShare('whatsapp')} className="p-2 rounded-full bg-green-500 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A11.9 11.9 0 0 0 12 .5C5.65.5.98 5.17.98 11.52c0 2.02.53 3.9 1.46 5.57L.5 23l6.16-1.6a11.43 11.43 0 0 0 5.34 1.2c6.35 0 11.02-4.67 11.02-11.02 0-2.95-1.15-5.7-3.52-7.08zM12 20.02c-1.7 0-3.36-.45-4.8-1.3l-.34-.2-3.66.95.98-3.57-.22-.36A8.07 8.07 0 0 1 3 11.52c0-4.95 4.03-8.98 9-8.98s9 4.03 9 8.98-4.03 8.98-9 8.98z"/></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded p-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Other Admin Tools</h2>
              <p className="text-gray-600">Manage channels, projects and users.</p>
            </div>
          </div>

          <Button onClick={() => navigate('/dashboard')} className="mt-6">
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Admin
