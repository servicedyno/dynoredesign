/**
 * Swagger paths for Server-Sent Events (SSE) endpoints.
 * Mounted at /api/events/*
 */
export const eventsPaths = {
  '/api/events/stream': {
    get: {
      tags: ['Real-Time Events'],
      summary: 'SSE event stream',
      description: `Subscribe to real-time Server-Sent Events.

**How it works:**
- Opens a persistent HTTP connection (text/event-stream)
- Server pushes events as they occur (payments, price updates, notifications)
- Connection stays open until client disconnects

**Channels (comma-separated):**
- \`payments\` — Payment status updates (pending, confirmed, failed)
- \`prices\` — Live cryptocurrency price updates
- \`notifications\` — In-app notifications

**Example:**
\`\`\`javascript
const eventSource = new EventSource('/api/events/stream?channels=payments,notifications', {
  headers: { 'Authorization': 'Bearer YOUR_JWT_TOKEN' }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
};
\`\`\`

**Note:** Requires JWT authentication. The connection will be closed if the token expires.`,
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'channels',
          schema: { type: 'string', default: 'payments,notifications' },
          description: 'Comma-separated list of channels to subscribe to',
          example: 'payments,prices,notifications',
        },
      ],
      responses: {
        200: {
          description: 'SSE stream opened',
          content: {
            'text/event-stream': {
              schema: {
                type: 'string',
                description: 'Server-Sent Events stream',
                example: 'data: {"type":"payment.confirmed","payload":{"transaction_id":"TX-123","amount":0.05,"currency":"BTC"}}\n\n',
              },
            },
          },
        },
        401: { description: 'JWT authentication required' },
      },
    },
  },
  '/api/events/stats': {
    get: {
      tags: ['Real-Time Events'],
      summary: 'SSE connection stats',
      description: 'Get statistics about current SSE connections (number of connected clients, channels, etc.).',
      responses: {
        200: {
          description: 'SSE stats retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'SSE stats' },
                  data: {
                    type: 'object',
                    properties: {
                      connected_clients: { type: 'integer', example: 12 },
                      channels: {
                        type: 'object',
                        additionalProperties: { type: 'integer' },
                        example: { payments: 8, prices: 5, notifications: 10 },
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
};
