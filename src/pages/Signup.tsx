import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { UserPlus, Mail, Lock, Sparkles, CheckCircle, AlertCircle } from 'lucide-react'

const Signup = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [invite, setInvite] = useState<{ email?: string; role?: string; existingUser?: boolean } | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`http://72.60.97.98:6006/api/auth/invite/validate?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.email) setInvite(data)
        else setError(data.msg || 'Invalid invite')
      }).catch(()=>setError('Server error'))
  }, [token])

  // If viewer is already authenticated, try to accept invite directly and add them to workspace
  useEffect(() => {
    const tryAcceptForLoggedIn = async () => {
      if (!token) return
      const localUser = localStorage.getItem('user')
      const localToken = localStorage.getItem('token')
      if (!localUser || !localToken) return

      try {
        const res = await fetch(`http://72.60.97.98:6006/api/auth/invite/accept-existing?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localToken}` },
        })
        const data = await res.json()
        if (!res.ok) {
          // not fatal: leave signup flow
          return
        }
        // success: if workspace info returned, save currentWorkspace and navigate into it
        if (data.workspaceId) {
          try { localStorage.setItem('currentWorkspace', JSON.stringify({ id: data.workspaceId, name: data.workspaceName || 'Workspace', members: [] })); } catch(e){}
          const namePart = encodeURIComponent(data.workspaceName || 'workspace')
          navigate(`/dashboard/${namePart}/${data.workspaceId}`)
        } else {
          // generic success
          navigate('/dashboard')
        }
      } catch (e) {}
    }

    tryAcceptForLoggedIn()
  }, [token, navigate])

  const handleSubmit = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`http://72.60.97.98:6006/api/auth/invite/accept?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
        credentials: 'include'
      })
      const result = await res.json()
      if (!res.ok) { setError(result.msg || 'Signup failed'); return }
      // success -> save token and user and navigate according to role
      if (result.access) {
        localStorage.setItem('token', result.access)
      }
      if (result.user) {
        localStorage.setItem('user', JSON.stringify(result.user))
        const role = result.user?.role?.toString?.().toLowerCase()
        if (role === 'admin') navigate('/admin')
        else navigate('/dashboard')
      } else {
        navigate('/login')
      }
    } catch (e) {
      setError('Server error')
    } finally { setLoading(false) }
  }

  if (!token) return <div className="p-8">Invalid invite link.</div>

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#1a1d21] to-[#0f1115] p-6">
      <div className="bg-gradient-to-br from-[#1a1d21]/90 to-[#0f1115]/90 backdrop-blur-xl border border-purple-500/30 p-10 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-purple-500/20 rounded-xl">
            <UserPlus className="w-7 h-7 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Accept Invite</h2>
            <p className="text-sm text-gray-400">Join your team workspace</p>
          </div>
        </div>
        
        {invite ? (
          invite.existingUser ? (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-300 mb-1">This email <span className="font-semibold text-white">{invite.email}</span> already has an account.</p>
                    <p className="text-sm text-gray-400">Please log in to accept the invite and join the workspace.</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => navigate(`/login?token=${encodeURIComponent(token || '')}`)} className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-900/50">
                  Login to Accept
                </Button>
                <Button variant="ghost" onClick={() => navigate('/login')} className="hover:bg-white/10 text-gray-300">Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-semibold text-white">Invitation Details</span>
                </div>
                <p className="text-sm text-gray-300">Role: <span className="font-semibold text-purple-300">{invite.role}</span></p>
                <p className="text-sm text-gray-300">Email: <span className="font-semibold text-purple-300">{invite.email}</span></p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <Input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name" className="bg-[#0a0b0d]/50 border-purple-500/30 text-white placeholder:text-gray-500 focus:border-purple-500" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                  <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Create a password" className="bg-[#0a0b0d]/50 border-purple-500/30 text-white placeholder:text-gray-500 focus:border-purple-500 pl-11" />
                </div>
              </div>
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
              
              <Button onClick={handleSubmit} disabled={loading} className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-900/50 py-6 text-base font-semibold">
                {loading ? 'Creating Account...' : 'Create Account & Join'}
              </Button>
            </div>
          )
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/10 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
            </div>
            <p className="text-sm text-gray-400">{error || 'Validating your invite...'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Signup
