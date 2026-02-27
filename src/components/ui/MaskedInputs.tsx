'use client'

import { IMaskInput } from 'react-imask'
import { forwardRef } from 'react'

interface MaskedInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  id?: string
  name?: string
}

/**
 * PhoneInput - Formats as (XXX) XXX-XXXX
 * 
 * Stores the formatted value (with parens/dashes) for display consistency.
 * If you need raw digits only, use value.replace(/\D/g, '')
 */
export const PhoneInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, className, placeholder = '(555) 123-4567', disabled, id, name }, ref) => (
    <IMaskInput
      mask="(000) 000-0000"
      definitions={{ '0': /[0-9]/ }}
      value={value}
      unmask={false}
      onAccept={(val) => onChange(val)}
      placeholder={placeholder}
      disabled={disabled}
      id={id}
      name={name}
      className={className}
      inputRef={ref}
    />
  )
)
PhoneInput.displayName = 'PhoneInput'

/**
 * SSNInput - Formats as XXX-XX-XXXX
 * 
 * For sensitive DOT/employment forms. Shows masked format while typing.
 */
export const SSNInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, className, placeholder = '000-00-0000', disabled, id, name }, ref) => (
    <IMaskInput
      mask="000-00-0000"
      definitions={{ '0': /[0-9]/ }}
      value={value}
      unmask={false}
      onAccept={(val) => onChange(val)}
      placeholder={placeholder}
      disabled={disabled}
      id={id}
      name={name}
      className={className}
      inputRef={ref}
    />
  )
)
SSNInput.displayName = 'SSNInput'

/**
 * ZipCodeInput - Formats as XXXXX or XXXXX-XXXX
 * 
 * Accepts 5 digit or 9 digit (ZIP+4) format.
 */
export const ZipCodeInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, className, placeholder = '12345', disabled, id, name }, ref) => (
    <IMaskInput
      mask="00000[-0000]"
      definitions={{ '0': /[0-9]/ }}
      value={value}
      unmask={false}
      onAccept={(val) => onChange(val)}
      placeholder={placeholder}
      disabled={disabled}
      id={id}
      name={name}
      className={className}
      inputRef={ref}
    />
  )
)
ZipCodeInput.displayName = 'ZipCodeInput'

/**
 * DateInput - Formats as MM/DD/YYYY
 * 
 * For full date entry. Use MonthYearInput for MM/YYYY format.
 */
export const DateInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, className, placeholder = 'MM/DD/YYYY', disabled, id, name }, ref) => (
    <IMaskInput
      mask="00/00/0000"
      definitions={{ '0': /[0-9]/ }}
      value={value}
      unmask={false}
      onAccept={(val) => onChange(val)}
      placeholder={placeholder}
      disabled={disabled}
      id={id}
      name={name}
      className={className}
      inputRef={ref}
    />
  )
)
DateInput.displayName = 'DateInput'

/**
 * MonthYearInput - Formats as MM/YYYY
 * 
 * For employment history, education dates, etc.
 */
export const MonthYearInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, className, placeholder = 'MM/YYYY', disabled, id, name }, ref) => (
    <IMaskInput
      mask="00/0000"
      definitions={{ '0': /[0-9]/ }}
      value={value}
      unmask={false}
      onAccept={(val) => onChange(val)}
      placeholder={placeholder}
      disabled={disabled}
      id={id}
      name={name}
      className={className}
      inputRef={ref}
    />
  )
)
MonthYearInput.displayName = 'MonthYearInput'

/**
 * CDLInput - Formats CDL number (varies by state, basic alphanumeric)
 * 
 * Most CDL numbers are 8-12 alphanumeric characters.
 * This allows letters and numbers, auto-uppercases.
 */
export const CDLInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, className, placeholder = 'A1234567', disabled, id, name }, ref) => (
    <IMaskInput
      mask="aaaaaaaaaaaaa"
      definitions={{ 'a': /[A-Za-z0-9]/ }}
      prepare={(str) => str.toUpperCase()}
      value={value}
      unmask={false}
      onAccept={(val) => onChange(val)}
      placeholder={placeholder}
      disabled={disabled}
      id={id}
      name={name}
      className={className}
      inputRef={ref}
    />
  )
)
CDLInput.displayName = 'CDLInput'

/**
 * CurrencyInput - Formats as $X,XXX.XX
 * 
 * For salary, compensation fields. Stores raw number string.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, className, placeholder = '$0.00', disabled, id, name }, ref) => (
    <IMaskInput
      mask="$num"
      blocks={{
        num: {
          mask: Number,
          thousandsSeparator: ',',
          radix: '.',
          scale: 2,
          signed: false,
          padFractionalZeros: false,
          normalizeZeros: true,
          min: 0,
          max: 999999999,
        },
      }}
      value={value}
      unmask={true}
      onAccept={(val) => onChange(val)}
      placeholder={placeholder}
      disabled={disabled}
      id={id}
      name={name}
      className={className}
      inputRef={ref}
    />
  )
)
CurrencyInput.displayName = 'CurrencyInput'

/**
 * EINInput - Employer Identification Number (XX-XXXXXXX)
 * 
 * For business/employer forms.
 */
export const EINInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, className, placeholder = '12-3456789', disabled, id, name }, ref) => (
    <IMaskInput
      mask="00-0000000"
      definitions={{ '0': /[0-9]/ }}
      value={value}
      unmask={false}
      onAccept={(val) => onChange(val)}
      placeholder={placeholder}
      disabled={disabled}
      id={id}
      name={name}
      className={className}
      inputRef={ref}
    />
  )
)
EINInput.displayName = 'EINInput'
