#!/usr/bin/env python3
"""
Phase 4: Final cleanup of remaining 'any' types
"""

import re
from pathlib import Path

FINAL_REPLACEMENTS = [
    # Admin controller specific
    (r'sendAmount:\s*any\s*=\s*amount', 'sendAmount: string | number = amount'),
    (r'const\s+\{\s*wallet_id,\s*transaction_id,\s*\.\.\.rest\s*\}:\s*any\s*=', 'const { wallet_id, transaction_id, ...rest }: Record<string, unknown> ='),
    (r'const\s+\{\s*wallet_id,\s*\.\.\.rest\s*\}:\s*any\s*=', 'const { wallet_id, ...rest }: Record<string, unknown> ='),
    (r'\(x:\s*any\)\s*=>\s*x\.wallet_type\s*===', '(x: { wallet_type: string }) => x.wallet_type ==='),
    
    # API controller filters
    (r'\.filter\(\(api:\s*any\)\s*=>\s*api\.environment', '.filter((api: { environment?: string }) => api.environment'),
    (r'const\s+api:\s*any\s*=\s*resData\[0\]', 'const api = resData[0] as Record<string, unknown>'),
    
    # Company controller
    (r'}\s*catch\s*\(apiError:\s*any\)\s*\{', '} catch (apiError: unknown) {'),
    (r'}\s*catch\s*\(webhookError:\s*any\)\s*\{', '} catch (webhookError: unknown) {'),
    
    # Dashboard
    (r'const\s+fillMissingDates\s*=\s*\(data:\s*any\[\],', 'const fillMissingDates = (data: Array<Record<string, unknown>>,'),
    (r'const\s+filledData:\s*any\[\]\s*=\s*\[\]', 'const filledData: Array<Record<string, unknown>> = []'),
    
    # Index (fee config)
    (r'const\s+config:\s*any\s*=\s*await\s+getBlockchainConfig', 'const config = await getBlockchainConfig'),
    (r'\(tier:\s*any\)\s*=>', '(tier: { min: number; max: number | null; fixed: number; buffer: number }) =>'),
    
    # Notification
    (r'data\?:\s*any,', 'data?: Record<string, unknown>,'),
    
    # Subscription
    (r'const\s+sub:\s*any\s*=\s*subscription\[0\]', 'const sub = subscription[0] as Record<string, unknown>'),
    
    # Tax controller errors
    # Already handled by catch unknown pattern
]

def apply_final_fixes(filepath):
    """Apply final cleanup fixes"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        changes = 0
        
        for pattern, replacement in FINAL_REPLACEMENTS:
            new_content = re.sub(pattern, replacement, content)
            if new_content != content:
                matches = len(re.findall(pattern, content))
                changes += matches
                content = new_content
        
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return changes
        
        return 0
    
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return 0

def main():
    backend_dir = Path('/app/backend')
    
    # All controller files
    controller_files = list((backend_dir / 'controller').glob('*.ts'))
    
    print("="*80)
    print("  Phase 4: Final 'any' Type Cleanup")
    print("="*80)
    print()
    
    total_changes = 0
    files_fixed = 0
    
    for filepath in controller_files:
        if 'node_modules' in str(filepath) or '.backup' in str(filepath):
            continue
        
        changes = apply_final_fixes(filepath)
        if changes > 0:
            print(f"✓ {filepath.name}: {changes} fixes")
            total_changes += changes
            files_fixed += 1
    
    print()
    print(f"✅ Applied {total_changes} fixes across {files_fixed} files")

if __name__ == "__main__":
    main()
