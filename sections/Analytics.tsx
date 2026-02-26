
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Card, Modal } from '../components/Surfaces';
import { Table } from '../components/Table';
import Button from '../components/Button';
import { Tabs } from '../components/Navigation';
import { DatePicker, formatDate as systemFormatDate } from '../components/DatePicker';
import { Dropdown } from '../components/Dropdown';
import { IconCalendar, IconX, IconChartBar, IconClock, IconCheckCircle, IconXCircle, IconMaximize, IconChevronRight, IconDollar, IconLock } from '../components/Icons';
import { useAccounts } from '../contexts/AccountContext';
import { getInitialTab, updateRoute } from '../utils/routing';
import { formatDisplayName } from '../utils/formatter';
import { useUser } from '../contexts/UserContext';

import PerformanceChart, { PerformanceMetric } from '../components/PerformanceChart';

interface AnalyticsProject {
    id: string;
    created_at: string;
    day: string;
    formattedDate: string;
    account_id: string;
    account_name: string;
    client: string;
    agent: string;
    sale: string;
    medium: string;
    price: number;
    status: string;
    cancellation_reason?: string;
    [key: string]: any;
}

const Analytics: React.FC = () => {
    const { profile, hasPermission, effectiveRole } = useUser();
    const isProjectOpsManager = effectiveRole === 'Project Operations Manager';
    const { accounts, loading: accountsLoading } = useAccounts();

    const availableTabs = useMemo(() => {
        const tabs = [];
        if (hasPermission('view_gig_stats')) {
            tabs.push({ id: 'gig-stats', label: 'Gig Stats', icon: <IconChartBar size={16} /> });
        }
        if (hasPermission('view_sales_analytics')) {
            tabs.push({ id: 'sales', label: 'Sales', icon: <IconDollar size={16} /> });
        }
        return tabs;
    }, [hasPermission]);

    const [selectedAccount, setSelectedAccount] = useState('all');

    // Filter toolbar states
    const [fromDate, setFromDate] = useState<Date | null>(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    });
    const [toDate, setToDate] = useState<Date | null>(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    });
    const [activeFilter, setActiveFilter] = useState<string | null>('month');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [projectsData, setProjectsData] = useState<AnalyticsProject[]>([]);
    const [performanceMetricData, setPerformanceMetricData] = useState<PerformanceMetric[]>([]);
    const [activeSummaryFilter, setActiveSummaryFilter] = useState<'pipeline' | 'secured' | 'cancelled'>(getInitialTab('Analytics', 'pipeline') as any);
    const [cancellationReasonModal, setCancellationReasonModal] = useState<{ isOpen: boolean; text: string }>({ isOpen: false, text: '' });
    const [metricsLoading, setMetricsLoading] = useState(true);

    const [activeTab, setActiveTab] = useState(() => {
        return availableTabs[0]?.id || 'gig-stats';
    });

    // Sync active tab if permissions change or on mount
    useEffect(() => {
        if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
            setActiveTab(availableTabs[0].id);
        }
    }, [availableTabs, activeTab]);

    const fetchedRef = useRef(false);
    const metricsInitialized = useRef(false);
    // Refs to always hold latest filter values — avoids stale closures without adding to dep arrays
    const fromDateRef = useRef(fromDate);
    const toDateRef = useRef(toDate);
    const selectedAccountRef = useRef(selectedAccount);
    fromDateRef.current = fromDate;
    toDateRef.current = toDate;
    selectedAccountRef.current = selectedAccount;

    useEffect(() => {
        if (isProjectOpsManager && activeTab !== 'gig-stats') {
            setActiveTab('gig-stats');
        }
    }, [isProjectOpsManager, activeTab]);

    useEffect(() => {
        if (!isProjectOpsManager) {
            updateRoute('Analytics', activeSummaryFilter);
        } else {
            updateRoute('Analytics');
        }
    }, [activeSummaryFilter, isProjectOpsManager]);

    // Sync selectedAccount to ARS once accounts load — then immediately fetch metrics
    useEffect(() => {
        if (accountsLoading || accounts.length === 0) return;
        if (selectedAccount === 'all') {
            const ars = accounts.find(a => a.prefix?.toUpperCase() === 'ARS');
            const id = ars ? ars.id : accounts[0].id;
            selectedAccountRef.current = id; // update ref BEFORE fetch
            setSelectedAccount(id);
            fetchPerformanceMetrics(); // single fetch with correct account
        }
    }, [accountsLoading]);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        loadInitialData();

        // Add real-time subscription to projects table
        const channel = supabase
            .channel('analytics_projects_changes')
            .on(
                'postgres_changes' as any,
                { event: '*', schema: 'public', table: 'projects' },
                () => {
                    fetchProjects();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const loadInitialData = async () => {
        await fetchProjects(true);
    };


    const fetchProjects = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);

            const isSuperAdmin = effectiveRole === 'Super Admin';
            const userRole = effectiveRole?.toLowerCase().trim();

            let query = supabase
                .from('projects')
                .select('*, accounts(prefix, name), primary_manager:primary_manager_id(name)');

            // Granular scoping for non-Super Admins
            const isAdminLike = ['admin', 'project manager', 'project operations manager'].includes(userRole || '');
            if (isAdminLike && !isSuperAdmin) {
                const { data: permittedAccounts } = await supabase
                    .from('user_account_access')
                    .select('account_id')
                    .eq('user_id', profile?.id);

                if (permittedAccounts && permittedAccounts.length > 0) {
                    const accountIds = permittedAccounts.map(pa => pa.account_id);
                    query = query.in('account_id', accountIds);
                } else {
                    setProjectsData([]);
                    return;
                }
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                const enriched = data.map((p, index) => {
                    const createdAt = new Date(p.created_at || Date.now());

                    // Sales logic: Extract from items_sold JSON
                    let saleLabel = '-';
                    if (p.items_sold) {
                        try {
                            const items = p.items_sold.items || [];
                            const other = p.items_sold.other;
                            const allItems = [...items];
                            if (other) allItems.push(other);
                            saleLabel = allItems.join(', ') || '-';
                        } catch (e) {
                            saleLabel = '-';
                        }
                    }

                    return {
                        ...p,
                        day: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(createdAt),
                        formattedDate: systemFormatDate(createdAt),
                        account_name: p.accounts?.prefix?.toUpperCase() || '-',
                        project_id: p.project_id || '-',
                        project_title: p.project_title || '-',
                        sale: saleLabel,
                        medium: p.medium || '-',
                        price: Number(p.price || 0),
                        client: p.client_name || '-',
                        agent: p.primary_manager?.name || p.assignee || '-',
                        freelancer: p.assignee || '-',
                        cancellation_reason: p.cancellation_reason || '-',
                    };
                });
                setProjectsData(enriched);
            }
        } catch (err) {
            console.error('Error fetching analytics projects:', err);
        } finally {
            if (isInitial) setLoading(false);
        }
    };


    const fetchPerformanceMetrics = async () => {
        try {
            setMetricsLoading(true);
            // Read from refs so we always get the latest values
            const fd = fromDateRef.current;
            const td = toDateRef.current;
            const sa = selectedAccountRef.current;

            let query = supabase
                .from('performance_metrics')
                .select('*, accounts(prefix, name), profiles(name)')
                .order('date', { ascending: true });

            if (fd) {
                query = query.gte('date', fd.toISOString().split('T')[0]);
            }
            if (td) {
                query = query.lte('date', td.toISOString().split('T')[0]);
            }
            if (sa && sa !== 'all') {
                query = query.eq('account_id', sa);
            } else if (!fd && !td) {
                query = query.limit(30);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (data) {
                setPerformanceMetricData(data as any);
            }
        } catch (err) {
            console.error('Error fetching performance metrics:', err);
        } finally {
            setMetricsLoading(false);
        }
    };

    // Stable real-time subscription — never re-subscribes on filter changes
    useEffect(() => {
        const subscription = supabase
            .channel('performance_metrics_changes_analytics')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'performance_metrics' },
                () => { fetchPerformanceMetrics(); }
            )
            .subscribe();
        return () => { subscription.unsubscribe(); };
    }, []);

    const handleQuickFilter = (type: string) => {
        const now = new Date();

        if (activeFilter === type) {
            const start = new Date(now);
            start.setDate(now.getDate() - 29);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setHours(23, 59, 59, 999);

            fromDateRef.current = start;
            toDateRef.current = end;
            setFromDate(start);
            setToDate(end);
            setActiveFilter(null);
            fetchPerformanceMetrics();
            return;
        }

        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        let start = new Date(now);
        start.setHours(0, 0, 0, 0);

        if (type === 'today') {
            // Already set
        } else if (type === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            end.setTime(start.getTime());
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (type === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            end.setTime(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime());
        }

        fromDateRef.current = start;
        toDateRef.current = end;
        setFromDate(start);
        setToDate(end);
        setActiveFilter(type);
        fetchPerformanceMetrics();
    };

    const handleAccountChange = (id: string) => {
        selectedAccountRef.current = id;
        setSelectedAccount(id);
        fetchPerformanceMetrics();
    };

    const handleExportCSV = () => {
        if (filteredProjects.length === 0) return;

        const headers = ['S. No.', 'Day', 'Date', 'Account', 'Client', 'Sale', 'Medium', 'Price', 'Status'];
        const csvRows = [headers.join(',')];

        filteredProjects.forEach((p, idx) => {
            const row = [
                idx + 1,
                `"${p.day}"`,
                `"${p.formattedDate}"`,
                `"${p.account_name}"`,
                `"${p.client}"`,
                `"${p.sale}"`,
                `"${p.medium}"`,
                `"${p.price.toFixed(2)}"`,
                `"${p.status}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `analytics_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredProjects = useMemo(() => {
        let filtered = [...projectsData];

        // 1. Date Filter
        if (fromDate || toDate) {
            filtered = filtered.filter(p => {
                const date = new Date(p.created_at);
                if (fromDate && date < fromDate) return false;
                if (toDate && date > toDate) return false;
                return true;
            });
        }

        // 2. Account Filter
        if (selectedAccount !== 'all') {
            filtered = filtered.filter(p => p.account_id === selectedAccount);
        }

        // 3. Status Mapping Logic
        if (activeSummaryFilter === 'pipeline') {
            // In Progress
            filtered = filtered.filter(p => p.status === 'In Progress' || (!p.status && p.action_move === 'Add'));
        } else if (activeSummaryFilter === 'secured') {
            // Approved
            filtered = filtered.filter(p => p.status === 'Approved');
        } else if (activeSummaryFilter === 'cancelled') {
            // Cancelled
            filtered = filtered.filter(p => p.status === 'Cancelled');
        }

        return filtered;
    }, [projectsData, fromDate, toDate, selectedAccount, activeSummaryFilter]);

    const stats = useMemo(() => {
        let base = [...projectsData];
        if (fromDate || toDate) {
            base = base.filter(p => {
                const date = new Date(p.created_at);
                if (fromDate && date < fromDate) return false;
                if (toDate && date > toDate) return false;
                return true;
            });
        }
        if (selectedAccount !== 'all') {
            base = base.filter(p => p.account_id === selectedAccount);
        }

        const pipeline = base.filter(p => p.status === 'In Progress' || (!p.status && p.action_move === 'Add'));
        const secured = base.filter(p => p.status === 'Approved');
        const cancelled = base.filter(p => p.status === 'Cancelled');

        return {
            pipelineRevenue: pipeline.reduce((sum, p) => sum + p.price, 0),
            pipelineCount: pipeline.length,
            securedRevenue: secured.reduce((sum, p) => sum + p.price, 0),
            securedCount: secured.length,
            cancelledRevenue: cancelled.reduce((sum, p) => sum + p.price, 0),
            cancelledCount: cancelled.length
        };
    }, [projectsData, fromDate, toDate, selectedAccount]);

    const accountOptions = useMemo(() => {
        const opts = (accounts || []).map(a => ({
            label: a.name,
            description: a.prefix?.toUpperCase(),
            value: a.id
        }));

        if (activeTab === 'gig-stats') {
            return opts;
        }

        return [{ label: 'All Accounts', value: 'all' }, ...opts];
    }, [accounts, activeTab]);

    if (!loading && availableTabs.length === 0) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-700">
                <div className="w-20 h-20 rounded-3xl bg-brand-primary/10 flex items-center justify-center text-brand-primary border border-brand-primary/20 shadow-2xl shadow-brand-primary/20">
                    <IconLock size={40} />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-black text-white italic tracking-tight">ACCESS RESTRICTED</h3>
                    <p className="text-sm text-gray-500 max-w-xs mx-auto font-medium">You do not have the required permissions to view analytical reports. Please contact your administrator.</p>
                </div>
                <Button variant="metallic" onClick={() => updateRoute('Dashboard')} className="px-8">
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">


            {!isProjectOpsManager && availableTabs.length > 1 && (
                <Tabs
                    tabs={availableTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            )}

            {/* Global Filter Bar */}
            <Card
                isElevated={true}
                disableHover={true}
                className="flex flex-col p-0 border border-white/10 bg-[#1A1A1A] rounded-2xl relative overflow-hidden shadow-nova"
                bodyClassName="flex-1 py-0 px-0 overflow-visible"
            >
                {/* Full Surface Metallic Shine */}
                <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-70" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />

                <div className="p-3 relative z-10 w-full">
                    <div className="w-full flex flex-col xl:flex-row items-center justify-between gap-4 py-1 px-2">
                        {/* Left Side: Date Pickers & Account */}
                        <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                            <DatePicker
                                placeholder="From"
                                value={fromDate}
                                onChange={(date) => {
                                    fromDateRef.current = date;
                                    setFromDate(date);
                                    setActiveFilter(null);
                                    fetchPerformanceMetrics();
                                }}
                            >
                                <div className="relative flex items-center gap-2 bg-black/40 border border-white/[0.05] rounded-xl pl-4 pr-2 py-2.5 text-sm font-bold text-white hover:bg-black/50 transition-all cursor-pointer group shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] overflow-hidden">
                                    {/* Inner Top Shadow for carved-in look */}
                                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
                                    {/* Subtle Diagonal Machined Sheen */}
                                    <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.02)_48%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.02)_52%,transparent_100%)] opacity-30 pointer-events-none" />

                                    <IconCalendar className="w-4 h-4 text-brand-primary group-hover:scale-110 transition-transform relative z-10" />
                                    <span className="min-w-20 relative z-10">{systemFormatDate(fromDate) || 'From Date'}</span>
                                    <div className="flex items-center gap-1.5 relative z-10">
                                        <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                        </svg>
                                        {fromDate && (
                                            <div
                                                className="p-1 rounded-md hover:bg-white/10 text-gray-500 hover:text-brand-primary transition-all pointer-events-auto"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    fromDateRef.current = null;
                                                    setFromDate(null);
                                                    fetchPerformanceMetrics();
                                                }}
                                            >
                                                <IconX className="w-3 h-3" strokeWidth={3} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </DatePicker>
                            <DatePicker
                                placeholder="To"
                                value={toDate}
                                onChange={(date) => {
                                    toDateRef.current = date;
                                    setToDate(date);
                                    setActiveFilter(null);
                                    fetchPerformanceMetrics();
                                }}
                            >
                                <div className="relative flex items-center gap-2 bg-black/40 border border-white/[0.05] rounded-xl pl-4 pr-2 py-2.5 text-sm font-bold text-white hover:bg-black/50 transition-all cursor-pointer group shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] overflow-hidden">
                                    {/* Inner Top Shadow for carved-in look */}
                                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
                                    {/* Subtle Diagonal Machined Sheen */}
                                    <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.02)_48%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.02)_52%,transparent_100%)] opacity-30 pointer-events-none" />

                                    <IconCalendar className="w-4 h-4 text-brand-primary group-hover:scale-110 transition-transform relative z-10" />
                                    <span className="min-w-20 relative z-10">{systemFormatDate(toDate) || 'To Date'}</span>
                                    <div className="flex items-center gap-1.5 relative z-10">
                                        <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                        </svg>
                                        {toDate && (
                                            <div
                                                className="p-1 rounded-md hover:bg-white/10 text-gray-500 hover:text-brand-primary transition-all pointer-events-auto"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toDateRef.current = null;
                                                    setToDate(null);
                                                    fetchPerformanceMetrics();
                                                }}
                                            >
                                                <IconX className="w-3 h-3" strokeWidth={3} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </DatePicker>

                            <div className="h-8 w-px bg-white/10 mx-1 hidden sm:block" />

                            <div className="w-44">
                                <Dropdown
                                    value={selectedAccount}
                                    onChange={(val) => handleAccountChange(val)}
                                    options={accountOptions}
                                    placeholder="All Accounts"
                                    showSearch={true}
                                    menuClassName="!w-[340px]"
                                >
                                    <div className="relative flex items-center justify-between gap-2 bg-black/40 border border-white/[0.05] rounded-xl px-4 h-10 text-sm font-bold text-white hover:bg-black/50 transition-all cursor-pointer group shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] overflow-hidden">
                                        {/* Inner Top Shadow for carved-in look */}
                                        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
                                        {/* Subtle Diagonal Machined Sheen */}
                                        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.02)_48%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.02)_52%,transparent_100%)] opacity-30 pointer-events-none" />

                                        <span className="truncate relative z-10">
                                            {selectedAccount === 'all' ? 'All Accounts' : (accounts.find(acc => acc.id === selectedAccount)?.prefix || 'Account')}
                                        </span>
                                        <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </Dropdown>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 w-full xl:w-auto justify-end overflow-visible">
                            {[
                                { id: 'today', label: 'Today' },
                                { id: 'week', label: 'This Week' },
                                { id: 'month', label: 'This Month' }
                            ].map((filter) => (
                                <div
                                    key={filter.id}
                                    onClick={() => handleQuickFilter(filter.id as any)}
                                    className={`relative flex items-center justify-center bg-black/40 border border-white/[0.05] rounded-xl px-4 h-10 text-[10px] font-black uppercase tracking-[0.1em] transition-all cursor-pointer group shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] overflow-hidden min-w-[90px] ${activeFilter === filter.id
                                        ? 'border-brand-primary/40 bg-brand-primary/5'
                                        : 'hover:bg-black/50 hover:border-white/10'
                                        }`}
                                >
                                    {/* Inner Top Shadow for carved-in look */}
                                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
                                    {/* Subtle Diagonal Machined Sheen */}
                                    <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.02)_48%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.02)_52%,transparent_100%)] opacity-30 pointer-events-none" />

                                    <span className={`relative z-10 transition-colors ${activeFilter === filter.id ? 'text-brand-primary' : 'text-gray-400 group-hover:text-white'
                                        }`}>
                                        {filter.label}
                                    </span>
                                </div>
                            ))}
                            {activeTab !== 'gig-stats' && (
                                <Button
                                    variant="metallic"
                                    size="sm"
                                    leftIcon={<IconChartBar className="w-4 h-4 block" />}
                                    className="whitespace-nowrap h-10 min-h-[40px] px-4 inline-flex items-center justify-center box-border"
                                    onClick={handleExportCSV}
                                >
                                    Export CSV
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {activeTab === 'sales' && !isProjectOpsManager ? (
                <>
                    {/* Summary Statistics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Pipeline Revenue */}
                        <Card
                            isElevated={true}
                            disableHover={activeSummaryFilter === 'pipeline'}
                            className={`h-full p-0 border-2 transition-all group cursor-pointer overflow-hidden ${activeSummaryFilter === 'pipeline'
                                ? 'bg-gradient-to-b from-[#FF6B4B] to-[#D9361A] border-[#FF4D2D] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.2)]'
                                : 'border-white/10 bg-[#1A1A1A] hover:border-brand-primary/30'
                                }`}
                            bodyClassName="h-full"
                            onClick={() => setActiveSummaryFilter('pipeline')}
                        >
                            {/* Full Surface Metallic Shine */}
                            <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-70" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />

                            <div className="p-5 relative z-10 w-full">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${activeSummaryFilter === 'pipeline' ? 'text-white/80' : 'text-gray-400'}`}>Pipeline Revenue</p>
                                        <p className={`text-2xl font-black mb-1 ${activeSummaryFilter === 'pipeline' ? 'text-white' : 'text-brand-warning'}`}>${stats.pipelineRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-tighter ${activeSummaryFilter === 'pipeline' ? 'bg-white/20 border-white/30 text-white' : 'bg-brand-warning/10 border-brand-warning/20 text-brand-warning'}`}>
                                                {stats.pipelineCount} Projects
                                            </span>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${activeSummaryFilter === 'pipeline' ? 'text-white/70' : 'text-gray-500 opacity-60'}`}>In Pipeline</span>
                                        </div>
                                    </div>
                                    <div className={`p-2 rounded-xl border transition-all ${activeSummaryFilter === 'pipeline'
                                        ? 'bg-white/20 border-white/30 text-white'
                                        : 'bg-white/5 border-white/10 text-gray-400 group-hover:bg-brand-primary/10 group-hover:border-brand-primary/20 group-hover:text-brand-primary'
                                        }`}>
                                        <IconClock className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Secured Revenue */}
                        <Card
                            isElevated={true}
                            disableHover={activeSummaryFilter === 'secured'}
                            className={`h-full p-0 border-2 transition-all group cursor-pointer overflow-hidden ${activeSummaryFilter === 'secured'
                                ? 'bg-gradient-to-b from-[#FF6B4B] to-[#D9361A] border-[#FF4D2D] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.2)]'
                                : 'border-white/10 bg-[#1A1A1A] hover:border-brand-primary/30'
                                }`}
                            bodyClassName="h-full"
                            onClick={() => setActiveSummaryFilter('secured')}
                        >
                            {/* Full Surface Metallic Shine */}
                            <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-70" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />

                            <div className="p-5 relative z-10 w-full">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${activeSummaryFilter === 'secured' ? 'text-white/80' : 'text-gray-400'}`}>Secured Revenue</p>
                                        <p className={`text-2xl font-black mb-1 ${activeSummaryFilter === 'secured' ? 'text-white' : 'text-brand-success'}`}>${stats.securedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-tighter ${activeSummaryFilter === 'secured' ? 'bg-white/20 border-white/30 text-white' : 'bg-brand-success/10 border-brand-success/20 text-brand-success'}`}>
                                                {stats.securedCount} Projects
                                            </span>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${activeSummaryFilter === 'secured' ? 'text-white/70' : 'text-gray-500 opacity-60'}`}>Revenue Approved</span>
                                        </div>
                                    </div>
                                    <div className={`p-2 rounded-xl border transition-all ${activeSummaryFilter === 'secured'
                                        ? 'bg-white/20 border-white/30 text-white'
                                        : 'bg-white/5 border-white/10 text-gray-400 group-hover:bg-brand-primary/10 group-hover:border-brand-primary/20 group-hover:text-brand-primary'
                                        }`}>
                                        <IconCheckCircle className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Cancelled Projects */}
                        <Card
                            isElevated={true}
                            disableHover={activeSummaryFilter === 'cancelled'}
                            className={`h-full p-0 border-2 transition-all group cursor-pointer overflow-hidden ${activeSummaryFilter === 'cancelled'
                                ? 'bg-gradient-to-b from-[#FF6B4B] to-[#D9361A] border-[#FF4D2D] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.2)]'
                                : 'border-white/10 bg-[#1A1A1A] hover:border-brand-primary/30'
                                }`}
                            bodyClassName="h-full"
                            onClick={() => setActiveSummaryFilter('cancelled')}
                        >
                            {/* Full Surface Metallic Shine */}
                            <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.02)_100%)] pointer-events-none opacity-70" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />

                            <div className="p-5 relative z-10 w-full">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${activeSummaryFilter === 'cancelled' ? 'text-white/80' : 'text-gray-400'}`}>Cancelled</p>
                                        <p className={`text-2xl font-black mb-1 ${activeSummaryFilter === 'cancelled' ? 'text-white' : 'text-brand-error'}`}>${stats.cancelledRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-tighter ${activeSummaryFilter === 'cancelled' ? 'bg-white/20 border-white/30 text-white' : 'bg-brand-error/10 border-brand-error/20 text-brand-error'}`}>
                                                {stats.cancelledCount} Projects
                                            </span>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${activeSummaryFilter === 'cancelled' ? 'text-white/70' : 'text-gray-500 opacity-60'}`}>Revenue Cancelled</span>
                                        </div>
                                    </div>
                                    <div className={`p-2 rounded-xl border transition-all ${activeSummaryFilter === 'cancelled'
                                        ? 'bg-white/20 border-white/30 text-white'
                                        : 'bg-white/5 border-white/10 text-gray-400 group-hover:bg-brand-primary/10 group-hover:border-brand-primary/20 group-hover:text-brand-primary'
                                        }`}>
                                        <IconXCircle className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <Table<AnalyticsProject>
                            columns={[


                                {
                                    header: 'S. No.',
                                    key: 'sno',
                                    className: 'w-1 whitespace-nowrap px-4',
                                    render: (_, idx) => <span className="text-gray-500 font-medium">{idx + 1}</span>
                                },
                                {
                                    header: 'Project ID',
                                    key: 'project_id',
                                    className: 'whitespace-nowrap'
                                },
                                {
                                    header: 'Project Title',
                                    key: 'project_title',
                                    className: 'font-bold max-w-[200px]',
                                    render: (p) => <span className="text-white truncate block" title={p.project_title}>{p.project_title}</span>
                                },
                                {
                                    header: 'Day',
                                    key: 'day'
                                },
                                {
                                    header: 'Date',
                                    key: 'formattedDate'
                                },
                                {
                                    header: 'Freelancer',
                                    key: 'freelancer'
                                },
                                {
                                    header: 'Client',
                                    key: 'client'
                                },
                                {
                                    header: 'Agent',
                                    key: 'agent'
                                },
                                {
                                    header: 'Sale',
                                    key: 'sale',
                                    className: 'max-w-[150px]'
                                },
                                {
                                    header: 'Medium',
                                    key: 'medium'
                                },
                                {
                                    header: 'Price',
                                    key: 'price',
                                    className: 'text-right',
                                    render: (p) => <span className="text-brand-success font-bold">${p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                },
                                {
                                    header: 'Status',
                                    key: 'status',
                                    render: (p) => {
                                        let statusLabel = p.status || 'In Progress';
                                        let colorClass = 'bg-brand-warning/10 border-brand-warning/20 text-brand-warning';

                                        if (statusLabel === 'Approved') {
                                            colorClass = 'bg-brand-success/10 border-brand-success/20 text-brand-success';
                                        } else if (statusLabel === 'Cancelled') {
                                            colorClass = 'bg-brand-error/10 border-brand-error/20 text-brand-error';
                                        }

                                        return (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-tighter ${colorClass}`}>
                                                {statusLabel}
                                            </span>
                                        );
                                    }
                                },
                                ...(activeSummaryFilter === 'cancelled' ? [{
                                    header: 'Cancellation Reason',
                                    key: 'cancellation_reason',
                                    className: 'max-w-[200px]',
                                    render: (p: AnalyticsProject) => (
                                        <div className="flex items-center justify-between gap-2 group/reason">
                                            <span className="text-gray-400 truncate block text-xs flex-1" title={p.cancellation_reason}>
                                                {p.cancellation_reason}
                                            </span>
                                            {p.cancellation_reason && p.cancellation_reason !== '-' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setCancellationReasonModal({ isOpen: true, text: p.cancellation_reason! });
                                                    }}
                                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-brand-error/10 border border-brand-error/20 text-brand-error hover:bg-brand-error/20 transition-all ml-2 shrink-0 group-hover/btn:scale-105"
                                                    title="View Full Reason"
                                                >
                                                    <IconChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                                                </button>
                                            )}
                                        </div>
                                    )
                                }] : [])
                            ]}
                            data={filteredProjects}
                            isLoading={loading}
                            isMetallicHeader={true}
                        />
                    </div>
                </>
            ) : (
                <div className="space-y-6">
                    <PerformanceChart data={performanceMetricData} isLoading={metricsLoading} />

                    {/* Detailed Metrics Table */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Daily Performance Log</h3>
                        </div>
                        <Table
                            columns={[
                                {
                                    header: 'Date',
                                    key: 'date',
                                    render: (row) => <span className="text-gray-300">{systemFormatDate(new Date(row.date))}</span>
                                },
                                {
                                    header: 'Account',
                                    key: 'account',
                                    render: (row) => <span className="text-brand-primary font-bold uppercase tracking-wider">{row.accounts?.prefix?.toUpperCase() || '-'}</span>
                                },
                                {
                                    header: 'Success Score',
                                    key: 'success_score',
                                    render: (row) => <span className="text-white font-bold">{row.success_score || '-'}</span>
                                },
                                {
                                    header: 'Rating',
                                    key: 'rating',
                                    render: (row) => <span className="text-white">{row.rating || '-'}</span>
                                },
                                {
                                    header: 'CTR',
                                    key: 'ctr',
                                    render: (row) => <span className="text-yellow-400 font-bold">{row.ctr ? `${row.ctr}%` : '-'}</span>
                                },
                                {
                                    header: 'Conv. Rate',
                                    key: 'conversion_rate',
                                    render: (row) => <span className="text-purple-400 font-bold">{row.conversion_rate ? `${row.conversion_rate}%` : '-'}</span>
                                },
                                {
                                    header: 'Impressions',
                                    key: 'impressions',
                                    render: (row) => <span className="text-gray-300">{row.impressions || 0}</span>
                                },
                                {
                                    header: 'Clicks',
                                    key: 'clicks',
                                    render: (row) => <span className="text-blue-400">{row.clicks || 0}</span>
                                },
                                {
                                    header: 'Orders',
                                    key: 'orders',
                                    render: (row) => <span className="text-green-400 font-bold">{row.orders || 0}</span>
                                },
                                {
                                    header: 'Cancelled',
                                    key: 'cancelled_orders',
                                    render: (row) => <span className="text-red-400 font-bold">{row.cancelled_orders || 0}</span>
                                },
                                {
                                    header: 'Filled By',
                                    key: 'user_id',
                                    render: (row) => <span className="text-sm text-gray-300">{formatDisplayName(row.profiles?.name) || '—'}</span>
                                },
                            ]}
                            data={[...performanceMetricData].reverse()}
                            isLoading={metricsLoading}
                            isMetallicHeader={true}
                        />
                    </div>
                </div>
            )
            }

            <Modal
                isOpen={cancellationReasonModal.isOpen}
                onClose={() => setCancellationReasonModal({ isOpen: false, text: '' })}
                title="Cancellation Reason"
                size="sm"
                isElevatedFooter
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <Button
                            variant="metallic"
                            onClick={() => setCancellationReasonModal({ isOpen: false, text: '' })}
                        >
                            Close
                        </Button>
                    </div>
                }
            >
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {cancellationReasonModal.text}
                    </p>
                </div>
            </Modal>
        </div >
    );
};

export default Analytics;
