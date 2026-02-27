
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface UserProfile {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    avatar_url?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    bank_name?: string;
    account_title?: string;
    iban?: string;
    location?: string;
    cnic_front_url?: string;
    cnic_back_url?: string;
    has_seen_welcome?: boolean;
    payment_email?: string;
}

interface UserContextType {
    profile: UserProfile | null;
    loading: boolean;
    refreshProfile: () => Promise<void>;
    simulatedRole: string | null;
    setSimulatedRole: (role: string | null, previewPermissions?: string[]) => void;
    effectiveRole: string | null;
    permissions: string[];
    permissionsLoaded: boolean;
    hasPermission: (code: string) => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);
    const [simulatedRole, setSimulatedRoleState] = useState<string | null>(localStorage.getItem('nova_simulated_role'));
    const [permissions, setPermissions] = useState<string[]>([]);
    const [previewPermissions, setPreviewPermissions] = useState<string[] | null>(null);

    const setSimulatedRole = (role: string | null, preview?: string[]) => {
        if (role) {
            localStorage.setItem('nova_simulated_role', role);
            if (preview) {
                setPreviewPermissions(preview);
                localStorage.setItem('nova_preview_permissions', JSON.stringify(preview));
            } else {
                setPreviewPermissions(null);
                localStorage.removeItem('nova_preview_permissions');
            }
        } else {
            localStorage.removeItem('nova_simulated_role');
            localStorage.removeItem('nova_preview_permissions');
            setPreviewPermissions(null);
        }
        setSimulatedRoleState(role);
    };

    // Load preview perms from storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('nova_preview_permissions');
        if (saved) {
            try {
                setPreviewPermissions(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse preview permissions');
            }
        }
    }, []);

    const effectiveRole = simulatedRole || profile?.role || null;

    const hasPermission = (code: string) => {
        // Super Admin has all permissions regardless of DB state for safety
        if (effectiveRole === 'Super Admin') return true;

        // If we are still loading, return true to prevent premature access restriction
        if (loading || !permissionsLoaded) return true;

        // If no role is present yet, don't restrict basic dashboard entry
        if (!effectiveRole) return code === 'view_dashboard';

        // If we are simulating and have preview permissions, use them
        if (simulatedRole && previewPermissions) {
            return previewPermissions.includes(code);
        }

        return permissions.includes(code);
    };

    const fetchPermissions = async (role: string) => {
        try {
            const { data, error } = await supabase
                .from('role_permissions')
                .select('permission_code')
                .eq('role_name', role);

            if (error) throw error;
            setPermissions(data?.map(p => p.permission_code) || []);
        } catch (error) {
            console.error('Error fetching role permissions:', error);
            setPermissions([]);
        } finally {
            setPermissionsLoaded(true);
        }
    };

    useEffect(() => {
        if (loading) return; // Don't do anything while profile is being checked initially

        if (effectiveRole) {
            setPermissionsLoaded(false);
            fetchPermissions(effectiveRole);
        } else {
            setPermissions([]);
            setPermissionsLoaded(true);
        }
    }, [effectiveRole, loading]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (!currentSession) {
                setProfile(null);
                setPermissions([]);
                setPermissionsLoaded(true);
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currentSession.user.id)
                .single();

            if (!error && data) {
                setProfile(data);
            } else {
                setProfile(null);
                setPermissions([]);
                setPermissionsLoaded(true);
            }
        } catch (err) {
            console.error('Unexpected error fetching profile:', err);
            setProfile(null);
            setPermissions([]);
            setPermissionsLoaded(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();

        // Listen for auth changes
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event) => {
            console.log('UserContext: Auth event:', event);
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                fetchProfile();
            } else if (event === 'SIGNED_OUT') {
                setProfile(null);
                setPermissions([]);
                setPermissionsLoaded(true);
                setSimulatedRole(null);
            }
        });

        return () => {
            authSubscription.unsubscribe();
        };
    }, []);

    // Effect to handle real-time profile updates separately
    useEffect(() => {
        if (!profile?.id) return;

        console.log('Setting up real-time subscription for profile:', profile.id);
        const profileSubscription = supabase
            .channel(`profile-updates-${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${profile.id}`
                },
                (payload) => {
                    console.log('👤 Profile updated in real-time:', payload.new);
                    setProfile(payload.new as UserProfile);
                }
            )
            .subscribe((status) => {
                console.log(`Real-time subscription status for profile ${profile.id}:`, status);
            });

        return () => {
            console.log('Cleaning up profile subscription for:', profile.id);
            profileSubscription.unsubscribe();
        };
    }, [profile?.id]);

    const refreshProfile = async () => {
        await fetchProfile();
        if (effectiveRole) await fetchPermissions(effectiveRole);
    };

    return (
        <UserContext.Provider value={{
            profile,
            loading,
            refreshProfile,
            simulatedRole,
            setSimulatedRole,
            effectiveRole,
            permissions,
            permissionsLoaded,
            hasPermission
        }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
