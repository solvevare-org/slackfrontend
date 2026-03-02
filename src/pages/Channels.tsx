import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import { Hash, Users, ArrowRight } from 'lucide-react'
import { API_URL } from '@/lib/config'

const Channels = () => {
  const navigate = useNavigate()
  const [channels, setChannels] = useState<any[]>([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { navigate('/login'); return }

    fetch(`${API_URL}/api/group/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const groups = Array.isArray(d?.groups) ? d.groups : []
        setChannels(groups)
      })
      .catch(() => {})
  }, [navigate])

  return (
    <AppLayout>
      <div className="flex h-screen bg-[#0f1115]">
        <div className="w-80 bg-[#1A1D21] border-r border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-600/20 rounded-lg">
              <Hash className="text-purple-400" size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white">Channels</h2>
          </div>
          
          <div className="space-y-2">
            {channels.length === 0 ? (
              <div className="text-sm text-gray-500 bg-[#0f1115] p-4 rounded-lg border border-white/10">
                No channels found
              </div>
            ) : (
              channels.map((c) => (
                <button 
                  key={c._id} 
                  onClick={() => navigate(`/group/${c._id}`)} 
                  className="w-full group flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/5 transition border border-transparent hover:border-purple-600/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-600/10 rounded-lg group-hover:bg-purple-600/20 transition">
                      <Hash size={18} className="text-purple-400" />
                    </div>
                    <span className="text-white font-medium">{c.name}</span>
                  </div>
                  <ArrowRight size={18} className="text-gray-500 group-hover:text-purple-400 transition" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="inline-flex p-4 bg-purple-600/10 rounded-full mb-4">
              <Users className="text-purple-400" size={48} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Select a Channel</h3>
            <p className="text-gray-400">Choose a channel from the sidebar to view and join the conversation.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default Channels
