import React, { useState, useEffect } from 'react';
import { Bell, Save, Sparkles } from 'lucide-react';
import { emitJulesPrNotification } from '../utils/prNotifications';
import { CardMinMaxButtons } from './CardMinMaxControl';

export const WebhookSettingsPanel: React.FC<{ onNotify: (type: 'success' | 'error', message: string) => void }> = ({ onNotify }) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookType, setWebhookType] = useState<'slack' | 'discord'>('slack');
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    fetch('/api/webhooks')
      .then(res => res.json())
      .then(data => {
        setWebhookUrl(data.url || '');
        setWebhookType(data.type || 'slack');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleGlobalToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ minimized: boolean }>).detail;
      if (detail && typeof detail.minimized === 'boolean') {
        setIsMinimized(detail.minimized);
      }
    };
    window.addEventListener('crewai:toggle-all-cards', handleGlobalToggle);
    return () => window.removeEventListener('crewai:toggle-all-cards', handleGlobalToggle);
  }, []);

  const handleSave = async () => {
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, type: webhookType })
      });
      if (res.ok) {
        onNotify('success', 'Webhook settings saved successfully');
      } else {
        onNotify('error', 'Failed to save webhook settings');
      }
    } catch {
      onNotify('error', 'Network error while saving webhook');
    }
  };

  const handleTriggerPrToast = () => {
    const prNum = Math.floor(852 + Math.random() * 120);
    emitJulesPrNotification({
      eventType: 'pr_completed',
      prNumber: prNum,
      prTitle: `feat(jules): automated Cloud VM verification & webhook dispatch (#${prNum})`,
      prUrl: `https://github.com/bingkltech/crewAI/pull/${prNum}`,
      repo: 'bingkltech/crewAI',
      branch: `jules/auto-crew-${prNum}`,
      crewName: 'Autonomous DevOps & SRE Crew',
      coveragePct: '97.2%',
      testsPassed: 46,
      vmTier: 'standard-4core'
    });
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Bell className="w-4 h-4" />
          </span>
          <span>Automated Alerts & PR Notification Settings</span>
        </h3>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleTriggerPrToast}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-semibold transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simulate Jules PR Toast</span>
          </button>

          <CardMinMaxButtons
            isMinimized={isMinimized}
            onMinimize={() => setIsMinimized(true)}
            onExpand={() => setIsMinimized(false)}
            title="Automated Alerts & PR Notification Settings"
          />
        </div>
      </div>

      {!isMinimized && (
        <div className="space-y-3 pt-1 border-t border-slate-800/80">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Webhook Type</label>
            <select 
              value={webhookType} 
              onChange={(e) => setWebhookType(e.target.value as 'slack' | 'discord')}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            >
              <option value="slack">Slack</option>
              <option value="discord">Discord</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Webhook URL</label>
            <input 
              type="text" 
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            />
          </div>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Save Webhook
          </button>
        </div>
      )}
    </div>
  );
};
