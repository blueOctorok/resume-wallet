'use client'

import { chakra } from '@chakra-ui/react'
import { buttonRecipe } from '@/lib/recipes'

/**
 * Brand Button Component
 *
 * A reusable button component with multiple variants and sizes.
 *
 * @example
 * ```tsx
 * <Button variant="solid" size="md">Click Me</Button>
 * <Button variant="outline" size="lg">Outlined Button</Button>
 * <Button variant="ghost" size="sm">Ghost Button</Button>
 * ```
 */
export const Button = chakra('button', buttonRecipe)
