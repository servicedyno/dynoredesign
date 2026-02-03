#!/usr/bin/env python3
"""
Phase 3: Comprehensive TypeScript 'any' fixes
Handles all remaining patterns systematically
"""

import re
from pathlib import Path

def fix_remaining_patterns(filepath):
    """Fix remaining any patterns"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Pattern 1: Query result arrays
        content = re.sub(
            r'const\s+(\w+):\s*any\[\]\s*=\s*await\s+sequelize\.query',
            r'const \1: unknown[] = await sequelize.query',
            content
        )
        
        # Pattern 2: Link/data map functions
        content = re.sub(
            r'\.map\(\(link:\s*any\)\s*=>',
            r'.map((link: Record<string, unknown>) =>',
            content
        )
        
        content = re.sub(
            r'\.map\(\((\w+):\s*any\)\s*=>',
            r'.map((\1: Record<string, unknown>) =>',
            content
        )
        
        # Pattern 3: Wallet type maps specifically
        content = re.sub(
            r'\.map\(\(w:\s*any\)\s*=>\s*w\.wallet_type\)',
            r'.map((w: { wallet_type: string }) => w.wallet_type)',
            content
        )
        
        # Pattern 4: Data objects that are clearly records
        content = re.sub(
            r'const\s+(\w+Data):\s*any\s*=',
            r'const \1: Record<string, unknown> =',
            content
        )
        
        content = re.sub(
            r'let\s+(\w+Info):\s*any\s*=',
            r'let \1: Record<string, unknown> | null =',
            content
        )
        
        # Pattern 5: Settings/config objects
        content = re.sub(
            r'let\s+(\w+Settings):\s*any\s*=',
            r'let \1: Record<string, unknown> =',
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
    
    target_files = [
        'controller/paymentController.ts',
        'controller/walletController.ts',
        'controller/referralController.ts',
        'controller/dashboardController.ts',
        'controller/kycController.ts',
        'controller/apiController.ts',
        'controller/userController.ts',
        'controller/companyController.ts',
        'controller/taxController.ts',
        'controller/adminController.ts',
        'controller/knowledgeBaseController.ts',
        'controller/notificationController.ts',
        'controller/invoiceController.ts',
        'controller/subscriptionController.ts',
    ]
    
    print("="*80)
    print("  Phase 3: Comprehensive 'any' Type Fixes")
    print("="*80)
    print()
    
    fixed_count = 0
    
    for file_path in target_files:
        full_path = backend_dir / file_path
        if full_path.exists():
            if fix_remaining_patterns(full_path):
                print(f"✓ Fixed {file_path}")
                fixed_count += 1
    
    print()
    print(f"✅ Fixed {fixed_count} files in Phase 3")

if __name__ == "__main__":
    main()
