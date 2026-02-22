// =====================================================
//  FieldCorrect Web — Organizations API client
// =====================================================

import { supabase } from '@/infra/supabase';

export interface Organization {
    id: string;
    slug: string;
    name: string;
    billing_plan: string;
    role: 'owner' | 'admin' | 'member';
}

export const orgsApi = {
    /** Get all organizations the current user belongs to */
    async getMyOrganizations(): Promise<Organization[]> {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('org_members')
            .select(`
        role,
        organizations ( id, slug, name, billing_plan )
      `)
            .eq('user_id', session.user.id);

        if (error) throw error;

        return (data || []).map((row: any) => ({
            id: row.organizations.id,
            slug: row.organizations.slug,
            name: row.organizations.name,
            billing_plan: row.organizations.billing_plan,
            role: row.role,
        }));
    },

    /** Create a new organization */
    async createOrganization(name: string, slug: string): Promise<Organization> {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('Not authenticated');

        // We generate the UUID on the client side to bypass the PostgREST 'RETURNING' RLS check
        // (Since the user doesn't have SELECT permission on the organization until the org_members row is inserted)
        const orgId = crypto.randomUUID();

        // 1. Insert organization without returning it
        const { error: orgError } = await supabase
            .from('organizations')
            .insert({ id: orgId, name, slug });

        if (orgError) throw orgError;

        // 2. Add creator as owner
        const { error: memberError } = await supabase
            .from('org_members')
            .insert({
                org_id: orgId,
                user_id: session.user.id,
                role: 'owner',
            });

        if (memberError) throw memberError;

        return {
            id: orgId,
            slug: slug,
            name: name,
            billing_plan: 'free',
            role: 'owner',
        };
    }
};
