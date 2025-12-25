-- Enable Realtime for dashboard tables
-- This migration enables Supabase Realtime on tables that need to broadcast changes
-- to all connected clients for real-time dashboard updates

-- Enable Realtime on profiles table
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Enable Realtime on activities table
ALTER PUBLICATION supabase_realtime ADD TABLE activities;

-- Enable Realtime on analytics_metrics table
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_metrics;

-- Set replica identity to FULL for better change tracking
-- This ensures all column values are included in the replication stream
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE activities REPLICA IDENTITY FULL;
ALTER TABLE analytics_metrics REPLICA IDENTITY FULL;

-- Verify the tables are added to the publication
-- You can check this with: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
