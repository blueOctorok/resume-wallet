'use client'

// US State abbreviations for form dropdowns
export const US_STATES = [
  { value: '', label: 'Select State' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
] as const

interface StateSelectProps {
  value: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
  id?: string
  name?: string
}

/**
 * StateSelect - Dropdown for US state selection
 * 
 * Ensures users select a valid 2-letter state abbreviation.
 * Prevents database errors from invalid state values.
 */
export function StateSelect({
  value,
  onChange,
  className = '',
  disabled = false,
  id,
  name,
}: StateSelectProps) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
    >
      {US_STATES.map((state) => (
        <option key={state.value} value={state.value}>
          {state.label}
        </option>
      ))}
    </select>
  )
}

/**
 * Normalizes a state input to a 2-letter abbreviation.
 * Handles both full names ("Ohio" → "OH") and already-abbreviated ("OH" → "OH").
 * Returns empty string if no match found.
 */
export function normalizeState(input: string): string {
  if (!input) return ''
  
  const trimmed = input.trim().toUpperCase()
  
  // Already a valid abbreviation?
  if (trimmed.length === 2 && US_STATES.some(s => s.value === trimmed)) {
    return trimmed
  }
  
  // Try to match full name
  const match = US_STATES.find(
    s => s.label.toUpperCase() === trimmed || s.value === trimmed
  )
  
  return match?.value || ''
}
