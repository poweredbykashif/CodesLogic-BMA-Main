import React, { useState } from 'react';
import { Card, Modal } from '../components/Surfaces';
import Button from '../components/Button';
import { Input } from '../components/Input';
import { 
    IconPlus,
    IconTrash
} from '../components/Icons';

import { supabase } from '../lib/supabase';
import { addToast } from '../components/Toast';

import { GridPatternCard, GridPatternCardBody } from '../components/ui/card-with-grid-ellipsis-pattern';

const PlatformOverview: React.FC = () => {
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        setIsSubmitting(true);
        try {
            // Insert into applicants table
            const { error: insertError } = await supabase
                .from('account_requests_designers')
                .insert([{
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    email: formData.email,
                    status: 'Pending'
                }]);

            if (insertError) throw insertError;

            addToast({ type: 'success', title: 'Application Sent', message: "We've received your application. We'll get back to you soon!" });
            setIsApplyModalOpen(false);
            setFormData({ firstName: '', lastName: '', email: '' });

        } catch (error: any) {
            console.error('Submission error:', error);
            addToast({ type: 'error', title: 'Submission Failed', message: error.message || 'An error occurred while sending your application.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-surface-bg overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <div className="max-w-5xl mx-auto w-full p-6 lg:p-12 space-y-12 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* Hero Header (Matching Guide) */}
                <GridPatternCard className="rounded-[3rem] border border-white/5 bg-black/60 shadow-2xl p-12 py-24 text-center">
                    <GridPatternCardBody>
                        <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tight uppercase">
                            Designer <span className="text-brand-primary">Onboarding</span>
                        </h1>
                        <p className="mt-4 text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed font-medium">
                            Welcome to our creative ecosystem. Learn how we work, how you get paid, and join our elite team of designers.
                        </p>
                    </GridPatternCardBody>
                </GridPatternCard>

                {/* Youtube Video (Matching Guide) */}
                <section className="space-y-6">
                    <div className="flex items-center gap-4 my-20">
                        <div className="h-px flex-1 bg-white/5" />
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/5 flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                            <h2 className="text-xs font-bold text-gray-300 uppercase tracking-widest">Video Introduction</h2>
                        </div>
                        <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <Card className="overflow-hidden p-0 border-white/10 shadow-2xl bg-black">
                        <div className="aspect-video w-full">
                            <iframe
                                className="w-full h-full"
                                src="https://www.youtube.com/embed/M7lc1UVf-VE?rel=0&modestbranding=1"
                                title="Designer Onboarding Video"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        </div>
                    </Card>
                </section>

                {/* Ready to Get Started? (Matching Guide) */}
                <section className="pt-12">
                    <div className="relative rounded-2xl bg-[#1a1a1a] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] transition-all group border border-white/5">
                        <div className="absolute inset-0 border-[8px] border-white/[0.03] rounded-2xl pointer-events-none z-20" />
                        <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-2xl pointer-events-none z-20" />
                        <div className="absolute inset-0 bg-[#121212] opacity-90" />
                        <div className="absolute top-6 left-6 w-3 h-3 rounded-full bg-gradient-to-br from-white/40 via-white/10 to-transparent border border-white/20 shadow-lg z-30" />
                        <div className="absolute top-6 right-6 w-3 h-3 rounded-full bg-gradient-to-br from-white/40 via-white/10 to-transparent border border-white/20 shadow-lg z-30" />
                        <div className="absolute bottom-6 left-6 w-3 h-3 rounded-full bg-gradient-to-br from-white/40 via-white/10 to-transparent border border-white/20 shadow-lg z-30" />
                        <div className="absolute bottom-6 right-6 w-3 h-3 rounded-full bg-gradient-to-br from-white/40 via-white/10 to-transparent border border-white/20 shadow-lg z-30" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_50%)]" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.02)_0%,transparent_50%)]" />
                        
                        <div className="relative z-10 flex flex-col items-center text-center space-y-8 p-8 lg:p-16">
                            <div className="space-y-4">
                                <h2 className="text-3xl lg:text-5xl font-bold text-white uppercase tracking-tighter">
                                    Ready To Get <span className="text-brand-primary">Started?</span>
                                </h2>
                                <p className="text-gray-400 text-lg max-w-xl mx-auto">
                                    Join our community of world-class designers and start your journey with us today.
                                </p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
                                <Button 
                                    variant="metallic" 
                                    className="px-12 py-4 h-auto text-lg font-black uppercase shadow-xl shadow-brand-primary/20 w-full sm:w-auto"
                                    onClick={() => setIsApplyModalOpen(true)}
                                >
                                    Apply For Account
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

            </div>

            {/* Application Modal (Matching Guide) */}
            <Modal
                isOpen={isApplyModalOpen}
                onClose={() => setIsApplyModalOpen(false)}
                title="Apply as Designer"
                size="md"
                isElevatedHeader
                isElevatedFooter
                footer={
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="recessed"
                            onClick={() => setIsApplyModalOpen(false)}
                            className="px-6"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="metallic"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-8 shadow-lg shadow-brand-primary/20"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Request'}
                        </Button>
                    </div>
                }
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="First Name"
                            placeholder="e.g. John"
                            required
                            variant="recessed"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        />
                        <Input
                            label="Last Name"
                            placeholder="e.g. Doe"
                            required
                            variant="recessed"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="Email"
                            placeholder="yourname@domain.com"
                            required
                            variant="recessed"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="md:col-span-2"
                        />
                    </div>

                </form>
            </Modal>
        </div>
    );
};

export default PlatformOverview;
