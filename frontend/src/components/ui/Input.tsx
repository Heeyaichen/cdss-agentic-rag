/**
 * CDSS Input Component
 *
 * Enhanced input with variants, sizes, error states, and adornments.
 * Uses design tokens from the theme system for consistent styling.
 *
 * @module Input
 */

import React, { forwardRef, useState, TextareaHTMLAttributes, InputHTMLAttributes } from 'react';
import {
  TextField,
  TextFieldProps as MuiTextFieldProps,
  InputAdornment,
  IconButton,
  Box,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Visibility, VisibilityOff, Search } from '@mui/icons-material';
import { primary, severity, semantic } from '@/theme/palette';
import { borderRadius, componentSize, transitions } from '@/theme/designTokens';

// ============================================================================
// TYPES
// ============================================================================

export type InputVariant = 'text' | 'password' | 'search' | 'textarea';
export type InputSize = 'small' | 'medium' | 'large';

export interface InputProps extends Omit<MuiTextFieldProps, 'variant' | 'size'> {
  /** Input variant type */
  inputVariant?: InputVariant;
  /** Input size */
  size?: InputSize;
  /** Label text */
  label?: string;
  /** Helper text below input */
  helperText?: string;
  /** Error state */
  error?: boolean;
  /** Error message (sets error state automatically) */
  errorMessage?: string;
  /** Icon to display before the input */
  startAdornment?: React.ReactNode;
  /** Icon to display after the input */
  endAdornment?: React.ReactNode;
  /** Full width input */
  fullWidth?: boolean;
  /** Number of rows for textarea (only for textarea variant) */
  rows?: number;
  /** Maximum number of rows for auto-resize textarea */
  maxRows?: number;
  /** Minimum number of rows for auto-resize textarea */
  minRows?: number;
}

// ============================================================================
// SIZE STYLES
// ============================================================================

interface SizeStyle {
  height: number;
  fontSize: string;
  padding: string;
}

