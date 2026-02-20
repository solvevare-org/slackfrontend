import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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
    fetch(`http://localhost:9000/api/auth/invite/validate?token=${encodeURIComponent(token)}`)
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
        const res = await fetch(`http://localhost:9000/api/auth/invite/accept-existing?token=${encodeURIComponent(token)}`, {
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
      const res = await fetch(`http://localhost:9000/api/auth/invite/accept?token=${encodeURIComponent(token)}`, {
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
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded shadow w-96">
        <h2 className="text-xl font-bold mb-4">Accept Invite</h2>
        {invite ? (
          invite.existingUser ? (
            <div>
              <p className="text-sm text-gray-600 mb-4">This email <strong>{invite.email}</strong> already has an account.</p>
              <p className="text-sm text-gray-600 mb-4">Please <strong>log in</strong> to accept the invite and join the workspace.</p>
              <div className="flex gap-2">
                <Button onClick={() => navigate(`/login?token=${encodeURIComponent(token || '')}`)} className="flex-1">Login to accept invite</Button>
                <Button variant="ghost" onClick={() => navigate('/login')}>Login</Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-4">You were invited as <strong>{invite.role}</strong> — {invite.email}</p>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <Input value={name} onChange={e=>setName(e.target.value)} className="mb-3" />
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mb-4" />
              {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
              <Button onClick={handleSubmit} disabled={loading} className="w-full">{loading ? 'Creating...' : 'Create account'}</Button>
            </div>
          )
        ) : (
          <div className="text-sm text-gray-600">{error || 'Validating invite...'}</div>
        )}
      </div>
    </div>
  )
}

export default Signup
