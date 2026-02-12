/**
 * Redis Key Namespace Manager
 * Provides consistent key naming and prevents collisions
 * Enforces TTL policies and provides documentation
 */

const APP_PREFIX = 'dynopay';
const VERSION = 'v1';

/**
 * Redis key namespaces with TTL policies
 */
export const KeyNamespaces = {
  // Payment data keys
  CRYPTO_PAYMENT: {
    prefix: `${APP_PREFIX}:${VERSION}:crypto`,
    ttl: 86400,  // 24 hours
    description: 'Crypto payment data by address'
  },
  
  CUSTOMER_SESSION: {
    prefix: `${APP_PREFIX}:${VERSION}:customer`,
    ttl: 86400,  // 24 hours
    description: 'Customer payment session data'
  },
  
  PAYMENT_STATUS: {
    prefix: `${APP_PREFIX}:${VERSION}:payment`,
    ttl: 86400,  // 24 hours
    description: 'Payment status tracking'
  },
  
  // Address management
  ACTIVE_ADDRESS: {
    prefix: `${APP_PREFIX}:${VERSION}:address:active`,
    ttl: 1800,  // 30 minutes
    description: 'Active crypto address reservation'
  },
  
  // Rate limiting
  RATE_LIMIT: {
    prefix: `${APP_PREFIX}:${VERSION}:ratelimit`,
    ttl: 3600,  // 1 hour
    description: 'Rate limiting counters'
  },
  
  // Caching
  FEE_CACHE: {
    prefix: `${APP_PREFIX}:${VERSION}:cache:fee`,
    ttl: 60,  // 1 minute
    description: 'Blockchain fee estimation cache'
  },
  
  RATE_CACHE: {
    prefix: `${APP_PREFIX}:${VERSION}:cache:rate`,
    ttl: 120,  // 2 minutes
    description: 'Exchange rate cache'
  },
  
  // Locking
  CRON_LOCK: {
    prefix: `${APP_PREFIX}:${VERSION}:lock:cron`,
    ttl: 3600,  // 1 hour
    description: 'Cron job distributed locks'
  },
  
  // Webhooks
  WEBHOOK_RETRY: {
    prefix: `${APP_PREFIX}:${VERSION}:webhook:retry`,
    ttl: 86400,  // 24 hours
    description: 'Failed webhook retry queue'
  },
  
  WEBHOOK_DLQ: {
    prefix: `${APP_PREFIX}:${VERSION}:webhook:dlq`,
    ttl: 604800,  // 7 days
    description: 'Webhook dead letter queue'
  },
  
  WEBHOOK_DEDUP: {
    prefix: `${APP_PREFIX}:${VERSION}:webhook:dedup`,
    ttl: 3600,  // 1 hour
    description: 'Webhook deduplication'
  },
  
  // Email deduplication
  EMAIL_DEDUP: {
    prefix: `${APP_PREFIX}:${VERSION}:email:dedup`,
    ttl: 3600,  // 1 hour
    description: 'Email notification deduplication'
  },
  
  // Session management
  USER_SESSION: {
    prefix: `${APP_PREFIX}:${VERSION}:session:user`,
    ttl: 86400,  // 24 hours
    description: 'User authentication session'
  },
  
  // Wallet cache
  WALLET_CACHE: {
    prefix: `${APP_PREFIX}:${VERSION}:cache:wallet`,
    ttl: 300,  // 5 minutes
    description: 'User wallet data cache'
  }
};

/**
 * Build a namespaced Redis key
 * 
 * @param namespace - Key namespace
 * @param identifier - Unique identifier
 * @param subKey - Optional sub-key
 * @returns Formatted Redis key
 */
export function buildKey(
  namespace: keyof typeof KeyNamespaces,
  identifier: string,
  subKey?: string
): string {
  const ns = KeyNamespaces[namespace];
  const parts = [ns.prefix, identifier];
  
  if (subKey) {
    parts.push(subKey);
  }
  
  return parts.join(':');
}

/**
 * Get TTL for a namespace
 * 
 * @param namespace - Key namespace
 * @returns TTL in seconds
 */
export function getTTL(namespace: keyof typeof KeyNamespaces): number {
  return KeyNamespaces[namespace].ttl;
}

/**
 * Parse a namespaced key back to its components
 * 
 * @param key - Full Redis key
 * @returns Parsed components or null if invalid
 */
