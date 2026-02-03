#!/usr/bin/env python3
"""
VAT Data Quality Audit
Checks existing database records for VAT/country mismatches
"""

import psycopg2
from datetime import datetime
import os
from dotenv import load_dotenv
from urllib.parse import urlparse

# Load environment variables
load_dotenv('/app/backend/.env')

def get_db_connection():
    """Create database connection from MONGO_URL (which is actually PostgreSQL)"""
    # Parse the connection string from MONGO_URL
    mongo_url = os.getenv('MONGO_URL')
    
    if not mongo_url:
        raise ValueError("MONGO_URL environment variable not set")
    
    # Parse the PostgreSQL connection URL
    # Format: postgresql://user:password@host:port/database
    parsed = urlparse(mongo_url)
    
    return psycopg2.connect(
        host=parsed.hostname,
        database=parsed.path[1:] if parsed.path else os.getenv('DB_NAME'),  # Remove leading /
        user=parsed.username,
        password=parsed.password,
        port=parsed.port or os.getenv('DB_PORT', 5432)
    )

def audit_vat_country_consistency():
    """Audit VAT/country consistency in database"""
    
    print("\n" + "="*80)
    print("  VAT/COUNTRY DATA QUALITY AUDIT")
    print("  " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("="*80 + "\n")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Query 1: Total companies with VAT numbers
        print("📊 OVERVIEW")
        print("-" * 80)
        
        cursor.execute("""
            SELECT COUNT(*) 
            FROM tbl_company 
            WHERE vat_number IS NOT NULL 
            AND vat_number != ''
        """)
        total_with_vat = cursor.fetchone()[0]
        print(f"Total companies with VAT number: {total_with_vat}")
        
        cursor.execute("""
            SELECT COUNT(*) 
            FROM tbl_company 
            WHERE country IS NOT NULL 
            AND country != ''
        """)
        total_with_country = cursor.fetchone()[0]
        print(f"Total companies with country: {total_with_country}")
        
        cursor.execute("""
            SELECT COUNT(*) 
            FROM tbl_company 
            WHERE vat_number IS NOT NULL 
            AND vat_number != ''
            AND country IS NOT NULL 
            AND country != ''
        """)
        total_with_both = cursor.fetchone()[0]
        print(f"Total companies with both VAT and country: {total_with_both}")
        
        # Query 2: Check for mismatches
        print("\n🔍 VAT/COUNTRY CONSISTENCY CHECK")
        print("-" * 80)
        
        cursor.execute("""
            SELECT 
                company_id,
                company_name,
                email,
                country,
                vat_number,
                SUBSTRING(vat_number, 1, 2) as vat_country,
                vat_verified,
                "createdAt"
            FROM tbl_company
            WHERE 
                vat_number IS NOT NULL 
                AND vat_number != ''
                AND country IS NOT NULL
                AND country != ''
                AND UPPER(SUBSTRING(vat_number, 1, 2)) != UPPER(country)
            ORDER BY "createdAt" DESC
        """)
        
        mismatches = cursor.fetchall()
        
        if mismatches:
            print(f"\n⚠️  FOUND {len(mismatches)} MISMATCH(ES):\n")
            
            for i, row in enumerate(mismatches, 1):
                company_id, company_name, email, country, vat_number, vat_country, vat_verified, created_at = row
                
                print(f"{i}. Company ID: {company_id}")
                print(f"   Name: {company_name}")
                print(f"   Email: {email}")
                print(f"   Country: {country}")
                print(f"   VAT Number: {vat_number}")
                print(f"   VAT Country: {vat_country}")
                print(f"   VAT Verified: {vat_verified}")
                print(f"   Created: {created_at}")
                print(f"   ❌ MISMATCH: Country ({country}) ≠ VAT Country ({vat_country})")
                print()
        else:
            print("✅ No mismatches found! All companies have consistent VAT/country data.")
        
        # Query 3: Matching records (for validation)
        cursor.execute("""
            SELECT COUNT(*)
            FROM tbl_company
            WHERE 
                vat_number IS NOT NULL 
                AND vat_number != ''
                AND country IS NOT NULL
                AND country != ''
                AND UPPER(SUBSTRING(vat_number, 1, 2)) = UPPER(country)
        """)
        
        matching = cursor.fetchone()[0]
        
        # Calculate percentages
        if total_with_both > 0:
            match_percentage = (matching / total_with_both) * 100
            mismatch_percentage = (len(mismatches) / total_with_both) * 100
        else:
            match_percentage = 0
            mismatch_percentage = 0
        
        print("\n📈 SUMMARY STATISTICS")
        print("-" * 80)
        print(f"Companies with both VAT & Country: {total_with_both}")
        print(f"  ✅ Matching: {matching} ({match_percentage:.1f}%)")
        print(f"  ❌ Mismatched: {len(mismatches)} ({mismatch_percentage:.1f}%)")
        
        # Query 4: VAT numbers without country
        cursor.execute("""
            SELECT 
                company_id,
                company_name,
                vat_number,
                SUBSTRING(vat_number, 1, 2) as vat_country
            FROM tbl_company
            WHERE 
                vat_number IS NOT NULL 
                AND vat_number != ''
                AND (country IS NULL OR country = '')
        """)
        
        vat_without_country = cursor.fetchall()
        
        if vat_without_country:
            print(f"\n⚠️  COMPANIES WITH VAT BUT NO COUNTRY: {len(vat_without_country)}")
            for row in vat_without_country:
                company_id, company_name, vat_number, vat_country = row
                print(f"  • Company ID {company_id}: {company_name} - VAT: {vat_number} (Country: {vat_country})")
        
        # Query 5: Countries without VAT
        cursor.execute("""
            SELECT COUNT(*)
            FROM tbl_company
            WHERE 
                country IS NOT NULL 
                AND country != ''
                AND (vat_number IS NULL OR vat_number = '')
        """)
        
        country_without_vat = cursor.fetchone()[0]
        print(f"\n✅ Companies with country but no VAT: {country_without_vat} (This is OK)")
        
        # Query 6: Country distribution for companies with VAT
        print("\n🌍 COUNTRY DISTRIBUTION (Companies with VAT)")
        print("-" * 80)
        
        cursor.execute("""
            SELECT 
                country,
                COUNT(*) as count,
                COUNT(CASE WHEN vat_verified = true THEN 1 END) as verified_count
            FROM tbl_company
            WHERE 
                vat_number IS NOT NULL 
                AND vat_number != ''
                AND country IS NOT NULL
                AND country != ''
            GROUP BY country
            ORDER BY count DESC
            LIMIT 10
        """)
        
        country_dist = cursor.fetchall()
        
        if country_dist:
            print(f"{'Country':<10} {'Total':<10} {'Verified':<10}")
            print("-" * 30)
            for country, count, verified in country_dist:
                print(f"{country:<10} {count:<10} {verified:<10}")
        
        # Recommendations
        print("\n💡 RECOMMENDATIONS")
        print("-" * 80)
        
        if len(mismatches) > 0:
            print("⚠️  ACTION REQUIRED:")
            print(f"   • {len(mismatches)} companies have mismatched VAT/country data")
            print("   • Contact these companies to verify and correct their data")
            print("   • Provide grace period before enforcing validation on updates")
            print("   • Consider data migration script to fix obvious errors")
        else:
            print("✅ Data quality is excellent!")
            print("   • All companies have consistent VAT/country data")
            print("   • New validation will prevent future inconsistencies")
        
        if vat_without_country:
            print(f"\n📝 {len(vat_without_country)} companies have VAT but no country:")
            print("   • Could auto-populate country from VAT number")
            print("   • Or request users to complete their profile")
        
        cursor.close()
        conn.close()
        
        print("\n" + "="*80)
        print("  AUDIT COMPLETE")
        print("="*80 + "\n")
        
        return {
            'total_with_vat': total_with_vat,
            'total_with_country': total_with_country,
            'total_with_both': total_with_both,
            'matching': matching,
            'mismatches': len(mismatches),
            'vat_without_country': len(vat_without_country),
            'country_without_vat': country_without_vat
        }
        
    except Exception as e:
        print(f"\n❌ Error during audit: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    result = audit_vat_country_consistency()
    
    if result:
        print("\n📝 Export this report? (Save to file)")
        report_file = f"/app/vat_audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        print(f"Report location: {report_file}")
