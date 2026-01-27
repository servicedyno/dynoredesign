export const paymentPaths = {
  "/user/createPayment": {
    post: {
      tags: ["Payment"],
      summary: "Create a payment (redirect to checkout)",
      description: `
Creates a payment and returns a redirect URL to the DynoPay checkout page.

**Requires wallet setup:** At least one crypto wallet must be configured for your company before creating payments.

### Flow
1. Call this endpoint with payment details
2. Redirect customer to the returned URL
3. Customer selects payment method on checkout page
4. Customer completes payment
5. Customer is redirected to your redirect_uri

### When to use
Use this when you want customers to choose their payment method on DynoPay's hosted checkout page.
      `,
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreatePaymentRequest" },
            examples: {
              simple: {
                summary: "Simple payment",
                value: {
                  amount: 50,
                  redirect_uri: "https://yoursite.com/payment/success",
                },
              },
              withMetadata: {
                summary: "Payment with metadata",
                value: {
                  amount: 99.99,
                  redirect_uri: "https://yoursite.com/order/complete",
                  meta_data: {
                    product_name: "Premium Plan",
                    order_id: "ORD-2024-001",
                  },
                  fee_payer: "customer",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Payment created successfully",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePaymentResponse" },
              example: {
                message: "Link Generated!",
                data: {
                  redirect_url: "https://checkout.dynopay.com/pay?d=abc123...",
                  fee_payer: "company",
                  available_currencies: ["BTC", "ETH", "LTC", "USDT-TRC20"],
                },
              },
            },
          },
        },
        "400": {
          description: "No wallet configured",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                message: "No crypto wallet configured. Please add at least one crypto wallet address before creating a payment.",
                statusCode: 400,
              },
            },
          },
        },
        "403": {
          description: "Customer account does not exist",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
    },
  },
  "/user/cryptoPayment": {
    post: {
      tags: ["Payment"],
      summary: "Create direct crypto payment",
      description: `
Creates a crypto payment and returns a wallet address for direct payment.

**Requires wallet setup:** The specified cryptocurrency must be configured for your company.

### Flow
1. Call this endpoint with amount and currency
2. Display the returned address and QR code to customer
3. Customer sends crypto to the address
4. System automatically detects and processes payment
5. Webhook notification sent (if configured)

### When to use
Use this when you want to:
- Build a custom payment UI
- Allow customers to pay directly with a specific cryptocurrency
- Skip the hosted checkout page

### Important
- The \`meta_data.product_name\` field is **required**
- Only currencies with configured wallets are available
      `,
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CryptoPaymentRequest" },
            examples: {
              ethPayment: {
                summary: "ETH Payment",
                value: {
                  amount: 10,
                  currency: "ETH",
                  redirect_uri: "https://yoursite.com/success",
                  meta_data: {
                    product_name: "Digital Download",
                    order_id: "DL-001",
                  },
                  fee_payer: "company",
                },
              },
              btcPayment: {
                summary: "BTC Payment",
                value: {
                  amount: 50,
                  currency: "BTC",
                  meta_data: {
                    product_name: "Service Fee",
                  },
                },
              },
              usdtPayment: {
                summary: "USDT-TRC20 Payment",
                value: {
                  amount: 100,
                  currency: "USDT-TRC20",
                  meta_data: {
                    product_name: "Subscription",
                  },
                  fee_payer: "customer",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Crypto payment address generated",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CryptoPaymentResponse" },
              example: {
                message: "Payment Created!",
                data: {
                  transaction_id: "bfb4269c-309f-44e1-9fbe-549d001a7df4",
                  qr_code: "data:image/png;base64,iVBORw0KGgo...",
                  address: "0x653982c6f563b7a87272abcea1c65d98b09794c7",
                  crypto_amount: 0.0033365,
                },
              },
            },
          },
        },
        "400": {
          description: "Currency not available or validation error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              examples: {
                noWallet: {
                  summary: "No wallet configured",
                  value: {
                    success: false,
                    message: "No crypto wallet configured. Please add at least one crypto wallet address before creating a crypto payment.",
                    statusCode: 400,
                  },
                },
                currencyNotAvailable: {
                  summary: "Currency not available",
                  value: {
                    success: false,
                    message: "BCH is not available for this company. Available currencies: BTC, ETH, LTC, DOGE, TRX, USDT-TRC20, USDT-ERC20",
                    statusCode: 400,
                  },
                },
                missingProductName: {
                  summary: "Missing product name",
                  value: {
                    message: "Please enter proper values!",
                    errors: [
                      {
                        key: "meta_data",
                        error: "\"meta_data\" must contain at least one of [product_name, product]",
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/user/addFunds": {
    post: {
      tags: ["Wallet"],
      summary: "Add funds to customer wallet",
      description: `
Creates a payment link for adding funds to the customer's wallet balance.

### Use Case
Use this when customers want to pre-load their wallet with funds that can be used for future purchases.
      `,
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["amount"],
              properties: {
                amount: { type: "number", description: "Amount to add", example: 100 },
                redirect_uri: { type: "string", format: "uri" },
                fee_payer: { type: "string", enum: ["customer", "company"] },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Fund addition link generated",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePaymentResponse" },
            },
          },
        },
        "400": {
          description: "No wallet configured",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
    },
  },
  "/user/useWallet": {
    post: {
      tags: ["Wallet"],
      summary: "Deduct from customer wallet",
      description: `
Deducts funds from the customer's wallet balance.

### Use Case
Use this when a customer wants to pay using their pre-loaded wallet balance.
      `,
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["amount"],
              properties: {
                amount: { type: "number", description: "Amount to deduct", example: 25 },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Amount deducted successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", example: "amount debited successfully!" },
                  data: {
                    type: "object",
                    properties: {
                      new_balance: { type: "string", example: "75.00" },
                      transaction_id: { type: "string", format: "uuid" },
                    },
                  },
                },
              },
            },
          },
        },
        "500": {
          description: "Insufficient balance",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                message: "Insufficient Balance!",
                statusCode: 500,
              },
            },
          },
        },
      },
    },
  },
  "/getSupportedCurrency": {
    get: {
      tags: ["Payment"],
      summary: "Get supported cryptocurrencies",
      description: "Returns a list of all supported cryptocurrencies for payments.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      responses: {
        "200": {
          description: "List of supported currencies",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SupportedCurrenciesResponse" },
            },
          },
        },
      },
    },
  },
};
