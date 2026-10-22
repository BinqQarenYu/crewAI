export interface ProviderStatus {
  github_oauth: boolean;
  github_token: boolean;
  ollama_configured: boolean;
  openai: boolean;
  anthropic: boolean;
  groq: boolean;
  gemini: boolean;
  deepseek: boolean;
  gmicloud: boolean;
  serper_search: boolean;
  firecrawl_scraping: boolean;
  tavily_search: boolean;
  opentelemetry: boolean;
  jules_agent: boolean;
  antigravity: boolean;
}

export interface ConfigStatus {
  status: string;
  environment: string;
  providers: ProviderStatus;
}

export type GeminiBudgetStrategy = 'hybrid_auto' | 'free_tier_guard' | 'argon_priority';

export interface GeminiKeySlotInfo {
  slotId: string;
  label: string;
  maskedKey: string;
  tier: 'free_tier' | 'paid_argon_capable';
  rpmUsed: number;
  rpmLimit: number;
  tpmUsed: number;
  tpmLimit: number;
  rpdUsed: number;
  rpdLimit: number;
  status: 'active' | 'standby' | 'cooldown_prevented';
}

export interface GeminiQuotaStatus {
  activeKeyCount: number;
  currentSlotIndex: number;
  strategy: GeminiBudgetStrategy;
  argonBudgetCapTokens: number;
  argonTokensUsedSession: number;
  freeTierTokensSaved: number;
  autoFailoverCount: number;
  slots: GeminiKeySlotInfo[];
}

export interface SmartRouteDecision {
  selectedModel: string;
  originalModel: string;
  tierUsed: 'paid_argon' | 'free_tier' | 'fallback_provider';
  keySlotUsed: string;
  reason: string;
  wasShifted: boolean;
  estimatedTokens: number;
  headroomPct: number;
}

export const MODEL_PROVIDER_MAP: Record<string, keyof ProviderStatus> = {
  'gemini/gemini-4-argon': 'gemini',
  'gemini/gemini-3.8-flash': 'gemini',
  'gemini/gemini-3.1-flash-lite': 'gemini',
  'gemini/gemini-3-flash-preview': 'gemini',
  'gemini/gemini-2.5-flash': 'gemini',
  'gpt-4o': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-3.5-turbo': 'openai',
  'claude-3-5-sonnet': 'anthropic',
  'anthropic/claude-3-5-sonnet': 'anthropic',
  'claude-3-opus': 'anthropic',
  'claude-3-haiku': 'anthropic',
  'deepseek/deepseek-chat': 'deepseek',
  'deepseek/deepseek-coder': 'deepseek',
  'groq/llama-3.3-70b': 'groq',
  'groq/llama-3.1-70b': 'groq',
  'groq/mixtral-8x7b': 'groq',
  'ollama/llama3.2:3b': 'ollama_configured',
  'ollama/deepseek-r1:8b': 'ollama_configured',
  'ollama-pool/llama3.2': 'ollama_configured',
};

export const GEMINI_MODEL_TIERS: Record<string, {
  tier: 'paid_argon' | 'free_tier';
  label: string;
  rpmLimit: number;
  tpmLimit: number;
  bestFor: string;
}> = {
  'gemini/gemini-4-argon': {
    tier: 'paid_argon',
    label: 'Gemini 4 Argon (Paid Pro Tier)',
    rpmLimit: 360,
    tpmLimit: 4000000,
    bestFor: 'Complex Architecture, Deep Reasoning, Security Audits & Manager Coordination'
  },
  'gemini/gemini-3.8-flash': {
    tier: 'free_tier',
    label: 'Gemini 3.8 Flash (Free Tier Workhorse)',
    rpmLimit: 15,
    tpmLimit: 1000000,
    bestFor: 'High-Speed Agent Execution, Tool Calling & Code Synthesis'
  },
  'gemini/gemini-3.1-flash-lite': {
    tier: 'free_tier',
    label: 'Gemini 3.1 Flash Lite (Free Tier High-Quota)',
    rpmLimit: 30,
    tpmLimit: 1000000,
    bestFor: 'High-Throughput Scraping, Summarization & Quota Preservation'
  },
  'gemini/gemini-3-flash-preview': {
    tier: 'free_tier',
    label: 'Gemini 3 Flash Preview (Free Tier)',
    rpmLimit: 15,
    tpmLimit: 1000000,
    bestFor: 'General Multi-Agent Orchestration & Fast Reasoning'
  },
  'gemini/gemini-2.5-flash': {
    tier: 'free_tier',
    label: 'Gemini 2.5 Flash (Free Tier Stable)',
    rpmLimit: 15,
    tpmLimit: 1000000,
    bestFor: 'Standard Sequential Tasks & Fallback Continuity'
  }
};

