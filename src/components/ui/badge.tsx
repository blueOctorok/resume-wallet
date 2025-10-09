'use client'

import { chakra } from '@chakra-ui/react'
import { badgeRecipe } from '@/lib/recipes'

/**
 * Brand Badge Component
 *
 * A reusable badge component with multiple variants and sizes.
 *
 * @example
 * ```tsx
 * <Badge variant="solid" size="md">NEW</Badge>
 * <Badge variant="outline" size="sm">BETA</Badge>
 * <Badge variant="subtle" size="lg">PRO</Badge>
 * ```
 */
export const Badge = chakra('span', badgeRecipe)
