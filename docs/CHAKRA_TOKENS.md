# Chakra UI Design Tokens Guide

This document explains how design tokens work in our Chakra UI implementation and how to use them effectively.

## What are Design Tokens?

Design tokens are the platform-agnostic way to manage design decisions in your application. They are key-value pairs that describe fundamental visual styles (colors, spacing, fonts, etc.).

### Benefits:

- **Consistency**: All components use the same design language
- **Maintainability**: Change values in one place, updates everywhere
- **Type Safety**: Full TypeScript autocomplete support
- **Theme Switching**: Automatic dark/light mode support via semantic tokens

---

## Token Types in Our App

### 1. **Brand Colors** (`colors.brand.*`)

Our core brand identity colors:

```typescript
// Token Definition
colors: {
  brand: {
    sage: '#697469',        // Primary brand color - sage green
    sageLight: '#adc2a9',   // Light sage for accents and hover states
    mint: '#d3e4cd',        // Mint green for borders and interactive elements
    cream: '#fef5ed',       // Warm cream for backgrounds
  }
}

// Usage in Components
<Box bg="brand.sage" color="brand.cream">
  Hello World
</Box>
```

### 2. **Semantic Tokens** (`bg.*`, `text.*`, `border.*`, `interactive.*`)

Theme-aware tokens that automatically switch between light and dark mode. These use nested structures with `DEFAULT` keys for flexible usage:

```typescript
// Token Definition
semanticTokens: {
  colors: {
    bg: {
      DEFAULT: { value: { base: '{colors.brand.cream}', _dark: '{colors.brand.sage}' } },
      primary: { value: { base: '{colors.brand.cream}', _dark: '{colors.brand.sage}' } },
      secondary: { value: { base: 'white', _dark: '{colors.brand.sage}' } },
      // ...
    },
    text: {
      DEFAULT: { value: { base: '{colors.brand.sage}', _dark: '{colors.brand.cream}' } },
      primary: { value: { base: '{colors.brand.sage}', _dark: '{colors.brand.cream}' } },
      // ...
    }
  }
}

// Usage - Both work!
<Box bg="bg" color="text">         {/* Uses DEFAULT */}
  This text is always readable!
</Box>

<Box bg="bg.primary" color="text.primary">  {/* Explicit */}
  Same result!
</Box>
```

**Available Semantic Tokens:**

| Token                                  | Light Mode | Dark Mode | Purpose               |
| -------------------------------------- | ---------- | --------- | --------------------- |
| `bg` or `bg.primary`                   | cream      | sage      | Primary background    |
| `bg.secondary`                         | white      | sage      | Card backgrounds      |
| `bg.tertiary`                          | gray.50    | gray.800  | Subtle backgrounds    |
| `bg.muted`                             | mint       | sageLight | Muted/disabled states |
| `text` or `text.primary`               | sage       | cream     | Primary text          |
| `text.secondary`                       | sageLight  | cream     | Secondary text        |
| `text.muted`                           | gray.600   | gray.400  | Muted text            |
| `border` or `border.primary`           | mint       | mint      | Primary borders       |
| `border.secondary`                     | gray.200   | gray.700  | Secondary borders     |
| `interactive` or `interactive.primary` | mint       | mint      | Interactive elements  |
| `interactive.hover`                    | sageLight  | sageLight | Hover states          |

### 3. **Typography Tokens**

```typescript
// Fonts
fonts: {
  body: 'Quicksand, system-ui, -apple-system, sans-serif',
  heading: 'Quicksand, system-ui, -apple-system, sans-serif',
}

// Font Weights
fontWeights: {
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}

// Usage
<Text fontFamily="body" fontWeight="semibold">
  Quicksand Semibold Text
</Text>
```

### 4. **Spacing Tokens**

Consistent spacing scale:

```typescript
spacing: {
  0: '0px',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem',    // 96px
}

// Usage
<Box p={4} m={6} gap={2}>
  Consistent spacing!
</Box>
```

### 5. **Radii Tokens**

Border radius scale:

```typescript
radii: {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  full: '9999px',
}

// Usage
<Box rounded="2xl">
  Rounded corners
</Box>
```

### 6. **Shadow Tokens**

Elevation system:

```typescript
shadows: {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
}

// Usage
<Box shadow="xl">
  Elevated card
</Box>
```

### 7. **Animation Tokens**

```typescript
durations: {
  fast: '150ms',
  normal: '250ms',
  slow: '350ms',
}

easings: {
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
}

// Usage (with transition prop)
<Box
  transition="all token(durations.normal) token(easings.easeOut)"
  _hover={{ transform: 'scale(1.05)' }}
>
  Smooth transition
</Box>
```

---

## Token Reference Syntax

For composite values (border, padding, box-shadow), use `{path.to.token}`:

```typescript
<Box
  border="1px solid {colors.brand.mint}"
  p="{spacing.4} {spacing.6}"
  boxShadow="{spacing.4} {spacing.2} {spacing.2} {colors.brand.sage}"
/>
```

