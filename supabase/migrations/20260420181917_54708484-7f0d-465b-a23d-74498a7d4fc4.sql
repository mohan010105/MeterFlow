-- Explicitly deny all user access to webhook_events (server-only table).
-- Service role bypasses RLS, so server code is unaffected.
CREATE POLICY "Deny all user access to webhook_events"
  ON public.webhook_events
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);