/**
 * CDSS Theme System - Main Entry Point
 *
 * Comprehensive design system for Clinical Decision Support System.
 * Exports all design tokens, creates MUI themes, and provides utilities.
 *
 * @module theme
 */

import { createTheme, Theme, ThemeOptions } from "@mui/material/styles";

// ============================================================================
// RE-EXPORT ALL DESIGN TOKENS
// ============================================================================

export {
  // Spacing
  spacing,
  type Spacing,

  // Border radius
  borderRadius,
  type BorderRadius,

  // Typography
  typography,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  type FontSize,
  type FontWeight,
  type LineHeight,
  type LetterSpacing,

  // Elevation
  elevation,
  type Elevation,

  // Motion container
  motion,
  
  // Z-index
  zIndex,
  type ZIndex,

  // Breakpoints
  breakpoints,
  type Breakpoint,

  // Opacity
  opacity,
  type Opacity,

  // Component sizes
  componentSize,

  // Complete token collection
  designTokens,
  type DesignTokens,
} from './designTokens';

// ============================================================================
// RE-EXPORT PALETTE
// ============================================================================

export {
  // Primary colors
  primary,
  secondary,
  
  // Severity colors (SEMANTICALLY STABLE)
  severity,
  type SeverityLevel,
  
  // Semantic colors
  semantic,
  
  // Neutral colors
  neutral,
  
  // Mode palettes
  lightPalette,
  darkPalette,
  
  // Clinical colors
  clinical,
  
  // Utilities
  alpha,
  generateCssCustomProperties,
  
  // Types
  type PaletteMode,
} from './palette';

// ============================================================================
// RE-EXPORT TYPOGRAPHY
// ============================================================================

export {
  fontFamily,
  fontSize as typographyFontSize,
  fontWeight as typographyFontWeight,
  lineHeight as typographyLineHeight,
  letterSpacing as typographyLetterSpacing,
  typographyOptions,
  clinicalTypography,
  type FontFamily,
  type FontSize as TypographyFontSize,
  type FontWeight as TypographyFontWeight,
  type LineHeight as TypographyLineHeight,
  type LetterSpacing as TypographyLetterSpacing,
  type ClinicalTypography,
} from './typography';

// ============================================================================
// RE-EXPORT SHADOWS
// ============================================================================

export {
  shadows,
  darkShadows,
  clinicalShadows,
  interactiveShadows,
  componentShadows,
  createColoredShadow,
  type Shadow,
  type ClinicalShadow,
  type InteractiveShadow,
  type ComponentShadow,
} from './shadows';

export {
  duration,
  easing,
  transitions,
  keyframes,
  animations,
  reducedMotion,
  type Duration as MotionDuration,
  type Easing as MotionEasing,
  type Transitions,
  type Keyframes,
  type Animations,
} from './motion';

// ============================================================================
// THEME CREATION
// ============================================================================

import { lightPalette, darkPalette, severity, clinical, semantic } from './palette';
import { typographyOptions } from './typography';
import { shadows, darkShadows, clinicalShadows, componentShadows } from './shadows';
import { duration, easing, transitions } from './motion';
import { borderRadius, zIndex } from './designTokens';

/**
 * Theme options for light mode.
 */
