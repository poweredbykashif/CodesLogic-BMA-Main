
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import {
    IconChevronLeft,
    IconLayoutSidebar,
    IconBriefcase,
    IconClock,
    IconUser,
    IconCreditCard,
    IconAlertTriangle,
    IconPaperclip,
    IconSend,
    IconCheckCircle,
    IconMoreVertical,
    IconX,
    IconFile,
    IconFileImage,
    IconFileText,
    IconChartBar,
    IconFileVideo,
    IconFileArchive,
    IconDownload,
    IconLink,
    IconRefreshCw,
    IconChevronRight,
    IconCalendar,
    IconStar,
    IconEdit,
    IconSave,
    IconUsers,
    IconTrash,
    IconPlus,
    IconLock
} from '../components/Icons';
import { formatTime, formatDeadlineDate, getTimeLeft, formatDisplayName } from '../utils/formatter';
import { DatePicker } from '../components/DatePicker';
import { TimeSelect } from '../components/TimeSelect';
import { ElevatedMetallicCard } from '../components/ElevatedMetallicCard';
import { Dropdown } from '../components/Dropdown';
import { Input, TextArea } from '../components/Input';
import { Modal } from '../components/Surfaces';
import { addToast } from '../components/Toast';
import { useNotifications } from '../contexts/NotificationContext';
import { useUser } from '../contexts/UserContext';
import { Avatar } from '../components/Avatar';
import { useAccounts } from '../contexts/AccountContext';
import { getStatusCapsuleClasses } from '../components/Badge';
import { Checkbox } from '../components/Selection';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export const markdownPlugins = [remarkGfm, remarkBreaks];

export const parseCodesLogicMarkdown = (text: string) => {
    if (!text) return '';
    // Replace literal bullets with markdown list items
    return text.replace(/^[ \t]*[ΓÇó][ \t]*/gm, '- ');
};
export const markdownComponents = {
    p: ({ node, ...props }: any) => <p className="mb-4 last:mb-0 text-[13px] leading-relaxed text-gray-300" {...props} />,
    strong: ({ node, ...props }: any) => <strong className="font-bold text-white tracking-wide" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc pl-5 mb-4 space-y-2 text-[13px] text-gray-300" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal pl-5 mb-4 space-y-2 text-[13px] text-gray-300" {...props} />,
    li: ({ node, ...props }: any) => <li className="leading-relaxed text-[13px]" {...props} />,
    a: ({ node, ...props }: any) => <a className="text-brand-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
    h1: ({ node, ...props }: any) => <h1 className="text-base font-bold text-white mb-4 mt-6 first:mt-0" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-sm font-bold text-white mb-3 mt-5 first:mt-0" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-sm font-bold text-white mb-2 mt-4 first:mt-0" {...props} />,
};

interface ProjectDetailsProps {
    projectId: string;
    initialData?: any;
    onBack: () => void;
    onStatusChange?: (newStatus: string) => void;
    onIdChange?: (oldId: string, newId: string) => void;
    onUpdate?: () => void;
}

// Helper for dynamic status styles driven by CodesLogic tokens




const Skeleton = ({ className }: { className?: string }) => (
    <div className={`bg-white/5 rounded-lg animate-pulse ${className}`} />
);

