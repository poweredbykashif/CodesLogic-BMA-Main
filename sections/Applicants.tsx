import React, { useState, useEffect, useMemo } from 'react';
import { Card, Modal } from '../components/Surfaces';
import Button from '../components/Button';
import { Table } from '../components/Table';
import { Input } from '../components/Input';
import { Dropdown } from '../components/Dropdown';
import { IconSearch, IconUser, IconExternalLink, IconMessageSquare, IconChevronRight, IconFileText, IconFilter, IconUsers, IconClock, IconCheckCircle, IconX } from '../components/Icons';
import { addToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';

interface Applicant {
    id: string;
    first_name: string;
    last_name: string;
    whatsapp: string;
    email: string;
    cv_file_url: string;
    portfolio_links: string[];
    position: string;
    created_at: string;
    status: string;
}

const Applicants: React.FC = () => {
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [positionFilter, setPositionFilter] = useState<string[]>([]);
    const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'Total' | 'Pending' | 'Approved' | 'Rejected'>('Total');
    const [generatedCredentials, setGeneratedCredentials] = useState<{ email: string, pass: string } | null>(null);


    const positionOptions = [
        { label: 'Designer', value: 'Designer' },
        { label: 'Project Manager', value: 'Project Manager' },
        { label: 'Project Operations Manager', value: 'Project Operations Manager' },
        { label: 'Finance Manager', value: 'Finance Manager' }
    ];

    const fetchApplicants = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('applicants')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setApplicants(data || []);
        } catch (error: any) {
            console.error('Error fetching applicants:', error);
            addToast({ type: 'error', title: 'Fetch Failed', message: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchApplicants();
    }, []);

    const stats = useMemo(() => {
        return {
            total: applicants.length,
            pending: applicants.filter(a => a.status === 'Pending').length,
            approved: applicants.filter(a => a.status === 'Approved').length,
            rejected: applicants.filter(a => a.status === 'Rejected').length
        };
    }, [applicants]);

    const handleApprove = async () => {
        if (!selectedApplicant) return;
        setIsProcessing(true);
        try {
            // 1. Generate a random password
            const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
            let retVal = "";
            for (let i = 0, n = charset.length; i < 10; ++i) {
                retVal += charset.charAt(Math.floor(Math.random() * n));
            }
            const tempPassword = retVal;

            // 2. Create non-persisted client for Auth registration
            const tempClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                }
            );

            // 3. Register User
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: selectedApplicant.email.trim(),
                password: tempPassword,
                options: {
                    data: {
                        full_name: `${selectedApplicant.first_name} ${selectedApplicant.last_name}`,
                        role: 'Freelancer',
                    }
                }
            });

            if (authError) throw authError;

            if (authData.user) {
                // 4. Create Profile with pre-filled data (especially WhatsApp)
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([{
                        id: authData.user.id,
                        email: selectedApplicant.email.trim(),
                        name: `${selectedApplicant.first_name} ${selectedApplicant.last_name}`,
                        first_name: selectedApplicant.first_name,
                        last_name: selectedApplicant.last_name,
                        role: 'Freelancer',
                        whatsapp_number: selectedApplicant.whatsapp, // Pre-filling phone number
                        status: 'Invited' 
                    }]);

                if (profileError) throw profileError;
            }

            // 5. Update Applicant Status
            const { error: statusError } = await supabase
                .from('applicants')
                .update({ status: 'Approved' })
                .eq('id', selectedApplicant.id);

            if (statusError) throw statusError;

            setGeneratedCredentials({ email: selectedApplicant.email, pass: tempPassword });
            addToast({ type: 'success', title: 'Applicant Approved', message: 'Account created and credentials generated.' });
            fetchApplicants();
            
        } catch (error: any) {
            console.error('Approval error:', error);
            addToast({ type: 'error', title: 'Approval Failed', message: error.message });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedApplicant) return;
        setIsProcessing(true);
        try {
            const { error } = await supabase
                .from('applicants')
                .update({ status: 'Rejected' })
                .eq('id', selectedApplicant.id);

            if (error) throw error;
            addToast({ type: 'info', title: 'Applicant Rejected', message: 'The application status has been updated to Rejected.' });
            fetchApplicants();
            setSelectedApplicant(null);
        } catch (error: any) {
            addToast({ type: 'error', title: 'Action Failed', message: error.message });
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredApplicants = useMemo(() => {
        let filtered = applicants;

        // Apply Status Filter (from Cards)
        if (filterStatus !== 'Total') {
            filtered = filtered.filter(a => a.status === filterStatus);
        }

        // Apply Search Filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(a =>
                `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
                a.email.toLowerCase().includes(q) ||
                a.whatsapp.toLowerCase().includes(q) ||
                a.position.toLowerCase().includes(q)
            );
        }

        // Apply Position Filter
        if (positionFilter.length > 0) {
            filtered = filtered.filter(a => positionFilter.includes(a.position));
        }

        return filtered;
    }, [applicants, searchQuery, positionFilter]);

    const columns = [
        {
            header: 'Name',
            key: 'name',
            className: 'min-w-[200px]',
            render: (item: Applicant) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-white/90">
                        {item.first_name} {item.last_name}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">{item.email}</span>
                </div>
            )
        },
        {
            header: 'WhatsApp',
            key: 'whatsapp',
            render: (item: Applicant) => <span className="text-gray-400 font-medium">{item.whatsapp}</span>
        },
        {
            header: 'Position',
            key: 'position',
            render: (item: Applicant) => (
                <span className="px-3 py-1 rounded-md bg-brand-primary/10 text-brand-primary text-[10px] font-black uppercase tracking-wider">
                    {item.position}
                </span>
            )
        },
        {
            header: 'Resume',
            key: 'cv_file_url',
            render: (item: Applicant) => (
                item.cv_file_url ? (
                    <a 
                        href={item.cv_file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-brand-primary hover:bg-brand-primary/10 hover:border-brand-primary/30 transition-all duration-300 group/link"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <IconFileText size={14} className="text-brand-primary/70 group-hover/link:text-brand-primary transition-colors" />
                        <span className="text-[11px] font-black uppercase tracking-wider">Resume</span>
                    </a>
                ) : <span className="text-gray-600 text-[11px] font-bold uppercase tracking-widest opacity-30">No Resume</span>
            )
        },
        {
            header: 'Submission Date',
            key: 'created_at',
            render: (item: Applicant) => (
                <span className="text-gray-400 font-medium">
                    {new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(item.created_at))}
                </span>
            )
        },
        {
            header: '',
            key: 'actions',
            className: 'w-10 text-right',
            render: () => (
                <div className="flex justify-end pr-2">
                    <div className="p-2 rounded-lg bg-white/5 text-gray-500 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-all duration-300">
                        <IconChevronRight size={18} />
                    </div>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-10">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Applicants', value: stats.total, icon: <IconUsers />, color: 'text-blue-400', type: 'Total' },
                    { label: 'Pending Review', value: stats.pending, icon: <IconClock />, color: 'text-amber-400', type: 'Pending' },
                    { label: 'Approved', value: stats.approved, icon: <IconCheckCircle />, color: 'text-green-400', type: 'Approved' },
                    { label: 'Rejected', value: stats.rejected, icon: <IconX />, color: 'text-red-400', type: 'Rejected' },
                ].map((stat, i) => (
                    <button 
                        key={i} 
                        onClick={() => setFilterStatus(stat.type as any)}
                        className={`group relative text-left outline-none focus:ring-0 transition-all duration-300 ${filterStatus === stat.type ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}
                    >
                        <Card isElevated={filterStatus === stat.type} className={`p-6 border-white/10 bg-black/40 overflow-hidden relative transition-all duration-500 ${filterStatus === stat.type ? 'ring-2 ring-brand-primary/40 ring-offset-2 ring-offset-black' : ''}`}>
                            {/* Glow Effect when active */}
                            {filterStatus === stat.type && (
                                <div className="absolute inset-0 bg-brand-primary/5 animate-pulse" />
                            )}
                            
                            <div className="flex items-center justify-between relative z-10">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{stat.label}</p>
                                    <p className="text-3xl font-black text-white tracking-tight">{stat.value}</p>
                                </div>
                                <div className={`w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center transition-all duration-500 ${stat.color} ${filterStatus === stat.type ? 'bg-brand-primary/10 border-brand-primary/20 scale-110' : 'group-hover:scale-110'}`}>
                                    {React.cloneElement(stat.icon as React.ReactElement, { size: 24 } as any)}
                                </div>
                            </div>
                        </Card>
                    </button>
                ))}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-end gap-3">
                <div className="w-full md:w-64">
                    <Dropdown
                        isMulti
                        options={positionOptions}
                        value={positionFilter}
                        onChange={(val) => setPositionFilter(val as string[])}
                        placeholder="Filter by Position"
                        variant="recessed"
                        size="sm"
                    />
                </div>
                <div className="relative w-full md:w-80">
                    <Input
                        placeholder="Search applicants..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        leftIcon={<IconSearch size={18} />}
                        variant="recessed"
                        size="sm"
                        className="w-full"
                    />
                </div>
            </div>

            <Table
                columns={columns}
                data={filteredApplicants}
                isLoading={isLoading}
                onRowClick={setSelectedApplicant}
                isMetallicHeader={true}
                emptyMessage="No applications found"
            />

            <Modal
                isOpen={!!selectedApplicant}
                onClose={() => setSelectedApplicant(null)}
                title="Applicant Details"
                size="md"
                isElevatedHeader={true}
                isElevatedFooter={true}
                footer={
                    <div className="flex justify-between items-center w-full">
                        <div className="flex gap-3">
                            {selectedApplicant?.status === 'Pending' && !generatedCredentials && (
                                <>
                                    <Button 
                                        variant="recessed" 
                                        onClick={handleReject}
                                        disabled={isProcessing}
                                        className="px-6 border-red-500/20 text-red-400 hover:bg-red-500/10"
                                    >
                                        Reject
                                    </Button>
                                    <Button 
                                        variant="metallic" 
                                        onClick={handleApprove}
                                        disabled={isProcessing}
                                        className="px-8 shadow-lg shadow-brand-primary/20"
                                    >
                                        {isProcessing ? 'Processing...' : 'Approve Application'}
                                    </Button>
                                </>
                            )}
                        </div>
                        <Button 
                            variant="recessed" 
                            onClick={() => {
                                setSelectedApplicant(null);
                                setGeneratedCredentials(null);
                            }}
                            className="px-8"
                        >
                            Close
                        </Button>
                    </div>
                }
            >
                {selectedApplicant && (
                    <div className="space-y-6">
                        {generatedCredentials && (
                            <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20 animate-in zoom-in-95 duration-500">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400 shrink-0">
                                        <IconCheckCircle size={24} />
                                    </div>
                                    <div className="space-y-4 flex-1">
                                        <div>
                                            <h4 className="text-white font-black uppercase tracking-wider">Account Created Successfully</h4>
                                            <p className="text-xs text-gray-400 mt-1">Please provide these credentials to the designer. They can now login and complete their profile.</p>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Login Email</p>
                                                <p className="text-sm font-bold text-white truncate">{generatedCredentials.email}</p>
                                            </div>
                                            <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Initial Password</p>
                                                <p className="text-sm font-bold text-brand-primary font-mono">{generatedCredentials.pass}</p>
                                            </div>
                                        </div>
                                        <Button 
                                            variant="recessed" 
                                            size="sm"
                                            onClick={() => {
                                                const text = `Welcome to CodesLogic!\n\nYour account has been approved.\nEmail: ${generatedCredentials.email}\nPassword: ${generatedCredentials.pass}\nLogin: ${window.location.origin}/signin`;
                                                navigator.clipboard.writeText(text);
                                                addToast({ type: 'success', title: 'Copied', message: 'Credentials copied to clipboard.' });
                                            }}
                                            className="w-full text-[10px] h-9"
                                        >
                                            Copy Welcome Message
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary text-2xl font-black">
                                {selectedApplicant.first_name?.[0]}{selectedApplicant.last_name?.[0]}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase">{selectedApplicant.first_name} {selectedApplicant.last_name}</h2>
                                <p className="text-gray-400">{selectedApplicant.email}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <Card isElevated={true} className="p-0 border-white/10 bg-black/40 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.02)_100%)] pointer-events-none" />
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />
                                    <div className="p-4 relative z-10">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Position</p>
                                        <p className="text-brand-primary font-bold">{selectedApplicant.position}</p>
                                    </div>
                                </Card>
                                <Card isElevated={true} className="p-0 border-white/10 bg-black/40 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.02)_100%)] pointer-events-none" />
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />
                                    <div className="p-4 relative z-10">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">WhatsApp</p>
                                        <p className="text-white font-bold">{selectedApplicant.whatsapp}</p>
                                    </div>
                                </Card>
                                <Card isElevated={true} className="p-0 border-white/10 bg-black/40 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.02)_100%)] pointer-events-none" />
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />
                                    <div className="p-4 relative z-10">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Submission Date</p>
                                        <p className="text-white font-bold">
                                            {new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(selectedApplicant.created_at))}
                                        </p>
                                    </div>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {selectedApplicant.cv_file_url && (
                                    <a 
                                        href={selectedApplicant.cv_file_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="group relative"
                                    >
                                        <Card isElevated={true} className="p-0 border-white/10 bg-black/40 hover:bg-black/60 transition-all cursor-pointer overflow-hidden">
                                            {/* Metallic Shine Overlay */}
                                            <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity" />
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />
                                            
                                            <div className="p-5 flex items-center justify-between relative z-10">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-brand-primary shadow-inner group-hover:scale-110 transition-transform duration-500">
                                                        <IconFileText size={24} />
                                                    </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-white uppercase tracking-wider text-sm">Professional Resume</span>
                                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Application Document</span>
                                                        </div>
                                                </div>
                                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 group-hover:text-brand-primary group-hover:border-brand-primary/30 transition-all duration-300">
                                                    <IconChevronRight size={20} />
                                                </div>
                                            </div>
                                        </Card>
                                    </a>
                                )}

                                {selectedApplicant.portfolio_links && selectedApplicant.portfolio_links.length > 0 && (
                                    <div className="space-y-4 pt-2">
                                        <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] opacity-50">
                                            Portfolio Showcase
                                        </h3>
                                        <div className="space-y-3">
                                            {selectedApplicant.portfolio_links.map((link, idx) => (
                                                <a 
                                                    key={idx}
                                                    href={link.startsWith('http') ? link : `https://${link}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="group relative block"
                                                >
                                                    <Card isElevated={true} className="p-0 border-white/10 bg-black/40 hover:bg-black/60 transition-all cursor-pointer overflow-hidden">
                                                        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity" />
                                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />
                                                        
                                                        <div className="p-5 flex items-center justify-between relative z-10">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                                                    <IconExternalLink size={24} />
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-black text-white uppercase tracking-wider text-sm truncate max-w-[350px]">{link}</span>
                                                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Project Portfolio</span>
                                                                </div>
                                                            </div>
                                                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 group-hover:text-brand-primary group-hover:border-brand-primary/30 transition-all duration-300">
                                                                <IconChevronRight size={20} />
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Applicants;
