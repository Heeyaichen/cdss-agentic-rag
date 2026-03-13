/**
 * CDSS Chip Component
 *
 * Chip component for tags, labels, and small actionable elements.
 * Uses design tokens from the theme system for consistent styling.
 *
 * @module Chip
 */

import React, { forwardRef, ReactNode } from 'react';
import {
  Chip as MuiChip,
  ChipProps as MuiChipProps,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Cancel } from '@mui/icons-material';
import { primary, semantic, neutral } from '@/theme/palette';
import { borderRadius, transitions, fontWeight } from '@/theme/designTokens';

// ============================================================================
// TYPES
// ============================================================================

export type ChipVariant = 'filled' | 'outlined';
export type ChipColor = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
export type ChipSize = 'small' | 'medium';

export interface ChipProps extends Omit<MuiChipProps, 'variant' | 'color' | 'size'> {
  /** Chip visual variant */
  variant?: ChipVariant;
  /** Chip color */
  color?: ChipColor;
  /** Chip size */
  size?: ChipSize;
  /** Icon to display before the label */
  icon?: MuiChipProps['icon'];
  /** Avatar to display before the label */
  avatar?: MuiChipProps['avatar'];
  /** Label text */
  label: MuiChipProps['label'];
  /** Click handler (makes chip clickable) */
  onClick?: MuiChipProps['onClick'];
  /** Delete handler (shows delete icon) */
  onDelete?: MuiChipProps['onDelete'];
  /** Custom delete icon */
  deleteIcon?: MuiChipProps['deleteIcon'];
  /** Disabled state */
  disabled?: boolean;
  /** Clickable state */
  clickable?: boolean;
}

// ============================================================================
// COLOR CONFIGURATIONS
// ============================================================================

const colorConfig: Record<ChipColor, { main: string; light: string; dark: string; contrastText: string }> = {
  default: {
    main: neutral[600],
    light: neutral[100],
    dark: neutral[800],
    contrastText: '#FFFFFF',
  },
  primary: {
    main: primary.main,
    light: primary[100],
    dark: primary.dark,
    contrastText: primary.contrastText,
  },
  success: {
    main: semantic.success.main,
    light: semantic.success.bgLight,
    dark: semantic.success.dark,
    contrastText: semantic.success.contrastText,
  },
  warning: {
    main: semantic.warning.main,
    light: semantic.warning.bgLight,
    dark: semantic.warning.dark,
    contrastText: semantic.warning.contrastText,
  },
  error: {
    main: semantic.error.main,
    light: semantic.error.bgLight,
    dark: semantic.error.dark,
    contrastText: semantic.error.contrastText,
  },
  info: {
    main: semantic.info.main,
    light: semantic.info.bgLight,
    dark: semantic.info.dark,
    contrastText: semantic.info.contrastText,
  },
};

// ============================================================================
// SIZE CONFIGURATIONS
// ============================================================================

interface ChipSizeStyle {
  height: number;
  fontSize: string;
  padding: string;
  gap: number;
  iconSize: number;
}

const sizeStyles: Record<ChipSize, ChipSizeStyle> = {
  small: {
    height: 24,
    fontSize: '0.75rem',
    padding: '0 8px',
    gap: 4,
    iconSize: 16,
  },
  medium: {
    height: 32,
    fontSize: '0.8125rem',
    padding: '0 12px',
    gap: 6,
    iconSize: 18,
  },
};

// ============================================================================
// VARIANT STYLES
// ============================================================================

