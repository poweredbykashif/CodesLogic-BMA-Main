import React, { useState, useEffect, useMemo } from 'react';
import { Card, Modal } from '../components/Surfaces';
import Button from '../components/Button';
import { Table } from '../components/Table';
import { Input } from '../components/Input';
import { Dropdown } from '../components/Dropdown';
import { IconSearch, IconUser, IconExternalLink, IconMessageSquare, IconChevronRight, IconFileText, IconFilter } from '../components/Icons';
import { addToast } from '../components/Toast';
import { supabase } from '../lib/supabase';

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

    const filteredApplicants = useMemo(() => {
        let filtered = applicants;

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
                    <div className="flex justify-end w-full">
                        <Button 
                            variant="metallic" 
                            onClick={() => setSelectedApplicant(null)}
                            className="px-8 shadow-lg"
                        >
                            Close
                        </Button>
                    </div>
                }
            >
                {selectedApplicant && (
                    <div className="space-y-6">
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
