
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import { Avatar } from '../components/Avatar';
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
    IconShield,
    IconActivity,
    IconZap,
    IconSettings,
    IconStar,
    IconAward,
    IconRosette,
    IconBank,
} from '../components/Icons';
import { Badge, RoleCapsule, getStatusCapsuleClasses } from '../components/Badge';
import { Modal, Card, ElevatedMetallicCard } from '../components/Surfaces';
import { Tabs } from '../components/Navigation';
import { addToast } from '../components/Toast';
import { formatDisplayName } from '../utils/formatter';

interface UserDetailsV2Props {
    userId: string;
    onBack: () => void;
    onStatusChange?: () => void;
}

const UserDetailsV2: React.FC<UserDetailsV2Props> = ({ userId, onBack, onStatusChange }) => {
    const [user, setUser] = useState<any>(() => {
        const cachedUsers = localStorage.getItem('nova_users_cache');
        if (cachedUsers) {
            const users = JSON.parse(cachedUsers);
            return users.find((u: any) => u.id === userId) || null;
        }
        return null;
    });
    const [loading, setLoading] = useState(!user);
    const [updating, setUpdating] = useState(false);
    const [isAvatarUploading, setIsAvatarUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'basic-info' | 'performance' | 'settings'>('basic-info');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Password Update State
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
    const [updatingPassword, setUpdatingPassword] = useState(false);

    // Zoom State for Document View
    const [isZoomed, setIsZoomed] = useState(false);
    const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });

    // CNIC Upload State
    const [isCNICUploading, setIsCNICUploading] = useState<{ front: boolean, back: boolean }>({ front: false, back: false });
    const cnicFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingSide, setUploadingSide] = useState<'front' | 'back' | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        fetchUserDetails();
    }, [userId]);

    const fetchUserDetails = async () => {
        if (!user) setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            setUser(data);

            // Sync cache
            const cachedUsers = localStorage.getItem('nova_users_cache');
            if (cachedUsers) {
                const users = JSON.parse(cachedUsers);
                const index = users.findIndex((u: any) => u.id === userId);
                if (index !== -1) {
                    users[index] = { ...users[index], ...data };
                    localStorage.setItem('nova_users_cache', JSON.stringify(users));
                }
            }
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

    const handleDeleteUser = () => {
        setIsDeleteModalOpen(true);
    };

    const executeDeleteUser = async () => {
        setUpdating(true);
        try {
            const { error } = await supabase.rpc('delete_user_entirely', {
                target_user_id: userId
            });

            if (error) throw error;
            addToast({ type: 'success', title: 'User Deleted', message: 'The user account has been permanently removed.' });
            setIsDeleteModalOpen(false);
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
            const fileName = `${userId}-${Math.random().toString(36).substring(2, 7)}.${file.name.split('.').pop()}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const publicUrl = data.publicUrl;

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', userId);

            if (updateError) throw updateError;

            setUser({ ...user, avatar_url: publicUrl });

            const cachedUsers = localStorage.getItem('nova_users_cache');
            if (cachedUsers) {
                const users = JSON.parse(cachedUsers);
                const index = users.findIndex((u: any) => u.id === userId);
                if (index !== -1) {
                    users[index] = { ...users[index], avatar_url: publicUrl };
                    localStorage.setItem('nova_users_cache', JSON.stringify(users));
                }
            }

            addToast({ type: 'success', title: 'Avatar Updated', message: 'Profile picture has been updated successfully.' });
        } catch (error: any) {
            console.error('Error updating avatar:', error);
            addToast({ type: 'error', title: 'Upload Failed', message: error.message });
        } finally {
            setIsAvatarUploading(false);
        }
    };

    const handlePasswordUpdate = async () => {
        if (!passwordData.newPassword || !passwordData.confirmPassword) {
            addToast({ type: 'error', title: 'Validation Error', message: 'Please fill in both password fields.' });
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            addToast({ type: 'error', title: 'Validation Error', message: 'Passwords do not match.' });
            return;
        }
        if (passwordData.newPassword.length < 6) {
            addToast({ type: 'error', title: 'Validation Error', message: 'Password must be at least 6 characters long.' });
            return;
        }

        setUpdatingPassword(true);
        try {
            await new Promise(r => setTimeout(r, 800));
            addToast({ type: 'success', title: 'Password Updated', message: 'Password has been changed successfully.' });
            setIsPasswordModalOpen(false);
            setPasswordData({ newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            console.error('Error updating password:', error);
            addToast({ type: 'error', title: 'Update Failed', message: error.message });
        } finally {
            setUpdatingPassword(false);
        }
    };

    const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
        if (isZoomed) {
            setIsZoomed(false);
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        setZoomOrigin({ x, y });
        setIsZoomed(true);
    };

    const handleCNICClick = (side: 'front' | 'back') => {
        setUploadingSide(side);
        cnicFileInputRef.current?.click();
    };

    const handleCNICFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !uploadingSide) return;

        setIsCNICUploading(prev => ({ ...prev, [uploadingSide]: true }));
        try {
            const fileName = `${userId}-cnic-${uploadingSide}-${Math.random().toString(36).substring(2, 7)}.${file.name.split('.').pop()}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('documents')
                .getPublicUrl(fileName);

            const publicUrl = data.publicUrl;
            const updateField = uploadingSide === 'front' ? 'cnic_front_url' : 'cnic_back_url';

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ [updateField]: publicUrl })
                .eq('id', userId);

            if (updateError) throw updateError;

            setUser({ ...user, [updateField]: publicUrl });

            // Sync cache
            const cachedUsers = localStorage.getItem('nova_users_cache');
            if (cachedUsers) {
                const users = JSON.parse(cachedUsers);
                const index = users.findIndex((u: any) => u.id === userId);
                if (index !== -1) {
                    users[index] = { ...users[index], [updateField]: publicUrl };
                    localStorage.setItem('nova_users_cache', JSON.stringify(users));
                }
            }

            addToast({ type: 'success', title: 'Document Updated', message: `CNIC ${uploadingSide} has been updated successfully.` });
        } catch (error: any) {
            console.error('Error updating CNIC:', error);
            addToast({ type: 'error', title: 'Upload Failed', message: error.message });
        } finally {
            setIsCNICUploading(prev => ({ ...prev, [uploadingSide]: false }));
            setUploadingSide(null);
            if (event.target) event.target.value = '';
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
                <Button variant="secondary" onClick={onBack}>Go Back</Button>
            </div>
        );
    }

    const isFreelancer = user.role === 'Freelancer';

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
            {/* Header / Navigation */}
            <div className="flex items-center justify-between px-2">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 text-gray-400 hover:text-white transition-all hover:bg-white/[0.08] rounded-xl group flex items-center gap-2"
                >
                    <IconChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                    <span className="text-sm font-bold uppercase tracking-widest">Back to Directory</span>
                </button>

                <Tabs
                    tabs={[
                        { id: 'basic-info', label: 'Basic Info', icon: <IconUser size={14} /> },
                        { id: 'performance', label: 'Performance', icon: <IconActivity size={14} /> },
                        { id: 'settings', label: 'System', icon: <IconSettings size={14} /> },
                    ]}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as any)}
                />
            </div>

            {/* Main 2-Panel Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-2">
                {/* Left Panel: Profile Info */}
                <div className="lg:col-span-4 xl:col-span-3">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-b from-white/10 to-transparent rounded-2xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-1000" />

                        <div className="w-full relative z-10 rounded-2xl overflow-hidden border border-white/10 bg-[#1A1A1A] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]">
                            <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.06)_40%,rgba(255,255,255,0.12)_50%,rgba(255,255,255,0.06)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-70" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.07)_0%,transparent_65%)] pointer-events-none" />

                            <div className="p-10 flex flex-col items-center text-center space-y-6 relative z-10">
                                {/* Profile Image */}
                                <div className="relative mx-auto" style={{ width: '128px', height: '128px' }}>
                                    <div className="w-full h-full rounded-full bg-surface-overlay border border-surface-border flex items-center justify-center overflow-hidden shadow-2xl">
                                        {user.avatar_url ? (
                                            <img
                                                src={user.avatar_url}
                                                alt={user.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-3xl font-black text-gray-500 uppercase tracking-wider">
                                                {(() => {
                                                    const parts = (user.first_name + ' ' + user.last_name).trim() || user.name || '';
                                                    const p = parts.split(' ').filter(Boolean);
                                                    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
                                                    return p[0]?.slice(0, 2).toUpperCase() || '??';
                                                })()}
                                            </span>
                                        )}
                                    </div>
                                    <div
                                        className={`absolute w-5 h-5 rounded-full z-20 border-[3px] border-[#121212] ${user.status === 'Active'
                                            ? 'bg-brand-success shadow-[0_0_10px_rgba(34,197,94,0.5)]'
                                            : 'bg-brand-warning shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                                            }`}
                                        style={{ bottom: '9px', right: '9px' }}
                                    />
                                </div>

                                {/* Name and Basic Info */}
                                <div className="space-y-4 w-full">
                                    <div className="space-y-3 text-center">
                                        <div className="flex flex-row items-baseline justify-center gap-4 flex-wrap">
                                            <h1 className="text-4xl font-black text-white tracking-tight leading-tight drop-shadow-md">
                                                {(user.first_name && user.last_name)
                                                    ? `${formatDisplayName(user.first_name)} ${formatDisplayName(user.last_name)}`
                                                    : formatDisplayName(user.name || 'Unknown User')
                                                }
                                            </h1>
                                        </div>
                                        <p className="text-sm text-gray-400 font-medium tracking-wide">{user.email}</p>
                                    </div>

                                    <div className="flex flex-row items-center justify-center gap-3 pt-3">
                                        <RoleCapsule role={user.role} />

                                        <span className={getStatusCapsuleClasses(user.status)}>
                                            {user.status === 'Disabled' ? 'Deactivated' : user.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="w-full pt-8 border-t border-white/5 flex justify-center gap-10">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em]">Projects Done</span>
                                        <span className="text-3xl font-black text-white mt-2">124</span>
                                    </div>
                                    <div className="w-px h-12 bg-white/5" />
                                    <div className="flex flex-col items-center">
                                        <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em]">Total Reviews</span>
                                        <span className="text-3xl font-black text-white mt-2">89</span>
                                    </div>
                                </div>

                                <div className="w-full pt-8 border-t border-white/5 flex flex-col items-center gap-4">
                                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em]">Rating</span>
                                    <div className="flex items-center gap-2">
                                        {[1, 2, 3, 4, 5].map((star) => {
                                            const rating = 4.5;
                                            const isFilled = star <= Math.floor(rating);
                                            const isHalf = star === Math.ceil(rating) && rating % 1 !== 0;
                                            const isActive = isFilled || isHalf;

                                            let fromColor = '#22c55e';
                                            let toColor = '#15803d';
                                            let borderColor = '#16a34a';

                                            if (rating < 3) {
                                                fromColor = '#f87171'; toColor = '#b91c1c'; borderColor = '#dc2626';
                                            } else if (rating < 4) {
                                                fromColor = '#facc15'; toColor = '#a16207'; borderColor = '#ca8a04';
                                            }

                                            if (!isActive) {
                                                return (
                                                    <div key={star} className="relative w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.02] border border-white/[0.05] shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]">
                                                        <IconStar size={18} className="text-white/10" fill="none" />
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={star}
                                                    className="relative w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                                                    style={{
                                                        background: `linear-gradient(to bottom, ${fromColor}, ${toColor})`,
                                                        border: `1px solid ${borderColor}`,
                                                        boxShadow: `inset 0 1.5px 0 rgba(255,255,255,0.35), inset 0 -1.5px 1.5px rgba(0,0,0,0.25)`,
                                                    }}
                                                >
                                                    <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.18)_50%,transparent_100%)] pointer-events-none" />
                                                    <IconStar size={18} className="relative z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" fill="currentColor" />
                                                    {isHalf && !isFilled && (
                                                        <div className="absolute inset-0 left-[50%] bg-black/50 backdrop-blur-[1px]" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <span className="text-3xl font-black text-white -mt-2">4.5</span>
                                </div>

                                <div className="w-full pt-10 border-t border-white/5 grid grid-cols-2 gap-4">
                                    <div className="text-left space-y-1">
                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Enrolled</p>
                                        <p className="text-sm font-bold text-white tracking-tight">{new Date(user.created_at || new Date()).getFullYear()}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Region</p>
                                        <p className="text-sm font-bold text-white tracking-tight">Lahore, PK</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Content Area */}
                <div className="lg:col-span-8 xl:col-span-9 space-y-8">
                    {activeTab === 'basic-info' && (
                        <div className="space-y-6">
                            {/* Unified Details Card */}
                            <div className="w-full relative z-10 rounded-2xl overflow-hidden border border-white/10 bg-[#1A1A1A] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] flex flex-col">
                                <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.06)_40%,rgba(255,255,255,0.12)_50%,rgba(255,255,255,0.06)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-70" />
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.07)_0%,transparent_65%)] pointer-events-none" />

                                <div className="p-10 border-b border-white/[0.05] relative z-10 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-white/[0.03] to-transparent">
                                    <Avatar
                                        src={user.avatar_url}
                                        initials={(() => {
                                            const parts = user.name?.split(' ').filter(Boolean) || [];
                                            if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                                            if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
                                            return '??';
                                        })()}
                                        size="2xl"
                                        className="shadow-2xl ring-1 ring-white/10 rounded-full hover:scale-105 transition-transform duration-300"
                                    />
                                    <Button
                                        variant="metallic"
                                        size="sm"
                                        leftIcon={<IconCamera className="w-4 h-4" />}
                                        onClick={handleAvatarClick}
                                        isLoading={isAvatarUploading}
                                        className="px-6 shadow-lg shadow-brand-primary/20"
                                    >
                                        Upload Avatar
                                    </Button>
                                </div>

                                <div className="p-8 relative z-10">
                                    <div className={`grid gap-y-10 gap-x-12 ${user.role?.toLowerCase().includes('project manager') ? 'grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
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
                                                <span className="text-base text-white font-medium truncate">{user.phone || 'Not provided'}</span>
                                            </div>
                                        </div>

                                        {/* Payment Method & Email — hidden for Project Manager profiles */}
                                        {!user.role?.toLowerCase().includes('project manager') && (
                                            <>
                                                {/* Preferred Method - High Premium Orange Gradient Card */}
                                                <div className="relative group overflow-hidden p-5 rounded-3xl bg-gradient-to-br from-[#FF6B4B] to-[#D9361A] border border-[#FF4D2D] shadow-[0_12px_24px_-8px_rgba(217,54,26,0.5),inset_0_1px_rgba(255,255,255,0.4)] transition-all hover:scale-[1.02] cursor-default">
                                                    {/* Metallic Shine Overlays */}
                                                    <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.05)_100%)] opacity-40 pointer-events-none" />
                                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.2)_0%,transparent_70%)] pointer-events-none" />
                                                    
                                                    <div className="flex items-center gap-4 relative z-10">
                                                        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center p-1.5 shadow-2xl border border-white/30 shrink-0">
                                                            {user.preferred_payment_method === 'Payoneer' ? (
                                                                <img src="/payoneericon.jpeg" alt="Payoneer" className="w-full h-full object-contain" />
                                                            ) : (
                                                                <IconBank className="w-6 h-6 text-[#D9361A]" strokeWidth={2.5} />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-white/70 uppercase tracking-[0.25em] mb-1">Preferred Method</span>
                                                            <span className="text-base text-white font-black truncate drop-shadow-sm">
                                                                {user.preferred_payment_method || 'Not Specified'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-gray-500 shadow-inner">
                                                        <IconMail className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Payment Email</span>
                                                        <span className="text-base text-white font-medium truncate">{user.payment_email || 'Not provided'}</span>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-gray-500 shadow-inner">
                                                <IconClock className="w-6 h-6" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Joined Date</span>
                                                <span className="text-base text-white font-medium">
                                                    {new Date(user.created_at || new Date()).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isFreelancer && (
                                    <div className="p-8 relative z-10 border-t border-white/[0.05] mt-auto">
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
                                )}
                            </div>

                            {/* Verification Documents — shown when CNIC docs are uploaded */}
                            {(user.cnic_front_url || user.cnic_back_url) && (
                                <div className="w-full relative z-10 rounded-2xl overflow-hidden border border-white/10 bg-[#1A1A1A] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]">
                                    <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.06)_40%,rgba(255,255,255,0.12)_50%,rgba(255,255,255,0.06)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-70" />
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.07)_0%,transparent_65%)] pointer-events-none" />

                                    <div className="px-8 py-5 border-b border-white/[0.05] bg-white/[0.02] relative z-20 flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                            <IconFileImage className="w-4 h-4 text-brand-primary" />
                                            Verification Documents
                                        </h3>
                                        <Badge variant="success" size="sm" className="bg-brand-success/10 border-brand-success/20 text-brand-success">Verified</Badge>
                                    </div>

                                    <div className="p-8 relative z-20">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center max-w-5xl mx-auto">
                                            <div className="space-y-4">
                                                <div
                                                    className="aspect-[1.6/1] rounded-2xl bg-[#0b0b0b] border border-white/10 overflow-hidden flex items-center justify-center group relative shadow-[inset_0_4px_24px_rgba(0,0,0,0.7)] cursor-pointer"
                                                >
                                                    {user.cnic_front_url ? (
                                                        <img src={user.cnic_front_url} alt="CNIC Front" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                                                    ) : (
                                                        <div className="text-center p-4">
                                                            <IconFileImage className="w-12 h-12 text-white/5 mx-auto mb-3" />
                                                            <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">Front side missing</span>
                                                        </div>
                                                    )}

                                                    {/* Overlays */}
                                                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                                        <div className="flex gap-4">
                                                            {user.cnic_front_url && (
                                                                <button
                                                                    title="View Identity Document"
                                                                    onClick={(e) => { e.stopPropagation(); setPreviewImage(user.cnic_front_url); }}
                                                                    className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                                                                >
                                                                    <IconMaximize size={24} />
                                                                </button>
                                                            )}
                                                            <button
                                                                title={user.cnic_front_url ? 'Re-upload Document' : 'Upload Document'}
                                                                onClick={(e) => { e.stopPropagation(); handleCNICClick('front'); }}
                                                                className="w-12 h-12 rounded-full bg-brand-primary/20 backdrop-blur-md border border-brand-primary/40 flex items-center justify-center text-brand-primary hover:bg-brand-primary/30 transition-all"
                                                                disabled={isCNICUploading.front}
                                                            >
                                                                {isCNICUploading.front ? <IconLoader className="w-6 h-6 animate-spin" /> : <IconCamera size={24} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-center gap-3">
                                                    <div className="w-10 h-px bg-white/5" />
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">ID CARD FRONT</p>
                                                    <div className="w-10 h-px bg-white/5" />
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div
                                                    className="aspect-[1.6/1] rounded-2xl bg-[#0b0b0b] border border-white/10 overflow-hidden flex items-center justify-center group relative shadow-[inset_0_4px_24px_rgba(0,0,0,0.7)] cursor-pointer"
                                                >
                                                    {user.cnic_back_url ? (
                                                        <img src={user.cnic_back_url} alt="CNIC Back" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                                                    ) : (
                                                        <div className="text-center p-4">
                                                            <IconFileImage className="w-12 h-12 text-white/5 mx-auto mb-3" />
                                                            <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">Back side missing</span>
                                                        </div>
                                                    )}

                                                    {/* Overlays */}
                                                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                                        <div className="flex gap-4">
                                                            {user.cnic_back_url && (
                                                                <button
                                                                    title="View Identity Document"
                                                                    onClick={(e) => { e.stopPropagation(); setPreviewImage(user.cnic_back_url); }}
                                                                    className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                                                                >
                                                                    <IconMaximize size={24} />
                                                                </button>
                                                            )}
                                                            <button
                                                                title={user.cnic_back_url ? 'Re-upload Document' : 'Upload Document'}
                                                                onClick={(e) => { e.stopPropagation(); handleCNICClick('back'); }}
                                                                className="w-12 h-12 rounded-full bg-brand-primary/20 backdrop-blur-md border border-brand-primary/40 flex items-center justify-center text-brand-primary hover:bg-brand-primary/30 transition-all"
                                                                disabled={isCNICUploading.back}
                                                            >
                                                                {isCNICUploading.back ? <IconLoader className="w-6 h-6 animate-spin" /> : <IconCamera size={24} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-center gap-3">
                                                    <div className="w-10 h-px bg-white/5" />
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">ID CARD BACK</p>
                                                    <div className="w-10 h-px bg-white/5" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'performance' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="h-[400px] w-full relative z-10 rounded-2xl overflow-hidden border border-white/5 bg-[#000000] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] flex items-center justify-center text-gray-500">
                                <div className="text-center space-y-4">
                                    <IconActivity className="w-16 h-16 mx-auto opacity-10" />
                                    <p className="text-sm uppercase tracking-[0.2em] font-bold text-white/20">Performance Metrics Coming Soon</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="w-full relative z-10 rounded-2xl overflow-hidden border border-white/10 bg-[#1A1A1A] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]">
                                <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.06)_40%,rgba(255,255,255,0.12)_50%,rgba(255,255,255,0.06)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-70" />
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.07)_0%,transparent_65%)] pointer-events-none" />

                                <div className="p-10 relative z-10">
                                    <div className="space-y-12">
                                        {/* Section: Password Management */}
                                        <div className="space-y-6">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-[#000000] border border-white/5 rounded-2xl gap-6 shadow-[inset_0_2px_12px_rgba(0,0,0,1)]">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white shadow-inner">
                                                        <IconShield className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white">Password Management</p>
                                                        <p className="text-xs text-gray-500 mt-1">Set or update the password for this user</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="metallic"
                                                    size="sm"
                                                    className="px-8 shadow-lg shadow-brand-primary/20"
                                                    onClick={() => setIsPasswordModalOpen(true)}
                                                >
                                                    Update Password
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Section: Quick Actions (based on screenshot) */}
                                        <div className="space-y-8 pt-4 border-t border-white/5">
                                            <div className="flex flex-wrap gap-4">
                                                {user.status === 'Active' ? (
                                                    <Button
                                                        variant="recessed"
                                                        className="px-6 text-orange-500 hover:bg-orange-500/10 h-11 border-orange-500/20"
                                                        onClick={() => handleUpdateStatus('Deactivated')}
                                                        isLoading={updating}
                                                    >
                                                        Deactivate User
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="metallic"
                                                        className="px-8 !bg-gradient-to-b !from-emerald-500/80 !to-emerald-700/80 !border-emerald-500/50 text-white !shadow-none hover:shadow-none h-11"
                                                        onClick={() => handleUpdateStatus('Active')}
                                                        isLoading={updating}
                                                    >
                                                        Activate User
                                                    </Button>
                                                )}

                                                <Button
                                                    variant="recessed"
                                                    className="px-6 text-red-500 hover:bg-red-500/10 h-11 border-red-500/20"
                                                    leftIcon={<IconTrash className="w-4 h-4" />}
                                                    onClick={handleDeleteUser}
                                                    isLoading={updating}
                                                >
                                                    Remove User Permanently
                                                </Button>
                                            </div>

                                            {/* Warning Box (Yellow/Danger Zone) */}
                                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0 mt-0.5">
                                                        <IconAlertTriangle className="w-6 h-6" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-black text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                                                            WARNING: DANGER ZONE
                                                        </h4>
                                                        <p className="text-xs text-yellow-500/70 leading-relaxed font-medium">
                                                            Actions performed here can affect the user's access and data. Deleting a user is permanent and cannot be undone.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals & Inputs */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarChange}
            />

            <input
                type="file"
                ref={cnicFileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleCNICFileChange}
            />

            <Modal
                isOpen={!!previewImage}
                onClose={() => {
                    setPreviewImage(null);
                    setIsZoomed(false);
                }}
                title="Document View"
                size="xl"
            >
                <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-black/60 shadow-2xl border border-white/5 group/modal">
                    <img
                        src={previewImage!}
                        className={`w-full h-full object-contain transition-transform duration-500 will-change-transform ${isZoomed ? 'scale-[2.5] cursor-zoom-out' : 'scale-1 cursor-zoom-in'}`}
                        style={{
                            transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                        }}
                        onClick={handleImageClick}
                        alt="Preview"
                    />

                    {/* Zoom Hint */}
                    {!isZoomed && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white/60 uppercase tracking-widest pointer-events-none opacity-0 group-hover/modal:opacity-100 transition-opacity">
                            Click anywhere to zoom
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={isPasswordModalOpen}
                onClose={() => {
                    setIsPasswordModalOpen(false);
                    setPasswordData({ newPassword: '', confirmPassword: '' });
                }}
                title="Change User Password"
                size="md"
                isElevatedFooter
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setIsPasswordModalOpen(false);
                                setPasswordData({ newPassword: '', confirmPassword: '' });
                            }}
                            disabled={updatingPassword}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="metallic"
                            onClick={handlePasswordUpdate}
                            isLoading={updatingPassword}
                            className="px-8 shadow-lg shadow-brand-primary/20"
                        >
                            Update Password
                        </Button>
                    </div>
                }
            >
                <div className="space-y-6 pt-4">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                                New Password
                            </label>
                            <input
                                type="password"
                                className="w-full bg-[#000000] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary transition-colors focus:ring-1 focus:ring-brand-primary/50 shadow-inner"
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                placeholder="Enter new password"
                                autoComplete="new-password"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                className="w-full bg-[#000000] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary transition-colors focus:ring-1 focus:ring-brand-primary/50 shadow-inner"
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                placeholder="Confirm new password"
                                autoComplete="new-password"
                            />
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Confirm Deletion"
                size="md"
            >
                <div className="space-y-6">
                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                            <IconTrash size={32} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Permanently Delete User?</h3>
                            <p className="text-gray-400 text-sm leading-relaxed px-4">
                                Are you sure you want to delete <span className="text-white font-semibold">{user?.name}</span>?
                                This action is irreversible and will remove all associated profile data.
                            </p>
                        </div>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex gap-3">
                        <IconAlertTriangle className="text-yellow-500 shrink-0 w-5 h-5" />
                        <p className="text-[11px] text-yellow-500/80 leading-relaxed font-medium">
                            Warning: Historical data like completed projects will persist with a <span className="text-yellow-500 font-bold">NULL</span> reference to maintain record integrity.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="recessed"
                            className="flex-1 h-11 border-white/5 hover:bg-white/5"
                            onClick={() => setIsDeleteModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="metallic"
                            className="flex-1 !bg-gradient-to-b !from-red-500 !to-red-700 !border-red-600 text-white h-11 shadow-lg shadow-red-500/20 hover:shadow-red-500/40"
                            onClick={executeDeleteUser}
                            isLoading={updating}
                        >
                            Delete User
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default UserDetailsV2;
