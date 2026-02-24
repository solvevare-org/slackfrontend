import Sidebar from './Sidebar'
import Header from './Header'

interface AppLayoutProps {
  children: React.ReactNode
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-[#4A154B]">
      {/* Fixed Sidebar - Left */}
      <div className="fixed left-0 top-0 h-full z-30">
        <Sidebar />
      </div>
      
      {/* Main Content Area with margin for sidebar */}
      <div className="flex-1 flex flex-col ml-[75px]">
        {/* Fixed Header - Top */}
        <div className="fixed top-0 right-0 left-[75px] z-20 bg-[#4A154B] shadow-lg">
          <Header />
        </div>
        
        {/* Scrollable Content with margin for header */}
        <main className="flex-1 overflow-auto pt-[72px]">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppLayout