import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const Signup = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [invite, setInvite] = useState<{ email?: string; role?: string } | null>(null)
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
          <div>
            <p className="text-sm text-gray-600 mb-4">You were invited as <strong>{invite.role}</strong> — {invite.email}</p>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <Input value={name} onChange={e=>setName(e.target.value)} className="mb-3" />
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mb-4" />
            {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
            <Button onClick={handleSubmit} disabled={loading} className="w-full">{loading ? 'Creating...' : 'Create account'}</Button>
          </div>
        ) : (
          <div className="text-sm text-gray-600">{error || 'Validating invite...'}</div>
        )}
      </div>
    </div>
  )
}

export default Signup