export function parseKey(key: string): {
  app: string;
  version: string;
  namespace: string;
  identifier: string;
  subKey?: string;
} | null {
  const parts = key.split(':');
  
  if (parts.length < 4 || parts[0] !== APP_PREFIX || parts[1] !== VERSION) {
    return null;
  }
  
  return {
    app: parts[0],
    version: parts[1],
    namespace: parts.slice(2, parts.length - 1).join(':'),
    identifier: parts[parts.length - 1],
    subKey: parts.length > 4 ? parts[parts.length - 1] : undefined
  };
}

/**
 * Validate key format
 * 
 * @param key - Key to validate
 * @returns True if key follows namespace convention
 */
export function isValidKey(key: string): boolean {
  return parseKey(key) !== null;
}

/**
 * Get all keys matching a namespace pattern
 * WARNING: Use sparingly in production, SCAN is expensive
 * 
 * @param namespace - Key namespace
 * @returns Pattern for Redis SCAN
 */
export function getNamespacePattern(namespace: keyof typeof KeyNamespaces): string {
  return `${KeyNamespaces[namespace].prefix}:*`;
}

/**
 * Generate documentation for all key namespaces
 * Useful for onboarding and debugging
 */
export function generateKeyDocumentation(): string {
  let doc = '# DynoPay Redis Key Namespaces\n\n';
  doc += `Application: ${APP_PREFIX}\n`;
  doc += `Version: ${VERSION}\n\n`;
  doc += '## Key Patterns\n\n';
  
  for (const [name, config] of Object.entries(KeyNamespaces)) {
    doc += `### ${name}\n`;
    doc += `- **Pattern**: \`${config.prefix}:{identifier}\`\n`;
    doc += `- **TTL**: ${config.ttl} seconds (${formatTTL(config.ttl)})\n`;
    doc += `- **Description**: ${config.description}\n\n`;
  }
  
  doc += '## Examples\n\n';
  doc += '```typescript\n';
  doc += '// Crypto payment key\n';
  doc += `buildKey('CRYPTO_PAYMENT', '0xabc123')  // ${buildKey('CRYPTO_PAYMENT', '0xabc123')}\n\n`;
  doc += '// Rate limit key\n';
  doc += `buildKey('RATE_LIMIT', 'api:key123')  // ${buildKey('RATE_LIMIT', 'api:key123')}\n\n`;
  doc += '// Cron lock key\n';
  doc += `buildKey('CRON_LOCK', 'checkMissedPayments')  // ${buildKey('CRON_LOCK', 'checkMissedPayments')}\n`;
  doc += '```\n';
  
  return doc;
}

/**
 * Format TTL in human-readable format
 */
function formatTTL(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Migration helper: Convert old keys to new namespaced format
 * 
 * @param oldKey - Old key format
 * @returns New namespaced key or null if cannot convert
 */
export function migrateKey(oldKey: string): string | null {
  // crypto-{address} → dynopay:v1:crypto:{address}
  if (oldKey.startsWith('crypto-')) {
    const address = oldKey.replace('crypto-', '');
    return buildKey('CRYPTO_PAYMENT', address);
  }
  
  // customer-{ref} → dynopay:v1:customer:{ref}
  if (oldKey.startsWith('customer-')) {
    const ref = oldKey.replace('customer-', '');
    return buildKey('CUSTOMER_SESSION', ref);
  }
  
  // payment-{id} → dynopay:v1:payment:{id}
  if (oldKey.startsWith('payment-')) {
    const id = oldKey.replace('payment-', '');
    return buildKey('PAYMENT_STATUS', id);
  }
  
  // ratelimit:{id} → dynopay:v1:ratelimit:{id}
  if (oldKey.startsWith('ratelimit:')) {
    const id = oldKey.replace('ratelimit:', '');
    return buildKey('RATE_LIMIT', id);
  }
  
  // fee-cache:{currency} → dynopay:v1:cache:fee:{currency}
  if (oldKey.startsWith('fee-cache:')) {
    const currency = oldKey.replace('fee-cache:', '');
    return buildKey('FEE_CACHE', currency);
  }
  
  return null;
}

export default {
  KeyNamespaces,
  buildKey,
  getTTL,
  parseKey,
  isValidKey,
  getNamespacePattern,
  generateKeyDocumentation,
  migrateKey
};
