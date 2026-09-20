/**
 * SetMyFit Extreme Client-Side Logger
 * Provides vivid, color-coded, structured browser console logging across all subsystems.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

interface SubsystemConfig {
  tag: string;
  badgeBg: string;
  badgeColor: string;
  textColor: string;
}

const SUBSYSTEMS: Record<string, SubsystemConfig> = {
  Auth: {
    tag: 'SetMyFit:Auth',
    badgeBg: '#7c3aed',
    badgeColor: '#ffffff',
    textColor: '#a78bfa',
  },
  Wardrobe: {
    tag: 'SetMyFit:Wardrobe',
    badgeBg: '#0284c7',
    badgeColor: '#ffffff',
    textColor: '#38bdf8',
  },
  Image: {
    tag: 'SetMyFit:Image',
    badgeBg: '#d97706',
    badgeColor: '#ffffff',
    textColor: '#fbbf24',
  },
  VisionAI: {
    tag: 'SetMyFit:VisionAI',
    badgeBg: '#db2777',
    badgeColor: '#ffffff',
    textColor: '#f472b6',
  },
  Stylist: {
    tag: 'SetMyFit:Stylist',
    badgeBg: '#059669',
    badgeColor: '#ffffff',
    textColor: '#34d399',
  },
  Weather: {
    tag: 'SetMyFit:Weather',
    badgeBg: '#2563eb',
    badgeColor: '#ffffff',
    textColor: '#60a5fa',
  },
  Profile: {
    tag: 'SetMyFit:Profile',
    badgeBg: '#ea580c',
    badgeColor: '#ffffff',
    textColor: '#fb923c',
  },
  Network: {
    tag: 'SetMyFit:Network',
    badgeBg: '#475569',
    badgeColor: '#ffffff',
    textColor: '#94a3b8',
  },
  Feedback: {
    tag: 'SetMyFit:Feedback',
    badgeBg: '#9333ea',
    badgeColor: '#ffffff',
    textColor: '#c084fc',
  },
  Stats: {
    tag: 'SetMyFit:Stats',
    badgeBg: '#0d9488',
    badgeColor: '#ffffff',
    textColor: '#2dd4bf',
  },
};

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().split('T')[1].replace('Z', '');
}

function printLog(
  subsystemKey: keyof typeof SUBSYSTEMS,
  level: LogLevel,
  action: string,
  details?: unknown,
  extra?: unknown
) {
  if (typeof window === 'undefined') return;

  const sub = SUBSYSTEMS[subsystemKey] || {
    tag: `SetMyFit:${String(subsystemKey)}`,
    badgeBg: '#333333',
    badgeColor: '#ffffff',
    textColor: '#ffffff',
  };

  const time = formatTimestamp();
  const badgeStyle = `background: ${sub.badgeBg}; color: ${sub.badgeColor}; font-weight: bold; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 11px;`;
  const timeStyle = 'color: #888888; font-size: 10px; font-family: monospace;';
  const actionStyle = `color: ${sub.textColor}; font-weight: bold; font-family: monospace; font-size: 11px;`;

  const prefix = `%c[${sub.tag}]%c [${time}] %c${action}`;

  if (level === 'error') {
    console.groupCollapsed(prefix, badgeStyle, timeStyle, actionStyle);
    if (details !== undefined) console.error('Details / Stack:', details);
    if (extra !== undefined) console.error('Context:', extra);
    console.trace('Call Stack');
    console.groupEnd();
  } else if (level === 'warn') {
    console.groupCollapsed(prefix, badgeStyle, timeStyle, actionStyle);
    if (details !== undefined) console.warn('Warning:', details);
    if (extra !== undefined) console.warn('Context:', extra);
    console.groupEnd();
  } else if (details !== undefined || extra !== undefined) {
    console.groupCollapsed(prefix, badgeStyle, timeStyle, actionStyle);
    if (details !== undefined) {
      if (typeof details === 'object' && details !== null) {
        console.dir(details);
      } else {
        console.log('Payload:', details);
      }
    }
    if (extra !== undefined) {
      console.log('Additional Context:', extra);
    }
    console.groupEnd();
  } else {
    console.log(prefix, badgeStyle, timeStyle, actionStyle);
  }
}

// ---------------------------------------------------------------------------
// Typed Subsystem Loggers
// ---------------------------------------------------------------------------

export const clientLogger = {
  auth: {
    info: (action: string, data?: unknown) => printLog('Auth', 'info', action, data),
    success: (action: string, data?: unknown) => printLog('Auth', 'success', `✓ ${action}`, data),
    warn: (action: string, data?: unknown) => printLog('Auth', 'warn', action, data),
    error: (action: string, err?: unknown) => printLog('Auth', 'error', action, err),
  },
  wardrobe: {
    info: (action: string, data?: unknown) => printLog('Wardrobe', 'info', action, data),
    success: (action: string, data?: unknown) => printLog('Wardrobe', 'success', `✓ ${action}`, data),
    warn: (action: string, data?: unknown) => printLog('Wardrobe', 'warn', action, data),
    error: (action: string, err?: unknown) => printLog('Wardrobe', 'error', action, err),
  },
  image: {
    info: (action: string, data?: unknown) => printLog('Image', 'info', action, data),
    success: (action: string, data?: unknown) => printLog('Image', 'success', `✓ ${action}`, data),
    warn: (action: string, data?: unknown) => printLog('Image', 'warn', action, data),
    error: (action: string, err?: unknown) => printLog('Image', 'error', action, err),
  },
  visionAI: {
    info: (action: string, data?: unknown) => printLog('VisionAI', 'info', action, data),
    success: (action: string, data?: unknown) => printLog('VisionAI', 'success', `✓ ${action}`, data),
    warn: (action: string, data?: unknown) => printLog('VisionAI', 'warn', action, data),
    error: (action: string, err?: unknown) => printLog('VisionAI', 'error', action, err),
  },
  stylist: {
    info: (action: string, data?: unknown) => printLog('Stylist', 'info', action, data),
    success: (action: string, data?: unknown) => printLog('Stylist', 'success', `✓ ${action}`, data),
    warn: (action: string, data?: unknown) => printLog('Stylist', 'warn', action, data),
    error: (action: string, err?: unknown) => printLog('Stylist', 'error', action, err),
  },
  weather: {
    info: (action: string, data?: unknown) => printLog('Weather', 'info', action, data),
    success: (action: string, data?: unknown) => printLog('Weather', 'success', `✓ ${action}`, data),
    warn: (action: string, data?: unknown) => printLog('Weather', 'warn', action, data),
    error: (action: string, err?: unknown) => printLog('Weather', 'error', action, err),
  },
  profile: {
    info: (action: string, data?: unknown) => printLog('Profile', 'info', action, data),
    success: (action: string, data?: unknown) => printLog('Profile', 'success', `✓ ${action}`, data),
    warn: (action: string, data?: unknown) => printLog('Profile', 'warn', action, data),
    error: (action: string, err?: unknown) => printLog('Profile', 'error', action, err),
  },
  network: {
    request: (method: string, url: string, body?: unknown) =>
      printLog('Network', 'info', `→ ${method} ${url}`, body),
    response: (method: string, url: string, status: number, data?: unknown, durationMs?: number) => {
      const dur = durationMs !== undefined ? ` [${Math.round(durationMs)}ms]` : '';
      const lvl: LogLevel = status >= 400 ? 'error' : 'info';
      printLog('Network', lvl, `← ${status} ${method} ${url}${dur}`, data);
    },
    error: (method: string, url: string, err: unknown) =>
      printLog('Network', 'error', `✕ ${method} ${url} FAILED`, err),
  },
  feedback: {
    info: (action: string, data?: unknown) => printLog('Feedback', 'info', action, data),
    success: (action: string, data?: unknown) => printLog('Feedback', 'success', `✓ ${action}`, data),
    warn: (action: string, data?: unknown) => printLog('Feedback', 'warn', action, data),
    error: (action: string, err?: unknown) => printLog('Feedback', 'error', action, err),
  },
  stats: {
    info: (action: string, data?: unknown) => printLog('Stats', 'info', action, data),
    success: (action: string, data?: unknown) => printLog('Stats', 'success', `✓ ${action}`, data),
    warn: (action: string, data?: unknown) => printLog('Stats', 'warn', action, data),
    error: (action: string, err?: unknown) => printLog('Stats', 'error', action, err),
  },
};
