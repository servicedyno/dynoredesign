# Production Mainnet Issue - Admin Wallet XPub

## Current Problem

### What We Changed:
```
tbl_admin_wallet (BTC row):
BEFORE: xpub6Dbvo... (mainnet xpub)
AFTER:  tpubDEEce... (testnet xpub)  ← Currently in database
```

### What Happens If You Set TATUM_TESTNET=false:

```javascript
// Environment
TATUM_TESTNET=false           // Uses mainnet Tatum key
TATUM_TESTNET_KEY=<mainnet>   // Mainnet API key

// Code execution
adminWalletModel.findOne({ wallet_type: 'BTC' })
  → Retrieves: tpubDEEce... (testnet xpub from database)
  
tatumApi.generateUserAddress({
  xpub: 'tpubDEEce...',  // Testnet xpub
  // Using mainnet API key
})

RESULT: ❌ ERROR or generates tb1q... (testnet address on mainnet)
        → Customers send mainnet BTC to testnet address = LOST FUNDS!
```

## The Issue:

**Environment variable (TATUM_TESTNET) ≠ Database xpub**

- `.env` controls which Tatum API key to use
- Database (`tbl_admin_wallet`) stores the actual xpub
- They must match or you get wrong addresses!

| TATUM_TESTNET | Required XPUB | Current XPUB | Status |
|---------------|---------------|--------------|--------|
| `true` | `tpub...` | `tpubDEEce...` | ✅ Works |
| `false` | `xpub...` | `tpubDEEce...` | ❌ BROKEN |

## Solutions:

### Option 1: Restore Original Mainnet XPUB (Recommended for Production)

I can restore the original mainnet xpub that was in the database before.

**Pros:**
- Returns to production-ready state
- No code changes needed
- Safe for mainnet

**Cons:**
- Testnet won't work anymore (need to switch manually)

### Option 2: Store Both XPUBs in Database (Best Long-term Solution)

Add a new column to distinguish testnet vs mainnet xpubs:

```sql
ALTER TABLE tbl_admin_wallet ADD COLUMN network VARCHAR(10) DEFAULT 'mainnet';

-- Store both
INSERT: wallet_type='BTC', network='mainnet', xpub_mnemonic='<mainnet xpub>'
INSERT: wallet_type='BTC', network='testnet', xpub_mnemonic='<testnet xpub>'
```

Update code to select based on environment:

```javascript
const network = process.env.TATUM_TESTNET === 'true' ? 'testnet' : 'mainnet';

const walletDetails = await adminWalletModel.findOne({
  where: {
    wallet_type: currency,
    network: network  // Select correct xpub
  }
});
```

**Pros:**
- Switch between testnet/mainnet with just .env change
- No data loss
- Production-safe

**Cons:**
- Requires code changes
- Database schema update

### Option 3: Environment-Based XPub Encryption Keys

Store xpubs in separate KMS keys:

```
Google KMS:
- keys/mainnet-xpubs (stores mainnet xpubs)
- keys/testnet-xpubs (stores testnet xpubs)

Code selects KMS key based on TATUM_TESTNET
```

### Option 4: Keep Current Setup + Manual Switching

Before production:
1. Backup current testnet xpub
2. Restore mainnet xpub to database
3. Set TATUM_TESTNET=false

For testing:
1. Restore testnet xpub
2. Set TATUM_TESTNET=true

**Pros:**
- Simple
- No code changes

**Cons:**
- Manual process
- Risk of forgetting
- Can't easily switch back

## What's Saved (For Restoration):

I have the original mainnet xpub that was in the database:
```
xpub6DbvoN43UVKgaSW5gYsyAJjoE2sNDU4ZPM8FeQsXmobveV2DxDsxBYJu4rqRMb8BhpaDLauLY7KoeiBfdCWeHwXRczAuy3xiqrFCaT4HEMk
```

And the new testnet xpub we generated:
```
tpubDEEceAyTybPFtAXdcS1nSDVxWm1xsj2pQ2q9oZ53qCNCMSEtmHECmjxwvi8ogJRNazzzbib5nLe82ouwYAaKv6P1hfKj1RdJD8WMDQR2ZYo
```

## Recommendation:

**For immediate production readiness:**
→ **Option 1**: Restore mainnet xpub

**For proper long-term solution:**
→ **Option 2**: Implement network column + code logic

**Would you like me to:**
1. Restore the mainnet xpub now?
2. Implement Option 2 (dual xpub support)?
3. Keep testnet for now and manually switch later?
