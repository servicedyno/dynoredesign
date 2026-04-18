# Quick Command: Generate TATUM_WEBHOOK_SECRET

## 🔐 Generate Random Secret (Pick One Method)

### Method 1: Linux/Mac Terminal
```bash
openssl rand -hex 32
```

### Method 2: Online Generator
Go to: https://www.random.org/strings/
- Num: 1
- Len: 64
- Character set: Hex (0-9, a-f)
- Click "Get Strings"

### Method 3: Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Method 4: Python
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## 📋 Example Output:

```
a3f9d8e7c2b1a5f8e3d9c7b2a6f1e8d4c9b7a5f3e1d8c6b4a2f9e7d5c3b1a8f6
```

---

## ➕ Add to Railway:

```bash
# Railway Dashboard → Variables → Add:
TATUM_WEBHOOK_SECRET=a3f9d8e7c2b1a5f8e3d9c7b2a6f1e8d4c9b7a5f3e1d8c6b4a2f9e7d5c3b1a8f6
```

---

## ✅ That's It!

**Or just leave it empty - webhooks still work, this is just extra security.**

---

*Takes 30 seconds to generate and add!*
