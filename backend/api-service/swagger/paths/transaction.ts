export const transactionPaths = {
  "/user/getBalance": {
    get: {
      tags: ["Wallet"],
      summary: "Get customer wallet balance",
      description: "Returns the current balance in the customer's wallet.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      responses: {
        "200": {
          description: "Balance retrieved successfully",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BalanceResponse" },
              example: {
                message: "Balance Fetched Successfully!",
                data: {
                  amount: "150.00",
                  currency: "USD",
                },
              },
            },
          },
        },
      },
    },
  },
  "/user/getTransactions": {
    get: {
      tags: ["Transaction"],
      summary: "Get customer transactions",
      description: "Returns all transactions for the authenticated customer.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      responses: {
        "200": {
          description: "Transactions retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", example: "Balance Fetched Successfully!" },
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Transaction" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/user/getSingleTransaction/{id}": {
    get: {
      tags: ["Transaction"],
      summary: "Get single transaction details",
      description: "Returns details of a specific transaction.",
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Transaction ID (UUID)",
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": {
          description: "Transaction details retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  data: { $ref: "#/components/schemas/Transaction" },
                },
              },
            },
          },
        },
        "500": {
          description: "Transaction not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                message: "Please provide a valid transaction_id!",
                statusCode: 500,
              },
            },
          },
        },
      },
    },
  },
  "/user/getCryptoTransaction/{address}": {
    get: {
      tags: ["Transaction"],
      summary: "Check crypto payment status",
      description: `
Checks the status of a crypto payment by wallet address.

### Use Case
Poll this endpoint to check if a customer has sent payment to the provided address.

### Response Status
- **pending**: Waiting for payment
- **confirming**: Payment detected, waiting for confirmations
- **successful**: Payment confirmed and processed
- **failed**: Payment failed or expired
      `,
      security: [{ ApiKeyAuth: [], CustomerAuth: [] }],
      parameters: [
        {
          name: "address",
          in: "path",
          required: true,
          description: "The crypto wallet address from cryptoPayment response",
          schema: { type: "string" },
          example: "0x653982c6f563b7a87272abcea1c65d98b09794c7",
        },
      ],
      responses: {
        "200": {
          description: "Transaction status retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  data: {
                    type: "object",
                    properties: {
                      status: { type: "string", enum: ["pending", "confirming", "successful", "failed"] },
                      confirmations: { type: "integer" },
                      required_confirmations: { type: "integer" },
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
          description: "Invalid address",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                message: "please add valid address!",
                statusCode: 500,
              },
            },
          },
        },
      },
    },
  },
};
