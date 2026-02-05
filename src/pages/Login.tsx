import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoginSchema, type LoginSchemaType } from '@/schema/loginSchema'
import { useState, useEffect } from 'react'

const Login = () => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Check if already logged in
  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      const u = JSON.parse(user)
      const role = u?.role?.toString?.().toLowerCase()
      // Navigate all users (including admin) to the dashboard
      navigate('/dashboard')
    }
  }, [navigate])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginSchemaType>({
    resolver: zodResolver(LoginSchema),
  })

  const onSubmit = async (data: LoginSchemaType) => {
  try {
    setIsLoading(true)
    setError("")

    const response = await fetch("http://localhost:9000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data),
      credentials: "include" // important for cookies
    })

    const result = await response.json()

    if (!response.ok) {
      setError(result.msg || "Login failed")
      return
    }

    // Save token
    localStorage.setItem("token", result.access)
    localStorage.setItem("user", JSON.stringify(result.user))

    // Navigate all users (including admin) to the dashboard
    navigate('/dashboard')

  } catch (error) {
    setError("Server error")
  } finally {
    setIsLoading(false)
  }
}


  const handleGuestLogin = () => {
    const guestUser = {
      email: 'guest@example.com',
      password: 'guest123'
    }
    localStorage.setItem('user', JSON.stringify(guestUser))
    navigate('/dashboard')
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-600 to-blue-600">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-96">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Slack Clone</h1>
        <p className="text-gray-600 text-center mb-8">Sign in to your account</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              className="w-full"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <Input
              type="password"
              placeholder="••••••"
              {...register('password')}
              className="w-full"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleGuestLogin}
          variant="outline"
          className="w-full"
        >
          Continue as Guest
        </Button>

        <p className="text-gray-600 text-xs text-center mt-6 bg-blue-50 p-3 rounded">
          <strong>Demo:</strong> demo@example.com / password123<br/>
          <strong>Guest:</strong> Click "Continue as Guest" button
        </p>
      </div>
    </div>
  )
}

export default Login