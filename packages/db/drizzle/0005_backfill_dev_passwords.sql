-- Backfill password for local dev accounts created before password auth.
UPDATE "users"
SET
  "password_hash" = '$2b$12$9u/jH7yQwmkVKUvxP1oTtuNnMj7GDcBU2YgET1BO8mnONxmG3d32G',
  "updated_at" = now()
WHERE "oidc_sub" LIKE 'dev:%'
  AND "password_hash" IS NULL;
