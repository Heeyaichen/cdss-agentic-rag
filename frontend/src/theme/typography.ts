/**
 * CDSS Typography Configuration
 *
 * Typography system using Inter font family with a 12-level modular scale.
 * Designed for clinical readability and professional medical interfaces.
 *
 * @module typography
 */

import type { TypographyOptions } from '@mui/material/styles/createTypography';

// ============================================================================
// FONT FAMILY
// ============================================================================

/**
 * Primary font family stack.
 * Inter is a variable font optimized for screen readability.
 */
export const fontFamily = {
  primary: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  monospace: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
} as const;

// ============================================================================
// FONT SIZE SCALE (12-LEVEL MODULAR SCALE)
// ============================================================================

/**
 * Font size scale from 12px to 48px.
 * Based on a ~1.25 modular ratio for consistent scaling.
 */
export const fontSize = {
  /** 12px - Captions, legal text, footnotes */
  xs: '0.75rem',    // 12px
  /** 14px - Small body text, labels, helper text */
  sm: '0.875rem',   // 14px
  /** 16px - Base body text */
  base: '1rem',     // 16px
  /** 18px - Large body text, lead paragraphs */
  lg: '1.125rem',   // 18px
  /** 20px - Small headings, emphasized text */
  xl: '1.25rem',    // 20px
  /** 24px - H6, card titles */
  '2xl': '1.5rem',  // 24px
  /** 28px - H5, section titles */
  '3xl': '1.75rem', // 28px
  /** 32px - H4, page subsections */
  '4xl': '2rem',    // 32px
  /** 36px - H3, page sections */
  '5xl': '2.25rem', // 36px
  /** 40px - H2, major sections */
  '6xl': '2.5rem',  // 40px
  /** 44px - H1, page titles */
  '7xl': '2.75rem', // 44px
  /** 48px - Hero, display headings */
  '8xl': '3rem',    // 48px
} as const;

// ============================================================================
// FONT WEIGHT SCALE
// ============================================================================

/**
 * Font weight values for typographic hierarchy.
 */
export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

// ============================================================================
// LINE HEIGHT SCALE
// ============================================================================

/**
 * Line height values for optimal readability.
 */
export const lineHeight = {
  tight: 1,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

// ============================================================================
// LETTER SPACING SCALE
// ============================================================================

/**
 * Letter spacing values for typographic refinement.
 */
export const letterSpacing = {
  tighter: '-0.025em',
  tight: '-0.015em',
  normal: '0',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
} as const;

// ============================================================================
// MUI TYPOGRAPHY OPTIONS
// ============================================================================

/**
 * Complete typography configuration for MUI theme.
 * Maps design tokens to MUI's typography variants.
 */
export const typographyOptions: TypographyOptions = {
  fontFamily: fontFamily.primary,
  fontSize: 16,
  htmlFontSize: 16,
  fontWeightLight: fontWeight.light,
  fontWeightRegular: fontWeight.regular,
  fontWeightMedium: fontWeight.medium,
  fontWeightBold: fontWeight.bold,
  
  // Heading styles
  h1: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize['7xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tighter,
  },
  h2: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize['6xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tighter,
  },
  h3: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize['5xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.tight,
  },
  h4: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.tight,
  },
  h5: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  h6: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  
  // Body styles
  body1: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
  },
  body2: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  
  // Specialized styles
  subtitle1: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.tight,
  },
  subtitle2: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.tight,
  },
  
  // Caption and overline
  caption: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.wide,
  },
  overline: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
  },
  
  // Button text
  button: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.wide,
    textTransform: 'none',
  },
};

// ============================================================================
// CLINICAL TYPOGRAPHY VARIANTS
// ============================================================================

/**
 * Clinical-specific typography variants for medical content.
 * These extend the base MUI variants for domain-specific use cases.
 */
export const clinicalTypography = {
  /** Drug name styling */
  drugName: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Dosage information */
  dosage: {
    fontFamily: fontFamily.monospace,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Medical code (ICD-10, LOINC, RxNorm) */
  medicalCode: {
    fontFamily: fontFamily.monospace,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Clinical recommendation text */
  recommendation: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
  },
  /** Evidence citation */
  citation: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    fontStyle: 'italic',
  },
  /** Alert/warning text */
  alertText: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.wide,
  },
  /** Patient identifier */
  patientId: {
    fontFamily: fontFamily.monospace,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Timestamp/date */
  timestamp: {
    fontFamily: fontFamily.monospace,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type FontFamily = typeof fontFamily;
export type FontSize = typeof fontSize;
export type FontWeight = typeof fontWeight;
export type LineHeight = typeof lineHeight;
export type LetterSpacing = typeof letterSpacing;
export type ClinicalTypography = typeof clinicalTypography;
