-- Persist majority-computed secondary curation values on finalized memes.
-- Existing tags/category continue to mirror topics for the public taxonomy contract.
ALTER TABLE memes ADD COLUMN duplicate_of TEXT;
ALTER TABLE memes ADD COLUMN topics TEXT NOT NULL DEFAULT '[]';
ALTER TABLE memes ADD COLUMN tone TEXT;
ALTER TABLE memes ADD COLUMN humour_mechanisms TEXT NOT NULL DEFAULT '[]';
