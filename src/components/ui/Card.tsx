/**
 * CDSS Card Component
 *
 * Card container with variants and clinical styling.
 * Uses design tokens from the theme system for consistent styling.
 *
 * @module Card
 */

import React, { forwardRef, ReactNode } from "react";
import { Box, Card as MuiCard, CardContent, CardProps as MuiCardProps, Skeleton as MuiSkeleton } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { borderRadius } from "@/theme/designTokens";
import { transitions } from "@/theme/motion";
import { primary } from "@/theme/palette";
import { shadows } from "@/theme/shadows";

export type CardVariant = "default" | "elevated" | "outlined" | "clinical";

export interface CardProps extends Omit<MuiCardProps, 'variant'> {
  /** Card variant style */
  variant?: CardVariant;
  /** Show loading skeleton */
  loading?: boolean;
  /** Card header content */
  header?: ReactNode;
  /** Card footer content */
  footer?: ReactNode;
  /** Enable hover effects */
  hoverable?: boolean;
  /** Accent color for clinical variant */
  accentColor?: string;
}

// ============================================================================
// VARIANT STYLES
// ============================================================================

const getVariantStyles = (variant: CardVariant, accentColor?: string): object => {
  const accent = accentColor || primary.main;

  const styles: Record<CardVariant, object> = {
    default: {
      backgroundColor: 'background.paper',
      boxShadow: shadows[1],
    },
    elevated: {
      backgroundColor: 'background.paper',
      boxShadow: shadows[3],
      transform: 'translateY(0)',
    },
    outlined: {
      backgroundColor: 'background.paper',
      border: `1px solid`,
      borderColor: 'divider',
      boxShadow: 'none',
    },
    clinical: {
      backgroundColor: 'background.paper',
      borderLeft: `4px solid ${accent}`,
      boxShadow: shadows[2],
    },
  };

  return styles[variant];
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Enhanced Card component with clinical styling.
 *
 * @example
 * ```tsx
 * <Card variant="clinical" accentColor="#DC2626">
 *   <CardContent>
 *     Drug Interaction Alert
 *   </CardContent>
 * </Card>
 *
 * <Card variant="elevated" hoverable>
 *   <CardContent>
 *     Hoverable elevated card
 *   </CardContent>
 * </Card>
 */
const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "default",
      loading = false,
      hoverable = false,
      children,
      header,
      footer,
      accentColor,
      sx,
      ...props
    },
    ref
  ) => {
    return (
      <MuiCard
        ref={ref}
        sx={{
          // Base styles
          borderRadius: borderRadius.md,
          transition: transitions.shadow.standard,
          overflow: "hidden",

          // Variant styles
          ...getVariantStyles(variant, accentColor),

          // Hoverable state
          ...(hoverable && {
            cursor: "pointer",
            "&:hover": {
              boxShadow: shadows[3],
              transform: "translateY(-2px)",
            },
          }),

          // Override with custom sx
          ...sx,
        }}
        {...props}
      >
        {/* Header */}
        {header && (
          <Box
            sx={{
              p: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
              bgcolor: alpha(primary.main, 0.02),
            }}
          >
            {header}
          </Box>
        )}

        {/* Content or Loading Skeleton */}
        {loading ? (
          <CardContent>
            <MuiSkeleton variant="text" width="80%" height={24} sx={{ mb: 1 }} />
            <MuiSkeleton variant="text" width="60%" height={20} sx={{ mb: 1 }} />
            <MuiSkeleton variant="rectangular" width="100%" height={60} />
          </CardContent>
        ) : (
          children && <CardContent>{children}</CardContent>
        )}

        {/* Footer */}
        {footer && (
          <Box
            sx={{
              p: 2,
              borderTop: "1px solid",
              borderColor: "divider",
              bgcolor: alpha("#000000", 0.02),
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
            }}
          >
            {footer}
          </Box>
        )}
      </MuiCard>
    );
  }
);

Card.displayName = 'Card';

export default Card;

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * CardHeader component for structured card headers.
 */
export interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, subtitle, action }) => (
  <Box
    sx={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      mb: 2,
    }}
  >
    <Box sx={{ flex: 1 }}>
      {typeof title === 'string' ? (
        <Box component="h3" sx={{ fontSize: "1rem", fontWeight: 600, color: "text.primary", m: 0 }}>
          {title}
        </Box>
      ) : (
        title
      )}
      {subtitle && (
        <Box
          component="p"
          sx={{
            fontSize: "0.875rem",
            color: "text.secondary",
            m: 0,
            mt: 0.5,
          }}
        >
          {subtitle}
        </Box>
      )}
    </Box>
    {action && <Box sx={{ ml: 2 }}>{action}</Box>}
  </Box>
);

CardHeader.displayName = 'CardHeader';
