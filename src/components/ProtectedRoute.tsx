import { Navigate } from 'react-router-dom'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const raw = localStorage.getItem('user')
  if (!raw) return <Navigate to="/login" replace />

  let user: any = null
  try {
    user = JSON.parse(raw)
  } catch (e) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole) {
    const role = (user?.role || user?.Role || '')?.toString?.().toLowerCase()
    if (role !== requiredRole.toString().toLowerCase()) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
}