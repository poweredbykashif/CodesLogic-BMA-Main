
import React, { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../lib/supabase';
import { Tabs, Pagination } from '../components/Navigation';
import Button from '../components/Button';
import { Table } from '../components/Table';
import { IconPlus, IconSearch, IconEye, IconTrash, IconAlertTriangle, IconInfo, IconX, IconFile, IconFileText, IconFileImage, IconFileVideo, IconFileArchive, IconCalendar, IconMaximize, IconChevronRight, IconRefreshCw } from '../components/Icons';
import { Modal } from '../components/Surfaces';
import { Input, TextArea } from '../components/Input';
import { DatePicker } from '../components/DatePicker';
import { formatDeadlineDate, formatTime, getTimeLeft, formatDisplayName, truncateByWords } from '../utils/formatter';
import { Calendar } from '../components/Calendar';
import { TimeSelect } from '../components/TimeSelect';
import { Dropdown } from '../components/Dropdown';
import { Radio, Checkbox } from '../components/Selection';
import { addToast } from '../components/Toast';
import { getInitialTab, updateRoute } from '../utils/routing';
import { useNotifications } from '../contexts/NotificationContext';
import { triggerWebhooks } from '../utils/webhookTrigger';
import { useUser } from '../contexts/UserContext';
import { getStatusCapsuleClasses } from '../components/Badge';
import { useAccounts } from '../contexts/AccountContext';
import ReactMarkdown from 'react-markdown';
import { markdownComponents, markdownPlugins, parseCodesLogicMarkdown } from './ProjectDetails';

interface ProjectsProps {
    onProjectOpen?: (id: string, data?: any) => void;
    isProjectOpen?: boolean;
}

export interface ProjectsHandle {
    refresh: () => void;
    switchToStatusTab: (status: string) => void;
}

const Projects = forwardRef<ProjectsHandle, ProjectsProps>(({ onProjectOpen, isProjectOpen }, ref) => {
    useImperativeHandle(ref, () => ({
        refresh: () => {
            fetchProjects();
            fetchTabCounts();
        },
        switchToStatusTab: (status: string) => {
            const tabId = Object.keys(statusMap).find(key => statusMap[key] === status);
            if (tabId) {
                setActiveTab(tabId);
            }
        }
    }));
    const initialTab = getInitialTab('Projects', 'all');
    const [activeTab, setActiveTab] = useState(initialTab);

    // Track last successful fetch to prevent redundant calls
    const lastFetchParamsRef = useRef<string>('{}');

    // Map tab IDs to their corresponding data status
    const statusMap: Record<string, string> = useMemo(() => ({
        all: '',
        progress: 'In Progress',
        revision: 'Revision',
        'revision-urgent': 'Revision Urgent',
        urgent: 'Urgent',
        approval: 'Sent For Approval',
        cancelled: 'Cancelled',
        done: 'Done',
        'revision-done': 'Revision Done',
        'revision-urgent-done': 'Revision Urgent Done',
        'urgent-done': 'Urgent Done',
        approved: 'Approved'
    }), []);

    useEffect(() => {
        // Only update route when no project is open to avoid overwriting project URLs
        if (!isProjectOpen) {
            updateRoute('Projects', activeTab);
        }
    }, [activeTab, isProjectOpen]);

    useEffect(() => {
        const handlePopState = () => {
            setActiveTab(getInitialTab('Projects', 'all'));
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedMove, setSelectedMove] = useState<string | null>(null);
    const [orderType, setOrderType] = useState<string | null>(null);
    const [price, setPrice] = useState('');
    const [soldItems, setSoldItems] = useState<string[]>([]);
    const [otherSoldText, setOtherSoldText] = useState('');
    const { accounts, loading: accountsLoading } = useAccounts();
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [logoNoType, setLogoNoType] = useState<string | null>(null);
    const [manualLogoNo, setManualLogoNo] = useState('');
    const [clientType, setClientType] = useState<string | null>(null);
    const [clientName, setClientName] = useState('');
    const [previousLogoNo, setPreviousLogoNo] = useState('');
    const [medium, setMedium] = useState<string | null>(null);
    const [projectTitle, setProjectTitle] = useState('');
    const [projectBriefText, setProjectBriefText] = useState('');
    const [projectBriefFiles, setProjectBriefFiles] = useState<File[]>([]);
    const [optionsRequired, setOptionsRequired] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [addons, setAddons] = useState<string[]>([]);
    const [addonsOther, setAddonsOther] = useState('');
    const [isBriefExpanded, setIsBriefExpanded] = useState(false);
    const [briefMode, setBriefMode] = useState<'edit' | 'preview'>('edit');
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [dueTime, setDueTime] = useState('');
    const [activeShortcut, setActiveShortcut] = useState<number | null>(null);
    const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
    const [removalReason, setRemovalReason] = useState<string | null>(null);
    const [removalOtherText, setRemovalOtherText] = useState('');
    const [removeProjectId, setRemoveProjectId] = useState('');
    const [cancellationReason, setCancellationReason] = useState<string | null>(null);
    const [cancellationOtherText, setCancellationOtherText] = useState('');
    const [cancelProjectId, setCancelProjectId] = useState('');
    const [approveTips, setApproveTips] = useState<string | null>(null);
    const [approveAmount, setApproveAmount] = useState('');
    const [approveProjectId, setApproveProjectId] = useState('');
    const [showReview, setShowReview] = useState(false);
    const [isReviewLoading, setIsReviewLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isStatusExpanded, setIsStatusExpanded] = useState(false);
    const [teamMembers, setTeamMembers] = useState<any[]>([]); // Current filtered freelancers
    const [allFreelancers, setAllFreelancers] = useState<any[]>([]); // Source of truth for all freelancers
    const [freelancerWorkload, setFreelancerWorkload] = useState<Record<string, { assigned: number, inProgress: number }>>({});
    const [pmCollaborators, setPmCollaborators] = useState<any[]>([]); // Project Managers for collaborators
    const [convertedBy, setConvertedBy] = useState<string | null>(null);
    const [teamPMs, setTeamPMs] = useState<any[]>([]); // Project Managers for "Converted By" dropdown
    const [searchQuery, setSearchQuery] = useState('');
    const [alertFilter, setAlertFilter] = useState<'dispute' | 'arthelp' | null>(null);

    // Permission Cache Context (Optimizes main query by preventing re-fetches)
    const [permittedAccounts, setPermittedAccounts] = useState<string[] | null>(null);
    const [collabProjectIds, setCollabProjectIds] = useState<string[] | null>(null);
    const [pmAccountIds, setPmAccountIds] = useState<string[] | null>(null);
    const [isPermissionsLoading, setIsPermissionsLoading] = useState(false);

    const [tableData, setTableData] = useState<any[] | null>(() => {
        // Try page-specific cache first (defaults to page 1)
        const pageCache = localStorage.getItem(`nova_projects_cache_${initialTab}_page_1`);
        if (pageCache) return JSON.parse(pageCache);

        const cached = localStorage.getItem(`nova_projects_cache_${initialTab}`);
        if (!cached) {
            const legacy = localStorage.getItem('nova_projects_cache');
            return legacy ? JSON.parse(legacy) : null;
        }
        return JSON.parse(cached);
    });
    // Stale-while-revalidate: if we have cached data, don't show skeleton on initial load
    const [loading, setLoading] = useState(() => {
        const hasTabCache = !!localStorage.getItem(`nova_projects_cache_${initialTab}`);
        const hasLegacyCache = !!localStorage.getItem('nova_projects_cache');
        return !(hasTabCache || hasLegacyCache);
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');


    const { profile, effectiveRole, hasPermission } = useUser();
    const userRole = effectiveRole?.toLowerCase().trim() || '';
    const isProjectManager = userRole.includes('manager') || userRole.includes('admin') || userRole.includes('operations');
    const isFreelancer = userRole.includes('freelancer') || userRole.includes('designer') || userRole.includes('presentation');
    const { addNotification } = useNotifications();

    const ITEMS_PER_PAGE = 8;
    const [totalCount, setTotalCount] = useState<number>(() => {
        const cached = localStorage.getItem(`nova_projects_total_count_${initialTab}`);
        return cached ? parseInt(cached) : 0;
    });
    const [projectCounts, setProjectCounts] = useState<Record<string, number>>(() => {
        const cached = localStorage.getItem('nova_projects_counts_cache');
        return cached ? JSON.parse(cached) : {};
    });

    const row1Tabs = useMemo(() => [
        { id: 'progress', label: `In Progress${projectCounts['progress'] > 0 ? ` ${projectCounts['progress']}` : ''}` },
        { id: 'revision', label: `Revision${projectCounts['revision'] > 0 ? ` ${projectCounts['revision']}` : ''}` },
        { id: 'revision-urgent', label: `Revision Urgent${projectCounts['revision-urgent'] > 0 ? ` ${projectCounts['revision-urgent']}` : ''}` },
        { id: 'urgent', label: `Urgent${projectCounts['urgent'] > 0 ? ` ${projectCounts['urgent']}` : ''}` },
        { id: 'approval', label: `Sent For Approval${projectCounts['approval'] > 0 ? ` ${projectCounts['approval']}` : ''}` },
        { id: 'cancelled', label: `Cancelled${projectCounts['cancelled'] > 0 ? ` ${projectCounts['cancelled']}` : ''}` },
    ], [projectCounts]);

    const row2Tabs = useMemo(() => [
        { id: 'all', label: `All${projectCounts['all'] > 0 ? ` ${projectCounts['all']}` : ''}` },
        { id: 'done', label: `Done${projectCounts['done'] > 0 ? ` ${projectCounts['done']}` : ''}` },
        { id: 'revision-done', label: `Revision Done${projectCounts['revision-done'] > 0 ? ` ${projectCounts['revision-done']}` : ''}` },
        { id: 'revision-urgent-done', label: `Revision Urgent Done${projectCounts['revision-urgent-done'] > 0 ? ` ${projectCounts['revision-urgent-done']}` : ''}` },
        { id: 'urgent-done', label: `Urgent Done${projectCounts['urgent-done'] > 0 ? ` ${projectCounts['urgent-done']}` : ''}` },
        { id: 'approved', label: `Approved${projectCounts['approved'] > 0 ? ` ${projectCounts['approved']}` : ''}` },
    ], [projectCounts]);

    // 0. Permission Pre-Query Logic (Cache in memory to avoid blocking latency)
    useEffect(() => {
        if (!profile?.id || !userRole || effectiveRole === 'Super Admin') return;

        async function prefetchPermissions() {
            setIsPermissionsLoading(true);
            try {
                const isAdminLike = ['admin', 'project operations manager'].includes(userRole);
                const isPM = userRole === 'project manager';
                const isFreelancer = ['freelancer', 'designer', 'presentation', 'graphic designer', 'presentation designer'].some(r => userRole.includes(r));

                const queries: Promise<any>[] = [];

                // All non-super-admins need collaboration checks
                queries.push(supabase.from('project_collaborators').select('project_id').eq('member_id', profile.id) as any);

                if (isAdminLike) {
                    queries.push(supabase.from('user_account_access').select('account_id').eq('user_id', profile.id) as any);
                }

                if (isPM) {
                    queries.push(supabase.from('team_members').select('team_id').eq('member_id', profile.id) as any);
                }

                const results = await Promise.all(queries);

                // Result 0 is ALWAYS collaboration
                setCollabProjectIds(results[0].data?.map((c: any) => c.project_id) || []);

                if (isAdminLike) {
                    // Result 1 is account access
                    setPermittedAccounts(results[1].data?.map((pa: any) => pa.account_id) || []);
                }

                if (isPM) {
                    const pmResultIndex = isAdminLike ? 2 : 1;
                    const userTeams = results[pmResultIndex]?.data || [];
                    if (userTeams.length > 0) {
                        const teamIds = userTeams.map((t: any) => t.team_id);
                        const { data: teamAccountLinks } = await supabase
                            .from('team_accounts').select('account_id').in('team_id', teamIds);
                        if (teamAccountLinks) {
                            setPmAccountIds([...new Set(teamAccountLinks.map((ta: any) => ta.account_id))]);
                        } else {
                            setPmAccountIds([]);
                        }
                    } else {
                        setPmAccountIds([]);
                    }
                }
            } catch (err) {
                console.error('Permission prefetch error:', err);
                // Fallback to empty arrays to unblock the main query
                setPermittedAccounts([]);
                setCollabProjectIds([]);
                setPmAccountIds([]);
            } finally {
                setIsPermissionsLoading(false);
            }
        }

        prefetchPermissions();
    }, [profile?.id, userRole, effectiveRole]);


    const isPermissionsReady = useMemo(() => {
        if (effectiveRole === 'Super Admin') return true;
        // Ready if we have at least started storing data (empty array means no access, but valid)
        return permittedAccounts !== null || collabProjectIds !== null || pmAccountIds !== null;
    }, [permittedAccounts, collabProjectIds, pmAccountIds, effectiveRole]);


    async function fetchProjects(isInitial = false) {
        if (!profile || !effectiveRole) {
            setLoading(false);
            return;
        }

        try {
            // Stale-while-revalidate: only show skeleton if we have NO cached data
            const hasCachedData = !!localStorage.getItem('nova_projects_cache');
            if (isInitial && !hasCachedData) setLoading(true);

            // 0. Ensure permissions are loaded before proceeding (unless Super Admin)
            const isSuperAdmin = effectiveRole === 'Super Admin';
            if (!isSuperAdmin && !permittedAccounts && !collabProjectIds && !pmAccountIds) {
                // If permissions haven't even started loading, or we're waiting for them
                // fetchProjects will be re-triggered by the permissions useEffect anyway
                return;
            }

            const from = (currentPage - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            let query = supabase
                .from('projects_list_view')
                .select('project_id, project_title, status, assignee, client_name, client_type, price, designer_fee, due_date, due_time, created_at, account_id, account, has_dispute, has_art_help', { count: (debouncedSearchQuery.trim() || alertFilter) ? 'exact' : undefined });

            // 1. Role-based filtering logic
            const isAdminLike = ['admin', 'super admin', 'project operations manager'].includes(userRole || '');
            const isPM = userRole === 'project manager';
            const isFreelancer = ['freelancer', 'designer', 'presentation', 'graphic designer', 'presentation designer'].some(r => userRole?.includes(r));

            if (isAdminLike && !isSuperAdmin) {
                const accIds = permittedAccounts || [];
                const projIds = collabProjectIds || [];

                if (accIds.length > 0 || projIds.length > 0) {
                    const orConditions: string[] = [];
                    if (accIds.length > 0) orConditions.push(`account_id.in.(${accIds.map(id => `"${id}"`).join(',')})`);
                    if (projIds.length > 0) orConditions.push(`project_id.in.(${projIds.map(id => `"${id}"`).join(',')})`);
                    query = query.or(orConditions.join(','));
                } else {
                    setTableData([]);
                    setLoading(false);
                    return;
                }
                query = query.neq('status', 'Removed');

            } else if (isSuperAdmin) {
                // Super Admin — no filters needed except removing hidden
                query = query.neq('status', 'Removed');

            } else if (isPM) {
                const projIds = collabProjectIds || [];
                const accIds = pmAccountIds || [];

                if (accIds.length > 0 || projIds.length > 0) {
                    const orParts: string[] = [];
                    if (accIds.length > 0) orParts.push(`account_id.in.(${accIds.map(id => `"${id}"`).join(',')})`);
                    if (projIds.length > 0) orParts.push(`project_id.in.(${projIds.map(id => `"${id}"`).join(',')})`);
                    query = query.or(orParts.join(',')).neq('status', 'Removed');
                } else {
                    setTableData([]);
                    setTotalCount(0);
                    setLoading(false);
                    return;
                }

            } else if (isFreelancer) {
                const projIds = collabProjectIds || [];
                const freelancerName = profile.name || profile.email;

                let filterStr = `assignee.eq."${freelancerName}",assignee.eq."${profile.email}"`;
                if (projIds.length > 0) {
                    filterStr += `,project_id.in.(${projIds.map(id => `"${id}"`).join(',')})`;
                }
                query = query.or(filterStr).neq('status', 'Removed');

            } else {
                // Fallback for any other specific roles — restrict to collaborations only
                const projIds = collabProjectIds || [];
                if (projIds.length > 0) {
                    query = query.in('project_id', projIds).neq('status', 'Removed');
                } else {
                    setTableData([]);
                    setTotalCount(0);
                    setLoading(false);
                    return;
                }
            }

            // 2. Tab Filter - Apply status filter if not on "All" tab AND no search query is active
            // This makes search global across all statuses as requested by user
            if (activeTab !== 'all' && !debouncedSearchQuery.trim()) {
                const targetStatus = statusMap[activeTab];
                if (targetStatus) query = query.ilike('status', targetStatus);
            }

            // 3. Alert Filter - Only apply if not searching for a global experience
            if (!debouncedSearchQuery.trim()) {
                if (alertFilter === 'dispute') query = query.eq('has_dispute', true);
                else if (alertFilter === 'arthelp') query = query.eq('has_art_help', true);
            }

            // 4. Optimized Search Filter using Full Text Search (FTS)
            if (debouncedSearchQuery.trim()) {
                const q = debouncedSearchQuery.trim();
                // Use plain text search which handles multiple words and provides index-aware matching
                query = query.textSearch('search_vector', q, {
                    config: 'english',
                    type: 'plain'
                });
            }

            // 5. Execute with ordering & pagination
            // Urgency sorting: Earliest deadlines first (Late things at top), Nulls at bottom
            const { data, count, error } = await query
                .order('due_date', { ascending: true, nullsFirst: false })
                .order('due_time', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false })
                .range(from, to);

            if (!error && data) {
                const mappedData = data.map(p => ({
                    ...p,
                    id: p.project_id,
                    title: p.project_title || 'Untitled',
                    client: p.client_name || p.client_type || 'Unknown',
                    assignee: p.assignee || 'Unassigned',
                    dueDate: formatDeadlineDate(p.due_date),
                    dueTime: p.due_time ? p.due_time.substring(0, 5) : '',
                    status: p.status,
                    price: p.price ? `$${p.price}` : '',
                    payout: p.designer_fee ? `$${p.designer_fee}` : (isFreelancer ? '$0' : ''),
                    timeLeft: getTimeLeft(p.due_date ? `${p.due_date}T${p.due_time || '00:00:00'}` : null, p.status),
                    hasDispute: p.has_dispute || false,
                    hasArtHelp: p.has_art_help || false
                }));

                // Optimization: Data is already minimal from query
                const cacheData = mappedData;

                setTableData(mappedData);

                // Only cache if NOT searching to prevent search results from polluting status-specific caches
                if (!debouncedSearchQuery.trim()) {
                    try {
                        // Cache with page specificity to prevent stale data during navigation
                        localStorage.setItem(`nova_projects_cache_${activeTab}_page_${currentPage}`, JSON.stringify(cacheData));

                        // Also keep a general tab cache for backward compatibility / quick fallback
                        localStorage.setItem(`nova_projects_cache_${activeTab}`, JSON.stringify(cacheData));

                        if (activeTab === 'all') {
                            localStorage.setItem('nova_projects_cache', JSON.stringify(cacheData));
                        }
                    } catch (e) {
                        console.warn('LocalStorage quota exceeded, skipping cache update:', e);
                        if (e instanceof DOMException && (e.code === 22 || e.code === 1014 || e.name === 'QuotaExceededError')) {
                            Object.keys(localStorage).forEach(key => {
                                if (key.startsWith('nova_projects_cache_') || key.startsWith('nova_project_detail_')) {
                                    localStorage.removeItem(key);
                                }
                            });
                        }
                    }
                }

                // OPTIMIZATION: Use pre-calculated tab count only if NOT searching and NOT using alert filters
                if (debouncedSearchQuery.trim() || alertFilter) {
                    if (count !== null) {
                        setTotalCount(count);
                    }
                } else {
                    const tabTotal = (projectCounts as any)[activeTab] || 0;
                    setTotalCount(tabTotal);
                }
            }

            if (error) throw error;

        } catch (error: any) {
            console.error('Error fetching projects:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                full: error
            });
            addToast({ type: 'error', title: 'Fetch Error', message: error.message || 'Could not load projects.' });
        } finally {
            setLoading(false);
        }
    }
    async function fetchTabCounts() {
        if (!profile || !effectiveRole) return;

        try {
            // OPTIMIZATION: Try to get counts via server-side aggregation first (RPC)
            // This is the most efficient method as it returns only ~15 values instead of thousands of rows
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_project_status_counts');

            if (!rpcError && rpcData) {
                const counts: Record<string, number> = {
                    all: rpcData.all || 0,
                    dispute: rpcData.dispute || 0,
                    arthelp: rpcData.arthelp || 0,
                    progress: 0,
                    revision: 0,
                    'revision-urgent': 0,
                    urgent: 0,
                    approval: 0,
                    cancelled: 0,
                    done: 0,
                    'revision-done': 0,
                    'revision-urgent-done': 0,
                    'urgent-done': 0,
                    approved: 0
                };

                // Map raw status names from DB to internal tab IDs
                if (rpcData) {
                    Object.entries(rpcData).forEach(([rawKey, count]) => {
                        const s = rawKey.trim().toLowerCase();
                        Object.entries(statusMap).forEach(([tabKey, mappedStatus]) => {
                            if (s === mappedStatus.toLowerCase()) {
                                counts[tabKey] = (count as number);
                            }
                        });
                    });
                }

                setProjectCounts(counts);
                localStorage.setItem('nova_projects_counts_cache', JSON.stringify(counts));
                return;
            }
        } catch (rpcErr) {
            console.warn('RPC optimized counts failed, falling back to query method');
        }

        // FALLBACK: Original method (fetches columns and counts on client)
        // Kept for backward compatibility if RPC is not yet deployed
        let query = supabase
            .from('projects')
            .select('status, has_dispute, has_art_help')
            .neq('status', 'Removed');

        const isFreelancer = ['freelancer', 'designer', 'presentation', 'graphic designer', 'presentation designer'].some(r => userRole?.includes(r));

        if (userRole === 'admin' || userRole === 'project operations manager') {
            if (effectiveRole !== 'Super Admin') {
                const [{ data: permittedAccounts }, { data: collabDataCountsAdmin }] = await Promise.all([
                    supabase.from('user_account_access').select('account_id').eq('user_id', profile.id),
                    supabase.from('project_collaborators').select('project_id').eq('member_id', profile.id)
                ]);
                const accountIds = permittedAccounts?.map(pa => pa.account_id) || [];
                const collabProjectIds = collabDataCountsAdmin?.map(c => c.project_id) || [];

                if (accountIds.length > 0 || collabProjectIds.length > 0) {
                    const orParts: string[] = [];
                    if (accountIds.length > 0) orParts.push(`account_id.in.(${accountIds.map(id => `"${id}"`).join(',')})`);
                    if (collabProjectIds.length > 0) orParts.push(`project_id.in.(${collabProjectIds.map(id => `"${id}"`).join(',')})`);
                    query = query.or(orParts.join(','));
                } else {
                    setProjectCounts({ all: 0, dispute: 0, arthelp: 0 });
                    return;
                }
            }
        } else if (isFreelancer) {
            const { data: collabDataCounts } = await supabase
                .from('project_collaborators')
                .select('project_id')
                .eq('member_id', profile.id);
            const collabProjectIds = collabDataCounts?.map(c => c.project_id) || [];

            let filterStr = `assignee.eq."${profile.name}",assignee.eq."${profile.email}"`;
            if (collabProjectIds.length > 0) {
                filterStr += `,project_id.in.(${collabProjectIds.map(id => `"${id}"`).join(',')})`;
            }
            query = query.or(filterStr);
        } else if (userRole === 'project manager') {
            // PARALLEL: fetch collaborator projects + team memberships simultaneously
            const [{ data: collabDataCountsPM }, { data: userTeams }] = await Promise.all([
                supabase.from('project_collaborators').select('project_id').eq('member_id', profile.id),
                supabase.from('team_members').select('team_id').eq('member_id', profile.id)
            ]);
            const collabProjectIdsPM = collabDataCountsPM?.map(c => c.project_id) || [];

            let accountIds: string[] = [];
            if (userTeams && userTeams.length > 0) {
                const teamIds = userTeams.map(t => t.team_id);
                const { data: teamAccountLinks } = await supabase.from('team_accounts').select('account_id').in('team_id', teamIds);
                if (teamAccountLinks) accountIds = [...new Set(teamAccountLinks.map(ta => ta.account_id))];
            }

            if (accountIds.length > 0 || collabProjectIdsPM.length > 0) {
                const orParts: string[] = [];
                if (accountIds.length > 0) orParts.push(`account_id.in.(${accountIds.map(id => `"${id}"`).join(',')})`);
                if (collabProjectIdsPM.length > 0) orParts.push(`project_id.in.(${collabProjectIdsPM.map(id => `"${id}"`).join(',')})`);
                query = query.or(orParts.join(','));
            } else {
                setProjectCounts({ all: 0, dispute: 0, arthelp: 0 });
                return;
            }
        } else if (effectiveRole !== 'Super Admin') {
            setProjectCounts({ all: 0, dispute: 0, arthelp: 0 });
            return;
        }

        const { data, error } = await query;
        if (!error && data) {
            const counts: Record<string, number> = {
                all: 0,
                dispute: 0,
                arthelp: 0,
                progress: 0,
                revision: 0,
                'revision-urgent': 0,
                urgent: 0,
                approval: 0,
                cancelled: 0,
                done: 0,
                'revision-done': 0,
                'revision-urgent-done': 0,
                'urgent-done': 0,
                approved: 0
            };

            data.forEach(p => {
                const s = p.status?.trim().toLowerCase();
                Object.entries(statusMap).forEach(([key, mappedStatus]) => {
                    if (s === mappedStatus.toLowerCase()) counts[key] = (counts[key] || 0) + 1;
                });
                if (p.has_dispute) counts.dispute++;
                if (p.has_art_help) counts.arthelp++;
            });
            counts.all = data.length; // Set 'all' count after iterating
            setProjectCounts(counts);
            try {
                localStorage.setItem('nova_projects_counts_cache', JSON.stringify(counts));
            } catch (e) {
                console.warn('LocalStorage quota exceeded for counts cache');
            }
        }
    };

    // 1. Debounce the search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // 2. Reset to page 1 when filters or search change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, alertFilter, debouncedSearchQuery]);

    // 3. Main projects fetch effect with sequencing to prevent multiple redundant fetches
    useEffect(() => {
        let isCancelled = false;

        // Generate a parameter signature to detect actual changes
        const paramsSignature = JSON.stringify({
            role: userRole,
            page: currentPage,
            tab: activeTab,
            alert: alertFilter,
            search: debouncedSearchQuery
        });

        if (paramsSignature === lastFetchParamsRef.current && tableData && tableData.length > 0) {
            return;
        }

        const loadData = async () => {
            // Include page number in cache key to distinguish between different pages of the same tab
            const cacheKey = `nova_projects_cache_${activeTab}_page_${currentPage}`;
            const cached = localStorage.getItem(cacheKey);

            // 1. Initial UI setup: Show skeletons only if NO cache OR if searching/changing page
            let lastParams: any = null;
            try {
                if (lastFetchParamsRef.current && lastFetchParamsRef.current !== '{}') {
                    lastParams = JSON.parse(lastFetchParamsRef.current);
                }
            } catch (e) {
                console.error("Params parse error", e);
            }

            const isTabChange = lastParams && lastParams.tab !== activeTab;
            const isPageChange = lastParams && lastParams.page !== currentPage;
            const isSearching = !!debouncedSearchQuery.trim();

            if (!cached || isPageChange || isSearching || isTabChange) {
                setLoading(true);
                // Clear UI to show skeletons only for search or page/fresh tab
                if (!cached || isPageChange || isSearching) {
                    setTableData(null);
                } else if (isTabChange && cached) {
                    // Synchronously update UI with cached data for the new tab
                    try {
                        setTableData(JSON.parse(cached));
                    } catch (e) {
                        setTableData(null);
                    }
                }
            }

            try {
                await fetchProjects();
                lastFetchParamsRef.current = paramsSignature;
            } catch (err) {
                console.error("Load error:", err);
                setLoading(false);
            }
        };

        loadData();
        return () => { isCancelled = true; };
    }, [profile, effectiveRole, userRole, currentPage, activeTab, alertFilter, debouncedSearchQuery, isPermissionsReady]);

    // 4. Tab counts effect - runs less frequently
    useEffect(() => {
        if (profile && effectiveRole) {
            fetchTabCounts();
        }
    }, [profile, effectiveRole, userRole]);


    useEffect(() => {
        const fetchFreelancers = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, email, role, daily_capacity')
                .ilike('role', 'freelancer')
                .order('name', { ascending: true });

            if (!error && data) {
                setAllFreelancers(data);
                setTeamMembers(data); // Default to all initially
            }
        };
        fetchFreelancers();
    }, []);

    const fetchFreelancerWorkload = async () => {
        try {
            // Use SAME calendar-day window as the Workload section (midnight to end of today)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const { data: projects, error } = await supabase
                .from('projects')
                .select('assignee, status')
                .gte('created_at', todayStart.toISOString())
                .lte('created_at', todayEnd.toISOString());

            if (error) throw error;

            const stats: Record<string, { assigned: number, inProgress: number }> = {};
            (projects || []).forEach(p => {
                if (p.assignee) {
                    if (!stats[p.assignee]) stats[p.assignee] = { assigned: 0, inProgress: 0 };
                    stats[p.assignee].assigned += 1;

                    // Match SAME done-detection logic as Workload.tsx
                    const status = (p.status || '').toLowerCase();
                    const isFinished = status.includes('done') || ['approved', 'delivered', 'cancelled'].includes(status);
                    if (!isFinished) {
                        stats[p.assignee].inProgress += 1;
                    }
                }
            });
            setFreelancerWorkload(stats);
        } catch (err) {
            console.error('Error fetching freelancer workload:', err);
        }
    };

    useEffect(() => {
        if (isModalOpen) {
            fetchFreelancerWorkload();
        }
    }, [isModalOpen]);

    // Smart Freelancer Filtering Logic
    useEffect(() => {
        const filterFreelancersByAccount = async () => {
            if (!selectedAccount) {
                setTeamMembers(allFreelancers);
                return;
            }

            try {
                // 1. Get Team ID linked to this account
                const { data: teamAccount } = await supabase
                    .from('team_accounts')
                    .select('team_id')
                    .eq('account_id', selectedAccount)
                    .single();

                if (teamAccount) {
                    // 2. Get Freelancers in that team
                    const { data: teamFreelancers } = await supabase
                        .from('team_members')
                        .select('member_id, profiles(id, name, email, role)')
                        .eq('team_id', teamAccount.team_id);

                    if (teamFreelancers && teamFreelancers.length > 0) {
                        const filtered = teamFreelancers
                            .filter((f: any) => f.profiles?.role?.toLowerCase().trim() === 'freelancer')
                            .map((f: any) => f.profiles);

                        if (filtered.length > 0) {
                            setTeamMembers(filtered);
                            return;
                        }
                    }
                }

                // Fallback to all freelancers if no team members found
                setTeamMembers(allFreelancers);
            } catch (err) {
                console.error('Error filtering freelancers:', err);
                setTeamMembers(allFreelancers);
            }
        };

        filterFreelancersByAccount();
    }, [selectedAccount, allFreelancers]);

    useEffect(() => {
        const fetchPMCollaborators = async () => {
            if (!profile) return;
            const authorizedRoles = ['project manager', 'admin', 'super admin', 'project operations manager'];
            if (!authorizedRoles.includes(userRole || '')) {
                setPmCollaborators([]);
                return;
            }

            const { data: userTeams } = await supabase
                .from('team_members')
                .select('team_id')
                .eq('member_id', profile.id);

            if (userTeams && userTeams.length > 0) {
                const teamIds = userTeams.map(t => t.team_id);
                const { data: teamPMs } = await supabase
                    .from('team_members')
                    .select('member_id, profiles(id, name, email, role)')
                    .in('team_id', teamIds);

                if (teamPMs) {
                    const uniquePMs = Array.from(new Map(
                        teamPMs
                            .filter((m: any) => {
                                const role = m.profiles?.role?.toLowerCase().trim();
                                return role === 'project manager' || role === 'project operations manager';
                            })
                            .map((m: any) => [m.profiles.id, m.profiles])
                    ).values());
                    setPmCollaborators(uniquePMs);
                }
            }
        };
        fetchPMCollaborators();

        const fetchTeamPMs = async () => {
            if (!profile) return;
            const userRole = profile.role?.toLowerCase().trim();

            const authorizedRoles = ['project manager', 'admin', 'super admin', 'project operations manager'];
            if (!authorizedRoles.includes(userRole || '')) {
                setTeamPMs([]);
                return;
            }

            // Fetch for both PMs & Admins (Admins might be in teams too)
            const { data: userTeams } = await supabase
                .from('team_members')
                .select('team_id')
                .eq('member_id', profile.id);

            if (userTeams && userTeams.length > 0) {
                const teamIds = userTeams.map(t => t.team_id);
                // Fetch ALL team members in these teams
                const { data: teamMembersRaw } = await supabase
                    .from('team_members')
                    .select('member_id, profiles(id, name, email, role)')
                    .in('team_id', teamIds);

                if (teamMembersRaw) {
                    const uniquePMs = Array.from(new Map(
                        teamMembersRaw
                            .filter((m: any) => {
                                const role = m.profiles?.role?.toLowerCase().trim();
                                return role === 'project manager' || role === 'project operations manager';
                            })
                            .map((m: any) => [m.profiles.id, m.profiles])
                    ).values());

                    // Filter to ensure unique by ID
                    setTeamPMs(uniquePMs);
                }
            } else if (userRole === 'admin' || userRole === 'super admin' || userRole === 'project operations manager') {
                // Admins & POMs see all PMs/POMs if not in a team (fallback)
                const { data: allPMs } = await supabase
                    .from('profiles')
                    .select('id, name, email, role')
                    .or('role.ilike.project manager,role.ilike.project operations manager');

                if (allPMs) setTeamPMs(allPMs);
            } else if (userRole === 'project manager') {
                // Lone PM default to self
                setTeamPMs([profile]);
            }
        };
        fetchTeamPMs();
    }, [profile]);

    const toggleSoldItem = (item: string) => {
        setSoldItems(prev => {
            const next = prev.includes(item)
                ? prev.filter(i => i !== item)
                : [...prev, item];
            // Clear other text if Other is deselected
            if (item === 'Other' && !next.includes('Other')) {
                setOtherSoldText('');
            }
            return next;
        });
    };

    const toggleAddon = (item: string) => {
        setAddons(prev => {
            const next = prev.includes(item)
                ? prev.filter(i => i !== item)
                : [...prev, item];
            // Clear other text if Other is deselected
            if (item === 'Other' && !next.includes('Other')) {
                setAddonsOther('');
            }
            return next;
        });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        // Reset the input value so the same file fails can be selected again if needed
        e.target.value = '';

        setIsUploading(true);
        // Simulate upload delay
        setTimeout(() => {
            setProjectBriefFiles(prev => [...prev, ...selectedFiles]);
            setIsUploading(false);
        }, 1500);
    };

    const removeFile = (index: number) => {
        setProjectBriefFiles(prev => prev.filter((_, i) => i !== index));
    };


    const accountOptions = useMemo(() => {
        return accounts.map(acc => ({
            value: acc.id,
            label: acc.name,
            description: acc.prefix
        }));
    }, [accounts]);

    const currentPrefix = useMemo(() => {
        const acc = accounts.find(a => a.id === selectedAccount);
        return acc?.prefix || 'ARS';
    }, [accounts, selectedAccount]);



    const columns = [
        { header: 'Project ID', key: 'id', className: 'w-36' },
        {
            header: 'Project Title',
            key: 'title',
            className: 'min-w-[220px]',
            render: (item: any) => (
                <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{item.title}</span>
                    {item.hasDispute && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium !bg-brand-error/10 !text-brand-error whitespace-nowrap">
                            Dispute
                        </span>
                    )}
                    {item.hasArtHelp && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium !bg-brand-info/10 !text-brand-info whitespace-nowrap">
                            Art Help
                        </span>
                    )}
                </div>
            )
        },
        {
            header: 'Client Name',
            key: 'client',
            className: 'w-48',
            render: (item: any) => (
                <div className="flex flex-col">
                    <span className="text-white font-medium">{item.client}</span>
                    {item.client_type === 'repeat' && (
                        <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest">repeat</span>
                    )}
                </div>
            )
        },
        { header: 'Assignee', key: 'assignee', className: 'w-48', render: (item: any) => formatDisplayName(item.assignee) },
        {
            header: 'Deadline',
            key: 'dueDate',
            className: 'w-44',
            render: (item: any) => (
                <div className="flex flex-col">
                    <span className="text-white font-medium">{item.dueDate}</span>
                    <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest">{formatTime(item.dueTime)}</span>
                </div>
            )
        },
        {
            header: 'Status',
            key: 'status',
            className: 'w-56',
            render: (item: any) => {
                const status = item.status?.trim() || 'In Progress';
                return (
                    <span className={getStatusCapsuleClasses(status)}>
                        {status}
                    </span>
                );
            }
        },
        ...(isFreelancer
            ? [{ header: 'Payout', key: 'payout', className: 'w-24 text-center', render: (item: any) => <span className="text-brand-success font-bold block w-full">{item.payout}</span> }]
            : [{ header: 'Price', key: 'price', className: 'w-24 text-center' }]
        ),
        {
            header: 'Time Left',
            key: 'timeLeft',
            className: 'w-44',
            render: (item: any) => (
                <span className={`text-sm font-bold uppercase tracking-wider ${item.timeLeft.color}`}>
                    {item.timeLeft.label}
                </span>
            )
        },
        {
            header: '',
            key: 'actions',
            className: 'w-20 text-right',
            render: (item: any) => (
                <button
                    onClick={() => onProjectOpen?.(item.id, item)}
                    className="p-2 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-xl transition-all duration-200 group active:scale-95 shadow-sm"
                >
                    <IconChevronRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
            )
        },
    ];

    const handleDeadlineShortcut = (hours: number) => {
        const now = new Date();
        const futureDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

        // Update both date and time states
        setDueDate(futureDate);

        // Format time as HH:mm
        const hh = String(futureDate.getHours()).padStart(2, '0');
        const mm = String(futureDate.getMinutes()).padStart(2, '0');
        setDueTime(`${hh}:${mm}`);
        setActiveShortcut(hours);
    };

    const handleReset = () => {
        setSelectedMove(null);
        setOrderType(null);
        setPrice('');
        setSoldItems([]);
        setOtherSoldText('');
        setSelectedAccount(null);
        setLogoNoType(null);
        setActiveShortcut(null);
        setManualLogoNo('');
        setClientType(null);
        setClientName('');
        setPreviousLogoNo('');
        setMedium(null);
        setProjectTitle('');
        setProjectBriefText('');
        setProjectBriefFiles([]);
        setOptionsRequired(null);
        setIsUploading(false);
        setAddons([]);
        setAddonsOther('');
        setIsBriefExpanded(false);
        setBriefMode('edit');
        setDueDate(null);
        setDueTime('');
        setSelectedAssignee(null);
        setCurrentStep(1);
        setRemovalReason(null);
        setRemovalOtherText('');
        setRemoveProjectId('');
        setConvertedBy(null);
        setCancellationReason(null);
        setCancellationOtherText('');
        setCancelProjectId('');
        setApproveTips(null);
        setApproveAmount('');
        setApproveProjectId('');
        setShowReview(false);
        setIsReviewLoading(false);
    };

    return (
        <div className="flex flex-col min-h-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Mobile Navigation & Controls (md:hidden) */}
            <div className="md:hidden flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
                {/* Status Expander */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => setIsStatusExpanded(!isStatusExpanded)}
                        className="flex items-center justify-between w-full h-14 px-5 bg-black/40 border border-white/5 rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] group active:scale-[0.98] transition-all"
                    >
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-gray-300">Check By Status</span>
                        <IconChevronRight
                            className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isStatusExpanded ? 'rotate-90 text-brand-primary' : ''}`}
                        />
                    </button>

                    {isStatusExpanded && (
                        <div className="flex flex-col gap-1.5 p-1.5 bg-black/40 border border-white/5 rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-top-2 duration-300">
                            {[
                                'all',
                                'progress',
                                'done',
                                'urgent',
                                'urgent-done',
                                'revision',
                                'revision-done',
                                'revision-urgent',
                                'revision-urgent-done',
                                'approval',
                                'approved',
                                'cancelled'
                            ].map((tabId) => {
                                const tab = [...row1Tabs, ...row2Tabs].find(t => t.id === tabId);
                                if (!tab) return null;
                                const isActive = activeTab === tabId;

                                return (
                                    <button
                                        key={tabId}
                                        onClick={() => {
                                            setActiveTab(tabId);
                                            setIsStatusExpanded(false);
                                        }}
                                        className={`
                                            relative flex items-center justify-center h-11 px-4 rounded-xl transition-all duration-300 text-[10px] font-black uppercase tracking-widest outline-none overflow-hidden
                                            ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}
                                        `}
                                    >
                                        {isActive && (
                                            <>
                                                <div className="absolute inset-0 bg-gradient-to-b from-[#FF6B4B] to-[#D9361A] border border-[#FF6B4B]/50 shadow-[0_8px_15px_-2px_rgba(255,107,75,0.3),inset_0_1px_0_rgba(255,255,255,0.4)] rounded-xl animate-in fade-in zoom-in-95 duration-200" />
                                                <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] pointer-events-none opacity-50 z-10" />
                                            </>
                                        )}
                                        <span className="relative z-20">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Main Action Button */}
                {!isFreelancer && (
                    <Button
                        variant="metallic"
                        className="w-full !rounded-xl !py-4 font-black tracking-[0.2em] shadow-nova text-xs"
                        onClick={() => setIsModalOpen(true)}
                    >
                        CHOOSE YOUR MOVE
                    </Button>
                )}

                {/* Alerts & Filter Section */}
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAlertFilter(prev => prev === 'dispute' ? null : 'dispute')}
                            className={`
                                flex-1 !rounded-xl transition-all duration-300 text-[9px] font-black h-12 uppercase tracking-widest px-4
                                ${alertFilter === 'dispute'
                                    ? '!bg-brand-error !text-white !border-brand-error shadow-[0_4px_12px_rgba(239,68,68,0.2)]'
                                    : '!bg-brand-error/10 !text-brand-error !border-brand-error/20'
                                }
                            `}
                        >
                            Dispute{projectCounts['dispute'] > 0 ? ` ${projectCounts['dispute']}` : ''}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAlertFilter(prev => prev === 'arthelp' ? null : 'arthelp')}
                            className={`
                                flex-1 !rounded-xl transition-all duration-300 text-[9px] font-black h-12 uppercase tracking-widest px-4
                                ${alertFilter === 'arthelp'
                                    ? '!bg-brand-info !text-white !border-brand-info shadow-[0_4px_12px_rgba(14,165,233,0.2)]'
                                    : '!bg-brand-info/10 !text-brand-info !border-brand-info/20'
                                }
                            `}
                        >
                            Art Help{projectCounts['arthelp'] > 0 ? ` ${projectCounts['arthelp']}` : ''}
                        </Button>
                    </div>


                </div>

                {/* Search Bar - Full Width */}
                <Input
                    variant="metallic"
                    size="md"
                    placeholder="Search by ID, Title, Assignee or Client..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<IconSearch className="w-4 h-4" />}
                    className="w-full !rounded-xl"
                />
            </div>
            {/* Desktop Navigation & Header (hidden on mobile) */}
            <div className="hidden md:flex flex-col gap-3">
                {/* Row 1 Tabs - Centered horizontally */}
                <div className="w-full flex justify-center">
                    <Tabs
                        tabs={row1Tabs}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />
                </div>

                {/* 
                        Row 2 Tabs + Action Button
                        Treating them as 1 group while centralizing.
                    */}
                <div className="w-full flex justify-center items-center gap-3">
                    <Tabs
                        tabs={row2Tabs}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />

                    {!isFreelancer && (
                        <Button
                            variant="metallic"
                            size="md"
                            leftIcon={<IconPlus className="w-4 h-4" />}
                            onClick={() => setIsModalOpen(true)}
                        >
                            Choose Your Move
                        </Button>
                    )}
                </div>

            </div>

            {/* Desktop-only secondary controls row */}
            <div className="hidden md:flex items-center justify-between gap-4">
                {/* Secondary Actions - Top Left of Table */}
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAlertFilter(prev => prev === 'dispute' ? null : 'dispute')}
                        className={`
                            rounded-xl border-transparent transition-all duration-300
                            ${alertFilter === 'dispute'
                                ? '!bg-brand-error !text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                                : '!bg-brand-error/10 !text-brand-error hover:!bg-brand-error/20'
                            }
                            focus:!ring-brand-error/30 focus:!ring-offset-0 focus:!border-brand-error/40
                        `}
                    >
                        Disputes{projectCounts['dispute'] > 0 ? ` ${projectCounts['dispute']}` : ''}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAlertFilter(prev => prev === 'arthelp' ? null : 'arthelp')}
                        className={`
                            rounded-xl border-transparent transition-all duration-300
                            ${alertFilter === 'arthelp'
                                ? '!bg-brand-info !text-white shadow-[0_0_15px_rgba(14,165,233,0.3)]'
                                : '!bg-brand-info/10 !text-brand-info hover:!bg-brand-info/20'
                            }
                            focus:!ring-brand-info/30 focus:!ring-offset-0 focus:!border-brand-info/40
                        `}
                    >
                        Art Helps{projectCounts['arthelp'] > 0 ? ` ${projectCounts['arthelp']}` : ''}
                    </Button>
                </div>

                {/* Search - Top Right of Table */}
                <div className="w-72">
                    <Input
                        size="sm"
                        variant="metallic"
                        placeholder="Search by ID, Title, Client or Assignee..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        leftIcon={<IconSearch className="w-4 h-4" />}
                        rightIcon={null}
                        className="w-full"
                    />
                </div>
            </div>

            <div className="flex-1 relative">
                <div className={`h-full transition-all duration-300 ${loading ? 'min-h-[522px]' : ''}`}>
                    <Table
                        columns={columns}
                        data={tableData || []}
                        emptyMessage="No projects found."
                        isLoading={loading}
                        skeletonCount={ITEMS_PER_PAGE}
                        isMetallicHeader={true}
                        className="projects-table"
                    />
                </div>
            </div>


            {/* Pagination Controls */}
            {totalCount > ITEMS_PER_PAGE && (
                <div className="flex justify-end">
                    <Pagination
                        current={currentPage}
                        total={Math.ceil(totalCount / ITEMS_PER_PAGE)}
                        onChange={(page) => {
                            setCurrentPage(page);
                            // Scroll to top of table or page
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                    />
                </div>
            )}

            {/* Choose Your Move Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    handleReset();
                }}
                closeOnOutsideClick={false}
                title={(() => {
                    if (showReview) return "Final Review";
                    if (currentStep === 1) return "Choose Your Move";

                    if (selectedMove === 'Add') {
                        switch (currentStep) {
                            case 2: return "Order Type";
                            case 3: return "Converted By";
                            case 4: return "Price";
                            case 5: return "What Have You Sold?";
                            case 6: return "Account";
                            case 7: return "Project ID";
                            case 8: return "Client Type";
                            case 9: return clientType === 'new' ? 'Client Name' : 'Previous Project ID';
                            case 10: return "Medium";
                            case 11: return "Project Title";
                            case 12: return "Project Brief";
                            case 13: return "Any Addons?";
                            case 14: return "Deadline";
                            case 15: return "Assignee";
                            default: return "Choose Your Move";
                        }
                    } else if (selectedMove === 'Remove') {
                        switch (currentStep) {
                            case 2: return "Removal Reason";
                            case 3: return "Project ID";
                            default: return "Choose Your Move";
                        }
                    } else if (selectedMove === 'Cancel') {
                        switch (currentStep) {
                            case 2: return "Cancellation Reason";
                            case 3: return "Project ID";
                            default: return "Choose Your Move";
                        }
                    } else if (selectedMove === 'Approve') {
                        switch (currentStep) {
                            case 2: return "Any Tips?";
                            case 3: return approveTips === 'Yes' ? "How Much?" : "Project ID";
                            case 4: return "Project ID";
                            default: return "Choose Your Move";
                        }
                    }

                    return "Choose Your Move";
                })()}
                size={showReview ? "full" : "sm"}
                isElevatedFooter
                footer={(
                    <div className="flex justify-end gap-3 items-center">
                        {showReview ? (
                            <>
                                <Button
                                    variant="recessed"
                                    onClick={() => setShowReview(false)}
                                >
                                    Back
                                </Button>
                                <Button
                                    variant="metallic"
                                    isLoading={isSubmitting}
                                    disabled={
                                        isSubmitting || (
                                            selectedMove === 'Remove'
                                                ? (!removalReason || (removalReason === 'Other' && !removalOtherText.trim()) || !removeProjectId.match(/^[A-Z]{2,4}\s\d{6}$/))
                                                : selectedMove === 'Cancel'
                                                    ? (!cancellationReason || (cancellationReason === 'Other' && !cancellationOtherText.trim()) || !cancelProjectId.match(/^[A-Z]{2,4}\s\d{6}$/))
                                                    : selectedMove === 'Approve'
                                                        ? (!approveTips || (approveTips === 'Yes' && !approveAmount) || !approveProjectId.match(/^[A-Z]{2,4}\s\d{6}$/))
                                                        : (!selectedAssignee || !dueDate || !projectTitle.trim() || !selectedAccount)
                                        )
                                    }
                                    onClick={async () => {
                                        console.log('--- SUBMISSION START ---');
                                        setIsSubmitting(true);

                                        try {
                                            const move = selectedMove;
                                            const title = (projectTitle || '').trim();
                                            const account = selectedAccount;
                                            const prefix = currentPrefix || 'ARS';
                                            const type = orderType;
                                            const designType = logoNoType;
                                            const manualPId = (manualLogoNo || '').trim();
                                            const items = Array.isArray(soldItems) ? [...soldItems] : [];
                                            const otherItems = otherSoldText || '';
                                            const addonsList = Array.isArray(addons) ? [...addons] : [];
                                            const addonsOtherText = addonsOther || '';
                                            const client = clientType;
                                            const name = clientName || '';
                                            const prevLogo = previousLogoNo || '';
                                            const projectMedium = medium;
                                            const projectPriceString = price || '0';
                                            const brief = projectBriefText || '';
                                            const date = dueDate;
                                            const time = dueTime || '17:00';
                                            const assignee = selectedAssignee;

                                            console.log('Validated State:', { move, title, account, date });

                                            if (move === 'Add' && (!account || !title || !date)) {
                                                throw new Error('Please fill in Account, Project Title, and Due Date.');
                                            }

                                            if (move === 'Remove') {
                                                console.log('Executing REMOVE - PERMANENT DELETE');

                                                // 1. Delete associated notifications first
                                                const { error: notifError } = await supabase
                                                    .from('notifications')
                                                    .delete()
                                                    .eq('reference_id', removeProjectId);

                                                if (notifError) console.warn('Error deleting notifications:', notifError);

                                                // 2. Delete the project (will cascade to comments/earnings/etc via foreign keys if set up, or just remove the source of data)
                                                const { error: err } = await supabase.from('projects')
                                                    .delete()
                                                    .eq('project_id', removeProjectId);

                                                if (err) throw err;

                                                // Fetch project for previous status before updating
                                                const { data: proj } = await supabase.from('projects').select('status').eq('project_id', cancelProjectId).single();
                                                const previousStatus = proj?.status || 'In Progress';

                                                const { error: cancelError } = await supabase.from('projects')
                                                    .update({
                                                        action_move: 'Cancel',
                                                        cancellation_reason: cancellationReason === 'Other' ? cancellationOtherText : cancellationReason,
                                                        status: 'Cancelled',
                                                        updated_at: new Date().toISOString()
                                                    })
                                                    .eq('project_id', cancelProjectId);
                                                if (cancelError) throw cancelError;

                                                // Insert Status Change Card
                                                await supabase.from('project_comments').insert([{
                                                    project_id: cancelProjectId,
                                                    content: `STATUS_CHANGED:${previousStatus}:Cancelled`,
                                                    author_name: profile?.name || 'User',
                                                    author_role: profile?.role || 'Staff'
                                                }]);

                                                setActiveTab('cancelled');

                                            } else if (move === 'Approve') {
                                                console.log('Executing APPROVE');

                                                // First, fetch the project to get assignee and platform commission details
                                                const { data: projectData, error: fetchError } = await supabase
                                                    .from('projects')
                                                    .select('assignee, platform_commission_id, price, status')
                                                    .eq('project_id', approveProjectId)
                                                    .single();

                                                if (fetchError) {
                                                    console.error('Error fetching project:', fetchError);
                                                    throw fetchError;
                                                }

                                                // Fetch clearance days from platform commission
                                                let clearanceDays = 14; // Default
                                                if (projectData?.platform_commission_id) {
                                                    const { data: commissionData } = await supabase
                                                        .from('platform_commissions')
                                                        .select('clearance_days')
                                                        .eq('id', projectData.platform_commission_id)
                                                        .single();

                                                    if (commissionData?.clearance_days) {
                                                        clearanceDays = commissionData.clearance_days;
                                                    }
                                                }

                                                const previousStatus = projectData?.status || 'In Progress';

                                                // Update project with approval and clearance tracking
                                                const { error: approveError } = await supabase.from('projects')
                                                    .update({
                                                        action_move: 'Approve',
                                                        tips_given: approveTips === 'Yes',
                                                        tip_amount: approveTips === 'Yes' ? parseFloat(approveAmount) : 0,
                                                        status: 'Approved',
                                                        funds_status: 'Pending',
                                                        due_date: date ? (date instanceof Date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : String(date).split('T')[0]) : null,
                                                        due_time: time,
                                                        clearance_start_date: (() => {
                                                            const d = new Date();
                                                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                                        })(),
                                                        clearance_days: clearanceDays,
                                                        updated_at: new Date().toISOString()
                                                    })
                                                    .eq('project_id', approveProjectId);
                                                if (approveError) throw approveError;

                                                // Insert Status Change Card
                                                await supabase.from('project_comments').insert([{
                                                    project_id: approveProjectId,
                                                    content: `STATUS_CHANGED:${previousStatus}:Approved`,
                                                    author_name: profile?.name || 'User',
                                                    author_role: profile?.role || 'Staff'
                                                }]);

                                                setActiveTab('approved');

                                            } else if (move === 'Add') {
                                                // ADD Branch
                                                console.log('Executing ADD');
                                                const pId = (designType === 'Add Manually' && manualPId)
                                                    ? manualPId
                                                    : `${prefix} ${Math.floor(100000 + Math.random() * 900000)}`;

                                                const accObj = accounts.find(a => a.id === account);
                                                const accountName = accObj?.name || account;

                                                const itemsSoldJson = {
                                                    items: items,
                                                    other: items.includes('Other') ? otherItems : null
                                                };

                                                const addonsJson = {
                                                    items: addonsList,
                                                    other: addonsList.includes('Other') ? addonsOtherText : null
                                                };

                                                // Robust Date Formatting
                                                let formattedDate = null;
                                                const d: any = date;
                                                try {
                                                    if (d instanceof Date) {
                                                        const yyyy = d.getFullYear();
                                                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                                                        const dd_date = String(d.getDate()).padStart(2, '0');
                                                        formattedDate = `${yyyy}-${mm}-${dd_date}`;
                                                    } else if (typeof d === 'string' && d.includes('T')) {
                                                        formattedDate = d.split('T')[0];
                                                    } else {
                                                        formattedDate = d; // fallback to raw
                                                    }
                                                } catch (dateErr) {
                                                    console.warn('Date formatting failed, using raw:', date);
                                                    formattedDate = date;
                                                }

                                                // Process Attachments
                                                const attachmentPromises = projectBriefFiles.map(file => {
                                                    return new Promise((resolve) => {
                                                        const reader = new FileReader();
                                                        reader.onload = (e) => resolve({
                                                            name: file.name,
                                                            type: file.type,
                                                            size: file.size,
                                                            url: e.target?.result as string
                                                        });
                                                        reader.readAsDataURL(file);
                                                    });
                                                });

                                                const attachmentsJson = await Promise.all(attachmentPromises);

                                                // Determine Primary Manager & Collaborators based on Converted By selection
                                                let primaryManagerId = profile?.id;
                                                let finalCollaborators: any[] = [];

                                                if (convertedBy) {
                                                    // optimized: find selected PM object from teamPMs state which we already populated
                                                    const selectedPM = teamPMs.find(pm => pm.name === convertedBy);
                                                    if (selectedPM) {
                                                        primaryManagerId = selectedPM.id;

                                                        // Fetch collaborators: all other PMs in the team
                                                        finalCollaborators = teamPMs
                                                            .filter(m => m.id !== selectedPM.id)
                                                            .map(m => ({ id: m.id, name: m.name, role: m.role }));
                                                    }
                                                } else {
                                                    // Fallback if no convertedBy (shouldn't happen due to validation)
                                                    finalCollaborators = pmCollaborators.map(m => ({ id: m.id, name: m.name, role: m.role }));
                                                }

                                                const payload = {
                                                    project_id: pId,
                                                    action_move: 'Add',
                                                    project_title: title,
                                                    account: accountName,
                                                    account_id: account,
                                                    client_type: client,
                                                    client_name: client === 'repeat' ? name : name,
                                                    previous_logo_no: client === 'repeat' ? prevLogo : null,
                                                    items_sold: itemsSoldJson,
                                                    addons: addonsJson,
                                                    medium: projectMedium,
                                                    price: parseFloat(String(projectPriceString).replace(/[^0-9.]/g, '')) || 0,
                                                    brief: brief,
                                                    options_required: optionsRequired ? parseInt(optionsRequired) : null,
                                                    attachments: attachmentsJson, // Added attachments
                                                    due_date: formattedDate,
                                                    due_time: time,
                                                    converted_by: convertedBy,
                                                    order_type: type,
                                                    assignee: assignee,
                                                    primary_manager_id: primaryManagerId,
                                                    collaborators: finalCollaborators,
                                                    status: 'In Progress'
                                                };

                                                console.log('Inserting payload:', payload);
                                                // Using select() without single() for more reliability in some environments
                                                const { data: insertedData, error: insertError } = await supabase
                                                    .from('projects')
                                                    .insert([payload])
                                                    .select();

                                                if (insertError) throw insertError;

                                                // Best Approach: Insert into relational collaborators table
                                                if (insertedData && insertedData[0] && finalCollaborators.length > 0) {
                                                    const collabPayload = finalCollaborators.map(c => ({
                                                        project_id: insertedData[0].project_id,
                                                        member_id: c.id,
                                                        role: c.role || 'Collaborator'
                                                    }));

                                                    const { error: collabError } = await supabase
                                                        .from('project_collaborators')
                                                        .insert(collabPayload);

                                                    if (collabError) {
                                                        console.error('Relational Collaborator Insert Error:', collabError);
                                                        // We don't throw here to avoid failing project creation if only collaborators fail
                                                    }
                                                }

                                                const inserted = insertedData && insertedData[0];
                                                if (inserted) {
                                                    console.log('Insertion confirmed:', inserted.project_id);

                                                    // Create PROJECT ASSIGNED activity record for the timeline
                                                    const activityPayload = {
                                                        project_id: inserted.project_id,
                                                        content: `PROJECT_ASSIGNED|${new Date().toISOString()}|${inserted.assignee || 'Unassigned'}`,
                                                        author_name: profile?.name || 'User',
                                                        author_role: effectiveRole || 'User',
                                                        created_at: new Date().toISOString()
                                                    };

                                                    supabase.from('project_comments').insert([activityPayload]).then(({ error }) => {
                                                        if (error) console.error('BG Activity Creation Error:', error);
                                                    });

                                                    const newProject = {
                                                        id: inserted.project_id,
                                                        title: inserted.project_title || 'Untitled',
                                                        client: inserted.client_name || inserted.client_type || 'Unknown',
                                                        assignee: inserted.assignee || 'Unassigned',
                                                        order_type: inserted.order_type,
                                                        converted_by: inserted.converted_by,
                                                        dueDate: formatDeadlineDate(inserted.due_date),
                                                        dueTime: inserted.due_time ? inserted.due_time.substring(0, 5) : '',
                                                        status: inserted.status,
                                                        price: inserted.price ? `$${inserted.price}` : '',
                                                        timeLeft: getTimeLeft(inserted.due_date ? `${inserted.due_date}T${inserted.due_time || '00:00:00'}` : null),
                                                        hasDispute: inserted.has_dispute || false,
                                                        hasArtHelp: inserted.has_art_help || false
                                                    };
                                                    setTableData(prev => [newProject, ...(prev || [])]);

                                                    // Silent side effects
                                                    const assigneeProfile = allFreelancers.find(f => f.name === inserted.assignee || f.email === inserted.assignee);
                                                    if (assigneeProfile) {
                                                        addNotification({
                                                            type: 'project_assigned',
                                                            reference_id: inserted.project_id,
                                                            message: `You have been assigned to: ${inserted.project_title || 'Untitled'}`,
                                                            user_id: assigneeProfile.id,
                                                            is_read: false
                                                        }).catch(e => console.error('BG Notification Error:', e));
                                                    } else {
                                                        // Fallback global notification if assignee profile not found (optional, but keep it clean)
                                                        addNotification({
                                                            type: 'project_created',
                                                            reference_id: inserted.project_id,
                                                            message: `New project created: ${inserted.project_title || 'Untitled'}`,
                                                            user_id: null, // Global if no user targeted
                                                            is_read: false
                                                        }).catch(e => console.error('BG Notification Error:', e));
                                                    }

                                                    triggerWebhooks('projectCreated', {
                                                        ...inserted,
                                                        order_type: type,
                                                        logo_no_type: designType,
                                                        sold_items: items,
                                                        other_sold_text: otherItems,
                                                        addons_list: addonsList,
                                                        addons_other_text: addonsOtherText
                                                    }).catch(e => console.error('BG Webhook Error:', e));
                                                }
                                            }

                                            addToast({ type: 'success', title: 'Success', message: 'Project details submitted successfully', silent: true });

                                            if (move !== 'Add') {
                                                await fetchProjects();
                                            }

                                            setIsModalOpen(false);
                                            handleReset();

                                        } catch (e: any) {
                                            console.error('SUBMISSION ERROR:', e);
                                            addToast({
                                                type: 'error',
                                                title: 'Submission Failed',
                                                message: e.message || 'Check database connection'
                                            });
                                        } finally {
                                            setIsSubmitting(false);
                                            console.log('--- SUBMISSION END ---');
                                        }
                                    }}
                                >
                                    Submit
                                </Button>
                            </>
                        ) : (
                            <>
                                {currentStep === 1 ? (
                                    <Button
                                        variant="recessed"
                                        onClick={() => {
                                            setIsModalOpen(false);
                                            handleReset();
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                ) : (
                                    <Button
                                        variant="recessed"
                                        onClick={() => {
                                            if (selectedMove === 'Add' && currentStep === 4 && orderType === 'Direct') {
                                                setCurrentStep(2);
                                            } else {
                                                setCurrentStep(prev => prev - 1);
                                            }
                                        }}
                                        disabled={isReviewLoading}
                                    >
                                        Back
                                    </Button>
                                )}
                                <Button
                                    variant="metallic"
                                    isLoading={isReviewLoading}
                                    disabled={
                                        currentStep === 1 ? !selectedMove :
                                            selectedMove === 'Remove' ? (
                                                currentStep === 2 ? (!removalReason || (removalReason === 'Other' && !removalOtherText.trim())) :
                                                    currentStep === 3 ? !removeProjectId.match(/^[A-Z]{2,4}\s\d{6}$/) :
                                                        false
                                            ) :
                                                selectedMove === 'Cancel' ? (
                                                    currentStep === 2 ? (!cancellationReason || (cancellationReason === 'Other' && !cancellationOtherText.trim())) :
                                                        currentStep === 3 ? !cancelProjectId.match(/^[A-Z]{2,4}\s\d{6}$/) :
                                                            false
                                                ) :
                                                    selectedMove === 'Approve' ? (
                                                        currentStep === 2 ? !approveTips :
                                                            currentStep === 3 && approveTips === 'Yes' ? !approveAmount :
                                                                (currentStep === 4 || (currentStep === 3 && approveTips === 'No')) ? !approveProjectId.match(/^[A-Z]{2,4}\s\d{6}$/) :
                                                                    false
                                                    ) :
                                                        (
                                                            currentStep === 2 ? !orderType :
                                                                currentStep === 3 ? !convertedBy :
                                                                    currentStep === 4 ? !price.trim() :
                                                                        currentStep === 5 ? (soldItems.length === 0 || (soldItems.includes('Other') && !otherSoldText.trim())) :
                                                                            currentStep === 6 ? !selectedAccount :
                                                                                currentStep === 7 ? (!logoNoType || (logoNoType === 'Add Manually' && !manualLogoNo.trim())) :
                                                                                    currentStep === 8 ? !clientType :
                                                                                        currentStep === 9 ? (clientType === 'new' ? !clientName.trim() : !previousLogoNo.trim()) :
                                                                                            currentStep === 10 ? !medium :
                                                                                                currentStep === 11 ? !projectTitle.trim() :
                                                                                                    currentStep === 12 ? isUploading :
                                                                                                        currentStep === 13 ? false :
                                                                                                            currentStep === 14 ? (!dueDate) :
                                                                                                                currentStep === 15 ? !selectedAssignee :
                                                                                                                    false
                                                        )
                                    }
                                    onClick={() => {
                                        const getMaxSteps = () => {
                                            if (selectedMove === 'Remove') return 3;
                                            if (selectedMove === 'Cancel') return 3;
                                            if (selectedMove === 'Add') return 15;
                                            if (selectedMove === 'Approve') {
                                                return approveTips === 'Yes' ? 4 : 3;
                                            }
                                            return 1; // Default
                                        };
                                        const maxSteps = getMaxSteps();

                                        if (currentStep < maxSteps) {
                                            // Conditional navigation for Approve Tips
                                            if (selectedMove === 'Approve' && currentStep === 2 && approveTips === 'No') {
                                                // Skip step 3 (Amount) -> go to Project ID
                                                setCurrentStep(prev => prev + 1);
                                            } else if (selectedMove === 'Add' && currentStep === 2 && orderType === 'Direct') {
                                                // Skip step 3 (Converted By) -> go to step 4 (Price)
                                                setCurrentStep(4);
                                            } else {
                                                setCurrentStep(prev => prev + 1);
                                            }
                                        } else {
                                            // Unified transition for both branches
                                            setIsReviewLoading(true);
                                            setTimeout(() => {
                                                setIsReviewLoading(false);
                                                setShowReview(true);
                                            }, 800);
                                        }
                                    }}
                                >
                                    {((selectedMove === 'Remove' && currentStep === 3) || (selectedMove === 'Add' && currentStep === 15) || (selectedMove === 'Cancel' && currentStep === 3) || (selectedMove === 'Approve' && (currentStep === 4 || (currentStep === 3 && approveTips === 'No')))) ? 'Review' : 'Next'}
                                </Button>
                            </>
                        )}
                    </div>
                )}
            >
                {isReviewLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl animate-in fade-in duration-300">
                        <div className="w-10 h-10 border-3 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
                    </div>
                )}

                <div className={`space-y-6 ${isReviewLoading ? 'pointer-events-none' : ''}`}>
                    {!showReview && (
                        <>
                            {currentStep === 1 && (
                                <div className="space-y-4">
                                    <Radio
                                        label="Add"
                                        name="move-type"
                                        variant="metallic"
                                        checked={selectedMove === 'Add'}
                                        onChange={() => {
                                            if (selectedMove !== 'Add') handleReset();
                                            setSelectedMove('Add');
                                        }}
                                    />
                                    <Radio
                                        label="Remove"
                                        name="move-type"
                                        variant="metallic"
                                        checked={selectedMove === 'Remove'}
                                        onChange={() => {
                                            if (selectedMove !== 'Remove') handleReset();
                                            setSelectedMove('Remove');
                                        }}
                                    />
                                    <Radio
                                        label="Cancel"
                                        name="move-type"
                                        variant="metallic"
                                        checked={selectedMove === 'Cancel'}
                                        onChange={() => {
                                            if (selectedMove !== 'Cancel') handleReset();
                                            setSelectedMove('Cancel');
                                        }}
                                    />
                                    <Radio
                                        label="Approve"
                                        name="move-type"
                                        variant="metallic"
                                        checked={selectedMove === 'Approve'}
                                        onChange={() => {
                                            if (selectedMove !== 'Approve') handleReset();
                                            setSelectedMove('Approve');
                                        }}
                                    />
                                </div>
                            )}

                            {currentStep === 2 && selectedMove === 'Approve' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Radio
                                            label="Yes"
                                            name="approve-tips"
                                            variant="metallic"
                                            checked={approveTips === 'Yes'}
                                            onChange={() => setApproveTips('Yes')}
                                        />
                                        <Radio
                                            label="No"
                                            name="approve-tips"
                                            variant="metallic"
                                            checked={approveTips === 'No'}
                                            onChange={() => setApproveTips('No')}
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedMove === 'Approve' && currentStep === 3 && approveTips === 'Yes' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Input
                                            variant="metallic"
                                            placeholder="Type here"
                                            value={approveAmount}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    setApproveAmount(val);
                                                }
                                            }}
                                            size="lg"
                                            leftIcon={<span className="text-gray-500">$</span>}
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedMove === 'Approve' && ((currentStep === 4) || (currentStep === 3 && approveTips === 'No')) && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Input
                                            variant="metallic"
                                            placeholder="eg ARS 123456"
                                            value={approveProjectId}
                                            onChange={(e) => setApproveProjectId(e.target.value)}
                                            size="lg"
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && selectedMove === 'Remove' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        {['Editing Required', 'Haram', 'Other'].map((item) => (
                                            <React.Fragment key={item}>
                                                <Radio
                                                    label={item}
                                                    name="removal-reason"
                                                    variant="metallic"
                                                    checked={removalReason === item}
                                                    onChange={() => setRemovalReason(item)}
                                                />
                                                {item === 'Other' && removalReason === 'Other' && (
                                                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <Input
                                                            variant="metallic"
                                                            placeholder="Type reason here"
                                                            value={removalOtherText}
                                                            onChange={(e) => setRemovalOtherText(e.target.value)}
                                                            size="lg"
                                                        />
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && selectedMove === 'Cancel' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        {['Client Was Unclear', 'Designs Were Not Good Enough', 'Client Not Satisfied', 'Other'].map((item) => (
                                            <React.Fragment key={item}>
                                                <Radio
                                                    label={item}
                                                    name="cancellation-reason"
                                                    variant="metallic"
                                                    checked={cancellationReason === item}
                                                    onChange={() => setCancellationReason(item)}
                                                />
                                                {item === 'Other' && cancellationReason === 'Other' && (
                                                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <Input
                                                            variant="metallic"
                                                            placeholder="Type reason here"
                                                            value={cancellationOtherText}
                                                            onChange={(e) => setCancellationOtherText(e.target.value)}
                                                            size="lg"
                                                        />
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && selectedMove === 'Add' && (
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-2 w-full">
                                        <div className="space-y-4">
                                            <Radio
                                                label="Direct"
                                                name="order-type"
                                                variant="metallic"
                                                checked={orderType === 'Direct'}
                                                onChange={() => {
                                                    setOrderType('Direct');
                                                    setConvertedBy(null); // Reset converted by if direct
                                                }}
                                            />
                                            <Radio
                                                label="Converted"
                                                name="order-type"
                                                variant="metallic"
                                                checked={orderType === 'Converted'}
                                                onChange={() => setOrderType('Converted')}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentStep === 3 && selectedMove === 'Add' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Dropdown
                                            variant="metallic"
                                            placeholder="Select Project Manager"
                                            options={teamPMs.map(pm => ({ label: pm.name, value: pm.name }))}
                                            value={convertedBy || ''}
                                            onChange={(val) => setConvertedBy(val)}
                                            size="lg"
                                            showSearch={true}
                                            searchPlaceholder="Search Project Manager..."
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 3 && selectedMove === 'Cancel' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Input
                                            variant="metallic"
                                            placeholder="eg ARS 123456"
                                            value={cancelProjectId}
                                            onChange={(e) => setCancelProjectId(e.target.value)}
                                            size="lg"
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 3 && selectedMove === 'Remove' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Input
                                            variant="metallic"
                                            placeholder="eg ARS 123456"
                                            value={removeProjectId}
                                            onChange={(e) => setRemoveProjectId(e.target.value)}
                                            size="lg"
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 4 && selectedMove === 'Add' && (
                                <div className="space-y-4">
                                    <Input
                                        variant="metallic"
                                        type="text"
                                        placeholder="Type here"
                                        value={price}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                setPrice(val);
                                            }
                                        }}
                                        size="lg"
                                        leftIcon={<span className="text-gray-500">$</span>}
                                    />
                                </div>
                            )}

                            {currentStep === 5 && selectedMove === 'Add' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        {['Logo', 'Social Media Kit', 'Stationery Designs', 'Other'].map((item) => (
                                            <React.Fragment key={item}>
                                                <Checkbox
                                                    label={item}
                                                    variant="metallic"
                                                    checked={soldItems.includes(item)}
                                                    onChange={() => toggleSoldItem(item)}
                                                />
                                                {item === 'Other' && soldItems.includes('Other') && (
                                                    <Input
                                                        variant="metallic"
                                                        placeholder="Type here"
                                                        value={otherSoldText}
                                                        onChange={(e) => setOtherSoldText(e.target.value)}
                                                        size="lg"
                                                    />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {currentStep === 6 && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Dropdown
                                            variant="metallic"
                                            placeholder="Select account"
                                            options={accountOptions}
                                            value={selectedAccount || ''}
                                            onChange={(val) => setSelectedAccount(val)}
                                            showSearch={true}
                                            searchPlaceholder="Search account prefix..."
                                            size="lg"
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 7 && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-4">
                                            <Radio
                                                label="Auto Generate"
                                                name="logo-no-type"
                                                variant="metallic"
                                                checked={logoNoType === 'Auto Generate'}
                                                onChange={() => setLogoNoType('Auto Generate')}
                                            />
                                            <Radio
                                                label="Add Manually"
                                                name="logo-no-type"
                                                variant="metallic"
                                                checked={logoNoType === 'Add Manually'}
                                                onChange={() => setLogoNoType('Add Manually')}
                                            />
                                        </div>
                                        {logoNoType === 'Add Manually' && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                <Input
                                                    variant="metallic"
                                                    placeholder={`${currentPrefix} 876923`}
                                                    value={manualLogoNo}
                                                    onChange={(e) => setManualLogoNo(e.target.value)}
                                                    size="lg"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {currentStep === 8 && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Radio
                                            label="New Client"
                                            name="client-type"
                                            variant="metallic"
                                            checked={clientType === 'new'}
                                            onChange={() => setClientType('new')}
                                        />
                                        <Radio
                                            label="Repeat Client"
                                            name="client-type"
                                            variant="metallic"
                                            checked={clientType === 'repeat'}
                                            onChange={() => setClientType('repeat')}
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 9 && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Input
                                            variant="metallic"
                                            placeholder="Type here"
                                            value={clientType === 'new' ? clientName : previousLogoNo}
                                            onChange={(e) => clientType === 'new' ? setClientName(e.target.value) : setPreviousLogoNo(e.target.value)}
                                            size="lg"
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 10 && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Radio
                                            label="Ranking"
                                            name="medium-type"
                                            variant="metallic"
                                            checked={medium === 'Ranking'}
                                            onChange={() => setMedium('Ranking')}
                                        />
                                        <Radio
                                            label="Promoted"
                                            name="medium-type"
                                            variant="metallic"
                                            checked={medium === 'Promoted'}
                                            onChange={() => setMedium('Promoted')}
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 11 && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Input
                                            variant="metallic"
                                            placeholder="Type here"
                                            value={projectTitle}
                                            onChange={(e) => setProjectTitle(e.target.value)}
                                            size="lg"
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 12 && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Input
                                            variant="metallic"
                                            label="Options Required"
                                            placeholder="How Many Options Required?"
                                            type="number"
                                            min={1}
                                            max={20}
                                            value={optionsRequired || ''}
                                            onChange={(e) => setOptionsRequired(e.target.value)}
                                        />
                                        <div className="flex justify-start mb-6">
                                            <Tabs
                                                tabs={[
                                                    { id: 'edit', label: 'Edit' },
                                                    { id: 'preview', label: 'Preview' }
                                                ]}
                                                activeTab={briefMode}
                                                onTabChange={(id) => setBriefMode(id as 'edit' | 'preview')}
                                            />
                                        </div>

                                        {briefMode === 'edit' ? (
                                            <TextArea
                                                variant="metallic"
                                                placeholder="Describe the project..."
                                                value={projectBriefText}
                                                onChange={(e) => setProjectBriefText(e.target.value)}
                                                onExpand={() => setIsBriefExpanded(true)}
                                                className="min-h-[140px]"
                                            />
                                        ) : (
                                            <div className="min-h-[140px] p-6 bg-black/40 rounded-3xl border border-white/5 shadow-[inset_0_4px_24px_rgba(0,0,0,0.5)]">
                                                {projectBriefText.trim() ? (
                                                    <ReactMarkdown components={markdownComponents} remarkPlugins={markdownPlugins}>
                                                        {parseCodesLogicMarkdown(projectBriefText)}
                                                    </ReactMarkdown>
                                                ) : (
                                                    <p className="text-gray-500 italic text-sm">Nothing to preview. Start typing...</p>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-2 mt-4">
                                            <div
                                                onClick={() => !isUploading && fileInputRef.current?.click()}
                                                className={`w-full flex flex-col items-center justify-center rounded-2xl p-8 bg-white/[0.03] border border-white/10 relative overflow-hidden transition-all duration-300 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.8)] hover:bg-white/[0.06] hover:border-white/20 ${isUploading ? 'cursor-wait opacity-50' : 'cursor-pointer'} group`}
                                            >
                                                {/* Top Edge Highlight for Elevation */}
                                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                                {/* Diagonal Metallic Shine Overlay */}
                                                <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)] pointer-events-none opacity-40" />
                                                {/* Center-weighted Shadow Depth Falloff */}
                                                <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-4/5 h-12 shadow-[0_12px_32px_-4px_rgba(0,0,0,0.9)] opacity-70 pointer-events-none" />

                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    className="hidden"
                                                    multiple
                                                    onChange={handleFileSelect}
                                                />
                                                <div className="relative z-10 flex flex-col items-center">
                                                    <div className="p-4 rounded-full bg-white/[0.05] border border-white/10 text-gray-400 group-hover:text-brand-primary group-hover:border-brand-primary/30 transition-all duration-300 mb-4 shadow-lg">
                                                        {isUploading ? (
                                                            <svg className="animate-spin h-6 w-6 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        ) : (
                                                            <IconPlus size={24} />
                                                        )}
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-sm font-bold text-white mb-1 uppercase tracking-wider">
                                                            {isUploading ? 'Uploading...' : 'Choose File'}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500 font-medium">Up to 20 files, max 10MB each</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* File Previews Grid */}
                                            {projectBriefFiles.length > 0 && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6 animate-in fade-in duration-300">
                                                    {projectBriefFiles.map((file, index) => {
                                                        const isImage = file.type.startsWith('image/');
                                                        const extension = file.name.split('.').pop()?.toLowerCase();

                                                        const getIcon = () => {
                                                            let iconName = 'txt-icon.png'; // Default
                                                            const ext = extension || '';

                                                            if (['jpg', 'jpeg'].includes(ext)) iconName = 'jpg-icon.png';
                                                            else if (ext === 'png') iconName = 'png-icon.png';
                                                            else if (['doc', 'docx'].includes(ext)) iconName = 'doc-icon.png';
                                                            else if (ext === 'pdf') iconName = 'pdf-icon.png';
                                                            else if (ext === 'ai') iconName = 'ai-document.png';
                                                            else if (ext === 'psd') iconName = 'psd-icon.png';
                                                            else if (['zip', 'rar', '7z'].includes(ext)) iconName = 'zip-icon.png';
                                                            else if (['mp4', 'mov', 'avi'].includes(ext)) iconName = 'avi-icon.png';
                                                            else if (ext === 'gif') iconName = 'gif-icon.png';
                                                            else if (['xls', 'xlsx', 'csv'].includes(ext)) iconName = 'xls-icon.png';
                                                            else if (['ppt', 'pptx'].includes(ext)) iconName = 'ppt-icon.png';
                                                            else if (ext === 'eps') iconName = 'eps-icon.png';
                                                            else if (['html', 'htm'].includes(ext)) iconName = 'html-icon.png';
                                                            else if (ext === 'mp3') iconName = 'mp3-icon.png';

                                                            return (
                                                                <img
                                                                    src={`/${iconName}`}
                                                                    alt={ext}
                                                                    className="w-10 h-10 object-contain opacity-90"
                                                                />
                                                            );
                                                        };

                                                        return (
                                                            <div
                                                                key={`${file.name}-${index}`}
                                                                className="group relative flex flex-col gap-2"
                                                            >
                                                                <div className="relative aspect-square rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden transition-all duration-300 group-hover:bg-white/[0.06] group-hover:border-white/20 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)] group-hover:shadow-xl group-hover:shadow-black/60">
                                                                    {/* Top Edge Highlight */}
                                                                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-20" />
                                                                    {/* Diagonal Metallic Shine Overlay */}
                                                                    <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)] pointer-events-none opacity-40 z-20" />

                                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                                        {getIcon()}
                                                                    </div>

                                                                    {/* Delete Action - Top Right on Hover */}
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                                                                        className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-brand-error active:scale-95 z-30"
                                                                    >
                                                                        <IconX size={14} />
                                                                    </button>

                                                                    {/* Hover Overlay */}
                                                                    <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10" />
                                                                </div>
                                                                <span className="text-[11px] font-medium text-gray-400 truncate px-1 text-center group-hover:text-white transition-colors">
                                                                    {file.name}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentStep === 13 && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        {['Social Media Kit', 'Stationery Designs', 'None', 'Other'].map((item) => (
                                            <React.Fragment key={item}>
                                                <Checkbox
                                                    label={item}
                                                    variant="metallic"
                                                    checked={addons.includes(item)}
                                                    onChange={() => toggleAddon(item)}
                                                />
                                                {item === 'Other' && addons.includes('Other') && (
                                                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <Input
                                                            variant="metallic"
                                                            placeholder="Type here"
                                                            value={addonsOther}
                                                            onChange={(e) => setAddonsOther(e.target.value)}
                                                            size="lg"
                                                        />
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {currentStep === 14 && (
                                <div className="space-y-6">
                                    <div className="space-y-6">
                                        {/* Shortcuts */}
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {[2, 6, 8, 12, 24].map((hours) => (
                                                <Button
                                                    key={hours}
                                                    variant="recessed"
                                                    size="sm"
                                                    disabled={isReviewLoading}
                                                    onClick={() => handleDeadlineShortcut(hours)}
                                                    className={`!px-3 !py-1.5 !h-auto !text-[10px] font-bold uppercase tracking-wider transition-all duration-300 transform active:scale-95 ${activeShortcut === hours
                                                        ? '!text-white !border-white/20 !bg-white/10'
                                                        : ''
                                                        }`}
                                                >
                                                    {hours} Hrs
                                                </Button>
                                            ))}
                                        </div>

                                        {/* Date Picker */}
                                        <DatePicker
                                            variant="metallic"
                                            value={dueDate}
                                            onChange={(date) => {
                                                setDueDate(date);
                                                setActiveShortcut(null);
                                            }}
                                            disabled={isReviewLoading}
                                        />

                                        {/* Time Selection */}
                                        <TimeSelect
                                            variant="metallic"
                                            placeholder="Select time"
                                            value={dueTime}
                                            onChange={(val) => {
                                                setDueTime(val);
                                                setActiveShortcut(null);
                                            }}
                                            disabled={isReviewLoading}
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 15 && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Dropdown
                                            variant="metallic"
                                            placeholder="Select Assignee"
                                            options={teamMembers
                                                .filter(m => m.role?.trim().toLowerCase() === 'freelancer')
                                                .sort((a, b) => {
                                                    const statA = freelancerWorkload[a.name || a.email] || { assigned: 0 };
                                                    const statB = freelancerWorkload[b.name || b.email] || { assigned: 0 };
                                                    const remA = (a.daily_capacity || 5) - statA.assigned;
                                                    const remB = (b.daily_capacity || 5) - statB.assigned;
                                                    return remB - remA;
                                                })
                                                .map(m => {
                                                    const name = m.name || m.email;
                                                    const stat = freelancerWorkload[name] || { assigned: 0, inProgress: 0 };
                                                    const capacity = m.daily_capacity || 5;
                                                    const usage = stat.assigned / capacity;

                                                    const descriptionClassName = usage >= 1.0
                                                        ? 'bg-brand-error/20 border-brand-error/30 text-brand-error'
                                                        : usage > 0.4
                                                            ? 'bg-brand-warning/20 border-brand-warning/30 text-brand-warning'
                                                            : 'bg-brand-success/20 border-brand-success/30 text-brand-success';

                                                    return {
                                                        label: name,
                                                        value: name,
                                                        description: `${stat.assigned} / ${capacity}`,
                                                        descriptionClassName
                                                    };
                                                })
                                            }
                                            value={selectedAssignee || ''}
                                            onChange={(val) => setSelectedAssignee(val)}
                                            showSearch
                                            disabled={isReviewLoading}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {showReview && (
                        <div className="max-w-3xl mx-auto py-2 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-6">
                            <div className="space-y-10">
                                {selectedMove === 'Remove' && (
                                    <div className="space-y-12">
                                        {/* REMOVE BRANCH REVIEW */}
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] px-1">Action & Context</h4>
                                            <div className="space-y-6">
                                                <Dropdown
                                                    variant="metallic"
                                                    label="Action Move"
                                                    options={[
                                                        { label: 'Add', value: 'Add' },
                                                        { label: 'Remove', value: 'Remove' },
                                                        { label: 'Cancel', value: 'Cancel' },
                                                        { label: 'Approve', value: 'Approve' }
                                                    ]}
                                                    value={selectedMove || ''}
                                                    onChange={setSelectedMove}
                                                />
                                                <div className="space-y-4">
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Removal Reason</label>
                                                    <div className="space-y-3">
                                                        {['Editing Required', 'Haram', 'Other'].map((item) => (
                                                            <React.Fragment key={item}>
                                                                <Radio
                                                                    variant="metallic"
                                                                    label={item}
                                                                    name="review-removal-reason"
                                                                    checked={removalReason === item}
                                                                    onChange={() => setRemovalReason(item)}
                                                                    className="text-[12px]"
                                                                />
                                                                {item === 'Other' && removalReason === 'Other' && (
                                                                    <div className="animate-in fade-in slide-in-from-top-2 duration-200 ml-4 border-l-2 border-brand-primary/20 pl-4">
                                                                        <Input
                                                                            variant="metallic"
                                                                            placeholder="Type reason here"
                                                                            value={removalOtherText}
                                                                            onChange={(e) => setRemovalOtherText(e.target.value)}
                                                                            size="lg"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </div>
                                                <Input
                                                    variant="metallic"
                                                    label="Project ID"
                                                    value={removeProjectId}
                                                    onChange={(e) => setRemoveProjectId(e.target.value)}
                                                    placeholder="eg ARS 123456"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedMove === 'Add' && (
                                    <div className="space-y-10">
                                        {/* GROUP 1 â€” MOVE & ORDER */}
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] px-1">Move & Order</h4>
                                            <div className="space-y-6">
                                                <Dropdown
                                                    variant="metallic"
                                                    label="Action Move"
                                                    options={[
                                                        { label: 'Add', value: 'Add' },
                                                        { label: 'Remove', value: 'Remove' },
                                                        { label: 'Cancel', value: 'Cancel' },
                                                        { label: 'Approve', value: 'Approve' }
                                                    ]}
                                                    value={selectedMove || ''}
                                                    onChange={setSelectedMove}
                                                />
                                                {orderType === 'Converted' && (
                                                    <Dropdown
                                                        variant="metallic"
                                                        label="Converted By"
                                                        options={teamPMs.map(pm => ({ label: pm.name, value: pm.name }))}
                                                        value={convertedBy || ''}
                                                        onChange={setConvertedBy}
                                                        showSearch={true}
                                                        searchPlaceholder="Search Project Manager..."
                                                    />
                                                )}
                                                <Dropdown
                                                    variant="metallic"
                                                    label="Order Type"
                                                    options={[
                                                        { label: 'Direct', value: 'Direct' },
                                                        { label: 'Converted', value: 'Converted' }
                                                    ]}
                                                    value={orderType || ''}
                                                    onChange={setOrderType}
                                                />
                                            </div>
                                        </div>

                                        <div className="h-px bg-surface-border/30 w-full" />

                                        {/* GROUP 2 â€” PRICE & ITEMS */}
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] px-1">Price & Items</h4>
                                            <div className="space-y-8">
                                                <Input
                                                    variant="metallic"
                                                    label="Budget / Price"
                                                    placeholder="eg 100"
                                                    value={price}
                                                    onChange={(e) => setPrice(e.target.value)}
                                                    leftIcon={<span className="text-gray-500">$</span>}
                                                />

                                                <div className="space-y-4">
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Items Sold</label>
                                                    <div className="flex flex-col gap-3">
                                                        {['Logo', 'Social Media Kit', 'Stationery Designs', 'Other'].map(item => (
                                                            <Checkbox
                                                                key={item}
                                                                variant="metallic"
                                                                label={item}
                                                                checked={soldItems.includes(item)}
                                                                onChange={() => toggleSoldItem(item)}
                                                                className="text-[12px]"
                                                            />
                                                        ))}
                                                    </div>
                                                    {soldItems.includes('Other') && (
                                                        <Input
                                                            variant="metallic"
                                                            placeholder="Specify other items..."
                                                            value={otherSoldText}
                                                            onChange={e => setOtherSoldText(e.target.value)}
                                                        />
                                                    )}
                                                </div>

                                                <div className="space-y-1">
                                                    <Dropdown
                                                        variant="metallic"
                                                        label="Account Name"
                                                        options={accountOptions}
                                                        value={selectedAccount || ''}
                                                        onChange={setSelectedAccount}
                                                        showSearch
                                                    />
                                                    {!selectedAccount && (
                                                        <p className="text-[10px] font-medium text-brand-error animate-in fade-in slide-in-from-top-1">
                                                            Account is required to calculate fees
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-surface-border/30 w-full" />

                                        {/* GROUP 3 â€” PROJECT IDENTITY */}
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] px-1">Project Identity</h4>
                                            <div className="space-y-8">
                                                <div className="space-y-4">
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Logo Number Type</label>
                                                    <div className="flex flex-col gap-3">
                                                        {['Auto Generate', 'Add Manually'].map(type => (
                                                            <Radio
                                                                key={type}
                                                                variant="metallic"
                                                                label={type}
                                                                name="logo-type-review"
                                                                checked={logoNoType === type}
                                                                onChange={() => setLogoNoType(type)}
                                                                className="text-[12px]"
                                                            />
                                                        ))}
                                                    </div>
                                                    {logoNoType === 'Add Manually' && (
                                                        <Input
                                                            variant="metallic"
                                                            placeholder="eg ARS 123456"
                                                            value={manualLogoNo}
                                                            onChange={(e) => setManualLogoNo(e.target.value)}
                                                        />
                                                    )}
                                                </div>

                                                <div className="space-y-4">
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Client Type</label>
                                                    <div className="flex flex-col gap-3">
                                                        {[
                                                            { label: 'New Client', value: 'new' },
                                                            { label: 'Repeat Client', value: 'repeat' }
                                                        ].map(type => (
                                                            <Radio
                                                                key={type.value}
                                                                variant="metallic"
                                                                label={type.label}
                                                                name="client-type-review"
                                                                checked={clientType === type.value}
                                                                onChange={() => setClientType(type.value as 'new' | 'repeat')}
                                                                className="text-[12px]"
                                                            />
                                                        ))}
                                                    </div>
                                                </div>

                                                {clientType === 'new' ? (
                                                    <Input
                                                        variant="metallic"
                                                        label="Client Name"
                                                        placeholder="Enter name"
                                                        value={clientName}
                                                        onChange={(e) => setClientName(e.target.value)}
                                                    />
                                                ) : (
                                                    <Input
                                                        variant="metallic"
                                                        label="Previous Project ID"
                                                        placeholder="eg ARS 123456"
                                                        value={previousLogoNo}
                                                        onChange={(e) => setPreviousLogoNo(e.target.value)}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <div className="h-px bg-surface-border/30 w-full" />

                                        {/* GROUP 4 â€” ITEMS & MEDIUM */}
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] px-1">Items & Medium</h4>
                                            <div className="space-y-8">
                                                <div className="space-y-4">
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Medium</label>
                                                    <div className="flex flex-col gap-3">
                                                        {['Ranking', 'Promoted'].map(type => (
                                                            <Radio
                                                                key={type}
                                                                variant="metallic"
                                                                label={type}
                                                                name="medium-review"
                                                                checked={medium === type}
                                                                onChange={() => setMedium(type)}
                                                                className="text-[12px]"
                                                            />
                                                        ))}
                                                    </div>
                                                </div>

                                                <Input
                                                    variant="metallic"
                                                    label="Project Title"
                                                    placeholder="eg Modern Minimal Logo"
                                                    value={projectTitle}
                                                    onChange={(e) => setProjectTitle(e.target.value)}
                                                />

                                                <div className="space-y-4">
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Project Brief</label>
                                                    <Input
                                                        variant="metallic"
                                                        label="Options Required"
                                                        placeholder="How Many Options Required?"
                                                        type="number"
                                                        min={1}
                                                        max={20}
                                                        value={optionsRequired || ''}
                                                        onChange={(e) => setOptionsRequired(e.target.value)}
                                                    />
                                                    {projectBriefText.trim() ? (
                                                        <div className="p-6 bg-black/40 rounded-3xl border border-white/5 shadow-[inset_0_4px_24px_rgba(0,0,0,0.5)]">
                                                            <ReactMarkdown components={markdownComponents} remarkPlugins={markdownPlugins}>
                                                                {parseCodesLogicMarkdown(projectBriefText)}
                                                            </ReactMarkdown>
                                                        </div>
                                                    ) : (
                                                        <p className="text-gray-500 italic text-sm">No brief provided.</p>
                                                    )}

                                                    {/* Attachments Preview in Review */}
                                                    {projectBriefFiles.length > 0 && (
                                                        <div className="space-y-3 mt-6">
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">References</label>
                                                            <div className="flex flex-wrap gap-3">
                                                                {projectBriefFiles.map((file, index) => {
                                                                    const extension = file.name.split('.').pop()?.toLowerCase();
                                                                    const getIcon = () => {
                                                                        let iconName = 'txt-icon.png';
                                                                        const ext = extension || '';
                                                                        if (['jpg', 'jpeg'].includes(ext)) iconName = 'jpg-icon.png';
                                                                        else if (ext === 'png') iconName = 'png-icon.png';
                                                                        else if (['doc', 'docx'].includes(ext)) iconName = 'doc-icon.png';
                                                                        else if (ext === 'pdf') iconName = 'pdf-icon.png';
                                                                        else if (ext === 'ai') iconName = 'ai-document.png';
                                                                        else if (ext === 'psd') iconName = 'psd-icon.png';
                                                                        else if (['zip', 'rar', '7z'].includes(ext)) iconName = 'zip-icon.png';
                                                                        else if (['mp4', 'mov', 'avi'].includes(ext)) iconName = 'avi-icon.png';
                                                                        else if (ext === 'gif') iconName = 'gif-icon.png';
                                                                        else if (['xls', 'xlsx', 'csv'].includes(ext)) iconName = 'xls-icon.png';
                                                                        else if (['ppt', 'pptx'].includes(ext)) iconName = 'ppt-icon.png';
                                                                        else if (ext === 'eps') iconName = 'eps-icon.png';
                                                                        return `/${iconName}`;
                                                                    };

                                                                    return (
                                                                        <div key={index} className="group relative">
                                                                            <div className="w-12 h-12 rounded-xl border border-surface-border bg-surface-overlay flex items-center justify-center overflow-hidden transition-all duration-300 hover:border-brand-primary/30 shadow-lg">
                                                                                <img src={getIcon()} alt={extension} className="w-7 h-7 object-contain" />
                                                                            </div>
                                                                            <div className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <button
                                                                                    onClick={() => setProjectBriefFiles(prev => prev.filter((_, i) => i !== index))}
                                                                                    className="bg-surface-card border border-surface-border text-gray-400 hover:text-brand-error p-0.5 rounded-full shadow-xl"
                                                                                >
                                                                                    <IconX size={10} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-surface-border/30 w-full" />

                                        {/* GROUP 5 â€” TIMELINE & ADDONS */}
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] px-1">Timeline & Addons</h4>

                                            <div className="space-y-8">
                                                {/* Shortcuts in Review section */}
                                                <div className="flex flex-wrap gap-2">
                                                    {[2, 6, 8, 12, 24].map((hours) => (
                                                        <Button
                                                            key={hours}
                                                            variant="recessed"
                                                            size="sm"
                                                            onClick={() => handleDeadlineShortcut(hours)}
                                                            className={`!px-3 !py-1.5 !h-auto !text-[10px] font-bold uppercase tracking-wider transition-all duration-300 transform active:scale-95 ${activeShortcut === hours
                                                                ? '!text-white !border-white/20 !bg-white/10'
                                                                : ''
                                                                }`}
                                                        >
                                                            {hours} Hrs
                                                        </Button>
                                                    ))}
                                                </div>

                                                <div className="grid grid-cols-2 gap-6">
                                                    <DatePicker
                                                        label="Due Date"
                                                        variant="metallic"
                                                        value={dueDate}
                                                        onChange={(date) => setDueDate(date)}
                                                    />
                                                    <TimeSelect
                                                        label="Due Time"
                                                        variant="metallic"
                                                        placeholder="Select time"
                                                        value={dueTime}
                                                        onChange={setDueTime}
                                                    />
                                                </div>

                                                <div className="space-y-4">
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Addons</label>
                                                    <div className="flex flex-col gap-3">
                                                        {['Social Media Kit', 'Stationery Designs', 'None', 'Other'].map(item => (
                                                            <Checkbox
                                                                key={item}
                                                                label={item}
                                                                variant="metallic"
                                                                checked={addons.includes(item)}
                                                                onChange={() => toggleAddon(item)}
                                                            />
                                                        ))}
                                                    </div>
                                                    {addons.includes('Other') && (
                                                        <Input
                                                            variant="metallic"
                                                            placeholder="Specify other addons..."
                                                            value={addonsOther}
                                                            onChange={e => setAddonsOther(e.target.value)}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-surface-border/30 w-full" />

                                        {/* GROUP 6 â€” ASSIGNEE */}
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] px-1">Assignee</h4>
                                            <Dropdown
                                                variant="metallic"
                                                label="Assignee"
                                                options={teamMembers
                                                    .filter(m => m.role?.trim().toLowerCase() === 'freelancer')
                                                    .sort((a, b) => {
                                                        const statA = freelancerWorkload[a.name || a.email] || { assigned: 0 };
                                                        const statB = freelancerWorkload[b.name || b.email] || { assigned: 0 };
                                                        const remA = (a.daily_capacity || 5) - statA.assigned;
                                                        const remB = (b.daily_capacity || 5) - statB.assigned;
                                                        return remB - remA;
                                                    })
                                                    .map(m => {
                                                        const name = m.name || m.email;
                                                        const stat = freelancerWorkload[name] || { assigned: 0, inProgress: 0 };
                                                        const capacity = m.daily_capacity || 5;
                                                        const usage = stat.assigned / capacity;

                                                        const descriptionClassName = usage >= 1.0
                                                            ? 'bg-brand-error/20 border-brand-error/30 text-brand-error'
                                                            : usage > 0.4
                                                                ? 'bg-brand-warning/20 border-brand-warning/30 text-brand-warning'
                                                                : 'bg-brand-success/20 border-brand-success/30 text-brand-success';

                                                        return {
                                                            label: name,
                                                            value: name,
                                                            description: `${stat.assigned} / ${capacity}`,
                                                            descriptionClassName
                                                        };
                                                    })
                                                }
                                                value={selectedAssignee || ''}
                                                onChange={setSelectedAssignee}
                                                showSearch
                                            />
                                        </div>
                                    </div>
                                )}

                                {selectedMove === 'Cancel' && (
                                    <div className="space-y-10">
                                        {/* CANCEL BRANCH REVIEW */}

                                        {/* GROUP 1: ACTION & CONTEXT */}
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] px-1">Action & Context</h4>
                                            <div className="space-y-6">
                                                <Dropdown
                                                    variant="metallic"
                                                    label="Action Move"
                                                    options={[
                                                        { label: 'Add', value: 'Add' },
                                                        { label: 'Remove', value: 'Remove' },
                                                        { label: 'Cancel', value: 'Cancel' },
                                                        { label: 'Approve', value: 'Approve' }
                                                    ]}
                                                    value={selectedMove || ''}
                                                    onChange={setSelectedMove}
                                                />
                                                <div className="bg-white/[0.03] border border-surface-border rounded-2xl p-6 text-center">
                                                    <p className="text-gray-400 text-sm leading-relaxed">
                                                        You are confirming an <span className="text-white font-bold">{selectedMove}</span> action.
                                                        Please review the selection below before submitting.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-surface-border/30 w-full" />

                                        {/* GROUP 2: CANCELLATION REASON */}
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] px-1">Cancellation Reason</h4>
                                            <div className="space-y-3">
                                                {['Client Was Unclear', 'Designs Were Not Good Enough', 'Client Not Satisfied', 'Other'].map((item) => (
                                                    <React.Fragment key={item}>
                                                        <Radio
                                                            variant="metallic"
                                                            label={item}
                                                            name="review-cancellation-reason"
                                                            checked={cancellationReason === item}
                                                            onChange={() => { }}
                                                            disabled={true}
                                                            className="text-[12px]"
                                                        />
                                                        {item === 'Other' && cancellationReason === 'Other' && (
                                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200 ml-4 border-l-2 border-brand-primary/20 pl-4">
                                                                <Input
                                                                    variant="metallic"
                                                                    placeholder="Type reason here"
                                                                    value={cancellationOtherText}
                                                                    onChange={() => { }}
                                                                    disabled={true}
                                                                    size="lg"
                                                                    className="opacity-100 text-white"
                                                                />
                                                            </div>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="h-px bg-surface-border/30 w-full" />

                                        {/* GROUP 3: DETAILS */}
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] px-1">Details</h4>
                                            <div className="space-y-6">
                                                <Input
                                                    variant="metallic"
                                                    label="Project ID"
                                                    value={cancelProjectId}
                                                    onChange={(e) => setCancelProjectId(e.target.value)}
                                                    placeholder="eg ARS 123456"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedMove === 'Approve' && (
                                    <div className="space-y-10">
                                        {/* APPROVE BRANCH REVIEW */}

                                        {/* GROUP 1: ACTION & CONTEXT */}
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] px-1">Action & Context</h4>
                                            <div className="space-y-6">
                                                <Dropdown
                                                    variant="metallic"
                                                    label="Action Move"
                                                    options={[
                                                        { label: 'Add', value: 'Add' },
                                                        { label: 'Remove', value: 'Remove' },
                                                        { label: 'Cancel', value: 'Cancel' },
                                                        { label: 'Approve', value: 'Approve' }
                                                    ]}
                                                    value={selectedMove || ''}
                                                    onChange={setSelectedMove}
                                                />

                                                <div className="space-y-4">
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Any Tips?</label>
                                                    <div className="flex flex-col gap-3">
                                                        <Radio
                                                            label="Yes"
                                                            name="review-approve-tips"
                                                            variant="metallic"
                                                            checked={approveTips === 'Yes'}
                                                            onChange={() => { }}
                                                            disabled={true}
                                                        />
                                                        <Radio
                                                            label="No"
                                                            name="review-approve-tips"
                                                            variant="metallic"
                                                            checked={approveTips === 'No'}
                                                            onChange={() => { }}
                                                            disabled={true}
                                                        />
                                                    </div>
                                                </div>

                                                {approveTips === 'Yes' && (
                                                    <Input
                                                        variant="metallic"
                                                        label="Tip Amount"
                                                        value={approveAmount}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                setApproveAmount(val);
                                                            }
                                                        }}
                                                        leftIcon={<span className="text-gray-500">$</span>}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <div className="h-px bg-surface-border/30 w-full" />

                                        {/* GROUP 2: DETAILS */}
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] px-1">Details</h4>
                                            <div className="space-y-6">
                                                <Input
                                                    variant="metallic"
                                                    label="Project ID"
                                                    value={approveProjectId}
                                                    onChange={(e) => setApproveProjectId(e.target.value)}
                                                    placeholder="eg ARS 123456"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Expanded Project Brief Modal */}
            <Modal
                isOpen={isBriefExpanded}
                onClose={() => setIsBriefExpanded(false)}
                title="Project Brief"
                size="lg"
                footer={(
                    <div className="flex justify-end">
                        <Button variant="metallic" onClick={() => setIsBriefExpanded(false)}>
                            Done
                        </Button>
                    </div>
                )}
            >
                <div className="flex flex-col">
                    <div className="flex justify-start mb-6 shrink-0">
                        <Tabs
                            tabs={[
                                { id: 'edit', label: 'Edit' },
                                { id: 'preview', label: 'Preview' }
                            ]}
                            activeTab={briefMode}
                            onTabChange={(id) => setBriefMode(id as 'edit' | 'preview')}
                        />
                    </div>

                    <div className="select-text pb-8">
                        {briefMode === 'edit' ? (
                            <TextArea
                                variant="metallic"
                                placeholder="Type here"
                                value={projectBriefText}
                                onChange={(e) => setProjectBriefText(e.target.value)}
                                className="w-full"
                                inputClassName="!min-h-[400px]"
                                autoFocus
                            />
                        ) : (
                            <div className="p-6 bg-black/40 rounded-3xl border border-white/5 shadow-[inset_0_4px_24px_rgba(0,0,0,0.5)] min-h-[400px]">
                                {projectBriefText.trim() ? (
                                    <ReactMarkdown components={markdownComponents} remarkPlugins={markdownPlugins}>
                                        {parseCodesLogicMarkdown(projectBriefText)}
                                    </ReactMarkdown>
                                ) : (
                                    <p className="text-gray-500 italic text-sm">Nothing to preview. Start typing...</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div >
    );
});

export default Projects;
