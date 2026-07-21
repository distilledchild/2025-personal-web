import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TodoPersonal } from './TodoPersonal';
import { TodoDev } from './TodoDev';
import { TodoNote } from './TodoNote';
import { TodoBilling } from './TodoBilling';
import { API_URL } from '../utils/apiConfig';
import { PageHeader } from '../components/PageHeader';
import { fetchMemberRole, getStoredUserProfile } from '../utils/auth';

export const Todo: React.FC = () => {
    // ============================================================================
    // ROUTER & URL PARAMETERS
    // ============================================================================
    const navigate = useNavigate();
    const { tab } = useParams<{ tab: string }>();

    // ============================================================================
    // CORE STATE - User, Authorization
    // ============================================================================
    const [user, setUser] = React.useState<any>(null);
    const [isAuthorized, setIsAuthorized] = React.useState(false);
    const [authLoading, setAuthLoading] = React.useState(true);

    // ============================================================================
    // PROJECT STATE (shared for both tabs)
    // ============================================================================
    const [projects, setProjects] = React.useState<any[]>([]);

    // Derive activeTab from URL parameter
    const activeTab = (tab === 'dev' ? 'dev' : tab === 'note' ? 'note' : tab === 'billing' ? 'billing' : 'personal') as 'personal' | 'dev' | 'note' | 'billing';

    React.useEffect(() => {
        const checkAuth = async () => {
            // Get user data
            const userData = getStoredUserProfile<any>();
            if (userData) {
                try {
                    setUser(userData);

                    // Check authorization
                    const data = await fetchMemberRole(userData.email);
                    setIsAuthorized(data.authorized);
                } catch (e) {
                    console.error('Failed to parse user data', e);
                }
            }
            setAuthLoading(false);
        };

        const fetchProjects = async () => {
            try {
                const response = await fetch(`${API_URL}/api/projects`);
                if (response.ok) {
                    const data = await response.json();
                    setProjects(data);
                }
            } catch (error) {
                console.error('Failed to fetch projects:', error);
            }
        };

        checkAuth();
        fetchProjects();
    }, []);

    React.useEffect(() => {
        if (!authLoading && !isAuthorized) {
            navigate('/');
        }
    }, [authLoading, isAuthorized, navigate]);

    if (authLoading) {
        return (
            <div className="flex flex-col h-screen bg-white items-center justify-center">
                <p className="text-slate-500">Loading...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-white">
            <PageHeader
                title="TODO"
                tabs={[
                    { id: 'personal', label: 'Personal' },
                    { id: 'dev', label: 'Dev' },
                    { id: 'note', label: 'Note' },
                    { id: 'billing', label: 'Billing' }
                ]}
                activeTab={activeTab}
                onTabChange={(id) => navigate(`/todo/${id}`)}
                activeColor="border-slate-900 text-slate-900"
            />

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-6 pb-20 scrollbar-hide">
                <div className="max-w-7xl mx-auto w-full min-h-full">
                    {activeTab === 'personal' ? (
                        <TodoPersonal
                            user={user}
                            isAuthorized={isAuthorized}
                            projects={projects}
                        />
                    ) : activeTab === 'dev' ? (
                        <TodoDev
                            user={user}
                            isAuthorized={isAuthorized}
                            projects={projects}
                        />
                    ) : activeTab === 'billing' ? (
                        <TodoBilling
                            isAuthorized={isAuthorized}
                        />
                    ) : (
                        <TodoNote
                            user={user}
                            isAuthorized={isAuthorized}
                            projects={projects}
                        />
                    )}
                </div>
            </div>

        </div>
    );
};
