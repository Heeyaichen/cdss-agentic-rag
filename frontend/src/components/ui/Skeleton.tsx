/**
 * CDSS Skeleton Component
 *
 * Skeleton loading states for content placeholders.
 * Uses design tokens from the theme system for consistent styling.
 *
 * @module Skeleton
 */

import React, { forwardRef, ReactNode } from 'react';
import {
  Skeleton as MuiSkeleton,
  SkeletonProps as MuiSkeletonProps,
  Box,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { neutral } from '@/theme/palette';
import { borderRadius } from '@/theme/designTokens';

// ============================================================================
// TYPES
// ============================================================================

export type SkeletonVariant = 'text' | 'rectangular' | 'circular';
export type SkeletonAnimation = 'pulse' | 'wave' | 'none';

export interface SkeletonProps extends Omit<MuiSkeletonProps, 'variant' | 'animation'> {
  /** Skeleton variant */
  variant?: SkeletonVariant;
  /** Animation type */
  animation?: SkeletonAnimation;
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Number of rows for text skeleton */
  rows?: number;
  /** Spacing between rows */
  spacing?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Enhanced Skeleton component with clinical styling.
 *
 * @example
 * ```tsx
 * <Skeleton variant="text" width="80%" />
 *
 * <Skeleton variant="circular" width={40} height={40} />
 *
 * <Skeleton variant="rectangular" width={200} height={100} />
 *
 * <Skeleton variant="text" rows={3} spacing={2} />
 * ```
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      variant = 'text',
      animation = 'pulse',
      width,
      height,
      rows = 1,
      spacing = 1,
      sx,
      ...props
    },
    ref
  ) => {
    const getVariantStyles = () => {
      switch (variant) {
        case 'text':
          return {
            height: height || '1.2em',
            borderRadius: borderRadius.xs,
            transform: 'scale(1, 1)',
          };
        case 'rectangular':
          return {
            height: height || 100,
            borderRadius: borderRadius.md,
          };
        case 'circular':
          return {
            width: width || 40,
            height: height || 40,
            borderRadius: '50%',
          };
        default:
          return {};
      }
    };

    const getMuiAnimation = (): 'pulse' | 'wave' | false => {
      if (animation === 'none') return false;
      return animation;
    };

    if (variant === 'text' && rows > 1) {
      return (
        <Box ref={ref} sx={{ width, ...sx }} {...props}>
          {Array.from({ length: rows }, (_, index) => (
            <MuiSkeleton
              key={index}
              variant="text"
              animation={getMuiAnimation()}
              width={index === rows - 1 ? '60%' : '100%'}
              sx={{
                mb: index < rows - 1 ? spacing : 0,
                ...getVariantStyles(),
              }}
            />
          ))}
        </Box>
      );
    }

    return (
      <MuiSkeleton
        ref={ref}
        variant={variant === 'circular' ? 'circular' : variant === 'rectangular' ? 'rectangular' : 'text'}
        animation={getMuiAnimation()}
        width={width}
        height={height}
        sx={{
          bgcolor: alpha(neutral[300], 0.3),
          ...getVariantStyles(),
          ...sx,
        }}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

export default Skeleton;

// ============================================================================
// SKELETON GROUP COMPONENT
// ============================================================================

export interface SkeletonGroupProps {
  /** Number of skeletons to render */
  count?: number;
  /** Skeleton variant */
  variant?: SkeletonVariant;
  /** Width of each skeleton */
  width?: string | number;
  /** Height of each skeleton */
  height?: string | number;
  /** Gap between skeletons */
  gap?: number;
  /** Animation type */
  animation?: SkeletonAnimation;
}

export const SkeletonGroup: React.FC<SkeletonGroupProps> = ({
  count = 3,
  variant = 'text',
  width,
  height,
  gap = 1,
  animation = 'pulse',
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      gap,
    }}
  >
    {Array.from({ length: count }, (_, index) => (
      <Skeleton
        key={index}
        variant={variant}
        width={typeof width === 'number' ? width : index === count - 1 ? '60%' : width}
        height={height}
        animation={animation}
      />
    ))}
  </Box>
);

SkeletonGroup.displayName = 'SkeletonGroup';

// ============================================================================
// CONTENT SKELETON COMPONENTS
// ============================================================================

export interface CardSkeletonProps {
  /** Number of lines in the skeleton */
  lines?: number;
  /** Show header skeleton */
  showHeader?: boolean;
  /** Show action skeleton */
  showAction?: boolean;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  lines = 3,
  showHeader = true,
  showAction = true,
}) => (
  <Box sx={{ p: 2 }}>
    {showHeader && (
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Skeleton variant="text" width="40%" />
        {showAction && <Skeleton variant="rectangular" width={80} height={24} />}
      </Box>
    )}
    <Box sx={{ mb: 1 }}>
      <Skeleton variant="text" width="100%" />
    </Box>
    {Array.from({ length: lines - 1 }, (_, index) => (
      <Skeleton
        key={index}
        variant="text"
        width={index === lines - 2 ? '60%' : '100%'}
        sx={{ mb: 0.5 }}
      />
    ))}
  </Box>
);

CardSkeleton.displayName = 'CardSkeleton';

export interface TableRowSkeletonProps {
  /** Number of columns */
  columns?: number;
  /** Show checkbox skeleton */
  showCheckbox?: boolean;
  /** Show action skeleton */
  showAction?: boolean;
}

export const TableRowSkeleton: React.FC<TableRowSkeletonProps> = ({
  columns = 4,
  showCheckbox = true,
  showAction = true,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5, gap: 2 }}>
    {showCheckbox && <Skeleton variant="rectangular" width={20} height={20} sx={{ borderRadius: 1 }} />}
    {Array.from({ length: columns }, (_, index) => (
      <Skeleton
        key={index}
        variant="text"
        width={index === columns - 1 && showAction ? '15%' : `${100 / columns}%`}
      />
    ))}
    {showAction && <Skeleton variant="rectangular" width={60} height={24} />}
  </Box>
);

TableRowSkeleton.displayName = 'TableRowSkeleton';
