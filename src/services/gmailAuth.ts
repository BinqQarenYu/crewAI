import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { message_content_text } from '../utils/messageContent';

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token strictly in memory (never localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

export interface GmailMessageItem {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  bodyText: string;
  labelIds: string[];
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentGoogleUser = (): User | null => {
  return auth.currentUser;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

function decodeBase64Url(base64Url: string): string {
  try {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLength);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface GmailMimePayload {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMimePayload[];
  headers?: Array<{ name: string; value: string }>;
}

function extractBodyText(payload?: GmailMimePayload): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      const nested = extractBodyText(part);
      if (nested) return nested;
    }
  }
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  return '';
}

export async function fetchGmailMessages(
  maxResults = 10,
  query = ''
): Promise<GmailMessageItem[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const params = new URLSearchParams({
    maxResults: String(maxResults),
  });
  if (query.trim()) {
    params.set('q', query.trim());
  }

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (listRes.status === 401 || listRes.status === 403) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Gmail API error (${listRes.status}): ${errText}`);
  }

  const listData = (await listRes.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
  };

  if (!listData.messages || listData.messages.length === 0) {
    return [];
  }

  const detailedMessages = await Promise.all(
    listData.messages.slice(0, maxResults).map(async (m) => {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!detailRes.ok) return null;
      const detail = (await detailRes.json()) as {
        id: string;
        threadId: string;
        snippet?: string;
        labelIds?: string[];
        payload?: GmailMimePayload;
      };

      const headers = detail.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const rawBody = extractBodyText(detail.payload) || detail.snippet || '';
      const cleanBody = message_content_text(rawBody);

      return {
        id: detail.id,
        threadId: detail.threadId,
        subject: getHeader('Subject') || '(No Subject)',
        from: getHeader('From') || 'Unknown Sender',
        to: getHeader('To') || 'me',
        date: getHeader('Date') || '',
        snippet: detail.snippet || '',
        bodyText: cleanBody,
        labelIds: detail.labelIds || [],
      } as GmailMessageItem;
    })
  );

  return detailedMessages.filter((item): item is GmailMessageItem => item !== null);
}

export async function sendGmailMessage(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string; threadId: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const safeBody = message_content_text(params.body);
  const mimeMessage = [
    `To: ${params.to.trim()}`,
    `Subject: ${params.subject.trim()}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    safeBody,
  ].join('\r\n');

  const raw = encodeBase64Url(mimeMessage);

  const sendRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (sendRes.status === 401 || sendRes.status === 403) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }

  if (!sendRes.ok) {
    const errText = await sendRes.text();
    throw new Error(`Failed to send email (${sendRes.status}): ${errText}`);
  }

  return (await sendRes.json()) as { id: string; threadId: string };
}