const lightThemeOptions: ThemeOptions = {
  palette: lightPalette,
  typography: typographyOptions,
  shadows: shadows as unknown as Theme['shadows'],
  shape: {
    borderRadius: borderRadius.md,
  },
  spacing: (factor: number) => `${factor * 4}px`,
  zIndex: {
    mobileStepper: zIndex.dropdown,
    speedDial: zIndex.dropdown,
    appBar: zIndex.fixed,
    drawer: zIndex.sticky,
    modal: zIndex.modal,
    snackbar: zIndex.toast,
    tooltip: zIndex.tooltip,
  },
  transitions: {
    duration: {
      shortest: duration.fast,
      shorter: duration.micro,
      short: duration.standard,
      standard: duration.standard,
      complex: duration.slow,
      enteringScreen: duration.slow,
      leavingScreen: duration.standard,
    },
    easing: {
      easeInOut: easing.easeInOut,
      easeOut: easing.easeOut,
      easeIn: easing.easeIn,
      sharp: easing.sharp,
    },
  },
  components: {
    // Button customizations
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: borderRadius.sm,
          transition: transitions.interactive,
        },
        contained: {
          boxShadow: shadows[1],
          '&:hover': {
            boxShadow: shadows[2],
          },
        },
      },
    },
    // Card customizations
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.md,
          boxShadow: shadows[2],
          transition: transitions.shadow.standard,
          '&:hover': {
            boxShadow: shadows[3],
          },
        },
      },
    },
    // Input customizations
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: borderRadius.sm,
          },
        },
      },
    },
    // Dialog customizations
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: borderRadius.lg,
          boxShadow: shadows[4],
        },
      },
    },
    // Alert customizations for clinical use
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.sm,
          fontWeight: 500,
        },
        standardError: {
          backgroundColor: severity.major.bgLight,
          color: severity.major.dark,
        },
        standardWarning: {
          backgroundColor: severity.moderate.bgLight,
          color: severity.moderate.dark,
        },
        standardInfo: {
          backgroundColor: severity.minor.bgLight,
          color: severity.minor.dark,
        },
        standardSuccess: {
          backgroundColor: severity.none.bgLight,
          color: severity.none.dark,
        },
      },
    },
    // Chip customizations
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.xs,
          fontWeight: 500,
        },
      },
    },
    // Tooltip customizations
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: borderRadius.xs,
          fontSize: '0.75rem',
        },
      },
    },
    // Snackbar customizations
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiSnackbarContent-root': {
            borderRadius: borderRadius.md,
            boxShadow: componentShadows.snackbar,
          },
        },
      },
    },
  },
};

/**
 * Theme options for dark mode.
 */
const darkThemeOptions: ThemeOptions = {
  ...lightThemeOptions,
  palette: darkPalette,
  shadows: darkShadows as unknown as Theme['shadows'],
};

/**
 * Create the light theme.
 */
export const lightTheme = createTheme(lightThemeOptions);

/**
 * Create the dark theme.
 */
export const darkTheme = createTheme(darkThemeOptions);

// ============================================================================
// THEME UTILITIES
// ============================================================================

/**
 * Get theme by mode.
 * @param mode - 'light' or 'dark'
 * @returns The corresponding MUI theme
 */
export function getTheme(mode: 'light' | 'dark'): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}

/**
 * Get severity color configuration.
 * @param level - Severity level ('major' | 'moderate' | 'minor' | 'none')
 * @returns Severity color configuration
 */
export function getSeverityColor(level: keyof typeof severity) {
  return severity[level];
}

/**
 * Get clinical status color.
 * @param category - Clinical category (e.g., 'patientStatus', 'labStatus')
 * @param status - Status key within the category
 * @returns The color hex value
 */
export function getClinicalColor<K extends keyof typeof clinical>(
  category: K,
  status: keyof typeof clinical[K]
): string {
  return clinical[category][status] as string;
}

// ============================================================================
// CSS CUSTOM PROPERTIES
// ============================================================================

/**
 * Inject CSS custom properties into the document root.
 * Call this once at app initialization.
 */
export function injectCssCustomProperties(theme: Theme): void {
  const root = document.documentElement;
  
  // Primary colors
  root.style.setProperty('--cdss-primary-main', theme.palette.primary.main);
  root.style.setProperty('--cdss-primary-light', theme.palette.primary.light ?? '');
  root.style.setProperty('--cdss-primary-dark', theme.palette.primary.dark ?? '');
  
  // Background colors
  root.style.setProperty('--cdss-background-default', theme.palette.background.default);
  root.style.setProperty('--cdss-background-paper', theme.palette.background.paper);
  
  // Text colors
  root.style.setProperty('--cdss-text-primary', theme.palette.text.primary);
  root.style.setProperty('--cdss-text-secondary', theme.palette.text.secondary);
  
  // Severity colors (ALWAYS semantically stable)
  root.style.setProperty('--cdss-severity-major', severity.major.main);
  root.style.setProperty('--cdss-severity-moderate', severity.moderate.main);
  root.style.setProperty('--cdss-severity-minor', severity.minor.main);
  root.style.setProperty('--cdss-severity-none', severity.none.main);
  
  // Semantic colors
  root.style.setProperty('--cdss-success', semantic.success.main);
  root.style.setProperty('--cdss-info', semantic.info.main);
  root.style.setProperty('--cdss-warning', semantic.warning.main);
  root.style.setProperty('--cdss-error', semantic.error.main);
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { Theme, ThemeOptions };

/**
 * Extended theme with CDSS-specific properties.
 */
export interface CDSSTheme extends Theme {
  cdss: {
    severity: typeof severity;
    clinical: typeof clinical;
    shadows: {
      clinical: typeof clinicalShadows;
      components: typeof componentShadows;
    };
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default lightTheme;
