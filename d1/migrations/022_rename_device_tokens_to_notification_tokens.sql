-- Migration 022: Align the FCM token table name with the Android notification contract
ALTER TABLE device_tokens RENAME TO notification_tokens;
