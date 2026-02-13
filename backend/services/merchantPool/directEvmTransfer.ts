/**
 * Direct EVM Transaction Builder
 *
 * Bypasses Tatum SDK for sweep transactions to eliminate "ghost TX" issues.
 * Uses ethers.js to build, sign, and broadcast transactions directly via JSON-RPC.
 *
 * Key advantages over Tatum SDK:
 * - TX hash is computed locally from signed bytes (deterministic, cannot be a ghost)
 * - Direct JSON-RPC broadcast (eth_sendRawTransaction)
 * - Multiple RPC endpoint fallback for redundancy
 * - Explicit nonce management prevents stuck transactions
 */

import { ethers } from "ethers";
import { TOKEN_CONTRACTS } from "./merchantPoolConfig";

const LOG_PREFIX = "[DirectEvmSweep]";

// ─── Chain Configuration ───────────────────────────────────────────────────────

interface ChainConfig {
  chain: "ETH" | "POLYGON";
  isToken: boolean;
  contractAddress?: string;
  decimals: number;
  defaultGasLimit: number;
  maxGasPriceGwei: number;
}

const CHAIN_CONFIG: Record<string, ChainConfig> = {
  ETH: {
    chain: "ETH",
    isToken: false,
    decimals: 18,
    defaultGasLimit: 21000,
    maxGasPriceGwei: 50,
  },
  "USDT-ERC20": {
    chain: "ETH",
    isToken: true,
    contractAddress: TOKEN_CONTRACTS["USDT-ERC20"],
    decimals: 6,
    defaultGasLimit: 65000,
    maxGasPriceGwei: 50,
  },
  "USDC-ERC20": {
    chain: "ETH",
    isToken: true,
    contractAddress: TOKEN_CONTRACTS["USDC-ERC20"],
    decimals: 6,
    defaultGasLimit: 65000,
    maxGasPriceGwei: 50,
  },
  "RLUSD-ERC20": {
    chain: "ETH",
    isToken: true,
    contractAddress: TOKEN_CONTRACTS["RLUSD-ERC20"],
    decimals: 6,
    defaultGasLimit: 65000,
    maxGasPriceGwei: 50,
  },
  POLYGON: {
    chain: "POLYGON",
    isToken: false,
    decimals: 18,
    defaultGasLimit: 21000,
    maxGasPriceGwei: 500,
  },
  "USDT-POLYGON": {
    chain: "POLYGON",
    isToken: true,
    contractAddress: TOKEN_CONTRACTS["USDT-POLYGON"],
    decimals: 6,
    defaultGasLimit: 65000,
    maxGasPriceGwei: 500,
  },
};

