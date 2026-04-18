import { Request, Response, NextFunction } from "express";
import { apiLogger } from "../utils/loggers";
import { captureError } from "../services/errorMonitoringService";

/**
 * Bot & Scanner Protection Middleware
 * 
 * Blocks requests matching known vulnerability scanner patterns (WordPress, phpMyAdmin,
 * CGI probes, etc.) and auto-blocks repeat offender IPs.
 * 
 * Returns 403 immediately without processing, saving server resources and reducing log noise.
 * 
 * Detected in Railway production logs:
 * - WordPress scanner from 169.150.203.202 probing wp-includes, xmlrpc.php, wlwmanifest.xml
 * - These return 404 but waste Express middleware pipeline cycles
 */

// ============================================
// Scanner Pattern Configuration
// ============================================

/** URL patterns that indicate vulnerability scanners / bots */
const SCANNER_PATH_PATTERNS: RegExp[] = [
  // WordPress / WP scanner patterns
  /\/wp-(?:admin|login|includes|content|json)/i,
  /\/wp-[a-z]+\.php/i,
  /\/xmlrpc\.php/i,
  /\/wlwmanifest\.xml/i,
  /\/wp-cron\.php/i,

  // PHP catch-all: This is a Node.js app — NO legitimate .php endpoints exist.
  // Blocks random .php probes (cilus.php, Geforce.php, fetch.php, *default.php, etc.)
  // that bypass the specific WordPress patterns above.
  /\.php(\?|$)/i,

  // PHP/CMS probes (kept for UA-based detection / logging clarity)
  /\/phpmyadmin/i,
  /\/pma\//i,
  /\/administrator/i,
  /\/cgi-bin\//i,
  /\/\.env/,
  /\/\.git/,
  /\/\.htaccess/,
  /\/\.htpasswd/,

  // Common CMS paths
  /\/joomla/i,
  /\/drupal/i,
  /\/magento/i,
  /\/typo3/i,

  // Webshell / backdoor probes
  /\/shell\.(php|asp|jsp)/i,
  /\/c99\.php/i,
  /\/r57\.php/i,

  // Path traversal attempts
  /\.\.\//,
  /\/etc\/passwd/,
  /\/proc\/self/,

  // AI agent / MCP probes (automated API discovery)
  /^\/mcp$/i,
  /^\/sse$/i,
  /^\/.well-known\/mcp/i,
];

/** User-Agent patterns that indicate bots/scanners */
const SCANNER_UA_PATTERNS: RegExp[] = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /gobuster/i,
  /dirbuster/i,
  /wpscan/i,
  /nuclei/i,
  /httpx/i,
  /censys/i,
  /shodan/i,
];

// ============================================
// IP Tracking (in-memory, auto-expires)
// ============================================

interface IPRecord {
  hits: number;
  firstSeen: number;
  blocked: boolean;
}

/** Track scanner hits per IP: Map<ip, { hits, firstSeen, blocked }> */
const ipTracker = new Map<string, IPRecord>();

/** Number of scanner hits in WINDOW before auto-blocking */
const AUTO_BLOCK_THRESHOLD = 5;

/** Time window for counting hits (10 minutes) */
const TRACKING_WINDOW_MS = 10 * 60 * 1000;

/** How long an auto-blocked IP stays blocked (1 hour) */
const BLOCK_DURATION_MS = 60 * 60 * 1000;

/** Cleanup stale entries every 15 minutes */
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

// Periodic cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipTracker) {
    // Remove entries older than block duration (or tracking window if not blocked)
    const maxAge = record.blocked ? BLOCK_DURATION_MS : TRACKING_WINDOW_MS;
    if (now - record.firstSeen > maxAge) {
      ipTracker.delete(ip);
    }
  }
}, CLEANUP_INTERVAL_MS);

// ============================================
// Middleware
// ============================================

const botProtectionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  const path = req.originalUrl || req.url || "";
  const ua = (req.headers["user-agent"] || "") as string;

  // Skip for internal/health check paths (always allow)
  if (path === "/health" || path === "/api/health" || path.startsWith("/api/docs")) {
    return next();
  }

  // Skip for loopback/internal IPs (monitoring, health checks, etc.)
  if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost") {
    // Still check scanner patterns for loopback but DON'T auto-block
    const pathMatch = SCANNER_PATH_PATTERNS.some(pattern => pattern.test(path));
    if (pathMatch) {
      res.status(403).json({ success: false, message: "Forbidden", statusCode: 403 });
      return;
    }
    return next();
  }

  // Check 1: Is this IP already auto-blocked?
  const ipRecord = ipTracker.get(ip);
  if (ipRecord?.blocked) {
    // Check if block has expired
    if (Date.now() - ipRecord.firstSeen > BLOCK_DURATION_MS) {
      ipTracker.delete(ip); // Unblock
    } else {
      // Still blocked — silent 403 (don't even log to reduce noise)
      res.status(403).end();
      return;
    }
  }

  // Check 2: Does the URL match known scanner patterns?
  const pathMatch = SCANNER_PATH_PATTERNS.some(pattern => pattern.test(path));

  // Check 3: Does the User-Agent match known scanner tools?
  const uaMatch = SCANNER_UA_PATTERNS.some(pattern => pattern.test(ua));

  if (pathMatch || uaMatch) {
    // Record hit for IP tracking
    recordScannerHit(ip, path, ua);

    // Log once per IP (first hit or when auto-blocked)
    const record = ipTracker.get(ip)!;
    if (record.hits === 1 || record.hits === AUTO_BLOCK_THRESHOLD) {
      const action = record.blocked ? "🚫 AUTO-BLOCKED" : "⚠️ SCANNER DETECTED";
      apiLogger.warn(
        `${action}: ${req.method} ${path} [${ip}] UA: ${ua.substring(0, 80)} (hits: ${record.hits})`
      );
    }

    // Track in error monitoring (low severity)
    if (record.hits <= 2) {
      captureError(new Error(`Scanner probe: ${path}`), "api", {
        severity: "low",
        requestContext: `${req.method} ${path}`,
        extraContext: `IP: ${ip} | UA: ${ua.substring(0, 80)} | Hits: ${record.hits}`,
      });
    }

    res.status(403).json({
      success: false,
      message: "Forbidden",
      statusCode: 403,
    });
    return;
  }

  next();
};

/**
 * Record a scanner hit for an IP and auto-block if threshold exceeded.
 */
function recordScannerHit(ip: string, path: string, ua: string): void {
  const now = Date.now();
  const existing = ipTracker.get(ip);

  if (existing) {
    // Reset if outside tracking window
    if (now - existing.firstSeen > TRACKING_WINDOW_MS && !existing.blocked) {
      ipTracker.set(ip, { hits: 1, firstSeen: now, blocked: false });
    } else {
      existing.hits++;
      // Auto-block after threshold
      if (existing.hits >= AUTO_BLOCK_THRESHOLD && !existing.blocked) {
        existing.blocked = true;
        existing.firstSeen = now; // Reset timer for block duration
        apiLogger.warn(
          `🚫 IP auto-blocked for 1h: ${ip} (${existing.hits} scanner hits in ${TRACKING_WINDOW_MS / 60000}min)`
        );
      }
    }
  } else {
    ipTracker.set(ip, { hits: 1, firstSeen: now, blocked: false });
  }
}

/**
 * Get current bot protection stats (for admin/diagnostics).
 */
export const getBotProtectionStats = () => {
  let tracked = 0;
  let blocked = 0;
  const blockedIPs: string[] = [];

  for (const [ip, record] of ipTracker) {
    tracked++;
    if (record.blocked) {
      blocked++;
      blockedIPs.push(ip);
    }
  }

  return { tracked, blocked, blockedIPs };
};

export default botProtectionMiddleware;
