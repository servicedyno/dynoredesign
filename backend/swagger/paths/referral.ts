export const referralPaths = {
  '/api/referral/my-code': {
    get: {
      tags: ['Referral'],
      summary: 'Get my referral code',
      description: 'Retrieve the authenticated user\'s referral code, stats, and referral link',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Referral code retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Referral code retrieved successfully' },
                  data: {
                    type: 'object',
                    properties: {
                      referral_code: { type: 'string', example: 'DYNO2025USR8A2B3C4D5' },
                      referral_link: { type: 'string', format: 'uri', example: 'https://dynopay.com/signup?ref=DYNO2025USR8A2B3C4D5' },
                      stats: {
                        type: 'object',
                        properties: {
                          total_referrals: { type: 'integer', example: 5 },
                          pending_referrals: { type: 'integer', example: 2 },
                          active_referrals: { type: 'integer', example: 1 },
                          rewarded_referrals: { type: 'integer', example: 2 },
                          total_earnings: { type: 'number', example: 20.00 },
                        },
                      },
                      user: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          email: { type: 'string', format: 'email' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized - Please login' },
        404: { description: 'User not found' },
      },
    },
  },
  '/api/referral/list': {
    get: {
      tags: ['Referral'],
      summary: 'List my referrals',
      description: 'Get a paginated list of users referred by the authenticated user',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', default: 1 },
          description: 'Page number',
        },
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 10 },
          description: 'Items per page',
        },
        {
          in: 'query',
          name: 'status',
          schema: { type: 'string', enum: ['pending', 'active', 'rewarded', 'expired'] },
          description: 'Filter by referral status',
        },
      ],
      responses: {
        200: {
          description: 'Referrals retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      referrals: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Referral' },
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/referral/earnings': {
    get: {
      tags: ['Referral'],
      summary: 'Get referral earnings',
      description: 'Retrieve the authenticated user\'s referral rewards and earnings summary',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Earnings retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      summary: {
                        type: 'object',
                        properties: {
                          total_earnings: { type: 'number', example: 50.00 },
                          pending_earnings: { type: 'number', example: 10.00 },
                          credited_earnings: { type: 'number', example: 30.00 },
                          withdrawn_earnings: { type: 'number', example: 10.00 },
                        },
                      },
                      rewards: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ReferralReward' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/referral/validate': {
    post: {
      tags: ['Referral'],
      summary: 'Validate referral code',
      description: 'Check if a referral code is valid and get info about the referrer',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['referral_code'],
              properties: {
                referral_code: { type: 'string', example: 'DYNO2025USR8A2B3C4D5' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Referral code is valid',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Referral code is valid' },
                  valid: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      referrer_name: { type: 'string' },
                      bonus_info: {
                        type: 'object',
                        properties: {
                          referrer_bonus: { type: 'string', example: '$10 USD' },
                          referee_discount: { type: 'string', example: '50% off fees for 30 days' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Referral code is required' },
        404: { description: 'Invalid referral code' },
      },
    },
  },
  '/api/referral/apply': {
    post: {
      tags: ['Referral'],
      summary: 'Apply referral code',
      description: 'Apply a referral code during signup to link accounts',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['referral_code', 'user_id'],
              properties: {
                referral_code: { type: 'string', example: 'DYNO2025USR8A2B3C4D5' },
                user_id: { type: 'integer', description: 'The ID of the newly registered user' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Referral code applied successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      referral_id: { type: 'integer' },
                      status: { type: 'string', example: 'pending' },
                      bonus_info: {
                        type: 'object',
                        properties: {
                          referrer_bonus: { type: 'string' },
                          referee_discount: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request (missing fields, self-referral, or already applied)',
        },
        404: { description: 'Invalid referral code' },
      },
    },
  },
  '/api/referral/leaderboard': {
    get: {
      tags: ['Referral'],
      summary: 'Get referral leaderboard',
      description: 'Retrieve the top referrers by referral count',
      parameters: [
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 10 },
          description: 'Number of top referrers to return',
        },
      ],
      responses: {
        200: {
          description: 'Leaderboard retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      leaderboard: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            rank: { type: 'integer' },
                            user_id: { type: 'integer' },
                            name: { type: 'string' },
                            referral_count: { type: 'integer' },
                            total_earnings: { type: 'number' },
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
    },
  },
};
