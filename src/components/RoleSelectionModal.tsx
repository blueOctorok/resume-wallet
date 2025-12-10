'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface RoleSelectionModalProps {
  onSelectRole: (role: 'driver' | 'employer') => void;
  isLoading?: boolean;
}

export default function RoleSelectionModal({ onSelectRole, isLoading }: RoleSelectionModalProps) {
  const { theme } = useTheme();
  const [selectedRole, setSelectedRole] = useState<'driver' | 'employer' | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;
    
    // Lock scroll on mount
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    
    // Restore on unmount
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
    };
  }, []);

  const handleConfirm = () => {
    if (selectedRole) {
      onSelectRole(selectedRole);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto overscroll-none"
      style={{ touchAction: 'none' }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        style={{ touchAction: 'none' }}
      />
      
      {/* Modal - scrollable container */}
      <div 
        className={`
          relative max-w-3xl w-full rounded-xl sm:rounded-2xl shadow-2xl 
          my-auto max-h-[95vh] flex flex-col overflow-hidden
          ${theme === 'dark' 
            ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700' 
            : 'bg-gradient-to-br from-white via-gray-50 to-white border border-gray-200'
          }
        `}
        style={{ touchAction: 'auto' }}
      >
        {/* Scrollable content wrapper */}
        <div className="overflow-y-auto overscroll-contain flex-1">
          {/* Header */}
          <div className={`p-4 sm:p-8 text-center border-b ${theme === 'dark' ? 'border-brand-mint/30' : 'border-brand-sage/30'}`}>
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-brand-sage to-brand-mint mb-3 sm:mb-4">
              <span className="text-2xl sm:text-3xl">👋</span>
            </div>
            <h2 className={`text-xl sm:text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'}`}>
              Welcome to Veree!
            </h2>
            <p className={`text-sm sm:text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Let's get you set up. Are you a driver or an employer?
            </p>
          </div>

          {/* Role Options */}
          <div className="p-4 sm:p-8 grid gap-4 sm:gap-6 md:grid-cols-2">
            {/* Driver Option */}
            <button
              onClick={() => setSelectedRole('driver')}
              disabled={isLoading}
              className={`
                group relative p-4 sm:p-6 rounded-lg sm:rounded-xl transition-all duration-300 text-left
                ${selectedRole === 'driver'
                  ? theme === 'dark'
                    ? 'bg-gradient-to-br from-brand-sage to-brand-sage-dark border-2 border-brand-mint shadow-lg shadow-brand-mint/50'
                    : 'bg-gradient-to-br from-brand-sage to-brand-sage-dark border-2 border-brand-sage shadow-lg shadow-brand-sage/50'
                  : theme === 'dark'
                    ? 'bg-brand-sage-light/10 border-2 border-brand-mint/30 hover:border-brand-mint hover:bg-brand-sage-light/20'
                    : 'bg-white border-2 border-brand-sage/30 hover:border-brand-sage hover:bg-brand-sage/5'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98] sm:hover:scale-[1.02]'}
              `}
            >
              {/* Icon */}
              <div className={`
                inline-flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-lg mb-3 sm:mb-4
                ${selectedRole === 'driver'
                  ? 'bg-white/20'
                  : theme === 'dark'
                    ? 'bg-brand-mint/20 group-hover:bg-brand-mint/30'
                    : 'bg-brand-sage/20 group-hover:bg-brand-sage/30'
                }
              `}>
                <span className="text-2xl sm:text-3xl">🚗</span>
              </div>

              {/* Content */}
              <h3 className={`text-lg sm:text-2xl font-bold mb-1 sm:mb-2 ${selectedRole === 'driver' ? 'text-white' : theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'}`}>
                I'm a Driver
              </h3>
              <p className={`text-xs sm:text-sm mb-3 sm:mb-4 ${selectedRole === 'driver' ? 'text-brand-cream/90' : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Apply for jobs and build your verified DQ file
              </p>

              {/* Features */}
              <ul className="space-y-1.5 sm:space-y-2">
                {[
                  'Upload resume & credentials',
                  'Complete DOT applications',
                  'Browse & apply for jobs',
                  'Blockchain-verified credentials'
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm">
                    <span className={selectedRole === 'driver' ? 'text-brand-mint/90' : theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}>✓</span>
                    <span className={selectedRole === 'driver' ? 'text-white' : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                      {feature}
                    </span>
                  </li>
                ))}
            </ul>

              {/* Selected Indicator */}
              {selectedRole === 'driver' && (
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-brand-sage" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>

            {/* Employer Option */}
            <button
              onClick={() => setSelectedRole('employer')}
              disabled={isLoading}
              className={`
                group relative p-4 sm:p-6 rounded-lg sm:rounded-xl transition-all duration-300 text-left
                ${selectedRole === 'employer'
                  ? theme === 'dark'
                    ? 'bg-gradient-to-br from-brand-mint to-teal-600 border-2 border-brand-mint shadow-lg shadow-brand-mint/50'
                    : 'bg-gradient-to-br from-brand-mint to-teal-600 border-2 border-brand-mint shadow-lg shadow-brand-mint/50'
                  : theme === 'dark'
                    ? 'bg-brand-sage-light/10 border-2 border-brand-mint/30 hover:border-brand-mint hover:bg-brand-sage-light/20'
                    : 'bg-white border-2 border-brand-sage/30 hover:border-brand-mint hover:bg-brand-mint/5'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98] sm:hover:scale-[1.02]'}
              `}
            >
              {/* Icon */}
              <div className={`
                inline-flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-lg mb-3 sm:mb-4
                ${selectedRole === 'employer'
                  ? 'bg-white/20'
                  : theme === 'dark'
                    ? 'bg-brand-mint/20 group-hover:bg-brand-mint/30'
                    : 'bg-brand-mint/20 group-hover:bg-brand-mint/30'
                }
              `}>
                <span className="text-2xl sm:text-3xl">🏢</span>
              </div>

              {/* Content */}
              <h3 className={`text-lg sm:text-2xl font-bold mb-1 sm:mb-2 ${selectedRole === 'employer' ? 'text-white' : theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'}`}>
                I'm an Employer
              </h3>
              <p className={`text-xs sm:text-sm mb-3 sm:mb-4 ${selectedRole === 'employer' ? 'text-white/90' : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Post jobs and hire verified drivers
              </p>

              {/* Features */}
              <ul className="space-y-1.5 sm:space-y-2">
                {[
                  'Post job openings',
                  'Review qualified applicants',
                  'Verify driver credentials',
                  'Manage hiring pipeline'
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm">
                    <span className={selectedRole === 'employer' ? 'text-white/80' : theme === 'dark' ? 'text-brand-mint' : 'text-brand-mint'}>✓</span>
                    <span className={selectedRole === 'employer' ? 'text-white' : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Selected Indicator */}
              {selectedRole === 'employer' && (
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-brand-mint" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          </div>

          {/* Footer */}
          <div className={`p-4 sm:p-8 pt-0 flex justify-center border-t ${theme === 'dark' ? 'border-brand-mint/30' : 'border-brand-sage/30'}`}>
            <button
              onClick={handleConfirm}
              disabled={!selectedRole || isLoading}
              className={`
                w-full sm:w-auto px-6 sm:px-8 py-3 rounded-lg font-semibold text-base sm:text-lg transition-all duration-300
                ${selectedRole && !isLoading
                  ? selectedRole === 'driver'
                    ? 'bg-gradient-to-r from-brand-sage to-brand-sage-dark hover:from-brand-sage-dark hover:to-brand-sage text-white shadow-lg shadow-brand-sage/50 active:scale-[0.98] sm:hover:scale-105'
                    : 'bg-gradient-to-r from-brand-mint to-teal-600 hover:from-teal-600 hover:to-brand-mint text-white shadow-lg shadow-brand-mint/50 active:scale-[0.98] sm:hover:scale-105'
                  : theme === 'dark'
                    ? 'bg-brand-sage-light/20 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Setting up...
                </span>
              ) : selectedRole ? (
                `Continue as ${selectedRole === 'driver' ? 'Driver' : 'Employer'}`
              ) : (
                'Select a role to continue'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

