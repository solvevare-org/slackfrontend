import { useState } from 'react'
import WorkspaceSidebar from './WorkspaceSidebar'
import Sidebar from './Sidebar'
import Header from './Header'

interface AppLayoutProps {
  children: React.ReactNode
  scrollable?: boolean
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, scrollable = false }) => {
  const [workspaceSidebarVisible, setWorkspaceSidebarVisible] = useState(false);
  const wsSidebarWidth = workspaceSidebarVisible ? 60 : 0;
  const sidebarWidth = 75;
  const leftOffset = wsSidebarWidth + sidebarWidth;
  
  return (
    <div className="flex h-full overflow-hidden">
      <WorkspaceSidebar onVisibilityChange={setWorkspaceSidebarVisible} />
      <div className="fixed top-0 h-full z-30" style={{ left: `${wsSidebarWidth}px` }}>
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col h-full" style={{ marginLeft: `${leftOffset}px` }}>
        <div className="fixed top-0 right-0 z-20 shadow-lg bg-gradient-to-r from-[#4A154B]/95 to-[#5B1A5C]/95 backdrop-blur-xl" style={{ left: `${leftOffset}px` }}>
          <Header />
        </div>
        <main className={`flex-1 pt-[65px] ${scrollable ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppLayout