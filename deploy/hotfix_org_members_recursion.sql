DROP POLICY IF EXISTS "org_members_select" ON public.org_members;
CREATE POLICY "org_members_select" ON public.org_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
  );
