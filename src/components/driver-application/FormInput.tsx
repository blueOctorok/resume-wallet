'use client'

import React from 'react'
import { FieldError } from './ErrorDisplay'
import { ValidationResult } from '@/lib/validation'
import { useTheme } from '@/contexts/ThemeContext'

interface FormInputProps {
  label: string
  name: string
  type?: 'text' | 'email' | 'tel' | 'date' | 'number' | 'password'
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  validation?: ValidationResult
  className?: string
  helpText?: string
  maxLength?: number
  min?: number
  max?: number
  step?: number
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  validation,
  className = '',
  helpText,
  maxLength,
  min,
  max,
  step,
}) => {
  const { theme } = useTheme()
  const hasError =
    validation?.errors.some((error) => error.field === name) || false
  const hasWarning =
    validation?.warnings.some((warning) => warning.field === name) || false

  const inputClasses = `
    w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent
    ${
      hasError
        ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500'
        : hasWarning
          ? 'border-yellow-300 bg-yellow-50 focus:ring-yellow-500 focus:border-yellow-500'
          : theme !== 'dark'
            ? 'border-gray-300 focus:ring-teal-500'
            : 'border-gray-300 focus:ring-teal-500'
    }
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
    ${className}
  `.trim()

  return (
    <div className='space-y-1'>
      <label
        className={`block text-sm font-medium ${
          theme !== 'dark' ? 'text-gray-700' : 'text-white'
        }`}
      >
        {label}
        {required && <span className='text-red-400 ml-1'>*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClasses}
        maxLength={maxLength}
        min={min}
        max={max}
        step={step}
      />
      {helpText && (
        <p
          className={`text-xs ${
            theme !== 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          {helpText}
        </p>
      )}
      {validation && <FieldError field={name} validation={validation} />}
    </div>
  )
}

interface FormSelectProps {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
  validation?: ValidationResult
  className?: string
  helpText?: string
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  required = false,
  disabled = false,
  validation,
  className = '',
  helpText,
}) => {
  const { theme } = useTheme()
  const hasError =
    validation?.errors.some((error) => error.field === name) || false
  const hasWarning =
    validation?.warnings.some((warning) => warning.field === name) || false

  const selectClasses = `
    w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent
    ${
      hasError
        ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500'
        : hasWarning
          ? 'border-yellow-300 bg-yellow-50 focus:ring-yellow-500 focus:border-yellow-500'
          : theme !== 'dark'
            ? 'border-gray-300 focus:ring-teal-500'
            : 'border-gray-300 focus:ring-teal-500'
    }
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
    ${className}
  `.trim()

  return (
    <div className='space-y-1'>
      <label
        className={`block text-sm font-medium ${
          theme !== 'dark' ? 'text-gray-700' : 'text-white'
        }`}
      >
        {label}
        {required && <span className='text-red-400 ml-1'>*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={selectClasses}
      >
        <option value=''>{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helpText && (
        <p
          className={`text-xs ${
            theme !== 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          {helpText}
        </p>
      )}
      {validation && <FieldError field={name} validation={validation} />}
    </div>
  )
}

interface FormTextareaProps {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  validation?: ValidationResult
  className?: string
  helpText?: string
  rows?: number
  maxLength?: number
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  validation,
  className = '',
  helpText,
  rows = 3,
  maxLength,
}) => {
  const { theme } = useTheme()
  const hasError =
    validation?.errors.some((error) => error.field === name) || false
  const hasWarning =
    validation?.warnings.some((warning) => warning.field === name) || false

  const textareaClasses = `
    w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent
    ${
      hasError
        ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500'
        : hasWarning
          ? 'border-yellow-300 bg-yellow-50 focus:ring-yellow-500 focus:border-yellow-500'
          : theme !== 'dark'
            ? 'border-gray-300 focus:ring-teal-500'
            : 'border-gray-300 focus:ring-teal-500'
    }
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
    ${className}
  `.trim()

  return (
    <div className='space-y-1'>
      <label
        className={`block text-sm font-medium ${
          theme !== 'dark' ? 'text-gray-700' : 'text-white'
        }`}
      >
        {label}
        {required && <span className='text-red-400 ml-1'>*</span>}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        className={textareaClasses}
      />
      {helpText && (
        <p
          className={`text-xs ${
            theme !== 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          {helpText}
        </p>
      )}
      {validation && <FieldError field={name} validation={validation} />}
    </div>
  )
}

interface FormCheckboxProps {
  label: string
  name: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  validation?: ValidationResult
  className?: string
  helpText?: string
}

export const FormCheckbox: React.FC<FormCheckboxProps> = ({
  label,
  name,
  checked,
  onChange,
  disabled = false,
  validation,
  className = '',
  helpText,
}) => {
  const { theme } = useTheme()
  const hasError =
    validation?.errors.some((error) => error.field === name) || false
  const hasWarning =
    validation?.warnings.some((warning) => warning.field === name) || false

  return (
    <div className={`space-y-1 ${className}`}>
      <label className='flex items-start'>
        <input
          type='checkbox'
          name={name}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className={`
            mt-1 h-4 w-4 focus:ring-2 border-gray-300 rounded
            ${theme !== 'dark' ? 'text-teal-600 focus:ring-teal-500' : 'text-teal-500 focus:ring-teal-500'}
            ${hasError ? 'border-red-300' : hasWarning ? 'border-yellow-300' : ''}
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          `.trim()}
        />
        <span
          className={`ml-2 text-sm ${
            theme !== 'dark' ? 'text-gray-700' : 'text-white'
          }`}
        >
          {label}
        </span>
      </label>
      {helpText && (
        <p
          className={`text-xs ml-6 ${
            theme !== 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          {helpText}
        </p>
      )}
      {validation && <FieldError field={name} validation={validation} />}
    </div>
  )
}

interface FormCheckboxGroupProps {
  label: string
  name: string
  options: { value: string; label: string; helpText?: string }[]
  selectedValues: string[]
  onChange: (selectedValues: string[]) => void
  disabled?: boolean
  validation?: ValidationResult
  className?: string
  helpText?: string
  columns?: 1 | 2 | 3 | 4 | 6
}

export const FormCheckboxGroup: React.FC<FormCheckboxGroupProps> = ({
  label,
  name,
  options,
  selectedValues,
  onChange,
  disabled = false,
  validation,
  className = '',
  helpText,
  columns = 3,
}) => {
  const { theme } = useTheme()
  const handleChange = (value: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedValues, value])
    } else {
      onChange(selectedValues.filter((v) => v !== value))
    }
  }

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    6: 'grid-cols-6',
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label
        className={`block text-sm font-medium ${
          theme !== 'dark' ? 'text-gray-700' : 'text-white'
        }`}
      >
        {label}
      </label>
      {helpText && (
        <p
          className={`text-xs ${
            theme !== 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          {helpText}
        </p>
      )}
      <div className={`grid ${gridCols[columns]} gap-3`}>
        {options.map((option) => (
          <FormCheckbox
            key={option.value}
            name={`${name}.${option.value}`}
            label={option.label}
            checked={selectedValues.includes(option.value)}
            onChange={(checked) => handleChange(option.value, checked)}
            disabled={disabled}
            validation={validation}
            helpText={option.helpText}
          />
        ))}
      </div>
      {validation && <FieldError field={name} validation={validation} />}
    </div>
  )
}

export default FormInput