// Priority list for fallbacks
export const FALLBACK_PRIORITY: (keyof ProviderStatus)[] = [
  'gemini',
  'groq',
  'deepseek',
  'openai',
  'anthropic',
  'ollama_configured'
];

export const PROVIDER_DEFAULT_MODELS: Record<keyof ProviderStatus, string> = {
  gemini: 'gemini/gemini-3.8-flash',
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet',
  groq: 'groq/llama-3.3-70b',
  deepseek: 'deepseek/deepseek-chat',
  ollama_configured: 'ollama/llama3.2:3b',
  github_oauth: '',
  github_token: '',
  gmicloud: '',
  serper_search: '',
  firecrawl_scraping: '',
  tavily_search: '',
  opentelemetry: '',
  jules_agent: '',
  antigravity: ''
};

/**
 * Resolves the best available model based on provider status.
 * If the requested model's provider is offline, it finds the next best alternative.
 */
export const resolveAvailableModel = (requestedModel: string, providers: ProviderStatus): string => {
  const providerKey = MODEL_PROVIDER_MAP[requestedModel];
  
  // If provider is online, return requested model
  if (providerKey && providers[providerKey]) {
    return requestedModel;
  }

  // Find the first available provider from the priority list
  for (const fallbackKey of FALLBACK_PRIORITY) {
    if (providers[fallbackKey]) {
      return PROVIDER_DEFAULT_MODELS[fallbackKey];
    }
  }

  // Hard fallback to Gemini Flash as it's the primary provider for this app
  return 'gemini/gemini-3.8-flash';
};

/**
 * Smart Gemini Credit & Rate-Limit Governor:
 * Balances Free Tier models (gemini-3.8-flash, gemini-3.1-flash-lite, gemini-3-flash-preview)
 * and Paid Argon model (gemini-4-argon) across available key slots so execution never hits 429 limits.
 */