const ProjectDetails: React.FC<ProjectDetailsProps> = ({ projectId, initialData, onBack, onStatusChange, onIdChange, onUpdate }) => {
    const [project, setProject] = useState<any>(() => {
        if (initialData && (initialData.id === projectId || initialData.project_id === projectId)) {
            return initialData;
        }

        const idKey = projectId.replace(/-/g, ' ');
        // 1. Try to find the exact full project from its dedicated cache for 0ms loads
        const detailCache = localStorage.getItem(`nova_project_detail_${idKey}`);
        if (detailCache) return JSON.parse(detailCache);

        // 2. Fallback to basic tabular cache to avoid blank titles
        const cachedProjects = localStorage.getItem('nova_projects_cache');
        if (cachedProjects) {
            const projects = JSON.parse(cachedProjects);
            return projects.find((p: any) => p.id === projectId || p.id === idKey) || null;
        }
        return null;
    });
    const canonicalId = project?.project_id || project?.id || projectId;
    const [isProjectLoading, setIsProjectLoading] = useState(() => {
        if (project && 'brief' in project && project.brief) return false;
        return true;
    });
    const [isCommentsLoading, setIsCommentsLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
    const [modalDate, setModalDate] = useState<Date | null>(null);
    const [modalTime, setModalTime] = useState('17:00');
    const [activeShortcut, setActiveShortcut] = useState<number | null>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isPostingComment, setIsPostingComment] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [currentRole, setCurrentRole] = useState('Project Manager');
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const { addNotification } = useNotifications();
    const { profile, effectiveRole } = useUser();
    const userRole = effectiveRole?.toLowerCase().trim() || '';
    const isProjectManager = userRole.includes('manager') || userRole.includes('admin') || userRole.includes('operations');
    const isFreelancer = userRole === 'freelancer';

    // Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [editState, setEditState] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [allProfiles, setAllProfiles] = useState<any[]>([]);
    const [managers, setManagers] = useState<any[]>([]);
    const [freelancers, setFreelancers] = useState<any[]>([]);
    const { hasPermission } = useUser();
    const canEdit = hasPermission('edit_projects');
    const { accounts } = useAccounts();

    // Review & View State
    const [viewMode, setViewMode] = useState<'timeline' | 'review'>('timeline');
    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [reviewSubmitted, setReviewSubmitted] = useState(false);
    const [existingReview, setExistingReview] = useState<any>(null);
    const [allReviews, setAllReviews] = useState<any[]>([]);
    const [revieweeAvatarUrl, setRevieweeAvatarUrl] = useState<string | null>(null);
    const [teamProfileData, setTeamProfileData] = useState<Record<string, { avatar_url?: string; phone?: string }>>({});
    const [isReviewsLoading, setIsReviewsLoading] = useState(false);
    const [projectTeammates, setProjectTeammates] = useState<any[]>([]);
    const [isLogsExpanded, setIsLogsExpanded] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [mobileView, setMobileView] = useState<'metadata' | 'brief'>('metadata');

    // Brief File Upload State
    const [isBriefUploading, setIsBriefUploading] = useState(false);
    const briefFileInputRef = useRef<HTMLInputElement>(null);

    // Fetch teammates (other members of the primary manager's teams)
    useEffect(() => {
        const fetchTeammates = async () => {
            if (!project?.primary_manager_id) return;

            try {
                // 1. Get the primary manager's team IDs
                const { data: userTeams } = await supabase
                    .from('team_members')
                    .select('team_id')
                    .eq('member_id', project.primary_manager_id);

                if (userTeams && userTeams.length > 0) {
                    const teamIds = userTeams.map(t => t.team_id);

                    // 2. Fetch all members of these teams
                    const { data: members } = await supabase
                        .from('team_members')
                        .select('profiles(id, name, role, phone)')
                        .in('team_id', teamIds)
                        .neq('member_id', project.primary_manager_id);

                    if (members) {
                        const uniqueMembers = Array.from(new Map(
                            members
                                .filter((m: any) => m.profiles)
                                .map((m: any) => [m.profiles.id, {
                                    id: m.profiles.id,
                                    name: m.profiles.name,
                                    role: m.profiles.role
                                }])
                        ).values());
                        setProjectTeammates(uniqueMembers);
                    }
                }
            } catch (err) {
                console.error('Error fetching teammates:', err);
            }
        };
        fetchTeammates();
    }, [project?.primary_manager_id]);

    // Aggregate all collaborators: Explicitly assigned + Team members
    const allCollaborators = useMemo(() => {
        const collaborators = project?.collaborators || [];
        const teammates = projectTeammates.map(t => ({
            id: t.id,
            name: t.name,
            role: t.role || 'Member',
            phone: t.phone
        }));

        const seen = new Set();
        const result: any[] = [];

        // Priority 1: Explicitly assigned collaborators
        collaborators.forEach((c: any) => {
            const key = c.id || c.name;
            if (key) {
                seen.add(key);
                result.push(c);
            }
        });

        // Priority 2: Other members from the primary manager's team
        teammates.forEach(t => {
            const key = t.id || t.name;
            if (key && !seen.has(key)) {
                seen.add(key);
                result.push(t);
            }
        });

        return result;
    }, [project?.collaborators, projectTeammates]);

    // Fetch profile data (avatars & phones) for all team members mentioned in project
    useEffect(() => {
        const fetchTeamProfileData = async () => {
            if (!project) return;
            const names = new Set<string>();
            if (project.assignee) names.add(project.assignee);
            if (project.primary_manager?.name) names.add(project.primary_manager.name);

            // Use unified allCollaborators list
            allCollaborators.forEach((c: any) => {
                if (c.name) names.add(c.name);
            });

            if (names.size === 0) return;

            const nameList = Array.from(names);
            const { data } = await supabase
                .from('profiles')
                .select('name, avatar_url, phone')
                .in('name', nameList);

            if (data) {
                const map: Record<string, { avatar_url?: string; phone?: string }> = {};
                data.forEach(p => {
                    map[p.name] = {
                        avatar_url: p.avatar_url || undefined,
                        phone: p.phone || undefined
                    };
                });
                setTeamProfileData(prev => ({ ...prev, ...map }));
            }
        };
        fetchTeamProfileData();
    }, [project?.project_id, allCollaborators]);

    // Auto-set viewMode to review if approved
    useEffect(() => {
        if (project?.status?.toLowerCase().includes('approved')) {
            setViewMode('review');
        } else {
            setViewMode('timeline');
        }
    }, [project?.status]);

    // Fetch reviewee avatar when project is approved
    useEffect(() => {
        const fetchRevieweeAvatar = async () => {
            if (!project?.status?.toLowerCase().includes('approved')) return;
            const targetName = isFreelancer
                ? project?.primary_manager?.name
                : project?.assignee;
            if (!targetName) return;
            const { data } = await supabase
                .from('profiles')
                .select('avatar_url')
                .or(`name.eq."${targetName}",email.eq."${targetName}"`)
                .maybeSingle();
            if (data?.avatar_url) setRevieweeAvatarUrl(data.avatar_url);
        };
        fetchRevieweeAvatar();
    }, [project?.status, project?.assignee, project?.primary_manager?.name, isFreelancer]);

    // Check for existing review and fetch all reviews for admins
    useEffect(() => {
        const fetchReviews = async () => {
            if (!profile?.id || !canonicalId || !project?.status?.toLowerCase().includes('approved')) return;

            const isAdmin = ['Super Admin', 'Admin'].includes(profile.role);
            setIsReviewsLoading(true);

            // 1. Fetch ALL reviews for the project if Admin
            if (isAdmin) {
                const { data: multipleReviews } = await supabase
                    .from('project_reviews')
                    .select('*')
                    .eq('project_id', canonicalId)
                    .order('created_at', { ascending: true });

                if (multipleReviews && multipleReviews.length > 0) {
                    const reviewerIds = multipleReviews.map((r: any) => r.reviewer_id).filter(Boolean);
                    const reviewerNames = multipleReviews.map((r: any) => r.reviewer_name).filter(Boolean);

                    // Fetch profiles by ID OR Name for maximum robustness
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('id, name, avatar_url')
                        .or(`id.in.(${reviewerIds.map(id => `"${id}"`).join(',')}),name.in.(${reviewerNames.map(name => `"${name}"`).join(',')})`);

                    // Create lookup maps
                    const avatarMapById = new Map();
                    const avatarMapByName = new Map();
                    profileData?.forEach(p => {
                        if (p.id) avatarMapById.set(p.id, p.avatar_url);
                        if (p.name) avatarMapByName.set(p.name, p.avatar_url);
                    });

                    // Merge avatars into reviews
                    const reviewsWithAvatars = multipleReviews.map((rev: any) => ({
                        ...rev,
                        avatar_url: avatarMapById.get(rev.reviewer_id) || avatarMapByName.get(rev.reviewer_name)
                    }));

                    setAllReviews(reviewsWithAvatars);
                } else if (multipleReviews) {
                    setAllReviews(multipleReviews);
                }
            }

            // 2. Check for current user's review
            const { data, error } = await supabase
                .from('project_reviews')
                .select('*')
                .eq('project_id', canonicalId)
                .eq('reviewer_id', profile.id)
                .maybeSingle();

            if (!error && data) {
                setExistingReview(data);
                setRating(data.rating);
                setReviewText(data.review_text);
                setReviewSubmitted(true);
            }
            setIsReviewsLoading(false);
        };
        fetchReviews();
    }, [canonicalId, profile?.id, project?.status, profile?.role]);

    // Sync role from profile
    useEffect(() => {
        if (profile?.role) {
            setCurrentRole(profile.role);
        }
    }, [profile]);

    // Fetch lists for editing
    useEffect(() => {
        const fetchEditLists = async () => {
            if (!canEdit) return;
            const { data: profiles } = await supabase.from('profiles').select('id, name, role, avatar_url, phone').order('name');
            if (profiles) {
                setAllProfiles(profiles);
                setManagers(profiles.filter(p => p.role?.toLowerCase().includes('manager') || p.role?.toLowerCase().includes('admin') || p.role?.toLowerCase().includes('operations')));
                setFreelancers(profiles.filter(p => p.role?.toLowerCase() === 'freelancer' || p.role?.toLowerCase() === 'designer' || p.role?.toLowerCase().includes('presentation')));
            }
        };
        fetchEditLists();
    }, [canEdit]);

    const startEditing = () => {
        if (!project) return;
        setEditState({
            project_id: project?.project_id || '',
            project_title: project?.project_title || '',
            options_required: project?.options_required ?? 1,
            client_name: project?.client_name || '',
            assignee: project?.assignee || '',
            primary_manager_id: project?.primary_manager_id || null,
            collaborators: [...(project?.collaborators || [])],
            addons: project?.addons || [],
            brief: project?.brief || '',
            price: project?.price || 0,
            account_id: project?.account_id || null,
            order_type: project?.order_type || 'Direct',
            client_type: project?.client_type || 'new',
            converted_by: project?.converted_by || null,
            attachments: [...(project?.attachments || [])]
        });
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        if (!editState || isSaving) return;
        setIsSaving(true);

        try {
            const originalId = project.project_id;
            const selectedAccount = accounts.find(a => a.id === editState.account_id);
            const updates: any = {
                project_title: editState.project_title,
                options_required: editState.options_required,
                client_name: editState.client_name,
                assignee: editState.assignee,
                primary_manager_id: editState.primary_manager_id || null,
                account_id: editState.account_id || null,
                account: selectedAccount?.name || project.account,
                addons: editState.addons,
                brief: editState.brief,
                price: editState.price,
                order_type: editState.order_type,
                client_type: editState.client_type,
                converted_by: editState.order_type === 'Converted' ? (editState.converted_by || null) : null,
                attachments: editState.attachments,
                updated_at: new Date().toISOString()
            };

            // Only include project_id in updates if it has actually changed to avoid 
            // unnecessary foreign key constraint checks that lack ON UPDATE CASCADE
            if (editState.project_id !== originalId) {
                updates.project_id = editState.project_id;
            }

            // 1. Update Project
            const { error: projectError } = await supabase
                .from('projects')
                .update(updates)
                .eq('project_id', originalId);

            if (projectError) throw projectError;

            // 2. Sync Collaborators
            // Delete existing relations
            await supabase.from('project_collaborators').delete().eq('project_id', editState.project_id);

            // Insert new ones
            if (editState.collaborators.length > 0) {
                const collabInserts = editState.collaborators.map((c: any) => ({
                    project_id: editState.project_id,
                    user_id: c.id
                }));
                const { error: collabError } = await supabase.from('project_collaborators').insert(collabInserts);
                if (collabError) throw collabError;
            }

            // 3. Log what changed (Quiet Logging)
            const changes: string[] = [];

            // Normalize values for comparison
            const oldTitle = project.project_title || '';
            const newTitle = editState.project_title || '';
            const oldPM = project.primary_manager_id || null;
            const newPM = editState.primary_manager_id || null;
            const oldAssignee = project.assignee || 'Unassigned';
            const newAssignee = editState.assignee || 'Unassigned';
            const oldPrice = Number(project.price) || 0;
            const newPrice = Number(editState.price) || 0;
            const oldOptions = project.options_required ?? 1;
            const newOptions = editState.options_required ?? 1;
            const oldClient = project.client_name || '';
            const newClient = editState.client_name || '';

            const oldBrief = (project.brief || '').trim();
            const newBrief = (editState.brief || '').trim();

            const oldOrderType = project.order_type || 'Direct';
            const newOrderType = editState.order_type || 'Direct';
            const oldClientType = project.client_type || 'new';
            const newClientType = editState.client_type || 'new';

            const oldConvertedBy = project.converted_by || null;
            const newConvertedBy = editState.converted_by || null;

            if (originalId !== editState.project_id) changes.push(`ID: ${originalId} → ${editState.project_id}`);
            if (oldTitle !== newTitle) changes.push(`Title: ${oldTitle} → ${newTitle}`);
            if (oldClient !== newClient) changes.push(`Client: ${oldClient} → ${newClient}`);
            if (oldOptions !== newOptions) changes.push(`Options: ${oldOptions} → ${newOptions}`);
            if (oldAssignee !== newAssignee) changes.push(`Assignee: ${oldAssignee} → ${newAssignee}`);

            if (oldPM !== newPM) {
                const newManagerName = managers.find(m => m.id === newPM)?.name || 'Support';
                const oldManagerName = managers.find(m => m.id === oldPM)?.name || 'Support';
                changes.push(`PM: ${oldManagerName} → ${newManagerName}`);
            }

            if (oldPrice !== newPrice) changes.push(`Budget: $${oldPrice} → $${newPrice}`);
            if (oldBrief !== newBrief) changes.push(`Brief: Changed`);
            if (oldOrderType !== newOrderType) changes.push(`Order Type: ${oldOrderType} → ${newOrderType}`);
            if (oldClientType !== newClientType) changes.push(`Client Type: ${oldClientType} → ${newClientType}`);
            if (oldConvertedBy !== newConvertedBy) {
                const oldConvName = managers.find(m => m.id === oldConvertedBy)?.name || 'None';
                const newConvName = managers.find(m => m.id === newConvertedBy)?.name || 'None';
                changes.push(`Converted By: ${oldConvName} → ${newConvName}`);
            }

            if (changes.length > 0) {
                const userName = profile?.name || 'System';
                const logContent = `[${userName}] updated: ${changes.join(' | ')}`;

                await supabase.from('project_comments').insert({
                    project_id: editState.project_id,
                    content: logContent,
                    author_name: userName,
                    author_role: 'system_log'
                });
            }

            // 4. Update UI & Local Cache/Parent
            if (originalId !== editState.project_id && onIdChange) {
                onIdChange(originalId, editState.project_id);
            }
            await fetchProject(editState.project_id);
            await fetchComments(editState.project_id);
            if (onUpdate) onUpdate();
            setIsEditing(false);
            addToast({ title: 'Success', message: 'Project details and financial links synced successfully', type: 'success' });

        } catch (err: any) {
            console.error('Error saving project:', err);
            addToast({ title: 'Error', message: err.message || 'Failed to update project', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };
    interface Attachment {
        file: File;
        id: string;
        status: 'uploading' | 'success' | 'error';
        previewUrl?: string;
    }

    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles: Attachment[] = Array.from(e.target.files).map((file: File) => ({
                file,
                id: Math.random().toString(36).substr(2, 9),
                status: 'uploading' as const
            }));

            setAttachments(prev => [...prev, ...newFiles]);

            // Simulate upload & convert to Data URI for persistence
            newFiles.forEach(att => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const persistentUrl = e.target?.result as string;

                    setTimeout(() => {
                        setAttachments(prev => prev.map(p =>
                            p.id === att.id
                                ? { ...p, status: 'success', previewUrl: persistentUrl }
                                : p
                        ));
                    }, 1500 + Math.random() * 1000);
                };
                reader.readAsDataURL(att.file);
            });
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleBriefFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        setIsBriefUploading(true);
        const newFiles = Array.from(e.target.files);

        try {
            const attachmentPromises = newFiles.map(file => {
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

            const newAttachments = await Promise.all(attachmentPromises);
            setEditState((prev: any) => ({
                ...prev,
                attachments: [...(prev.attachments || []), ...newAttachments]
            }));
        } catch (err) {
            console.error('Error processing files:', err);
            addToast({ title: 'Error', message: 'Failed to process files', type: 'error' });
        } finally {
            setIsBriefUploading(false);
            if (briefFileInputRef.current) briefFileInputRef.current.value = '';
        }
    };

    const removeBriefFile = (index: number) => {
        setEditState((prev: any) => ({
            ...prev,
            attachments: prev.attachments.filter((_: any, i: number) => i !== index)
        }));
    };


    const removeAttachment = (index: number) => {
        setAttachments(prev => {
            const newAttachments = [...prev];
            const removed = newAttachments.splice(index, 1)[0];
            if (removed.previewUrl) {
                URL.revokeObjectURL(removed.previewUrl);
            }
            return newAttachments;
        });
    };

    const fetchComments = async (targetId?: string) => {
        const idToUse = targetId || project?.project_id;
        if (!idToUse) return;

        // Fetch the 6 most recent comments to check for 'hasMore'
        const { data, error } = await supabase
            .from('project_comments')
            .select('*')
            .eq('project_id', idToUse)
            .order('created_at', { ascending: false })
            .limit(6);

        if (!error && data) {
            if (data.length > 5) {
                setHasMore(true);
                // Use only the latest 5
                const visibleComments = data.slice(0, 5);
                setComments(visibleComments.reverse());
            } else {
                setHasMore(false);
                setComments([...data].reverse());
            }
        }
    };

    const fetchOlderComments = async () => {
        if (isLoadingOlder || comments.length === 0 || !project?.project_id) return;
        setIsLoadingOlder(true);

        // Get the timestamp of the oldest comment we currently have
        // (Since they are reversed, comments[0] is the oldest visible)
        const oldestTimestamp = comments[0].created_at;

        const { data, error } = await supabase
            .from('project_comments')
            .select('*')
            .eq('project_id', project.project_id)
            .lt('created_at', oldestTimestamp)
            .order('created_at', { ascending: false })
            .limit(6);

        if (!error && data) {
            if (data.length > 5) {
                setHasMore(true);
                const newBatch = data.slice(0, 5);
                setComments(prev => [...newBatch.reverse(), ...prev]);
            } else {
                setHasMore(false);
                setComments(prev => [...data.reverse(), ...prev]);
            }
        }
        setIsLoadingOlder(false);
    };

    const fetchProject = async (overrideId?: string) => {
        const targetId = overrideId || projectId;
        let query = supabase.from('projects_with_collaborators').select('*, primary_manager:profiles!primary_manager_id (name, phone)');

        const { data, error } = await query
            .or(`project_id.eq."${targetId}",project_id.eq."${targetId.replace(/-/g, ' ')}",project_id.eq."${targetId.replace(/ /g, '-')}"`)
            .maybeSingle();

        if (!error && data) {
            setProject(data);
            const idKey = data.project_id.replace(/-/g, ' ');

            // Optimization: Remove large fields before caching in localStorage to avoid QuotaExceededError
            const cacheData = { ...data };
            delete cacheData.attachments;
            delete cacheData.brief;

            try {
                localStorage.setItem(`nova_project_detail_${idKey}`, JSON.stringify(cacheData));

                const cached = localStorage.getItem('nova_projects_cache');
                if (cached) {
                    const projects = JSON.parse(cached);
                    const idx = projects.findIndex((p: any) => (p.project_id || p.id) === data.project_id || (p.project_id || p.id) === idKey);
                    if (idx !== -1) {
                        projects[idx] = { 
                            ...projects[idx], 
                            project_title: data.project_title,
                            client_name: data.client_name,
                            client_type: data.client_type,
                            status: data.status, 
                            due_date: data.due_date, 
                            due_time: data.due_time,
                            assignee: data.assignee,
                            price: data.price,
                            order_type: data.order_type
                        };
                        localStorage.setItem('nova_projects_cache', JSON.stringify(projects));
                    }
                }
            } catch (e) {
                console.warn('LocalStorage quota exceeded, skipping detail cache update');
            }

            return data.project_id;
        }
        return null;
    };

    const forceDownload = async (url: string, filename: string) => {
        if (!url) return;

        const getExtensionFromMime = (mime: string): string => {
            const map: Record<string, string> = {
                'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
                'image/webp': 'webp', 'application/pdf': 'pdf', 'application/msword': 'doc',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
                'application/zip': 'zip', 'application/postscript': 'ai',
                'image/vnd.adobe.photoshop': 'psd', 'text/plain': 'txt',
                'video/mp4': 'mp4', 'image/svg+xml': 'svg'
            };
            return map[mime] || '';
        };

        let finalFilename = filename;

        try {
            // Priority 1: Data URIs (Base64)
            if (url.startsWith('data:')) {
                const response = await fetch(url);
                const blob = await response.blob();

                if (!finalFilename.includes('.')) {
                    const ext = getExtensionFromMime(blob.type);
                    if (ext) finalFilename += `.${ext}`;
                }

                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = finalFilename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                return;
            }

            // Priority 2: Supabase Storage URLs
            // If it's a supabase URL, we can use the download param trick
            if (url.includes('.sslip.io') || url.includes('supabase.co')) {
                const downloadUrl = new URL(url);
                // Supabase honors ?download=filename on public requests
                downloadUrl.searchParams.set('download', finalFilename);

                const link = document.createElement('a');
                link.href = downloadUrl.toString();
                link.download = finalFilename;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                return;
            }

            // Priority 3: Standard Fetch & Blob (Best for CORS-enabled servers)
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            const blob = await response.blob();

            if (!finalFilename.includes('.')) {
                const ext = getExtensionFromMime(blob.type);
                if (ext) finalFilename += `.${ext}`;
            }

            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = finalFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

        } catch (error) {
            console.warn('Advanced download failed, using emergency window fallback:', error);
            window.open(url, '_blank');
        }
    };

    // Helper component for consistent file icons
    const FileIcon: React.FC<{ name: string; type?: string; url?: string; className?: string }> = ({ name, type, url, className = "w-full h-full" }) => {
        const ext = name.split('.').pop()?.toLowerCase() || '';
        const isImage = type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);

        // Map extensions to specialized brand icons from /public
        if (ext === 'ai') return <img src="/ai-document.png" className={`${className} object-contain p-2`} alt="AI" />;
        if (ext === 'psd') return <img src="/psd-icon.png" className={`${className} object-contain p-2`} alt="PSD" />;
        if (ext === 'pdf') return <img src="/pdf-icon.png" className={`${className} object-contain p-2`} alt="PDF" />;
        if (ext === 'png') return <img src="/png-icon.png" className={`${className} object-contain p-2`} alt="PNG" />;
        if (['jpg', 'jpeg'].includes(ext)) return <img src="/jpg-icon.png" className={`${className} object-contain p-2`} alt="JPG" />;
        if (ext === 'eps') return <img src="/eps-icon.png" className={`${className} object-contain p-2`} alt="EPS" />;
        if (['zip', 'rar', '7z'].includes(ext)) return <img src="/zip-icon.png" className={`${className} object-contain p-2`} alt="ZIP" />;
        if (['doc', 'docx'].includes(ext)) return <img src="/doc-icon.png" className={`${className} object-contain p-2`} alt="Word" />;
        if (['xls', 'xlsx'].includes(ext)) return <img src="/xls-icon.png" className={`${className} object-contain p-2`} alt="Excel" />;
        if (ext === 'txt') return <img src="/txt-icon.png" className={`${className} object-contain p-2`} alt="TXT" />;
        if (['html', 'htm'].includes(ext)) return <img src="/html-icon.png" className={`${className} object-contain p-2`} alt="HTML" />;
        if (ext === 'mp3') return <img src="/mp3-icon.png" className={`${className} object-contain p-2`} alt="MP3" />;
        if (ext === 'gif') return <img src="/gif-icon.png" className={`${className} object-contain p-2`} alt="GIF" />;

        // Image preview if it's a generic image
        if (isImage && url) {
            return (
                <>
                    <img src={url} className="w-full h-full object-cover" alt={name} />
                    <div className="absolute inset-0 bg-black/5" />
                </>
            );
        }

        // Final Gradient Fallback for everything else
        let gradient = 'from-slate-600 to-slate-700';
        let Icon = IconFile;
        if (['mp4', 'mov', 'avi'].includes(ext)) { gradient = 'from-violet-500 to-purple-600'; Icon = IconFileVideo; }

        return (
            <div className={`flex flex-col items-center justify-center bg-gradient-to-br ${gradient} p-2 shadow-inner h-full w-full`}>
                <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <Icon size={24} className="text-white drop-shadow-md relative z-10" />
                <span className="text-[9px] font-bold text-white uppercase mt-1 tracking-widest drop-shadow-sm relative z-10 opacity-90">{ext.slice(0, 4)}</span>
            </div>
        );
    };

    useEffect(() => {
        const fetchData = async () => {
            // Reset edit mode when changing projects to avoid stale data or crashes
            setIsEditing(false);
            setEditState(null);

            // Assume the project ID matches what we display, replace URL dashes with spaces
            const normalizedId = projectId.replace(/-/g, ' ');

            if (!project || !('brief' in project)) setIsProjectLoading(true);
            setIsCommentsLoading(true);

            // Fetch concurrently without blocking
            fetchProject().finally(() => setIsProjectLoading(false));
            fetchComments(normalizedId).finally(() => setIsCommentsLoading(false));
        };

        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    const handlePostComment = async () => {
        if ((!newComment.trim() && attachments.length === 0) || isPostingComment) return;

        setIsPostingComment(true);

        // Generate a stable ID for both UI key and Database ID 
        // to prevent double animation during background sync
        const stableId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `temp-${Date.now()}`;

        // Create optimistic comment for instant UI feedback
        const optimisticComment = {
            id: stableId,
            project_id: canonicalId,
            content: newComment.trim() || ' ',
            attachments: attachments.map(att => ({
                name: att.file.name,
                type: att.file.type,
                size: att.file.size,
                url: att.previewUrl
            })),
            author_name: profile?.name || 'User',
            author_role: currentRole,
            created_at: new Date().toISOString(),
            isOptimistic: true // Flag to identify temporary comments
        };

        // Add optimistic comment immediately
        setComments(prev => [...prev, optimisticComment]);

        // Clear input immediately for better UX
        const commentText = newComment.trim();
        const commentAttachments = attachments;
        setNewComment('');
        setAttachments([]);

        // End loading state immediately for instant feedback
        setIsPostingComment(false);

        // Sync with database in background
        const payloadAttachments = commentAttachments.map(att => ({
            name: att.file.name,
            type: att.file.type,
            size: att.file.size,
            url: att.previewUrl
        }));

        const { error } = await supabase
            .from('project_comments')
            .insert([{
                id: stableId, // Use the same ID to prevent key change animation
                project_id: canonicalId,
                content: commentText || ' ',
                attachments: payloadAttachments,
                author_name: profile?.name || 'User',
                author_role: currentRole
            }]);

        if (error) {
            console.error('Error posting comment:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                full: error
            });
            // Remove optimistic comment on error
            setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
            // Restore input
            setNewComment(commentText);
            setAttachments(commentAttachments);
            addToast({ type: 'error', title: 'Post Failed', message: error.message || 'Could not send your comment. Please try again.' });
        } else {
            addToast({ type: 'success', title: 'Comment Sent', message: 'Your comment has been posted' });

            // Add notification with sound trigger
            const commentSnippet = commentText.length > 30 ? commentText.substring(0, 30) + '...' : commentText;
            const notificationMessage = payloadAttachments.length > 0
                ? `Files added to timeline : ${project?.project_title || canonicalId}`
                : `${commentSnippet || 'New comment'} : ${project?.project_title || canonicalId}`;

            // Determine notification target
            const assigneeProfile = projectTeammates.find(t => t.name === project?.assignee);
            const targetUserId = (profile?.id !== assigneeProfile?.id) ? (assigneeProfile?.id || project?.primary_manager_id) : project?.primary_manager_id;

            if (targetUserId && targetUserId !== profile?.id) {
                await addNotification({
                    type: 'timeline_update',
                    reference_id: canonicalId,
                    message: notificationMessage,
                    user_id: targetUserId,
                    is_read: false
                });
            }

            // Mark as persistent locally to avoid re-fetch trimming flicker
            setComments(prev => prev.map(c =>
                c.id === stableId ? { ...c, isOptimistic: false } : c
            ));
        }
    };

    const handleDateChange = async (date: Date) => {
        // ... handled in modal now ...
    };

    const handleUpdateDeadlineModal = async () => {
        if (!project || !modalDate || !modalTime) return;

        const yyyy = modalDate.getFullYear();
        const mm_month = String(modalDate.getMonth() + 1).padStart(2, '0');
        const dd_date = String(modalDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm_month}-${dd_date}`;
        const timeStr = modalTime;

        const previousDate = project.due_date;
        const previousTime = project.due_time;

        setProject((prev: any) => ({ ...prev, due_date: dateStr, due_time: timeStr }));
        setIsDeadlineModalOpen(false);
        setActiveShortcut(null);

        const { error } = await supabase
            .from('projects')
            .update({ due_date: dateStr, due_time: timeStr })
            .eq('project_id', canonicalId);

        if (error) {
            console.error('Error updating deadline:', error);
            setProject((prev: any) => ({ ...prev, due_date: previousDate, due_time: previousTime }));
            addToast({ type: 'error', title: 'Update Failed', message: 'Could not update deadline' });
            return;
        }

        addToast({ type: 'success', title: 'Deadline Updated', message: `Deadline set to ${formatDeadlineDate(dateStr)} ${formatTime(timeStr)}` });

        const stableId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `temp-${Date.now()}`;
        const content = `DEADLINE_UPDATED|${previousDate || 'Not Set'}|${dateStr}|${previousTime || 'Not Set'}|${timeStr}`;

        const optimisticCard = {
            id: stableId,
            project_id: canonicalId,
            content,
            author_name: profile?.name || 'User',
            author_role: currentRole,
            created_at: new Date().toISOString(),
            isOptimistic: true
        };

        setComments(prev => [...prev, optimisticCard]);

        const { error: timelineError } = await supabase
            .from('project_comments')
            .insert([{
                id: stableId,
                project_id: canonicalId,
                content,
                author_name: profile?.name || 'User',
                author_role: currentRole
            }]);

        if (timelineError) console.error('Error logging deadline update:', timelineError);
    };

    const handleDeleteComment = (commentId: string) => {
        console.log('DEBUG: handleDeleteComment triggered for ID:', commentId);
        if (!commentId) {
            addToast({ title: 'Error', message: 'Missing item ID', type: 'error' });
            return;
        }
        setItemToDelete(commentId);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        
        try {
            console.log('DEBUG: Executing Supabase delete for ID:', itemToDelete);
            const { error, count } = await supabase
                .from('project_comments')
                .delete({ count: 'exact' })
                .eq('id', itemToDelete);

            console.log('DEBUG: Supabase response - Count:', count, 'Error:', error);

            if (error) {
                console.error('Supabase delete error:', error);
                throw error;
            }

            if (count === 0) {
                console.warn('Delete failed: No rows affected. Check RLS or if ID exists.');
                addToast({ title: 'Delete Failed', message: 'Item not found or permission denied on server.', type: 'error' });
            } else {
                setComments(prev => prev.filter(c => c.id !== itemToDelete));
                addToast({ title: 'Success', message: 'Item removed from timeline', type: 'success' });
            }
        } catch (err: any) {
            console.error('Error deleting comment:', err);
            addToast({ title: 'Error', message: err.message || 'Failed to delete item', type: 'error' });
        } finally {
            setItemToDelete(null);
        }
    };

    const handleDeadlineShortcut = async (hours: number) => {
        if (!project) return;
        setActiveShortcut(hours);
        const now = new Date();
        const futureDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

        const yyyy = futureDate.getFullYear();
        const mm_month = String(futureDate.getMonth() + 1).padStart(2, '0');
        const dd = String(futureDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm_month}-${dd}`;
        const hh = String(futureDate.getHours()).padStart(2, '0');
        const mm = String(futureDate.getMinutes()).padStart(2, '0');
        const timeStr = `${hh}:${mm}`;

        const previousDate = project.due_date;
        const previousTime = project.due_time;

        // Optimistic update
        setProject((prev: any) => ({ ...prev, due_date: dateStr, due_time: timeStr }));

        const { error } = await supabase
            .from('projects')
            .update({ due_date: dateStr, due_time: timeStr })
            .eq('project_id', canonicalId);

        if (error) {
            console.error('Error updating deadline shortcut:', error);
            setProject((prev: any) => ({ ...prev, due_date: previousDate, due_time: previousTime }));
            addToast({ type: 'error', title: 'Update Failed', message: 'Could not update deadline' });
        } else {
            addToast({ type: 'success', title: 'Deadline Updated', message: `Set to ${formatDeadlineDate(dateStr)} ${formatTime(timeStr)}` });
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!project) return;

        const previousStatus = project.status;
        setProject((prev: any) => ({ ...prev, status: newStatus }));

        // If moving to Approved, ensure we mark payout_completed as true in the local state update
        // (The DB trigger will handle the actual logic, but we update UI state for consistency)
        if (newStatus.toLowerCase().includes('approved')) {
            setProject((prev: any) => ({ ...prev, payout_completed: true }));
        }

        const tableName = 'projects';
        const idColumn = 'project_id';

        const { error } = await supabase
            .from(tableName)
            .update({ status: newStatus })
            .eq(idColumn, canonicalId);

        if (error) {
            console.error('Error updating status:', error);
            setProject((prev: any) => ({ ...prev, status: previousStatus }));
            addToast({ type: 'error', title: 'Update Failed', message: 'Could not update project status' });
        } else {
            // 1. Generate a stable ID for both UI key and Database ID 
            const stableId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `temp-${Date.now()}`;

            // 2. Optimistic Status Change Card
            const optimisticStatusCard = {
                id: stableId,
                project_id: canonicalId,
                content: `STATUS_CHANGED:${previousStatus || 'Pending'}:${newStatus}`,
                author_name: profile?.name || 'User',
                author_role: currentRole,
                created_at: new Date().toISOString(),
                isOptimistic: true
            };

            // 3. Update UI Immediately
            setComments(prev => [...prev, optimisticStatusCard]);
            addToast({ type: 'success', title: 'Status Updated', message: `Project status is now ${newStatus}` });

            // 4. Process side effects in background (Async)
            const syncSideEffects = async () => {
                // Record status change in timeline
                const { error: timelineError } = await supabase
                    .from('project_comments')
                    .insert([{
                        id: stableId,
                        project_id: canonicalId,
                        content: `STATUS_CHANGED:${previousStatus || 'Pending'}:${newStatus}`,
                        author_name: profile?.name || 'User',
                        author_role: currentRole
                    }]);

                if (timelineError) console.error('Error syncing status timeline:', timelineError);

                // 1. Generate Status-specific flags
                const normalizedStatus = newStatus.toLowerCase().trim();
                const isDoneType = normalizedStatus.includes('done');

                // DEBUG LOGS
                console.log('--- STATUS CHANGE NOTIF DEBUG ---', {
                    newStatus,
                    isDoneType,
                    primaryManagerId: project?.primary_manager_id,
                    collaboratorsCount: project?.collaborators?.length || 0,
                    projectTitle: project?.project_title
                });

                if (isDoneType) {
                    // RULE: PMs and POMs are notified ONLY when project is marked as DONE (by freelancer usually)

                    // 1. Notify Primary Manager
                    if (project?.primary_manager_id && project.primary_manager_id !== profile?.id) {
                        addNotification({
                            type: 'project_done',
                            reference_id: canonicalId,
                            message: `Project marked as ${newStatus}: ${project?.project_title || canonicalId}`,
                            user_id: project.primary_manager_id,
                            is_read: false
                        }).catch(e => console.error('PM Notification Error:', e));
                    }

                    // 2. Notify Collaborators (usually other PMs)
                    if (Array.isArray(project?.collaborators)) {
                        project.collaborators.forEach((collab: any) => {
                            if (collab.id && collab.id !== profile?.id) { // Don't notify the person who made the change
                                addNotification({
                                    type: 'project_done',
                                    reference_id: canonicalId,
                                    message: `Project marked as ${newStatus}: ${project?.project_title || canonicalId}`,
                                    user_id: collab.id,
                                    is_read: false
                                }).catch(e => console.error('Collab Notification Error:', e));
                            }
                        });
                    }
                } else {
                    // RULE: For non-done statuses (Revision, In Progress, Approved, etc.), PMs/POMs should NOT be notified.
                    // We only notify the assigned freelancer to inform them of the change.

                    const assigneeProfile = projectTeammates.find(t => t.name === project?.assignee);

                    // ONLY notify the assignee if they exist and are not the one who made the change
                    if (assigneeProfile?.id && assigneeProfile.id !== profile?.id) {
                        addNotification({
                            type: 'status_update',
                            reference_id: canonicalId,
                            message: `Status changed to ${newStatus} : ${project?.project_title || canonicalId}`,
                            user_id: assigneeProfile.id,
                            is_read: false
                        }).catch(e => console.error('Assignee Status Update Notification Error:', e));
                    }
                }

                // Update tab parent
                if (onStatusChange) onStatusChange(newStatus);
            };

            syncSideEffects();
        }
    };

    const handleReopenProject = async () => {
        if (!project) return;

        // 1. We NO LONGER update the status to 'Revision' automatically.
        // We just switch the UI view to the timeline and log the event.
        setViewMode('timeline');

        // 2. Log the "REOPENED" event in the timeline
        const stableId = crypto.randomUUID();
        const { error: logError } = await supabase
            .from('project_comments')
            .insert([{
                id: stableId,
                project_id: canonicalId,
                content: `PROJECT_REOPENED:${project.status || 'Approved'}:${project.status || 'Approved'}`,
                author_name: profile?.name || 'User',
                author_role: currentRole
            }]);

        if (logError) console.error('Error logging reopen event:', logError);

        // 3. Update UI locally so the "Reopened" card appears immediately
        setComments(prev => [...prev, {
            id: stableId,
            project_id: canonicalId,
            content: `PROJECT_REOPENED:${project.status || 'Approved'}:${project.status || 'Approved'}`,
            author_name: profile?.name || 'User',
            author_role: currentRole,
            created_at: new Date().toISOString()
        }]);

        addToast({ type: 'success', title: 'Project Reopened', message: 'You can now view history and change status manually.' });
    };

    const handleTimeChange = async (newTime: string) => {
        if (!project) return;
        setActiveShortcut(null);

        const previousTime = project.due_time;
        setProject((prev: any) => ({ ...prev, due_time: newTime }));

        const { error } = await supabase
            .from('projects')
            .update({ due_time: newTime })
            .eq('project_id', canonicalId);
        if (error) {
            console.error('Error updating time:', error);
            setProject((prev: any) => ({ ...prev, due_time: previousTime }));
            addToast({ type: 'error', title: 'Update Failed', message: 'Could not update project deadline time' });
        } else {
            addToast({ type: 'success', title: 'Time Updated', message: `Deadline time set to ${formatTime(newTime)}` });
        }
    };

    const handleTriggerAlert = async (alertType: string) => {
        if (!project) return;

        const isArtHelp = alertType === 'Art Help';
        const isDispute = alertType === 'Dispute';
        const isNone = alertType === 'None';

        const updateData: any = {
            has_art_help: isArtHelp,
            has_dispute: isDispute
        };

        const { error } = await supabase
            .from('projects')
            .update(updateData)
            .eq('project_id', canonicalId);

        if (error) {
            console.error('Error triggering alert:', error);
            addToast({ type: 'error', title: 'Error', message: 'Failed to trigger alert' });
        } else {
            setProject((prev: any) => ({
                ...prev,
                has_art_help: isArtHelp,
                has_dispute: isDispute
            }));
            addToast({
                type: 'success',
                title: 'Alert Triggered',
                message: isNone ? 'Alerts cleared' : `${alertType} alert has been triggered`
            });

            // Trigger parent refresh if it exists
            if (onStatusChange) onStatusChange(project.status || '');
        }
    };

    const handleSubmitReview = async () => {
        if (rating === 0 || !reviewText.trim() || isSubmittingReview || !profile?.id) return;

        const targetName = isFreelancer
            ? (project?.primary_manager?.name || 'Project Manager')
            : (project?.assignee || 'Freelancer');

        setIsSubmittingReview(true);
        try {
            const { data, error } = await supabase
                .from('project_reviews')
                .insert([{
                    project_id: canonicalId,
                    reviewer_id: profile.id,
                    reviewer_name: profile.name,
                    reviewer_role: profile.role,
                    reviewee_name: targetName,
                    rating,
                    review_text: reviewText,
                }])
                .select()
                .single();

            if (error) throw error;

            setExistingReview(data);
            setReviewSubmitted(true);
            addToast({ type: 'success', title: 'Review Submitted', message: 'Thank you for your feedback!' });
        } catch (err: any) {
            console.error('Review submission error:', err);
            addToast({ type: 'error', title: 'Submission Failed', message: err.message || 'Could not submit review.' });
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const renderReviewContent = () => {
        const isAdmin = ['Super Admin', 'Admin'].includes(profile?.role || '');

        // Loading state for Admin to prevent flicker
        if (isAdmin && isReviewsLoading) {
            return (
                <div className="flex flex-col flex-1 h-full">
                    <div className="w-full flex-1 flex flex-col">
                        <ElevatedMetallicCard
                            title="Loading Reviews..."
                            headerClassName="px-10 py-6"
                            bodyClassName="p-10 flex-1 flex flex-col items-center justify-center"
                            className="flex-1 flex flex-col mb-10"
                        >
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-12 h-12 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">Syncing Feed...</p>
                            </div>
                        </ElevatedMetallicCard>
                    </div>
                </div>
            );
        }

        const targetName = isFreelancer
            ? (project?.primary_manager?.name || 'Project Manager')
            : (project?.assignee || 'Freelancer');

        // Admin View: Show summary of reviews if ANY reviews exist
        if (isAdmin && allReviews.length > 0) {
            return (
                <div className="flex flex-col flex-1 h-full animate-in fade-in zoom-in duration-700">
                    <div className="w-full flex-1 flex flex-col">
                        <ElevatedMetallicCard
                            title="Project Reviews Summary"
                            headerClassName="px-10 py-6"
                            bodyClassName="p-10 flex-1 flex flex-col overflow-y-auto"
                            className="flex-1 flex flex-col mb-10"
                        >
                            <div className="space-y-12">
                                {allReviews.map((rev, idx) => {
                                    const isOwnReview = rev.reviewer_id === profile?.id;
                                    const rating = rev.rating;

                                    // Premium Star Colors
                                    let fromColor = '#22c55e';
                                    let toColor = '#15803d';
                                    let borderColor = '#16a34a';

                                    if (rating > 0 && rating < 3) {
                                        fromColor = '#f87171'; toColor = '#b91c1c'; borderColor = '#dc2626';
                                    } else if (rating > 0 && rating < 4) {
                                        fromColor = '#facc15'; toColor = '#a16207'; borderColor = '#ca8a04';
                                    }

                                    return (
                                        <div key={rev.id || idx} className="space-y-6 animate-in fade-in slide-in-from-top-4" style={{ animationDelay: `${idx * 150}ms` }}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4 text-left">
                                                    <Avatar
                                                        src={rev.avatar_url}
                                                        initials={rev.reviewer_name?.slice(0, 2).toUpperCase()}
                                                        size="lg"
                                                        className={isOwnReview ? 'ring-2 ring-brand-primary/30 ring-offset-2 ring-offset-black' : ''}
                                                    />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-black text-white uppercase tracking-tight">{rev.reviewer_name}</p>
                                                            {isOwnReview && (
                                                                <span className="text-[8px] font-black bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded border border-brand-primary/30 uppercase tracking-[0.1em]">You</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">{rev.reviewer_role}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5">
                                                        {[1, 2, 3, 4, 5].map((s) => {
                                                            const isStarActive = s <= rev.rating;
                                                            return (
                                                                <div key={s} className="relative w-6 h-6 rounded-lg flex items-center justify-center overflow-hidden">
                                                                    {!isStarActive ? (
                                                                        <div className="absolute inset-0 rounded-lg bg-white/[0.02] border border-white/[0.05] shadow-[inset_0_1px_4px_rgba(0,0,0,0.3)] flex items-center justify-center">
                                                                            <IconStar size={10} className="text-white/10" fill="none" />
                                                                        </div>
                                                                    ) : (
                                                                        <div
                                                                            className="absolute inset-0 rounded-lg flex items-center justify-center shadow-lg"
                                                                            style={{
                                                                                background: `linear-gradient(to bottom, ${fromColor}, ${toColor})`,
                                                                                border: `1px solid ${borderColor}`,
                                                                                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 12px -4px ${borderColor}80`,
                                                                            }}
                                                                        >
                                                                            <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] pointer-events-none" />
                                                                            <IconStar size={10} className="relative z-10 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" fill="currentColor" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <span className="text-xs font-black text-white/50 ml-1 tracking-tighter">{rev.rating}.0</span>
                                                </div>
                                            </div>
                                            <div className={`p-6 rounded-3xl border shadow-[inset_0_2px_12px_rgba(0,0,0,0.3)] ${isOwnReview ? 'bg-brand-primary/5 border-brand-primary/10' : 'bg-black/20 border-white/[0.04]'}`}>
                                                <p className="text-sm text-gray-300 leading-relaxed italic">"{rev.review_text}"</p>
                                                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-4 text-right">
                                                    {new Date(rev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}

                                <div className="pt-2 flex justify-center">
                                    <Button
                                        variant="metallic"
                                        className="h-12 px-10 text-[10px] font-black uppercase tracking-[0.2em]"
                                        onClick={() => setViewMode('timeline')}
                                    >
                                        Open Timeline
                                    </Button>
                                </div>
                            </div>
                        </ElevatedMetallicCard>
                    </div>
                </div>
            );
        }

        // Standard User View or Admin with no reviews yet
        return (
            <div className="flex flex-col flex-1 h-full">
                <div className="w-full flex-1 flex flex-col">
                    <ElevatedMetallicCard
                        title={isAdmin ? "Submit Administrative Review" : "Project Review"}
                        headerClassName="px-10 py-6"
                        bodyClassName="p-10 flex-1 flex flex-col"
                        className="flex-1 flex flex-col mb-10"
                    >
                        <div className="flex-1 flex flex-col space-y-10">
                            {/* Target User Info or Post-Submission Message */}
                            <div className="flex flex-col items-center text-center space-y-6">
                                {reviewSubmitted && !isAdmin ? (
                                    <>
                                        <div className="w-20 h-20 rounded-full bg-brand-success/10 border border-brand-success/20 flex items-center justify-center text-brand-success mb-2 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                                            <IconCheckCircle size={40} className="animate-in zoom-in duration-500" />
                                        </div>
                                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Review Successfully Logged</h2>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest max-w-xs leading-relaxed">
                                            Your feedback has been privately stored for Administrative Review.
                                        </p>

                                        {/* Project Overview Card */}
                                        <div className="w-full mt-10 p-8 bg-black/40 rounded-3xl border border-white/5 shadow-[inset_0_4px_24px_rgba(0,0,0,0.5)] flex flex-col gap-6 text-left">
                                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Project ID</span>
                                                <span className="text-sm font-mono text-brand-primary font-bold tracking-wider">{project?.project_id}</span>
                                            </div>
                                            <div className="flex justify-between items-start border-b border-white/5 pb-4">
                                                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest pt-1">Project Title</span>
                                                <span className="text-sm font-bold text-white text-right max-w-[200px] leading-snug">{project?.project_title}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Approval Date</span>
                                                <span className="text-sm font-bold text-gray-300">
                                                    {project?.updated_at ? new Date(project.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Avatar
                                            src={revieweeAvatarUrl || undefined}
                                            initials={formatDisplayName(targetName).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                                            size="xl"
                                        />
                                        <h2 className="text-2xl font-black text-white tracking-tight">{formatDisplayName(targetName)}</h2>
                                    </>
                                )}
                            </div>

                            {/* Conditional Rendering of Submission Form or Details */}
                            {(!reviewSubmitted || isAdmin) && (
                                <>
                                    {/* Star Rating */}
                                    <div className="flex flex-col items-center gap-6">
                                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">
                                            {reviewSubmitted ? 'Your Rating' : 'Rate your experience'}
                                        </p>
                                        <div className="flex items-center gap-3">
                                            {[1, 2, 3, 4, 5].map((star) => {
                                                const isActive = star <= rating;

                                                let fromColor = '#22c55e';
                                                let toColor = '#15803d';
                                                let borderColor = '#16a34a';

                                                if (rating > 0 && rating < 3) {
                                                    fromColor = '#f87171'; toColor = '#b91c1c'; borderColor = '#dc2626';
                                                } else if (rating > 0 && rating < 4) {
                                                    fromColor = '#facc15'; toColor = '#a16207'; borderColor = '#ca8a04';
                                                }

                                                return reviewSubmitted ? (
                                                    // Read-only star
                                                    <div
                                                        key={star}
                                                        className="relative w-12 h-12 rounded-xl flex items-center justify-center"
                                                    >
                                                        {!isActive ? (
                                                            <div className="absolute inset-0 rounded-xl bg-white/[0.02] border border-white/[0.05] shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)] flex items-center justify-center">
                                                                <IconStar size={20} className="text-white/10" fill="none" />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="absolute inset-0 rounded-xl flex items-center justify-center overflow-hidden shadow-lg"
                                                                style={{
                                                                    background: `linear-gradient(to bottom, ${fromColor}, ${toColor})`,
                                                                    border: `1px solid ${borderColor}`,
                                                                    boxShadow: `inset 0 1.5px 0 rgba(255,255,255,0.35), 0 8px 20px -6px ${borderColor}60`,
                                                                }}
                                                            >
                                                                <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.18)_50%,transparent_100%)] pointer-events-none" />
                                                                <IconStar size={20} className="relative z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" fill="currentColor" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    // Interactive star
                                                    <button
                                                        key={star}
                                                        onClick={() => setRating(star)}
                                                        className="relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-90 group/star"
                                                    >
                                                        {!isActive ? (
                                                            <div className="absolute inset-0 rounded-xl bg-white/[0.02] border border-white/[0.05] shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)] flex items-center justify-center group-hover/star:bg-white/[0.05] transition-colors">
                                                                <IconStar size={20} className="text-white/10 group-hover/star:text-white/20" fill="none" />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="absolute inset-0 rounded-xl flex items-center justify-center overflow-hidden shadow-lg"
                                                                style={{
                                                                    background: `linear-gradient(to bottom, ${fromColor}, ${toColor})`,
                                                                    border: `1px solid ${borderColor}`,
                                                                    boxShadow: `inset 0 1.5px 0 rgba(255,255,255,0.35), 0 8px 20px -6px ${borderColor}60`,
                                                                }}
                                                            >
                                                                <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.18)_50%,transparent_100%)] pointer-events-none" />
                                                                <IconStar size={20} className="relative z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" fill="currentColor" />
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Review Text */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] text-center">
                                            {reviewSubmitted ? 'Your Review' : 'Written Review'}
                                        </p>
                                        {reviewSubmitted ? (
                                            // Read-only review text
                                            <div className="relative z-10 min-h-[120px] p-6 bg-black/20 rounded-3xl border border-white/[0.04] shadow-[inset_0_2px_12px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center text-center">
                                                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{reviewText}</p>
                                                {existingReview?.created_at && (
                                                    <p className="text-[10px] text-gray-600 font-black uppercase tracking-wider mt-4">
                                                        Submitted {new Date(existingReview.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            // Editable textarea
                                            <div className="relative z-10 min-h-[160px] p-6 bg-black/40 rounded-3xl border border-white/5 shadow-[inset_0_4px_24px_rgba(0,0,0,0.5)] focus-within:border-brand-primary/30 transition-all duration-500">
                                                <textarea
                                                    className="w-full h-full bg-transparent border-none outline-none text-sm text-white placeholder-gray-700 resize-none leading-relaxed"
                                                    placeholder={`Describe your experience working with ${formatDisplayName(targetName)}...`}
                                                    value={reviewText}
                                                    onChange={(e) => setReviewText(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-4 flex items-center justify-center gap-4">
                                {reviewSubmitted ? (
                                    <Button
                                        variant="metallic"
                                        className="px-12 py-3 rounded-2xl h-14 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-primary/20"
                                        onClick={() => setViewMode('timeline')}
                                    >
                                        Open Thread
                                    </Button>
                                ) : (
                                    <Button
                                        variant="metallic"
                                        className="px-12 py-3 rounded-2xl h-14 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-primary/20"
                                        onClick={handleSubmitReview}
                                        isLoading={isSubmittingReview}
                                        disabled={rating === 0 || !reviewText.trim()}
                                    >
                                        Submit Review
                                    </Button>
                                )}
                            </div>
                        </div>
                    </ElevatedMetallicCard>
                </div>
            </div>
        );
    };

    // Removed global early returns for loading and project-not-found states 
    // to allow the sidebar and header to render immediately.


    return (
        <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden bg-surface-bg animate-project-entry">
            {/* 1. LEFT COLUMN - METADATA SIDEBAR */}
            <aside
                className={`${isSidebarCollapsed ? 'lg:w-[80px]' : 'lg:w-[360px]'} ${mobileView === 'metadata' ? 'flex' : 'hidden lg:flex'} w-full lg:flex flex-col h-full lg:border-r border-surface-border bg-surface-bg shrink-0 transition-all duration-300 ease-in-out relative z-30`}
            >
                {/* Fixed Header */}
                <header className={`h-20 shrink-0 border-b border-surface-border flex items-center ${isSidebarCollapsed ? 'px-0' : 'px-6 lg:px-10'}`}>
                    <div className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                        {!isSidebarCollapsed && (
                            <>
                                <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-all shrink-0">
                                    <IconChevronLeft size={20} />
                                </button>
                                <h3 className="flex-1 text-center text-sm font-bold text-white uppercase tracking-widest whitespace-nowrap px-4">
                                    {isEditing ? 'Editing Details' : 'Project Details'}
                                </h3>
                                <div className="flex items-center gap-1">
                                    {canEdit && (
                                        <button
                                            onClick={isEditing ? handleSaveEdit : startEditing}
                                            disabled={isSaving}
                                            className={`p-2 rounded-xl transition-all shrink-0 ${isEditing ? 'bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                            title={isEditing ? "Save Changes" : "Edit Project"}
                                        >
                                            {isSaving ? <IconRefreshCw size={20} className="animate-spin" /> : isEditing ? <IconSave size={20} /> : <IconEdit size={20} />}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setMobileView('brief')}
                                        className="lg:hidden p-2 text-gray-500 hover:text-white transition-all shrink-0"
                                        title="View Brief"
                                    >
                                        <IconChevronRight size={20} />
                                    </button>
                                </div>
                            </>
                        )}
                        <button
                            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                            className="p-3 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-all shrink-0 hidden lg:flex items-center justify-center"
                            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                        >
                            <IconLayoutSidebar size={24} />
                        </button>
                    </div>
                </header>

                {/* Scrollable Content Container */}
                <div
                    className={`flex-1 space-y-8 overflow-y-auto transition-all duration-300 ${isSidebarCollapsed ? 'lg:px-0 py-10 no-scrollbar' : 'p-6 lg:p-10 scrollbar-thin scrollbar-thumb-surface-border scrollbar-track-transparent'}`}
                >
                    <MetadataSection
                        title="Details"
                        isCollapsed={isSidebarCollapsed}
                        collapsedHeight="lg:h-72"
                    >
                        <MetadataItem
                            label="Project ID"
                            value={isProjectLoading ? <Skeleton className="h-4 w-32" /> : (
                                isEditing ? (
                                    <div className="flex items-center gap-2 w-full group/id-field">
                                        <Input
                                            variant="flat"
                                            size="none"
                                            className="w-full opacity-60 cursor-not-allowed"
                                            inputClassName="font-mono !p-0 !h-auto !bg-transparent"
                                            value={editState.project_id}
                                            readOnly
                                        />
                                        <IconLock size={12} className="text-gray-600 group-hover/id-field:text-brand-warning transition-colors" />
                                    </div>
                                ) : (project?.project_id || '')
                            )}
                            isRecessed={isEditing}
                        />
                        <MetadataItem
                            label="Project Title"
                            value={isProjectLoading ? <Skeleton className="h-4 w-48" /> : (
                                isEditing ? (
                                    <Input
                                        variant="flat"
                                        size="none"
                                        className="w-full"
                                        inputClassName="!p-0 !h-auto !bg-transparent"
                                        value={editState.project_title}
                                        onChange={(e) => setEditState({ ...editState, project_title: e.target.value })}
                                    />
                                ) : (project?.project_title || 'Untitled')
                            )}
                            isRecessed={isEditing}
                        />
                        <MetadataItem
                            label="Options Required"
                            value={isProjectLoading ? <Skeleton className="h-4 w-12" /> : (
                                isEditing ? (
                                    <Input
                                        type="number"
                                        variant="flat"
                                        size="none"
                                        className="w-full"
                                        inputClassName="!p-0 !h-auto !bg-transparent"
                                        value={editState.options_required}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                setEditState({ ...editState, options_required: '' as any });
                                                return;
                                            }
                                            setEditState({ ...editState, options_required: parseInt(val) || 0 });
                                        }}
                                        min={1}
                                        max={20}
                                    />
                                ) : (project?.options_required !== undefined && project?.options_required !== null ? String(project.options_required) : 'N/A')
                            )}
                            isRecessed={isEditing}
                        />
                        <MetadataItem
                            label="Client"
                            value={isProjectLoading ? <Skeleton className="h-4 w-32" /> : (
                                isEditing ? (
                                    <Input
                                        variant="flat"
                                        size="none"
                                        className="w-full"
                                        inputClassName="!p-0 !h-auto !bg-transparent"
                                        value={editState.client_name}
                                        onChange={(e) => setEditState({ ...editState, client_name: e.target.value })}
                                    />
                                ) : (formatDisplayName(project?.client_name || project?.client_type) || 'Unknown')
                            )}
                            isRecessed={isEditing}
                        />
                        {isProjectLoading ? (
                            <MetadataItem label="Assignee" value={<Skeleton className="h-4 w-40" />} />
                        ) : isEditing ? (
                            <Dropdown
                                options={[
                                    { label: 'Unassigned', value: '' },
                                    ...freelancers.map(f => ({ label: f.name, value: f.name }))
                                ]}
                                value={editState.assignee}
                                onChange={(val) => setEditState({ ...editState, assignee: val })}
                                showSearch
                                className="w-full"
                            >
                                <MetadataItem
                                    label="Assignee"
                                    value={formatDisplayName(editState.assignee) || 'Unassigned'}
                                    isRecessed
                                    isSelect
                                />
                            </Dropdown>
                        ) : (
                            <MetadataItem
                                label="Assignee"
                                value={formatDisplayName(project?.assignee) || 'Unassigned'}
                            />
                        )}
                        {canEdit && (
                            <>
                                {isProjectLoading ? (
                                    <MetadataItem label="Order Type" value={<Skeleton className="h-4 w-32" />} />
                                ) : isEditing ? (
                                    <Dropdown
                                        options={[
                                            { label: 'Direct', value: 'Direct' },
                                            { label: 'Converted', value: 'Converted' }
                                        ]}
                                        value={editState.order_type}
                                        onChange={(val) => setEditState({ ...editState, order_type: val })}
                                        className="w-full"
                                    >
                                        <MetadataItem
                                            label="Order Type"
                                            value={editState.order_type}
                                            isRecessed
                                            isSelect
                                        />
                                    </Dropdown>
                                ) : (
                                    <MetadataItem
                                        label="Order Type"
                                        value={project?.order_type || 'Direct'}
                                    />
                                )}
                                {isProjectLoading ? (
                                    <MetadataItem label="Client Type" value={<Skeleton className="h-4 w-32" />} />
                                ) : isEditing ? (
                                    <Dropdown
                                        options={[
                                            { label: 'New Client', value: 'new' },
                                            { label: 'Repeat Client', value: 'repeat' }
                                        ]}
                                        value={editState.client_type}
                                        onChange={(val) => setEditState({ ...editState, client_type: val })}
                                        className="w-full"
                                    >
                                        <MetadataItem
                                            label="Client Type"
                                            value={editState.client_type === 'new' ? 'New Client' : 'Repeat Client'}
                                            isRecessed
                                            isSelect
                                        />
                                    </Dropdown>
                                ) : (
                                    <MetadataItem
                                        label="Client Type"
                                        value={project?.client_type === 'new' ? 'New Client' : 'Repeat Client'}
                                    />
                                )}
                                {(isEditing ? editState.order_type === 'Converted' : project?.order_type === 'Converted') && (
                                    isProjectLoading ? (
                                        <MetadataItem label="Converted By" value={<Skeleton className="h-4 w-32" />} />
                                    ) : isEditing ? (
                                        <Dropdown
                                            options={[
                                                { label: 'Select PM', value: '' },
                                                ...managers.map(m => ({ label: m.name, value: m.name }))
                                            ]}
                                            value={editState.converted_by || ''}
                                            onChange={(val) => setEditState({ ...editState, converted_by: val })}
                                            showSearch
                                            className="w-full"
                                        >
                                            <MetadataItem
                                                label="Converted By"
                                                value={editState.converted_by || 'Select PM'}
                                                isRecessed
                                                isSelect
                                            />
                                        </Dropdown>
                                    ) : (
                                        <MetadataItem
                                            label="Converted By"
                                            value={project?.converted_by || 'None'}
                                        />
                                    )
                                )}
                            </>
                        )}
                    </MetadataSection>

                    <MetadataSection
                        title="Team"
                        isCollapsed={isSidebarCollapsed}
                        collapsedHeight="lg:h-72"
                    >
                        {isProjectLoading ? (
                            <Skeleton className="h-10 w-full" />
                        ) : isEditing ? (
                            <Dropdown
                                options={managers.map(m => ({ label: m.name, value: m.id }))}
                                value={editState.primary_manager_id || ''}
                                onChange={(val) => setEditState({ ...editState, primary_manager_id: val })}
                                showSearch
                                className="w-full"
                            >
                                <MetadataItem
                                    label="Project Manager"
                                    value={managers.find(m => m.id === editState.primary_manager_id)?.name || 'Support'}
                                    isRecessed
                                    isSelect
                                />
                            </Dropdown>
                        ) : (
                            <MetadataItem
                                label="Project Manager"
                                value={
                                    project?.primary_manager ? (
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-bold text-white">{formatDisplayName(project.primary_manager.name) || 'Support'}</span>
                                            {project.primary_manager.phone && (
                                                <div className="flex items-center gap-2 group/phone cursor-pointer">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover/phone:text-brand-primary transition-colors">Phone</span>
                                                    <span className="text-xs font-mono text-gray-300 group-hover/phone:text-white transition-colors tracking-wide">{project.primary_manager.phone}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : 'Support'
                                }
                            />
                        )}
                        {allCollaborators.length > 0 && (
                            <div className="pt-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">Collaborators</p>
                                <div className="space-y-5 pt-3">
                                    {allCollaborators.map((c: any, idx: number) => (
                                        <CollaboratorItem
                                            key={idx}
                                            name={c.name}
                                            role={c.role || 'Member'}
                                            phone={c.phone || teamProfileData[c.name]?.phone}
                                            avatarUrl={teamProfileData[c.name]?.avatar_url}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </MetadataSection>

                    {/* Status Section */}
                    <MetadataSection
                        title="Status & Timeline"
                        isCollapsed={isSidebarCollapsed}
                        collapsedHeight="lg:h-[480px]"
                    >
                        <div className="space-y-5">

                            {/* Read-Only Deadline Date */}
                            <MetadataItem
                                label="Deadline Date"
                                value={project?.due_date ? formatDeadlineDate(project.due_date) : 'Not Set'}
                                isDate
                                isRecessed
                            />

                            {/* Read-Only Deadline Time */}
                            <MetadataItem
                                label="Deadline Time"
                                value={project?.due_time ? formatTime(project.due_time) : 'Not Set'}
                                isTime
                                isRecessed
                            />

                            {!isFreelancer && (
                                <div className="pt-2">
                                    <Button
                                        variant="metallic"
                                        onClick={() => {
                                            setModalDate(project?.due_date ? new Date(project.due_date) : new Date());
                                            setModalTime(project?.due_time || '17:00');
                                            setIsDeadlineModalOpen(true);
                                        }}
                                        className="w-full justify-center h-10 text-[10px] font-black uppercase tracking-[0.2em]"
                                    >
                                        Update Deadline
                                    </Button>
                                </div>
                            )}

                            <MetadataItem
                                label="Time Left"
                                value={(() => {
                                    // Construct precise timestamp from visible inputs to ensure sync
                                    let targetDate = null;
                                    if (project?.due_date) {
                                        const time = project?.due_time || '00:00';
                                        targetDate = `${project?.due_date}T${time.length === 5 ? time + ':00' : time}`;
                                    }

                                    const { label, color } = getTimeLeft(targetDate, project?.status);
                                    return label;
                                })()}
                                valueClassName={(() => {
                                    let targetDate = null;
                                    if (project?.due_date) {
                                        const time = project?.due_time || '00:00';
                                        targetDate = `${project?.due_date}T${time.length === 5 ? time + ':00' : time}`;
                                    }
                                    const { color } = getTimeLeft(targetDate, project?.status);
                                    return color;
                                })()}
                            />

                            {(profile?.role === 'Freelancer' && project?.status?.trim().toLowerCase() === 'approved') ? (
                                <MetadataItem
                                    label="Current Status"
                                    value="Approved"
                                    valueClassName="text-brand-success font-bold"
                                />
                            ) : (
                                <Dropdown
                                    value={project?.status || 'In Progress'}
                                    onChange={handleStatusChange}
                                    options={useMemo(() => {
                                        const base = [
                                            { label: 'In Progress', value: 'In Progress' },
                                            { label: 'Done', value: 'Done' },
                                            { label: 'Urgent', value: 'Urgent' },
                                            { label: 'Urgent Done', value: 'Urgent Done' },
                                            { label: 'Revision', value: 'Revision' },
                                            { label: 'Revision Done', value: 'Revision Done' },
                                            { label: 'Revision Urgent', value: 'Revision Urgent' },
                                            { label: 'Revision Urgent Done', value: 'Revision Urgent Done' }
                                        ];
                                        if (isProjectManager) {
                                            base.push({ label: 'Sent For Approval', value: 'Sent For Approval' });
                                        }
                                        return base;
                                    }, [isProjectManager])}
                                    size="md"
                                >
                                    <MetadataItem
                                        label="Current Status"
                                        value={project?.status || 'In Progress'}
                                        isSelect
                                    />
                                </Dropdown>
                            )}
                        </div>
                    </MetadataSection>

                    {/* Financials */}
                    <MetadataSection
                        title="Financials"
                        isCollapsed={isSidebarCollapsed}
                        collapsedHeight="lg:h-40"
                    >
                        {profile?.role !== 'Freelancer' && (
                            <MetadataItem
                                label="Budget"
                                value={isEditing ? (
                                    <Input
                                        type="number"
                                        variant="flat"
                                        size="none"
                                        className="w-full"
                                        inputClassName="!p-0 !h-auto font-bold !text-brand-primary !bg-transparent"
                                        value={editState.price}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                setEditState({ ...editState, price: '' as any });
                                                return;
                                            }
                                            setEditState({ ...editState, price: parseFloat(val) || 0 });
                                        }}
                                    />
                                ) : `$${project?.price || '0'}`}
                                leftIcon={isEditing && <span className="text-gray-500">$</span>}
                                isAccent
                                isRecessed={isEditing}
                            />
                        )}
                        <MetadataItem
                            label={profile?.role === 'Freelancer' ? "Payout" : "Designer Fee"}
                            value={`$${project?.designer_fee || '0'}`}
                            isAccent={profile?.role === 'Freelancer'}
                        />


                    </MetadataSection>

                    {/* Configuration */}
                    <MetadataSection
                        title="Configuration"
                        isCollapsed={isSidebarCollapsed}
                        collapsedHeight="lg:h-52"
                    >
                        <div className="space-y-5">
                            <MetadataItem
                                label="Add-ons"
                                value={isEditing ? (
                                    <div className="space-y-4 pt-2">
                                        {['Social Media Kit', 'Stationery Designs', 'Logo', 'None', 'Other'].map((item) => {
                                            const addonsData = editState.addons;
                                            let isSelected = false;
                                            let currentOther = '';

                                            if (Array.isArray(addonsData)) {
                                                isSelected = addonsData.includes(item);
                                            } else if (addonsData && typeof addonsData === 'object') {
                                                isSelected = (addonsData.items || []).includes(item);
                                                currentOther = addonsData.other || '';
                                            }

                                            return (
                                                <div key={item} className="space-y-2">
                                                    <Checkbox
                                                        label={item}
                                                        variant="primary"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            let newItems = [];
                                                            let otherText = currentOther;

                                                            if (Array.isArray(addonsData)) {
                                                                newItems = [...addonsData];
                                                            } else if (addonsData && typeof addonsData === 'object') {
                                                                newItems = [...(addonsData.items || [])];
                                                                otherText = addonsData.other || '';
                                                            }

                                                            if (item === 'None') {
                                                                newItems = ['None'];
                                                                otherText = '';
                                                            } else {
                                                                newItems = newItems.filter(i => i !== 'None');
                                                                if (newItems.includes(item)) {
                                                                    newItems = newItems.filter(i => i !== item);
                                                                } else {
                                                                    newItems.push(item);
                                                                }
                                                            }

                                                            setEditState({
                                                                ...editState,
                                                                addons: { items: newItems, other: otherText }
                                                            });
                                                        }}
                                                    />
                                                    {item === 'Other' && isSelected && (
                                                        <div className="pl-9 animate-in fade-in slide-in-from-top-2 duration-200">
                                                            <Input
                                                                variant="recessed"
                                                                size="sm"
                                                                className="w-full mt-1"
                                                                inputClassName="text-[12px] text-brand-primary font-bold placeholder:text-gray-600"
                                                                placeholder="Type other addon..."
                                                                value={currentOther}
                                                                onChange={(e) => {
                                                                    let items = [];
                                                                    if (Array.isArray(addonsData)) {
                                                                        items = [...addonsData];
                                                                    } else if (addonsData && typeof addonsData === 'object') {
                                                                        items = [...(addonsData.items || [])];
                                                                    }
                                                                    setEditState({
                                                                        ...editState,
                                                                        addons: { items, other: e.target.value }
                                                                    });
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    (() => {
                                        const addonsData = project?.addons;
                                        let addonsArray: string[] = [];

                                        // Normalize addons data
                                        if (Array.isArray(addonsData)) {
                                            addonsArray = addonsData.filter(item => item && typeof item === 'string' && item.trim() !== '' && item.toLowerCase() !== 'none');
                                        } else if (addonsData && typeof addonsData === 'object') {
                                            const items = (addonsData as any).items;
                                            const other = (addonsData as any).other;
                                            if (Array.isArray(items)) {
                                                addonsArray = items.map((item: string) =>
                                                    (item === 'Other' && other) ? other : item
                                                ).filter((item: string) => item && typeof item === 'string' && item.trim() !== '' && item.toLowerCase() !== 'none' && item !== 'Other');
                                            }
                                        }

                                        if (addonsArray.length === 0) return 'None';

                                        return (
                                            <div className="flex flex-col gap-2 pt-1">
                                                {addonsArray.map((addon, i) => (
                                                    <span
                                                        key={i}
                                                        className="inline-flex items-center justify-center self-start px-3 py-1 bg-brand-primary/10 rounded-md text-[10px] font-black text-brand-primary uppercase tracking-wider shadow-sm leading-none h-[22px]"
                                                    >
                                                        {addon}
                                                    </span>
                                                ))}
                                            </div>
                                        );
                                    })()
                                )}
                            />

                            {profile?.role !== 'Freelancer' && (
                                <Dropdown
                                    value={project?.has_art_help ? 'Art Help' : project?.has_dispute ? 'Dispute' : 'None'}
                                    onChange={handleTriggerAlert}
                                    options={[
                                        { label: 'None', value: 'None', icon: <div className="w-4 h-4 rounded-full border border-gray-600" /> },
                                        { label: 'Art Help', value: 'Art Help', icon: <IconAlertTriangle size={16} className="text-brand-info" /> },
                                        { label: 'Dispute', value: 'Dispute', icon: <IconAlertTriangle size={16} className="text-brand-error" /> }
                                    ]}
                                    size="md"
                                >
                                    <MetadataItem
                                        label="Trigger Alert"
                                        value={project?.has_art_help ? 'Art Help' : project?.has_dispute ? 'Dispute' : 'None'}
                                        isSelect
                                    />
                                </Dropdown>
                            )}

                            {/* Reopen Project: Only visible on the Review screen for Approved projects (Not for Freelancers) */}
                            {project?.status?.toLowerCase().includes('approved') && viewMode === 'review' && profile?.role !== 'Freelancer' && (
                                <Button
                                    variant="metallic"
                                    className="w-full h-11 text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-primary/10"
                                    leftIcon={<IconRefreshCw size={14} />}
                                    onClick={handleReopenProject}
                                >
                                    Reopen Project
                                </Button>
                            )}

                            {/* Back to Review: Visible on Timeline if project is approved or review is submitted (Not for Freelancers) */}
                            {(project?.status?.toLowerCase().includes('approved') || project?.payout_completed || reviewSubmitted) && viewMode === 'timeline' && profile?.role !== 'Freelancer' && (
                                <Button
                                    variant="metallic"
                                    className="w-full h-11 text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-primary/10"
                                    leftIcon={<IconStar size={14} />}
                                    onClick={() => setViewMode('review')}
                                >
                                    Back to Review
                                </Button>
                            )}
                        </div>
                    </MetadataSection>
                </div>
            </aside>

            {/* 2. RIGHT COLUMN - MAIN CONTENT AREA */}
            <div className={`flex-1 ${mobileView === 'brief' ? 'flex' : 'hidden lg:flex'} flex-col h-full min-w-0 bg-transparent`}>
                {/* Synchronized Content Header */}
                <header className="h-20 shrink-0 border-b border-surface-border flex items-center bg-surface-bg/40 backdrop-blur-xl z-20">
                    <div className="w-full px-6 lg:px-10 flex items-center justify-between">
                        {/* Left Aligned Project Title */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setMobileView('metadata')}
                                className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-white transition-all shrink-0"
                            >
                                <IconChevronLeft size={20} />
                            </button>
                            {isProjectLoading ? (
                                <Skeleton className="h-7 w-64" />
                            ) : (
                                <div className="flex items-center gap-3">
                                    <h1 className="text-lg lg:text-xl font-bold text-white tracking-tight">
                                        <span className="lg:hidden">Project Brief</span>
                                        <span className="hidden lg:inline">{project?.project_title || 'Untitled Project'}</span>
                                    </h1>
                                    {project?.has_dispute && (
                                        <span className="inline-flex items-center px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-brand-error/10 text-brand-error border border-brand-error/20">
                                            Dispute
                                        </span>
                                    )}
                                    {project?.has_art_help && (
                                        <span className="inline-flex items-center px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-brand-info/10 text-brand-info border border-brand-info/20">
                                            Art Help
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right Aligned Status */}
                        <div className="flex items-center gap-2">
                            {isProjectLoading ? (
                                <Skeleton className="h-7 w-24" />
                            ) : (
                                <>
                                    {(() => {
                                        /* RULE: Restricted Visibility. Render ONLY if 1+ add-ons exist. Zero-noise policy. */
                                        const addonsData = project?.addons;
                                        let addonsArray: string[] = [];

                                        // Normalize addons data (handles array or object with items/other)
                                        if (Array.isArray(addonsData)) {
                                            addonsArray = addonsData.filter(item => item && item.trim() !== '' && item.toLowerCase() !== 'none');
                                        } else if (addonsData && typeof addonsData === 'object') {
                                            const items = (addonsData as any).items;
                                            const other = (addonsData as any).other;
                                            if (Array.isArray(items)) {
                                                addonsArray = items.map((item: string) =>
                                                    (item === 'Other' && other) ? other : item
                                                ).filter((item: string) => item && item.trim() !== '' && item.toLowerCase() !== 'none' && item !== 'Other');
                                            }
                                        }

                                        const addonsCount = addonsArray.length;
                                        if (addonsCount === 0) return null;

                                        const label = addonsCount === 1
                                            ? `${addonsArray[0]} Included`
                                            : 'Multiple Add-ons Included';

                                        return (
                                            /* RULE: Add-ons capsule color is LOCKED to brand-addon-indicator. Do not change. */
                                            <span className="px-3 py-1 bg-brand-addon-indicator/10 rounded-md text-[10px] font-black text-brand-addon-indicator uppercase tracking-wider">
                                                {label}
                                            </span>
                                        );
                                    })()}

                                    <span className={getStatusCapsuleClasses(project?.status || 'In Progress')}>
                                        {project?.status || 'In Progress'}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </header >

                {/* Top Section - Project content (scrollable) */}
                <main className="flex-1 overflow-y-auto nova-canvas scrollbar-thin scrollbar-thumb-surface-border scrollbar-track-transparent">
                    <div className={`w-full p-6 lg:p-10 flex flex-col relative z-10 bg-transparent ${viewMode === 'review' ? 'h-full' : 'min-h-full'}`}>
                        {!project && !isProjectLoading ? (
                            <div className="flex flex-col items-center justify-center py-24 space-y-6">
                                <div className="w-16 h-16 rounded-full bg-brand-error/10 flex items-center justify-center text-brand-error">
                                    <IconAlertTriangle size={32} />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-white mb-2">Project Not Found</h3>
                                    <Button onClick={onBack} variant="secondary">Go Back</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col">
                                {viewMode === 'review' ? (
                                    renderReviewContent()
                                ) : (
                                    <>
                                        {/* 1. Project Brief Section (Always visible if project exists/is loading) */}
                                        <section className="shrink-0">
                                            <ElevatedMetallicCard title="Project Brief">
                                                <div className="space-y-10">
                                                    {/* 1. Brief Text */}
                                                    <div className="space-y-6 text-gray-300 text-sm">
                                                        {isProjectLoading ? (
                                                            <div className="space-y-3">
                                                                <Skeleton className="h-4 w-3/4" />
                                                                <Skeleton className="h-4 w-full" />
                                                                <Skeleton className="h-4 w-5/6" />
                                                            </div>
                                                        ) : (isEditing && editState) ? (
                                                            <TextArea
                                                                variant="recessed"
                                                                className="w-full"
                                                                inputClassName="min-h-[400px]"
                                                                value={editState.brief}
                                                                onChange={(e) => setEditState({ ...editState, brief: e.target.value })}
                                                                placeholder="Project Brief..."
                                                            />
                                                        ) : project?.brief ? (
                                                            <ReactMarkdown components={markdownComponents} remarkPlugins={markdownPlugins}>
                                                                {parseCodesLogicMarkdown(project.brief)}
                                                            </ReactMarkdown>
                                                        ) : (
                                                            <p className="text-gray-500 italic">No brief provided.</p>
                                                        )}
                                                    </div>

                                                    {/* 2. Attachments Section */}
                                                    {((isEditing && editState) ? (editState.attachments?.length > 0 || true) : (project?.attachments && Array.isArray(project.attachments) && project.attachments.length > 0)) && (
                                                        <div className="pt-8 border-t border-white/5">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Attachments</h4>
                                                                {isEditing && (
                                                                    <>
                                                                        <input
                                                                            type="file"
                                                                            ref={briefFileInputRef}
                                                                            onChange={handleBriefFileSelect}
                                                                            multiple
                                                                            className="hidden"
                                                                        />
                                                                        <button
                                                                            onClick={() => briefFileInputRef.current?.click()}
                                                                            disabled={isBriefUploading}
                                                                            className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all duration-300 disabled:opacity-50"
                                                                        >
                                                                            {isBriefUploading ? (
                                                                                <IconRefreshCw size={12} className="animate-spin text-brand-primary" />
                                                                            ) : (
                                                                                <IconPlus size={12} className="text-brand-primary group-hover:scale-110 transition-transform" />
                                                                            )}
                                                                            <span className="text-[10px] font-black text-gray-400 group-hover:text-white uppercase tracking-widest transition-colors">
                                                                                {isBriefUploading ? 'Processing...' : 'Add Files'}
                                                                            </span>
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-wrap gap-4">
                                                                {((isEditing && editState) ? (editState.attachments || []) : (project?.attachments || [])).map((file: any, i: number) => (
                                                                    <div key={i} className="group/posted-file relative cursor-pointer hover:scale-[1.02] transition-transform">
                                                                        <div className="w-20 h-20 rounded-xl border border-surface-border bg-surface-overlay flex flex-col items-center justify-center relative overflow-hidden">
                                                                            <FileIcon name={file.name} type={file.type} url={file.url} />
                                                                        </div>

                                                                        {/* OVERLAY for Download/Copy or Delete if Editing */}
                                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/posted-file:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 z-20 backdrop-blur-[1px]">
                                                                            {isEditing ? (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        removeBriefFile(i);
                                                                                    }}
                                                                                    className="p-1.5 rounded-full bg-brand-error/20 hover:bg-brand-error text-brand-error hover:text-white transition-colors border border-brand-error/30"
                                                                                    title="Delete"
                                                                                >
                                                                                    <IconTrash size={14} />
                                                                                </button>
                                                                            ) : (
                                                                                <>
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            forceDownload(file.url, file.name || 'download');
                                                                                        }}
                                                                                        className="p-1.5 rounded-full bg-white/10 hover:bg-brand-primary text-white transition-colors border border-white/10 hover:border-brand-primary"
                                                                                        title="Download"
                                                                                    >
                                                                                        <IconDownload size={14} />
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </ElevatedMetallicCard>
                                        </section>

                                        {/* 2. Top Separator */}
                                        <div className="border-t border-surface-border w-full my-10" />

                                        {/* 3. Activity Timeline Section */}
                                        <section className="flex-1 flex flex-col mb-10 min-h-[400px]">
                                            {(isCommentsLoading && comments.length === 0) ? (
                                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                                    <div className="w-10 h-10 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
                                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.3em] ml-1">Loading history</p>
                                                </div>
                                            ) : comments.length > 0 ? (
                                                <div className="space-y-8">
                                                    {/* System Logs Expandable Card */}
                                                    {(() => {
                                                        const systemLogs = comments.filter(c => c.author_role === 'system_log');
                                                        if (systemLogs.length === 0) return null;
                                                        return (
                                                            <div className="bg-surface-card border border-surface-border rounded-3xl overflow-hidden group shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] transition-all duration-300 mb-8">
                                                                {/* Header - Always Visible */}
                                                                <div
                                                                    onClick={() => setIsLogsExpanded(!isLogsExpanded)}
                                                                    className="px-6 py-4 border-b border-surface-border bg-white/[0.03] relative z-20 overflow-hidden cursor-pointer flex items-center justify-between group/header"
                                                                >
                                                                    <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)] pointer-events-none" />
                                                                    <div className="flex items-center gap-3 relative z-10">
                                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary leading-none">SYSTEM ACTIVITY LOGS</span>
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                                                                            {systemLogs.length}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 relative z-10">
                                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover/header:text-gray-400 transition-colors">
                                                                            {isLogsExpanded ? 'Hide Details' : 'View Details'}
                                                                        </span>
                                                                        <IconChevronRight
                                                                            size={14}
                                                                            className={`text-gray-600 group-hover/header:text-brand-primary transition-transform duration-500 ${isLogsExpanded ? 'rotate-90' : ''}`}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Body - Toggleable */}
                                                                {isLogsExpanded && (
                                                                    <div className="p-6 bg-white/[0.01] space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
                                                                        {systemLogs.map((log, lIdx) => {
                                                                            const updatedMatch = log.content?.match(/^\[(.*?)\] updated: (.*)$/);

                                                                            return (
                                                                                <div
                                                                                    key={log.id || lIdx}
                                                                                    className="relative bg-white/[0.03] border border-white/[0.08] rounded-xl py-3 px-6 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.05)] group/log-card overflow-hidden transition-all duration-300 hover:border-white/20 hover:bg-white/[0.05]"
                                                                                >
                                                                                    {/* Diagonal Metallic Shine Effect */}
                                                                                    <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.03)_50%,transparent_100%)] pointer-events-none" />
                                                                                    {/* Single Line Flow */}
                                                                                    <div className="relative z-10 flex items-center justify-between gap-6 w-full group/log-row">
                                                                                        {/* Left: Identity */}
                                                                                        <div className="flex items-center gap-4 flex-shrink-0">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                                                                                                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest leading-none">
                                                                                                    {new Date(log.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()}
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="w-px h-3 bg-white/10" />
                                                                                            <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.1em] leading-none">
                                                                                                {updatedMatch ? updatedMatch[1] : 'SYSTEM'}
                                                                                            </span>
                                                                                        </div>

                                                                                        {/* Right: Activity Details */}
                                                                                        <div className="flex-grow flex justify-end items-center gap-4">
                                                                                            {updatedMatch ? (
                                                                                                <div className="flex items-center gap-8">
                                                                                                    {updatedMatch[2].split(' | ').map((change: string, cIdx: number) => {
                                                                                                        const [field, values] = change.split(': ');
                                                                                                        const [oldVal, newVal] = (values || '').split(/ [-→] /);
                                                                                                        return (
                                                                                                            <div key={cIdx} className="flex items-center gap-4 text-[12px]">
                                                                                                                <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">{field}</span>
                                                                                                                <div className="flex items-center gap-2">
                                                                                                                    <span className="text-gray-500 font-medium text-[11px]">{oldVal || 'None'}</span>
                                                                                                                    <span className="text-brand-primary/30 text-[10px]">→</span>
                                                                                                                    <span className="text-white font-bold text-[12px]">{newVal || values}</span>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        );
                                                                                                    })}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <p className="text-[11px] text-gray-300 leading-none font-medium text-right">
                                                                                                    {log.content?.replace(/^🚀 /, '')}
                                                                                                </p>
                                                                                            )}

                                                                                            {/* Delete Button for Super Admin - Only visible in Edit mode */}
                                                                                            {isEditing && (hasPermission('delete_timeline_items') || canEdit) && (
                                                                                                <button
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        handleDeleteComment(log.id);
                                                                                                    }}
                                                                                                    className="p-1 rounded bg-brand-error/10 text-brand-error border border-brand-error/20 opacity-0 group-hover/log-row:opacity-100 transition-all hover:bg-brand-error hover:text-white relative z-50"
                                                                                                    title="Delete Log Entry"
                                                                                                >
                                                                                                    <IconTrash size={12} />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Pagination: Show Older Activities Button */}
                                                    {hasMore && (
                                                        <div className="flex justify-center pb-4">
                                                            <button
                                                                onClick={fetchOlderComments}
                                                                disabled={isLoadingOlder}
                                                                className="group flex flex-col items-center gap-2 px-6 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300 disabled:opacity-50"
                                                            >
                                                                {isLoadingOlder ? (
                                                                    <div className="w-4 h-4 border-2 border-brand-primary/20 border-t-transparent rounded-full animate-spin" />
                                                                ) : (
                                                                    <div className="flex items-center gap-2">
                                                                        <IconRefreshCw size={12} className="text-brand-primary group-hover:rotate-180 transition-transform duration-700" />
                                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] group-hover:text-white transition-colors">Show Older Activities</span>
                                                                    </div>
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {comments
                                                        .filter(c => c.author_role !== 'system_log')
                                                        .map((comment, index) => (
                                                            <div
                                                                key={comment.id || index}
                                                                className="animate-in fade-in slide-in-from-left-4"
                                                                style={{ animationDelay: `${Math.min(index, 10) * 100}ms` }}
                                                            >
                                                                {(() => {
                                                                    // 1. Status Change Event
                                                                    const isStatusChange = comment.content?.startsWith('STATUS_CHANGED:');
                                                                    if (isStatusChange) {
                                                                        const parts = comment.content.split(':');
                                                                        const oldStatus = parts[1];
                                                                        const newStatus = parts[2];
                                                                        return (
                                                                            <div className="space-y-8 mb-8">
                                                                                <div className="bg-surface-card border border-surface-border rounded-3xl overflow-hidden group shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] transition-all duration-300">
                                                                                    <div className="px-6 py-4 border-b border-surface-border bg-white/[0.03] relative z-20 overflow-hidden">
                                                                                        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)] pointer-events-none" />
                                                                                        <div className="flex justify-between items-center relative z-10 w-full">
                                                                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${getStatusCapsuleClasses(newStatus).split(' ').find(c => c.includes('text-')) || 'text-brand-primary'}`}>
                                                                                                STATUS CHANGED
                                                                                            </span>
                                                                                            {isEditing && (hasPermission('delete_timeline_items') || canEdit) && (
                                                                                                <button
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        handleDeleteComment(comment.id);
                                                                                                    }}
                                                                                                    className="p-1 rounded bg-brand-error/10 text-brand-error border border-brand-error/20 hover:bg-brand-error hover:text-white transition-all scale-75 relative z-50"
                                                                                                    title="Delete Status Change"
                                                                                                >
                                                                                                    <IconTrash size={14} />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-4/5 h-12 [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)] pointer-events-none -z-10">
                                                                                            <div className="w-full h-full shadow-[0_12px_32px_-8px_rgba(0,0,0,0.9)] opacity-80" />
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Changed By</span>
                                                                                        <span className="text-[11px] font-bold text-white uppercase tracking-widest">{comment.author_name || 'User'}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Date</span>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="text-[11px] font-bold text-white uppercase tracking-widest">
                                                                                                {new Date(comment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                                                            </span>
                                                                                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                                                                                {new Date(comment.created_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Previous Status</span>
                                                                                        <span className={`${getStatusCapsuleClasses(oldStatus)} opacity-50`}>
                                                                                            {oldStatus}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Current Status</span>
                                                                                        <span className={getStatusCapsuleClasses(newStatus)}>
                                                                                            {newStatus}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                                {newStatus.toLowerCase().includes('approved') && (
                                                                                    <div className="w-full animate-in fade-in slide-in-from-top-2 duration-700">
                                                                                        <div className="w-full bg-brand-warning/10 border border-brand-warning/30 rounded-2xl p-5 flex items-start gap-4 shadow-[0_8px_32px_-8px_rgba(245,158,11,0.15)] overflow-hidden relative group/alert">
                                                                                            <div className="absolute inset-0 bg-gradient-to-r from-brand-warning/5 via-transparent to-transparent pointer-events-none" />
                                                                                            <div className="p-2.5 rounded-xl bg-brand-warning/15 border border-brand-warning/30 text-brand-warning shrink-0 shadow-lg group-hover/alert:scale-110 transition-transform duration-500">
                                                                                                <IconAlertTriangle size={20} />
                                                                                            </div>
                                                                                            <div className="space-y-1 py-1">
                                                                                                <p className="text-sm font-black text-white uppercase tracking-wider mb-1">Project Approved</p>
                                                                                                <p className="text-[12px] font-bold text-brand-warning/90 leading-relaxed uppercase tracking-widest">
                                                                                                    This Project Is Approved, But It can reopen IF The Client Asks For Any Revisions.
                                                                                                </p>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // 2. Deadline Update Event
                                                                    const isDeadlineUpdate = comment.content?.startsWith('DEADLINE_UPDATED|') || comment.content?.startsWith('DEADLINE_UPDATED:');
                                                                    if (isDeadlineUpdate) {
                                                                        const isPipe = comment.content?.includes('|');
                                                                        const parts = comment.content?.split(isPipe ? '|' : ':');
                                                                        let oldDate, newDate, oldTime, newTime;
                                                                        if (isPipe) {
                                                                            oldDate = parts[1]; newDate = parts[2]; oldTime = parts[3]; newTime = parts[4];
                                                                        } else {
                                                                            oldDate = parts[1]; newDate = parts[2];
                                                                            oldTime = (parts[3] === 'Not Set') ? 'Not Set' : `${parts[3]}:${parts[4]}`;
                                                                            newTime = (parts.length > 6) ? `${parts[5]}:${parts[6]}` : (parts.length > 5 && parts[3] === 'Not Set' ? `${parts[4]}:${parts[5]}` : parts[4]);
                                                                        }

                                                                        const formatDateLong = (dStr: string) => {
                                                                            try {
                                                                                const d = new Date(dStr);
                                                                                if (isNaN(d.getTime())) return dStr;
                                                                                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
                                                                            } catch (e) { return dStr; }
                                                                        };

                                                                        const formattedOldDate = oldDate === 'Not Set' ? 'Not Set' : formatDateLong(oldDate);
                                                                        const formattedNewDate = formatDateLong(newDate);
                                                                        const formattedOldTime = oldTime === 'Not Set' ? 'Not Set' : formatTime(oldTime);
                                                                        const formattedNewTime = formatTime(newTime);

                                                                        return (
                                                                            <div className="space-y-8 mb-8">
                                                                                <div className="bg-surface-card border border-surface-border rounded-3xl overflow-hidden group shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] transition-all duration-300">
                                                                                    <div className="px-6 py-4 border-b border-surface-border bg-white/[0.03] relative z-20 overflow-hidden">
                                                                                        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)] pointer-events-none" />
                                                                                        <div className="flex justify-between items-center relative z-10 w-full">
                                                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF6B4B]">DEADLINE UPDATED</span>
                                                                                            {isEditing && (hasPermission('delete_timeline_items') || canEdit) && (
                                                                                                <button
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        handleDeleteComment(comment.id);
                                                                                                    }}
                                                                                                    className="p-1 rounded bg-brand-error/10 text-brand-error border border-brand-error/20 hover:bg-brand-error hover:text-white transition-all scale-75 relative z-50"
                                                                                                    title="Delete Deadline Update"
                                                                                                >
                                                                                                    <IconTrash size={14} />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Changed By</span>
                                                                                        <span className="text-[11px] font-bold text-white uppercase tracking-widest">{comment.author_name || 'User'}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Previous Deadline</span>
                                                                                        <div className="flex items-center gap-2 opacity-50">
                                                                                            <span className="text-[11px] font-bold text-white uppercase tracking-widest">{formattedOldDate}</span>
                                                                                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{formattedOldTime}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Current Deadline</span>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="text-[11px] font-bold text-[#FF6B4B] uppercase tracking-widest">{formattedNewDate}</span>
                                                                                            <span className="text-[11px] font-bold text-[#FF6B4B]/60 uppercase tracking-widest">{formattedNewTime}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // 3. Project Assigned Event
                                                                    const isAssigned = comment.content?.startsWith('PROJECT_ASSIGNED|') || comment.content?.startsWith('PROJECT_ASSIGNED:');
                                                                    if (isAssigned) {
                                                                        const isPipe = comment.content?.includes('|');
                                                                        const parts = comment.content?.split(isPipe ? '|' : ':') || [];
                                                                        const createdAt = parts[1];
                                                                        const assignedTo = parts[2];
                                                                        return (
                                                                            <div className="space-y-8 mb-8">
                                                                                <div className="bg-surface-card border border-surface-border rounded-3xl overflow-hidden group shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] transition-all duration-300">
                                                                                    <div className="px-6 py-4 border-b border-surface-border bg-white/[0.03] relative z-20 overflow-hidden">
                                                                                        <div className="flex justify-between items-center relative z-10 w-full">
                                                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">PROJECT ASSIGNED</span>
                                                                                            {isEditing && (hasPermission('delete_timeline_items') || canEdit) && (
                                                                                                <button
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        handleDeleteComment(comment.id);
                                                                                                    }}
                                                                                                    className="p-1 rounded bg-brand-error/10 text-brand-error border border-brand-error/20 hover:bg-brand-error hover:text-white transition-all scale-75 relative z-50"
                                                                                                    title="Delete Project Assignment"
                                                                                                >
                                                                                                    <IconTrash size={14} />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Assigned To</span>
                                                                                        <span className="text-[11px] font-bold text-brand-primary uppercase tracking-widest">{assignedTo}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Date</span>
                                                                                        <span className="text-[11px] font-bold text-white uppercase tracking-widest">
                                                                                            {new Date(createdAt || comment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // 4. Project Reopened Event
                                                                    const isReopenEvent = comment.content?.startsWith('PROJECT_REOPENED:');
                                                                    if (isReopenEvent) {
                                                                        const parts = comment.content.split(':');
                                                                        const oldStatus = parts[1] || 'Approved';
                                                                        return (
                                                                            <div className="space-y-8 mb-8">
                                                                                <div className="bg-surface-card border border-surface-border rounded-3xl overflow-hidden group shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] transition-all duration-300">
                                                                                    <div className="px-6 py-4 border-b border-surface-border bg-white/[0.03] relative z-20 overflow-hidden">
                                                                                        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)] pointer-events-none" />
                                                                                        <div className="flex justify-between items-center relative z-10 w-full">
                                                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFB02E]">
                                                                                                PROJECT REOPENED
                                                                                            </span>
                                                                                            {isEditing && (hasPermission('delete_timeline_items') || canEdit) && (
                                                                                                <button
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        handleDeleteComment(comment.id);
                                                                                                    }}
                                                                                                    className="p-1 rounded bg-brand-error/10 text-brand-error border border-brand-error/20 hover:bg-brand-error hover:text-white transition-all scale-75 relative z-50"
                                                                                                    title="Delete Reopen Record"
                                                                                                >
                                                                                                    <IconTrash size={14} />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-4/5 h-12 [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)] pointer-events-none -z-10">
                                                                                            <div className="w-full h-full shadow-[0_12px_32px_-8px_rgba(0,0,0,0.9)] opacity-80" />
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Reopened By</span>
                                                                                        <span className="text-[11px] font-bold text-white uppercase tracking-widest">{comment.author_name || 'User'}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Date</span>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="text-[11px] font-bold text-white uppercase tracking-widest">
                                                                                                {new Date(comment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                                                            </span>
                                                                                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                                                                                {new Date(comment.created_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Previous Status</span>
                                                                                        <span className={`${getStatusCapsuleClasses(oldStatus)} opacity-50`}>
                                                                                            {oldStatus}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-6 py-4 bg-white/[0.01]">
                                                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Current Status</span>
                                                                                        <span className={getStatusCapsuleClasses('In Progress')}>
                                                                                            Reopened
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // 6. Default Comment View
                                                                    return (
                                                                        <div className="mb-8">
                                                                            <ElevatedMetallicCard
                                                                                title={
                                                                                    <div className="flex items-center gap-3">
                                                                                        <span className="text-xs font-bold text-white uppercase tracking-widest leading-none">
                                                                                            {formatDisplayName(comment.author_name) || 'User'}
                                                                                        </span>
                                                                                        <div className="w-1 h-1 rounded-full bg-gray-600" />
                                                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">
                                                                                            {new Date(comment.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()}
                                                                                        </span>
                                                                                    </div>
                                                                                }
                                                                                bodyClassName="p-6"
                                                                                headerClassName="px-6 py-3"
                                                                                rightElement={
                                                                                    isEditing && (hasPermission('delete_timeline_items') || canEdit) ? (
                                                                                        <button
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleDeleteComment(comment.id);
                                                                                            }}
                                                                                            className="p-1.5 rounded-lg bg-brand-error/10 text-brand-error border border-brand-error/20 hover:bg-brand-error hover:text-white transition-all relative z-50"
                                                                                            title="Delete Comment"
                                                                                        >
                                                                                            <IconTrash size={14} />
                                                                                        </button>
                                                                                    ) : undefined
                                                                                }
                                                                            >
                                                                                {comment.content && (
                                                                                    <div className="text-sm text-gray-300 leading-relaxed">{comment.content}</div>
                                                                                )}
                                                                                {comment.attachments && Array.isArray(comment.attachments) && comment.attachments.length > 0 && (
                                                                                    <div className="mt-4 flex flex-wrap gap-3">
                                                                                        {comment.attachments.map((file: any, i: number) => (
                                                                                            <div key={i} className="group/posted-file relative cursor-pointer hover:scale-[1.02] transition-transform">
                                                                                                <div className="w-20 h-20 rounded-xl border border-surface-border bg-surface-overlay flex items-center justify-center relative overflow-hidden">
                                                                                                    <FileIcon name={file.name} type={file.type} url={file.url} />
                                                                                                </div>

                                                                                                {/* DOWNLOAD OVERLAY */}
                                                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/posted-file:opacity-100 transition-opacity duration-200 flex items-center justify-center z-20 backdrop-blur-[1px]">
                                                                                                    <button
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            forceDownload(file.url, file.name || 'download');
                                                                                                        }}
                                                                                                        className="p-1.5 rounded-full bg-white/10 hover:bg-brand-primary text-white transition-colors border border-white/10 hover:border-brand-primary"
                                                                                                        title="Download"
                                                                                                    >
                                                                                                        <IconDownload size={14} />
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </ElevatedMetallicCard>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        ))}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-12 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl">
                                                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">No activity recorded yet</p>
                                                </div>
                                            )}
                                        </section>

                                        {/* 4. Bottom Separator */}
                                        <div className="border-t border-surface-border w-full my-10" />

                                        {/* 5. Comment Composer (Input Area) */}
                                        <section>
                                            <ElevatedMetallicCard
                                                title="Post Comment"
                                                headerClassName="px-8 py-3"
                                                bodyClassName="p-8"
                                            >
                                                <div className="space-y-4">
                                                    <TextArea
                                                        variant="recessed"
                                                        placeholder="Write a comment..."
                                                        value={newComment}
                                                        onChange={(e) => setNewComment(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handlePostComment();
                                                            }
                                                        }}
                                                        className="relative z-10"
                                                        inputClassName="min-h-[140px]"
                                                    />

                                                    {/* Attachment Preview */}
                                                    {attachments.length > 0 && (
                                                        <div className="flex flex-wrap gap-3 px-1 relative z-10">
                                                            {attachments.map((att, i) => (
                                                                <div key={att.id} className="relative group/file">
                                                                    <div className={`
                                                            w-20 h-20 rounded-xl border flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300
                                                            ${att.status === 'uploading' ? 'bg-surface-card border-brand-primary/30' : 'bg-surface-overlay border-surface-border'}
                                                        `}>
                                                                        {/* Loading State */}
                                                                        {att.status === 'uploading' && (
                                                                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px]">
                                                                                <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mb-2" />
                                                                            </div>
                                                                        )}

                                                                        <FileIcon name={att.file.name} type={att.file.type} url={att.previewUrl} />


                                                                    </div>

                                                                    {/* OVERLAY for Download/Copy */}
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/file:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 z-20 backdrop-blur-[1px]">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                forceDownload(att.previewUrl, att.file.name || 'download');
                                                                            }}
                                                                            className="p-1.5 rounded-full bg-white/10 hover:bg-brand-primary text-white transition-colors border border-white/10 hover:border-brand-primary"
                                                                            title="Download"
                                                                        >
                                                                            <IconDownload size={14} />
                                                                        </button>
                                                                    </div>

                                                                    {/* Remove Button (Hover) */}
                                                                    <div className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/file:opacity-100 transition-opacity z-30">
                                                                        <button
                                                                            onClick={() => removeAttachment(i)}
                                                                            className="bg-surface-card border border-surface-border text-gray-400 hover:text-brand-error p-1 rounded-full shadow-lg"
                                                                        >
                                                                            <IconX size={10} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        className="hidden"
                                                        multiple
                                                        onChange={handleFileSelect}
                                                    />

                                                    <div className="flex items-center justify-between relative z-10 pt-2">
                                                        <button
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-widest hover:bg-white/5 rounded-lg"
                                                        >
                                                            <IconPaperclip size={16} />
                                                            Attach Files
                                                            {attachments.length > 0 && <span className="text-brand-primary">({attachments.length})</span>}
                                                        </button>
                                                        <div className="flex items-center gap-3">
                                                            <Button
                                                                variant="secondary"
                                                                className="px-6 py-2.5 h-[38px] text-xs font-bold uppercase tracking-widest bg-surface-overlay border-surface-border hover:bg-white/[0.05]"
                                                            >
                                                                QA Check
                                                            </Button>
                                                            <Button
                                                                variant="metallic"
                                                                className="px-8 py-2.5 h-[38px] text-xs font-bold uppercase tracking-widest"
                                                                leftIcon={<IconSend size={14} />}
                                                                onClick={handlePostComment}
                                                                isLoading={isPostingComment}
                                                                disabled={(!newComment.trim() && attachments.length === 0) || attachments.some(a => a.status === 'uploading')}
                                                            >
                                                                Send
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </ElevatedMetallicCard>
                                        </section>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </main>

                {/* Deadline Update Modal */}
                <Modal
                    isOpen={isDeadlineModalOpen}
                    onClose={() => {
                        setIsDeadlineModalOpen(false);
                        setActiveShortcut(null);
                    }}
                    title="Update Deadline"
                    isElevatedHeader
                    isElevatedFooter
                    footer={
                        <div className="flex items-center justify-end gap-3 w-full">
                            <Button variant="recessed" className="uppercase tracking-widest text-xs px-6 h-10 border-white/5 hover:bg-white/5" onClick={() => {
                                setIsDeadlineModalOpen(false);
                                setActiveShortcut(null);
                            }}>
                                Cancel
                            </Button>
                            <Button variant="metallic" className="uppercase tracking-widest text-xs px-8 h-10" onClick={handleUpdateDeadlineModal}>
                                Update Deadline
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-6 pt-2 pb-2">
                        <div>
                            <p className="text-sm text-gray-400 font-medium mb-3">Set the new delivery date and time for this project.</p>
                            <div className="flex flex-wrap gap-2">
                                {[2, 6, 8, 12, 24].map((hours) => (
                                    <Button
                                        key={hours}
                                        variant="recessed"
                                        size="sm"
                                        onClick={() => {
                                            setActiveShortcut(hours);
                                            const futureDate = new Date(Date.now() + hours * 60 * 60 * 1000);
                                            setModalDate(futureDate);
                                            const hh = String(futureDate.getHours()).padStart(2, '0');
                                            const mm = String(futureDate.getMinutes()).padStart(2, '0');
                                            setModalTime(`${hh}:${mm}`);
                                        }}
                                        className={`!px-3 !py-1.5 !h-auto !text-[10px] font-bold uppercase tracking-wider transition-all duration-300 transform active:scale-95 ${activeShortcut === hours
                                            ? '!text-white !border-white/20 !bg-white/10'
                                            : ''
                                            }`}
                                    >
                                        +{hours} Hrs
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <DatePicker
                                value={modalDate}
                                onChange={(date: Date) => setModalDate(date)}
                                variant="recessed"
                            />
                            <TimeSelect
                                value={modalTime}
                                onChange={(time: string) => setModalTime(time)}
                                variant="recessed"
                            />
                        </div>
                    </div>
                </Modal>

                {/* Confirmation Modal for Deletion */}
                <Modal
                    isOpen={!!itemToDelete}
                    onClose={() => setItemToDelete(null)}
                    title="Confirm Deletion"
                    size="sm"
                >
                    <div className="space-y-6 pt-4 pb-2">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-brand-error/10 border border-brand-error/20 flex items-center justify-center text-brand-error mb-2">
                                <IconTrash size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Are you sure?</h2>
                            <p className="text-sm text-gray-400 leading-relaxed font-medium">
                                This action will permanently delete this item from the project timeline. This cannot be undone.
                            </p>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button
                                variant="recessed"
                                className="flex-1 h-12 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white border-white/5"
                                onClick={() => setItemToDelete(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="metallic"
                                className="flex-1 h-12 !bg-brand-error/20 !text-brand-error !border-brand-error/30 hover:!bg-brand-error hover:!text-white text-[10px] font-black uppercase tracking-widest transition-all duration-300"
                                onClick={confirmDelete}
                            >
                                Delete Permanently
                            </Button>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
};

// UI Subcomponents
const MetadataSection: React.FC<{
    title: string;
    children: React.ReactNode;
    isCollapsed?: boolean;
    collapsedHeight?: string;
}> = ({ title, children, isCollapsed, collapsedHeight = "h-14" }) => (
    <div className="w-full flex justify-center">
        {isCollapsed ? (
            <div className={`w-[2px] ${collapsedHeight} bg-surface-border rounded-full transition-all duration-300`} />
        ) : (
            <div className="w-full min-w-[280px]">
                <ElevatedMetallicCard
                    title={title}
                    headerClassName="px-6 py-4"
                    bodyClassName="p-6 space-y-5"
                    className="hover:border-white/5 transition-all group"
                >
                    {children}
                </ElevatedMetallicCard>
            </div>
        )}
    </div>
);

const MetadataItem: React.FC<{
    label: React.ReactNode;
    value: React.ReactNode;
    isMono?: boolean;
    isAccent?: boolean;
    isSelect?: boolean;
    isRecessed?: boolean;
    isDate?: boolean;
    isTime?: boolean;
    leftIcon?: React.ReactNode;
    valueClassName?: string;
    onClick?: () => void;
}> = ({ label, value, isMono, isAccent, isSelect, isRecessed, isDate, isTime, leftIcon, valueClassName, onClick }) => (
    <div className={`px-1 group/item ${onClick || isSelect ? 'cursor-pointer' : ''}`} onClick={onClick}>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 group-hover/item:text-brand-primary/70 transition-colors uppercase">{label}</p>
        <div className={`
            w-full flex items-center justify-between transition-all duration-300 relative overflow-hidden
            ${(isSelect || isRecessed)
                ? 'bg-black/25 border border-surface-border/40 rounded-xl px-4 py-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.02)]'
                : 'bg-transparent border-2 border-transparent px-0 py-1'
            }
            ${isSelect ? 'cursor-pointer hover:border-white/10 active:scale-[0.98]' : ''}
        `}>
            {/* Subtle Vertical Metallic Gradient for isSelect/isRecessed */}
            {(isSelect || isRecessed) && <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.01),transparent)] pointer-events-none" />}

            <div className={`
                relative z-10 w-full flex items-center gap-2
                ${isMono ? 'font-mono' : 'font-bold'} 
                ${isAccent ? 'text-brand-primary text-base' : 'text-sm'}
                ${isSelect ? 'text-white' : valueClassName || 'text-gray-300'}
            `}>
                {isDate && <IconCalendar size={16} className={(isSelect || isRecessed) ? 'text-brand-primary' : 'text-gray-500'} />}
                {isTime && <IconClock size={16} className={(isSelect || isRecessed) ? 'text-brand-primary' : 'text-gray-500'} />}
                {leftIcon && <div className="text-gray-500">{leftIcon}</div>}
                <div className="flex-1 overflow-hidden">{value}</div>
            </div>
            {isSelect && (
                <svg className="w-4 h-4 text-gray-600 group-hover/item:text-brand-primary transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
            )}
        </div>
    </div>
);

const CollaboratorItem: React.FC<{ name: string; role: string; phone?: string; avatarUrl?: string }> = ({ name, phone }) => {
    return (
        <div className="flex flex-col gap-1.5 leading-tight">
            <span className="text-sm font-bold text-white">{formatDisplayName(name)}</span>

            {phone && (
                <div className="flex items-center gap-2 group/phone cursor-pointer transition-colors">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover/phone:text-brand-primary transition-colors">Phone</span>
                    <span className="text-xs font-mono text-gray-300 group-hover/phone:text-white transition-colors tracking-wide">
                        {phone}
                    </span>
                </div>
            )}
        </div>
    );
};

export default ProjectDetails;