**Important:** Use the complete token path:

- ✅ `{colors.brand.sage}`
- ❌ `{brand.sage}`

---

## Text Styles (Reusable Typography)

Pre-defined text style combinations:

```typescript
textStyles: {
  'brand.heading': {
    fontFamily: 'Quicksand',
    fontWeight: 'extralight',
    bgGradient: 'to-r',
    gradientFrom: 'brand.sage',
    gradientTo: 'brand.sageLight',
    bgClip: 'text',
  },
  'brand.body': {
    fontFamily: 'Quicksand',
    fontWeight: 'normal',
  },
}

// Usage
<Text textStyle="brand.heading">
  Gradient Heading
</Text>
```

---

## Layer Styles (Reusable Component Styles)

Pre-configured component style sets:

```typescript
layerStyles: {
  'brand.card': {
    bg: 'bg.secondary',
    color: 'text.primary',
    rounded: 'xl',
    shadow: 'lg',
    border: '1px solid',
    borderColor: 'border.primary',
    p: 6,
  },
  'brand.nav': {
    bg: { base: 'whiteAlpha.800', _dark: 'blackAlpha.800' },
    backdropFilter: 'blur(10px)',
    rounded: '2xl',
    shadow: 'xl',
    border: '1px solid',
    borderColor: 'border.primary',
  },
  'brand.button': {
    bg: 'interactive.primary',
    color: 'text.primary',
    px: 4,
    py: 2,
    rounded: 'lg',
    fontWeight: 'medium',
    transition: 'all token(durations.fast) token(easings.easeOut)',
    _hover: {
      bg: 'interactive.hover',
      transform: 'translateY(-2px)',
      shadow: 'md',
    },
    _active: {
      transform: 'translateY(0)',
      shadow: 'sm',
    },
  },
}

// Usage
<Box layerStyle="brand.card">
  Instant card styling!
</Box>

<Box as="button" layerStyle="brand.button">
  Interactive button with hover effects!
</Box>
```

---

## Semantic Token Nesting & DEFAULT Keys

Our semantic tokens use nesting with `DEFAULT` keys, which provides flexibility:

```typescript
// This structure...
bg: {
  DEFAULT: { value: { base: '{colors.brand.cream}', _dark: '{colors.brand.sage}' } },
  primary: { value: { base: '{colors.brand.cream}', _dark: '{colors.brand.sage}' } },
  secondary: { value: { base: 'white', _dark: '{colors.brand.sage}' } },
}

// Allows both usages:
<Box bg="bg">Primary background</Box>              // Uses DEFAULT
<Box bg="bg.primary">Primary background</Box>      // Explicit
<Box bg="bg.secondary">Secondary background</Box>  // Specific variant
```

**Benefits:**

1. **Shorter syntax** when you want the primary/default variant
2. **Explicit naming** when you want to be clear in your code
3. **Consistent grouping** of related tokens
4. **Easier to extend** with new variants

**Example in practice:**

```typescript
// Quick card - uses defaults
<Box bg="bg" color="text" border="1px solid" borderColor="border">
  Content
</Box>

// Explicit card - same result, more verbose
<Box bg="bg.primary" color="text.primary" border="1px solid" borderColor="border.primary">
  Content
</Box>

// Mixed - defaults + specific variants
<Box bg="bg.secondary" color="text">
  Secondary background with default text
</Box>
```

---

## Best Practices

### ✅ DO:

1. **Use semantic tokens for theme-aware components:**

   ```typescript
   <Box bg="bg.primary" color="text.primary">
     Works in any theme
   </Box>
   ```

2. **Use brand tokens for brand-specific styling:**

   ```typescript
   <Box borderColor="brand.mint">
     Always mint, regardless of theme
   </Box>
   ```

3. **Use token reference syntax in composite values:**

   ```typescript
   <Box border="1px solid {colors.brand.sage}" />
   ```

4. **Leverage layer styles for common patterns:**
   ```typescript
   <Box layerStyle="brand.card">Instant card!</Box>
   ```

### ❌ DON'T:

1. **Don't use raw values:**

   ```typescript
   // ❌ Bad
   <Box bg="#697469" p="24px" />

   // ✅ Good
   <Box bg="brand.sage" p={6} />
   ```

2. **Don't hardcode colors that should be theme-aware:**

   ```typescript
   // ❌ Bad - won't work in dark mode
   <Box bg="white" color="black" />

   // ✅ Good - works in all themes
   <Box bg="bg.primary" color="text.primary" />
   ```

3. **Don't create inline styles for reusable patterns:**

   ```typescript
   // ❌ Bad - repeated styling
   <Box bg="bg.secondary" rounded="xl" shadow="lg" border="1px solid" borderColor="border.primary" p={6} />

   // ✅ Good - use layer style
   <Box layerStyle="brand.card" />
   ```

---

## Generating Type Definitions

