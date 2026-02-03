#!/usr/bin/env python3
"""
Phase 7: Clean up type assertions and JWT decodes
"""

import re
from pathlib import Path

def fix_type_assertions(filepath):
    """Fix type assertions"""
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        original_content = content
        
        # Fix JWT decode - define proper type
        content = re.sub(
            r'jwt\.decode\(res\.locals\.token\)\s+as\s+any',
            'jwt.decode(res.locals.token) as { user_id: number; email: string; company_id?: number }',
            content
        )
        
        # Fix count results
        content = re.sub(
            r'\(countResult\s+as\s+any\)\.total',
            '(countResult as unknown as { total: number }).total',
            content
        )
        
        # Fix user fee discount
        content = re.sub(
            r'Number\(\(user\s+as\s+any\)\.fee_discount_percent\)',
            'Number((user as { fee_discount_percent?: number }).fee_discount_percent)',
            content
        )
        content = re.sub(
            r'\(user\s+as\s+any\)\.fee_discount_expires_at',
            '(user as { fee_discount_expires_at?: Date }).fee_discount_expires_at',
            content
        )
        content = re.sub(
            r'\(user\s+as\s+any\)\.fee_discount_reason',
            '(user as { fee_discount_reason?: string }).fee_discount_reason',
            content
        )
        
        # Fix query results that are arrays
        content = re.sub(
            r'\)\s+as\s+any\[\];',
            ') as Array<Record<string, unknown>>;',
            content
        )
        
        # Fix dashboard tuple
        content = re.sub(
            r'\]\)\s+as\s+\[any\[\],\s*any\[\]\];',
            ']) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>];',
            content
        )
        
        # Fix Promise returns
        content = re.sub(
            r':\s+Promise<any>\s+=>\s+\{',
            ': Promise<Record<string, unknown>> => {',
            content
        )
        
        # Fix req user access
        content = re.sub(
            r'\(req\s+as\s+any\)\.user\?\.user_id',
            '(req as { user?: { user_id: number } }).user?.user_id',
            content
        )
        content = re.sub(
            r'\(req\s+as\s+any\)\.user\?\.(\w+)',
            r'(req as { user?: { \1: unknown } }).user?.\1',
            content
        )
        
        # Fix as any in conditionals
        content = re.sub(
            r'\s+as\s+any\);',
            ' as unknown);',
            content
        )
        
        # Fix company name access
        content = re.sub(
            r'\(company\s+as\s+any\)\.company_name',
            '(company as { company_name?: string }).company_name',
            content
        )
        
        # Fix data access
        content = re.sub(
            r'\(data\s+as\s+any\)\.transaction_id',
            '(data as { transaction_id?: string }).transaction_id',
            content
        )
        
        # Fix result access
        content = re.sub(
            r'\(result\s+as\s+any\)\.resData',
            '(result as { resData: unknown }).resData',
            content
        )
        
        # Fix userPayload
        content = re.sub(
            r'userPayload\.id\s+as\s+any',
            'userPayload.id as unknown',
            content
        )
        
        if content != original_content:
            with open(filepath, 'w') as f:
                f.write(content)
            return True
        
        return False
    
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    backend_dir = Path('/app/backend')
    
    target_files = [
        'controller/paymentController.ts',
        'controller/apiController.ts',
        'controller/companyController.ts',
        'controller/dashboardController.ts',
        'controller/invoiceController.ts',
        'controller/knowledgeBaseController.ts',
        'controller/kycController.ts',
        'controller/index.ts',
    ]
    
    print("="*80)
    print("  Phase 7: Clean Type Assertions")
    print("="*80)
    print()
    
    fixed_count = 0
    
    for file_path in target_files:
        full_path = backend_dir / file_path
        if full_path.exists():
            if fix_type_assertions(full_path):
                print(f"✓ {file_path}")
                fixed_count += 1
    
    print()
    print(f"✅ Fixed {fixed_count} files")

if __name__ == "__main__":
    main()
