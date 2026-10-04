import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AboutMe } from './about/AboutMe';
import { AboutMilestones } from './about/AboutMilestones';
import { AboutAcademics } from './about/AboutAcademics';
import { AboutTechStack } from './about/AboutTechStack';
import { PageHeader } from '../components/PageHeader';
import { fetchMemberRole, getStoredUserProfile, subscribeToUserProfileChanges } from '../utils/auth';

export const About: React.FC = () => {
    const { tab } = useParams<{ tab: string }>();
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isAuthLoading, setIsAuthLoading] = useState(true);

    useEffect(() => {
        // Check user auth status
        const checkAuth = async () => {
            setIsAuthLoading(true);
            const storedUser = getStoredUserProfile<any>();
            if (storedUser) {
                try {
                    setUser(storedUser);

                    // Check authorization from MEMBER collection
                    const data = await fetchMemberRole(storedUser.email);
                    setIsAuthorized(String(data.role || '').toUpperCase() === 'ADMIN');
                } catch (err) {
                    console.error('Failed to check authorization:', err);
                    setIsAuthorized(false);
                }
            } else {
                setUser(null);
                setIsAuthorized(false);
            }
            setIsAuthLoading(false);
        };

        // Initial check
        checkAuth();

        const unsubscribe = subscribeToUserProfileChanges(checkAuth);

        return () => {
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!isAuthLoading && tab === 'academics' && !isAuthorized) {
            navigate('/about/me', { replace: true });
        }
    }, [isAuthLoading, isAuthorized, navigate, tab]);

    // Map URL param to valid tabs, default to 'me'
    const activeTab = (tab === 'academics' && !isAuthorized)
        ? 'me'
        : (tab === 'me' || tab === 'milestones' || tab === 'academics' || tab === 'tech-stack') ? tab : 'me';

    const handleTabChange = (newTab: string) => {
        navigate(`/about/${newTab}`);
    };

    return (
        <div className="flex flex-col h-screen bg-white">
            <PageHeader
                title="Intro"
                tabs={[
                    { id: 'me', label: 'Me' },
                    { id: 'milestones', label: 'Milestones' },
                    ...(isAuthorized ? [{ id: 'academics', label: 'Academic' }] : []),
                    { id: 'tech-stack', label: 'Tech Stack' }
                ]}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                activeColor="border-blue-600 text-blue-600"
            />

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-6 pb-20">
                <div className="max-w-7xl mx-auto">
                    {activeTab === 'me' && <AboutMe user={user} isAuthorized={isAuthorized} />}
                    {activeTab === 'milestones' && <AboutMilestones user={user} isAuthorized={isAuthorized} />}
                    {isAuthorized && activeTab === 'academics' && <AboutAcademics user={user} isAuthorized={isAuthorized} />}
                    {activeTab === 'tech-stack' && <AboutTechStack />}
                </div>
            </div>
        </div>
    );
};
