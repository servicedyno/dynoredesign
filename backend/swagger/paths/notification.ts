export const notificationPaths = {
  '/api/notifications': {
    get: {
      tags: ['Notifications'],
      summary: 'Get all notifications',
      description: 'Retrieve paginated list of user notifications',
      security: [{ BearerAuth: [] }],
      parameters: [
        { in: 'query', name: 'company_id', schema: { type: 'integer' } },
        { in: 'query', name: 'type', schema: { type: 'string' } },
        { in: 'query', name: 'is_read', schema: { type: 'boolean' } },
        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
        { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } }
      ],
      responses: {
        200: {
          description: 'Notifications retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      notifications: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Notification' }
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' }
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
  '/api/notifications/types': {
    get: {
      tags: ['Notifications'],
      summary: 'Get notification types',
      description: 'Retrieve all available notification types',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Notification types retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      types: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: { type: 'string' },
                            label: { type: 'string' },
                            description: { type: 'string' }
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
      }
    }
  },
  '/api/notifications/{id}': {
    delete: {
      tags: ['Notifications'],
      summary: 'Delete notification',
      description: 'Delete a specific notification',
      security: [{ BearerAuth: [] }],
      parameters: [{
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Notification ID'
      }],
      responses: {
        200: { description: 'Notification deleted' },
        404: { description: 'Notification not found' }
      }
    }
  },
  '/api/notifications/trigger-weekly-summary': {
    post: {
      tags: ['Notifications'],
      summary: 'Trigger weekly summary',
      description: 'Manually trigger weekly summary notification (testing)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                user_id: { type: 'integer', description: 'Optional: specific user ID' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Weekly summary triggered',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      results: { type: 'object' }
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
  '/api/notifications/trigger-wallet-reminder': {
    post: {
      tags: ['Notifications'],
      summary: 'Trigger wallet reminder',
      description: 'Manually trigger wallet reminder notification (testing)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                user_id: { type: 'integer', description: 'Optional: specific user ID' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Wallet reminder triggered',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      results: { type: 'object' }
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
};
