'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@account-kit/react';

interface EmployerDashboardProps {
  companyName?: string;
}

export default function EmployerDashboard({ companyName }: EmployerDashboardProps) {
  const { theme } = useTheme();
  const user = useUser();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
      {/* Main Content */}
      <div className={`
        max-w-4xl w-full rounded-2xl shadow-2xl p-8 md:p-12 text-center
        ${theme === 'dark' 
          ? 'bg-brand-sage-light/10 backdrop-blur-xl border border-brand-mint/30' 
          : 'bg-white/80 backdrop-blur-xl border border-brand-sage/40'
        }
      `}>
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-brand-mint to-teal-600 mb-6 shadow-lg shadow-brand-mint/30">
          <span className="text-5xl">🏢</span>
        </div>

        {/* Welcome Message */}
        <h1 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'}`}>
          Welcome, {companyName || 'Employer'}!
        </h1>
        
        <p className={`text-xl mb-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Your employer dashboard is coming soon
        </p>

        {/* Features Coming Soon */}
        <div className="grid md:grid-cols-2 gap-6 mb-8 text-left">
          {[
            {
              icon: '📋',
              title: 'Post Job Openings',
              description: 'Create and manage job listings for qualified drivers'
            },
            {
              icon: '👥',
              title: 'Review Applicants',
              description: 'Browse and filter applications from verified drivers'
            },
            {
              icon: '✓',
              title: 'Verify Credentials',
              description: 'Instantly verify blockchain-certified DQ files'
            },
            {
              icon: '📊',
              title: 'Hiring Pipeline',
              description: 'Track candidates from application to hire'
            }
          ].map((feature, idx) => (
            <div
              key={idx}
              className={`
                p-6 rounded-xl border-2 transition-all duration-300 hover:scale-105
                ${theme === 'dark'
                  ? 'bg-brand-sage-light/10 border-brand-mint/30 hover:border-brand-mint/50'
                  : 'bg-white border-brand-sage/30 hover:border-brand-sage/50 shadow-lg'
                }
              `}
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'}`}>
                {feature.title}
              </h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Coming Soon Badge */}
        <div className={`
          inline-flex items-center gap-2 px-6 py-3 rounded-full shadow-lg
          ${theme === 'dark'
            ? 'bg-brand-mint/20 border-2 border-brand-mint'
            : 'bg-brand-mint/20 border-2 border-brand-mint'
          }
        `}>
          <span className="text-2xl">🚀</span>
          <span className={`font-semibold ${theme === 'dark' ? 'text-brand-mint' : 'text-teal-700'}`}>
            Employer Features Launching Soon
          </span>
        </div>

        {/* Temporary Note */}
        <div className={`
          mt-8 p-4 rounded-lg
          ${theme === 'dark'
            ? 'bg-brand-sage-light/10 border border-brand-mint/30'
            : 'bg-brand-sage/10 border border-brand-sage/30'
          }
        `}>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            💡 <strong>Note:</strong> We're actively building employer features. In the meantime, you can explore the platform and we'll notify you when your dashboard is ready!
          </p>
        </div>

        {/* User Info */}
        {user && (
          <div className={`
            mt-6 pt-6 border-t
            ${theme === 'dark' ? 'border-brand-mint/30' : 'border-brand-sage/30'}
          `}>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
              Logged in as: <span className="font-mono">{user.address?.slice(0, 6)}...{user.address?.slice(-4)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