const sizeStyles: Record<InputSize, SizeStyle> = {
  small: {
    height: componentSize.input.small,
    fontSize: '0.8125rem',
    padding: '8px 12px',
  },
  medium: {
    height: componentSize.input.medium,
    fontSize: '0.875rem',
    padding: '10px 14px',
  },
  large: {
    height: componentSize.input.large,
    fontSize: '0.9375rem',
    padding: '12px 16px',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Enhanced Input component with clinical styling.
 *
 * @example
 * ```tsx
 * <Input
 *   inputVariant="text"
 *   label="Patient Name"
 *   placeholder="Enter patient name"
 * />
 *
 * <Input
 *   inputVariant="password"
 *   label="Password"
 *   error={hasError}
 *   errorMessage="Password is required"
 * />
 *
 * <Input
 *   inputVariant="search"
 *   placeholder="Search medications..."
 *   fullWidth
 * />
 *
 * <Input
 *   inputVariant="textarea"
 *   label="Clinical Notes"
 *   rows={4}
 *   maxRows={8}
 * />
 * ```
 */
export const Input = forwardRef<HTMLDivElement, InputProps>(
  (
    {
      inputVariant = 'text',
      size = 'medium',
      label,
      helperText,
      error = false,
      errorMessage,
      startAdornment,
      endAdornment,
      fullWidth = false,
      rows,
      maxRows,
      minRows,
      disabled,
      sx,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const hasError = error || Boolean(errorMessage);
    const displayHelperText = errorMessage || helperText;

    const handleTogglePasswordVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    // Determine the MUI TextField variant and multiline settings
    const isTextarea = inputVariant === 'textarea';
    const isPassword = inputVariant === 'password';
    const isSearch = inputVariant === 'search';

    // Build start adornment
    const renderStartAdornment = () => {
      if (isSearch && !startAdornment) {
        return (
          <InputAdornment position="start">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: 'text.secondary',
              }}
            >
              <Search fontSize={size === 'small' ? 'small' : 'medium'} />
            </Box>
          </InputAdornment>
        );
      }
      if (startAdornment) {
        return <InputAdornment position="start">{startAdornment}</InputAdornment>;
      }
      return undefined;
    };

    // Build end adornment
    const renderEndAdornment = () => {
      if (isPassword) {
        return (
          <InputAdornment position="end">
            <IconButton
              onClick={handleTogglePasswordVisibility}
              edge="end"
              size={size}
              disabled={disabled}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: primary.main,
                },
              }}
            >
              {showPassword ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>
        );
      }
      if (endAdornment) {
        return <InputAdornment position="end">{endAdornment}</InputAdornment>;
      }
      return undefined;
    };

    // Determine input type
    const getInputType = (): string | undefined => {
      if (isPassword) {
        return showPassword ? 'text' : 'password';
      }
      if (isTextarea) {
        return undefined; // Multiline doesn't use type
      }
      return inputVariant;
    };

    return (
      <TextField
        ref={ref}
        type={getInputType()}
        variant="outlined"
        label={label}
        placeholder={props.placeholder}
        error={hasError}
        helperText={displayHelperText}
        disabled={disabled}
        fullWidth={fullWidth}
        multiline={isTextarea}
        rows={isTextarea ? rows : undefined}
        maxRows={isTextarea ? maxRows : undefined}
        minRows={isTextarea ? minRows : undefined}
        InputProps={{
          startAdornment: renderStartAdornment(),
          endAdornment: renderEndAdornment(),
        }}
        sx={{
          // Base input styling
          '& .MuiOutlinedInput-root': {
            borderRadius: borderRadius.sm,
            transition: transitions.common,
            backgroundColor: 'background.paper',
            ...sizeStyles[size],

            // Default border
            '& fieldset': {
              borderColor: 'divider',
              transition: transitions.borderColor,
            },

            // Hover state
            '&:hover:not(.Mui-disabled)': {
              '& fieldset': {
                borderColor: primary.light,
              },
            },

            // Focused state
            '&.Mui-focused': {
              '& fieldset': {
                borderColor: primary.main,
                borderWidth: '2px',
                boxShadow: `0 0 0 3px ${alpha(primary.main, 0.12)}`,
              },
            },

            // Error state
            '&.Mui-error': {
              '& fieldset': {
                borderColor: semantic.error.main,
              },
              '&:hover fieldset': {
                borderColor: semantic.error.dark,
              },
              '&.Mui-focused fieldset': {
                borderColor: semantic.error.main,
                boxShadow: `0 0 0 3px ${alpha(semantic.error.main, 0.12)}`,
              },
            },

            // Disabled state
            '&.Mui-disabled': {
              backgroundColor: alpha('#000000', 0.04),
              '& fieldset': {
                borderColor: 'divider',
              },
            },
          },

          // Label styling
          '& .MuiInputLabel-root': {
            fontSize: sizeStyles[size].fontSize,
            color: 'text.secondary',

            '&.Mui-focused': {
              color: hasError ? semantic.error.main : primary.main,
            },

            '&.Mui-error': {
              color: semantic.error.main,
            },
          },

          // Helper text styling
          '& .MuiFormHelperText-root': {
            fontSize: '0.75rem',
            marginTop: '4px',

            '&.Mui-error': {
              color: semantic.error.main,
            },
          },

          // Placeholder styling
          '& input::placeholder, & textarea::placeholder': {
            color: 'text.disabled',
            opacity: 1,
          },

          // Override with custom sx
          ...sx,
        }}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export default Input;

// ============================================================================
// SPECIALIZED INPUT EXPORTS
// ============================================================================

/**
 * Search Input component with search icon.
 */
export interface SearchInputProps extends Omit<InputProps, 'inputVariant'> {}

export const SearchInput = forwardRef<HTMLDivElement, SearchInputProps>(
  ({ ...props }, ref) => {
    return <Input ref={ref} inputVariant="search" {...props} />;
  }
);

SearchInput.displayName = 'SearchInput';

/**
 * Password Input component with show/hide toggle.
 */
export interface PasswordInputProps extends Omit<InputProps, 'inputVariant' | 'type'> {}

export const PasswordInput = forwardRef<HTMLDivElement, PasswordInputProps>(
  ({ ...props }, ref) => {
    return <Input ref={ref} inputVariant="password" {...props} />;
  }
);

PasswordInput.displayName = 'PasswordInput';

/**
 * Textarea component with auto-resize capability.
 */
export interface TextareaProps extends Omit<InputProps, 'inputVariant'> {}

export const Textarea = forwardRef<HTMLDivElement, TextareaProps>(
  ({ rows = 4, ...props }, ref) => {
    return <Input ref={ref} inputVariant="textarea" rows={rows} {...props} />;
  }
);

Textarea.displayName = 'Textarea';
