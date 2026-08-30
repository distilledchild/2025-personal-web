import { Github, Mail, MapPin, Plus, X } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { API_URL } from '../../utils/apiConfig';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

interface ContactInfoProps {
    user: any;
    isAuthorized: boolean;
}

export const ContactInfo: React.FC<ContactInfoProps> = ({ user, isAuthorized }) => {
    const [showCopied, setShowCopied] = useState(false);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [contactInfo, setContactInfo] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [stateSuggestions, setStateSuggestions] = useState<string[]>([]);
    const [formData, setFormData] = useState({
        Email: '',
        GitHub: '',
        LinkedIn: '',
        city: '',
        state: '',
        country: ''
    });

    useEffect(() => {
        fetchContactInfo();
    }, []);

    const fetchContactInfo = async () => {
        try {
            const response = await fetch(`${API_URL}/api/contact`);
            if (response.ok) {
                const data = await response.json();
                setContactInfo(data);
            }
        } catch (error) {
            console.error('Failed to fetch contact info:', error);
        }
    };

    const handleCopy = (e: React.MouseEvent) => {
        setCursorPos({ x: e.clientX, y: e.clientY });
        navigator.clipboard.writeText(contactInfo?.Email || 'distilledchild@gmail.com');
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    const openModal = () => {
        if (contactInfo) {
            setFormData({
                Email: contactInfo.Email || '',
                GitHub: contactInfo.GitHub || '',
                LinkedIn: contactInfo.LinkedIn || '',
                city: contactInfo.Location?.city || '',
                state: contactInfo.Location?.state || '',
                country: contactInfo.Location?.country || ''
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setStateSuggestions([]);
    };

    // Lock body scroll when modal is open
    useLockBodyScroll(isModalOpen);

    // Geocode location to get coordinates
    const geocodeLocation = async (city: string, state: string, country: string): Promise<{ lat: number; lon: number } | null> => {
        try {
            const parts = [city, state, country].filter(Boolean);
            if (parts.length === 0) return null;

            const searchQuery = parts.join(', ');
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
                {
                    headers: {
                        'User-Agent': 'PersonalWebsite/1.0'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    return {
                        lat: parseFloat(data[0].lat),
                        lon: parseFloat(data[0].lon)
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('Geocoding error:', error);
            return null;
        }
    };

    const handleSave = async () => {
        if (!user) return;

        try {
            let finalLatitude = undefined;
            let finalLongitude = undefined;

            if (formData.city || formData.state || formData.country) {
                console.log('Geocoding location...', { city: formData.city, state: formData.state, country: formData.country });
                const coords = await geocodeLocation(formData.city, formData.state, formData.country);

                if (coords) {
                    finalLatitude = coords.lat;
                    finalLongitude = coords.lon;
                    console.log('Geocoded coordinates:', coords);
                } else {
                    console.log('Geocoding failed, coordinates will not be saved');
                }
            }

            const payload = {
                Email: formData.Email,
                GitHub: formData.GitHub,
                LinkedIn: formData.LinkedIn,
                Location: {
                    city: formData.city,
                    state: formData.state,
                    country: formData.country,
                    latitude: finalLatitude,
                    longitude: finalLongitude
                },
                userEmail: user.email
            };

            let response;
            if (contactInfo && contactInfo._id) {
                // Update existing
                response = await fetch(`${API_URL}/api/contact/${contactInfo._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // Create new
                response = await fetch(`${API_URL}/api/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            if (response.ok) {
                fetchContactInfo();
                closeModal();
            }
        } catch (error) {
            console.error('Failed to update contact:', error);
        }
    };

    // US States list for autocomplete
    const US_STATES = [
        'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
        'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
        'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
        'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
        'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
        'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
        'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
    ];

    const getMapUrl = () => {
        const location = contactInfo?.Location;
        if (!location) return '';

        if (location.latitude && location.longitude) {
            return `https://maps.google.com/maps?q=${location.latitude},${location.longitude}&z=12&output=embed`;
        }

        const address = [location.city, location.state, location.country].filter(Boolean).join(', ');
        return address ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=12&output=embed` : '';
    };

    const getLocationText = () => {
        const location = contactInfo?.Location;
        const address = [location?.city, location?.state, location?.country].filter(Boolean).join(', ');
        return address || 'Location not set';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleSave();
    };

    return (
        <div className="animate-fadeIn relative">
            {/* Notification Toast */}
            {showCopied && (
                <div
                    className="fixed z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg animate-fadeIn flex items-center gap-2 pointer-events-none"
                    style={{
                        left: cursorPos.x + 16,
                        top: cursorPos.y - 16
                    }}
                >
                    <span>✨ Email copied to clipboard!</span>
                </div>
            )}

            {/* Edit Button - Only for authorized users */}
            {isAuthorized && (
                <div className="fixed bottom-24 left-6 z-50">
                    <button
                        onClick={openModal}
                        className="w-14 h-14 bg-purple-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-purple-600 transition-all hover:scale-110"
                        title="Edit Contact Info"
                    >
                        <Plus size={28} />
                    </button>
                </div>
            )}

            <div className={`w-full mx-auto py-8 lg:py-12 ${isAuthorized ? 'grid grid-cols-1 lg:grid-cols-2 gap-8' : 'max-w-2xl'}`}>
                <div className="space-y-6">
                    <button
                        onClick={handleCopy}
                        className="w-full flex items-center p-6 bg-slate-50 rounded-2xl hover:bg-purple-50 transition-colors group border border-slate-100 hover:border-purple-100 cursor-pointer text-left"
                    >
                        <div className="bg-white p-4 rounded-full shadow-sm text-black group-hover:text-[#9332EA] transition-colors">
                            <Mail size={32} />
                        </div>
                        <div className="ml-6 text-left">
                            <p className="text-sm text-slate-500 group-hover:text-purple-600 uppercase font-bold tracking-wider mb-1 transition-colors">Email</p>
                            <p className="text-xl text-slate-900 font-medium break-all">{contactInfo?.Email || 'Loading...'}</p>
                        </div>
                    </button>

                    <a
                        href={contactInfo?.GitHub ? `https://${contactInfo.GitHub}` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center p-6 bg-slate-50 rounded-2xl hover:bg-purple-50 transition-colors group border border-slate-100 hover:border-purple-100 cursor-pointer text-left"
                    >
                        <div className="bg-white p-4 rounded-full shadow-sm text-black group-hover:text-black transition-colors">
                            <Github size={32} />
                        </div>
                        <div className="ml-6 text-left">
                            <p className="text-sm text-slate-500 group-hover:text-purple-600 uppercase font-bold tracking-wider mb-1 transition-colors">GitHub</p>
                            <p className="text-xl text-slate-900 font-medium break-all">{contactInfo?.GitHub?.replace('https://github.com/', '') || 'Loading...'}</p>
                        </div>
                    </a>

                    {isAuthorized && (
                        <a
                            href={contactInfo?.LinkedIn ? `https://${contactInfo.LinkedIn}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center p-6 bg-slate-50 rounded-2xl hover:bg-purple-50 transition-colors group border border-slate-100 hover:border-purple-100 cursor-pointer text-left"
                        >
                            <div className="bg-white p-4 rounded-full shadow-sm text-black group-hover:text-[#2362BC] transition-colors">
                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                </svg>
                            </div>
                            <div className="ml-6 text-left">
                                <p className="text-sm text-slate-500 group-hover:text-purple-600 uppercase font-bold tracking-wider mb-1 transition-colors">LinkedIn</p>
                                <p className="text-xl text-slate-900 font-medium break-all">{contactInfo?.LinkedIn?.replace('https://linkedin.com/in/', '') || 'Loading...'}</p>
                            </div>
                        </a>
                    )}

                    {isAuthorized && (
                        <div className="w-full flex items-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="bg-white p-4 rounded-full shadow-sm text-black">
                                <MapPin size={32} />
                            </div>
                            <div className="ml-6 flex-1">
                                <p className="text-sm text-slate-500 uppercase font-bold tracking-wider mb-1">Located In</p>
                                <p className="text-xl text-slate-900 font-medium">{getLocationText()}</p>
                            </div>
                        </div>
                    )}
                </div>

                {isAuthorized && (
                    <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 h-[400px] lg:h-auto min-h-[400px]">
                        {getMapUrl() ? (
                            <iframe
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                scrolling="no"
                                marginHeight={0}
                                marginWidth={0}
                                src={getMapUrl()}
                                title="Location Map"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                Location not set
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fadeIn">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal}></div>
                    <div className="relative bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl animate-scaleIn overflow-y-auto max-h-[90vh]">
                        <button
                            onClick={closeModal}
                            className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 transition-colors"
                            aria-label="Close modal"
                        >
                            <X size={24} className="text-slate-500" />
                        </button>

                        <h3 className="text-2xl font-bold text-slate-900 mb-6">Update Contact Info</h3>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Email Address</label>
                                    <input
                                        type="email"
                                        value={formData.Email}
                                        onChange={(e) => setFormData({ ...formData, Email: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                        placeholder="your@email.com"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">GitHub URL</label>
                                    <input
                                        type="url"
                                        value={formData.GitHub}
                                        onChange={(e) => setFormData({ ...formData, GitHub: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                        placeholder="https://github.com/username"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">LinkedIn URL</label>
                                    <input
                                        type="url"
                                        value={formData.LinkedIn}
                                        onChange={(e) => setFormData({ ...formData, LinkedIn: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                        placeholder="https://linkedin.com/in/username"
                                    />
                                </div>

                                <div className="space-y-2 relative">
                                    <label className="text-sm font-bold text-slate-700">State</label>
                                    <input
                                        type="text"
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                        placeholder="State/Region"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">City</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                        placeholder="City"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Country</label>
                                    <input
                                        type="text"
                                        value={formData.country}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                        placeholder="Country"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-3 rounded-xl font-bold bg-purple-500 text-white hover:bg-purple-600 transition-colors shadow-lg hover:shadow-xl"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
