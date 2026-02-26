
import React, { useState } from 'react';
import { Modal, ElevatedMetallicCard } from '../components/Surfaces';
import Button from '../components/Button';
import { Input } from '../components/Input';
import { addToast } from '../components/Toast';
import { DatePicker } from '../components/DatePicker';
import { KebabMenu } from '../components/KebabMenu';
import { Switch } from '../components/Selection';
import { IconEdit, IconTrash, IconEye, IconFileText, IconLayout, IconClock } from '../components/Icons';
import { supabase } from '../lib/supabase';
import { Dropdown } from '../components/Dropdown';
import { useAccounts } from '../contexts/AccountContext';
import { Tabs } from '../components/Navigation';
import { TimeSelect } from '../components/TimeSelect';
import { Table } from '../components/Table';
import { useUser } from '../contexts/UserContext';
import { formatDisplayName } from '../utils/formatter';
import { PerformanceForm } from '../components/PerformanceForm';

const Forms: React.FC = () => {
    const { accounts, loading: accountsLoading } = useAccounts();
    const { profile } = useUser();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);
    const [formData, setFormData] = useState({
        accountId: '',
        date: null as Date | null,
        successScore: '',
        rating: '',
        ctr: '',
        conversionRate: '',
        impressions: '',
        clicks: '',
        orders: '',
        cancelledOrders: ''
    });

    const handleOpenForm = () => {
        setIsModalOpen(true);
    };

    const handleDelete = () => {
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        setSubmitting(true);
        // Simulate DB call
        setTimeout(() => {
            setIsDeleted(true);
            setSubmitting(false);
            setIsDeleteModalOpen(false);
            addToast({ type: 'success', title: 'Deleted', message: 'Form deleted successfully.' });
        }, 1000);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            if (!formData.accountId) {
                throw new Error('Please select an account');
            }
            if (!formData.date) {
                throw new Error('Please select a date');
            }

            const { error } = await supabase
                .from('performance_metrics')
                .insert({
                    account_id: formData.accountId,
                    date: formData.date.toISOString().split('T')[0],
                    success_score: parseFloat(formData.successScore) || 0,
                    rating: parseFloat(formData.rating) || 0,
                    ctr: parseFloat(formData.ctr) || 0,
                    conversion_rate: parseFloat(formData.conversionRate) || 0,
                    impressions: parseInt(formData.impressions) || 0,
                    clicks: parseInt(formData.clicks) || 0,
                    orders: parseInt(formData.orders) || 0,
                    cancelled_orders: parseInt(formData.cancelledOrders) || 0
                });

            if (error) throw error;

            addToast({ type: 'success', title: 'Data Submitted', message: 'Performance data has been recorded.' });

            // Reset form
            setFormData({
                accountId: '',
                date: null,
                successScore: '',
                rating: '',
                ctr: '',
                conversionRate: '',
                impressions: '',
                clicks: '',
                orders: '',
                cancelledOrders: ''
            });
            setIsModalOpen(false);
        } catch (error: any) {
            console.error('Error submitting form:', error);
            addToast({ type: 'error', title: 'Error', message: error.message || 'Failed to submit data.' });
        } finally {
            setSubmitting(false);
        }
    };

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [assignmentData, setAssignmentData] = useState({
        formId: '',
        userId: '',
        time: '',
        frequency: '',
        isMandatory: false
    });

    const fetchProfiles = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, role')
                .order('name');
            if (error) throw error;
            setProfiles(data || []);
        } catch (error) {
            console.error('Error fetching profiles:', error);
        }
    };

    const handleOpenAssign = (formId: string) => {
        setAssignmentData(prev => ({ ...prev, formId }));
        setIsAssignModalOpen(true);
        fetchProfiles();
    };

    const handleConfirmAssign = async () => {
        setAssigning(true);
        try {
            if (!assignmentData.userId) throw new Error('Please select a user');

            console.log('[Forms] Inserting assignment:', assignmentData);

            const insertPayload = {
                form_id: assignmentData.formId,
                user_id: assignmentData.userId,
                trigger_time: assignmentData.time || '09:00',
                frequency: assignmentData.frequency || 'daily',
                is_mandatory: assignmentData.isMandatory
            };

            const { data: insertedData, error } = await supabase
                .from('form_assignments')
                .insert(insertPayload)
                .select();

            console.log('[Forms] Insert result:', { insertedData, error });

            if (error) throw error;

            addToast({ type: 'success', title: 'Assigned', message: 'Form successfully assigned to user.' });
            setIsAssignModalOpen(false);

            // Clear form
            setAssignmentData({
                formId: '',
                userId: '',
                time: '',
                frequency: '',
                isMandatory: false
            });

            // Refresh data
            await fetchAssignments();
        } catch (error: any) {
            console.error('[Forms] Assignment error:', error);
            addToast({ type: 'error', title: 'Error', message: error.message || 'Failed to assign form.' });
        } finally {
            setAssigning(false);
        }
    };

    const [assignments, setAssignments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAssignments = async (isInitial = false) => {
        try {
            if (isInitial) setIsLoading(true);
            console.log('[Forms] Fetching assignments...');

            const { data, error } = await supabase
                .from('form_assignments')
                .select('*')
                .order('created_at', { ascending: false });

            console.log('[Forms] Fetch result:', { count: data?.length, error });

            if (error) throw error;

            if (!data || data.length === 0) {
                setAssignments([]);
                return;
            }

            // Fetch profiles for assigned users separately
            const userIds = [...new Set(data.map((a: any) => a.user_id))];
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, name, avatar_url, role')
                .in('id', userIds);

            const profilesMap = (profilesData || []).reduce((acc: any, p: any) => {
                acc[p.id] = p;
                return acc;
            }, {});

            // Merge assignment + profile data
            const enriched = data.map((a: any) => ({
                ...a,
                profiles: profilesMap[a.user_id] || null
            }));

            setAssignments(enriched);
        } catch (error) {
            console.error('[Forms] Error fetching assignments:', error);
        } finally {
            setIsLoading(false);
        }
    };


    const handleDeleteAssignment = async (id: string) => {
        try {
            const { error } = await supabase
                .from('form_assignments')
                .delete()
                .eq('id', id);
            if (error) throw error;
            addToast({ type: 'success', title: 'Removed', message: 'Assignment deleted.' });
            fetchAssignments();
        } catch (error) {
            addToast({ type: 'error', title: 'Error', message: 'Failed to delete.' });
        }
    };

    const getStatusBadge = (asg: any) => {
        const now = new Date();
        if (asg.snoozed_until && new Date(asg.snoozed_until) > now) {
            return (
                <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-500 border border-orange-500/20">
                    Snoozed
                </span>
            );
        }
        return (
            <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-500/10 text-gray-500 border border-gray-500/20">
                Pending
            </span>
        );
    };

    const [activeTab, setActiveTab] = useState('library');

    const tabs = [
        { id: 'library', label: 'Form Library', icon: <IconLayout className="w-4 h-4" /> },
        { id: 'tracker', label: 'Assignment Tracker', icon: <IconClock className="w-4 h-4" /> },
    ];

    React.useEffect(() => {
        fetchAssignments(true);
    }, []);


    React.useEffect(() => {
        if (activeTab === 'tracker') {
            fetchAssignments();
        }
    }, [activeTab]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Tab Navigation */}
            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="flex flex-col gap-4 min-h-[400px]">
                {activeTab === 'library' ? (
                    <>
                        {!isDeleted ? (
                            /* Specific Performance Form Card */
                            <ElevatedMetallicCard
                                title="Performance Tracking"
                                bodyClassName="p-6"
                            >
                                <div className="flex items-center justify-between gap-6">
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <p className="text-sm text-gray-400 line-clamp-1">Track daily performance metrics including success scores, ratings, and conversion data.</p>
                                        <div className="flex items-center gap-4 mt-2">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                                                Daily Report
                                            </p>
                                            <span className="w-1 h-1 rounded-full bg-gray-700" />
                                            <p className="text-[10px] text-brand-primary font-bold uppercase tracking-widest">
                                                {assignments.filter(a => a.form_id === 'performance_tracking').length} Active Assignments
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <Button
                                            variant="metallic"
                                            size="sm"
                                            className="h-9 px-6 text-[10px] uppercase tracking-widest font-bold rounded-full mr-6 shadow-nova"
                                            onClick={() => handleOpenAssign('performance_tracking')}
                                        >
                                            Assign to User
                                        </Button>
                                        <div className="w-px h-6 bg-white/10" />
                                        <KebabMenu
                                            options={[
                                                {
                                                    label: 'Preview',
                                                    icon: <IconEye className="w-4 h-4" />,
                                                    onClick: handleOpenForm
                                                },
                                                {
                                                    label: 'Delete',
                                                    icon: <IconTrash className="w-4 h-4" />,
                                                    variant: 'danger',
                                                    onClick: handleDelete
                                                }
                                            ]}
                                        />
                                    </div>
                                </div>
                            </ElevatedMetallicCard>
                        ) : (
                            <div className="flex flex-col items-center justify-center flex-1 py-12 border-2 border-dashed border-surface-border rounded-3xl bg-white/[0.02]">
                                <div className="p-4 rounded-full bg-brand-primary/10 mb-4">
                                    <IconFileText className="w-8 h-8 text-brand-primary" />
                                </div>
                                <h4 className="text-lg font-bold text-white">No Forms Available</h4>
                                <p className="text-gray-500 text-sm mt-1">Create a new form to get started.</p>
                            </div>
                        )}
                    </>
                ) : (
                    /* Assignment Tracker Tab */
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                        <Table
                            isMetallicHeader={true}
                            emptyMessage='No active assignments found. Click "Assign" in the Library to start.'
                            data={assignments}
                            isLoading={isLoading}

                            columns={[
                                {
                                    header: 'Form Name',
                                    key: 'form_id',
                                    render: (asg: any) => (
                                        <div>
                                            <p className="text-sm font-bold text-white">
                                                {asg.form_id === 'performance_tracking' ? 'Performance Tracking' : asg.form_id}
                                            </p>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">{asg.frequency}</p>
                                        </div>
                                    )
                                },
                                {
                                    header: 'Assigned To',
                                    key: 'user_id',
                                    render: (asg: any) => (
                                        <div>
                                            <p className="text-sm text-white font-semibold">{formatDisplayName(asg.profiles?.name) || '—'}</p>
                                            <p className="text-[10px] text-gray-500 capitalize">{asg.profiles?.role}</p>
                                        </div>
                                    )
                                },
                                {
                                    header: 'Trigger Time',
                                    key: 'trigger_time',
                                    render: (asg: any) => (
                                        <span className="text-sm text-gray-300 font-mono tracking-wider">
                                            {asg.trigger_time ? asg.trigger_time.slice(0, 5) : '—'}
                                        </span>
                                    )
                                },
                                {
                                    header: 'Frequency',
                                    key: 'frequency',
                                    render: (asg: any) => (
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/[0.05] text-gray-300 border border-white/[0.08]">
                                            {asg.frequency}
                                        </span>
                                    )
                                },
                                {
                                    header: 'Status',
                                    key: 'id',
                                    render: (asg: any) => getStatusBadge(asg)
                                },
                                {
                                    header: '',
                                    key: 'id',
                                    className: 'w-16 text-right',
                                    render: (asg: any) => (
                                        <button
                                            onClick={() => handleDeleteAssignment(asg.id)}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 active:scale-95"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    )
                                },
                            ]}
                        />
                    </div>
                )}
            </div>

            {/* Assignment Modal */}
            <Modal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                title="Assign Form"
                size="sm"
                isElevatedFooter={true}
                footer={(
                    <div className="flex justify-end gap-3">
                        <Button variant="recessed" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
                        <Button variant="metallic" onClick={handleConfirmAssign} isLoading={assigning}>
                            Confirm Assignment
                        </Button>
                    </div>
                )}
            >
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Select User</label>
                        <Dropdown
                            variant="metallic"
                            placeholder="Find a user..."
                            options={profiles.map(p => ({ value: p.id, label: p.name, description: p.role }))}
                            value={assignmentData.userId}
                            onChange={(val) => setAssignmentData({ ...assignmentData, userId: val })}
                            showSearch={true}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Trigger Time</label>
                            <TimeSelect
                                variant="metallic"
                                value={assignmentData.time}
                                onChange={(val) => setAssignmentData({ ...assignmentData, time: val })}
                                placeholder="Select Time"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Frequency</label>
                            <Dropdown
                                variant="metallic"
                                placeholder="Select Frequency"
                                options={[
                                    { value: 'daily', label: 'Daily' },
                                    { value: 'weekly', label: 'Weekly' },
                                    { value: 'once', label: 'Once' }
                                ]}
                                value={assignmentData.frequency}
                                onChange={(val) => setAssignmentData({ ...assignmentData, frequency: val })}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-white">Mandatory Completion</p>
                            <p className="text-xs text-gray-500">User cannot dismiss until filled.</p>
                        </div>
                        <Switch
                            checked={assignmentData.isMandatory}
                            onChange={(checked) => setAssignmentData({ ...assignmentData, isMandatory: checked })}
                            variant="metallic"
                        />
                    </div>
                </div>
            </Modal>

            {/* Performance Form Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Performance Tracking"
                size="md"
                isElevatedFooter={true}
                footer={(
                    <div className="flex justify-end gap-3">
                        <Button variant="recessed" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button variant="metallic" onClick={() => document.getElementById('perf-form-submit')?.click()} isLoading={submitting}>
                            Submit
                        </Button>
                    </div>
                )}
            >
                <PerformanceForm
                    userId={profile?.id}
                    onComplete={() => setIsModalOpen(false)}
                    onSubmitStatusChange={setSubmitting}
                />
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Delete Form"
                size="sm"
                isElevatedFooter={true}
                footer={(
                    <div className="flex justify-end gap-3">
                        <Button variant="recessed" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                        <Button
                            variant="metallic-error"
                            onClick={handleConfirmDelete}
                            isLoading={submitting}
                        >
                            Delete Form
                        </Button>
                    </div>
                )}
            >
                <div className="py-2">
                    <p className="text-gray-300">Are you sure you want to delete this form?</p>
                    <p className="text-sm text-gray-500 mt-2">This action cannot be undone and will remove the template entirely.</p>
                </div>
            </Modal>
        </div>
    );
};

export default Forms;
