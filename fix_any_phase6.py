#!/usr/bin/env python3
"""
Phase 6: Fix services and apis 'any' types
"""

import re
from pathlib import Path

def fix_services_apis(filepath):
    """Fix services and APIs"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Services fixes
        content = re.sub(r'}\s*catch\s*\(subError:\s*any\)', '} catch (subError: unknown)', content)
        content = re.sub(r'}\s*catch\s*\(verifyError:\s*any\)', '} catch (verifyError: unknown)', content)
        content = re.sub(r'poolAddress:\s*any,', 'poolAddress: string,', content)
        content = re.sub(r'feeData:\s*any', 'feeData: { fixedFee: number; transactionFee: number; blockchainBuffer: number; totalDeduction: number }', content)
        content = re.sub(r'customerData:\s*any', 'customerData: { name?: string; email?: string; phone?: string; metadata?: Record<string, unknown> }', content)
        content = re.sub(r'details:\s*any\s*\}>', 'details: Record<string, unknown> }>', content)
        
        # Veriff service
        content = re.sub(r'addresses:\s*any\[\];', 'addresses: Array<Record<string, unknown>>;', content)
        content = re.sub(r'comments:\s*any\[\];', 'comments: Array<Record<string, unknown>>;', content)
        content = re.sub(r'private\s+generateSignature\(payload:\s*any\)', 'private generateSignature(payload: unknown)', content)
        content = re.sub(r'verifyWebhookSignature\(payload:\s*any,', 'verifyWebhookSignature(payload: unknown,', content)
        content = re.sub(r'parseWebhookPayload\(payload:\s*any\)', 'parseWebhookPayload(payload: Record<string, unknown>)', content)
        content = re.sub(r'vendorData:\s*any;', 'vendorData: Record<string, unknown>;', content)
        
        # Tatum API fixes
        content = re.sub(r'const\s+allSubscriptions:\s*any\[\]', 'const allSubscriptions: Array<Record<string, unknown>>', content)
        content = re.sub(r'const\s+localAmount:\s*any\s*=', 'const localAmount: number =', content)
        content = re.sub(r'const\s+result:\s*any\s*=\s*await', 'const result = await', content)
        content = re.sub(r'const\s+txData:\s*any\s*=\s*await', 'const txData = await', content)
        content = re.sub(r'const\s+blockInfo:\s*any\s*=\s*await', 'const blockInfo = await', content)
        content = re.sub(r'const\s+verificationResult:\s*any\s*=\s*await', 'const verificationResult = await', content)
        
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
    
    target_dirs = [
        ('services', backend_dir / 'services'),
        ('apis', backend_dir / 'apis'),
    ]
    
    print("="*80)
    print("  Phase 6: Fix Services and APIs")
    print("="*80)
    print()
    
    total_fixed = 0
    
    for dir_name, dir_path in target_dirs:
        if not dir_path.exists():
            continue
        
        print(f"📁 Processing {dir_name}/...")
        dir_fixed = 0
        
        for ts_file in dir_path.glob('*.ts'):
            if 'node_modules' in str(ts_file) or '.backup' in str(ts_file):
                continue
            
            if fix_services_apis(ts_file):
                print(f"  ✓ {ts_file.name}")
                dir_fixed += 1
        
        if dir_fixed > 0:
            print(f"  Fixed {dir_fixed} files in {dir_name}")
            total_fixed += dir_fixed
    
    print()
    print(f"✅ Fixed {total_fixed} files total")

if __name__ == "__main__":
    main()
