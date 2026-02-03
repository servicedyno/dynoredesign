#!/usr/bin/env python3
"""
Phase 11: Fix absolutely final remaining instances (excluding Joi library requirements)
"""

import re
from pathlib import Path

def fix_absolute_final(filepath):
    """Fix final remaining fixable instances"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Sequelize query array results
        content = re.sub(
            r'\)\s+as\s+any\[\];',
            ') as Array<Record<string, unknown>>;',
            content
        )
        
        # Details arrays
        content = re.sub(
            r'details:\s*\[\]\s+as\s+any\[\],',
            'details: [] as Array<Record<string, unknown>>,',
            content
        )
        
        # Company name access
        content = re.sub(
            r'companyName\s*=\s*\(company\s+as\s+any\)\.company_name',
            'companyName = (company as { company_name?: string }).company_name',
            content
        )
        
        # Count/total access
        content = re.sub(
            r'\(countData\[0\]\s+as\s+any\)\?\.total',
            '(countData[0] as Record<string, unknown> | undefined)?.total as number',
            content
        )
        
        # Payment response fields
        content = re.sub(
            r'temp_id:\s*\(paymentRes\s+as\s+any\)\.temp_id',
            'temp_id: (paymentRes as { temp_id?: string }).temp_id',
            content
        )
        
        # Send amount declaration
        content = re.sub(
            r'sendAmount:\s*any\s*=',
            'sendAmount: number =',
            content
        )
        
        # Referral code access
        content = re.sub(
            r'let\s+referralCode\s*=\s*\(user\s+as\s+any\)\.referral_code',
            'let referralCode = (user as { referral_code?: string }).referral_code',
            content
        )
        
        # User property access patterns
        content = re.sub(
            r'\(user\s+as\s+any\)\.(\w+)',
            r'(user as Record<string, unknown>).\1',
            content
        )
        content = re.sub(
            r'\(referrer\s+as\s+any\)\.(\w+)',
            r'(referrer as Record<string, unknown>).\1',
            content
        )
        
        # JWT decode
        content = re.sub(
            r'jwt\.decode\(token\)\s+as\s+any',
            'jwt.decode(token) as { user_id?: number; email?: string; [key: string]: unknown }',
            content
        )
        
        # Payment link property access
        content = re.sub(
            r'\(paymentLink\s+as\s+any\)\.(\w+)',
            r'(paymentLink as Record<string, unknown>).\1',
            content
        )
        
        # Current address property
        content = re.sub(
            r'adminTxId:\s*\(currentAddress\s+as\s+any\)\.adminTxId',
            'adminTxId: (currentAddress as { adminTxId?: string }).adminTxId',
            content
        )
        
        # Error constructor
        content = re.sub(
            r'new\s+Error\(e\s+as\s+any\)',
            'new Error(String(e))',
            content
        )
        
        # Tatum SDK casts
        content = re.sub(
            r'\}\s+as\s+any,',
            '} as Record<string, unknown>,',
            content
        )
        
        # Tatum API return type
        content = re.sub(
            r':\s*Promise<any\[\]>',
            ': Promise<Array<Record<string, unknown>>>',
            content
        )
        
        # Transaction data arrays
        content = re.sub(
            r'for\s*\(const\s+tx\s+of\s+\(txData\s+as\s+any\[\]\)',
            'for (const tx of (txData as Array<Record<string, unknown>>)',
            content
        )
        content = re.sub(
            r'for\s*\(const\s+tx\s+of\s+\(result\s+as\s+any\)\?\.transactions',
            'for (const tx of (result as { transactions?: Array<Record<string, unknown>> })?.transactions',
            content
        )
        
        # Tatum SDK eth methods
        content = re.sub(
            r'\(tatumSdk\.blockchain\.eth\s+as\s+any\)',
            '(tatumSdk.blockchain.eth as unknown as { ethGetAccountTransactions?: (address: string) => Promise<unknown>; ethGetBlockNumber?: () => Promise<number> })',
            content
        )
        
        # HTX API signature
        content = re.sub(
            r'data:\s*Record<string,\s*any>\)',
            'data: Record<string, unknown>)',
            content
        )
        
        # Middleware JWT verify
        content = re.sub(
            r'jwt\.verify\(token,\s*tokenSecret\)\s+as\s+any',
            'jwt.verify(token, tokenSecret) as { user_id?: number; customer_id?: string; email?: string; [key: string]: unknown }',
            content
        )
        
        # Association checks (these check if associations are set up)
        content = re.sub(
            r'if\s*\(\!\(\w+\s+as\s+any\)\.associations',
            lambda m: m.group(0).replace(' as any', ' as unknown as { associations?: Record<string, unknown> }'),
            content
        )
        
        # Result casting to object for iteration
        content = re.sub(
            r'\}\s+as\s+any\);',
            '} as Record<string, unknown>);',
            content
        )
        
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
    
    # All remaining files
    target_files = [
        'middleware/customerAuthMiddleware.ts',
        'utils/cronJobs.ts',
        'apis/tatumApi.ts',
        'apis/htxApi.ts',
        'controller/knowledgeBaseController.ts',
        'controller/walletController.ts',
        'controller/referralController.ts',
        'controller/paymentController.ts',
        'controller/userController.ts',
    ]
    
    print("="*80)
    print("  Phase 11: Final Absolute Fixes (Excluding Joi Library Types)")
    print("="*80)
    print()
    
    fixed_count = 0
    
    for file_path in target_files:
        full_path = backend_dir / file_path
        if full_path.exists():
            if fix_absolute_final(full_path):
                print(f"✓ {file_path}")
                fixed_count += 1
    
    print()
    print(f"✅ Fixed {fixed_count} files")

if __name__ == "__main__":
    main()
