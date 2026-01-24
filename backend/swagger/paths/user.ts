export const userPaths = {
  '/api/user/registerPhone': {
    post: {
      tags: ['User Management'],
      summary: 'Register with phone number (Step 1)',
      description: 'Initiate phone-based registration by sending SMS OTP',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'mobile', 'password'],
              properties: {
                name: { type: 'string', example: 'John Doe' },
                mobile: { type: 'string', example: '18022100479', description: '10-15 digits, no symbols' },
                password: { type: 'string', example: 'SecurePass123@' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'OTP sent successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'OTP sent to your phone. Please verify to complete registration.' }
                }
              }
            }
          }
        },
        400: { description: 'Invalid phone format or phone already registered' }
      }
    }
  },
  '/api/user/registerPhone/verify': {
    post: {
      tags: ['User Management'],
      summary: 'Complete phone registration (Step 2)',
      description: 'Verify OTP and create user account',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'mobile', 'password', 'otp'],
              properties: {
                name: { type: 'string', example: 'John Doe' },
                mobile: { type: 'string', example: '18022100479' },
                password: { type: 'string', example: 'SecurePass123@' },
                otp: { type: 'string', example: '12345', description: '5-digit OTP code' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Registration successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Registration successful!' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid or expired OTP' }
      }
    }
  },
  '/api/user/checkEmail': {
    get: {
      tags: ['User Management'],
      summary: 'Check email availability',
      description: 'Check if email is already registered',
      parameters: [{
        in: 'query',
        name: 'email',
        required: true,
        schema: { type: 'string' },
        example: 'user@example.com'
      }],
      responses: {
        200: {
          description: 'Email availability status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  available: { type: 'boolean' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/user/generateOTP': {
    post: {
      tags: ['User Management'],
      summary: 'Generate SMS OTP for login',
      description: 'Send OTP to registered phone number',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['mobile'],
              properties: {
                mobile: { type: 'string', example: '18022100479' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'OTP sent successfully' },
        400: { description: 'Mobile number not registered' }
      }
    }
  },
  '/api/user/confirmOTP': {
    post: {
      tags: ['User Management'],
      summary: 'Verify OTP and login',
      description: 'Confirm OTP code and authenticate user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['mobile', 'otp'],
              properties: {
                mobile: { type: 'string', example: '18022100479' },
                otp: { type: 'string', example: '12345' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Invalid or expired OTP' }
      }
    }
  },
  '/api/user/connectSocial': {
    post: {
      tags: ['User Management'],
      summary: 'Social login (Telegram/Generic)',
      description: 'Authenticate with social providers',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['provider', 'id'],
              properties: {
                provider: { type: 'string', example: 'telegram', enum: ['telegram', 'twitter', 'linkedin'] },
                id: { type: 'string', example: '123456789' },
                name: { type: 'string', example: 'John Doe' },
                email: { type: 'string', example: 'john@example.com' },
                photo: { type: 'string', example: 'https://...' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string' }
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
  '/api/user/facebook-signin': {
    post: {
      tags: ['User Management'],
      summary: 'Facebook OAuth login',
      description: 'Authenticate with Facebook access token',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['accessToken'],
              properties: {
                accessToken: { type: 'string', description: 'Facebook access token' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: 'Invalid Facebook token' }
      }
    }
  },
  '/api/user/profile': {
    get: {
      tags: ['User Management'],
      summary: 'Get user profile',
      description: 'Retrieve authenticated user profile',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Profile retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: { $ref: '#/components/schemas/User' }
                }
              }
            }
          }
        },
        401: { description: 'Unauthorized' }
      }
    },
    put: {
      tags: ['User Management'],
      summary: 'Update profile',
      description: 'Update user profile fields (name, mobile, username)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'John Doe' },
                mobile: { type: 'string', example: '18022100479' },
                username: { type: 'string', example: 'johndoe' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Profile updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  data: { $ref: '#/components/schemas/User' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/user/email': {
    put: {
      tags: ['User Management'],
      summary: 'Change email address',
      description: 'Update email with password verification',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['newEmail', 'password'],
              properties: {
                newEmail: { type: 'string', format: 'email', example: 'newemail@example.com' },
                password: { type: 'string', example: 'currentPassword' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Email updated successfully' },
        400: { description: 'Email already in use' },
        401: { description: 'Invalid password' }
      }
    },
    delete: {
      tags: ['User Management'],
      summary: 'Remove email from account',
      description: 'Remove email (requires alternative login method)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['password'],
              properties: {
                password: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Email removed successfully' },
        400: { description: 'Cannot remove - no alternative login method' },
        401: { description: 'Invalid password' }
      }
    }
  },
  '/api/user/phone': {
    put: {
      tags: ['User Management'],
      summary: 'Change phone number',
      description: 'Update phone with password verification and SMS confirmation',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['newPhone', 'password'],
              properties: {
                newPhone: { type: 'string', example: '18022100479' },
                password: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Phone updated successfully' },
        400: { description: 'Phone already in use or invalid format' },
        401: { description: 'Invalid password' }
      }
    },
    delete: {
      tags: ['User Management'],
      summary: 'Remove phone from account',
      description: 'Remove phone (requires alternative login method)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['password'],
              properties: {
                password: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Phone removed successfully' },
        400: { description: 'Cannot remove - no alternative login method' },
        401: { description: 'Invalid password' }
      }
    }
  },
  '/api/user/updateUser': {
    put: {
      tags: ['User Management'],
      summary: 'Update user with image',
      description: 'Update user profile with optional image upload',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                data: { 
                  type: 'string', 
                  description: 'JSON string containing name and email',
                  example: '{"name":"John Doe","email":"john@example.com"}'
                },
                image: { type: 'string', format: 'binary' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'User updated successfully' }
      }
    }
  },
  '/api/user/changePassword': {
    put: {
      tags: ['User Management'],
      summary: 'Change password',
      description: 'Update password with old password verification',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['oldPassword', 'newPassword'],
              properties: {
                oldPassword: { type: 'string' },
                newPassword: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Password updated successfully' },
        500: { description: 'Old password incorrect' }
      }
    }
  },
  '/api/user/account': {
    delete: {
      tags: ['User Management'],
      summary: 'Delete user account',
      description: 'Permanently delete user account with password confirmation',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['password'],
              properties: {
                password: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Account deleted successfully' },
        401: { description: 'Invalid password' }
      }
    }
  }
};
