export const userPaths = {
  '/api/user/registerUser': {
    post: {
      tags: ['User Management'],
      summary: 'Register with email',
      description: `Create a new user account using email and password.
      
**Features:**
- Creates user profile with default avatar
- Generates unique referral code for the user
- Creates default fiat and crypto wallets
- Sends welcome email
- If referral_code is provided, links accounts for rewards`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'email', 'password'],
              properties: {
                name: { 
                  type: 'string', 
                  description: '✅ REQUIRED: Full name',
                  example: 'John Doe' 
                },
                email: { 
                  type: 'string', 
                  format: 'email',
                  description: '✅ REQUIRED: Email address',
                  example: 'john@example.com' 
                },
                password: { 
                  type: 'string', 
                  minLength: 6,
                  description: '✅ REQUIRED: Password (min 6 characters)',
                  example: 'SecurePass123@' 
                },
                referral_code: { 
                  type: 'string',
                  description: '📝 OPTIONAL: Referral code from another user',
                  example: 'DYNO2025USR8A2B3C4D5'
                }
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
                  message: { type: 'string', example: 'Registered Successful!' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string', description: 'JWT access token (7 days expiry)' },
                      referral_code: { type: 'string', description: 'User\'s unique referral code' },
                      referred_by: { type: 'string', nullable: true, description: 'Referral code used during signup' }
                    }
                  }
                }
              }
            }
          }
        },
        503: { description: 'Account already exists with this email' },
        500: { description: 'Server error' }
      }
    }
  },
  '/api/user/login': {
    post: {
      tags: ['User Management'],
      summary: 'Login with email and password',
      description: `Authenticate user with email and password credentials.
      
**Returns:**
- User profile data
- JWT access token (valid for 7 days)
- Company and wallet information`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { 
                  type: 'string', 
                  format: 'email',
                  description: '✅ REQUIRED: Registered email address',
                  example: 'john@example.com' 
                },
                password: { 
                  type: 'string',
                  description: '✅ REQUIRED: Account password',
                  example: 'SecurePass123@' 
                }
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
                  message: { type: 'string', example: 'Login Successful!' },
                  data: {
                    type: 'object',
                    properties: {
                      userData: { $ref: '#/components/schemas/User' },
                      accessToken: { type: 'string', description: 'JWT access token' }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: 'Email and password are required' },
        401: { description: 'Invalid email or password' },
        500: { description: 'Server error' }
      }
    }
  },
  '/api/user/forgot-password': {
    post: {
      tags: ['User Management'],
      summary: 'Request password reset',
      description: `Send password reset email with secure token link.
      
**Security Notes:**
- Response is always success (doesn't reveal if email exists)
- Reset token valid for 1 hour
- Link sent to registered email address`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: {
                email: { 
                  type: 'string', 
                  format: 'email',
                  description: '✅ REQUIRED: Registered email address',
                  example: 'john@example.com' 
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Reset email sent (if email exists)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'If the email exists, a reset link has been sent' },
                  data: { type: 'object' }
                }
              }
            }
          }
        },
        400: { description: 'Email is required' },
        500: { description: 'Server error' }
      }
    }
  },
  '/api/user/reset-password': {
    post: {
      tags: ['User Management'],
      summary: 'Reset password with token',
      description: `Reset password using the token received via email.
      
**Requirements:**
- Valid reset token (from email link)
- Token not expired (1 hour validity)
- New password minimum 6 characters`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token', 'email', 'newPassword'],
              properties: {
                token: { 
                  type: 'string',
                  description: '✅ REQUIRED: Reset token from email link',
                  example: 'a1b2c3d4e5f6...'
                },
                email: { 
                  type: 'string', 
                  format: 'email',
                  description: '✅ REQUIRED: Email address',
                  example: 'john@example.com' 
                },
                newPassword: { 
                  type: 'string',
                  minLength: 6,
                  description: '✅ REQUIRED: New password (min 6 characters)',
                  example: 'NewSecurePass123@' 
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Password reset successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Password has been reset successfully' },
                  data: { type: 'object' }
                }
              }
            }
          }
        },
        400: { description: 'Invalid or expired reset token' },
        500: { description: 'Server error' }
      }
    }
  },
  '/api/user/google-signin': {
    post: {
      tags: ['User Management'],
      summary: 'Google OAuth login',
      description: `Authenticate or register using Google OAuth.
      
**Accepts either:**
- \`idToken\` - Google ID token from Sign-In
- \`accessToken\` - Google OAuth access token

**Behavior:**
- If user exists: Returns existing user data
- If new user: Creates account and wallets automatically`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                idToken: { 
                  type: 'string',
                  description: '📝 Google ID token (preferred)',
                  example: 'eyJhbGciOiJS...'
                },
                accessToken: { 
                  type: 'string',
                  description: '📝 Google OAuth access token (alternative)',
                  example: 'ya29.a0AfH6SM...'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Login/Registration successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Login Successful!' },
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
        400: { description: 'Google ID token or access token is required' },
        401: { description: 'Invalid Google token' },
        500: { description: 'Server error' }
      }
    }
  },
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
      summary: 'Update user profile',
      description: `Update user profile with optional image upload.
        
**💡 Swagger UI Usage:**
1. Click "Try it out"
2. Fill in the fields you want to update
3. Optionally upload a profile image
4. Click "Execute"`,
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['name', 'email'],
              properties: {
                name: {
                  type: 'string',
                  description: 'User full name (required)',
                  example: 'John Doe'
                },
                email: {
                  type: 'string',
                  format: 'email',
                  description: 'User email address (required)',
                  example: 'john@example.com'
                },
                image: {
                  type: 'string',
                  format: 'binary',
                  description: 'Profile picture (optional, PNG/JPG)'
                }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'User updated successfully' },
        400: { description: 'Invalid input' },
        401: { description: 'Unauthorized' }
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
