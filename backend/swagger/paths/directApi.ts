export const directApiPaths = {
  '/api/user/createUser': {
    post: {
      tags: ['Direct API - Merchant Integration', 'Customer Management', 'Authentication'],
      summary: 'Create a customer for payment processing (Direct API)',
      description: `Create a customer record to initiate payments. Returns a customer token required for subsequent payment requests.

**🔍 KEYWORDS:** create customer, customer token, customer JWT, register customer, new customer, customer creation, API integration, programmatic payments

**🔐 Authentication:** Requires \`x-api-key\` header with your encrypted API key.

**📝 How to Get Your API Key:**
1. Login to DynoPay dashboard (\`POST /api/user/login\`)
2. Navigate to API Keys section
3. Create new API key (\`POST /api/userApi/addApi\`)
4. Copy the encrypted API key value
5. Use it in the \`x-api-key\` header

**🔄 Payment Flow:**
1. Create customer with this endpoint → Get customer \`token\`
2. Use customer \`token\` in \`Authorization: Bearer {token}\` header for \`/api/user/cryptoPayment\`
3. Customer can make multiple payments using same token (token doesn't expire)

**✨ Existing Customer Handling:**
- If email already exists for your company → Returns existing customer with new token
- No duplicate customers created

**💡 USE CASE:** Programmatic payment integration where you control the checkout experience`,
      security: [{ ApiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'email'],
              properties: {
                name: {
                  type: 'string',
                  description: '✅ REQUIRED: Customer full name',
                  example: 'John Doe'
                },
                email: {
                  type: 'string',
                  format: 'email',
                  description: '✅ REQUIRED: Customer email address',
                  example: 'customer@example.com'
                },
                mobile: {
                  type: 'string',
                  description: '📱 OPTIONAL: Customer phone number',
                  example: '+1234567890'
                }
              }
            },
            examples: {
              'Basic Customer (Minimal)': {
                summary: 'Create customer with email only',
                value: {
                  name: 'John Doe',
                  email: 'john@example.com'
                }
              },
              'Customer with Mobile': {
                summary: 'Create customer with phone number',
                value: {
                  name: 'Jane Smith',
                  email: 'jane@example.com',
                  mobile: '+1234567890'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Customer created or retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      token: { 
                        type: 'string', 
                        description: '🔑 Customer JWT token - use this in Authorization header for /api/user/cryptoPayment'
                      },
                      customer_id: { 
                        type: 'string', 
                        description: 'Unique customer UUID'
                      }
                    }
                  }
                }
              },
              examples: {
                'New Customer Created': {
                  summary: 'New customer successfully created',
                  value: {
                    success: true,
                    message: 'Registered Successful!',
                    data: {
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFiYzEyMyIsImN1c3RvbWVyX2lkIjo0NSwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwiY29tcGFueV9pZCI6MzgsImlhdCI6MTcwOTU3MTIwMH0.xyz',
                      customer_id: 'abc123-def456-ghi789'
                    }
                  }
                },
                'Existing Customer Retrieved': {
                  summary: 'Customer already exists, returned with new token',
                  value: {
                    success: true,
                    message: 'Customer already exists',
                    data: {
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFiYzEyMyIsImN1c3RvbWVyX2lkIjo0NSwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwiY29tcGFueV9pZCI6MzgsImlhdCI6MTcwOTU3MTIwMH0.xyz',
                      customer_id: 'abc123-def456-ghi789'
                    }
                  }
                }
              }
            }
          }
        },
        400: { 
          description: 'Bad Request - Missing required fields',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'Name and email are required',
                errors: [
                  { key: 'name', error: 'Name is Required' },
                  { key: 'email', error: 'Email is Required' }
                ]
              }
            }
          }
        },
        403: { 
          description: 'Forbidden - Invalid or missing API key',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'API key is required in x-api-key header'
              }
            }
          }
        },
        500: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'Internal server error'
              }
            }
          }
        }
      }
    }
  },

  '/api/user/cryptoPayment': {
    post: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Create a cryptocurrency payment',
      description: `Generate a crypto payment address for the customer. Returns a deposit address that the customer should send funds to.

**🔐 Authentication (2 Options):**

**Option 1: NEW Flow (Recommended)**
- Header \`x-api-key\`: Your encrypted merchant API key  
- Header \`Authorization\`: \`Bearer {customer_token}\` from \`/api/user/createUser\`

**Option 2: LEGACY Flow (Backward Compatibility)**
- Header \`x-api-key\`: Your encrypted merchant API key
- Header \`Authorization\`: Can be empty, invalid, or old wallet_token
- System automatically creates/finds a default customer for your company

**💰 Supported Cryptocurrencies:**
- \`BTC\` - Bitcoin
- \`ETH\` - Ethereum  
- \`LTC\` - Litecoin
- \`DOGE\` - Dogecoin
- \`TRX\` - Tron
- \`BCH\` - Bitcoin Cash
- \`USDT-TRC20\` - Tether (Tron Network)
- \`USDT-ERC20\` - Tether (Ethereum Network)
- \`USDC-ERC20\` - USD Coin (Ethereum Network)

**⚠️ Important:** You must have wallet addresses configured for the cryptocurrencies you want to accept. Check available currencies via \`GET /api/user/getSupportedCurrency\`.

**📡 Webhook Flow:**
1. Customer sends crypto to the returned address
2. DynoPay detects the deposit on blockchain (usually 1-3 confirmations)
3. Webhook sent to your \`webhook_url\` with payment status updates
4. Optional: Customer redirected to \`callback_url\` after payment

**🔗 URL Configuration Priority:**
1. Per-payment \`webhook_url\` (this request body)
2. API key's configured webhook URL (from dashboard)
3. Company's default webhook URL (from company settings)

**💸 Fee Payment Options:**
- \`company\` (default) - You pay fees, deducted from your portion
- \`customer\` - Customer pays extra to cover fees`,
      security: [{ ApiKeyAuth: [], BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'currency'],
              properties: {
                amount: {
                  type: 'number',
                  description: '✅ REQUIRED: Payment amount in your base currency (default: USD)',
                  example: 100,
                  minimum: 0.01
                },
                currency: {
                  type: 'string',
                  description: '✅ REQUIRED: Cryptocurrency the customer will pay with',
                  enum: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20'],
                  example: 'ETH'
                },
                redirect_uri: {
                  type: 'string',
                  format: 'uri',
                  description: `🔗 OPTIONAL: URL to redirect customer after payment completion. Also known as callback_url.
                  
**Use Case:** Redirect customer to your order confirmation page after they complete payment.
**Note:** Customer sees this URL and can click to return to your site.`,
                  example: 'https://yourapp.com/order/12345/success'
                },
                callback_url: {
                  type: 'string',
                  format: 'uri',
                  description: '🔗 OPTIONAL: Alternative name for redirect_uri (works identically)',
                  example: 'https://yourapp.com/order/12345/success'
                },
                webhook_url: {
                  type: 'string',
                  format: 'uri',
                  description: `📡 OPTIONAL: URL to receive server-to-server payment status webhooks (overrides API key config).

**Webhook Events Sent:**
- \`payment.pending\` - Deposit detected, awaiting confirmations
- \`payment.confirmed\` - Payment fully confirmed and processed
- \`payment.underpaid\` - Partial payment received (less than expected amount)

**Security:** Webhooks are sent via POST with JSON payload. Validate webhook authenticity using the payment details.`,
                  example: 'https://yourapp.com/webhooks/crypto-payment'
                },
                fee_payer: {
                  type: 'string',
                  enum: ['customer', 'company'],
                  description: `💰 OPTIONAL: Who pays the processing fees.

**Options:**
- \`company\` (default) - Fees deducted from merchant's received amount
- \`customer\` - Customer pays additional amount to cover all fees

**Example (100 USD payment):**
- \`company\` mode: Customer sends ~0.042 ETH, you receive ~0.040 ETH (fees deducted)
- \`customer\` mode: Customer sends ~0.044 ETH, you receive full 0.042 ETH (customer pays extra)`,
                  default: 'company',
                  example: 'company'
                },
                topUp: {
                  type: 'boolean',
                  description: `📥 OPTIONAL: Payment type flag.
                  
- \`false\` (default) - Regular payment for goods/services
- \`true\` - Customer wallet top-up/deposit`,
                  default: false,
                  example: false
                },
                accepted_currencies: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20']
                  },
                  description: `🪙 OPTIONAL: Limit which cryptocurrencies customer can choose.
                  
**Use Case:** If you only want to accept BTC and ETH for this payment, pass \`["BTC", "ETH"]\`.

**Default:** All your configured wallet currencies are available.

**Validation:** All currencies in this array must have wallet addresses configured in your account.`,
                  example: ['BTC', 'ETH', 'USDT-TRC20']
                },
                meta_data: {
                  type: 'object',
                  description: `🏷️ OPTIONAL: Custom data to attach to this payment (max 2KB).
                  
**Use Cases:**
- Order ID: \`{ "order_id": "ORD-12345" }\`
- Customer reference: \`{ "customer_ref": "CUST-789", "invoice": "INV-2024-001" }\`
- Cart details: \`{ "items": ["Product A", "Product B"], "discount_code": "SAVE20" }\`

**Returned In:** Payment webhooks and transaction queries`,
                  example: {
                    order_id: 'ORD-12345',
                    customer_ref: 'CUST-789',
                    notes: 'Priority shipping'
                  }
                }
              }
            },
            examples: {
              'Minimal Payment': {
                summary: '⚡ Simplest - just amount and currency',
                description: 'Minimal required fields only',
                value: {
                  amount: 50,
                  currency: 'ETH'
                }
              },
              'Payment with Webhook': {
                summary: '📡 With server webhook notification',
                description: 'Receive payment updates on your server',
                value: {
                  amount: 100,
                  currency: 'BTC',
                  webhook_url: 'https://yourapp.com/webhooks/payment',
                  fee_payer: 'company'
                }
              },
              'Full Payment Options': {
                summary: '🚀 All available options',
                description: 'Complete example with all optional fields',
                value: {
                  amount: 250,
                  currency: 'USDT-TRC20',
                  redirect_uri: 'https://yourapp.com/order/12345/success',
                  webhook_url: 'https://yourapp.com/webhooks/payment',
                  fee_payer: 'customer',
                  topUp: false,
                  accepted_currencies: ['USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20'],
                  meta_data: {
                    order_id: 'ORD-12345',
                    customer_ref: 'CUST-789',
                    notes: 'Express delivery'
                  }
                }
              },
              'Limited Currency Options': {
                summary: '🪙 Restrict payment currencies',
                description: 'Only allow BTC and ETH for this payment',
                value: {
                  amount: 500,
                  currency: 'BTC',
                  accepted_currencies: ['BTC', 'ETH'],
                  webhook_url: 'https://yourapp.com/webhooks/payment',
                  meta_data: {
                    order_id: 'ORD-99999',
                    vip_customer: true
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Crypto payment address generated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      transaction_id: { 
                        type: 'string', 
                        description: '🆔 Unique payment transaction ID - use for tracking'
                      },
                      qr_code: { 
                        type: 'string', 
                        description: '📱 QR code data URL for customer scanning'
                      },
                      address: { 
                        type: 'string', 
                        description: '📥 Crypto deposit address - customer sends funds here'
                      },
                      amount: { 
                        type: 'number', 
                        description: '💰 Exact crypto amount customer must send'
                      },
                      currency: { 
                        type: 'string', 
                        description: '🪙 Cryptocurrency symbol'
                      },
                      base_amount: { 
                        type: 'number', 
                        description: '💵 Original amount in base currency (USD)'
                      },
                      base_currency: { 
                        type: 'string', 
                        description: 'Base currency code (e.g., USD)'
                      },
                      redirect_uri: { 
                        type: 'string', 
                        description: '🔗 Redirect URL after payment (if provided)'
                      }
                    }
                  }
                }
              },
              examples: {
                'ETH Payment': {
                  summary: 'Ethereum payment address generated',
                  value: {
                    success: true,
                    message: 'Payment Created!',
                    data: {
                      transaction_id: 'a3f2e1d4c5b6a7890fedcba987654321fedcba987654321fedcba9876543210',
                      qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
                      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE4E',
                      amount: 0.042156,
                      currency: 'ETH',
                      base_amount: 100,
                      base_currency: 'USD',
                      redirect_uri: 'https://yourapp.com/order/success'
                    }
                  }
                },
                'BTC Payment': {
                  summary: 'Bitcoin payment address generated',
                  value: {
                    success: true,
                    message: 'Payment Created!',
                    data: {
                      transaction_id: 'b4e3f2d1c0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3',
                      qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
                      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
                      amount: 0.00234567,
                      currency: 'BTC',
                      base_amount: 100,
                      base_currency: 'USD',
                      redirect_uri: null
                    }
                  }
                }
              }
            }
          }
        },
        400: { 
          description: 'Bad Request - Invalid parameters or unconfigured wallet',
          content: {
            'application/json': {
              examples: {
                'Missing Amount': {
                  summary: 'Amount field missing or invalid',
                  value: {
                    success: false,
                    message: 'Valid payment amount is required'
                  }
                },
                'Missing Currency': {
                  summary: 'Currency field missing',
                  value: {
                    success: false,
                    message: 'Currency is required',
                    available_currencies: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20']
                  }
                },
                'No Wallet Configured': {
                  summary: 'No crypto wallets configured',
                  value: {
                    success: false,
                    message: 'No crypto wallet configured. Please add at least one crypto wallet address before creating a payment.'
                  }
                },
                'Currency Not Configured': {
                  summary: 'Requested currency not available',
                  value: {
                    success: false,
                    message: 'ETH is not available for this payment. Available currencies: BTC, USDT-TRC20',
                    available_currencies: ['BTC', 'USDT-TRC20']
                  }
                },
                'Unconfigured Accepted Currency': {
                  summary: 'accepted_currencies contains unconfigured wallet',
                  value: {
                    success: false,
                    message: 'No wallet configured for: SOL, MATIC. Available currencies: BTC, ETH, USDT-TRC20'
                  }
                }
              }
            }
          }
        },
        403: { 
          description: 'Forbidden - Invalid API key or unauthorized',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'Invalid API key'
              }
            }
          }
        },
        500: { 
          description: 'Internal Server Error',
          content: {
            'application/json': {
              examples: {
                'Currency Rate Error': {
                  summary: 'Failed to fetch cryptocurrency rates',
                  value: {
                    success: false,
                    message: 'Failed to get currency rates'
                  }
                },
                'Payment Creation Error': {
                  summary: 'Error creating crypto payment',
                  value: {
                    success: false,
                    message: 'Failed to create crypto payment',
                    error: 'Internal payment processing error'
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/user/getTransactions': {
    get: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Get customer transactions',
      description: `Retrieve all transactions for the authenticated customer.

**Authentication:** 
- Header \`x-api-key\`: Your merchant API key
- Header \`Authorization\`: Bearer token from /api/user/createUser`,
      security: [{ ApiKeyAuth: [], BearerAuth: [] }],
      responses: {
        200: {
          description: 'Transactions retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        transaction_id: { type: 'string' },
                        amount: { type: 'number' },
                        currency: { type: 'string' },
                        status: { type: 'string', enum: ['pending', 'confirmed', 'failed'] },
                        created_at: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/user/getBalance': {
    get: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Get customer wallet balance',
      description: `Retrieve the wallet balance for the authenticated customer.

**Authentication:** 
- Header \`x-api-key\`: Your merchant API key
- Header \`Authorization\`: Bearer token from /api/user/createUser`,
      security: [{ ApiKeyAuth: [], BearerAuth: [] }],
      responses: {
        200: {
          description: 'Balance retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      balance: { type: 'number' },
                      currency: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/user/getSupportedCurrency': {
    get: {
      tags: ['Direct API - Merchant Integration'],
      summary: 'Get supported cryptocurrencies for your account',
      description: `Retrieve list of cryptocurrencies configured for your merchant account. Only returns currencies where you have wallet addresses configured.

**🔐 Authentication:** Requires \`x-api-key\` header with your encrypted API key.

**Use Cases:**
- Display available payment options to customers
- Validate currency before calling /api/user/cryptoPayment
- Check which wallets are configured

**Response includes:**
- \`currencies\` - Your configured cryptocurrencies (what customers can actually use)
- \`all_supported\` - All cryptocurrencies DynoPay supports (for reference)`,
      security: [{ ApiKeyAuth: [] }],
      responses: {
        200: {
          description: 'Supported currencies retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      currencies: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '✅ Your configured cryptocurrencies (what customers can use for payments)'
                      },
                      all_supported: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '📋 All cryptocurrencies supported by DynoPay platform'
                      }
                    }
                  }
                }
              },
              examples: {
                'Partial Configuration': {
                  summary: 'Merchant has some wallets configured',
                  value: {
                    success: true,
                    message: 'Supported currencies retrieved',
                    data: {
                      currencies: ['BTC', 'ETH', 'USDT-TRC20'],
                      all_supported: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20']
                    }
                  }
                },
                'Full Configuration': {
                  summary: 'Merchant has all wallets configured',
                  value: {
                    success: true,
                    message: 'Supported currencies retrieved',
                    data: {
                      currencies: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20'],
                      all_supported: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20']
                    }
                  }
                }
              }
            }
          }
        },
        403: {
          description: 'Forbidden - Invalid or missing API key',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'Invalid API key'
              }
            }
          }
        },
        500: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              example: {
                success: false,
                message: 'Internal server error'
              }
            }
          }
        }
      }
    }
  }
};
