-- Run this in Supabase SQL Editor
-- Table stores one refresh token (JTI) per active session per user

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  jti        UUID        NOT NULL UNIQUE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup during token rotation
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_jti     ON refresh_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
