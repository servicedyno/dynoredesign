# Why BTC Requires Different XPUBs for Testnet vs Mainnet

## The Fundamental Difference

### Ethereum (Network-Agnostic Addresses)
```
Same Private Key → Same Address → Works on ANY EVM chain
- 0x71c17274681f82e538d35fa0e826bd3090d64ded (Mainnet)
- 0x71c17274681f82e538d35fa0e826bd3090d64ded (Sepolia)
- 0x71c17274681f82e538d35fa0e826bd3090d64ded (Goerli)
- 0x71c17274681f82e538d35fa0e826bd3090d64ded (Polygon, BSC, etc.)

The SAME address works everywhere!
Network is determined by: RPC endpoint, Chain ID, where you broadcast
```

### Bitcoin (Network-Encoded Addresses)
```
Same Private Key → DIFFERENT addresses per network

Mainnet xpub (xpub6...) derives:
- bc1q... (mainnet Bech32)
- 1... (mainnet P2PKH)
- 3... (mainnet P2SH)

Testnet tpub (tpub...) derives:
- tb1q... (testnet Bech32)
- m/n... (testnet P2PKH)
- 2... (testnet P2SH)

Different addresses! Network is ENCODED in the address itself!
```

## Technical Explanation

### Bitcoin XPUB Structure (BIP32)
```
XPUB format: [version][depth][fingerprint][index][chain_code][key]
              ^^^^^^^^
              This determines network!

Mainnet: version = 0x0488B21E → encodes to "xpub"
Testnet: version = 0x043587CF → encodes to "tpub"
```

**The version bytes are PART OF the xpub encoding!**

When Tatum (or any Bitcoin library) derives an address:
1. Decodes the xpub
2. Reads the version bytes
3. Uses that to determine address format
4. Generates address with network-specific prefix

**You can't override this with an API key** - the network is baked into the xpub itself!

### Ethereum XPUB Structure (BIP44)
```
XPUB format: [version][depth][fingerprint][index][chain_code][key]
              ^^^^^^^^
              Not used for address generation!

All EVM chains: version = 0x0488B21E → "xpub"
```

**Ethereum doesn't encode network in addresses!**

When deriving an Ethereum address:
1. Derive public key from xpub
2. Keccak256 hash
3. Take last 20 bytes
4. Add "0x" prefix
5. **Result is network-agnostic!**

The address works on ANY EVM chain - network is only relevant when broadcasting transactions.

## Analogy

**Bitcoin Addresses = Postal Addresses**
- "123 Main St, New York, USA" (mainnet)
- "123 Main St, TestCity, TestCountry" (testnet)
- Different locations, different addresses
- The country/city is PART OF the address

**Ethereum Addresses = Phone Numbers**  
- Same phone number works in any country
- You just need to use the right network/carrier (RPC endpoint)
- The number itself doesn't encode location

## Why Tatum Can't Override This

Even with a testnet API key, Tatum's SDK does:

```javascript
// When you call generateAddress with BTC xpub:
function generateBTCAddress(xpub, index) {
  const decoded = decodeXPUB(xpub);
  const versionBytes = decoded.version;
  
  if (versionBytes === MAINNET_VERSION) {
    // Will ALWAYS generate mainnet address
    // API key can't change this!
    return deriveMainnetAddress(decoded, index);
  } else if (versionBytes === TESTNET_VERSION) {
    // Will ALWAYS generate testnet address
    return deriveTestnetAddress(decoded, index);
  }
}
```

**The version bytes in the xpub itself determine the output!**

## What Happens If You Try?

If you use mainnet xpub with testnet API key:

```
Input: xpub6Dbvo... (mainnet) + testnet API key
Tatum SDK: Decodes xpub → sees mainnet version bytes
Result: Generates bc1q... (mainnet address)
Problem: ❌ You send testnet BTC to mainnet address = LOST!

Error we got:
"xpub must be a valid testnet BTC xpub. Without special 
characters, it should be 111 characters long with valid checksum"
```

Tatum **correctly rejects** this to prevent you from losing funds!

## Summary

| Feature | Bitcoin | Ethereum |
|---------|---------|----------|
| Network in XPUB? | ✅ YES (version bytes) | ❌ NO |
| Network in Address? | ✅ YES (prefix) | ❌ NO |
| Same xpub both networks? | ❌ NO - need different xpubs | ✅ YES |
| API key determines network? | ❌ NO - xpub does | ✅ YES |
| Why? | Bitcoin protocol design | EVM design |

## Conclusion

**Bitcoin requires different xpubs because the network is cryptographically encoded in the xpub version bytes and derived addresses.**

This is **by design** in Bitcoin (BIP32 standard) to prevent accidentally sending mainnet funds to testnet addresses or vice versa. It's a safety feature!

Ethereum took a different approach - addresses are network-agnostic, making them more flexible but requiring careful network selection when broadcasting transactions.
