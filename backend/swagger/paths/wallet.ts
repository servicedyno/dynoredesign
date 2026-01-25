export const walletPaths = {
  '/api/wallet/validateWalletAddress': {
    post: {
      tags: ['Wallet Management'],
      summary: '🔐 Add Wallet Address - Step 1: Validate & Send OTP',
      description: `**ADD WALLET ADDRESS (2-Step Secure Process)**

This is the secure way to add a cryptocurrency wallet address to your company account.

**Complete Flow:**
1. **Step 1 (This endpoint):** Validate address format & send OTP to your email
2. **Step 2:** Use \`/api/wallet/verifyOtp\` to verify OTP and complete addition

---

**What This Endpoint Does:**
- ✅ Validates cryptocurrency wallet address format
- ✅ Checks for duplicate addresses
- 📧 Sends 6-digit OTP to your registered email
- ⏱️ OTP expires in 5 minutes
- 💾 Temporarily stores address (pending verification)

**Security Features:**
- 🔐 Email verification required
- 🏢 Multi-tenant: Wallets scoped to specific company
- 🔒 Prevents unauthorized wallet additions
- ✅ Validates user has access to the company

**Supported Cryptocurrencies:**
- BTC (Bitcoin)
- ETH (Ethereum)
- TRX (Tron)
- LTC (Litecoin)
- DOGE (Dogecoin)

**After This Step:**
1. Check your email for the 6-digit OTP code
2. Call \`/api/wallet/verifyOtp\` (documented below)
3. Provide the same wallet details + OTP code
4. ✅ Wallet address will be added to your company account`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['wallet_address', 'currency', 'company_id'],
              properties: {
                wallet_address: { 
                  type: 'string', 
                  description: '✅ REQUIRED: Cryptocurrency wallet address to add',
                  example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' 
                },
                currency: { 
                  type: 'string', 
                  enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE'], 
                  description: '✅ REQUIRED: Cryptocurrency type',
                  example: 'BTC' 
                },
                company_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Company ID (multi-tenant - wallet belongs to this company)',
                  example: 1
                },
                wallet_name: {
                  type: 'string',
                  description: '📝 OPTIONAL: Friendly name for this wallet (e.g., "Company Trading Wallet", "Cold Storage")',
                  example: 'Main BTC Trading Wallet',
                  maxLength: 100
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: '✅ OTP sent successfully - Check your email for 6-digit code',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'OTP sent to your email. Please verify to complete wallet addition.' },
                  data: {
                    type: 'object',
                    properties: {
                      valid: { type: 'boolean', example: true },
                      wallet_address: { type: 'string' },
                      wallet_name: { type: 'string' },
                      company_id: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid wallet address format or duplicate address' },
        401: { description: 'Unauthorized - JWT token required' },
        403: { description: 'You don\'t have access to this company' }
      }
    }
  },
  '/api/wallet/verifyOtp': {
    post: {
      tags: ['Wallet Management'],
      summary: '🔐 Add Wallet Address - Step 2: Verify OTP & Complete',
      description: `**ADD WALLET ADDRESS (2-Step Secure Process)**

This completes the wallet address addition by verifying the OTP sent to your email.

**Previous Step Required:**
You must first call \`/api/wallet/validateWalletAddress\` to receive an OTP via email.

**What This Endpoint Does:**
- ✅ Verifies the 6-digit OTP from your email
- 💾 Permanently saves the wallet address to your company account
- 🔒 Completes the secure wallet addition process

**How to Use:**
1. ✅ **Already done:** Called \`/api/wallet/validateWalletAddress\`
2. 📧 **Check your email** for the 6-digit OTP code
3. 📝 **Fill in below:**
   - Same wallet_address from Step 1
   - Same currency from Step 1
   - Same company_id from Step 1
   - The OTP code from email
   - Same wallet_name (optional)
4. 🎯 Click "Execute"
5. ✅ **Done!** Wallet address is now saved to your company

**OTP Security:**
- ⏱️ Expires in 5 minutes
- 🔒 Single-use only
- 📧 Sent to registered email only
- 🔐 Required to complete wallet addition`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['otp', 'wallet_address', 'currency', 'company_id'],
              properties: {
                otp: {
                  type: 'string',
                  description: '✅ REQUIRED: 6-digit OTP code from your email',
                  example: '123456',
                  minLength: 6,
                  maxLength: 6,
                  pattern: '^[0-9]{6}$'
                },
                wallet_address: {
                  type: 'string',
                  description: '✅ REQUIRED: Same wallet address from Step 1',
                  example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
                },
                currency: {
                  type: 'string',
                  enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE'],
                  description: '✅ REQUIRED: Same currency from Step 1',
                  example: 'BTC'
                },
                company_id: {
                  type: 'integer',
                  description: '✅ REQUIRED: Same Company ID from Step 1',
                  example: 1
                },
                wallet_name: {
                  type: 'string',
                  description: '📝 OPTIONAL: Same friendly name from Step 1',
                  example: 'Main BTC Trading Wallet',
                  maxLength: 100
                },
                currency_type: {
                  type: 'string',
                  description: '📝 OPTIONAL: Currency subtype (e.g., native, ERC20, TRC20)',
                  example: 'native'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: '✅ OTP verified successfully - Wallet address added to your company!',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'OTP verified successfully!' },
                  data: {
                    type: 'object',
                    properties: {
                      verified: { type: 'boolean', example: true },
                      wallet_name: { type: 'string' },
                      company_id: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { 
          description: 'Invalid OTP, expired OTP, or missing required fields',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  message: { 
                    type: 'string',
                    enum: [
                      'OTP is required!',
                      'Company ID is required!',
                      'Please enter a valid OTP!',
                      'OTP has expired! Please request a new one.'
                    ]
                  }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized - JWT token required' },
        403: { description: 'You don\'t have access to this company' }
      }
    }
  },
  '/api/wallet/deleteWalletAddress': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Delete saved wallet address',
      description: `Remove a previously saved wallet address from your account.
      
**Note:** This only removes the address from your saved list. It does not affect the actual blockchain wallet.`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['address_id'],
              properties: {
                address_id: { 
                  type: 'string',
                  description: '✅ REQUIRED: ID of the saved wallet address to delete',
                  example: '550e8400-e29b-41d4-a716-446655440000'
                }
              }
            }
          }
        }
      },
      responses: {
        200: { 
          description: 'Address deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  message: { type: 'string' }
                },
                example: {
                  success: true,
                  message: 'Wallet address deleted successfully'
                }
              }
            }
          }
        },
        400: { description: 'Invalid address_id' },
        401: { description: 'Unauthorized' },
        404: { description: 'Address not found' }
      }
    }
  },
  '/api/wallet/getWalletTransactions/{id}': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Get wallet transactions',
      description: 'Retrieve transactions for a specific wallet',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string' },
        description: 'Wallet ID'
      }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                page: { type: 'number', default: 1 },
                limit: { type: 'number', default: 20 }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Transactions retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  transactions: { type: 'array', items: { type: 'object' } },
                  total: { type: 'number' },
                  page: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/addFunds': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Add funds to wallet',
      description: 'Initiate wallet top-up',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency', 'payment_method'],
              properties: {
                amount: { type: 'number', example: 100 },
                currency: { type: 'string', example: 'USD' },
                payment_method: { type: 'string', enum: ['CARD', 'BANK', 'CRYPTO'] }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Top-up initiated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  transaction_id: { type: 'string' },
                  status: { type: 'string' },
                  payment_url: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/withdrawAssets': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Withdraw funds',
      description: 'Withdraw funds from wallet',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency', 'destination'],
              properties: {
                amount: { type: 'number', example: 50 },
                currency: { type: 'string', example: 'BTC' },
                destination: { type: 'string', description: 'Wallet address or bank account' },
                otp: { type: 'string', description: 'OTP for verification' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Withdrawal initiated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  withdrawal_id: { type: 'string' },
                  status: { type: 'string', enum: ['pending', 'processing', 'completed'] }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/sendConfirmationOTP': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Send withdrawal OTP',
      description: 'Send OTP for withdrawal confirmation',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'OTP sent successfully' }
      }
    }
  },
  '/api/wallet/exchangeCreate': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Create currency exchange',
      description: 'Exchange one currency for another',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['from_currency', 'to_currency', 'amount'],
              properties: {
                from_currency: { type: 'string', example: 'USD' },
                to_currency: { type: 'string', example: 'BTC' },
                amount: { type: 'number', example: 100 }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Exchange created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  exchange_id: { type: 'string' },
                  rate: { type: 'number' },
                  from_amount: { type: 'number' },
                  to_amount: { type: 'number' },
                  expires_at: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/confirmExchange': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Confirm currency exchange',
      description: 'Confirm and execute currency exchange',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['exchange_id'],
              properties: {
                exchange_id: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Exchange confirmed' }
      }
    }
  },
  '/api/wallet/getExchange': {
    get: {
      tags: ['Wallet Management'],
      summary: 'Get exchange history',
      description: 'Retrieve currency exchange history',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Exchange history retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  exchanges: { type: 'array', items: { type: 'object' } }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/getCurrencyRates': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Get exchange rates',
      description: 'Get currency exchange rates',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                base: { type: 'string', example: 'USD' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Rates retrieved' }
      }
    }
  },
  '/api/wallet/estimateFees': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Estimate transaction fees',
      description: 'Estimate fees for a transaction',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency', 'type'],
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' },
                type: { type: 'string', enum: ['withdrawal', 'transfer', 'exchange'] }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Fees estimated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  network_fee: { type: 'number' },
                  platform_fee: { type: 'number' },
                  total_fee: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/network-fees': {
    get: {
      tags: ['Wallet Management'],
      summary: 'Get network fees',
      description: 'Get blockchain network fees',
      parameters: [{
        in: 'query',
        name: 'currency',
        schema: { type: 'string' },
        required: true
      }],
      responses: {
        200: { description: 'Network fees retrieved' }
      }
    }
  },
  '/api/wallet/calculate-payment': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Calculate payment',
      description: 'Calculate payment with fees',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Payment calculated' }
      }
    }
  },
  '/api/wallet/getUserAnalytics': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Get user analytics',
      description: 'Get wallet usage analytics',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Analytics retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  total_transactions: { type: 'number' },
                  total_volume: { type: 'number' },
                  balance: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/configured-currencies': {
    get: {
      tags: ['Wallet Management'],
      summary: 'Get available currencies',
      description: 'Get list of configured currencies',
      responses: {
        200: {
          description: 'Currencies retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fiat: { type: 'array', items: { type: 'string' } },
                  crypto: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/wallet/verifyCode': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Verify OTP code',
      description: 'Verify OTP for wallet operations',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code'],
              properties: {
                code: { type: 'string', example: '123456' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Code verified' },
        400: { description: 'Invalid code' }
      }
    }
  },
  '/api/wallet/authStep': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Authentication step',
      description: '3D Secure or OTP authentication',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                transaction_id: { type: 'string' },
                otp: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Authentication successful' }
      }
    }
  },
  '/api/wallet/verifyPayment': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Verify payment',
      description: 'Verify wallet payment status',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Payment verified' }
      }
    }
  },
  '/api/wallet/confirmPayment': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Confirm payment',
      description: 'Confirm wallet payment',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Payment confirmed' }
      }
    }
  },
  '/api/wallet/verifyCryptoPayment': {
    post: {
      tags: ['Wallet Management'],
      summary: 'Verify crypto payment',
      description: 'Verify cryptocurrency payment',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Crypto payment verified' }
      }
    }
  }
};