For full TypeScript autocomplete, run:

```bash
npx @chakra-ui/cli typegen ./src/lib/theme.ts
```

This will update internal types in `@chakra-ui/react` to include your custom tokens.

---

## File Locations

- **Theme Definition**: `src/lib/theme.ts`
- **Provider Setup**: `src/components/ui/provider.tsx`
- **Usage Examples**: `src/components/ui/navigation.tsx`

---

## Quick Reference: Common Patterns

### Card with Brand Styling

```typescript
<Box layerStyle="brand.card">
  <Text textStyle="brand.heading">Title</Text>
  <Text color="text.secondary">Description</Text>
</Box>
```

### Button with Brand Colors

```typescript
<Box
  as="button"
  bg="brand.mint"
  color="brand.sage"
  px={4}
  py={2}
  rounded="lg"
  _hover={{ bg: 'brand.sageLight' }}
>
  Click Me
</Box>
```

### Responsive Spacing

```typescript
<Box p={{ base: 3, md: 6, lg: 8 }}>
  Responsive padding
</Box>
```

### Theme-Aware Border

```typescript
<Box border="1px solid" borderColor="border.primary">
  Works in light and dark mode
</Box>
```

---

## Recipes (Multi-Variant Component Styles)

Recipes provide type-safe, multi-variant component styles with compound variants and defaults.

### Button Recipe

```typescript
import { Button } from '@/components/ui/button'

// Variants: solid, outline, ghost, link
// Sizes: sm, md, lg
// Props: fullWidth

<Button variant="solid" size="md">Click Me</Button>
<Button variant="outline" size="lg">Outlined</Button>
<Button variant="ghost" size="sm">Ghost</Button>
<Button variant="link">Link Style</Button>
<Button variant="solid" size="lg" fullWidth>Full Width</Button>
```

**Available Variants:**

- `solid` (default) - Filled background with hover lift
- `outline` - Border only with hover fill
- `ghost` - Transparent with subtle hover
- `link` - Underlined text link style

### Card Recipe

```typescript
import { Card } from '@/components/ui/card'

// Variants: elevated, outline, filled, glass
// Sizes: sm, md, lg
// Props: interactive

<Card variant="elevated" size="md">
  <Text>Card with shadow</Text>
</Card>

<Card variant="glass" size="lg">
  <Text>Glassmorphism card</Text>
</Card>

<Card variant="elevated" interactive>
  <Text>Interactive hover effects</Text>
</Card>
```

**Available Variants:**

- `elevated` (default) - Card with shadow and hover lift
- `outline` - Border only, no shadow
- `filled` - Tertiary background, no shadow
- `glass` - Glassmorphism with backdrop blur

### Badge Recipe

```typescript
import { Badge } from '@/components/ui/badge'

// Variants: solid, subtle, outline
// Sizes: sm, md, lg

<Badge variant="solid" size="md">NEW</Badge>
<Badge variant="subtle" size="sm">BETA</Badge>
<Badge variant="outline" size="lg">PRO</Badge>
```

**Available Variants:**

- `solid` - Filled background
- `subtle` (default) - Muted background
- `outline` - Border only

### Custom Recipe Usage

You can also use recipes directly with `useRecipe`:

```typescript
'use client'

import { chakra, useRecipe } from '@chakra-ui/react'

export function CustomButton(props) {
  const recipe = useRecipe({ key: 'button' })
  const [variantProps, restProps] = recipe.splitVariantProps(props)
  const styles = recipe(variantProps)

  return <chakra.button css={styles} {...restProps} />
}
```

---

## Summary

**Key Takeaways:**

1. **Brand tokens** = Fixed brand colors (sage, sageLight, mint, cream)
2. **Semantic tokens** = Theme-aware colors with `DEFAULT` keys for flexibility
   - Use `bg` or `bg.primary` (both work!)
   - Nested structure: `bg.*`, `text.*`, `border.*`, `interactive.*`
3. **Layer styles** = Reusable component patterns (card, nav, button)
4. **Text styles** = Reusable typography patterns
5. **Token reference syntax** = `{colors.brand.sage}` in composite values
6. **Always use tokens** instead of raw CSS values for consistency

**Available Layer Styles:**

- `brand.card` - Card with borders, shadows, and proper spacing
- `brand.nav` - Navigation bar with backdrop blur and glassmorphism
- `brand.button` - Interactive button with hover effects and transitions

**Available Recipes (Recommended for Components):**

- `button` - Multi-variant button (solid, outline, ghost, link) with 3 sizes
- `card` - Multi-variant card (elevated, outline, filled, glass) with 3 sizes
- `badge` - Multi-variant badge (solid, subtle, outline) with 3 sizes

**When to Use:**

- **Layer Styles** → Quick one-off styling with `layerStyle` prop
- **Recipes** → Reusable components with type-safe variants

This token system ensures our app maintains a cohesive design language while supporting dark mode seamlessly! 🎨✨
