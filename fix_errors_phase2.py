#!/usr/bin/env python3
"""
Phase 2: Fix error handling and type assertions
"""

import re
from pathlib import Path

def fix_error_handling(filepath):
    """Fix error handling to properly type check unknown errors"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Pattern 1: error.message -> getErrorMessage(error)
        content = re.sub(
            r'(\w+)\.message',
            lambda m: f'getErrorMessage({m.group(1)})' if m.group(1) in ['error', 'err', 'e'] else m.group(0),
            content
        )
        
        # Pattern 2: error.response -> check if axios error first
        # Add type guard for axios errors
        axios_error_pattern = r'catch\s*\((\w+):\s*unknown\)\s*\{([^}]*)\1\.response'
        
        def add_axios_check(match):
            var_name = match.group(1)
            body = match.group(2)
            return f'''catch ({var_name}: unknown) {{
    if (axios.isAxiosError({var_name})) {{
      {body}{var_name}.response'''
        
        content = re.sub(axios_error_pattern, add_axios_check, content, flags=re.DOTALL)
        
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
    
    files_to_fix = [
        'controller/paymentController.ts',
        'controller/taxController.ts',
        'apis/tatumApi.ts',
    ]
    
    print("Phase 2: Fixing error handling...")
    print()
    
    for file_path in files_to_fix:
        full_path = backend_dir / file_path
        if full_path.exists():
            if fix_error_handling(full_path):
                print(f"✓ Fixed {file_path}")
    
    print("\n✅ Error handling fixes complete")

if __name__ == "__main__":
    main()
