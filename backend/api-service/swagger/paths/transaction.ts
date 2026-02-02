export const transactionPaths = {
  "/api/user/getBalance": {
    get: {
      tags: ["3. Status"],
      summary: "Get wallet balance",
      description: "Check customer's current wallet balance.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      responses: {
        "200": {
          description: "✅ Balance retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  data: {
                    type: "object",
                    properties: {
                      amount: { type: "string", example: "150.00" },
                      currency: { type: "string", example: "USD" },
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
  "/api/user/getTransactions": {
    get: {
      tags: ["3. Status"],
      summary: "List transactions",
      description: "Get all transactions for the customer.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      responses: {
        "200": {
          description: "✅ Transactions list",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        payment_mode: { type: "string", enum: ["CRYPTO", "CARD", "WALLET"] },
                        base_amount: { type: "number" },
                        base_currency: { type: "string" },
                        status: { type: "string", enum: ["pending", "successful", "failed"] },
                        createdAt: { type: "string", format: "date-time" },
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
  },
  "/api/user/getSingleTransaction/{id}": {
    get: {
      tags: ["3. Status"],
      summary: "Get transaction details",
      description: "Get details of a specific transaction.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Transaction ID",
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": {
          description: "✅ Transaction details",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  data: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      payment_mode: { type: "string" },
                      base_amount: { type: "number" },
                      base_currency: { type: "string" },
                      paid_amount: { type: "number" },
                      paid_currency: { type: "string" },
                      status: { type: "string" },
                      createdAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
        "500": {
          description: "❌ Transaction not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  },
  "/api/user/getCryptoTransaction/{address}": {
    get: {
      tags: ["3. Status"],
      summary: "Check payment status",
      description: "Check if crypto payment has been received at the given address.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      parameters: [
        {
          name: "address",
          in: "path",
          required: true,
          description: "Crypto address from cryptoPayment response",
          schema: { type: "string" },
          example: "0x653982c6f563b7a87272abcea1c65d98b09794c7",
        },
      ],
      responses: {
        "200": {
          description: "✅ Payment status",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  data: {
                    type: "object",
                    properties: {
                      status: { 
                        type: "string", 
                        enum: ["pending", "confirming", "successful", "failed"],
                        description: "pending = waiting, confirming = received, successful = confirmed"
                      },
                      confirmations: { type: "integer" },
                      amount_received: { type: "number" },
                      transaction_hash: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        "500": {
          description: "❌ Invalid address",
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
