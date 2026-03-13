/**
 * CDSS Button Component
 *
 * Enhanced button with variants, sizes, loading state, and icon support.
 * Uses design tokens from the theme system for consistent styling.
 *
 * @module Button
 */

import React, { forwardRef } from 'react';
import {
  Button as MuiButton,
  ButtonProps as MuiButtonProps,
  CircularProgress,
  Box,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { primary, severity, semantic } from '@/theme/palette';
import { borderRadius, componentSize, transitions } from '@/theme/designTokens';

// ============================================================================
// TYPES
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'clinical';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends Omit<MuiButtonProps, 'variant' | 'size' | 'startIcon' | 'endIcon'> {
  /** Button variant style */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Show loading spinner and disable button */
  loading?: boolean;
  /** Icon to display before the button text */
  startIcon?: React.ReactNode;
  /** Icon to display after the button text */
  endIcon?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
}

// ============================================================================
// VARIANT STYLES
// ============================================================================

const variantStyles: Record<ButtonVariant, object> = {
  primary: {
    backgroundColor: primary.main,
    color: primary.contrastText,
    '&:hover': {
      backgroundColor: primary.dark,
      boxShadow: `0 4px 12px ${alpha(primary.main, 0.3)}`,
    },
    '&:active': {
      backgroundColor: primary[700],
    },
    '&:disabled': {
      backgroundColor: alpha(primary.main, 0.5),
      color: alpha(primary.contrastText, 0.7),
    },
  },
  secondary: {
    backgroundColor: 'transparent',
    color: primary.main,
    border: `1.5px solid ${primary.main}`,
    '&:hover': {
      backgroundColor: alpha(primary.main, 0.08),
      borderColor: primary.dark,
    },
    '&:active': {
      backgroundColor: alpha(primary.main, 0.12),
    },
    '&:disabled': {
      borderColor: alpha(primary.main, 0.3),
      color: alpha(primary.main, 0.5),
    },
  },
  ghost: {
    backgroundColor: 'transparent',
    color: primary.main,
    '&:hover': {
      backgroundColor: alpha(primary.main, 0.08),
    },
    '&:active': {
      backgroundColor: alpha(primary.main, 0.12),
    },
    '&:disabled': {
      color: alpha(primary.main, 0.5),
    },
  },
  danger: {
    backgroundColor: severity.major.main,
    color: severity.major.contrastText,
    '&:hover': {
      backgroundColor: severity.major.dark,
      boxShadow: `0 4px 12px ${alpha(severity.major.main, 0.3)}`,
    },
    '&:active': {
      backgroundColor: '#991B1B',
    },
    '&:disabled': {
      backgroundColor: alpha(severity.major.main, 0.5),
      color: alpha(severity.major.contrastText, 0.7),
    },
  },
  clinical: {
    backgroundColor: alpha(primary.main, 0.08),
    color: primary.dark,
    border: `1.5px solid ${alpha(primary.main, 0.3)}`,
    '&:hover': {
      backgroundColor: alpha(primary.main, 0.12),
      borderColor: alpha(primary.main, 0.5),
    },
    '&:active': {
      backgroundColor: alpha(primary.main, 0.16),
    },
    '&:disabled': {
      backgroundColor: alpha(primary.main, 0.04),
      borderColor: alpha(primary.main, 0.15),
      color: alpha(primary.dark, 0.5),
    },
  },
};

// ============================================================================
// SIZE STYLES
// ============================================================================

const sizeStyles: Record<ButtonSize, object> = {
  small: {
    height: componentSize.button.small,
    padding: '0 12px',
    fontSize: '0.8125rem',
    gap: 6,
  },
  medium: {
    height: componentSize.button.medium,
    padding: '0 16px',
    fontSize: '0.875rem',
    gap: 8,
  },
  large: {
    height: componentSize.button.large,
    padding: '0 24px',
    fontSize: '0.9375rem',
    gap: 10,
  },
};

// ============================================================================
// ICON SIZE MAP
// ============================================================================

const iconSizeMap: Record<ButtonSize, number> = {
  small: componentSize.icon.small,
  medium: componentSize.icon.medium,
  large: componentSize.icon.large,
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Enhanced Button component with clinical styling.
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="medium" loading={isLoading}>
 *   Submit Query
 * </Button>
 *
 * <Button variant="danger" startIcon={<WarningIcon />}>
 *   Critical Alert
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'medium',
      loading = false,
      startIcon,
      endIcon,
      fullWidth = false,
      disabled,
      children,
      sx,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const iconSize = iconSizeMap[size];

    const renderIcon = (icon: React.ReactNode, position: 'start' | 'end') => {
      if (!icon) return null;
      return (
        <Box
          component="span"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: iconSize,
            height: iconSize,
            '& > svg': {
              width: iconSize,
              height: iconSize,
            },
            ...(position === 'start' && { mr: -0.5 }),
            ...(position === 'end' && { ml: -0.5 }),
          }}
        >
          {icon}
        </Box>
      );
    };

    return (
      <MuiButton
        ref={ref}
        disabled={isDisabled}
        disableElevation
        disableRipple={variant === 'ghost'}
        fullWidth={fullWidth}
        sx={{
          // Base styles
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: borderRadius.sm,
          transition: transitions.common,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          whiteSpace: 'nowrap',
          
          // Variant styles
          ...variantStyles[variant],
          
          // Size styles
          ...sizeStyles[size],
          
          // Full width
          ...(fullWidth && { width: '100%' }),
          
          // Loading state
          ...(loading && {
            cursor: 'wait',
            pointerEvents: 'none',
          }),
          
          // Override with custom sx
          ...sx,
        }}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <CircularProgress
              size={iconSize}
              thickness={5}
              sx={{
                color: 'currentColor',
                mr: 1,
              }}
            />
            {children}
          </>
        ) : (
          <>
            {renderIcon(startIcon, 'start')}
            {children}
            {renderIcon(endIcon, 'end')}
          </>
        )}
      </MuiButton>
    );
  }
);

Button.displayName = 'Button';

export default Button;
