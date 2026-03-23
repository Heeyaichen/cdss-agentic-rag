import { PublicClientApplication, Configuration, AccountInfo } from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'common'}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      piiLoggingEnabled: false, // MANDATORY for HIPAA compliance
    },
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export async function initializeAuth(): Promise<void> {
  await msalInstance.initialize();
  await msalInstance.handleRedirectPromise();
  
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
  }
}

export async function login(): Promise<void> {
  try {
    await msalInstance.loginRedirect({
      scopes: [import.meta.env.VITE_API_SCOPE || 'User.Read'],
    prompt: 'login',
    loginHint: undefined,
  });
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function logout(): Promise<void> {
  const account = msalInstance.getActiveAccount();
  if (account) {
    await msalInstance.logoutRedirect({
      account,
      postLogoutRedirectUri: window.location.origin,
    });
  }
}

export async function getAccessToken(): Promise<string | null> {
  const account = msalInstance.getActiveAccount();
  if (!account) {
    return null;
  }

  try {
    const response = await msalInstance.acquireTokenSilent({
      scopes: [import.meta.env.VITE_API_SCOPE || 'User.Read'],
      account,
    });
    return response.accessToken;
  } catch {
    try {
      const response = await msalInstance.acquireTokenPopup({
        scopes: [import.meta.env.VITE_API_SCOPE || 'User.Read'],
        account,
      });
      return response.accessToken;
    } catch {
      await login();
      return null;
    }
  }
}

export function getActiveAccount(): AccountInfo | null {
  return msalInstance.getActiveAccount();
}

export function isAuthenticated(): boolean {
  return msalInstance.getAllAccounts().length > 0;
}

