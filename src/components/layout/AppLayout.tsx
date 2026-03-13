import { useState } from 'react'
import WorkspaceSidebar from './WorkspaceSidebar'
import Sidebar from './Sidebar'
import Header from './Header'

interface AppLayoutProps {
  children: React.ReactNode
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [workspaceSidebarVisible, setWorkspaceSidebarVisible] = useState(true);
  const leftOffset = workspaceSidebarVisible ? 135 : 75;
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Workspace icons sidebar */}
      <WorkspaceSidebar onVisibilityChange={setWorkspaceSidebarVisible} />

      {/* Original sidebar shifted right */}
      <div className={`fixed ${workspaceSidebarVisible ? 'left-[60px]' : 'left-0'} top-0 h-full z-30`}>
        <Sidebar />
      </div>
      
      {/* Main Content Area with margin for both sidebars */}
      <div className="flex-1 flex flex-col" style={{ marginLeft: `${leftOffset}px` }}>
        {/* Fixed Header - Top */}
        <div className="fixed top-0 right-0 z-20 shadow-lg" style={{ left: `${leftOffset}px`, backgroundColor: '#4A154B' }}>
          <Header />
        </div>
        
        {/* Scrollable Content with margin for header */}
        <main className="flex-1 overflow-auto pt-[80px]">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppLayout