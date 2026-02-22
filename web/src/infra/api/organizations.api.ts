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

        // 1. Insert organization
        const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .insert({ name, slug })
            .select()
            .single();

        if (orgError) throw orgError;

        // 2. Add creator as owner
        const { error: memberError } = await supabase
            .from('org_members')
            .insert({
                org_id: orgData.id,
                user_id: session.user.id,
                role: 'owner',
            });

        if (memberError) throw memberError;

        return {
            id: orgData.id,
            slug: orgData.slug,
            name: orgData.name,
            billing_plan: orgData.billing_plan,
            role: 'owner',
        };
    }
};
