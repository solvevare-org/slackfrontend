import { useParams } from 'react-router-dom'
import AppLayout from "@/components/layout/AppLayout"

const ChannelPage = () => {
  const { channelId } = useParams()

  return (
    <AppLayout>
      <div className="flex h-full bg-gray-50">
        {/* Sidebar */}
        <div className="w-64 bg-gray-900 text-white p-4">
          <h2 className="text-2xl font-bold mb-8">Slack Clone</h2>
          <div className="space-y-4">
            <button className="w-full text-left px-3 py-2 rounded bg-purple-600">
              # {channelId}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4">
            <h1 className="text-2xl font-bold text-gray-800"># {channelId}</h1>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-gray-500 text-center py-8">Welcome to #{channelId}</p>
          </div>

          {/* Input Area */}
          <div className="bg-white border-t border-gray-200 p-4">
            <input 
              type="text" 
              placeholder="Type a message..." 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default ChannelPage