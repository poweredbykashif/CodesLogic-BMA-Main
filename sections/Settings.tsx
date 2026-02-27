import React, { useState } from 'react';
import { Permissions } from './Permissions';
import { Card, Modal, ElevatedMetallicCard } from '../components/Surfaces';
import Button from '../components/Button';
import { Input } from '../components/Input';
import { Avatar } from '../components/Avatar';
import { IconUser, IconMail, IconPhone, IconCreditCard, IconLock, IconShield, IconBuilding, IconSettings, IconFileImage, IconMaximize, IconDollar, IconCheck, IconX } from '../components/Icons';
import { Tabs } from '../components/Navigation';
import { Switch } from '../components/Selection';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { addToast } from '../components/Toast';
import { formatDisplayName } from '../utils/formatter';
import { updateRoute, getInitialTab } from '../utils/routing';

export interface SettingsHandle {
    save: () => Promise<void>;
    discard: () => void;
}

const Settings = React.forwardRef<{ save: () => Promise<void>; discard: () => void }, { onBack?: () => void, onDirtyChange?: (isDirty: boolean) => void, profileOnly?: boolean }>(({ onBack, onDirtyChange, profileOnly }, ref) => {
    const { profile, loading, refreshProfile, effectiveRole } = useUser();
    const [settingsTab, setSettingsTab] = useState<'profile' | 'page-access' | 'account-access'>(() => getInitialTab('Settings', 'profile') as any);
    const [updating, setUpdating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [persistedLocalPreview, setPersistedLocalPreview] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordData, setPasswordData] = useState({
        newPassword: '',
        confirmPassword: ''
    });
    const [updatingPassword, setUpdatingPassword] = useState(false);
    const [showEarningsHeader, setShowEarningsHeader] = useState(() => {
        if (typeof window !== 'undefined' && profile?.id) {
            const saved = localStorage.getItem(`nova_show_earnings_${profile.id}`);
            return saved === null ? true : saved === 'true';
        }
        return true;
    });
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => ({
        save: handleSaveSettings,
        discard: handleDiscardChanges
    }));

    const [formData, setFormData] = useState({
        name: '',
        payment_email: '',
        bank_name: '',
        account_title: '',
        iban: ''
    });

    const [avatarDraft, setAvatarDraft] = useState<{ file: File; localUrl: string; publicUrl?: string } | null>(null);

    const isDirty = profile ? (
        formData.name.trim() !== (profile.name || '').trim() ||
        formData.payment_email !== (profile.payment_email || '') ||
        formData.bank_name !== (profile.bank_name || '') ||
        formData.account_title !== (profile.account_title || '') ||
        formData.iban !== (profile.iban || '') ||
        avatarDraft !== null
    ) : false;

    const lastProfileId = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (profile) {
            // Only update form data if it's the first load, a different user, or the form is NOT dirty
            // This prevents overwriting user's unsaved edits during background refreshes (like after avatar upload)
            if (profile.id !== lastProfileId.current || !isDirty) {
                setFormData({
                    name: profile.name || '',
                    payment_email: profile.payment_email || '',
                    bank_name: profile.bank_name || '',
                    account_title: profile.account_title || '',
                    iban: profile.iban || ''
                });
                lastProfileId.current = profile.id;
            }
        }
    }, [profile, isDirty]);

    React.useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    React.useEffect(() => {
        updateRoute('Settings', settingsTab);
    }, [settingsTab]);


    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
            </div>
        );
    }

    const isAdmin = effectiveRole?.toLowerCase() === 'admin';
    const isFreelancer = effectiveRole?.toLowerCase() === 'freelancer';
    const isProjectManager = effectiveRole?.toLowerCase() === 'project manager';
    const isSuperAdmin = effectiveRole === 'Super Admin';

    const handleSaveSettings = async () => {
        if (!profile) return;

        setSaving(true);
        try {
            let finalAvatarUrl = profile.avatar_url;

            // 1. If there's a pending avatar, upload it first
            if (avatarDraft) {
                setUploadingAvatar(true);
                const fileName = `${profile.id}-${Math.random().toString(36).substring(2, 7)}.${avatarDraft.file.name.split('.').pop()}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, avatarDraft.file);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                finalAvatarUrl = data.publicUrl;
                // Update draft with public URL so we can compare later
                setAvatarDraft(prev => prev ? { ...prev, publicUrl: finalAvatarUrl } : null);
            }

            // 2. Update all fields including avatar_url if changed
            const { error } = await supabase
                .from('profiles')
                .update({
                    name: formData.name,
                    payment_email: formData.payment_email,
                    bank_name: formData.bank_name,
                    account_title: formData.account_title,
                    iban: formData.iban,
                    avatar_url: finalAvatarUrl
                })
                .eq('id', profile.id);

            if (error) throw error;

            addToast({ type: 'success', title: 'Settings Saved', message: 'Your profile has been updated successfully.' });

            // 3. Refresh Profile data first
            await refreshProfile();

            // 4. SEAMLESS HANDOFF:
            // Move the draft's local URL to a standby state that doesn't trigger "isDirty"
            // This makes the button disappear immediately while keeping the image visible
            if (avatarDraft) {
                setPersistedLocalPreview(avatarDraft.localUrl);
                setAvatarDraft(null); // Button disappears now because isDirty becomes false
            }

            setUploadingAvatar(false);

        } catch (error: any) {
            console.error('Error saving settings:', error);
            setUploadingAvatar(false);
            addToast({ type: 'error', title: 'Save Failed', message: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDiscardChanges = () => {
        if (profile) {
            setFormData({
                name: profile.name || '',
                payment_email: profile.payment_email || '',
                bank_name: profile.bank_name || '',
                account_title: profile.account_title || '',
                iban: profile.iban || ''
            });
            addToast({ type: 'info', title: 'Changes Discarded', message: 'Form has been reset to your saved data.' });
        }
    };

    const handlePasswordUpdate = async () => {
        if (!passwordData.newPassword || !passwordData.confirmPassword) {
            addToast({ type: 'error', title: 'Validation Error', message: 'Please fill in all fields.' });
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
            const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
            if (error) throw error;

            addToast({ type: 'success', title: 'Password Updated', message: 'Your password has been changed successfully.' });
            setIsPasswordModalOpen(false);
            setPasswordData({ newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            console.error('Error updating password:', error);
            addToast({ type: 'error', title: 'Update Failed', message: error.message });
        } finally {
            setUpdatingPassword(false);
        }
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !profile) return;

        // Cleanup previous draft if any
        if (avatarDraft) URL.revokeObjectURL(avatarDraft.localUrl);

        // Set local draft preview immediately
        const localUrl = URL.createObjectURL(file);
        setAvatarDraft({ file, localUrl });

        addToast({
            type: 'info',
            title: 'Photo Selected',
            message: 'Click "Save Changes" to permanentize your new profile photo.'
        });
    };

    const handleToggleEarningsVisibility = (checked: boolean) => {
        if (!profile?.id) return;
        setShowEarningsHeader(checked);
        localStorage.setItem(`nova_show_earnings_${profile.id}`, String(checked));
        // Dispatch custom event to notify DashboardLayout
        window.dispatchEvent(new CustomEvent('nova_earnings_visibility_updated'));
        addToast({
            type: 'info',
            title: `Earnings ${checked ? 'Visible' : 'Hidden'}`,
            message: `Available earnings will ${checked ? 'now' : 'no longer'} be shown in the header.`
        });
    };

    const tabs = [
        { id: 'profile', label: 'Profile Details', icon: <IconUser size={15} /> },
        { id: 'page-access', label: 'Page Access Rules', icon: <IconShield size={15} /> },
        { id: 'account-access', label: 'Account Scoping', icon: <IconBuilding size={15} /> },
    ];

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                className="hidden"
                accept="image/*"
            />

            {isSuperAdmin && !profileOnly && (
                <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
                    <Tabs
                        tabs={tabs}
                        activeTab={settingsTab}
                        onTabChange={(id) => setSettingsTab(id as any)}
                    />

                    {settingsTab !== 'profile' && (
                        <div className="flex items-center gap-4">
                            {/* These actions will be handled inside the Permissions component via callback or shared state if needed, but for now we let it manage itself */}
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-6">
                {!profile ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-4">
                        <div className="w-10 h-10 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
                        <p className="text-gray-500 text-sm animate-pulse">Initializing your profile...</p>
                    </div>
                ) : (settingsTab === 'page-access' || settingsTab === 'account-access') && isSuperAdmin && !profileOnly ? (
                    <div className="animate-in fade-in duration-500">
                        <Permissions
                            hideTabs
                            activeTab={settingsTab === 'page-access' ? 'page-access' : 'account-access'}
                            onTabChange={(t) => setSettingsTab(t as any)}
                            onSimulate={() => onBack?.()}
                        />
                    </div>
                ) : (
                    <div className="space-y-6 animate-in">
                        <ElevatedMetallicCard
                            title="Public Profile"
                            headerClassName="px-8 py-6"
                            bodyClassName="p-8"
                        >
                            <div className="space-y-8">
                                <div className="flex items-center gap-6">
                                    <Avatar
                                        size="xl"
                                        status="online"
                                        src={avatarDraft?.localUrl || persistedLocalPreview || profile?.avatar_url}
                                        initials={profile?.name ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase() : '??'}
                                        loading={uploadingAvatar}
                                        onLoad={() => {
                                            // Clear the persisted local preview only when the remote one is actually visible
                                            if (persistedLocalPreview && !uploadingAvatar && !avatarDraft) {
                                                console.log('Confirmed: Persistent Avatar loaded. Cleaning up backup preview.');
                                                URL.revokeObjectURL(persistedLocalPreview);
                                                setPersistedLocalPreview(null);
                                            }
                                        }}
                                        onError={() => {
                                            if (persistedLocalPreview && !uploadingAvatar) {
                                                console.error('Remote avatar failed to load, keeping local backup indefinitely.');
                                            }
                                        }}
                                    />
                                    <div className="space-y-3">
                                        <div className="flex gap-3">
                                            <Button
                                                variant="metallic"
                                                size="sm"
                                                onClick={handleAvatarClick}
                                            >
                                                Change Photo
                                            </Button>
                                        </div>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">JPG, GIF or PNG. Max size of 800K</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Input
                                        label="Display Name"
                                        placeholder="E.g. Alex Rivier"
                                        value={isSuperAdmin ? formData.name : formatDisplayName(profile?.name)}
                                        onChange={isSuperAdmin ? (e) => setFormData({ ...formData, name: e.target.value }) : undefined}
                                        readOnly={!isSuperAdmin}
                                        className={!isSuperAdmin ? "cursor-not-allowed" : ""}
                                        variant="metallic"
                                        leftIcon={<IconUser className="w-4 h-4" />}
                                    />
                                    <Input
                                        label="Email Address"
                                        placeholder="E.g. alex@codeslogic.com"
                                        value={profile?.email || ''}
                                        readOnly
                                        className="cursor-not-allowed"
                                        variant="metallic"
                                    />
                                    <Input
                                        label="Job Title / Role"
                                        placeholder="E.g. Designer"
                                        value={effectiveRole || ''}
                                        readOnly
                                        className="cursor-not-allowed"
                                        variant="metallic"
                                    />
                                    {!isAdmin && !isSuperAdmin && (
                                        <Input
                                            label="Phone Number"
                                            value={profile?.phone || 'Not specified'}
                                            readOnly
                                            className="cursor-not-allowed"
                                            variant="metallic"
                                            leftIcon={<IconPhone className="w-4 h-4" />}
                                        />
                                    )}
                                </div>

                                {isSuperAdmin && (isDirty || formData.name.trim() !== (profile?.name || '').trim()) && (
                                    <div className="flex justify-end gap-3 pt-6 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleDiscardChanges}
                                            disabled={saving}
                                            className="px-6"
                                        >
                                            Discard
                                        </Button>
                                        <Button
                                            variant="metallic"
                                            size="sm"
                                            className="px-8"
                                            onClick={handleSaveSettings}
                                            isLoading={saving}
                                        >
                                            Save Changes
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </ElevatedMetallicCard>

                        {/* Payoneer Details card - Only for Freelancers */}
                        {isFreelancer && !isSuperAdmin && profile && (
                            <ElevatedMetallicCard
                                title="Payoneer Details"
                                headerClassName="px-8 py-6"
                                bodyClassName="p-8"
                            >
                                <Input
                                    label="Payoneer / Payment Email"
                                    placeholder="E.g. alex.payoneer@email.com"
                                    value={formData.payment_email}
                                    onChange={(e) => setFormData({ ...formData, payment_email: e.target.value })}
                                    readOnly={isFreelancer}
                                    className={isFreelancer ? "cursor-not-allowed" : ""}
                                    variant="metallic"
                                    leftIcon={<IconMail className="w-4 h-4" />}
                                />
                            </ElevatedMetallicCard>
                        )}

                        {/* Bank Details Section */}
                        {!isAdmin && !isSuperAdmin && (
                            <ElevatedMetallicCard
                                title="Bank Details"
                                headerClassName="px-8 py-6"
                                bodyClassName="p-8"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <Input
                                        label="Bank Name"
                                        placeholder="E.g. Chase Bank"
                                        value={formData.bank_name}
                                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                        readOnly={isFreelancer || isProjectManager}
                                        className={(isFreelancer || isProjectManager) ? "cursor-not-allowed" : ""}
                                        variant="metallic"
                                        leftIcon={<IconCreditCard className="w-4 h-4" />}
                                    />
                                    <Input
                                        label="Account Title"
                                        placeholder="E.g. Alex Rivier"
                                        value={formData.account_title}
                                        onChange={(e) => setFormData({ ...formData, account_title: e.target.value })}
                                        readOnly={isFreelancer || isProjectManager}
                                        className={(isFreelancer || isProjectManager) ? "cursor-not-allowed" : ""}
                                        variant="metallic"
                                    />
                                    <Input
                                        label="IBAN"
                                        placeholder="E.g. GB 123 456 789"
                                        value={formData.iban}
                                        onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                                        readOnly={isFreelancer || isProjectManager}
                                        className={(isFreelancer || isProjectManager) ? "cursor-not-allowed" : ""}
                                        variant="metallic"
                                    />
                                </div>
                            </ElevatedMetallicCard>
                        )}

                        {/* Identity Verification Card - For everyone except Admin */}
                        {!isAdmin && !isSuperAdmin && profile && (
                            <ElevatedMetallicCard
                                title="IDENTITY VERIFICATION"
                                headerClassName="px-8 py-6"
                                bodyClassName="p-8"
                            >
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <div
                                                className="aspect-[1.5/1] rounded-2xl bg-black/40 border border-surface-border overflow-hidden flex items-center justify-center group relative shadow-[inset_0_2px_12px_rgba(0,0,0,0.8)] cursor-pointer"
                                                onClick={() => profile.cnic_front_url && setPreviewImage(profile.cnic_front_url)}
                                            >
                                                {profile.cnic_front_url ? (
                                                    <img src={profile.cnic_front_url} alt="CNIC Front" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className="text-center p-4">
                                                        <IconFileImage className="w-10 h-10 text-gray-800 mx-auto mb-2" />
                                                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">Image missing</span>
                                                    </div>
                                                )}
                                                {profile.cnic_front_url && (
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform duration-300">
                                                            <IconMaximize size={24} />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Click to Expand</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">ID FRONT SIDE</p>
                                        </div>

                                        <div className="space-y-3">
                                            <div
                                                className="aspect-[1.5/1] rounded-2xl bg-black/40 border border-surface-border overflow-hidden flex items-center justify-center group relative shadow-[inset_0_2px_12px_rgba(0,0,0,0.8)] cursor-pointer"
                                                onClick={() => profile.cnic_back_url && setPreviewImage(profile.cnic_back_url)}
                                            >
                                                {profile.cnic_back_url ? (
                                                    <img src={profile.cnic_back_url} alt="CNIC Back" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className="text-center p-4">
                                                        <IconFileImage className="w-10 h-10 text-gray-800 mx-auto mb-2" />
                                                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">Image missing</span>
                                                    </div>
                                                )}
                                                {profile.cnic_back_url && (
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform duration-300">
                                                            <IconMaximize size={24} />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Click to Expand</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">ID BACK SIDE</p>
                                        </div>
                                    </div>
                                </div>
                            </ElevatedMetallicCard>
                        )}

                        {/* Security Section */}
                        <ElevatedMetallicCard
                            title="Security"
                            headerClassName="px-8 py-6"
                            bodyClassName="p-8"
                        >
                            <div className="space-y-6">
                                {isFreelancer && (
                                    <div className="flex items-center justify-between p-4 bg-surface-overlay border border-surface-border rounded-2xl group/toggle transition-colors hover:border-white/10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-brand-success/10 flex items-center justify-center text-brand-success font-bold transition-transform group-hover/toggle:scale-110 duration-300">
                                                <IconDollar className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">Show Available Earnings</p>
                                                <p className="text-xs text-gray-500">Display your ready-for-payout earnings in the header</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={showEarningsHeader}
                                            onChange={handleToggleEarningsVisibility}
                                            variant="metallic"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center justify-between p-4 bg-surface-overlay border border-surface-border rounded-2xl">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold">
                                            <IconSettings className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">Password Management</p>
                                            <p className="text-xs text-gray-500">Secure your account with a strong password</p>
                                        </div>
                                    </div>
                                    <Button variant="metallic" size="sm" onClick={() => setIsPasswordModalOpen(true)}>Update</Button>
                                </div>
                            </div>
                        </ElevatedMetallicCard>

                        {isDirty && !isSuperAdmin && (
                            <div className="flex justify-end gap-3 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <Button variant="ghost" onClick={handleDiscardChanges} disabled={saving}>Discard Changes</Button>
                                <Button
                                    variant="metallic"
                                    className="px-8 shadow-lg shadow-brand-primary/20"
                                    onClick={handleSaveSettings}
                                    isLoading={saving}
                                >
                                    Save All Settings
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Image Preview Modal */}
            <Modal
                isOpen={!!previewImage}
                onClose={() => setPreviewImage(null)}
                title="Document Preview"
                size="lg"
            >
                {previewImage && (
                    <div className="flex items-center justify-center p-4">
                        <img
                            src={previewImage}
                            alt="Preview"
                            className="max-w-full max-h-[70vh] rounded-xl shadow-2xl animate-in zoom-in duration-300"
                        />
                    </div>
                )}
            </Modal>

            {/* Password Update Modal */}
            <Modal
                isOpen={isPasswordModalOpen}
                onClose={() => {
                    setIsPasswordModalOpen(false);
                    setPasswordData({ newPassword: '', confirmPassword: '' });
                }}
                title="Change Password"
                size="md"
                isElevatedFooter
                footer={
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="recessed"
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
                <div className="space-y-6">
                    <div className="p-1 px-2 mb-4 bg-brand-primary/5 border border-brand-primary/10 rounded-xl">
                        <p className="text-[10px] text-brand-primary font-bold uppercase tracking-widest p-2 text-center">
                            Security Tip: Mix symbols, numbers and letters
                        </p>
                    </div>
                    <div className="space-y-4">
                        <Input
                            label="New Password"
                            type="password"
                            variant="metallic"
                            autoComplete="new-password"
                            placeholder="Enter new password"
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            leftIcon={<IconLock className="w-4 h-4" />}
                        />
                        <Input
                            label="Confirm New Password"
                            type="password"
                            variant="metallic"
                            autoComplete="new-password"
                            placeholder="Confirm new password"
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                            leftIcon={<IconLock className="w-4 h-4" />}
                        />
                    </div>
                </div>
            </Modal>
        </div >
    );
});

export default Settings;