export const resolveSmartGeminiRoute = (params: {
  requestedModel: string;
  agentRole: string;
  isManager?: boolean;
  strategy: GeminiBudgetStrategy;
  quotaStatus: GeminiQuotaStatus | null;
  providers: ProviderStatus | null;
  estimatedTokens?: number;
}): SmartRouteDecision => {
  const {
    requestedModel,
    agentRole,
    isManager = false,
    strategy,
    quotaStatus,
    providers,
    estimatedTokens = 650
  } = params;

  const baseAvailable = providers ? resolveAvailableModel(requestedModel, providers) : requestedModel;
  const activeSlots = quotaStatus?.slots || [];
  const healthySlot = activeSlots.find(s => (s.rpmUsed / s.rpmLimit) < 0.85) || activeSlots[0];
  const slotLabel = healthySlot ? `${healthySlot.label} (${healthySlot.maskedKey})` : 'Primary Key Slot';
  const headroomPct = healthySlot
    ? Math.max(5, Math.round((1 - healthySlot.rpmUsed / Math.max(1, healthySlot.rpmLimit)) * 100))
    : 92;

  const isComplexRole =
    isManager ||
    /architect|audit|security|compliance|lead|principal|manager|director|quant/i.test(agentRole);

  const argonOverBudget = quotaStatus
    ? (quotaStatus.argonTokensUsedSession + estimatedTokens) > quotaStatus.argonBudgetCapTokens
    : false;

  const slotNearLimit = healthySlot ? (healthySlot.rpmUsed >= healthySlot.rpmLimit - 2) : false;

  // 1. Free-Tier Strict Guard: Never spend Paid Argon credits, rotate across Free Tier models & slots
  if (strategy === 'free_tier_guard') {
    if (baseAvailable === 'gemini/gemini-4-argon' || !baseAvailable.startsWith('gemini/')) {
      const targetFreeModel = slotNearLimit ? 'gemini/gemini-3.1-flash-lite' : 'gemini/gemini-3.8-flash';
      return {
        selectedModel: targetFreeModel,
        originalModel: requestedModel,
        tierUsed: 'free_tier',
        keySlotUsed: slotLabel,
        reason: `Free-Tier Guard active: Routed from ${requestedModel} to ${targetFreeModel} on ${slotLabel} ($0 cost, high RPM headroom).`,
        wasShifted: targetFreeModel !== requestedModel,
        estimatedTokens,
        headroomPct
      };
    }
    if (slotNearLimit) {
      return {
        selectedModel: 'gemini/gemini-3.1-flash-lite',
        originalModel: requestedModel,
        tierUsed: 'free_tier',
        keySlotUsed: slotLabel,
        reason: `Rate-limit prevention: Shifted to high-RPM gemini-3.1-flash-lite (30 RPM free quota) on ${slotLabel}.`,
        wasShifted: requestedModel !== 'gemini/gemini-3.1-flash-lite',
        estimatedTokens,
        headroomPct
      };
    }
    return {
      selectedModel: baseAvailable,
      originalModel: requestedModel,
      tierUsed: 'free_tier',
      keySlotUsed: slotLabel,
      reason: `Serving via Free Tier pool (${slotLabel}) with ${headroomPct}% RPM headroom.`,
      wasShifted: baseAvailable !== requestedModel,
      estimatedTokens,
      headroomPct
    };
  }

  // 2. Smart Hybrid (Free-First + Paid Argon for Complex Reasoning)
  if (strategy === 'hybrid_auto') {
    if (argonOverBudget) {
      return {
        selectedModel: 'gemini/gemini-3.8-flash',
        originalModel: requestedModel,
        tierUsed: 'free_tier',
        keySlotUsed: slotLabel,
        reason: `Argon session token cap reached: Gracefully shifted to Free-Tier gemini-3.8-flash on ${slotLabel} to continue job without interruption.`,
        wasShifted: true,
        estimatedTokens,
        headroomPct
      };
    }

    if (isComplexRole) {
      return {
        selectedModel: 'gemini/gemini-4-argon',
        originalModel: requestedModel,
        tierUsed: 'paid_argon',
        keySlotUsed: slotLabel,
        reason: `Smart Hybrid: Allocated Paid gemini-4-argon for high-complexity role (${agentRole}) via ${slotLabel}.`,
        wasShifted: requestedModel !== 'gemini/gemini-4-argon',
        estimatedTokens,
        headroomPct
      };
    }

    // Routine or tool-heavy role -> offload to Free Tier Flash/Lite to save Argon credits
    const freeModel = slotNearLimit ? 'gemini/gemini-3.1-flash-lite' : 'gemini/gemini-3.8-flash';
    return {
      selectedModel: freeModel,
      originalModel: requestedModel,
      tierUsed: 'free_tier',
      keySlotUsed: slotLabel,
      reason: `Smart Hybrid Credit Saver: Offloaded routine execution (${agentRole}) to Free-Tier ${freeModel} on ${slotLabel}, preserving Paid Argon credits.`,
      wasShifted: requestedModel !== freeModel,
      estimatedTokens,
      headroomPct
    };
  }

  // 3. Paid Argon Priority (gemini-4-argon with automatic Free-Tier burst overflow)
  if (strategy === 'argon_priority') {
    if (argonOverBudget || slotNearLimit) {
      return {
        selectedModel: 'gemini/gemini-3.8-flash',
        originalModel: requestedModel,
        tierUsed: 'free_tier',
        keySlotUsed: slotLabel,
        reason: `Zero-Halt Burst Failover: Argon threshold reached; seamlessly overflowed to Free-Tier gemini-3.8-flash on ${slotLabel} so job continues.`,
        wasShifted: true,
        estimatedTokens,
        headroomPct
      };
    }

    return {
      selectedModel: 'gemini/gemini-4-argon',
      originalModel: requestedModel,
      tierUsed: 'paid_argon',
      keySlotUsed: slotLabel,
      reason: `Argon Priority Mode: Executing on flagship gemini-4-argon via ${slotLabel} (${headroomPct}% quota headroom).`,
      wasShifted: requestedModel !== 'gemini/gemini-4-argon',
      estimatedTokens,
      headroomPct
    };
  }

  return {
    selectedModel: baseAvailable,
    originalModel: requestedModel,
    tierUsed: baseAvailable === 'gemini/gemini-4-argon' ? 'paid_argon' : 'free_tier',
    keySlotUsed: slotLabel,
    reason: `Standard routing on ${slotLabel}.`,
    wasShifted: baseAvailable !== requestedModel,
    estimatedTokens,
    headroomPct
  };
};
