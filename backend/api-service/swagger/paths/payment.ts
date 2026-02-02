export const paymentPaths = {
  "/api/user/cryptoPayment": {
    post: {
      tags: ["2. Payments"],
      summary: "Create crypto payment",
      description: "Get a crypto address for direct payment. Customer sends crypto to this address.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["amount", "currency"],
              properties: {
                amount: { 
                  type: "number", 
                  description: "Amount in your base currency (e.g., USD)",
                  example: 10 
                },
                currency: { 
                  type: "string", 
                  enum: ["BTC", "ETH", "LTC", "DOGE", "TRX", "BCH", "USDT-TRC20", "USDT-ERC20"],
                  description: "Crypto to receive",
                  example: "ETH" 
                },
                meta_data: {
                  type: "object",
                  description: "Optional metadata for your reference",
                  properties: {
                    product_name: { type: "string", example: "Premium Plan" },
                    order_id: { type: "string", example: "ORD-123" },
                  },
                },
                redirect_uri: { 
                  type: "string", 
                  format: "uri",
                  example: "https://yoursite.com/success" 
                },
                fee_payer: { 
                  type: "string", 
                  enum: ["customer", "company"],
                  default: "company",
                  description: "Who pays network fees"
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "✅ Payment address generated",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", example: "Payment Created!" },
                  data: {
                    type: "object",
                    properties: {
                      transaction_id: { type: "string", format: "uuid" },
                      address: { type: "string", description: "Send crypto here", example: "0x653982c6f563b7a87272abcea1c65d98b09794c7" },
                      crypto_amount: { type: "number", description: "Amount in crypto", example: 0.0033365 },
                      qr_code: { type: "string", description: "Base64 QR code image" },
                    },
                  },
                },
              },
            },
          },
        },
        "400": {
          description: "❌ Currency not available or missing wallet",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              examples: {
                noWallet: {
                  summary: "No wallet configured",
                  value: {
                    success: false,
                    message: "No crypto wallet configured. Please add at least one crypto wallet address.",
                    statusCode: 400,
                  },
                },
                currencyNotAvailable: {
                  summary: "Currency not available",
                  value: {
                    success: false,
                    message: "BCH is not available. Available: BTC, ETH, LTC, DOGE, TRX, USDT-TRC20, USDT-ERC20",
                    statusCode: 400,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/user/createPayment": {
    post: {
      tags: ["2. Payments"],
      summary: "Create checkout link",
      description: "Get a checkout URL. Redirect customer to this page to complete payment.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["amount"],
              properties: {
                amount: { type: "number", example: 50 },
                redirect_uri: { type: "string", format: "uri", example: "https://yoursite.com/success" },
                meta_data: {
                  type: "object",
                  properties: {
                    product_name: { type: "string", example: "Order #123" },
                  },
                },
                fee_payer: { type: "string", enum: ["customer", "company"], default: "company" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "✅ Checkout link generated",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", example: "Link Generated!" },
                  data: {
                    type: "object",
                    properties: {
                      redirect_url: { type: "string", description: "Redirect customer here", example: "https://checkout.dynopay.com/pay?d=abc123" },
                      available_currencies: { type: "array", items: { type: "string" }, example: ["BTC", "ETH", "LTC"] },
                    },
                  },
                },
              },
            },
          },
        },
        "400": {
          description: "❌ No wallet configured",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
  "/getSupportedCurrency": {
    get: {
      tags: ["2. Payments"],
      summary: "List supported currencies",
      description: "Get all supported cryptocurrencies.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      responses: {
        "200": {
          description: "✅ Currency list",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  data: {
                    type: "array",
                    items: { type: "string" },
                    example: ["BTC", "ETH", "LTC", "DOGE", "TRX", "BCH", "USDT-TRC20", "USDT-ERC20"],
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/user/addFunds": {
    post: {
      tags: ["3. Status"],
      summary: "Add funds to wallet",
      description: "Create a link for customer to add funds to their wallet balance.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["amount"],
              properties: {
                amount: { type: "number", example: 100 },
                redirect_uri: { type: "string", format: "uri" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "✅ Link generated",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  data: {
                    type: "object",
                    properties: {
                      redirect_url: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/user/useWallet": {
    post: {
      tags: ["3. Status"],
      summary: "Deduct from wallet",
      description: "Deduct funds from customer's wallet balance.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["amount"],
              properties: {
                amount: { type: "number", example: 25 },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "✅ Amount deducted",
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
                    },
                  },
                },
              },
            },
          },
        },
        "500": {
          description: "❌ Insufficient balance",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
};
