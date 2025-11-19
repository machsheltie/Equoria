-- Migration: Add Email Verification System
-- Purpose: Add email verification fields and token table for secure email validation
-- Date: 2025-11-19

-- Add email verification fields to users table
ALTER TABLE users
ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN email_verified_at TIMESTAMP;

-- Create email_verification_tokens table
CREATE TABLE email_verification_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,

  CONSTRAINT fk_email_verification_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- Create indexes for efficient lookups
CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
CREATE INDEX idx_email_verification_tokens_email ON email_verification_tokens(email);

-- Create index for users email_verified for efficient filtering
CREATE INDEX idx_users_email_verified ON users(email_verified);

-- Add comment
COMMENT ON TABLE email_verification_tokens IS 'Stores email verification tokens with audit trail for secure email address validation';
