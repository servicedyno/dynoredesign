#!/usr/bin/env python3
"""
Phase 5: Fix utils, helpers, and middleware 'any' types
"""

import re
from pathlib import Path

def fix_utils_helpers(filepath):
    """Fix utils and helpers"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Utils specific fixes
        content = re.sub(r'let\s+users:\s*any\[\]', 'let users: Array<Record<string, unknown>>', content)
        content = re.sub(r'export\s+const\s+getClientIP\s*=\s*\(req:\s*any\)', 'export const getClientIP = (req: express.Request)', content)
        content = re.sub(r'headers\?:\s*any\)', 'headers?: Record<string, string>)', content)
        content = re.sub(r'export\s+const\s+getCountryFromRequest\s*=\s*async\s*\(req:\s*any\)', 'export const getCountryFromRequest = async (req: express.Request)', content)
        content = re.sub(r'push:\s*async\s*\(key:\s*string,\s*data:\s*any\)', 'push: async (key: string, data: unknown)', content)
        content = re.sub(r'value:\s*any;', 'value: unknown;', content)
        content = re.sub(r'const\s+setMemoryCache\s*=\s*\(key:\s*string,\s*value:\s*any,', 'const setMemoryCache = (key: string, value: unknown,', content)
        content = re.sub(r'const\s+getMemoryCache\s*=\s*\(key:\s*string\):\s*any\s*\|\s*null', 'const getMemoryCache = (key: string): unknown | null', content)
        content = re.sub(r'const\s+setRedisItem\s*=\s*async\s*\(key:\s*string,\s*value:\s*any\)', 'const setRedisItem = async (key: string, value: unknown)', content)
        content = re.sub(r'const\s+setRedisItemWithTTL\s*=\s*async\s*\(key:\s*string,\s*value:\s*any,', 'const setRedisItemWithTTL = async (key: string, value: unknown,', content)
        
        # Helper specific fixes
        content = re.sub(r'const\s+arraySorting\s*=\s*\(tempData:\s*any\[\],', 'const arraySorting = (tempData: Array<Record<string, unknown>>,', content)
        content = re.sub(r'tempData\.sort\(\(a:\s*any,\s*b:\s*any\)', 'tempData.sort((a: Record<string, unknown>, b: Record<string, unknown>)', content)
        content = re.sub(r'const\s+cached:\s*any\s*=', 'const cached: unknown =', content)
        content = re.sub(r'const\s+encodeDecode\s*=\s*\(encode\s*=\s*true,\s*value:\s*any\)', 'const encodeDecode = (encode = true, value: unknown)', content)
        content = re.sub(r'const\s+encrypt\s*=\s*\(content:\s*any,', 'const encrypt = (content: unknown,', content)
        content = re.sub(r'const\s+getErrorMessage\s*=\s*\(e:\s*any\)', 'const getErrorMessage = (e: unknown)', content)
        content = re.sub(r'data\?:\s*any,', 'data?: unknown,', content)
        
        # Middleware fixes
        content = re.sub(r'res\.send\s*=\s*function\s*\(data:\s*any\)', 'res.send = function (data: unknown)', content)
        
        # Types file fixes
        content = re.sub(r'plan:\s*any;', 'plan: Record<string, unknown>;', content)
        content = re.sub(r'phone_number:\s*any;', 'phone_number: string | null;', content)
        content = re.sub(r'paymentPlan:\s*any;', 'paymentPlan: Record<string, unknown> | null;', content)
        content = re.sub(r'paymentPage:\s*any;', 'paymentPage: Record<string, unknown> | null;', content)
        content = re.sub(r'customertoken:\s*any;', 'customertoken: string | null;', content)
        content = re.sub(r'deletedAt:\s*any;', 'deletedAt: Date | null;', content)
        content = re.sub(r'meta:\s*any;', 'meta: Record<string, unknown> | null;', content)
        
        # Cron errors
        content = re.sub(r'}\s*catch\s*\(codeError:\s*any\)', '} catch (codeError: unknown)', content)
        content = re.sub(r'}\s*catch\s*\(linkError:\s*any\)', '} catch (linkError: unknown)', content)
        
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
        ('utils', backend_dir / 'utils'),
        ('helper', backend_dir / 'helper'),
        ('middleware', backend_dir / 'middleware'),
    ]
    
    print("="*80)
    print("  Phase 5: Fix Utils, Helpers, and Middleware")
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
            
            if fix_utils_helpers(ts_file):
                print(f"  ✓ {ts_file.name}")
                dir_fixed += 1
        
        if dir_fixed > 0:
            print(f"  Fixed {dir_fixed} files in {dir_name}")
            total_fixed += dir_fixed
    
    print()
    print(f"✅ Fixed {total_fixed} files total")

if __name__ == "__main__":
    main()
