import React, { useState, useEffect } from 'react';
import { IconUser, IconBriefcase, IconCheckCircle, IconSettings, IconLayout, IconDollar, IconShield, IconBox } from '../components/Icons';
import Button from '../components/Button';
import { Card } from '../components/Surfaces';
import { supabase } from '../lib/supabase';

interface SelectRoleProps {
    onRoleSelect: (role: string) => void;
    onBack?: () => void;
}

interface Role {
    id: string;
    name: string;
    description: string;
}

const getRoleIcon = (roleName: string) => {
    switch (roleName) {
        case 'Super Admin':
            return IconShield;
        case 'Admin':
            return IconSettings;
        case 'Project Manager':
            return IconBriefcase;
        case 'Freelancer':
            return IconUser;
        case 'Presentation Designer':
            return IconLayout;
        case 'Finance Manager':
            return IconDollar;
        case 'ORM Manager':
            return IconShield;
        case 'Project Operations Manager':
            return IconBox;
        default:
            return IconUser;
    }
};

const SelectRole: React.FC<SelectRoleProps> = ({ onRoleSelect, onBack }) => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const { data, error } = await supabase
                    .from('roles')
                    .select('*');

                if (error) throw error;
                setRoles(data || []);
            } catch (error) {
                console.error('Error fetching roles:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRoles();
    }, []);

    const handleContinue = () => {
        if (selected) {
            const selectedRole = roles.find(r => r.id === selected);
            if (selectedRole) {
                onRoleSelect(selectedRole.name);
            }
        }
    };

    if (loading) {
        return (
            <div className="w-full max-w-4xl min-h-[400px] flex items-center justify-center bg-surface-card border border-surface-border rounded-3xl mx-auto">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl bg-surface-card border border-surface-border rounded-3xl shadow-2xl mx-auto animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
            {/* Metallic Header */}
            <div className="relative z-20 w-full flex items-center justify-center border-b border-surface-border bg-white/[0.01] p-8 overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-60" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1)_0%,transparent_70%)] pointer-events-none" />

                <h2 className="relative z-10 text-2xl font-black text-white uppercase tracking-widest">Select Your Role</h2>
            </div>

            {/* Body */}
            <div className="px-8 py-10 lg:px-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {roles.map((role) => {
                        const isSelected = selected === role.id;
                        return (
                            <Card
                                key={role.id}
                                onClick={() => setSelected(role.id)}
                                isElevated={true}
                                disableHover={isSelected}
                                className={`h-full p-0 border-2 !transition-none group cursor-pointer overflow-hidden ${isSelected
                                    ? 'bg-gradient-to-b from-[#FF6B4B] to-[#D9361A] border-[#FF4D2D] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]'
                                    : 'bg-[#1A1A1A] border-white/10 hover:border-brand-primary/30 shadow-nova'
                                    }`}
                            >
                                {/* Metallic Shine Overlay (Primary Metallic effect) */}
                                <>
                                    <div className={`absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none transition-opacity ${isSelected ? 'opacity-60' : 'opacity-40 group-hover:opacity-60'}`} />
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />
                                </>

                                <div className="relative z-10 flex items-center justify-center p-6 h-full min-h-[80px]">
                                    <h3 className={`text-sm font-black ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                                        {role.name}
                                    </h3>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Metallic Footer */}
            <div className="px-8 py-6 lg:px-10 lg:py-8 border-t border-white/[0.05] bg-white/[0.03] rounded-b-3xl relative overflow-hidden">
                {/* Full Surface Metallic Shine */}
                <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-40" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />

                <div className="relative z-10 flex justify-end items-center gap-4">
                    <Button
                        variant="recessed"
                        onClick={onBack}
                        className="px-8 py-3 uppercase tracking-wider font-bold"
                    >
                        Back
                    </Button>
                    <Button
                        variant="metallic"
                        className="w-full md:w-auto px-12 py-3 shadow-lg shadow-brand-primary/20 transition-all font-bold uppercase tracking-wider"
                        disabled={!selected}
                        onClick={handleContinue}
                    >
                        Continue
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default SelectRole;
