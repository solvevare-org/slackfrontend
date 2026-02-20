import Sidebar from './Sidebar'
import Header from './Header'

interface AppLayoutProps {
  children: React.ReactNode
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
      <div className='bg-[rgb(74,21,75)]' >
        <div className="flex min-h-screen "><Sidebar/>
          <div className="flex-1 flex flex-col 'bg-[rgb(202, 190, 202)] ">
            <Header />
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </div>
  )
}

export default AppLayout