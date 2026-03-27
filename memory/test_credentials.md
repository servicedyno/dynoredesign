# Test Credentials

## Admin
- Email: Check tbl_admin in database
- Password: Existing admin passwords (SHA-256 hashed) will be transparently migrated to bcrypt on next login

## Notes
- Admin passwords have been migrated from SHA-256 to bcrypt with transparent migration
- On first login after migration, the password is verified against SHA-256 hash, then re-hashed with bcrypt
- All new password changes use bcrypt (12 rounds)
- JWT tokens now expire after 30 days (previously 365 days)
