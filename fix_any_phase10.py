#!/usr/bin/env python3
"""
Phase 10: Final push to 100% - fix ALL remaining instances
"""

import re
from pathlib import Path

def fix_final_remaining(filepath):
    """Fix the absolute final remaining any types"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # API service types file - specific model fields
        content = re.sub(r'plan:\s*any;', 'plan: Record<string, unknown> | null;', content)
        content = re.sub(r'phone_number:\s*any;', 'phone_number: string | null;', content)
        content = re.sub(r'paymentPlan:\s*any;', 'paymentPlan: Record<string, unknown> | null;', content)
        content = re.sub(r'paymentPage:\s*any;', 'paymentPage: Record<string, unknown> | null;', content)
        content = re.sub(r'customertoken:\s*any;', 'customertoken: string | null;', content)
        content = re.sub(r'deletedAt:\s*any;', 'deletedAt: Date | null;', content)
        content = re.sub(r'meta:\s*any;', 'meta: Record<string, unknown> | null;', content)
        
        # API service JWT decoding
        content = re.sub(
            r'jwt\.decode\(res\.locals\.token\)\s+as\s+any',
            'jwt.decode(res.locals.token) as { user_id?: number; customer_id?: string; email?: string }',
            content
        )
        
        # JWT verify
        content = re.sub(
            r'jwt\.verify\(token,\s*tokenSecret\)\s+as\s+any',
            'jwt.verify(token, tokenSecret) as { user_id?: number; customer_id?: string; email?: string }',
            content
        )
        
        # API service encryption
        content = re.sub(
            r'const\s+encrypt\s*=\s*\(content:\s*any,',
            'const encrypt = (content: unknown,',
            content
        )
        
        # API service redis
        content = re.sub(
            r'const\s+setRedisItem\s*=\s*async\s*\(key:\s*string,\s*value:\s*any\)',
            'const setRedisItem = async (key: string, value: unknown)',
            content
        )
        
        # API service response helper
        content = re.sub(
            r'data\?:\s*any,',
            'data?: unknown,',
            content
        )
        
        # Referral service property access
        content = re.sub(
            r'const\s+referrerId\s*=\s*\(referrer\s+as\s+any\)\.user_id',
            'const referrerId = (referrer as { user_id: number }).user_id',
            content
        )
        content = re.sub(
            r'const\s+discountPercent\s*=\s*\(user\s+as\s+any\)\.fee_discount_percent',
            'const discountPercent = (user as { fee_discount_percent?: number }).fee_discount_percent',
            content
        )
        content = re.sub(
            r'const\s+expiresAt\s*=\s*\(user\s+as\s+any\)\.fee_discount_expires_at',
            'const expiresAt = (user as { fee_discount_expires_at?: Date }).fee_discount_expires_at',
            content
        )
        content = re.sub(
            r'const\s+reason\s*=\s*\(user\s+as\s+any\)\.fee_discount_reason',
            'const reason = (user as { fee_discount_reason?: string }).fee_discount_reason',
            content
        )
        
        # Script forEach
        content = re.sub(
            r'tables\.forEach\(\(table:\s*any,\s*index:\s*number\)',
            'tables.forEach((table: Record<string, unknown>, index: number)',
            content
        )
        
        # Error handling in api service
        content = re.sub(
            r'new\s+Error\(e\s+as\s+any\)',
            'new Error(String(e))',
            content
        )
        
        # Joi error messages (these are Joi validation messages, not types)
        # Skip these - they're string literals in validation schemas
        
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
    
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    backend_dir = Path('/app/backend')
    
    # Target remaining files
    target_files = [
        'services/referralService.ts',
        'api-service/helper/encryption.ts',
        'api-service/helper/successResponseHelper.ts',
        'api-service/middleware/authMiddleware.ts',
        'api-service/middleware/apiMiddleware.ts',
        'api-service/utils/types.ts',
        'api-service/utils/redisInstance.ts',
        'api-service/controller/index.ts',
        'scripts/migration/sync_database.ts',
    ]
    
    print("="*80)
    print("  Phase 10: Final Push to 100%")
    print("="*80)
    print()
    
    fixed_count = 0
    
    for file_path in target_files:
        full_path = backend_dir / file_path
        if full_path.exists():
            if fix_final_remaining(full_path):
                print(f"✓ {file_path}")
                fixed_count += 1
    
    print()
    print(f"✅ Fixed {fixed_count} files")

if __name__ == "__main__":
    main()
