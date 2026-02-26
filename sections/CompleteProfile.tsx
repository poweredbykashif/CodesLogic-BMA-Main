import React, { useState } from 'react';
import Button from '../components/Button';
import { Input } from '../components/Input';
import { UploadPreview } from '../components/UploadPreview';
import { addToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { uploadToR2 } from '../lib/s3';


interface CompleteProfileProps {
    role: string | null;
    initialStatus?: string | null;
    onComplete: (isInvited: boolean) => void;
    onBack?: () => void;
}

const getSteps = (role: string | null) => {
    const roleLower = role?.toLowerCase();

    // Admins only need to upload a profile picture
    if (roleLower === 'admin' || roleLower === 'super admin') {
        return [
            { id: 'profile-pic', title: 'Profile Picture', subtitle: 'Upload a professional photo for your ID' }
        ];
    }

    const isFreelancer = roleLower === 'freelancer';
    const steps = [
        { id: 'profile-pic', title: 'Profile Picture', subtitle: 'Upload a professional photo for your profile' },
        { id: 'phone', title: 'Phone Number', subtitle: 'Provide your WhatsApp or direct contact number' },
        { id: 'bank', title: 'Bank Details', subtitle: 'Add your primary bank account for payments' },
    ];

    if (isFreelancer) {
        steps.push(
            { id: 'payoneer', title: 'Payoneer Details', subtitle: 'Provide your Payoneer associated email address' }
        );
    }

    // Identity verification for everyone except Admins
    steps.push({ id: 'cnic', title: 'Identity Verification', subtitle: 'Upload your government issued ID card' });

    return steps;
};

const CompleteProfile: React.FC<CompleteProfileProps> = ({ role, initialStatus, onComplete, onBack }) => {
    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const { refreshProfile } = useUser();

    // Form Data State
    const [profilePic, setProfilePic] = useState<string | null>(localStorage.getItem('nova_draft_profilePic'));
    const [phone, setPhone] = useState(localStorage.getItem('nova_draft_phone') || '');
    const [bankName, setBankName] = useState(localStorage.getItem('nova_draft_bankName') || '');
    const [accountTitle, setAccountTitle] = useState(localStorage.getItem('nova_draft_accountTitle') || '');
    const [iban, setIban] = useState(localStorage.getItem('nova_draft_iban') || '');
    const [payoneerEmail, setPayoneerEmail] = useState(localStorage.getItem('nova_draft_payoneerEmail') || '');
    const [cnicFront, setCnicFront] = useState<string | null>(localStorage.getItem('nova_draft_cnicFront'));
    const [cnicBack, setCnicBack] = useState<string | null>(localStorage.getItem('nova_draft_cnicBack'));

    // Persist to localStorage
    React.useEffect(() => {
        if (profilePic) localStorage.setItem('nova_draft_profilePic', profilePic);
        localStorage.setItem('nova_draft_phone', phone);
        localStorage.setItem('nova_draft_bankName', bankName);
        localStorage.setItem('nova_draft_accountTitle', accountTitle);
        localStorage.setItem('nova_draft_iban', iban);
        localStorage.setItem('nova_draft_payoneerEmail', payoneerEmail);
        if (cnicFront) localStorage.setItem('nova_draft_cnicFront', cnicFront);
        if (cnicBack) localStorage.setItem('nova_draft_cnicBack', cnicBack);
    }, [profilePic, phone, bankName, accountTitle, iban, payoneerEmail, cnicFront, cnicBack]);

    // Clear draft on success
    const clearDraft = () => {
        const keys = [
            'nova_draft_profilePic', 'nova_draft_phone', 'nova_draft_bankName',
            'nova_draft_accountTitle', 'nova_draft_iban', 'nova_draft_payoneerEmail',
            'nova_draft_cnicFront', 'nova_draft_cnicBack'
        ];
        keys.forEach(k => localStorage.removeItem(k));
    };

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [activeSetter, setActiveSetter] = useState<((val: string | null) => void) | null>(null);
    const [activeField, setActiveField] = useState<string | null>(null);
    const [uploadingField, setUploadingField] = useState<string | null>(null);

    const steps = getSteps(role);
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === steps.length - 1;

    const handleUpload = (setter: (val: string | null) => void, fieldName: string) => {
        setActiveSetter(() => setter);
        setActiveField(fieldName);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && activeSetter && activeField) {
            setUploadingField(activeField);

            try {
                const { data: { session } } = await supabase.auth.getSession();
                const userId = session?.user.id || 'anonymous';

                const fileExt = file.name.split('.').pop();
                const fileName = `${userId}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

                // Organize in folders
                const folder = activeField === 'profile-pic' ? 'avatars' : 'documents';
                const filePath = `${folder}/${fileName}`;

                console.log(`Uploading ${activeField} to R2:`, filePath);
                const publicUrl = await uploadToR2(file, filePath);

                // Pre-load image to ensure it's ready for preview before finishing loading state
                const img = new Image();
                const imageReady = new Promise((resolve, reject) => {
                    img.onload = () => resolve(true);
                    img.onerror = () => reject(new Error('Failed to load image preview from R2'));
                    img.src = publicUrl;
                });

                await imageReady;
                activeSetter(publicUrl);

                addToast({
                    type: 'success',
                    title: 'File Uploaded',
                    message: `${activeField.replace('-', ' ')} uploaded successfully.`
                });
            } catch (error: any) {
                console.error('Upload error:', error);
                addToast({
                    type: 'error',
                    title: 'Upload Failed',
                    message: error.message || 'Failed to upload file.'
                });
            } finally {
                setUploadingField(null);
            }
        }
        if (event.target) event.target.value = '';
    };


    const handleNext = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation for the current step
        const stepId = steps[currentStep].id;
        let isValid = true;
        let errorMessage = '';

        if (stepId === 'profile-pic' && !profilePic) {
            isValid = false;
            errorMessage = 'Please upload a profile picture to continue.';
        } else if (stepId === 'phone' && (!phone || phone.trim().length < 7)) {
            isValid = false;
            errorMessage = 'Please enter a valid phone number.';
        } else if (stepId === 'bank' && (!bankName.trim() || !accountTitle.trim() || !iban.trim())) {
            isValid = false;
            errorMessage = 'Please fill in all bank account details.';
        } else if (stepId === 'payoneer' && (!payoneerEmail.trim() || !payoneerEmail.includes('@'))) {
            isValid = false;
            errorMessage = 'Please enter a valid Payoneer email address.';
        } else if (stepId === 'cnic' && (!cnicFront || !cnicBack)) {
            isValid = false;
            errorMessage = 'Please upload both front and back sides of your ID card.';
        }

        if (!isValid) {
            addToast({
                type: 'error',
                title: 'Required Fields',
                message: errorMessage
            });
            return;
        }

        if (isLastStep) {
            setLoading(true);

            try {
                // Get current session
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;

                if (!user) {
                    throw new Error('Your session has expired or you are not logged in. Please sign in again.');
                }

                // Extract first_name and last_name from user metadata (set during signup)
                const firstName = user.user_metadata?.first_name || '';
                const lastName = user.user_metadata?.last_name || '';

                // Fallback: if no metadata, extract from email
                const emailName = user.email?.split('@')[0] || 'User';

                const isAppAdmin = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'super admin';
                const isInvited = initialStatus === 'Invited';

                // Upsert profile data to handle both new users and invited users (who already have a profile row)
                const { error } = await supabase
                    .from('profiles')
                    .upsert([
                        {
                            id: user.id,
                            email: user.email,
                            name: firstName && lastName ? `${firstName} ${lastName}` : emailName,
                            first_name: firstName || emailName,
                            last_name: lastName || '',
                            role: role,
                            status: (isAppAdmin || isInvited) ? 'Active' : 'Pending', // Admins and Invited users are active immediately
                            phone: (isAppAdmin || isInvited) ? (phone || '') : phone,
                            payment_email: (isAppAdmin || isInvited) ? (payoneerEmail || user.email) : (payoneerEmail || user.email),
                            avatar_url: profilePic,
                            bank_name: bankName,
                            account_title: accountTitle,
                            iban: iban,
                            // In a real app, these would be URLs from Supabase Storage
                            cnic_front_url: isAppAdmin ? null : cnicFront,
                            cnic_back_url: isAppAdmin ? null : cnicBack,
                            created_at: new Date().toISOString()
                        }
                    ], { onConflict: 'id' });

                if (error) throw error;

                clearDraft();
                await refreshProfile();

                addToast({
                    type: 'success',
                    title: 'Profile Submitted',
                    message: (isAppAdmin || isInvited) ? 'Your profile has been activated.' : 'Your profile has been submitted for admin review.',
                });

                onComplete(isInvited);
            } catch (error: any) {
                console.error('Error saving profile:', error);
                addToast({
                    type: 'error',
                    title: 'Submission Failed',
                    message: error.message || 'Failed to save profile. Please try again.',
                });
            } finally {
                setLoading(false);
            }
        } else {
            setCurrentStep((prev) => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep === 0) {
            onBack?.();
        } else {
            setCurrentStep((prev) => Math.max(0, prev - 1));
        }
    };

    const renderStepContent = () => {
        const stepId = steps[currentStep].id;

        switch (stepId) {
            case 'profile-pic':
                return (
                    <div className="flex flex-col md:flex-row gap-12 md:gap-16 items-center justify-center py-6">
                        <div className="flex flex-col gap-4 items-center justify-center order-2 md:order-1">
                            <UploadPreview
                                variant="circular"
                                status={uploadingField === 'profile-pic' ? 'uploading' : profilePic ? 'success' : 'idle'}
                                imageSrc={profilePic || undefined}
                                onUpload={() => handleUpload(setProfilePic, 'profile-pic')}
                                onRemove={() => setProfilePic(null)}
                                onReplace={() => handleUpload(setProfilePic, 'profile-pic')}
                            />
                            <p className="text-sm font-medium text-gray-400">Click to upload your photo</p>
                        </div>

                        <div className="flex flex-col gap-4 items-center justify-center py-8 order-1 md:order-2">
                            <div className="w-full max-w-[160px] aspect-square rounded-full border-2 border-brand-success/50 overflow-hidden shadow-[inset_0_4px_12px_rgba(0,0,0,0.6)] relative group">
                                {/* Diagonal Metallic Shine Effect */}
                                <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.02)_48%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.02)_52%,transparent_100%)] opacity-30 pointer-events-none z-10" />
                                {/* Inner Top Shadow for depth */}
                                <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-black/60 to-transparent opacity-60 pointer-events-none z-10" />
                                <img
                                    src="/example-profile.jpg"
                                    alt="Ideal Profile Example"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <p className="text-sm font-medium text-brand-success">Ideal Example Visual</p>
                        </div>
                    </div>
                );
            case 'phone':
                return (
                    <div className="w-full">
                        <Input
                            label="Phone Number"
                            placeholder="9234198331534"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            variant="metallic"
                            required
                        />
                    </div>
                );
            case 'bank':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="Bank Name"
                            placeholder="e.g. Chase Bank"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            variant="metallic"
                            required
                        />
                        <Input
                            label="Account Title"
                            placeholder="Full Name on Account"
                            value={accountTitle}
                            onChange={(e) => setAccountTitle(e.target.value)}
                            variant="metallic"
                            required
                        />
                        <div className="md:col-span-2">
                            <Input
                                label="IBAN / Account Number"
                                placeholder="International Bank Account Number"
                                value={iban}
                                onChange={(e) => setIban(e.target.value)}
                                variant="metallic"
                                required
                            />
                        </div>
                    </div>
                );
            case 'payoneer':
                return (
                    <Input
                        label="Payoneer Email"
                        type="email"
                        placeholder="email@example.com"
                        value={payoneerEmail}
                        onChange={(e) => setPayoneerEmail(e.target.value)}
                        variant="metallic"
                        required
                    />
                );
            case 'cnic':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-sm font-medium text-gray-400 mb-2">CNIC Front</p>
                            <UploadPreview
                                variant="rectangular"
                                status={uploadingField === 'cnic-front' ? 'uploading' : cnicFront ? 'success' : 'idle'}
                                imageSrc={cnicFront || undefined}
                                onUpload={() => handleUpload(setCnicFront, 'cnic-front')}
                                onRemove={() => setCnicFront(null)}
                                onReplace={() => handleUpload(setCnicFront, 'cnic-front')}
                            />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 mb-2">CNIC Back</p>
                            <UploadPreview
                                variant="rectangular"
                                status={uploadingField === 'cnic-back' ? 'uploading' : cnicBack ? 'success' : 'idle'}
                                imageSrc={cnicBack || undefined}
                                onUpload={() => handleUpload(setCnicBack, 'cnic-back')}
                                onRemove={() => setCnicBack(null)}
                                onReplace={() => handleUpload(setCnicBack, 'cnic-back')}
                            />
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const progressPercentage = ((currentStep + 1) / steps.length) * 100;

    return (
        <div className="w-full max-w-4xl bg-surface-card border border-surface-border rounded-3xl shadow-2xl mx-auto animate-in fade-in zoom-in-95 duration-500 overflow-hidden my-10 relative">
            {/* Metallic Header */}
            <div className="relative z-20 w-full border-b border-surface-border bg-white/[0.01] p-8 overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-60" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1)_0%,transparent_70%)] pointer-events-none" />

                <div className="relative z-10 text-center">
                    <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-1">{steps[currentStep].title}</h2>
                    <p className="text-sm text-gray-400 font-medium">{steps[currentStep].subtitle}</p>
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />

            {/* Body */}
            <div className="px-8 py-10 lg:px-10 mt-1">
                <div className="min-h-[300px] flex flex-col justify-center">
                    {renderStepContent()}
                </div>
            </div>

            {/* Metallic Footer */}
            <div className="px-8 py-6 lg:px-10 lg:py-8 border-t border-white/[0.05] bg-white/[0.03] rounded-b-3xl relative overflow-hidden">
                {/* Full Surface Metallic Shine */}
                <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-40" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />

                <div className="relative z-10 flex justify-end items-center gap-4">
                    <Button
                        type="button"
                        variant="recessed"
                        onClick={handleBack}
                        className="px-8 py-3 uppercase tracking-wider font-bold"
                    >
                        Back
                    </Button>

                    <Button
                        variant="metallic"
                        className="w-full md:w-auto px-12 py-3 shadow-lg shadow-brand-primary/20 transition-all font-bold uppercase tracking-wider"
                        onClick={handleNext}
                        isLoading={loading}
                    >
                        {isLastStep ? 'Complete Setup' : 'Next Step'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CompleteProfile;
