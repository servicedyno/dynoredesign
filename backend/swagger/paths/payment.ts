export const paymentPaths = {
  // ==================== PAYMENT LINKS ====================
  '/api/pay/createPaymentLink': {
    post: {
      tags: ['Payments'],
      summary: 'Create payment link',
      description: `Create a new payment link for accepting crypto or fiat payments. The link can be shared with customers to collect payments.

**🎁 REFEREE CODE FEATURE:**
When you provide a customer email, the system will automatically:
- Check if the email already has a DynoPay account (skips if yes)
- Check if a referee code was already sent to this email (skips if yes)
- Generate a unique one-time referee code (REF-XXXXXXXX)
- Include the code in the payment notification email

**Referee Code Benefits:**
- Customer who signs up gets **50% off fees for 90 days**
- You (the merchant) get **10% off fees for 30 days**

**FIELD NAME COMPATIBILITY:**
The API supports flexible field naming for backward compatibility. You only need to provide **ONE** currency field and **ONE** amount field:

**Currency Field (choose one):**
- \`currency\` - **RECOMMENDED** for most use cases
- \`base_currency\` - Alternative name (works identically)

**Amount Field (choose one):**
- \`amount\` - **RECOMMENDED** for most use cases  
- \`base_amount\` - Alternative name (works identically)

⚠️ **IMPORTANT:** Only provide ONE of each field type. If both are provided, \`base_*\` fields take priority.

**PAYMENT MODES:**
Modes must be provided in **UPPERCASE**. Valid modes:
- \`CRYPTO\` - Cryptocurrency payments
- \`CARD\` - Credit/debit card payments
- \`BANK_TRANSFER\` - Bank transfer
- \`GOOGLE_PAY\` - Google Pay
- \`APPLE_PAY\` - Apple Pay
- \`USSD\` - USSD payments
- \`MOBILE_MONEY\` - Mobile money
- \`QR_CODE\` - QR code payments

**EXPIRATION OPTIONS:**
- \`24h\` - Link expires in 24 hours
- \`7d\` - Link expires in 7 days
- \`30d\` - Link expires in 30 days
- \`No\` - Link never expires (default)`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount'],
              properties: {
                amount: { 
                  type: 'number', 
                  description: '✅ REQUIRED: Payment amount. Provide this OR base_amount',
                  example: 100.00,
                  minimum: 0.01
                },
                base_amount: { 
                  type: 'number', 
                  description: '✅ REQUIRED (alternative): Payment amount. Provide this OR amount',
                  example: 100.00,
                  minimum: 0.01
                },
                currency: { 
                  type: 'string', 
                  enum: [
                    'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'HKD', 'NZD', 'SGD',
                    'BRL', 'ARS', 'COP', 'CLP', 'PEN', 'MXN', 'VES', 'UYU',
                    'NGN', 'ZAR', 'KES', 'GHS', 'TZS', 'XAF', 'XOF', 'EGP', 'MAD',
                    'UGX', 'RWF', 'ETB', 'ZMW', 'BWP', 'MUR', 'AOA', 'MZN', 'CDF',
                    'BTC', 'LTC', 'DOGE'
                  ], 
                  description: '📝 OPTIONAL: Currency code (defaults to "USD"). Supports 35+ international, Latin American, and African currencies.',
                  example: 'USD',
                  default: 'USD'
                },
                base_currency: { 
                  type: 'string', 
                  enum: [
                    'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'HKD', 'NZD', 'SGD',
                    'BRL', 'ARS', 'COP', 'CLP', 'PEN', 'MXN', 'VES', 'UYU',
                    'NGN', 'ZAR', 'KES', 'GHS', 'TZS', 'XAF', 'XOF', 'EGP', 'MAD',
                    'UGX', 'RWF', 'ETB', 'ZMW', 'BWP', 'MUR', 'AOA', 'MZN', 'CDF',
                    'BTC', 'LTC', 'DOGE'
                  ], 
                  description: '📝 OPTIONAL: Currency code (alternative field name, defaults to "USD")',
                  example: 'USD',
                  default: 'USD'
                },
                company_id: { 
                  type: 'integer', 
                  description: '📝 OPTIONAL: Company ID (defaults to user\'s first company). Recommended for multi-company accounts',
                  example: 1
                },
                email: {
                  type: 'string',
                  format: 'email',
                  description: '📝 OPTIONAL: Customer email for payment notifications and receipts',
                  example: 'customer@example.com'
                },
                modes: {
                  type: 'array',
                  items: { 
                    type: 'string', 
                    enum: ['CRYPTO', 'CARD', 'BANK_TRANSFER', 'GOOGLE_PAY', 'APPLE_PAY', 'USSD', 'MOBILE_MONEY', 'QR_CODE']
                  },
                  description: '📝 OPTIONAL: Payment modes (defaults to ["CRYPTO"]). Must be UPPERCASE',
                  example: ['CRYPTO'],
                  default: ['CRYPTO']
                },
                description: { 
                  type: 'string', 
                  description: '📝 OPTIONAL: Payment description shown to customer',
                  example: 'Order #12345 - Premium Subscription'
                },
                expire: {
                  type: 'string',
                  enum: ['24h', '7d', '30d', 'No'],
                  description: '📝 OPTIONAL: Link expiration period (defaults to "No" - never expires)',
                  example: '24h',
                  default: 'No'
                },
                callback_url: { 
                  type: 'string', 
                  format: 'uri', 
                  description: '🔗 OPTIONAL: URL to call after payment completion',
                  example: 'https://example.com/callback'
                },
                redirect_url: { 
                  type: 'string', 
                  format: 'uri', 
                  description: '↪️ OPTIONAL: URL to redirect customer after successful payment',
                  example: 'https://example.com/success'
                },
                webhook_url: { 
                  type: 'string', 
                  format: 'uri', 
                  description: `📡 OPTIONAL: URL to receive payment status webhooks (per-link override).
                  
**Webhook Events:**
- \`payment.pending\` - Payment detected on blockchain, awaiting confirmations
- \`payment.confirmed\` - Payment fully confirmed and processed

**Note:** If not set, webhooks will be sent to the company's default webhook URL (configured via /api/company/webhook-settings).

**Headers Included:**
- \`X-DynoPay-Event\` - Event type
- \`X-DynoPay-Signature\` - HMAC signature (if webhook_secret configured)
- \`X-DynoPay-Timestamp\` - Unix timestamp
- \`X-DynoPay-Webhook-Id\` - Unique delivery ID`,
                  example: 'https://example.com/webhook'
                },
                fee_payer: {
                  type: 'string',
                  enum: ['customer', 'company'],
                  description: `💰 OPTIONAL: Who pays blockchain/network fees.

**Options:**
- \`company\` (default) - Fees deducted from merchant's portion
- \`customer\` - Customer pays additional amount to cover fees

**Example (customer pays fees):**
- Base amount: $10.00
- Admin fee (33%): $3.30  
- Customer total: $13.30
- Merchant receives: $10.00 (full base amount)`,
                  example: 'company',
                  default: 'company'
                },
                apply_tax: {
                  type: 'boolean',
                  description: `🧾 OPTIONAL: Enable automatic tax calculation based on customer's location.

**When enabled:**
- Customer's country is auto-detected from IP at checkout
- Tax rate (VAT/GST/Sales Tax) is fetched for that country
- Tax is added to the payment total
- Tax goes to merchant (for remittance to tax authority)

**Default:** \`false\` (no tax applied)

**Example (Portuguese customer, 23% VAT):**
- Base amount: €100.00
- VAT (23%): €23.00
- Customer total: €123.00
- Merchant receives: base + tax = €123.00 (67% of base + full tax if company pays fees)`,
                  example: false,
                  default: false
                }
              }
            },
            examples: {
              'Minimal - Just Amount': {
                summary: '⚡ SIMPLEST: Only amount required (uses all defaults)',
                value: {
                  amount: 10.00
                }
              },
              'With Customer Email': {
                summary: '📧 SIMPLE: Amount + customer email',
                value: {
                  amount: 50.00,
                  email: 'customer@example.com'
                }
              },
              'Standard Payment': {
                summary: '💡 STANDARD: Common use case',
                value: {
                  amount: 100.00,
                  currency: 'USD',
                  email: 'customer@example.com',
                  description: 'Order #12345'
                }
              },
              'With Company ID': {
                summary: '🏢 MULTI-COMPANY: Specify which company',
                value: {
                  amount: 100.00,
                  company_id: 38,
                  email: 'customer@example.com',
                  modes: ['CRYPTO'],
                  description: 'Payment for Company #38'
                }
              },
              'With Tax Enabled': {
                summary: '🧾 TAX: Auto-calculate tax based on customer location',
                value: {
                  amount: 100.00,
                  currency: 'EUR',
                  email: 'customer@example.com',
                  description: 'Digital Product - Pro Plan',
                  apply_tax: true
                }
              },
              'Customer Pays Fees': {
                summary: '💰 FEES: Customer pays processing fees',
                value: {
                  amount: 50.00,
                  email: 'customer@example.com',
                  fee_payer: 'customer',
                  description: 'Service Fee - Customer Absorbs Fees'
                }
              },
              'With Expiration': {
                summary: '⏰ EXPIRY: Link expires in 24 hours',
                value: {
                  amount: 199.99,
                  email: 'customer@example.com',
                  description: 'Limited Time Offer',
                  expire: '24h'
                }
              },
              'Full Configuration': {
                summary: '🔧 COMPLETE: All options configured',
                value: {
                  amount: 199.99,
                  currency: 'USD',
                  company_id: 1,
                  email: 'customer@example.com',
                  modes: ['CRYPTO'],
                  description: 'Premium Subscription - Annual',
                  expire: '7d',
                  fee_payer: 'customer',
                  apply_tax: true,
                  callback_url: 'https://myapp.com/api/payment-callback',
                  redirect_url: 'https://myapp.com/thank-you',
                  webhook_url: 'https://myapp.com/webhooks/payment'
                }
              },
              'Crypto Only Payment': {
                summary: '₿ CRYPTO: Bitcoin payment with webhook',
                value: {
                  amount: 0.001,
                  currency: 'BTC',
                  email: 'crypto@example.com',
                  description: 'BTC Payment - Invoice #001',
                  expire: '30d',
                  webhook_url: 'https://myapp.com/webhooks/payment'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment link created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      link_id: { type: 'string', format: 'uuid' },
                      payment_url: { type: 'string', format: 'uri' },
                      amount: { type: 'number' },
                      currency: { type: 'string' },
                      status: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      expires_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              },
              example: {
                message: 'Payment link created successfully',
                data: {
                  link_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  payment_url: 'https://checkout.dynopay.com/pay/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  amount: 199.99,
                  currency: 'USD',
                  status: 'active',
                  created_at: '2024-01-15T10:30:00Z',
                  expires_at: null
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request',
          content: {
            'application/json': {
              example: { message: 'Amount must be greater than 0', error: true }
            }
          }
        },
        401: { description: 'Unauthorized - Invalid or missing token' }
      }
    }
  },
  '/api/pay/getPaymentLinks': {
    get: {
      tags: ['Payments'],
      summary: 'Get all payment links',
      description: 'Retrieve all payment links for the authenticated user with pagination and filtering',
      security: [{ BearerAuth: [] }],
      parameters: [
        { in: 'query', name: 'company_id', schema: { type: 'integer' }, description: 'Filter by company' },
        { in: 'query', name: 'status', schema: { type: 'string', enum: ['active', 'paid', 'expired', 'cancelled'] } },
        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
        { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } }
      ],
      responses: {
        200: {
          description: 'Payment links retrieved',
          content: {
            'application/json': {
              example: {
                message: 'Payment links retrieved',
                data: {
                  links: [
                    {
                      link_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                      amount: 199.99,
                      currency: 'USD',
                      description: 'Order #12345',
                      status: 'paid',
                      payment_url: 'https://checkout.dynopay.com/pay/a1b2c3d4...',
                      created_at: '2024-01-15T10:30:00Z',
                      paid_at: '2024-01-15T10:45:00Z'
                    },
                    {
                      link_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
                      amount: 50.00,
                      currency: 'USD',
                      description: 'Consultation Fee',
                      status: 'active',
                      payment_url: 'https://checkout.dynopay.com/pay/b2c3d4e5...',
                      created_at: '2024-01-16T09:00:00Z',
                      expires_at: '2024-01-23T09:00:00Z'
                    }
                  ],
                  pagination: { total: 25, page: 1, limit: 20, totalPages: 2 }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/links/{id}': {
    get: {
      tags: ['Payments'],
      summary: 'Get payment link by ID',
      description: 'Retrieve detailed information about a specific payment link',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      }],
      responses: {
        200: {
          description: 'Payment link details',
          content: {
            'application/json': {
              example: {
                message: 'Payment link retrieved',
                data: {
                  link_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  amount: 199.99,
                  currency: 'USD',
                  description: 'Order #12345 - Premium Subscription',
                  status: 'paid',
                  payment_url: 'https://checkout.dynopay.com/pay/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  redirect_url: 'https://mystore.com/order/12345/success',
                  webhook_url: 'https://mystore.com/webhooks/dynopay',
                  metadata: { order_id: '12345', customer_email: 'customer@example.com' },
                  created_at: '2024-01-15T10:30:00Z',
                  paid_at: '2024-01-15T10:45:00Z',
                  transaction: {
                    transaction_id: 'txn_abc123',
                    crypto_currency: 'BTC',
                    crypto_amount: 0.00456,
                    confirmations: 3,
                    tx_hash: '0x1234567890abcdef...'
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Payment link not found',
          content: {
            'application/json': {
              example: { message: 'Payment link not found', error: true }
            }
          }
        }
      }
    },
    put: {
      tags: ['Payments'],
      summary: 'Update payment link',
      description: 'Update an existing payment link (only active links can be updated)',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string', format: 'uuid' }
      }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                redirect_url: { type: 'string', format: 'uri' },
                webhook_url: { type: 'string', format: 'uri' },
                expires_at: { type: 'string', format: 'date-time' },
                status: { type: 'string', enum: ['active', 'cancelled'] }
              }
            },
            example: {
              description: 'Updated: Order #12345 - Premium Subscription (Discounted)',
              expires_at: '2024-02-15T23:59:59Z'
            }
          }
        }
      },
      responses: {
        200: { description: 'Payment link updated' },
        400: { description: 'Cannot update paid or expired links' },
        404: { description: 'Payment link not found' }
      }
    }
  },
  '/api/pay/deletePaymentLink/{id}': {
    delete: {
      tags: ['Payments'],
      summary: 'Delete payment link',
      description: 'Delete/cancel a payment link (only active unpaid links can be deleted)',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string', format: 'uuid' }
      }],
      responses: {
        200: {
          description: 'Payment link deleted',
          content: {
            'application/json': {
              example: { message: 'Payment link deleted successfully' }
            }
          }
        },
        400: { description: 'Cannot delete paid links' },
        404: { description: 'Payment link not found' }
      }
    }
  },

  // ==================== PAYMENT PROCESSING ====================
  '/api/pay/getData': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Get payment data for checkout',
      description: `Retrieve payment information for checkout page. Called when customer opens a payment link.

**Enhanced Response Includes:**
- Order details (description, invoice reference)
- Merchant branding (company name, logo)
- Fee breakdown (subtotal, processing fee, who pays)
- Tax calculation (if merchant enabled \`apply_tax\`)
- Link expiry with countdown
- Redirect URL for post-payment

**Tax Calculation:**
When \`apply_tax: true\` was set during payment link creation:
- Customer's country is auto-detected from IP
- Tax rate (VAT/GST) is fetched and calculated
- Response includes \`tax_info\` object with breakdown`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['data'],
              properties: {
                data: { type: 'string', description: 'Payment link reference (from URL parameter d)' }
              }
            },
            example: {
              data: 'a1b2c3d4e5f67890abcdef1234567890abcdef12'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment data retrieved',
          content: {
            'application/json': {
              examples: {
                'Standard Response': {
                  summary: 'Payment link without tax',
                  value: {
                    message: 'Payment link details retrieved successfully',
                    data: {
                      amount: 50,
                      base_currency: 'USD',
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      payment_mode: 'createLink',
                      allowedModes: 'CRYPTO',
                      fee_payer: 'company',
                      transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                      order_reference: 'INV-2026-A1B2C3',
                      description: 'Order #12345 - Premium Subscription',
                      merchant: {
                        company_name: 'My Online Store',
                        company_logo: 'https://mystore.com/logo.png'
                      },
                      fee_info: {
                        fee_payer: 'company'
                      },
                      expiry: {
                        expires_at: '2026-02-07T10:30:00Z',
                        is_expired: false,
                        countdown: {
                          days: 6,
                          hours: 23,
                          minutes: 45,
                          seconds: 30,
                          formatted: '6d : 23h : 45m : 30s'
                        }
                      },
                      created_at: '2026-01-31T10:30:00Z',
                      apply_tax: false,
                      redirect_url: 'https://mystore.com/success'
                    }
                  }
                },
                'With Tax Enabled (Customer in Portugal)': {
                  summary: 'Payment with auto-calculated VAT',
                  value: {
                    message: 'Payment link details retrieved successfully',
                    data: {
                      amount: 100,
                      base_currency: 'EUR',
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      payment_mode: 'createLink',
                      allowedModes: 'CRYPTO',
                      fee_payer: 'company',
                      transaction_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
                      order_reference: 'INV-2026-X7Y8Z9',
                      description: 'Digital Product - Pro Plan',
                      merchant: {
                        company_name: 'SaaS Company',
                        company_logo: 'https://saas.com/logo.png'
                      },
                      fee_info: {
                        fee_payer: 'company'
                      },
                      expiry: {
                        expires_at: '2026-02-07T10:30:00Z',
                        is_expired: false,
                        countdown: {
                          days: 7,
                          hours: 0,
                          minutes: 0,
                          seconds: 0,
                          formatted: '7d : 00h : 00m : 00s'
                        }
                      },
                      created_at: '2026-01-31T10:30:00Z',
                      apply_tax: true,
                      tax_info: {
                        tax_enabled: true,
                        tax_rate: 23,
                        tax_acronym: 'VAT',
                        tax_amount: 23.00,
                        country_code: 'PT',
                        country_name: 'Portugal',
                        subtotal: 100.00,
                        total: 123.00,
                        currency: 'EUR'
                      },
                      redirect_url: 'https://saas.com/thank-you'
                    }
                  }
                },
                'Customer Pays Fees': {
                  summary: 'Fee breakdown when customer pays',
                  value: {
                    message: 'Payment link details retrieved successfully',
                    data: {
                      amount: 50,
                      base_currency: 'USD',
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      payment_mode: 'createLink',
                      allowedModes: 'CRYPTO',
                      fee_payer: 'customer',
                      transaction_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                      order_reference: 'INV-2026-FEE123',
                      description: 'Consulting Service',
                      merchant: {
                        company_name: 'Consulting Co',
                        company_logo: null
                      },
                      fee_info: {
                        fee_payer: 'customer',
                        processing_fee: 4.55,
                        total_amount: 54.55
                      },
                      expiry: null,
                      created_at: '2026-01-31T10:30:00Z',
                      apply_tax: false
                    }
                  }
                },
                'Expired Link': {
                  summary: 'Payment link has expired',
                  value: {
                    message: 'Payment link details retrieved successfully',
                    data: {
                      amount: 100,
                      base_currency: 'USD',
                      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      payment_mode: 'createLink',
                      allowedModes: 'CRYPTO',
                      fee_payer: 'company',
                      transaction_id: 'd4e5f6a7-b8c9-0123-def0-234567890123',
                      order_reference: 'INV-2026-EXP456',
                      description: 'Expired Order',
                      merchant: {
                        company_name: 'Test Store',
                        company_logo: null
                      },
                      fee_info: {
                        fee_payer: 'company'
                      },
                      expiry: {
                        expires_at: '2026-01-30T10:30:00Z',
                        is_expired: true,
                        countdown: null
                      },
                      created_at: '2026-01-23T10:30:00Z',
                      apply_tax: false
                    }
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Payment not found or expired',
          content: {
            'application/json': {
              example: { message: 'Payment link not found or expired', error: true }
            }
          }
        }
      }
    }
  },
  '/api/pay/createCryptoPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Initiate crypto payment',
      description: `Customer selects cryptocurrency and receives a deposit address. The system monitors this address for incoming payments.

**Tax Handling:**
If the payment link has \`apply_tax: true\`, the crypto amount will include the calculated tax based on customer's detected location.

**Amount Calculation:**
- Base amount + Tax (if enabled) + Processing fee (if customer pays) = Total crypto amount`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id', 'crypto_currency'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' },
                crypto_currency: { type: 'string', enum: ['BTC', 'ETH', 'USDT-TRC20', 'USDT-ERC20', 'TRX', 'LTC', 'DOGE'] },
                customer_email: { type: 'string', format: 'email', description: 'Optional: for payment receipt' }
              }
            },
            examples: {
              'Bitcoin Payment': {
                summary: 'Pay with BTC',
                value: {
                  transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  crypto_currency: 'BTC',
                  customer_email: 'customer@example.com'
                }
              },
              'USDT on Tron': {
                summary: 'Pay with USDT (TRC20)',
                value: {
                  transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  crypto_currency: 'USDT-TRC20'
                }
              },
              'Ethereum Payment': {
                summary: 'Pay with ETH',
                value: {
                  transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  crypto_currency: 'ETH',
                  customer_email: 'customer@example.com'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Crypto payment initiated - deposit address generated',
          content: {
            'application/json': {
              examples: {
                'Standard Response (No Tax)': {
                  summary: 'Crypto address without tax',
                  value: {
                    message: 'Crypto payment initiated',
                    data: {
                      deposit_address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
                      crypto_currency: 'BTC',
                      crypto_amount: 0.00456789,
                      usd_amount: 199.99,
                      exchange_rate: 43750.00,
                      base_amount: 199.99,
                      base_currency: 'USD',
                      merchant_amount: 0.00306,
                      fees: 0.00151,
                      fee_payer: 'company',
                      qr_code: 'data:image/png;base64,iVBORw0KGgo...',
                      expires_at: '2024-01-15T11:30:00Z',
                      confirmations_required: 1,
                      network: 'Bitcoin Mainnet'
                    }
                  }
                },
                'With Tax (Portuguese Customer)': {
                  summary: 'Crypto amount includes 23% VAT',
                  value: {
                    message: 'Crypto payment initiated',
                    data: {
                      deposit_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE4E',
                      crypto_currency: 'ETH',
                      crypto_amount: 0.0615,
                      usd_amount: 123.00,
                      exchange_rate: 2000.00,
                      base_amount: 100.00,
                      base_currency: 'EUR',
                      merchant_amount: 0.0515,
                      fees: 0.01,
                      fee_payer: 'company',
                      qr_code: 'data:image/png;base64,iVBORw0KGgo...',
                      expires_at: '2024-01-15T11:30:00Z',
                      confirmations_required: 12,
                      network: 'Ethereum Mainnet',
                      tax_info: {
                        tax_amount: 23.00,
                        tax_amount_crypto: 0.0115,
                        tax_rate: 23,
                        tax_acronym: 'VAT',
                        country_code: 'PT'
                      }
                    }
                  }
                },
                'USDT-TRC20 Response': {
                  summary: 'USDT TRC20 deposit address',
                  value: {
                    message: 'Crypto payment initiated',
                    data: {
                      deposit_address: 'TN7cWz1s5p5XKT8KJhKjZ8EWPH4v8hGhqN',
                      crypto_currency: 'USDT-TRC20',
                      crypto_amount: 199.99,
                      usd_amount: 199.99,
                      exchange_rate: 1.00,
                      base_amount: 199.99,
                      base_currency: 'USD',
                      merchant_amount: 133.99,
                      fees: 66.00,
                      fee_payer: 'company',
                      qr_code: 'data:image/png;base64,iVBORw0KGgo...',
                      expires_at: '2024-01-15T11:30:00Z',
                      confirmations_required: 20,
                      network: 'Tron (TRC20)'
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid currency or payment already processed',
          content: {
            'application/json': {
              example: { message: 'Unsupported cryptocurrency', error: true }
            }
          }
        }
      }
    }
  },
  '/api/pay/verifyCryptoPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Verify crypto payment status',
      description: `Check the status of a cryptocurrency payment. Poll this endpoint to show payment progress to customers.
      
**Status Flow:**
- \`waiting\` - No payment detected yet on blockchain
- \`pending\` - Payment detected, awaiting blockchain confirmations
- \`underpaid\` - Partial payment received, waiting for remaining amount (customer sent less than expected)
- \`confirmed\` - Payment fully confirmed and processed (exact amount)
- \`overpaid\` - Payment confirmed but customer paid more than required
- \`failed\` - Payment processing failed

**USD Amounts:** All responses include USD-equivalent amounts for display purposes.

**Underpayment Handling:** When status is \`underpaid\`, the \`address\` field is returned so customer can send remaining payment to the SAME address within the grace period.

**Recommended Polling Interval:** 5-10 seconds`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['address'],
              properties: {
                address: { 
                  type: 'string',
                  description: 'The cryptocurrency deposit address to check'
                }
              }
            },
            example: {
              address: '0x5c8282c96a89f002b908668bab6d5d30c68b610e'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment status retrieved',
          content: {
            'application/json': {
              examples: {
                'Waiting for Payment': {
                  summary: '🕐 No payment detected yet',
                  value: {
                    message: 'Waiting for payment',
                    data: {
                      status: 'waiting',
                      message: 'Payment address generated, waiting for transaction',
                      expected_amount: '0.005470',
                      currency: 'ETH'
                    }
                  }
                },
                'Payment Pending': {
                  summary: '⏳ Payment detected, awaiting confirmation',
                  value: {
                    message: 'Payment pending',
                    data: {
                      status: 'pending',
                      message: 'Payment detected, awaiting confirmation',
                      txId: '0x7a91f8b2c3d4e5f6...',
                      amount: '0.005470',
                      expected_amount: '0.005470',
                      currency: 'ETH'
                    }
                  }
                },
                'Underpaid (Partial Payment)': {
                  summary: '⚠️ Partial payment received - customer needs to pay more',
                  value: {
                    message: 'Partial payment received',
                    data: {
                      status: 'underpaid',
                      message: 'Partial payment received. Please pay the remaining amount.',
                      paidAmount: 0.002,
                      expectedAmount: 0.00547,
                      remainingAmount: 0.00347,
                      currency: 'ETH',
                      paidAmountUsd: 5.48,
                      expectedAmountUsd: 15.00,
                      remainingAmountUsd: 9.52,
                      baseCurrency: 'USD',
                      txId: '0x7a91f8b2c3d4e5f6...',
                      address: '0x5c8282c96a89f002b908668bab6d5d30c68b610e',
                      grace_period_minutes: 30,
                      partial_payment_timestamp: '2026-01-30T12:39:35.104Z'
                    }
                  }
                },
                'Payment Confirmed': {
                  summary: '✅ Payment confirmed and completed (exact amount)',
                  value: {
                    message: 'Payment confirmed',
                    data: {
                      status: 'confirmed',
                      message: 'Payment confirmed',
                      redirect: 'https://mystore.com/order/12345/success',
                      txId: '0x7a91f8b2c3d4e5f6...',
                      paidAmount: 0.00547,
                      expectedAmount: 0.00547,
                      currency: 'ETH',
                      paidAmountUsd: 15.00,
                      expectedAmountUsd: 15.00,
                      baseCurrency: 'USD',
                      completedAt: '2026-01-30T12:45:00.000Z'
                    }
                  }
                },
                'Overpaid': {
                  summary: '💰 Payment confirmed with excess - customer paid more than required',
                  value: {
                    message: 'Payment confirmed with overpayment',
                    data: {
                      status: 'overpaid',
                      message: 'Payment confirmed with overpayment',
                      redirect: 'https://mystore.com/order/12345/success',
                      txId: '0x7a91f8b2c3d4e5f6...',
                      paidAmount: 0.00647,
                      expectedAmount: 0.00547,
                      excessAmount: 0.001,
                      currency: 'ETH',
                      paidAmountUsd: 17.74,
                      expectedAmountUsd: 15.00,
                      excessAmountUsd: 2.74,
                      baseCurrency: 'USD',
                      completedAt: '2026-01-30T12:45:00.000Z'
                    }
                  }
                },
                'Payment Failed': {
                  summary: '❌ Payment processing failed',
                  value: {
                    message: 'Payment failed',
                    data: {
                      status: 'failed',
                      message: 'Transaction verification failed',
                      txId: '0x7a91f8b2c3d4e5f6...'
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
  '/api/pay/confirmPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Confirm payment completion',
      description: 'Finalize and confirm a completed payment. Triggers webhook notification to merchant.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment confirmed',
          content: {
            'application/json': {
              example: {
                message: 'Payment confirmed successfully',
                data: {
                  status: 'completed',
                  redirect_url: 'https://mystore.com/order/12345/success'
                }
              }
            }
          }
        }
      }
    }
  },

  // ==================== FIAT PAYMENTS ====================
  '/api/pay/addPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Initiate fiat payment',
      description: 'Create fiat (card/bank) payment via Flutterwave',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id', 'payment_mode'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' },
                payment_mode: { type: 'string', enum: ['CARD', 'BANK'] },
                customer: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    name: { type: 'string' },
                    phone: { type: 'string' }
                  }
                }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              payment_mode: 'CARD',
              customer: {
                email: 'customer@example.com',
                name: 'John Doe',
                phone: '+1234567890'
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Fiat payment initiated',
          content: {
            'application/json': {
              example: {
                message: 'Payment initiated',
                data: {
                  payment_url: 'https://checkout.flutterwave.com/v3/hosted/pay/xyz123',
                  reference: 'FLW-TXN-123456'
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/verifyPayment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Verify fiat payment',
      description: 'Verify fiat payment status after redirect from payment provider',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['transaction_id'],
              properties: {
                transaction_id: { type: 'string', format: 'uuid' }
              }
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment verification result',
          content: {
            'application/json': {
              examples: {
                'Successful': {
                  value: {
                    status: 'successful',
                    message: 'Payment completed',
                    data: { redirect_url: 'https://mystore.com/success' }
                  }
                },
                'Pending': {
                  value: {
                    status: 'pending',
                    message: 'Payment is being processed'
                  }
                },
                'Failed': {
                  value: {
                    status: 'failed',
                    message: 'Payment was declined'
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  // ==================== UTILITIES ====================
  '/api/pay/getCurrencyRates': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Get currency exchange rates',
      description: 'Retrieve current crypto-to-fiat exchange rates with calculated totals when customer pays fees',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                source: { type: 'string', description: 'Source currency (e.g., USD)' },
                amount: { type: 'number', description: 'Amount in source currency' },
                currencyList: { type: 'array', items: { type: 'string' }, description: 'List of target currencies' },
                fee_payer: { type: 'string', enum: ['customer', 'company'], description: 'Who pays the fees' }
              }
            },
            example: { 
              source: 'USD', 
              amount: 50,
              currencyList: ['BTC', 'ETH', 'USDT-TRC20'],
              fee_payer: 'customer'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Exchange rates with totals',
          content: {
            'application/json': {
              example: {
                message: 'Exchange rates retrieved successfully',
                data: [
                  {
                    currency: 'ETH',
                    amount: '0.01650000',
                    fee_payer: 'customer',
                    base_amount: 0.0155,
                    base_amount_usd: 50,
                    processing_fee: 4.55,
                    total_amount: '0.01650000',
                    total_amount_usd: 54.55,
                    total_amount_source: 54.55
                  },
                  {
                    currency: 'BTC',
                    amount: '0.00055000',
                    fee_payer: 'customer',
                    base_amount: 0.0005,
                    base_amount_usd: 50,
                    processing_fee: 4.55,
                    total_amount: '0.00055000',
                    total_amount_usd: 54.55,
                    total_amount_source: 54.55
                  }
                ]
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/network-fees': {
    get: {
      tags: ['Payment Processing'],
      summary: 'Get blockchain network fees',
      description: 'Retrieve current blockchain transaction fees for supported networks',
      parameters: [{
        in: 'query',
        name: 'currency',
        schema: { type: 'string', enum: ['BTC', 'ETH', 'TRX', 'LTC'] },
        required: true,
        example: 'BTC'
      }],
      responses: {
        200: {
          description: 'Network fees',
          content: {
            'application/json': {
              example: {
                data: {
                  currency: 'BTC',
                  slow: { fee: 5, time: '60 minutes', satoshi_per_byte: 10 },
                  medium: { fee: 12, time: '30 minutes', satoshi_per_byte: 25 },
                  fast: { fee: 25, time: '10 minutes', satoshi_per_byte: 50 }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/calculate-payment': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Calculate payment amount',
      description: 'Calculate total payment amount including processing fees',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount_usd', 'chain'],
              properties: {
                amount_usd: { type: 'number', description: 'Amount in USD' },
                chain: { type: 'string', enum: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'USDT_TRC20', 'USDT_ERC20'] },
                fee_payer: { type: 'string', enum: ['customer', 'company'], default: 'customer' }
              }
            },
            examples: {
              'Customer Pays Fees': {
                value: {
                  amount_usd: 100,
                  chain: 'ETH',
                  fee_payer: 'customer'
                }
              },
              'Company Absorbs Fees': {
                value: {
                  amount_usd: 100,
                  chain: 'BTC',
                  fee_payer: 'company'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment calculation',
          content: {
            'application/json': {
              example: {
                message: 'Payment amount calculated',
                data: {
                  fee_payer: 'customer',
                  base_amount_usd: 100,
                  base_amount_crypto: 0.0303,
                  processing_fee: 5.0,
                  total_amount_crypto: 0.0318,
                  total_amount_usd: 105.0,
                  crypto_currency: 'ETH',
                  crypto_price_usd: 3300
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pay/getBalance': {
    get: {
      tags: ['Payment Processing'],
      summary: 'Get customer balance',
      description: 'Retrieve customer wallet balance',
      parameters: [{
        in: 'query',
        name: 'customer_id',
        schema: { type: 'string' },
        required: true
      }],
      responses: {
        200: {
          description: 'Balance retrieved',
          content: {
            'application/json': {
              example: {
                data: {
                  balances: [
                    { currency: 'BTC', balance: 0.05234, usd_value: 2295.12 },
                    { currency: 'ETH', balance: 1.234, usd_value: 2883.09 },
                    { currency: 'USDT', balance: 500.00, usd_value: 500.00 }
                  ],
                  total_usd: 5678.21
                }
              }
            }
          }
        }
      }
    }
  },

  // ==================== WEBHOOKS ====================
  
  // MERCHANT WEBHOOK DOCUMENTATION
  // This describes what YOUR server receives when payment events occur
  '/webhooks/merchant-endpoint': {
    post: {
      tags: ['Webhooks'],
      summary: '📘 Merchant Webhook Payloads (Documentation)',
      description: `**This is documentation only - not an actual DynoPay endpoint.**

When you create a payment link with a \`webhook_url\`, DynoPay will POST to YOUR server when payment events occur.

### Webhook Setup
1. Create a payment link with \`webhook_url: "https://yourserver.com/webhooks/dynopay"\`
2. DynoPay sends POST requests to your URL when payment status changes
3. Your server should respond with HTTP 200 to acknowledge receipt

### Security
- Verify the \`signature\` header using your API secret
- Signature: HMAC-SHA256 of request body with your secret key
- Always validate \`transaction_id\` matches your records

### Retry Policy
- DynoPay retries failed webhooks 3 times with exponential backoff
- Intervals: 1 min, 5 min, 30 min
- After 3 failures, webhook is marked as failed (check dashboard)`,
      requestBody: {
        description: 'Example webhook payloads sent to YOUR webhook_url',
        content: {
          'application/json': {
            examples: {
              'payment.confirmed': {
                summary: '✅ Payment Confirmed (Crypto)',
                description: 'Sent when crypto payment is fully confirmed on blockchain',
                value: {
                  event: 'payment.confirmed',
                  timestamp: '2024-01-15T10:45:00Z',
                  data: {
                    transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    link_id: 'link_xyz789',
                    status: 'completed',
                    amount: 199.99,
                    currency: 'USD',
                    crypto_amount: 0.00456789,
                    crypto_currency: 'BTC',
                    tx_hash: '7a91f8b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
                    confirmations: 3,
                    customer_email: 'customer@example.com',
                    metadata: {
                      order_id: '12345',
                      product: 'Premium Subscription'
                    },
                    completed_at: '2024-01-15T10:45:00Z'
                  }
                }
              },
              'payment.confirmed_fiat': {
                summary: '✅ Payment Confirmed (Card/Bank)',
                description: 'Sent when fiat payment via card or bank is successful',
                value: {
                  event: 'payment.confirmed',
                  timestamp: '2024-01-15T10:45:00Z',
                  data: {
                    transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    link_id: 'link_xyz789',
                    status: 'completed',
                    amount: 199.99,
                    currency: 'USD',
                    payment_method: 'CARD',
                    transaction_reference: 'FLW-TXN-123456789',
                    customer_email: 'customer@example.com',
                    metadata: {
                      order_id: '12345'
                    },
                    completed_at: '2024-01-15T10:45:00Z'
                  }
                }
              },
              'payment.pending': {
                summary: '⏳ Payment Pending',
                description: 'Sent when crypto transaction is detected but awaiting confirmations',
                value: {
                  event: 'payment.pending',
                  timestamp: '2024-01-15T10:35:00Z',
                  data: {
                    transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    link_id: 'link_xyz789',
                    status: 'pending',
                    amount: 199.99,
                    currency: 'USD',
                    crypto_amount: 0.00456789,
                    crypto_currency: 'BTC',
                    tx_hash: '7a91f8b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
                    confirmations: 0,
                    confirmations_required: 3,
                    detected_at: '2024-01-15T10:35:00Z'
                  }
                }
              },
              'payment.confirming': {
                summary: '🔄 Payment Confirming',
                description: 'Sent as blockchain confirmations progress',
                value: {
                  event: 'payment.confirming',
                  timestamp: '2024-01-15T10:40:00Z',
                  data: {
                    transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    link_id: 'link_xyz789',
                    status: 'confirming',
                    amount: 199.99,
                    currency: 'USD',
                    crypto_amount: 0.00456789,
                    crypto_currency: 'BTC',
                    tx_hash: '7a91f8b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
                    confirmations: 2,
                    confirmations_required: 3
                  }
                }
              },
              'payment.partial': {
                summary: '⚠️ Partial Payment Received',
                description: 'Sent when customer sends less than required amount',
                value: {
                  event: 'payment.partial',
                  timestamp: '2024-01-15T10:38:00Z',
                  data: {
                    transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    link_id: 'link_xyz789',
                    status: 'partial',
                    expected_amount: 199.99,
                    received_amount: 150.00,
                    remaining_amount: 49.99,
                    currency: 'USD',
                    crypto_expected: 0.00456789,
                    crypto_received: 0.00342592,
                    crypto_currency: 'BTC',
                    tx_hash: '7a91f8b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
                    grace_period_ends: '2024-01-15T11:08:00Z',
                    deposit_address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
                  }
                }
              },
              'payment.expired': {
                summary: '⏰ Payment Link Expired',
                description: 'Sent when payment link expires without payment',
                value: {
                  event: 'payment.expired',
                  timestamp: '2024-01-16T10:30:00Z',
                  data: {
                    transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    link_id: 'link_xyz789',
                    status: 'expired',
                    amount: 199.99,
                    currency: 'USD',
                    created_at: '2024-01-15T10:30:00Z',
                    expired_at: '2024-01-16T10:30:00Z',
                    metadata: {
                      order_id: '12345'
                    }
                  }
                }
              },
              'payment.failed': {
                summary: '❌ Payment Failed',
                description: 'Sent when payment fails (card declined, etc.)',
                value: {
                  event: 'payment.failed',
                  timestamp: '2024-01-15T10:36:00Z',
                  data: {
                    transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    link_id: 'link_xyz789',
                    status: 'failed',
                    amount: 199.99,
                    currency: 'USD',
                    payment_method: 'CARD',
                    failure_reason: 'Card declined - insufficient funds',
                    failure_code: 'INSUFFICIENT_FUNDS',
                    metadata: {
                      order_id: '12345'
                    }
                  }
                }
              },
              'payment.refunded': {
                summary: '💸 Payment Refunded',
                description: 'Sent when a payment is refunded',
                value: {
                  event: 'payment.refunded',
                  timestamp: '2024-01-20T14:00:00Z',
                  data: {
                    transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    link_id: 'link_xyz789',
                    status: 'refunded',
                    original_amount: 199.99,
                    refunded_amount: 199.99,
                    currency: 'USD',
                    refund_reason: 'Customer request',
                    original_payment_date: '2024-01-15T10:45:00Z',
                    refunded_at: '2024-01-20T14:00:00Z'
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Your server should return HTTP 200 to acknowledge receipt',
          content: {
            'application/json': {
              example: {
                received: true
              }
            }
          }
        }
      }
    }
  },
  
  '/api/crypto-webhook': {
    post: {
      tags: ['Webhooks'],
      summary: 'Blockchain webhook (Internal)',
      description: `**Internal endpoint** - receives blockchain transaction notifications.

### Multi-Tenant Routing

This endpoint uses multi-tenant routing for payment processing. When a crypto address is reserved for a payment, the subscription URL is dynamically updated to include tenant information as query parameters.

**Webhook URL Format:**
\`\`\`
/api/crypto-webhook?company_id={companyId}&user_id={userId}&address_id={addressId}
\`\`\`

### How it Works:
1. When \`reserveAddressFromPool\` is called, it updates the subscription URL with company info
2. When a deposit is detected, the blockchain provider calls this endpoint with the encoded parameters
3. The webhook handler extracts \`company_id\`, \`user_id\`, \`address_id\` from query params
4. Payment is processed and routed to the correct merchant/company

### Benefits:
- ✅ Multi-tenant routing without per-company backends
- ✅ Tenant info encoded directly in webhook URL
- ✅ Subscription URL updated synchronously when address is reserved
- ✅ Fallback to Redis data if query params missing`,
      parameters: [
        {
          in: 'query',
          name: 'company_id',
          schema: { type: 'integer' },
          description: 'Company/merchant ID for multi-tenant routing',
          example: 38
        },
        {
          in: 'query',
          name: 'user_id',
          schema: { type: 'integer' },
          description: 'User ID (merchant owner)',
          example: 28
        },
        {
          in: 'query',
          name: 'address_id',
          schema: { type: 'integer' },
          description: 'Pool address ID (temp_address_id)',
          example: 5
        }
      ],
      requestBody: {
        description: 'Blockchain ADDRESS_EVENT webhook payload',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                subscriptionType: { type: 'string', description: 'Always ADDRESS_EVENT' },
                address: { type: 'string', description: 'Crypto address that received deposit' },
                counterAddress: { type: 'string', description: 'Sender address' },
                txId: { type: 'string', description: 'Blockchain transaction hash' },
                amount: { type: 'string', description: 'Amount received' },
                asset: { type: 'string', description: 'Asset/currency (ETH, BTC, etc.)' },
                blockNumber: { type: 'integer', description: 'Block number of transaction' }
              },
              required: ['address', 'txId', 'amount']
            },
            examples: {
              'BTC Deposit': {
                summary: 'Bitcoin deposit detected',
                value: {
                  subscriptionType: 'ADDRESS_EVENT',
                  address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
                  txId: '7a91f8b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
                  amount: '0.00456789',
                  asset: 'BTC',
                  blockNumber: 823456
                }
              },
              'ETH Deposit': {
                summary: 'Ethereum deposit detected',
                value: {
                  subscriptionType: 'ADDRESS_EVENT',
                  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE4E',
                  counterAddress: '0xSenderAddress123...',
                  txId: '0xabc123def456789...',
                  amount: '0.085',
                  asset: 'ETH',
                  blockNumber: 19234567
                }
              },
              'USDT-TRC20 Deposit': {
                summary: 'USDT (Tron) deposit detected',
                value: {
                  subscriptionType: 'ADDRESS_EVENT',
                  address: 'TN7cWz1s5p5XKT8KJhKjZ8EWPH4v8hGhqN',
                  txId: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
                  amount: '199.99',
                  asset: 'USDT',
                  blockNumber: 58234567
                }
              }
            }
          }
        }
      },
      responses: {
        200: { 
          description: 'Webhook processed successfully',
          content: {
            'text/plain': {
              example: 'OK'
            }
          }
        }
      }
    }
  },
  '/api/pay/getCurrencyRatesInternal': {
    post: {
      tags: ['Payment Processing'],
      summary: 'Get internal currency rates',
      description: 'Internal endpoint for service-to-service rate queries',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                currencies: { type: 'array', items: { type: 'string' } }
              }
            },
            example: { currencies: ['BTC', 'ETH', 'USDT'] }
          }
        }
      },
      responses: {
        200: { description: 'Internal rates retrieved' }
      }
    }
  },
  '/api/pay/authStep': {
    post: {
      tags: ['Payment Processing'],
      summary: '3D Secure authentication',
      description: 'Handle 3D Secure authentication step for card payments',
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
            },
            example: {
              transaction_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              otp: '123456'
            }
          }
        }
      },
      responses: {
        200: { description: 'Authentication successful' },
        400: { description: 'Invalid OTP' }
      }
    }
  },

  // ==================== FEE PREVIEW ====================
  '/api/pay/fee-preview': {
    get: {
      tags: ['Payments'],
      summary: 'Get fee preview with referral discount',
      description: `Preview transaction fees with the user's referral discount applied.

**Use Cases:**
- Show users their discounted fees before creating payment links
- Display savings from referral discounts
- Help users understand their fee structure

**Discount Sources:**
- \`referee_code\` - From payment link email (50% off for 90 days)
- \`user_referral_referee\` - From user referral code (50% off for 30 days)
- \`user_referral_referrer\` - Reward for successful referral (50% off for 30 days)
- \`referrer_reward\` - Reward when customer signs up (10% off for 30 days)`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'amount',
          required: true,
          schema: { type: 'number', minimum: 1 },
          description: 'Transaction amount to calculate fees for',
          example: 1000
        },
        {
          in: 'query',
          name: 'currency',
          schema: { type: 'string', default: 'USD' },
          description: 'Currency code',
          example: 'USD'
        }
      ],
      responses: {
        200: {
          description: 'Fee preview retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Fee preview retrieved successfully' },
                  data: {
                    type: 'object',
                    properties: {
                      amount: { type: 'number', example: 1000 },
                      currency: { type: 'string', example: 'USD' },
                      fee_info: {
                        type: 'object',
                        properties: {
                          base_fee_percent: { type: 'number', example: 2, description: 'Standard fee percentage before discount' },
                          final_fee_percent: { type: 'number', example: 1, description: 'Fee percentage after discount applied' },
                          base_fee_amount: { type: 'number', example: 20, description: 'Fee amount before discount' },
                          discounted_fee_amount: { type: 'number', example: 10, description: 'Fee amount after discount' },
                          savings: { type: 'number', example: 10, description: 'Amount saved due to discount' },
                          you_receive: { type: 'number', example: 990, description: 'Net amount after fees' }
                        }
                      },
                      discount_info: {
                        type: 'object',
                        properties: {
                          has_discount: { type: 'boolean', example: true },
                          discount_percent: { type: 'number', example: 50 },
                          discount_reason: { 
                            type: 'string', 
                            enum: ['referee_code', 'user_referral_referee', 'user_referral_referrer', 'referrer_reward', 'promo'],
                            example: 'referee_code' 
                          },
                          expires_at: { type: 'string', format: 'date-time', example: '2026-04-01T00:00:00.000Z' },
                          days_remaining: { type: 'integer', example: 45 }
                        }
                      }
                    }
                  }
                }
              },
              examples: {
                'With 50% Discount': {
                  summary: 'User with active referral discount',
                  value: {
                    message: 'Fee preview retrieved successfully',
                    data: {
                      amount: 1000,
                      currency: 'USD',
                      fee_info: {
                        base_fee_percent: 2,
                        final_fee_percent: 1,
                        base_fee_amount: 20,
                        discounted_fee_amount: 10,
                        savings: 10,
                        you_receive: 990
                      },
                      discount_info: {
                        has_discount: true,
                        discount_percent: 50,
                        discount_reason: 'referee_code',
                        expires_at: '2026-04-01T00:00:00.000Z',
                        days_remaining: 45
                      }
                    }
                  }
                },
                'No Discount': {
                  summary: 'User without active discount',
                  value: {
                    message: 'Fee preview retrieved successfully',
                    data: {
                      amount: 1000,
                      currency: 'USD',
                      fee_info: {
                        base_fee_percent: 2,
                        final_fee_percent: 2,
                        base_fee_amount: 20,
                        discounted_fee_amount: 20,
                        savings: 0,
                        you_receive: 980
                      },
                      discount_info: {
                        has_discount: false,
                        discount_percent: 0,
                        discount_reason: null,
                        expires_at: null,
                        days_remaining: 0
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid amount' },
        401: { description: 'Unauthorized' }
      }
    }
  },

  // ==================== CHECKOUT UTILITIES ====================
  '/api/pay/configured-currencies': {
    get: {
      tags: ['Payment Processing'],
      summary: 'Get configured currencies for checkout',
      description: `Returns the list of cryptocurrencies configured by the merchant for accepting payments.
      
**Use Case:** Called by checkout page to show only the payment methods the merchant has set up.

**Response includes:**
- \`configured_currencies\` - Array of currency codes (e.g., ["BTC", "ETH", "USDT-TRC20"])
- \`skip_selection\` - If true and only one currency configured, auto-select it

**Note:** Requires customer token from getData response (not merchant JWT token).`,
      parameters: [],
      responses: {
        200: {
          description: 'Configured currencies retrieved',
          content: {
            'application/json': {
              examples: {
                'Multiple Currencies': {
                  summary: 'Merchant with multiple crypto options',
                  value: {
                    message: 'Configured currencies retrieved successfully',
                    data: {
                      configured_currencies: ['BTC', 'ETH', 'USDT-TRC20', 'USDT-ERC20', 'LTC', 'TRX'],
                      skip_selection: false,
                      fee_info: {
                        fee_payer: 'company',
                        transaction_fee_percent: 2.0
                      }
                    }
                  }
                },
                'Single Currency (Auto-select)': {
                  summary: 'Merchant with only one crypto option',
                  value: {
                    message: 'Configured currencies retrieved successfully',
                    data: {
                      configured_currencies: ['USDT-TRC20'],
                      skip_selection: true,
                      fee_info: {
                        fee_payer: 'company',
                        transaction_fee_percent: 2.0
                      }
                    }
                  }
                },
                'No Currencies Configured': {
                  summary: 'Merchant has not configured any crypto wallets',
                  value: {
                    message: 'Configured currencies retrieved successfully',
                    data: {
                      configured_currencies: [],
                      skip_selection: false,
                      fee_info: {
                        fee_payer: 'company',
                        transaction_fee_percent: 2.0
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: { 
          description: 'Invalid customer session',
          content: {
            'application/json': {
              example: { message: 'Invalid customer session', error: true }
            }
          }
        },
        401: { description: 'Unauthorized - Invalid or missing customer token' }
      }
    }
  }
};
