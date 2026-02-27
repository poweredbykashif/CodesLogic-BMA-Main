import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import { Avatar } from '../components/Avatar';
import { Dropdown } from '../components/Dropdown';
import {
    IconChevronLeft,
    IconMail,
    IconPhone,
    IconCreditCard,
    IconClock,
    IconTrash,
    IconCheckCircle,
    IconAlertTriangle,
    IconXCircle,
    IconFileImage,
    IconCamera,
    IconLoader,
    IconMapPin,
    IconCalendar,
    IconMaximize,
    IconBuilding,
    IconUser,
} from '../components/Icons';
import { Badge } from '../components/Badge';
import { Modal, Card, ElevatedMetallicCard } from '../components/Surfaces';
import { addToast } from '../components/Toast';
import { formatDisplayName } from '../utils/formatter';

interface UserDetailsProps {
    userId: string;
    onBack: () => void;
    onStatusChange?: () => void;
}

const UserDetails: React.FC<UserDetailsProps> = ({ userId, onBack, onStatusChange }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [isAvatarUploading, setIsAvatarUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchUserDetails();
    }, [userId]);

    const fetchUserDetails = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            setUser(data);
        } catch (error: any) {
            console.error('Error fetching user details:', error);
            addToast({ type: 'error', title: 'Error', message: 'Could not load user details.' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus: string) => {
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ status: newStatus })
                .eq('id', userId);

            if (error) throw error;
            setUser({ ...user, status: newStatus });
            addToast({ type: 'success', title: 'Status Updated', message: `User status changed to ${newStatus}.` });
            if (onStatusChange) onStatusChange();
        } catch (error: any) {
            addToast({ type: 'error', title: 'Update Failed', message: error.message });
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdateRole = async (newRole: string) => {
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;
            setUser({ ...user, role: newRole });
            addToast({ type: 'success', title: 'Role Updated', message: `User role changed to ${newRole}.` });
            if (onStatusChange) onStatusChange();
        } catch (error: any) {
            addToast({ type: 'error', title: 'Update Failed', message: error.message });
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!window.confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return;

        setUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) throw error;
            addToast({ type: 'success', title: 'User Deleted', message: 'The user account has been permanently removed.' });
            onBack();
        } catch (error: any) {
            addToast({ type: 'error', title: 'Delete Failed', message: error.message });
        } finally {
            setUpdating(false);
        }
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsAvatarUploading(true);
        try {
            // 1. Upload to Supabase Storage
            const fileName = `${userId}-${Math.random().toString(36).substring(2, 7)}.${file.name.split('.').pop()}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const publicUrl = data.publicUrl;

            // 2. Update profile mapping in database
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', userId);

            if (updateError) throw updateError;

            setUser({ ...user, avatar_url: publicUrl });
            addToast({ type: 'success', title: 'Avatar Updated', message: 'Profile picture has been updated successfully.' });
        } catch (error: any) {
            console.error('Error updating avatar:', error);
            addToast({ type: 'error', title: 'Upload Failed', message: error.message });
        } finally {
            setIsAvatarUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center py-20 px-6">
                <IconAlertTriangle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">User Not Found</h3>
                <p className="text-gray-500 mb-8">The user you are looking for does not exist or has been removed.</p>
                <Button variant="secondary" onClick={onBack}>Go Back</Button>
            </div>
        );
    }

    const roles = [
        { label: 'Super Admin', value: 'Super Admin' },
        { label: 'Admin', value: 'Admin' },
        { label: 'Project Manager', value: 'Project Manager' },
        { label: 'Freelancer', value: 'Freelancer' },
        { label: 'Presentation Designer', value: 'Presentation Designer' },
        { label: 'Finance Manager', value: 'Finance Manager' },
        { label: 'ORM Manager', value: 'ORM Manager' },
        { label: 'Project Operations Manager', value: 'Project Operations Manager' },
    ];

    const statuses = [
        { label: 'Active', value: 'Active' },
        { label: 'Pending Approval', value: 'Pending' },
        { label: 'Suspended', value: 'Suspended' },
        { label: 'Disabled', value: 'Disabled' },
    ];

    const isFreelancer = user.role.toLowerCase().includes('freelancer');

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both w-full mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 text-gray-400 hover:text-white transition-all hover:bg-white/[0.08] rounded-xl group"
                    >
                        <IconChevronLeft className="w-6 h-6 transition-transform group-hover:-translate-x-1" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            User Details
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Actions removed as requested */}
                </div>
            </div>

            {/* Profile Overview */}
            <div className="grid grid-cols-1 gap-8">
                {/* Profile Picture Card */}
                <div className="relative w-full rounded-2xl border border-surface-border bg-surface-card overflow-hidden group shadow-lg">
                    {/* Metallic Shine Overlay */}
                    <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-40" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />

                    <div className="p-8 relative z-10">
                        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                            {/* Profile Image with Ring */}
                            <div className="relative shrink-0">
                                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full shadow-2xl overflow-hidden relative z-10">
                                    <Avatar
                                        src={user.avatar_url}
                                        initials={(() => {
                                            const parts = user.name?.split(' ').filter(Boolean) || [];
                                            if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                                            if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
                                            return '??';
                                        })()}
                                        size="xl"
                                        className="w-full h-full"
                                    />
                                </div>
                                {/* Status Indicator */}
                                <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full z-20 ${user.status === 'Active' ? 'bg-brand-success shadow-[0_0_10px_rgba(34,197,94,0.4)]' :
                                    user.status === 'Pending' ? 'bg-brand-warning shadow-[0_0_10px_rgba(234,179,8,0.4)]' :
                                        'bg-brand-error shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                                    }`} />
                            </div>

                            <div className="flex-1 min-w-0 space-y-3">
                                <div className="space-y-1">
                                    <h1 className="text-3xl font-black text-white tracking-tight">
                                        {(() => {
                                            // If both first_name and last_name exist, use them
                                            if (user.first_name && user.last_name) {
                                                return `${formatDisplayName(user.first_name)} ${formatDisplayName(user.last_name)}`;
                                            }
                                            // If only name field exists, try to split it
                                            if (user.name) {
                                                const nameParts = user.name.trim().split(' ').filter(part => part.length > 0);
                                                if (nameParts.length >= 2) {
                                                    // Has multiple parts - format each part
                                                    return nameParts.map(part => formatDisplayName(part)).join(' ');
                                                } else {
                                                    // Single name - just format it
                                                    return formatDisplayName(user.name);
                                                }
                                            }
                                            return 'Unknown User';
                                        })()}
                                    </h1>

                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                        {/* Role Badge */}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 backdrop-blur-sm">
                                            <IconUser className="w-3.5 h-3.5 text-brand-primary" />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">{user.role}</span>
                                        </div>

                                        {/* Status Badge */}
                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border backdrop-blur-sm ${user.status === 'Active' ? 'bg-brand-success/10 border-brand-success/20 text-brand-success' :
                                            user.status === 'Pending' ? 'bg-brand-warning/10 border-brand-warning/20 text-brand-warning' :
                                                'bg-brand-error/10 border-brand-error/20 text-brand-error'
                                            }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-brand-success' :
                                                user.status === 'Pending' ? 'bg-brand-warning' :
                                                    'bg-brand-error'
                                                }`} />
                                            <span className="text-xs font-bold uppercase tracking-wider">{user.status === 'Disabled' ? 'Deactivated' : user.status}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Details Metadata Card */}
                <Card isElevated className="p-0 overflow-hidden">
                    <div className="px-8 py-6 border-b border-white/[0.05] bg-white/[0.02] relative shadow-md">
                        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-40" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest relative z-10">USER DETAILS</h3>
                    </div>
                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-10 gap-x-12">
                            {/* Row 1 */}
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-gray-500 shadow-inner">
                                    <IconMail className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Email Address</span>
                                    <span className="text-base text-white font-medium truncate">{user.email}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-gray-500 shadow-inner">
                                    <IconPhone className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Phone Number</span>
                                    <span className="text-base text-white font-medium">{user.phone || 'No phone number'}</span>
                                </div>
                            </div>

                            {/* Row 2 */}
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-gray-500 shadow-inner">
                                    <IconCreditCard className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Payment Email</span>
                                    <span className="text-base text-white font-medium truncate">{user.payment_email || 'Not provided'}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-gray-500 shadow-inner">
                                    <IconClock className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Joined Date</span>
                                    <span className="text-base text-white font-medium">
                                        {new Date(user.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Bank Details Card (Freelancer Only) */}
                {isFreelancer && (
                    <Card isElevated className="p-0 overflow-hidden">
                        <div className="px-8 py-6 border-b border-white/[0.05] bg-white/[0.02]">
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest">BANK DETAILS</h3>
                        </div>
                        <div className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-12">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-gray-500 shadow-inner">
                                        <IconBuilding className="w-6 h-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Bank Name</span>
                                        <span className="text-base text-white font-medium truncate">{user.bank_name || 'Not provided'}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-gray-500 shadow-inner">
                                        <IconUser className="w-6 h-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Account Title</span>
                                        <span className="text-base text-white font-medium truncate">{user.account_title || 'Not provided'}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 lg:col-span-1">
                                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-gray-500 shadow-inner">
                                        <IconCreditCard className="w-6 h-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">IBAN / Account Number</span>
                                        <span className="text-base text-white font-medium truncate">{user.iban || 'Not provided'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            {/* Role-Specific Sections: CNIC for Freelancers */}
            {isFreelancer && (
                <div className="grid grid-cols-1 gap-6">
                    <Card isElevated className="p-0 overflow-hidden">
                        <div className="px-8 py-6 border-b border-white/[0.05] bg-white/[0.02]">
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest">CNIC DOCUMENTS</h3>
                        </div>
                        <div className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <div
                                        className="aspect-[1.5/1] rounded-2xl bg-black/40 border border-surface-border overflow-hidden flex items-center justify-center group relative shadow-inner cursor-pointer"
                                        onClick={() => user.cnic_front_url && setPreviewImage(user.cnic_front_url)}
                                    >
                                        {user.cnic_front_url ? (
                                            <img src={user.cnic_front_url} alt="CNIC Front" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="text-center p-4">
                                                <IconFileImage className="w-10 h-10 text-gray-800 mx-auto mb-2" />
                                                <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">Image missing</span>
                                            </div>
                                        )}
                                        {user.cnic_front_url && (
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform duration-300">
                                                    <IconMaximize size={24} />
                                                </div>
                                                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Click to Expand</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-500 text-center uppercase tracking-[0.2em]">CNIC Front</p>
                                </div>
                                <div className="space-y-3">
                                    <div
                                        className="aspect-[1.5/1] rounded-2xl bg-black/40 border border-surface-border overflow-hidden flex items-center justify-center group relative shadow-inner cursor-pointer"
                                        onClick={() => user.cnic_back_url && setPreviewImage(user.cnic_back_url)}
                                    >
                                        {user.cnic_back_url ? (
                                            <img src={user.cnic_back_url} alt="CNIC Back" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="text-center p-4">
                                                <IconFileImage className="w-10 h-10 text-gray-800 mx-auto mb-2" />
                                                <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">Image missing</span>
                                            </div>
                                        )}
                                        {user.cnic_back_url && (
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform duration-300">
                                                    <IconMaximize size={24} />
                                                </div>
                                                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Click to Expand</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-500 text-center uppercase tracking-[0.2em]">CNIC Back</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Image Preview Modal */}
            <Modal
                isOpen={!!previewImage}
                onClose={() => setPreviewImage(null)}
                title="Document Preview"
                size="xl"
            >
                <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-black/40 border border-white/5 shadow-2xl">
                    {previewImage && (
                        <img
                            src={previewImage}
                            alt="Document Preview"
                            className="w-full h-full object-contain animate-in fade-in zoom-in-95 duration-500"
                        />
                    )}
                </div>
            </Modal>

            {/* Account Management */}
            <div className="w-full">
                <ElevatedMetallicCard
                    title="Quick Actions"
                    bodyClassName="p-8 space-y-8"
                    className="w-full"
                >
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-4">
                                {user.status === 'Pending' ? (
                                    <>
                                        <Button
                                            variant="metallic"
                                            className="px-8 !bg-gradient-to-b !from-emerald-500 !to-emerald-700 !border-emerald-600 text-white !shadow-none hover:shadow-none"
                                            onClick={() => handleUpdateStatus('Active')}
                                            isLoading={updating}
                                        >
                                            Approve User
                                        </Button>
                                        <Button
                                            variant="recessed"
                                            className="text-orange-500 hover:bg-orange-500/10"
                                            onClick={() => handleUpdateStatus('Deactivated')}
                                            isLoading={updating}
                                        >
                                            Deactivate User
                                        </Button>
                                        <Button
                                            variant="recessed"
                                            className="text-brand-error hover:bg-brand-error/10"
                                            leftIcon={<IconTrash className="w-4 h-4" />}
                                            onClick={handleDeleteUser}
                                            isLoading={updating}
                                        >
                                            Remove User Permanently
                                        </Button>
                                    </>
                                ) : user.status === 'Active' ? (
                                    <>
                                        <Button
                                            variant="recessed"
                                            className="text-orange-500 hover:bg-orange-500/10"
                                            onClick={() => handleUpdateStatus('Deactivated')}
                                            isLoading={updating}
                                        >
                                            Deactivate User
                                        </Button>
                                        <Button
                                            variant="recessed"
                                            className="text-brand-error hover:bg-brand-error/10"
                                            leftIcon={<IconTrash className="w-4 h-4" />}
                                            onClick={handleDeleteUser}
                                            isLoading={updating}
                                        >
                                            Remove User Permanently
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="metallic"
                                            className="px-8 !bg-gradient-to-b !from-emerald-500 !to-emerald-700 !border-emerald-600 text-white !shadow-none hover:shadow-none"
                                            onClick={() => handleUpdateStatus('Active')}
                                            isLoading={updating}
                                        >
                                            Activate User
                                        </Button>
                                        <Button
                                            variant="recessed"
                                            className="text-brand-error hover:bg-brand-error/10"
                                            leftIcon={<IconTrash className="w-4 h-4" />}
                                            onClick={handleDeleteUser}
                                            isLoading={updating}
                                        >
                                            Remove User Permanently
                                        </Button>
                                    </>
                                )}
                            </div>
                            <div className="mt-12">
                                <Card className="bg-yellow-500/10 border-yellow-500/20 p-4">
                                    <div className="flex items-start gap-3">
                                        <IconAlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-bold text-yellow-500 uppercase tracking-wide">Warning: Danger Zone</h4>
                                            <p className="text-xs text-yellow-500/80 leading-relaxed">
                                                Actions performed here can affect the user's access and data. Deleting a user is permanent and cannot be undone.
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>

                    </div>
                </ElevatedMetallicCard>
            </div>
        </div>
    );
};

export default UserDetails;
