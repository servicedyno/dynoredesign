export const customerPaths = {
  "/user/createUser": {
    post: {
      tags: ["1. Customer"],
      summary: "Create a customer",
      description: "Register a new customer. Returns a token for payment requests.",
      security: [{ ApiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "email"],
              properties: {
                name: { type: "string", example: "John Doe" },
                email: { type: "string", format: "email", example: "john@example.com" },
                mobile: { type: "string", example: "+1234567890" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "✅ Customer created",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", example: "Registered Successful!" },
                  data: {
                    type: "object",
                    properties: {
                      token: { type: "string", description: "Use this for payment requests" },
                      customer_id: { type: "string", format: "uuid" },
                    },
                  },
                },
              },
            },
          },
        },
        "403": {
          description: "❌ Invalid API key",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        "503": {
          description: "❌ Customer already exists",
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