// ERC20 transfer ABI for encoding calldata
const ERC20_IFACE = new ethers.Interface([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

// ─── RPC Endpoints ─────────────────────────────────────────────────────────────

function getRpcUrls(chain: "ETH" | "POLYGON"): string[] {
  const tatumKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY || "";

  if (chain === "POLYGON") {
    const urls = [];
    urls.push("https://polygon-rpc.com");
    if (tatumKey) urls.push(`https://api.tatum.io/v3/polygon/web3/${tatumKey}`);
    return urls;
  }

  // Ethereum - Use public RPC first for better reliability
  const urls = [];
  urls.push("https://eth.llamarpc.com");
  urls.push("https://ethereum-rpc.publicnode.com");
  if (tatumKey) urls.push(`https://api.tatum.io/v3/ethereum/web3/${tatumKey}`);
  return urls;
}

// ─── Provider Factory ──────────────────────────────────────────────────────────

function createProvider(rpcUrl: string): ethers.JsonRpcProvider {
  // Tatum proxy needs API key in header too for some endpoints
  const tatumKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY || "";
  if (rpcUrl.includes("tatum.io") && tatumKey) {
    const fetchReq = new ethers.FetchRequest(rpcUrl);
    fetchReq.setHeader("x-api-key", tatumKey);
    fetchReq.timeout = 15000;
    return new ethers.JsonRpcProvider(fetchReq, undefined, {
      staticNetwork: true,
    });
  }
  return new ethers.JsonRpcProvider(rpcUrl, undefined, {
    staticNetwork: true,
  });
}

// ─── Non-retryable Error Detection ─────────────────────────────────────────────

const NON_RETRYABLE_PATTERNS = [
  "insufficient funds",
  "nonce too low",
  "replacement transaction underpriced",
  "invalid private key",
  "invalid address",
];

function isNonRetryable(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return NON_RETRYABLE_PATTERNS.some((p) => lower.includes(p));
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface DirectEvmSweepResult {
  txHash: string;
  nonce: number;
  gasPriceGwei: string;
}

/**
 * Check if a wallet type supports direct EVM transfer
 */
export function isDirectEvmSupported(walletType: string): boolean {
  return walletType in CHAIN_CONFIG;
}

/**
 * Build, sign, and broadcast a sweep transaction using ethers.js directly.
 *
 * The TX hash is computed locally from the signed bytes — if this function
 * returns successfully, the hash is real and the transaction has been accepted
 * by at least one node. No more ghost TXs.
 */
export async function directEvmSweep(params: {
  fromAddress: string;
  toAddress: string;
  privateKey: string;
  walletType: string;
  amount: number;
  gasPriceGwei?: number;
  gasLimit?: number;
}): Promise<DirectEvmSweepResult> {
  const config = CHAIN_CONFIG[params.walletType];
  if (!config) {
    throw new Error(`${LOG_PREFIX} Unsupported wallet type: ${params.walletType}`);
  }

  const rpcUrls = getRpcUrls(config.chain);
  let lastError: Error | null = null;

  for (const rpcUrl of rpcUrls) {
    const rpcLabel = rpcUrl.substring(0, 50) + (rpcUrl.length > 50 ? "..." : "");
    try {
      console.log(`${LOG_PREFIX} Attempting via ${rpcLabel}`);
      const provider = createProvider(rpcUrl);
      const wallet = new ethers.Wallet(params.privateKey, provider);

      // 1. Get nonce (use 'pending' to account for in-flight TXs)
      const nonce = await provider.getTransactionCount(params.fromAddress, "pending");
      console.log(`${LOG_PREFIX} Nonce: ${nonce}`);

      // 2. Determine gas price
      let gasPrice: bigint;
      if (params.gasPriceGwei && params.gasPriceGwei > 0) {
        gasPrice = ethers.parseUnits(
          Math.ceil(params.gasPriceGwei).toString(),
          "gwei"
        );
      } else {
        const feeData = await provider.getFeeData();
        gasPrice = feeData.gasPrice || ethers.parseUnits("2", "gwei");
      }

      // Cap gas price to prevent overpaying during spikes
      const maxGas = ethers.parseUnits(config.maxGasPriceGwei.toString(), "gwei");
      if (gasPrice > maxGas) {
        console.warn(
          `${LOG_PREFIX} Gas price ${ethers.formatUnits(gasPrice, "gwei")} Gwei exceeds cap ${config.maxGasPriceGwei}, capping`
        );
        gasPrice = maxGas;
      }

      const gasPriceStr = ethers.formatUnits(gasPrice, "gwei");
      console.log(`${LOG_PREFIX} Gas price: ${gasPriceStr} Gwei`);

      const gasLimit = params.gasLimit || config.defaultGasLimit;

      // 3. Build transaction
      let tx: ethers.TransactionRequest;

      if (config.isToken && config.contractAddress) {
        // ERC20 token transfer — encode transfer(to, amount) calldata
        const truncatedAmount =
          Math.floor(params.amount * 10 ** config.decimals) /
          10 ** config.decimals;
        const amountBN = ethers.parseUnits(
          truncatedAmount.toString(),
          config.decimals
        );
        const data = ERC20_IFACE.encodeFunctionData("transfer", [
          params.toAddress,
          amountBN,
        ]);

        tx = {
          to: config.contractAddress,
          data,
          value: 0n,
          gasPrice,
          gasLimit,
          nonce,
        };

        console.log(
          `${LOG_PREFIX} ERC20 sweep: ${truncatedAmount} tokens → ${params.toAddress} via ${config.contractAddress}`
        );
      } else {
        // Native transfer (ETH or POLYGON/POL)
        const truncatedAmount =
          Math.floor(params.amount * 1e8) / 1e8;
        const value = ethers.parseEther(truncatedAmount.toString());

        tx = {
          to: params.toAddress,
          value,
          gasPrice,
          gasLimit,
          nonce,
        };

        console.log(
          `${LOG_PREFIX} Native sweep: ${truncatedAmount} → ${params.toAddress}`
        );
      }

      // 4. Sign and broadcast
      const txResponse = await wallet.sendTransaction(tx);

      console.log(`${LOG_PREFIX} ✅ TX broadcast successfully: ${txResponse.hash}`);

      return {
        txHash: txResponse.hash,
        nonce,
        gasPriceGwei: gasPriceStr,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn(`${LOG_PREFIX} RPC ${rpcLabel} failed: ${errMsg}`);
      lastError = error instanceof Error ? error : new Error(errMsg);

      // Don't try other RPCs for non-retryable errors
      if (isNonRetryable(errMsg)) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error(`${LOG_PREFIX} All RPC endpoints failed`);
}
