/**
 * Generates friendly, memorable random names for API keys and wallets
 * Uses combinations of adjectives and nouns to create readable identifiers
 */

const adjectives = [
  'Swift', 'Bright', 'Bold', 'Calm', 'Cool', 'Crisp', 'Daring', 'Elite',
  'Fast', 'Fresh', 'Grand', 'Happy', 'Keen', 'Lucky', 'Neat', 'Noble',
  'Prime', 'Quick', 'Royal', 'Sharp', 'Smart', 'Solid', 'Steady', 'Super',
  'Sunny', 'Turbo', 'Ultra', 'Vital', 'Wise', 'Zesty', 'Agile', 'Brave',
  'Cyber', 'Delta', 'Eagle', 'Flash', 'Gear', 'Hyper', 'Iron', 'Jade',
  'Lunar', 'Maple', 'Nexus', 'Orbit', 'Pixel', 'Quantum', 'Radar', 'Spark',
  'Terra', 'Vapor', 'Wave', 'Xeno', 'Zenith', 'Apex', 'Blaze', 'Comet'
];

const nouns = [
  'Key', 'Vault', 'Bridge', 'Gate', 'Link', 'Node', 'Core', 'Hub',
  'Port', 'Wave', 'Flow', 'Star', 'Beam', 'Pulse', 'Shield', 'Forge',
  'Crown', 'Blade', 'Storm', 'Flame', 'Frost', 'Stone', 'Wind', 'Tide',
  'Peak', 'Ridge', 'Glen', 'Vale', 'Creek', 'Brook', 'Hawk', 'Wolf',
  'Lion', 'Bear', 'Falcon', 'Phoenix', 'Dragon', 'Tiger', 'Panther', 'Raven',
  'Anchor', 'Atlas', 'Cipher', 'Echo', 'Flux', 'Helix', 'Ion', 'Jet',
  'Kite', 'Laser', 'Matrix', 'Nova', 'Orion', 'Prism', 'Quest', 'Ray'
];

/**
 * Generates a random friendly name
 * @param prefix Optional prefix to add (e.g., 'API', 'Wallet')
 * @param includeNumber Whether to append a random number for uniqueness
 * @returns A friendly random name like "Swift Key" or "API Bold Star 42"
 */
export const generateFriendlyName = (prefix?: string, includeNumber: boolean = true): string => {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  let name = `${adjective} ${noun}`;
  
  if (prefix) {
    name = `${prefix} ${name}`;
  }
  
  if (includeNumber) {
    const randomNum = Math.floor(Math.random() * 100);
    name = `${name} ${randomNum}`;
  }
  
  return name;
};

/**
 * Generates a friendly name specifically for API keys
 * @param environment 'production' or 'development'
 * @returns A name like "Live Swift Key 42" or "Test Bold Star 17"
 */
export const generateApiKeyName = (environment: string = 'production'): string => {
  const prefix = environment === 'production' ? 'Live' : 'Test';
  return generateFriendlyName(prefix, true);
};

/**
 * Generates a friendly name specifically for wallets
 * @param currency The cryptocurrency type (e.g., 'BTC', 'ETH')
 * @returns A name like "BTC Swift Vault 42"
 */
export const generateWalletName = (currency?: string): string => {
  return generateFriendlyName(currency, true);
};

export default generateFriendlyName;
