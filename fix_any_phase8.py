#!/usr/bin/env python3
"""
Phase 8: Fix ALL remaining 'any' types to achieve 100% completion
"""

import re
from pathlib import Path

def fix_all_remaining(filepath):
    """Fix all remaining any types"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Swagger/OpenAPI specific - these are API documentation
        content = re.sub(r'additionalProperties:\s*any', 'additionalProperties: unknown', content)
        content = re.sub(r'properties:\s*any', 'properties: Record<string, unknown>', content)
        content = re.sub(r'schema:\s*any', 'schema: Record<string, unknown>', content)
        
        # Scripts - function parameters
        content = re.sub(r'async\s+function\s+\w+\([^)]*:\s*any\)', lambda m: m.group(0).replace(': any', ': unknown'), content)
        content = re.sub(r'function\s+\w+\([^)]*:\s*any\)', lambda m: m.group(0).replace(': any', ': unknown'), content)
        content = re.sub(r'const\s+\w+\s*=\s*\([^)]*:\s*any\)', lambda m: m.group(0).replace(': any', ': unknown'), content)
        
        # Variable declarations
        content = re.sub(r'let\s+(\w+):\s*any\s*;', r'let \1: unknown;', content)
        content = re.sub(r'let\s+(\w+):\s*any\s*=', r'let \1: unknown =', content)
        content = re.sub(r'const\s+(\w+):\s*any\s*=', r'const \1: unknown =', content)
        
        # Array types
        content = re.sub(r':\s*any\[\]', ': Array<unknown>', content)
        content = re.sub(r'Array<any>', 'Array<unknown>', content)
        
        # Function returns
        content = re.sub(r':\s*Promise<any>', ': Promise<unknown>', content)
        content = re.sub(r':\s*any\s*=>', ': unknown =>', content)
        
        # Model associations and types
        content = re.sub(r'type:\s*any,', 'type: unknown,', content)
        content = re.sub(r'defaultValue:\s*any', 'defaultValue: unknown', content)
        
        # Service/webhook handlers
        content = re.sub(r'data:\s*any', 'data: unknown', content)
        content = re.sub(r'payload:\s*any', 'payload: unknown', content)
        content = re.sub(r'params:\s*any', 'params: Record<string, unknown>', content)
        content = re.sub(r'options:\s*any', 'options: Record<string, unknown>', content)
        content = re.sub(r'config:\s*any', 'config: Record<string, unknown>', content)
        content = re.sub(r'settings:\s*any', 'settings: Record<string, unknown>', content)
        
        # Email/notification data
        content = re.sub(r'emailData:\s*any', 'emailData: Record<string, unknown>', content)
        content = re.sub(r'templateData:\s*any', 'templateData: Record<string, unknown>', content)
        
        # Database query results  
        content = re.sub(r'result:\s*any', 'result: unknown', content)
        content = re.sub(r'results:\s*any', 'results: unknown', content)
        content = re.sub(r'row:\s*any', 'row: Record<string, unknown>', content)
        content = re.sub(r'rows:\s*any', 'rows: Array<Record<string, unknown>>', content)
        
        # Server/route handlers
        content = re.sub(r'\(err:\s*any\)', '(err: unknown)', content)
        content = re.sub(r'\(error:\s*any\)', '(error: unknown)', content)
        
        # Map/filter/reduce functions
        content = re.sub(r'\.map\(\(\w+:\s*any\)', lambda m: m.group(0).replace(': any', ': unknown'), content)
        content = re.sub(r'\.filter\(\(\w+:\s*any\)', lambda m: m.group(0).replace(': any', ': unknown'), content)
        content = re.sub(r'\.reduce\(\(\w+:\s*any', lambda m: m.group(0).replace(': any', ': unknown'), content)
        content = re.sub(r'\.forEach\(\(\w+:\s*any\)', lambda m: m.group(0).replace(': any', ': unknown'), content)
        
        # Generic object parameters
        content = re.sub(r'\(obj:\s*any\)', '(obj: Record<string, unknown>)', content)
        content = re.sub(r'\(object:\s*any\)', '(object: Record<string, unknown>)', content)
        content = re.sub(r'\(item:\s*any\)', '(item: unknown)', content)
        content = re.sub(r'\(value:\s*any\)', '(value: unknown)', content)
        
        # Remaining catch blocks (in scripts)
        content = re.sub(r'catch\s*\((\w+):\s*any\)', r'catch (\1: unknown)', content)
        
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
    
    # Get all TypeScript files
    all_ts_files = list(backend_dir.glob('**/*.ts'))
    
    print("="*80)
    print("  Phase 8: Fixing ALL Remaining 'any' Types (100% Goal)")
    print("="*80)
    print()
    
    fixed_files = []
    
    for ts_file in all_ts_files:
        if 'node_modules' in str(ts_file) or '.backup' in str(ts_file):
            continue
        
        if fix_all_remaining(ts_file):
            relative_path = ts_file.relative_to(backend_dir)
            fixed_files.append(str(relative_path))
            print(f"✓ {relative_path}")
    
    print()
    print(f"✅ Fixed {len(fixed_files)} files")
    
    if len(fixed_files) > 0:
        print()
        print("Files modified:")
        for f in sorted(fixed_files):
            print(f"  - {f}")

if __name__ == "__main__":
    main()
