import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  Mail,
  Send,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Sparkles,
  Inbox,
  FileText,
  ShieldCheck,
  X,
  ArrowRight,
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  logout,
  fetchGmailMessages,
  sendGmailMessage,
  getCurrentGoogleUser,
  getAccessToken,
  GmailMessageItem,
} from '../services/gmailAuth';

interface GmailWorkspacePanelProps {
  onUseEmailAsCrewInput?: (formattedTopic: string) => void;
  defaultComposeBody?: string;
  defaultComposeSubject?: string;
  compact?: boolean;
}

export const GmailWorkspacePanel: React.FC<GmailWorkspacePanelProps> = ({
  onUseEmailAsCrewInput,
  defaultComposeBody = '',
  defaultComposeSubject = '',
  compact = false,
}) => {
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'inbox' | 'compose'>('inbox');
  const [messages, setMessages] = useState<GmailMessageItem[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageItem | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Compose state
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState<string>(
    defaultComposeSubject || 'CrewAI Autonomous Execution Report'
  );
  const [composeBody, setComposeBody] = useState<string>(defaultComposeBody);
  const [showSendConfirmModal, setShowSendConfirmModal] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  useEffect(() => {
    if (defaultComposeBody) {
      setComposeBody(defaultComposeBody);
    }
  }, [defaultComposeBody]);

  useEffect(() => {
    if (defaultComposeSubject) {
      setComposeSubject(defaultComposeSubject);
    }
  }, [defaultComposeSubject]);

  const loadInbox = useCallback(async (query = '') => {
    setIsLoadingMessages(true);
    setErrorMessage(null);
    try {
      const items = await fetchGmailMessages(8, query);
      setMessages(items);
      if (items.length > 0) {
        setSelectedMessage((prev) => prev || items[0]);
      } else {
        setSelectedMessage(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
        if (!composeTo && authedUser.email) {
          setComposeTo(authedUser.email);
        }
        loadInbox('');
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
        setMessages([]);
        setSelectedMessage(null);
      }
    );

    // Also check if already authenticated in memory
    getAccessToken().then((token) => {
      const currentUser = getCurrentGoogleUser();
      if (token && currentUser) {
        setUser(currentUser);
        setNeedsAuth(false);
        if (!composeTo && currentUser.email) {
          setComposeTo(currentUser.email);
        }
        loadInbox('');
      }
    });

    return () => unsubscribe();
  }, [loadInbox, composeTo]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        if (!composeTo && result.user.email) {
          setComposeTo(result.user.email);
        }
        await loadInbox(searchQuery);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in cancelled or failed';
      setErrorMessage(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
    setMessages([]);
    setSelectedMessage(null);
    setStatusBanner(null);
  };

  const handleRequestSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusBanner(null);
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      setErrorMessage('Please provide recipient email, subject, and message body.');
      return;
    }
    // Mandatory explicit user confirmation before sending email on behalf of user
    setShowSendConfirmModal(true);
  };

  const handleConfirmSendEmail = async () => {
    setIsSending(true);
    setErrorMessage(null);
    try {
      const res = await sendGmailMessage({
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
      });
      setShowSendConfirmModal(false);
      setStatusBanner(`Email sent via Gmail (Message ID: ${res.id})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'AUTH_REQUIRED') {
        setShowSendConfirmModal(false);
        setNeedsAuth(true);
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden shadow-xl">
      {/* Top Bar */}
      <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                GmailToolkit — Live Google Workspace Integration
              </h3>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                1P Workspace OAuth
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Read inbox threads as CrewAI agent inputs and dispatch autonomous reports with user permission.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!needsAuth && user ? (
            <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-200 font-medium truncate max-w-[180px]">
                {user.email || user.displayName}
              </span>
              <button
                onClick={handleLogout}
                title="Sign out of Google Workspace"
                className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 ml-1 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Authentication required</span>
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={compact ? 'p-4' : 'p-5'}>
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {statusBanner && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusBanner}</span>
            </div>
            <button
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {needsAuth ? (
          <div className="py-6 px-4 text-center max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center mx-auto text-[#EB6658]">
              <Mail className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-bold text-white">
                Connect Gmail to CrewAI Tools
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sign in with your Google account to grant permission to read inbox messages (`gmail.readonly`) for agent research tasks and send automated CrewAI reports (`gmail.send`).
              </p>
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs shadow-md transition disabled:opacity-60 cursor-pointer"
              >
                <div className="gsi-material-button-state" />
                <div className="gsi-material-button-content-wrapper flex items-center gap-2.5">
                  <div className="gsi-material-button-icon w-4 h-4">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="block w-4 h-4"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isLoggingIn ? 'Connecting to Google...' : 'Sign in with Google'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sub-navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('inbox')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'inbox'
                      ? 'bg-[#EB6658] text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Inbox className="w-3.5 h-3.5" />
                  <span>Read Inbox ({messages.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('compose')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'compose'
                      ? 'bg-[#EB6658] text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Agent Report</span>
                </button>
              </div>

              {activeTab === 'inbox' && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') loadInbox(searchQuery);
                      }}
                      placeholder="Gmail query (e.g. is:unread)..."
                      className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-[#EB6658] outline-none w-48 sm:w-64"
                    />
                  </div>
                  <button
                    onClick={() => loadInbox(searchQuery)}
                    disabled={isLoadingMessages}
                    className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
                    title="Refresh Inbox"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingMessages ? 'animate-spin text-[#EB6658]' : ''}`}
                    />
                  </button>
                </div>
              )}
            </div>

            {activeTab === 'inbox' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Message List */}
                <div className="lg:col-span-5 space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {isLoadingMessages ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Loading Gmail messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      No messages found matching your query.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isSelected = selectedMessage?.id === msg.id;
                      return (
                        <button
                          key={msg.id}
                          onClick={() => setSelectedMessage(msg)}
                          className={`w-full text-left p-3 rounded-xl border transition block ${
                            isSelected
                              ? 'bg-[#EB6658]/10 border-[#EB6658]/50'
                              : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white truncate">
                              {msg.subject}
                            </span>
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {msg.date ? msg.date.split(' ').slice(0, 3).join(' ') : ''}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {msg.from}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                            {msg.snippet}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Selected Message Inspector */}
                <div className="lg:col-span-7 rounded-xl bg-slate-950/90 border border-slate-800 p-4 flex flex-col justify-between min-h-[260px]">
                  {selectedMessage ? (
                    <>
                      <div className="space-y-3">
                        <div className="border-b border-slate-800 pb-3">
                          <h4 className="text-sm font-bold text-white">
                            {selectedMessage.subject}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 mt-1">
                            <span>
                              <strong className="text-slate-300">From:</strong>{' '}
                              {selectedMessage.from}
                            </span>
                            <span>
                              <strong className="text-slate-300">Date:</strong>{' '}
                              {selectedMessage.date}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-300 whitespace-pre-wrap max-h-[180px] overflow-y-auto font-mono leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                          {selectedMessage.bodyText || selectedMessage.snippet}
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            const replyEmail =
                              selectedMessage.from.match(/<([^>]+)>/)?.[1] ||
                              selectedMessage.from;
                            setComposeTo(replyEmail);
                            setComposeSubject(
                              selectedMessage.subject.startsWith('Re:')
                                ? selectedMessage.subject
                                : `Re: ${selectedMessage.subject}`
                            );
                            setActiveTab('compose');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
                        >
                          <Send className="w-3.5 h-3.5 text-[#EB6658]" />
                          <span>Draft Reply in Gmail Tool</span>
                        </button>

                        {onUseEmailAsCrewInput && (
                          <button
                            onClick={() => {
                              const formatted = `Email Subject: ${selectedMessage.subject}\nFrom: ${selectedMessage.from}\nContent:\n${(
                                selectedMessage.bodyText || selectedMessage.snippet
                              ).slice(0, 600)}`;
                              onUseEmailAsCrewInput(formatted);
                              setStatusBanner(
                                'Loaded email thread into Crew Studio as Mission Topic!'
                              );
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Send Thread to Crew Studio</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="m-auto text-center text-xs text-slate-500 py-10">
                      Select an email from your Gmail inbox to inspect or send to a CrewAI agent.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Compose & Send Tab */
              <form onSubmit={handleRequestSendEmail} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Recipient (To)
                    </label>
                    <input
                      type="email"
                      required
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-[#EB6658] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      placeholder="CrewAI Autonomous Execution Summary"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-[#EB6658] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Email Body / Agent Output Report
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder="Paste or generate your CrewAI task report here..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:border-[#EB6658] outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Requires explicit confirmation before sending via Gmail API.</span>
                  </span>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-bold flex items-center gap-2 shadow-md transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Review & Send Email</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Mandatory User Confirmation Dialog before mutating/sending email */}
      {showSendConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white">
                  Confirm Sending Email via Gmail
                </h4>
              </div>
              <button
                onClick={() => setShowSendConfirmModal(false)}
                disabled={isSending}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You are about to send an email from your connected Gmail account (
              <span className="text-white font-semibold">{user?.email}</span>). Please confirm the details below:
            </p>

            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-1.5 text-xs">
              <div>
                <span className="text-slate-500">To: </span>
                <span className="text-slate-200 font-mono">{composeTo}</span>
              </div>
              <div>
                <span className="text-slate-500">Subject: </span>
                <span className="text-slate-200 font-semibold">{composeSubject}</span>
              </div>
              <div className="pt-1 border-t border-slate-800/80">
                <span className="text-slate-500 block mb-1">Message Preview:</span>
                <p className="text-slate-300 font-mono text-[11px] line-clamp-4 whitespace-pre-wrap">
                  {composeBody}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isSending}
                onClick={() => setShowSendConfirmModal(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={handleConfirmSendEmail}
                className="px-4 py-2 rounded-xl bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Sending...' : 'Confirm & Send Email'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
