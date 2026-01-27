# BTC Testnet Testing Guide (Standalone Method)

## ✅ Mainnet Restored - Production Ready

**Admin Wallet Status:**
- XPUB: `xpub6DbvoN43UVKgaSW5...` (MAINNET)
- Ready for production with `TATUM_TESTNET=false`

---

## 🧪 Testing BTC Testnet (Without Affecting Production)

### Method: Standalone Script (Bypasses Admin Wallet)

**Why this works:**
- Generates fresh testnet wallet via Tatum API directly
- Stores address in `tbl_user_temp_address` (separate from payment links)
- Does NOT use admin wallet xpub
- No conflict with mainnet configuration

### Step 1: Run Setup Script

```bash
cd /app
python3 setup_btc_testnet.py
```

**What it does:**
1. ✅ Generates NEW BTC testnet wallet (tpub)
2. ✅ Derives first testnet address (tb1q...)
3. ✅ Registers address in database
4. ✅ Creates Tatum webhook subscription
5. ✅ Configures Redis for payment tracking
6. ✅ Saves data to `/app/btc_testnet_data.json`

**Example Output:**
```
🪙 BTC TESTNET ADDRESS:
════════════════════════════════════════════════════════════════════════════════

   tb1qera4sdt2kr0t6n70uuedqspl24tnhqa3wxp45x

════════════════════════════════════════════════════════════════════════════════
```

### Step 2: Get Testnet BTC

Visit: https://coinfaucet.eu/en/btc-testnet/
- Enter the `tb1q...` address
- Complete captcha
- Receive 0.001-0.01 BTC instantly

### Step 3: Monitor Payment

```bash
cd /app
python3 monitor_btc_payment.py
```

Or watch logs:
```bash
tail -f /var/log/supervisor/backend.out.log | grep -E "webhook|BTC|tb1q"
```

---

## 📊 How Both Methods Coexist

### Production Payment Links (Uses Admin Wallet)
```
Customer → Payment Link → createCryptoPayment
  ↓
Uses admin wallet xpub (mainnet)
  ↓
Generates bc1q... (mainnet address)
```

### Testnet Testing (Standalone Script)
```
Developer → setup_btc_testnet.py → Tatum API directly
  ↓
Generates fresh tpub (testnet)
  ↓
Derives tb1q... (testnet address)
  ↓
Stores in tbl_user_temp_address
```

**No Conflict!** They use different code paths.

---

## 🔄 Switching Between Mainnet/Testnet for Payment Links

**For Mainnet Production:**
```bash
# .env
TATUM_TESTNET=false
TATUM_KEY=<mainnet key>
# Admin wallet has: xpub6Dbvo... ✅
```

**For Testnet Payment Links (if needed in future):**
Use Option 2 from `/app/MAINNET_RESTORATION_PLAN.md`:
- Add `network` column to `tbl_admin_wallet`
- Store both mainnet and testnet xpubs
- Code selects based on `TATUM_TESTNET` env var

---

## 📝 Key Files

| File | Purpose |
|------|---------|
| `/app/setup_btc_testnet.py` | Generate testnet address (standalone) |
| `/app/monitor_btc_payment.py` | Watch for incoming BTC |
| `/app/btc_testnet_data.json` | Stores generated address info |
| `/app/verify_btc_payment.py` | Check payment status |

---

## ⚡ Quick Test Now

Want to test right now? Run:

```bash
cd /app && python3 setup_btc_testnet.py
```

Then send testnet BTC to the generated address!

---

## ✅ Summary

**Production:** 
- ✅ Mainnet xpub restored
- ✅ Set `TATUM_TESTNET=false` before deployment
- ✅ Payment links generate mainnet addresses

**Testing:**
- ✅ Use `setup_btc_testnet.py` script
- ✅ Generates fresh testnet addresses
- ✅ No admin wallet changes needed
- ✅ No conflict with production config

**Both work independently!** 🎉
