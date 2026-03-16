import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { Modal } from '../components/Surfaces';
import Button from '../components/Button';
import { Input } from '../components/Input';
import { supabase } from '../lib/supabase';
import { addToast } from '../components/Toast';
import { IconClock, IconZap, IconTrendingUp, IconCalendar, IconTicket, IconPlay } from '../components/Icons';
import { ElevatedMetallicCard } from '../components/Surfaces';
import { formatDeadlineDate } from '../utils/formatter';
import { DatePicker } from '../components/DatePicker';
import { TimeSelect } from '../components/TimeSelect';

const Dashboard: React.FC = () => {
    const { profile, effectiveRole, refreshProfile } = useUser();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [capacity, setCapacity] = useState('5');
    const [saving, setSaving] = useState(false);
    const [initialTicket, setInitialTicket] = useState<any>(null);
    const [isIncreaseModalOpen, setIsIncreaseModalOpen] = useState(false);
    const [newCapacity, setNewCapacity] = useState('');
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [startTime, setStartTime] = useState('');
    const [submittingTicket, setSubmittingTicket] = useState(false);

    const fetchInitialTicket = async () => {
        if (!profile?.id || effectiveRole?.toLowerCase() !== 'freelancer') return;
        
        try {
            const { data, error } = await supabase
                .from('freelancer_capacity_tickets')
                .select('start_datetime')
                .eq('freelancer_id', profile.id)
                .eq('ticket_type', 'initial_capacity')
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (error) {
                console.error('Error fetching initial ticket:', error);
                return;
            }
            
            if (data) {
                setInitialTicket(data);
            }
        } catch (err) {
            console.error('Catch fetching initial ticket:', err);
        }
    };

    useEffect(() => {
        fetchInitialTicket();
    }, [profile?.id, effectiveRole, profile?.daily_capacity]);

    useEffect(() => {
        // Only show for Freelancers which have null daily_capacity
        if (effectiveRole?.toLowerCase() === 'freelancer' && profile && profile.daily_capacity === null) {
            setIsModalOpen(true);
        }
    }, [profile, effectiveRole]);

    const handleSaveCapacity = async () => {
        if (!profile) return;
        const val = parseInt(capacity);
        if (isNaN(val) || val <= 0) {
            addToast({ type: 'error', title: 'Invalid Capacity', message: 'Please enter a valid number greater than 0.' });
            return;
        }

        if (!startDate || !startTime) {
            addToast({ type: 'error', title: 'Missing Info', message: 'Please specify start date and time.' });
            return;
        }

        setSaving(true);
        try {
            // Combine date and time into a proper ISO string based on user's local selection
            const dateStr = startDate.toLocaleDateString('en-CA'); // Gets YYYY-MM-DD consistently
            const startDateTime = new Date(`${dateStr} ${startTime}`).toISOString();

            // 1. Create approved ticket record
            const { error: ticketError } = await supabase
                .from('freelancer_capacity_tickets')
                .insert([{
                    freelancer_id: profile.id,
                    daily_capacity: val,
                    start_datetime: startDateTime,
                    ticket_type: 'initial_capacity',
                    status: 'approved'
                }]);

            if (ticketError) throw ticketError;

            // 2. Update profile
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ 
                    daily_capacity: val,
                    updated_at: new Date().toISOString()
                })
                .eq('id', profile.id);

            if (profileError) throw profileError;

            addToast({ type: 'success', title: 'Profile Updated', message: `Your daily capacity has been set to ${val} projects.` });
            setIsModalOpen(false);
            await refreshProfile();
            await fetchInitialTicket();
        } catch (error: any) {
            console.error('Error setting capacity:', error);
            addToast({ type: 'error', title: 'Error', message: error.message || 'Failed to set capacity.' });
        } finally {
            setSaving(false);
        }
    };

    const handleRequestIncrease = async () => {
        if (!profile) return;
        const val = parseInt(newCapacity);
        if (isNaN(val) || val <= (profile.daily_capacity || 0)) {
            addToast({ type: 'error', title: 'Invalid capacity', message: `Please enter a value higher than your current capacity (${profile.daily_capacity || 0}).` });
            return;
        }

        setSubmittingTicket(true);
        try {
            const { error } = await supabase
                .from('freelancer_capacity_tickets')
                .insert([{
                    freelancer_id: profile.id,
                    daily_capacity: val,
                    start_datetime: new Date().toISOString(), // Requested to start now/soon
                    ticket_type: 'increase_capacity',
                    status: 'pending'
                }]);

            if (error) throw error;

            addToast({ type: 'success', title: 'Request Sent', message: 'Your capacity increase request has been submitted for approval.' });
            setIsIncreaseModalOpen(false);
            setNewCapacity('');
        } catch (error: any) {
            console.error('Error requesting increase:', error);
            addToast({ type: 'error', title: 'Error', message: error.message || 'Failed to submit request.' });
        } finally {
            setSubmittingTicket(false);
        }
    };
