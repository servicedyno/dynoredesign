#!/usr/bin/env python3
"""
Automated TypeScript 'any' Type Fixer
Fixes common 'any' type patterns in the DynoPay codebase
"""

import re
import os
import sys
from pathlib import Path

# Map of common 'any' patterns to their proper types
REPLACEMENTS = [
    # Error handling
    (r'catch\s*\(\s*error\s*:\s*any\s*\)', 'catch (error: unknown)'),
    (r'catch\s*\(\s*err\s*:\s*any\s*\)', 'catch (err: unknown)'),
    (r'catch\s*\(\s*e\s*:\s*any\s*\)', 'catch (e: unknown)'),
    
    # Request/Response
    (r'\(req:\s*any,\s*res:\s*any\)', '(req: express.Request, res: express.Response)'),
    (r'\(request:\s*any,\s*response:\s*any\)', '(request: express.Request, response: express.Response)'),
    
    # Database results - require manual review but flag them
    # (r'const\s+(\w+):\s*any\s*=\s*await\s+(\w+)Model\.findOne', r'const \1 = await \2Model.findOne'),
    
    # Type assertions that are safer
    (r'\((\w+)\s+as\s+any\)\.dataValues', r'(\1 as { dataValues: Record<string, unknown> }).dataValues'),
    
    # Where clauses
    (r'const\s+whereClause:\s*any\s*=', 'const whereClause: Record<string, unknown> ='),
    (r'const\s+where:\s*any\s*=', 'const where: Record<string, unknown> ='),
    (r'const\s+whereConditions:\s*any\[\]\s*=', 'const whereConditions: Array<Record<string, unknown>> ='),
    
    # Generic objects
    (r'const\s+(\w+):\s*any\s*=\s*\{', r'const \1: Record<string, unknown> = {'),
    (r'let\s+(\w+):\s*any\s*=\s*\{', r'let \1: Record<string, unknown> = {'),
    (r'let\s+(\w+):\s*any\s*=\s*null', r'let \1: Record<string, unknown> | null = null'),
    (r'const\s+(\w+):\s*any\s*=\s*null', r'const \1: Record<string, unknown> | null = null'),
]

def fix_file(filepath):
    """Fix 'any' types in a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        changes_made = 0
        
        for pattern, replacement in REPLACEMENTS:
            new_content = re.sub(pattern, replacement, content)
            if new_content != content:
                matches = len(re.findall(pattern, content))
                changes_made += matches
                content = new_content
        
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return changes_made
        
        return 0
    
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return 0

def main():
    backend_dir = Path('/app/backend')
    
    # Directories to process (exclude scripts)
    target_dirs = [
        'controller',
        'middleware',
        'utils',
        'helper',
        'routes',
        'models',
        'services',
        'apis',
        'webhooks'
    ]
    
    total_changes = 0
    files_modified = 0
    
    print("="*80)
    print("  Automated TypeScript 'any' Type Fixer")
    print("="*80)
    print()
    
    for dir_name in target_dirs:
        dir_path = backend_dir / dir_name
        if not dir_path.exists():
            continue
        
        print(f"\n📁 Processing {dir_name}/...")
        
        ts_files = list(dir_path.glob('**/*.ts'))
        dir_changes = 0
        dir_files = 0
        
        for ts_file in ts_files:
            if 'node_modules' in str(ts_file) or '.backup' in str(ts_file):
                continue
            
            changes = fix_file(ts_file)
            if changes > 0:
                dir_changes += changes
                dir_files += 1
                print(f"  ✓ {ts_file.name}: {changes} replacements")
        
        if dir_changes > 0:
            print(f"  📊 {dir_name}: {dir_changes} changes in {dir_files} files")
            total_changes += dir_changes
            files_modified += dir_files
    
    print()
    print("="*80)
    print(f"  Summary")
    print("="*80)
    print(f"  Total changes: {total_changes}")
    print(f"  Files modified: {files_modified}")
    print("="*80)
    print()
    
    if total_changes > 0:
        print("✅ Automated fixes complete!")
        print("⚠️  Note: Some 'any' types may require manual review")
        print("   Run TypeScript compiler to check for errors")
    else:
        print("ℹ️  No automated fixes applied")

if __name__ == "__main__":
    main()
