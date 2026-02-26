
import { DashboardView } from '../layouts/DashboardLayout';

const VIEW_MAP: Record<string, DashboardView> = {
    'dashboard': 'Dashboard',
    'tasks': 'Tasks',
    'projects': 'Projects',
    'analytics': 'Analytics',
    'finances': 'Finances',
    'earnings': 'Earnings',
    'accounts': 'Accounts',
    'assets': 'Assets',
    'chats': 'Chats',
    'users': 'Users',
    'channels': 'Channels',
    'forms': 'Forms',
    'integrations': 'Integrations',
    'settings': 'Settings',
    'reminders': 'Reminders',
    'profile': 'Profile'
};

export const PATH_MAP: Record<DashboardView, string> = Object.entries(VIEW_MAP).reduce((acc, [path, view]) => {
    acc[view] = path;
    return acc;
}, {} as Record<DashboardView, string>);

export const getInitialView = (): { view: DashboardView; projectId: string | null; userId: string | null } => {
    const segments = window.location.pathname.substring(1).split('/');
    const firstSegment = segments[0]?.toLowerCase();

    if (firstSegment && VIEW_MAP[firstSegment]) {
        const view = VIEW_MAP[firstSegment];
        const secondSegment = segments[1];

        if (secondSegment) {
            // Handle Projects detail
            if (view === 'Projects' && !['progress', 'completed', 'cancelled', 'disputes', 'trash'].includes(secondSegment.toLowerCase())) {
                const decodedProjectId = decodeURIComponent(secondSegment);
                return { view: 'Projects', projectId: decodedProjectId, userId: null };
            }

            // Handle Users detail
            if (view === 'Users' && !['users', 'teams', 'shifts'].includes(secondSegment.toLowerCase())) {
                return { view: 'Users', projectId: null, userId: decodeURIComponent(secondSegment) };
            }
        }

        return { view, projectId: null, userId: null };
    }

    const saved = localStorage.getItem('lastDashboardView') as DashboardView;
    if (saved && Object.values(VIEW_MAP).includes(saved)) {
        return { view: saved, projectId: null, userId: null };
    }

    return { view: 'Dashboard', projectId: null, userId: null };
};

export const getInitialTab = (view: string, defaultTab: string): string => {
    const segments = window.location.pathname.substring(1).split('/');
    const firstSegment = segments[0]?.toLowerCase();
    const normalizedView = VIEW_MAP[view] || (view as DashboardView);
    const allowedTabs: Record<string, string[]> = {
        'Analytics': ['pipeline', 'secured', 'cancelled'],
        'Settings': ['profile', 'page-access', 'account-access']
    };

    if (firstSegment === VIEW_MAP[view]?.toLowerCase() || firstSegment === view.toLowerCase()) {
        const secondSegment = segments[1]?.toLowerCase();
        if (secondSegment && allowedTabs[normalizedView]?.includes(secondSegment)) {
            return secondSegment;
        }
    }

    const saved = localStorage.getItem(`lastTab_${view}`);
    if (saved && allowedTabs[normalizedView]?.includes(saved)) {
        return saved;
    }

    return defaultTab;
};

export const updateRoute = (view: DashboardView, tab?: string, projectId?: string | null, userId?: string | null) => {
    const viewPath = PATH_MAP[view];
    let newPath = `/${viewPath}`;

    if (view === 'Projects' && projectId) {
        newPath += `/${encodeURIComponent(projectId.replace(/\s+/g, '-'))}`;
    } else if (view === 'Users' && userId) {
        newPath += `/${encodeURIComponent(userId)}`;
    } else if (tab) {
        newPath += `/${tab.toLowerCase()}`;
    }

    if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
    }

    localStorage.setItem('lastDashboardView', view);

    const allowedTabs: Record<string, string[]> = {
        'Analytics': ['pipeline', 'secured', 'cancelled'],
        'Settings': ['profile', 'page-access', 'account-access']
    };

    if (tab && !projectId && !userId) {
        const normalizedView = VIEW_MAP[view] || (view as DashboardView);
        if (allowedTabs[normalizedView]?.includes(tab.toLowerCase())) {
            localStorage.setItem(`lastTab_${view}`, tab.toLowerCase());
        }
    }
};

export const navigateToProjectDetails = (projectId: string) => {
    const newPath = `/projects/${encodeURIComponent(projectId)}`;
    window.history.pushState(null, '', newPath);
    // Explicitly returning navigation intent
    return { view: 'Projects' as DashboardView, projectId };
};