const getVariantStyles = (
  chipVariant: ChipVariant,
  chipColor: ChipColor,
  disabled: boolean
): object => {
  const colors = colorConfig[chipColor];
  const opacity = disabled ? 0.5 : 1;

  if (chipVariant === 'filled') {
    return {
      backgroundColor: alpha(colors.main, opacity),
      color: colors.contrastText,
      border: 'none',
      '&:hover': {
        backgroundColor: alpha(colors.dark, opacity),
      },
      '&:focus': {
        backgroundColor: alpha(colors.dark, opacity),
      },
      '& .MuiChip-icon': {
        color: colors.contrastText,
      },
      '& .MuiChip-deleteIcon': {
        color: alpha(colors.contrastText, 0.7),
        '&:hover': {
          color: colors.contrastText,
        },
      },
    };
  }

  return {
    backgroundColor: 'transparent',
    color: alpha(colors.dark, opacity),
    border: `1px solid ${alpha(colors.main, opacity)}`,
    '&:hover': {
      backgroundColor: alpha(colors.light, 0.5),
      borderColor: colors.main,
    },
    '&:focus': {
      backgroundColor: alpha(colors.light, 0.5),
    },
    '& .MuiChip-icon': {
      color: alpha(colors.main, opacity),
    },
    '& .MuiChip-deleteIcon': {
      color: alpha(colors.main, 0.7),
      '&:hover': {
        color: colors.main,
      },
    },
  };
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Enhanced Chip component with clinical styling.
 *
 * @example
 * ```tsx
 * <Chip label="Diabetes" color="primary" />
 *
 * <Chip
 *   label="Critical"
 *   color="error"
 *   variant="filled"
 *   onDelete={() => handleDelete()}
 * />
 *
 * <Chip
 *   label="Allergy: Penicillin"
 *   color="warning"
 *   icon={<WarningIcon />}
 *   onClick={() => showDetails()}
 * />
 *
 * <Chip
 *   label="Dr. Smith"
 *   avatar={<Avatar>S</Avatar>}
 *   variant="outlined"
 * />
 * ```
 */
export const Chip = forwardRef<HTMLDivElement, ChipProps>(
  (
    {
      variant = 'filled',
      color = 'default',
      size = 'medium',
      icon,
      avatar,
      label,
      onClick,
      onDelete,
      deleteIcon,
      disabled = false,
      clickable = false,
      sx,
      ...props
    },
    ref
  ) => {
    const isClickable = Boolean(onClick) || clickable;
    const hasDelete = Boolean(onDelete);
    const sizeConfig = sizeStyles[size];

    const renderDeleteIcon = () => {
      if (!hasDelete) return undefined;
      if (deleteIcon) return deleteIcon;
      return <Cancel fontSize="small" />;
    };

    return (
      <MuiChip
        ref={ref}
        label={label}
        icon={icon}
        avatar={avatar}
        onClick={onClick}
        onDelete={onDelete}
        deleteIcon={renderDeleteIcon()}
        disabled={disabled}
        clickable={isClickable}
        sx={{
          // Base styles
          height: sizeConfig.height,
          fontSize: sizeConfig.fontSize,
          fontWeight: fontWeight.medium,
          padding: sizeConfig.padding,
          gap: sizeConfig.gap,
          borderRadius: borderRadius.full,
          transition: transitions.common,
          fontFamily: 'inherit',

          // Ensure icons are properly sized
          '& .MuiChip-icon': {
            fontSize: sizeConfig.iconSize,
            marginLeft: '-4px',
            marginRight: '2px',
          },
          '& .MuiChip-avatar': {
            width: sizeConfig.height - 4,
            height: sizeConfig.height - 4,
            fontSize: sizeConfig.fontSize,
            marginLeft: 4,
            marginRight: -4,
          },
          '& .MuiChip-deleteIcon': {
            fontSize: sizeConfig.iconSize,
            marginRight: '-4px',
            marginLeft: '2px',
          },
          '& .MuiChip-label': {
            padding: '0 4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },

          // Variant and color styles
          ...getVariantStyles(variant, color, disabled),

          // Disabled state
          ...(disabled && {
            cursor: 'not-allowed',
            pointerEvents: 'none',
          }),

          // Clickable state
          ...(isClickable && !disabled && {
            cursor: 'pointer',
            userSelect: 'none',
          }),

          // Override with custom sx
          ...sx,
        }}
        {...props}
      />
    );
  }
);

Chip.displayName = 'Chip';

export default Chip;

// ============================================================================
// SPECIALIZED CHIP EXPORTS
// ============================================================================

/**
 * Tag Chip for displaying categorical tags.
 */
export interface TagChipProps extends Omit<ChipProps, 'variant'> {
  /** Tag value for identification */
  value?: string;
}

export const TagChip: React.FC<TagChipProps> = ({ value, ...props }) => (
  <Chip variant="outlined" {...props} />
);

TagChip.displayName = 'TagChip';

/**
 * Severity Chip for displaying severity levels.
 */
export interface SeverityChipProps extends Omit<ChipProps, 'color'> {
  /** Severity level */
  severity: 'major' | 'moderate' | 'minor' | 'none';
}

const severityToColor: Record<'major' | 'moderate' | 'minor' | 'none', ChipColor> = {
  major: 'error',
  moderate: 'warning',
  minor: 'info',
  none: 'success',
};

export const SeverityChip: React.FC<SeverityChipProps> = ({ severity, ...props }) => (
  <Chip color={severityToColor[severity]} variant="filled" {...props} />
);

SeverityChip.displayName = 'SeverityChip';

/**
 * Filter Chip for filter selections.
 */
export interface FilterChipProps extends ChipProps {
  /** Selected state */
  selected?: boolean;
}

export const FilterChip: React.FC<FilterChipProps> = ({ selected, ...props }) => (
  <Chip
    variant={selected ? 'filled' : 'outlined'}
    color={selected ? 'primary' : 'default'}
    clickable
    {...props}
  />
);

FilterChip.displayName = 'FilterChip';
