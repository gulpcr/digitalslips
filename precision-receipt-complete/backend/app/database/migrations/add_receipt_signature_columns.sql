-- Migration: Add Digital Signature columns to receipts table
-- Purpose: SBP Compliance - Non-repudiation for transaction receipts
-- Date: 2026-02-06

-- Add digital signature columns to receipts table
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS digital_signature TEXT,
ADD COLUMN IF NOT EXISTS signature_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS signature_timestamp TIMESTAMP,
ADD COLUMN IF NOT EXISTS signature_algorithm VARCHAR(50) DEFAULT 'RSA-SHA256',
ADD COLUMN IF NOT EXISTS is_signature_valid BOOLEAN;

-- Add comment for documentation
COMMENT ON COLUMN receipts.digital_signature IS 'Base64 encoded RSA digital signature for non-repudiation';
COMMENT ON COLUMN receipts.signature_hash IS 'SHA-256 hash of the signed payload';
COMMENT ON COLUMN receipts.signature_timestamp IS 'Timestamp when the receipt was signed';
COMMENT ON COLUMN receipts.signature_algorithm IS 'Algorithm used for signing (RSA-SHA256)';
COMMENT ON COLUMN receipts.is_signature_valid IS 'Cached result of signature validation';

-- Create index for signature queries
CREATE INDEX IF NOT EXISTS ix_receipts_signature_timestamp ON receipts(signature_timestamp);
CREATE INDEX IF NOT EXISTS ix_receipts_is_signature_valid ON receipts(is_signature_valid);
