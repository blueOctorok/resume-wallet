'use client'

import { chakra } from '@chakra-ui/react'
import { cardRecipe } from '@/lib/recipes'

/**
 * Brand Card Component
 *
 * A reusable card component with multiple variants and sizes.
 *
 * @example
 * ```tsx
 * <Card variant="elevated" size="md">
 *   <Text>Card content</Text>
 * </Card>
 *
 * <Card variant="glass" size="lg" interactive>
 *   <Text>Interactive glass card</Text>
 * </Card>
 * ```
 */
export const Card = chakra('div', cardRecipe)
