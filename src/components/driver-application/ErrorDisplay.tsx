'use client'

import React from 'react'
import { ValidationError, ValidationResult } from '@/lib/validation'

interface ErrorDisplayProps {
  validation: ValidationResult
  className?: string
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  validation,
  className = '',
}) => {
  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    return null
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className='bg-red-50 border border-red-200 rounded-md p-4'>
          <div className='flex items-start'>
            <div className='flex-shrink-0'>
              <svg
                className='h-5 w-5 text-red-400'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <div className='ml-3'>
              <h3 className='text-sm font-medium text-red-800'>
                Please fix the following errors:
              </h3>
              <ul className='mt-2 text-sm text-red-700 list-disc list-inside space-y-1'>
                {validation.errors.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className='bg-yellow-50 border border-yellow-200 rounded-md p-4'>
          <div className='flex items-start'>
            <div className='flex-shrink-0'>
              <svg
                className='h-5 w-5 text-yellow-400'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <div className='ml-3'>
              <h3 className='text-sm font-medium text-yellow-800'>
                Please review the following warnings:
              </h3>
              <ul className='mt-2 text-sm text-yellow-700 list-disc list-inside space-y-1'>
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface FieldErrorProps {
  field: string
  validation: ValidationResult
  className?: string
}

export const FieldError: React.FC<FieldErrorProps> = ({
  field,
  validation,
  className = '',
}) => {
  const fieldErrors = validation.errors.filter((error) => error.field === field)
  const fieldWarnings = validation.warnings.filter(
    (warning) => warning.field === field
  )

  if (fieldErrors.length === 0 && fieldWarnings.length === 0) {
    return null
  }

  return (
    <div className={`mt-1 space-y-1 ${className}`}>
      {fieldErrors.map((error, index) => (
        <p key={index} className='text-sm text-red-600 flex items-center'>
          <svg
            className='h-4 w-4 text-red-400 mr-1'
            viewBox='0 0 20 20'
            fill='currentColor'
          >
            <path
              fillRule='evenodd'
              d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
              clipRule='evenodd'
            />
          </svg>
          {error.message}
        </p>
      ))}
      {fieldWarnings.map((warning, index) => (
        <p key={index} className='text-sm text-yellow-600 flex items-center'>
          <svg
            className='h-4 w-4 text-yellow-400 mr-1'
            viewBox='0 0 20 20'
            fill='currentColor'
          >
            <path
              fillRule='evenodd'
              d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
              clipRule='evenodd'
            />
          </svg>
          {warning.message}
        </p>
      ))}
    </div>
  )
}

interface ValidationSummaryProps {
  validation: ValidationResult
  onDismiss?: () => void
  className?: string
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  validation,
  onDismiss,
  className = '',
}) => {
  const totalIssues = validation.errors.length + validation.warnings.length

  if (totalIssues === 0) {
    return null
  }

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}
    >
      <div className='flex items-start justify-between'>
        <div className='flex items-start'>
          <div className='flex-shrink-0'>
            {validation.errors.length > 0 ? (
              <svg
                className='h-5 w-5 text-red-400'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
            ) : (
              <svg
                className='h-5 w-5 text-yellow-400'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                  clipRule='evenodd'
                />
              </svg>
            )}
          </div>
          <div className='ml-3'>
            <h3
              className={`text-sm font-medium ${
                validation.errors.length > 0
                  ? 'text-red-800'
                  : 'text-yellow-800'
              }`}
            >
              {validation.errors.length > 0
                ? `Please fix ${validation.errors.length} error${validation.errors.length !== 1 ? 's' : ''}`
                : `${validation.warnings.length} warning${validation.warnings.length !== 1 ? 's' : ''} to review`}
            </h3>
            {validation.warnings.length > 0 &&
              validation.errors.length === 0 && (
                <p className='text-sm text-yellow-700 mt-1'>
                  You can proceed, but please review the warnings below.
                </p>
              )}
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className='text-gray-400 hover:text-gray-600'
          >
            <svg className='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'>
              <path
                fillRule='evenodd'
                d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default ErrorDisplay
