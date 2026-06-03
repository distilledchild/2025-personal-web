import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { API_URL } from '../../utils/apiConfig';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

interface AboutAcademicData {
    _id?: string;
    education: Array<{
        degree: string;
        institution: string;
        location: string;
        period: string;
        description: string;
        gpa: string;
        order: number;
    }>;
    experience: Array<{
        title: string;
        organization: string;
        location: string;
        period: string;
        description: string;
        responsibilities: string[];
        order: number;
    }>;
    publications: Array<{
        title: string;
        authors: string;
        journal: string;
        year: number;
        volume: string;
        pages: string;
        doi: string;
        pmid: string;
        type: string;
        order: number;
    }>;
    skills: {
        programming: Array<{ name: string; level: string; order: number }>;
        bioinformatics: Array<{ name: string; level: string; order: number }>;
        tools: Array<{ name: string; level: string; order: number }>;
        frameworks: Array<{ name: string; level: string; order: number }>;
    };
    awards: Array<{
        title: string;
        organization: string;
        year: number;
        description: string;
        order: number;
    }>;
    links?: {
        ORCiD: string;
        GoogleScholar: string;
        cv?: string;
    };
}

interface AboutAcademicsProps {
    user: any;
    isAuthorized: boolean;
}

export const AboutAcademics: React.FC<AboutAcademicsProps> = ({ user, isAuthorized }) => {
    const [aboutAcademic, setAboutAcademic] = useState<AboutAcademicData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isIframeLoading, setIsIframeLoading] = useState(true);

    // Academic Links Form
    const [academicLinksForm, setAcademicLinksForm] = useState({
        ORCiD: '',
        GoogleScholar: '',
        cv: ''
    });

    useLockBodyScroll(isModalOpen);

    useEffect(() => {
        fetchAboutAcademic();
    }, []);

    useEffect(() => {
        if (aboutAcademic?.links?.cv) {
            setIsIframeLoading(true);
        }
    }, [aboutAcademic?.links?.cv]);

    const fetchAboutAcademic = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API_URL}/api/about-academic?t=${new Date().getTime()}`);
            if (response.ok) {
                const data = await response.json();
                setAboutAcademic(data);
            }
        } catch (error) {
            console.error('Failed to fetch about academic:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAcademic = async () => {
        if (!user) return;

        try {
            if (!aboutAcademic?._id) {
                alert('No academic data found. Please create initial data first.');
                return;
            }

            const url = `${API_URL}/api/about-academic/${aboutAcademic._id}`;

            console.log('Saving academic links:', {
                ORCiD: academicLinksForm.ORCiD,
                GoogleScholar: academicLinksForm.GoogleScholar,
                cv: academicLinksForm.cv
            });

            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    links: {
                        ORCiD: academicLinksForm.ORCiD,
                        GoogleScholar: academicLinksForm.GoogleScholar,
                        cv: academicLinksForm.cv
                    },
                    email: user.email
                })
            });

            if (response.ok) {
                fetchAboutAcademic();
                closeModal();
            } else {
                const errorData = await response.json();
                alert(`Failed to save: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Failed to save academic:', error);
            alert('Failed to save academic data');
        }
    };

    const openAcademicModal = () => {
        if (aboutAcademic) {
            const { links } = aboutAcademic;

            // Set links form
            setAcademicLinksForm({
                ORCiD: links?.ORCiD || '',
                GoogleScholar: links?.GoogleScholar || '',
                cv: links?.cv || ''
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    // Helper to convert Google Drive share links to preview links
    const getEmbedUrl = (url: string) => {
        if (!url) return '';

        // Handle Google Drive links
        if (url.includes('drive.google.com')) {
            // If it's already a preview link, return it
            if (url.includes('/preview')) return url;

            // Extract ID from share URLs
            // Format 1: /file/d/ID/view
            const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (fileIdMatch && fileIdMatch[1]) {
                return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview?usp=sharing`;
            }
        }

        return url;
    };

    const cvUrl = aboutAcademic?.links?.cv || '';
    const embedUrl = getEmbedUrl(cvUrl);

    return (
        <div className="animate-fadeIn flex flex-col lg:flex-row gap-8 flex-1 min-h-0 relative">
            {/* Left Sidebar - Links Section */}
            <div className="lg:w-64 flex-shrink-0 space-y-3 overflow-y-auto pr-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sticky top-0 bg-white py-2">Links</h3>
                <div className="space-y-3">
                    {/* ORCiD Link */}
                    {aboutAcademic?.links?.ORCiD && (
                        <a
                            href={aboutAcademic.links.ORCiD.startsWith('http') ? aboutAcademic.links.ORCiD : `https://${aboutAcademic.links.ORCiD}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group cursor-pointer transition-all duration-200 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 block"
                        >
                            <p className="text-sm font-medium">
                                <span style={{ color: '#A6A8AB' }}>ORC</span>
                                <span style={{ color: '#A5CD39' }}>iD</span>
                            </p>
                        </a>
                    )}

                    {/* Google Scholar Link */}
                    {aboutAcademic?.links?.GoogleScholar && (
                        <a
                            href={aboutAcademic.links.GoogleScholar.startsWith('http') ? aboutAcademic.links.GoogleScholar : `https://${aboutAcademic.links.GoogleScholar}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group cursor-pointer transition-all duration-200 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 block"
                        >
                            <p className="text-sm font-medium text-slate-600 group-hover:text-blue-600 transition-colors">
                                Google Scholar
                            </p>
                        </a>
                    )}
                </div>
            </div>

            {/* Right Side - CV Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                    <h3 className="text-2xl font-bold text-slate-900 mb-6">Curriculum Vitae</h3>

                    {/* PDF Viewer */}
                    <div className="mb-8">
                        <div className="w-full h-[800px] border border-slate-200 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center relative">
                            {/* Loading State */}
                            {(isLoading || isIframeLoading) && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10 w-full h-full">
                                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                    <p className="text-slate-500 animate-pulse">Loading Document...</p>
                                </div>
                            )}

                            {embedUrl ? (
                                <iframe
                                    src={embedUrl}
                                    className={`w-full h-full transition-opacity duration-500 ${isIframeLoading ? 'opacity-0' : 'opacity-100'}`}
                                    allow="autoplay"
                                    title="Curriculum Vitae PDF"
                                    onLoad={() => setIsIframeLoading(false)}
                                />
                            ) : (
                                !isLoading && (
                                    <div className="text-slate-400 flex flex-col items-center">
                                        <p>CV has not been uploaded yet.</p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Admin Add Button */}
            {isAuthorized && (
                <div className="fixed bottom-24 left-6 z-50">
                    <button
                        onClick={openAcademicModal}
                        className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-600 transition-all hover:scale-110"
                        title="Edit Academic"
                    >
                        <Plus size={28} />
                    </button>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-4xl w-full p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={closeModal}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <h3 className="text-2xl font-bold text-slate-900 mb-6">
                            Edit Academic Data
                        </h3>

                        <div className="space-y-6">
                            {/* Links Manager - User friendly */}
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <h4 className="text-lg font-bold text-slate-800 mb-4">External Links</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">CV Display URL</label>
                                        <input
                                            type="text"
                                            value={academicLinksForm.cv}
                                            onChange={e => setAcademicLinksForm(prev => ({ ...prev, cv: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="https://storage.googleapis.com/.../cv/latest.pdf"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Google Drive share links are converted for embedding; published GCS PDF URLs are used directly.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">ORCiD URL</label>
                                        <input
                                            type="text"
                                            value={academicLinksForm.ORCiD}
                                            onChange={e => setAcademicLinksForm(prev => ({ ...prev, ORCiD: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="https://orcid.org/..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Google Scholar URL</label>
                                        <input
                                            type="text"
                                            value={academicLinksForm.GoogleScholar}
                                            onChange={e => setAcademicLinksForm(prev => ({ ...prev, GoogleScholar: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="https://scholar.google.com/..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleSaveAcademic}
                                    className="px-6 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                    Save Changes
                                </button>
                                <button
                                    onClick={closeModal}
                                    className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
