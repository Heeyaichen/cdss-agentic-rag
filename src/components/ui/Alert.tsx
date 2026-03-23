/**
 * CDSS Alert Component
 *
 * Alert component with variants for displaying contextual messages.
 * Uses design tokens from the theme system for consistent styling.
 *
 * @module Alert
 */

import React, { forwardRef, ReactNode } from 'react';
import {
  Alert as MuiAlert,
  AlertProps as MuiAlertProps,
  AlertTitle,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { severity, semantic, primary } from '@/theme/palette';
import { borderRadius, transitions } from '@/theme/designTokens';
import { clinicalShadows } from '@/theme/shadows';

// ============================================================================
// TYPES
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'success';
export type AlertVariant = 'standard' | 'filled' | 'outlined' | 'clinical';

export interface AlertProps extends Omit<MuiAlertProps, 'severity' | 'variant' | 'title'> {
  /** Alert severity level */
  severity?: AlertSeverity;
  /** Alert variant style */
  variant?: AlertVariant;
  /** Alert title */
  title?: ReactNode;
  /** Show close button */
  onClose?: () => void;
  /** Icon to display */
  icon?: ReactNode;
  /** Make alert full width */
  fullWidth?: boolean;
}

// ============================================================================
// SEVERITY CONFIG
// ============================================================================

const severityConfig: Record<AlertSeverity, { color: string }> = {
  info: { color: semantic.info.main },
  warning: { color: semantic.warning.main },
  error: { color: severity.major.main },
  success: { color: semantic.success.main },
};

// ============================================================================
// VARIANT STYLES
// ============================================================================

const getVariantStyles = (
  variant: AlertVariant,
  alertSeverity: AlertSeverity
): object => {
  const { color } = severityConfig[alertSeverity];
  const clinicalShadowBySeverity: Record<AlertSeverity, string> = {
    info: clinicalShadows.info,
    warning: clinicalShadows.warning,
    error: clinicalShadows.critical,
    success: clinicalShadows.success,
  };

  const styles: Record<AlertVariant, object> = {
    standard: {
      backgroundColor: alpha(color, 0.12),
      color: color,
      border: 'none',
      '& .MuiAlert-icon': {
        color: color,
      },
    },
    filled: {
      backgroundColor: color,
      color: primary.contrastText,
      border: 'none',
      '& .MuiAlert-icon': {
        color: primary.contrastText,
      },
    },
    outlined: {
      backgroundColor: 'transparent',
      color: color,
      border: `1px solid ${color}`,
      '& .MuiAlert-icon': {
        color: color,
      },
    },
    clinical: {
      backgroundColor: alpha(color, 0.08),
      color: color,
      borderLeft: `4px solid ${color}`,
      boxShadow: clinicalShadowBySeverity[alertSeverity],
      '& .MuiAlert-icon': {
        color: color,
      },
      '& .MuiAlert-message': {
        fontWeight: 500,
      },
    },
  };

  return styles[variant];
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Enhanced Alert component with clinical styling.
 *
 * @example
 * ```tsx
 * <Alert severity="error" variant="clinical" title="Drug Interaction">
 *   Critical drug interaction detected between medications.
 * </Alert>
 * ```
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      severity: alertSeverity = 'info',
      variant = 'standard',
      title,
      onClose,
      icon,
      fullWidth = false,
      children,
      sx,
      ...props
    },
    ref
  ) => {
    return (
      <MuiAlert
        ref={ref}
        severity={alertSeverity === 'error' ? 'error' : alertSeverity}
        icon={icon}
        sx={{
          borderRadius: borderRadius.md,
          transition: transitions.common,
          ...(fullWidth && { width: '100%' }),

          // Variant styles
          ...getVariantStyles(variant, alertSeverity),

          // Override with custom sx
          ...sx,
        }}
        {...props}
      >
        {title && <AlertTitle>{title}</AlertTitle>}
        {children}
        {onClose && (
          <Box sx={{ position: 'absolute', right: 8, top: 8 }}>
            <IconButton
              size="small"
              onClick={onClose}
              sx={{
                padding: 0.5,
                color: 'inherit',
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>
        )}
      </MuiAlert>
    );
  }
);

Alert.displayName = 'Alert';

export default Alert;

// ============================================================================
// SPECIALIZED ALERTS
// ============================================================================

export interface ErrorAlertProps extends Omit<AlertProps, 'severity'> {}

export const ErrorAlert: React.FC<ErrorAlertProps> = (props) => (
  <Alert severity="error" {...props} />
);

ErrorAlert.displayName = 'ErrorAlert';

export interface WarningAlertProps extends Omit<AlertProps, 'severity'> {}

export const WarningAlert: React.FC<WarningAlertProps> = (props) => (
  <Alert severity="warning" {...props} />
);

WarningAlert.displayName = 'WarningAlert';

export interface InfoAlertProps extends Omit<AlertProps, 'severity'> {}

export const InfoAlert: React.FC<InfoAlertProps> = (props) => (
  <Alert severity="info" {...props} />
);

InfoAlert.displayName = 'InfoAlert';

export interface SuccessAlertProps extends Omit<AlertProps, 'severity'> {}

export const SuccessAlert: React.FC<SuccessAlertProps> = (props) => (
  <Alert severity="success" {...props} />
);

SuccessAlert.displayName = 'SuccessAlert';