const VideoPreview: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const videoId = "M7lc1UVf-VE";
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    return (
        <ElevatedMetallicCard
            title={
                <div className="flex items-center gap-2">
                    <IconPlay className="w-4 h-4 text-brand-primary" />
                    <span className="text-sm font-bold text-brand-primary uppercase tracking-wider">Training & Onboarding</span>
                </div>
            }
            className="h-full group"
            bodyClassName="p-0 overflow-hidden"
        >
            <div className="aspect-video relative bg-black/40">
                {!isPlaying ? (
                    <div 
                        className="absolute inset-0 cursor-pointer overflow-hidden"
                        onClick={() => setIsPlaying(true)}
                    >
                        <img 
                            src={thumbnailUrl} 
                            alt="Training Thumbnail" 
                            className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
                        />
                        {/* Shimmer Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        
                        {/* Play Button */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-brand-primary flex items-center justify-center shadow-[0_0_30px_rgba(255,77,45,0.4)] group-hover:scale-110 transition-transform duration-300">
                                <IconPlay className="w-8 h-8 text-white fill-white ml-1" />
                            </div>
                        </div>

                        <div className="absolute bottom-6 left-6 right-6">
                            <p className="text-sm font-bold text-white uppercase tracking-wider mb-1">Watch Training Guide</p>
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Learn how to use the dashboard effectively</p>
                        </div>
                    </div>
                ) : (
                    <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                        title="Training Video"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                )}
            </div>
        </ElevatedMetallicCard>
    );
};

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
            {effectiveRole?.toLowerCase() === 'freelancer' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <ElevatedMetallicCard
                            title={
                                <div className="flex items-center gap-2">
                                    <IconTicket className="w-4 h-4 text-brand-primary" />
                                    <span className="text-sm font-bold text-brand-primary uppercase tracking-wider">Daily Project Capacity</span>
                                </div>
                            }
                            className="h-full"
                            bodyClassName="p-6"
                        >
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active Limit</p>
                                        <p className="text-2xl font-black text-white">
                                            {profile?.daily_capacity || 0} <span className="text-sm font-medium text-gray-500">projects / day</span>
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                        <IconTrendingUp className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 py-4 border-y border-white/5">
                                    <div className="p-2 rounded-lg bg-white/5 text-gray-400">
                                        <IconCalendar size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Allocation Start</p>
                                        <p className="text-sm font-bold text-white">
                                            {initialTicket?.start_datetime ? formatDeadlineDate(initialTicket.start_datetime) : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    variant="metallic"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => setIsIncreaseModalOpen(true)}
                                >
                                    Increase Limit
                                </Button>
                            </div>
                        </ElevatedMetallicCard>
                    </div>

                    <div className="lg:col-span-2">
                        {effectiveRole?.toLowerCase() === 'super admin' && <VideoPreview />}
                    </div>
                </div>
            )}

            {/* Dashboard Content will be implemented here */}
            {effectiveRole?.toLowerCase() !== 'freelancer' && (
                <div className="space-y-8">
                    {effectiveRole?.toLowerCase() === 'super admin' && (
                        <div className="max-w-3xl mx-auto">
                            <VideoPreview />
                        </div>
                    )}
                    <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
                        <h2 className="text-xl font-bold text-white mb-2">Workspace Overview</h2>
                        <p className="text-gray-500 max-w-sm">We are currently restructuring the internal analytics modules. Stay tuned for deeper business insights.</p>
                    </div>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => {}} // User MUST set capacity
                title="Onboarding Project Capacity"
                size="md"
                isElevatedFooter
                isElevatedHeader
                closeOnOutsideClick={false}
                footer={
                    <div className="flex justify-center w-full">
                        <Button
                            variant="metallic"
                            onClick={handleSaveCapacity}
                            isLoading={saving}
                            className="px-8 min-w-[200px]"
                        >
                            Submit Ticket
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-col items-center text-center py-4">
                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary mb-6 animate-pulse">
                        <IconClock className="w-8 h-8" />
                    </div>
                    
                    <div className="space-y-2 mb-8">
                        <h3 className="text-xl font-bold text-white">Setup Your Initial Capacity</h3>
                        <p className="text-sm text-gray-400 leading-relaxed max-w-[340px]">
                            Specify when you're ready to start receiving projects and your daily handle limit.
                        </p>
                    </div>

                    <div className="w-full space-y-4 px-6">
                        <div className="grid grid-cols-2 gap-4 text-left">
                            <DatePicker
                                label="Start Date"
                                variant="metallic"
                                placeholder="Select Date"
                                value={startDate}
                                onChange={(date) => setStartDate(date)}
                                disabled={saving}
                            />
                            <TimeSelect
                                label="Start Time"
                                variant="metallic"
                                placeholder="Select Time"
                                value={startTime}
                                onChange={(time) => setStartTime(time)}
                                disabled={saving}
                                applyLabel="Apply Date"
                            />
                        </div>
                        <Input
                            label="Daily Projects"
                            type="number"
                            variant="metallic"
                            placeholder="How many projects can you handle a day?"
                            value={capacity}
                            onChange={(e) => setCapacity(e.target.value)}
                            className="text-center"
                            inputClassName="text-center text-2xl font-black"
                            min={1}
                        />
                    </div>
                </div>
            </Modal>

            {/* Increase Limit Modal */}
            <Modal
                isOpen={isIncreaseModalOpen}
                onClose={() => setIsIncreaseModalOpen(false)}
                title="Request Capacity Increase"
                size="sm"
                isElevatedFooter
                isElevatedHeader
                footer={
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="recessed"
                            onClick={() => setIsIncreaseModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="metallic"
                            onClick={handleRequestIncrease}
                            isLoading={submittingTicket}
                            className="px-8"
                        >
                            Submit Request
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-col items-center text-center py-4">
                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary mb-6">
                        <IconTrendingUp className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Grow Your Workload</h3>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-[280px] mb-8">
                        Ready for more? Request an increase to your daily project limit. Your request will be reviewed by the operations team.
                    </p>
                    
                    <div className="w-full max-w-[200px]">
                        <Input
                            label="New Daily Limit"
                            type="number"
                            variant="metallic"
                            value={newCapacity}
                            onChange={(e) => setNewCapacity(e.target.value)}
                            className="text-center"
                            inputClassName="text-center text-2xl font-black"
                            placeholder={`${(profile?.daily_capacity || 0) + 5}`}
                            min={(profile?.daily_capacity || 0) + 1}
                        />
                    </div>
                    <p className="mt-4 text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                        Current Limit: {profile?.daily_capacity || 0}
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default Dashboard;
