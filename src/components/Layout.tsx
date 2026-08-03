import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isAdminPath = location.pathname.startsWith('/admin')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <nav className="bg-pendo-navy shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <Link to={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-pendo-pink flex items-center justify-center">
                  <span className="text-white font-bold text-sm">P</span>
                </div>
                <span className="text-white font-semibold text-base hidden sm:block">
                  Partner Enablement
                </span>
              </Link>

              {/* Nav links */}
              {isAdmin && (
                <div className="hidden md:flex items-center gap-1">
                  <Link
                    to="/admin"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                      ${location.pathname === '/admin' ? 'bg-white bg-opacity-20 text-white' : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10'}`}
                  >
                    Overview
                  </Link>
                  <Link
                    to="/admin/partners"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                      ${location.pathname.startsWith('/admin/partners') ? 'bg-white bg-opacity-20 text-white' : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10'}`}
                  >
                    Partners
                  </Link>
                  <Link
                    to="/admin/modules"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                      ${location.pathname === '/admin/modules' ? 'bg-white bg-opacity-20 text-white' : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10'}`}
                  >
                    Modules
                  </Link>
                </div>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {isAdmin && !isAdminPath && (
                <Link
                  to="/admin"
                  className="text-xs px-3 py-1.5 rounded-lg bg-pendo-pink text-white font-medium hover:bg-pendo-pink-dark transition-colors"
                >
                  Admin
                </Link>
              )}
              {isAdmin && isAdminPath && (
                <Link
                  to="/dashboard"
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-500 text-gray-300 font-medium hover:border-gray-300 hover:text-white transition-colors"
                >
                  Learner View
                </Link>
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-pendo-pink flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">
                    {(profile?.full_name ?? profile?.email ?? 'U')[0].toUpperCase()}
                  </span>
                </div>
                <span className="text-gray-300 text-sm hidden sm:block">
                  {profile?.full_name ?? profile?.email?.split('@')[0]}
                </span>
              </div>
              {user && (
                <button
                  onClick={handleSignOut}
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
