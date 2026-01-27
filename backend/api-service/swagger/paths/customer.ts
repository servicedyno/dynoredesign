export const customerPaths = {
  "/user/createUser": {
    post: {
      tags: ["Customer"],
      summary: "Create a new customer",
      description: `
Registers a new customer account under your merchant company.

**Important:** This endpoint only requires the API key (x-api-key), not a customer token.

The response includes a JWT token that should be used for all subsequent customer-specific requests.

### Use Case
Call this endpoint when a new user signs up on your platform and you want to track their payments.
      `,
      security: [{ ApiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateCustomerRequest" },
            examples: {
              basic: {
                summary: "Basic customer registration",
                value: {
                  name: "John Doe",
                  email: "john@example.com",
                  mobile: "+1234567890",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Customer created successfully",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateCustomerResponse" },
              example: {
                message: "Registered Successful!",
                data: {
                  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                  customer_id: "c94f6d0e-6733-4920-8569-1de0ca1e8d1f",
                },
              },
            },
          },
        },
        "400": {
          description: "Validation error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ValidationError" },
            },
          },
        },
        "403": {
          description: "Invalid API key",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                message: "Invalid API key",
                statusCode: 403,
              },
            },
          },
        },
        "503": {
          description: "Customer already exists",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                message: "Account Already Exists!!!",
                statusCode: 503,
              },
            },
          },
        },
      },
    },
  },
};
