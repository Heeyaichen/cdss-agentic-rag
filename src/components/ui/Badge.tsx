/**
 * CDSS Badge Component
 *
 * Badge component for displaying status indicators and labels.
 * Uses design tokens from the theme system for consistent styling.
 *
 * @module Badge
 */

import React, { forwardRef, ReactNode } from 'react';
import { Chip, ChipProps } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { severity, semantic, primary } from '@/theme/palette';
import { borderRadius, spacing } from '@/theme/designTokens';

// ============================================================================
// TYPES
// ============================================================================

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info';
export type BadgeSize = 'small' | 'medium' | 'large';

export interface BadgeProps extends Omit<ChipProps, 'variant' | 'size' | 'color'> {
  /** Badge variant style */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Badge label */
  label?: ReactNode;
  /** Show dot indicator */
  showDot?: boolean;
  /** Dot color override */
  dotColor?: string;
}

// ============================================================================
// COLOR CONFIG
// ============================================================================

const variantColors: Record<BadgeVariant, { bg: string; color: string; border?: string }> = {
  default: {
    bg: alpha('#000000', 0.08),
    color: '#000000',
    border: alpha('#000000', 0.2),
  },
  primary: {
    bg: alpha(primary.main, 0.12),
    color: primary.main,
    border: alpha(primary.main, 0.3),
  },
  secondary: {
    bg: alpha(primary.dark, 0.08),
    color: primary.dark,
    border: alpha(primary.dark, 0.2),
  },
  error: {
    bg: alpha(severity.major.main, 0.12),
    color: severity.major.main,
    border: alpha(severity.major.main, 0.3),
  },
  warning: {
    bg: alpha(severity.moderate.main, 0.12),
    color: severity.moderate.main,
    border: alpha(severity.moderate.main, 0.3),
  },
  success: {
    bg: alpha(semantic.success.main, 0.12),
    color: semantic.success.main,
    border: alpha(semantic.success.main, 0.3),
  },
  info: {
    bg: alpha(semantic.info.main, 0.12),
    color: semantic.info.main,
    border: alpha(semantic.info.main, 0.3),
  },
};

// ============================================================================
// SIZE CONFIG
// ============================================================================

const sizeConfig: Record<BadgeSize, { height: number; fontSize: string; padding: string }> = {
  small: {
    height: 20,
    fontSize: '0.6875rem',
    padding: '0 6px',
  },
  medium: {
    height: 26,
    fontSize: '0.75rem',
    padding: '0 10px',
  },
  large: {
    height: 32,
    fontSize: '0.8125rem',
    padding: '0 14px',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Enhanced Badge component with clinical styling.
 *
 * @example
 * ```tsx
 * <Badge variant="error" label="Critical" />
 * <Badge variant="success" label="Verified" showDot />
 * ```
 */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ variant = 'default', size = 'medium', label, showDot, dotColor, sx, ...props }, ref) => {
    const colors = variantColors[variant];
    const sizeStyle = sizeConfig[size];
    const dotBgColor = dotColor || colors.color;

    return (
      <Chip
        ref={ref}
        label={label}
        sx={{
          // Base styles
          height: sizeStyle.height,
          fontSize: sizeStyle.fontSize,
          padding: sizeStyle.padding,
          borderRadius: borderRadius.full,
          fontWeight: 500,
          fontFamily: 'inherit',

          // Variant colors
          backgroundColor: colors.bg,
          color: colors.color,
          border: colors.border ? `1px solid ${colors.border}` : 'none',

          // Label styling
          '& .MuiChip-label': {
            padding: 0,
            fontWeight: 500,
            lineHeight: 1,
          },

          // Hover state
          '&:hover': {
            backgroundColor: alpha(colors.color, 0.16),
          },

          // Dot indicator
          ...(showDot && {
            '&::before': {
              content: '""',
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: dotBgColor,
              marginRight: spacing[1],
            },
          }),

          // Override with custom sx
          ...sx,
        }}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;

// ============================================================================
// SPECIALIZED BADGES
// ============================================================================

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: 'active' | 'inactive' | 'pending' | 'error';
}

const statusConfig: Record<string, BadgeVariant> = {
  active: 'success',
  inactive: 'default',
  pending: 'warning',
  error: 'error',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, ...props }) => (
  <Badge variant={statusConfig[status]} showDot {...props} />
);

StatusBadge.displayName = 'StatusBadge';

export interface SeverityBadgeProps extends Omit<BadgeProps, 'variant'> {
  severity: 'major' | 'moderate' | 'minor' | 'none';
}

const severityBadgeConfig: Record<string, BadgeVariant> = {
  major: 'error',
  moderate: 'warning',
  minor: 'info',
  none: 'success',
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity: sev, ...props }) => (
  <Badge variant={severityBadgeConfig[sev]} {...props} />
);

SeverityBadge.displayName = 'SeverityBadge';
