-- Enable Realtime for attendance and leaves tables
-- This ensures that admins and moderators receive real-time updates when employees clock in/out
-- or apply for leaves.

-- Enable Realtime on attendance table
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;

-- Enable Realtime on leaves table
ALTER PUBLICATION supabase_realtime ADD TABLE leaves;

-- Set replica identity to FULL for better change tracking
ALTER TABLE attendance REPLICA IDENTITY FULL;
ALTER TABLE leaves REPLICA IDENTITY FULL;

-- Note: If these tables were already added, the above commands might fail.
-- You can verify with: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
