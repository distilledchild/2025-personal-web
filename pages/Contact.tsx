import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mail, BookOpen } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ContactInfo } from './contact/ContactInfo';
import { Guestbook } from './contact/Guestbook';
import { fetchMemberRole, getStoredUserProfile, subscribeToUserProfileChanges } from '../utils/auth';

export const Contact: React.FC = () => {
    const { tab } = useParams<{ tab?: string }>();
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);

    // Determine active tab from URL, default to 'contactinfo'
    const activeTab = (tab === 'contactinfo' || tab === 'guestbook') ? tab : 'contactinfo';

    const handleTabChange = (newTab: string) => {
        navigate(`/contact/${newTab}`);
    };

    useEffect(() => {
        // Check user auth status
        const checkAuth = async () => {
            const storedUser = getStoredUserProfile<any>();
            if (storedUser) {
                try {
                    setUser(storedUser);

                    // Check authorization from MEMBER collection
                    const data = await fetchMemberRole(storedUser.email);
                    setIsAuthorized(Boolean(data.authorized));
                } catch (err) {
                    console.error('Failed to check authorization:', err);
                    setIsAuthorized(false);
                }
            } else {
                setUser(null);
                setIsAuthorized(false);
            }
        };

        // Initial check
        checkAuth();

        const unsubscribe = subscribeToUserProfileChanges(checkAuth);

        return () => {
            unsubscribe();
        };
    }, []);

    return (
        <div className="flex flex-col h-screen bg-white overflow-hidden">
            <PageHeader
                title="Get in Touch"
                tabs={[
                    { id: 'contactinfo', label: 'Contact Info', icon: Mail },
                    { id: 'guestbook', label: 'Guestbook', icon: BookOpen }
                ]}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                activeColor="border-purple-600 text-purple-600"
            />

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-20">
                <div className="max-w-7xl mx-auto">
                    {activeTab === 'contactinfo' && <ContactInfo user={user} isAuthorized={isAuthorized} />}
                    {activeTab === 'guestbook' && <Guestbook user={user} isAuthorized={isAuthorized} />}
                </div>
            </div>
        </div>
    );
};
