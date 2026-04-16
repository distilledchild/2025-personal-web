import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plane, Dumbbell, BarChart3, ChevronLeft, ChevronRight, PersonStanding, Footprints, Bike, Palette, MapPin, X } from 'lucide-react';
import { ComposableMap, Geographies, Geography, Marker, Annotation } from 'react-simple-maps';
import { geoCentroid, geoAlbersUsa } from 'd3-geo';
import { API_URL } from '../utils/apiConfig';
import { fetchMemberRole, getStoredUserProfile, subscribeToUserProfileChanges } from '../utils/auth';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Cell
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import MarketCommodities from '../components/MarketCommodities';

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// Mock Data for Visualizations (Topic 4)
const mockInteractionData = Array.from({ length: 50 }, (_, i) => ({
    pos: i * 1000,
    enhancer: Math.abs(Math.sin(i * 0.1) * 100) + Math.random() * 20,
    interaction: Math.abs(Math.cos(i * 0.1) * 0.8) + Math.random() * 0.1,
    ctcf: Math.random() > 0.8 ? 1 : 0
}));

// Art museums interface and data
interface ArtMuseum {
    _id?: string;
    id: number;
    city: string;
    city_name?: string;
    museum_code: string;
    museum_name: string;
    state: string;
    coordinates?: [number, number];
    fips_code?: string;
    artworks?: string[];
}

// State info interface and data
interface StateInfo {
    code: string;
    name: string;
    status: 'NOT_VISITED' | 'VISITED' | 'STAYED';
    fips_code: string;
}

// Strava activity interface and data
interface StravaActivity {
    id: number;
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    total_elevation_gain: number;
    type: string;
    sport_type: string;
    start_date: string;
    average_speed: number;
    max_speed: number;
}

interface MonthlyStats {
    walk: { distance: number; count: number };
    bike: { distance: number; count: number };
    run: { distance: number; count: number };
}




// Helper function to calculate monthly statistics
const calculateMonthlyStats = (activities: StravaActivity[]): MonthlyStats => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const stats: MonthlyStats = {
        walk: { distance: 0, count: 0 },
        bike: { distance: 0, count: 0 },
        run: { distance: 0, count: 0 }
    };

    activities.forEach(activity => {
        const activityDate = new Date(activity.start_date);
        if (activityDate.getMonth() === currentMonth && activityDate.getFullYear() === currentYear) {
            const sportType = activity.sport_type.toLowerCase();
            if (sportType === 'walk') {
                stats.walk.distance += activity.distance / 1000; // Convert to km
                stats.walk.count += 1;
            } else if (sportType === 'ride' || sportType === 'bike' || sportType === 'virtualride') {
                stats.bike.distance += activity.distance / 1000;
                stats.bike.count += 1;
            } else if (sportType === 'run' || sportType === 'running') {
                stats.run.distance += activity.distance / 1000;
                stats.run.count += 1;
            }
        }
    });

    return stats;
};

// Helper function to get workout days in current month
const getWorkoutDays = (activities: StravaActivity[]): Set<number> => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const workoutDays = new Set<number>();

    activities.forEach(activity => {
        const activityDate = new Date(activity.start_date);
        if (activityDate.getMonth() === currentMonth && activityDate.getFullYear() === currentYear) {
            workoutDays.add(activityDate.getDate());
        }
    });

    return workoutDays;
};

// Helper function to generate calendar days
const generateCalendarDays = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Get first day of month (0 = Sunday, 1 = Monday, etc.)
    const firstDay = new Date(year, month, 1).getDay();
    // Adjust so Monday = 0 (subtract 1, and handle Sunday)
    const firstDayAdjusted = firstDay === 0 ? 6 : firstDay - 1;

    // Get total days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (number | null)[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayAdjusted; i++) {
        days.push(null);
    }

    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    return days;
};

export const Interests: React.FC<{ isAuthorized: boolean }> = ({ isAuthorized }) => {
    const { submenu, subId } = useParams<{ submenu?: string; subId?: string }>();
    const navigate = useNavigate();

    // Determine active tab from URL, default to 'travel'
    const activeTab = (submenu as 'travel' | 'workout' | 'art' | 'data') || 'travel';

    useEffect(() => {
        if (activeTab === 'data' && !subId) {
            navigate('/interests/data/1', { replace: true });
        }
    }, [activeTab, subId, navigate]);

    const projection = useMemo(() => {
        return geoAlbersUsa()
            .scale(1000)
            .translate([400, 300]);
    }, []);

    const [hoveredState, setHoveredState] = useState<string | null>(null);
    const [expandedState, setExpandedState] = useState<string | null>(null);
    const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
    const [expandedCentroid, setExpandedCentroid] = useState<{ x: number, y: number } | null>(null);
    const [hoveredPin, setHoveredPin] = useState<string | null>(null);
    const [selectedMuseum, setSelectedMuseum] = useState<ArtMuseum | null>(null);
    const [selectedArtwork, setSelectedArtwork] = useState<string | null>(null);
    const [stateData, setStateData] = useState<StateInfo[]>([]);
    const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
    const [loadingStrava, setLoadingStrava] = useState(false);
    const [currentMonthName, setCurrentMonthName] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const [artMuseums, setArtMuseums] = useState<ArtMuseum[]>([]);
    const [loadingArtworks, setLoadingArtworks] = useState(false);
    const [isAdminUser, setIsAdminUser] = useState(false);

    useEffect(() => {
        const fetchAdminRole = async () => {
            try {
                const stored = getStoredUserProfile<any>();
                if (!stored) {
                    setIsAdminUser(false);
                    return;
                }

                const email = stored?.email;
                if (!email) {
                    setIsAdminUser(false);
                    return;
                }

                const roleData = await fetchMemberRole(email);
                setIsAdminUser(String(roleData?.role || '').toUpperCase() === 'ADMIN');
            } catch (error) {
                console.error('Failed to fetch admin role:', error);
                setIsAdminUser(false);
            }
        };

        fetchAdminRole();
        const unsubscribe = subscribeToUserProfileChanges(fetchAdminRole);

        return () => {
            unsubscribe();
        };
    }, [isAuthorized]);

    useEffect(() => {
        if (activeTab === 'art') {
            // Reset expanded state when entering Art submenu
            setExpandedState(null);
            setClickPosition(null);
            setExpandedCentroid(null);
            setHoveredState(null);
            setSelectedMuseum(null);
            setSelectedArtwork(null);

            fetch(`${API_URL}/api/interests/art-museums`)
                .then(res => res.json())
                .then(data => setArtMuseums(data))
                .catch(err => console.error('Failed to fetch art museums:', err));
        }
    }, [activeTab]);



    const handleStravaAuth = async () => {
        try {
            const response = await fetch(`${API_URL}/api/strava/auth`);
            const data = await response.json();

            // Redirect to Strava authorization page
            window.location.href = data.authUrl;
        } catch (error) {
            console.error('Failed to initiate Strava auth:', error);
        }
    };


    // Handler for museum pin click - loads artworks lazily
    const handleMuseumClick = async (museum: ArtMuseum) => {
        // Set the museum first to show the modal immediately
        setSelectedMuseum(museum);

        // If artworks not yet loaded, fetch them
        if (!museum.artworks || museum.artworks.length === 0) {
            setLoadingArtworks(true);
            try {
                const response = await fetch(`${API_URL}/api/interests/art-museums/${museum.museum_code}/artworks`);
                if (response.ok) {
                    const data = await response.json();
                    // Update the museum with loaded artworks
                    const updatedMuseum = { ...museum, artworks: data.artworks };
                    setSelectedMuseum(updatedMuseum);
                    // Also update in artMuseums state for caching
                    setArtMuseums(prev => prev.map(m =>
                        m.museum_code === museum.museum_code ? updatedMuseum : m
                    ));
                }
            } catch (error) {
                console.error('Failed to fetch artworks:', error);
            } finally {
                setLoadingArtworks(false);
            }
        }
    };

    useEffect(() => {
        const fetchStates = async () => {
            try {
                const response = await fetch(`${API_URL}/api/travel/states`);
                if (response.ok) {
                    const data = await response.json();
                    // alert("It's frontend:::::::::::::::: DEBUG " + JSON.stringify(data, null, 2));
                    setStateData(data);
                }
            } catch (error) {
                console.error('Failed to fetch state data:', error);
            }
        };

        const loadStravaActivities = async () => {
            setLoadingStrava(true);
            try {
                // Try fetching from database first
                const response = await fetch(`${API_URL}/api/workouts`);
                if (response.ok) {
                    const data = await response.json();
                    // Map DB activity_id to id for frontend compatibility and sort by date (newest first)
                    const activities = data
                        .map((activity: any) => ({
                            ...activity,
                            id: activity.activity_id || activity.id
                        }))
                        .sort((a: any, b: any) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
                    setStravaActivities(activities);
                    console.log(`[WORKOUT] Loaded ${activities.length} activities from DB`);
                } else {
                    // Fallback to localStorage if API fails
                    console.warn('Failed to fetch from DB, checking localStorage');
                    if (typeof window !== 'undefined' && window.localStorage) {
                        const storedActivities = localStorage.getItem('strava_activities');
                        if (storedActivities) {
                            setStravaActivities(JSON.parse(storedActivities));
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load Strava activities:', error);
                // Fallback to localStorage
                if (typeof window !== 'undefined' && window.localStorage) {
                    const storedActivities = localStorage.getItem('strava_activities');
                    if (storedActivities) {
                        setStravaActivities(JSON.parse(storedActivities));
                    }
                }
            } finally {
                setLoadingStrava(false);
            }
        };

        if (activeTab === 'travel' || activeTab === 'art') {
            fetchStates();
        } else if (activeTab === 'workout') {
            loadStravaActivities();
        }
    }, [activeTab]);

    // test for fetching data from backend
    // useEffect(() => {
    //     if (activeTab === 'travel' && stateData.length > 0) {
    //         const stayedStates = stateData.filter(s => s.status === 'STAYED');
    //         // alert("It's here " + JSON.stringify(stayedStates, null, 2));
    //         // const fipsCodes = stayedStates.map(s => s.fips_code).filter(Boolean);
    //         // if (fipsCodes.length > 0) {
    //         //     alert(`FIPS codes for 'STAYED' states: ${fipsCodes.join(', ')}`);
    //         // } else {
    //         //     alert("No 'STAYED' states found in the data.");
    //         // }
    //     }
    // }, [stateData, activeTab]);

    // Calculate monthly stats
    const monthlyStats = calculateMonthlyStats(stravaActivities);
    const workoutDays = getWorkoutDays(stravaActivities);
    const calendarDays = generateCalendarDays();
    const today = new Date().getDate();

    const chartData = [
        { name: 'Walk', distance: monthlyStats.walk.distance, fill: 'url(#walkGradient)' },
        { name: 'Run', distance: monthlyStats.run.distance, fill: 'url(#runGradient)' },
        { name: 'Bike', distance: monthlyStats.bike.distance, fill: 'url(#bikeGradient)' }
    ];

    // Pagination logic
    const totalPages = Math.ceil(stravaActivities.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentActivities = stravaActivities.slice(startIndex, endIndex);

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    // Removed unused mapHandler and statesCustomConfig

    // Removed unused tooltip handlers

    return (
        <div className="flex flex-col h-screen bg-white overflow-hidden">
            {/* Fixed Header Section */}
            <PageHeader
                title="Topics"
                tabs={[
                    { id: 'data', label: 'Data', icon: BarChart3 },
                    { id: 'art', label: 'Art', icon: Palette },
                    { id: 'workout', label: 'Workout', icon: Dumbbell },
                    { id: 'travel', label: 'Travel', icon: Plane }
                ]}
                activeTab={activeTab}
                onTabChange={(id) => navigate(`/interests/${id}`)}
                activeColor="border-[#FFA300] text-[#FFA300]"
            />

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-20">
                <div className="max-w-7xl mx-auto">
                    {activeTab === 'travel' && (
                        <div className="animate-fadeIn space-y-8">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Travel Map</h3>
                                    <p className="text-slate-500 text-lg">Conquer the map, one color at a time</p>
                                </div>
                            </div>

                            <div className="w-full flex flex-col md:flex-row items-start justify-center bg-slate-50 rounded-2xl border border-slate-100 p-8 overflow-hidden relative gap-8">
                                <div className="flex-1 w-full max-w-4xl h-[600px]">
                                    <ComposableMap projection="geoAlbersUsa">
                                        <Geographies geography={geoUrl}>
                                            {({ geographies }) => {
                                                if (!geographies) return null;
                                                return (
                                                    <>
                                                        {geographies.map(geo => {
                                                            const stateInfo = stateData.find(s => s.fips_code === geo.id);
                                                            let fillColor = "#FFFFFF";
                                                            if (stateInfo?.status === 'STAYED') fillColor = "#FFA300";
                                                            else if (stateInfo?.status === 'VISITED') fillColor = "#FFCC80";

                                                            return (
                                                                <Geography
                                                                    key={geo.rsmKey}
                                                                    geography={geo}
                                                                    fill={fillColor}
                                                                    stroke="#CBD5E1"
                                                                    strokeWidth={0.5}
                                                                    style={{
                                                                        default: { outline: "none" },
                                                                        hover: { outline: "none" },
                                                                        pressed: { outline: "none" }
                                                                    }}
                                                                />
                                                            );
                                                        })}
                                                        {geographies.map(geo => {
                                                            const stateInfo = stateData.find(s => s.fips_code === geo.id);
                                                            const cur = stateInfo?.code;
                                                            if (!cur) return null;

                                                            const centroid = geoCentroid(geo);
                                                            const smallStates = ["RI", "DE", "VT", "NH", "MA", "CT", "NJ", "MD", "DC"];

                                                            // Offsets for small states (approximate)
                                                            const offsets: { [key: string]: [number, number] } = {
                                                                "RI": [30, 0], "DE": [30, 0], "VT": [-10, -40], "NH": [20, 0],
                                                                "MA": [30, -5], "CT": [30, 10], "NJ": [30, 0], "MD": [30, 10], "DC": [30, 20]
                                                            };

                                                            if (smallStates.includes(cur)) {
                                                                return (
                                                                    <Annotation
                                                                        key={geo.rsmKey + "-anno"}
                                                                        subject={centroid}
                                                                        dx={offsets[cur][0]}
                                                                        dy={offsets[cur][1]}
                                                                        connectorProps={{
                                                                            stroke: "#64748B",
                                                                            strokeWidth: 1,
                                                                            strokeLinecap: "round"
                                                                        }}
                                                                    >
                                                                        <text x="4" fontSize={10} alignmentBaseline="middle" fill="#64748B" fontWeight="500">
                                                                            {cur}
                                                                        </text>
                                                                    </Annotation>
                                                                );
                                                            } else {
                                                                return (
                                                                    <Marker key={geo.rsmKey + "-marker"} coordinates={centroid}>
                                                                        <text y="2" fontSize={10} textAnchor="middle" fill="#64748B" fontWeight="500">
                                                                            {cur}
                                                                        </text>
                                                                    </Marker>
                                                                );
                                                            }
                                                        })}
                                                    </>
                                                );
                                            }}
                                        </Geographies>
                                    </ComposableMap>
                                </div>

                                {/* Legend - Right Side */}
                                <div className="flex flex-col gap-4 min-w-[120px] pt-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-[#FFA300] border border-slate-200"></div>
                                        <span className="text-slate-600 font-medium">Stayed</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-[#FFCC80] border border-slate-200"></div>
                                        <span className="text-slate-600 font-medium">Visited</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'workout' && (
                        <div className="animate-fadeIn space-y-8">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Workout Activities</h3>
                                    <p className="text-slate-500 text-lg">My workout activities from Strava</p>
                                </div>
                                {/* Show Strava sync button only for logged-in ADMIN users (including production) */}
                                {isAuthorized && isAdminUser && (
                                    <button
                                        onClick={handleStravaAuth}
                                        className="px-6 py-3 bg-gradient-to-r from-[#FFA300] to-[#FF8C00] text-white font-bold rounded-xl hover:from-[#FF8C00] hover:to-[#FF7700] transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                                    >
                                        Sync from Strava
                                    </button>
                                )}
                            </div>

                            {loadingStrava ? (
                                <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                                    <Dumbbell size={48} className="mx-auto mb-4 opacity-50 animate-pulse" />
                                    <p>Loading activities...</p>
                                </div>
                            ) : stravaActivities.length > 0 ? (
                                <>
                                    {/* Statistics Section */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Bar Chart - Monthly Distance */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                            <h4 className="text-lg font-bold text-slate-900 mb-4">This Month's Distance (km)</h4>
                                            <ResponsiveContainer width="100%" height={250}>
                                                <BarChart data={chartData}>
                                                    <defs>
                                                        <linearGradient id="walkGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#FFCC80" stopOpacity={1} />
                                                            <stop offset="100%" stopColor="#FFB84D" stopOpacity={1} />
                                                        </linearGradient>
                                                        <linearGradient id="runGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#FFA300" stopOpacity={1} />
                                                            <stop offset="100%" stopColor="#FF8C00" stopOpacity={1} />
                                                        </linearGradient>
                                                        <linearGradient id="bikeGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#FF8C00" stopOpacity={1} />
                                                            <stop offset="100%" stopColor="#FF7700" stopOpacity={1} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                    />
                                                    <Bar dataKey="distance" radius={[8, 8, 0, 0]}>
                                                        {chartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Monthly Calendar */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                            <h4 className="text-lg font-bold text-slate-900 mb-4">
                                                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                            </h4>
                                            <div className="grid grid-cols-7 gap-1">
                                                {/* Day headers */}
                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                                    <div key={day} className="text-center text-xs font-bold text-slate-600 py-1">
                                                        {day}
                                                    </div>
                                                ))}
                                                {/* Calendar days */}
                                                {calendarDays.map((day, index) => (
                                                    <div
                                                        key={index}
                                                        className={`
                                                            aspect-square flex items-center justify-center text-sm rounded-lg
                                                            ${day === null ? '' :
                                                                workoutDays.has(day) ? 'text-white font-bold' :
                                                                    day > today ? 'text-slate-400' :
                                                                        'text-black'}
                                                        `}
                                                        style={
                                                            day !== null && workoutDays.has(day)
                                                                ? { background: 'linear-gradient(135deg, #FFCC80 0%, #FFA300 50%, #FF6600 100%)' }
                                                                : {}
                                                        }
                                                    >
                                                        {day}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Activity Counters */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                            <h4 className="text-lg font-bold text-slate-900 mb-4">
                                                Activity Count ({new Date().toLocaleDateString('en-US', { month: 'long' })})
                                            </h4>
                                            <div className="grid grid-cols-3 gap-4">
                                                {/* Walk Counter */}
                                                <div className="flex flex-col items-center">
                                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFCC80] to-[#FFB84D] flex items-center justify-center shadow-lg">
                                                        <span className="text-2xl font-bold text-white">{monthlyStats.walk.count}</span>
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-600 mt-2">Walk</span>
                                                </div>

                                                {/* Run Counter */}
                                                <div className="flex flex-col items-center">
                                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFA300] to-[#FF8C00] flex items-center justify-center shadow-lg">
                                                        <span className="text-2xl font-bold text-white">{monthlyStats.run.count}</span>
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-600 mt-2">Run</span>
                                                </div>

                                                {/* Bike Counter */}
                                                <div className="flex flex-col items-center">
                                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF8C00] to-[#FF7700] flex items-center justify-center shadow-lg">
                                                        <span className="text-2xl font-bold text-white">{monthlyStats.bike.count}</span>
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-600 mt-2">Bike</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Activity Table with Pagination */}
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full table-fixed">
                                                <thead className="bg-gradient-to-r from-orange-50 to-slate-50">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-slate-200">Date</th>
                                                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-slate-200">Activity Name</th>
                                                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-slate-200">Type</th>
                                                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-slate-200">Distance</th>
                                                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-slate-200">Time</th>
                                                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-slate-200">Elevation</th>
                                                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-slate-200">Avg Speed</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentActivities.map((activity, index) => (
                                                        <tr
                                                            key={activity.id}
                                                            className={`hover:bg-orange-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                                                        >
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">
                                                                {new Date(activity.start_date).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric'
                                                                })}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm font-medium text-slate-900 border-b border-slate-100">
                                                                {activity.name}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">
                                                                {activity.sport_type.toLowerCase() === 'walk' ? (
                                                                    <PersonStanding size={24} className="text-[#FFCC80]" />
                                                                ) : activity.sport_type.toLowerCase().includes('ride') || activity.sport_type.toLowerCase() === 'bike' || activity.sport_type.toLowerCase() === 'virtualride' ? (
                                                                    <Bike size={24} className="text-[#FF7700]" />
                                                                ) : activity.sport_type.toLowerCase() === 'run' || activity.sport_type.toLowerCase() === 'running' ? (
                                                                    <Footprints size={24} className="text-[#FFA300]" />
                                                                ) : (
                                                                    <span className="text-xs text-gray-600">{activity.sport_type}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">
                                                                {(activity.distance / 1000).toFixed(2)} km
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">
                                                                {Math.floor(activity.moving_time / 3600)}h {Math.floor((activity.moving_time % 3600) / 60)}m
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">
                                                                {activity.total_elevation_gain.toFixed(0)} m
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">
                                                                {(activity.average_speed * 3.6).toFixed(1)} km/h
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {/* Fill empty rows to maintain 5-row height */}
                                                    {Array.from({ length: Math.max(0, itemsPerPage - currentActivities.length) }).map((_, index) => (
                                                        <tr
                                                            key={`empty-${index}`}
                                                            className={`${(currentActivities.length + index) % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                                                        >
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">&nbsp;</td>
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">&nbsp;</td>
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">&nbsp;</td>
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">&nbsp;</td>
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">&nbsp;</td>
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">&nbsp;</td>
                                                            <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">&nbsp;</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                    </div>

                                    {/* Pagination Controls - Detached */}
                                    <div className="mt-8">
                                        <Pagination
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            onPageChange={setCurrentPage}
                                            theme="orange"
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                                    <Dumbbell size={48} className="mx-auto mb-4 opacity-50" />
                                    <p className="mb-4">No activities found</p>
                                    <p className="text-sm">
                                        {isAuthorized && isAdminUser
                                            ? 'Click "Sync from Strava" to authorize and load your activities'
                                            : 'No synced Strava activities are available yet.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'art' && (
                        <div className="animate-fadeIn space-y-8">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Art Museums</h3>
                                    <p className="text-slate-500 text-lg flex items-center gap-1">
                                        Explore art collections across the United States (Click
                                        <svg viewBox="0 0 24 24" className="w-6 h-6 inline-block mx-0.5">
                                            <path
                                                d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.12 8.5 15.5 8.5 15.5s8.5-9.38 8.5-15.5C20.5 3.81 16.69 0 12 0zm0 11.75c-1.79 0-3.25-1.46-3.25-3.25S10.21 5.25 12 5.25s3.25 1.46 3.25 3.25-1.46 3.25-3.25 3.25z"
                                                fill="#DC2626"
                                                stroke="#FFFFFF"
                                                strokeWidth="1"
                                            />
                                        </svg>
                                        to view artworks)
                                    </p>
                                </div>
                            </div>

                            <div className="w-full flex flex-col md:flex-row items-start justify-center bg-slate-50 rounded-2xl border border-slate-100 p-8 overflow-visible relative gap-8" onClick={(e) => {
                                if (expandedState) {
                                    // Get mouse position and find if it's over a state with museums
                                    const target = e.target as Element;
                                    const geography = target.closest('[data-state-code]');

                                    if (geography) {
                                        const stateCode = geography.getAttribute('data-state-code');
                                        const hasMuseum = stateCode && artMuseums.some(m => m.state === stateCode);

                                        if (hasMuseum && stateCode) {
                                            setHoveredState(stateCode);
                                        } else {
                                            setHoveredState(null);
                                        }
                                    } else {
                                        setHoveredState(null);
                                    }

                                    setExpandedState(null);
                                    setClickPosition(null);
                                    setExpandedCentroid(null);
                                }
                            }}>
                                <div className="flex-1 w-full max-w-4xl h-[600px] overflow-visible">
                                    <ComposableMap
                                        projection="geoAlbersUsa"
                                        style={{ overflow: 'visible' }}
                                        onClick={() => {
                                            if (expandedState) {
                                                setExpandedState(null);
                                                setClickPosition(null);
                                                setHoveredState(null);
                                            }
                                        }}
                                    >
                                        <defs>
                                            <filter id="state-shadow" x="-50%" y="-50%" width="200%" height="200%">
                                                <feDropShadow dx="0" dy="0" stdDeviation="15" floodOpacity="0.5" />
                                            </filter>
                                        </defs>
                                        <Geographies geography={geoUrl}>
                                            {({ geographies }) => {
                                                const activeStateId = expandedState || hoveredState;
                                                const activeGeo = geographies.find(geo => {
                                                    const hasMuseum = artMuseums.some(m => m.fips_code === geo.id);
                                                    return hasMuseum && artMuseums.find(m => m.fips_code === geo.id)?.state === activeStateId;
                                                });
                                                const otherGeos = geographies.filter(geo => geo !== activeGeo);

                                                return (
                                                    <>
                                                        {/* Background layer: all non-active states */}
                                                        {otherGeos.map(geo => {
                                                            const hasMuseum = artMuseums.some(m => m.fips_code === geo.id);
                                                            const museum = artMuseums.find(m => m.fips_code === geo.id);
                                                            const stateCode = museum?.state;
                                                            const isHovered = hoveredState === stateCode && !expandedState;

                                                            return (
                                                                <Geography
                                                                    key={geo.rsmKey}
                                                                    geography={geo}
                                                                    fill={hasMuseum ? (isHovered ? "#FFA300" : "#FFCC80") : "#FFFFFF"}
                                                                    stroke="#CBD5E1"
                                                                    strokeWidth={0.5}
                                                                    data-state-code={stateCode || ''}
                                                                    onMouseEnter={() => {
                                                                        if (hasMuseum && !expandedState && stateCode) {
                                                                            setHoveredState(stateCode);
                                                                        }
                                                                    }}
                                                                    onMouseLeave={() => {
                                                                        if (!expandedState) setHoveredState(null);
                                                                    }}
                                                                    onClick={(e) => {
                                                                        if (hasMuseum && !expandedState && stateCode) {
                                                                            e.stopPropagation();
                                                                            const svg = e.currentTarget.ownerSVGElement;
                                                                            if (svg) {
                                                                                const pt = svg.createSVGPoint();
                                                                                pt.x = e.clientX;
                                                                                pt.y = e.clientY;
                                                                                const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
                                                                                setClickPosition({ x: svgP.x, y: svgP.y });
                                                                            }
                                                                            setExpandedState(stateCode);

                                                                            const centroid = geoCentroid(geo);
                                                                            const projCentroid = projection(centroid);
                                                                            if (projCentroid) {
                                                                                setExpandedCentroid({ x: projCentroid[0], y: projCentroid[1] });
                                                                            }
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        default: {
                                                                            outline: "none",
                                                                            filter: isHovered ? "url(#state-shadow)" : "none",
                                                                            transition: "fill 0.5s ease",
                                                                            cursor: hasMuseum ? "pointer" : "default"
                                                                        },
                                                                        hover: {
                                                                            outline: "none",
                                                                            filter: hasMuseum && !expandedState ? "url(#state-shadow)" : "none",
                                                                            transition: "fill 0.5s ease",
                                                                            cursor: hasMuseum ? "pointer" : "default"
                                                                        },
                                                                        pressed: { outline: "none" }
                                                                    }}
                                                                />
                                                            );
                                                        })}

                                                        {/* Foreground layer: active/expanded state */}
                                                        {activeGeo && (() => {
                                                            const museum = artMuseums.find(m => m.fips_code === activeGeo.id);
                                                            const stateCode = museum?.state;
                                                            const stateMuseums = artMuseums.filter(m => m.state === stateCode);
                                                            const isExpanded = expandedState === stateCode;
                                                            const isHovered = hoveredState === stateCode && !expandedState;

                                                            // Use stored expandedCentroid if available (for consistency), otherwise calculate
                                                            let cx = 0, cy = 0;
                                                            if (isExpanded && expandedCentroid) {
                                                                cx = expandedCentroid.x;
                                                                cy = expandedCentroid.y;
                                                            } else {
                                                                const centroid = geoCentroid(activeGeo);
                                                                const proj = projection(centroid);
                                                                if (proj) {
                                                                    cx = proj[0];
                                                                    cy = proj[1];
                                                                }
                                                            }

                                                            let transform = "";
                                                            let opacity = 1;

                                                            if (isExpanded && clickPosition && (cx !== 0 || cy !== 0)) {
                                                                const { x, y } = clickPosition;
                                                                // Move centroid to cursor position (x,y), then scale 2x
                                                                transform = `translate(${x}px, ${y}px) scale(2) translate(${-cx}px, ${-cy}px)`;
                                                            } else if (!isExpanded && !isHovered) {
                                                                // Fade out when collapsing
                                                                opacity = 0;
                                                            }

                                                            return (
                                                                <g style={{
                                                                    transform,
                                                                    opacity,
                                                                    transition: isExpanded ? 'transform 0.5s ease-out, opacity 0.3s ease-out' : 'opacity 0.3s ease-out',
                                                                    pointerEvents: 'auto'
                                                                }}>
                                                                    <Geography
                                                                        key={activeGeo.rsmKey + "-active"}
                                                                        geography={activeGeo}
                                                                        fill={isExpanded ? "#FFA300" : (isHovered ? "#FFA300" : "#FFCC80")}
                                                                        stroke="#CBD5E1"
                                                                        strokeWidth={isExpanded ? 0.25 : 0.5}
                                                                        data-state-code={stateCode || ''}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (!expandedState && stateCode) {
                                                                                const svg = e.currentTarget.ownerSVGElement;
                                                                                let clickX = 0;
                                                                                let clickY = 0;

                                                                                if (svg) {
                                                                                    const pt = svg.createSVGPoint();
                                                                                    pt.x = e.clientX;
                                                                                    pt.y = e.clientY;
                                                                                    const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
                                                                                    clickX = svgP.x;
                                                                                    clickY = svgP.y;
                                                                                    setClickPosition({
                                                                                        x: clickX,
                                                                                        y: clickY
                                                                                    });
                                                                                }
                                                                                setExpandedState(stateCode);

                                                                                // Calculate and store centroid for consistency
                                                                                const centroid = geoCentroid(activeGeo);
                                                                                const projCentroid = projection(centroid);
                                                                                if (projCentroid) {
                                                                                    const [cx, cy] = projCentroid;
                                                                                    setExpandedCentroid({ x: cx, y: cy });

                                                                                    // Alert for Expanded Coordinates (after animation)
                                                                                    setTimeout(() => {
                                                                                        let msg = `[Expanded State: ${stateCode}]\n`;
                                                                                        msg += `New Centroid (Click Pos): (${clickX.toFixed(1)}, ${clickY.toFixed(1)})\n`;

                                                                                        stateMuseums.forEach(m => {
                                                                                            if (m.coordinates) {
                                                                                                const proj = projection(m.coordinates);
                                                                                                if (proj) {
                                                                                                    const [mx, my] = proj;
                                                                                                    // Calculate transformed position: Click + (City - Centroid) * 2
                                                                                                    const exX = clickX + (mx - cx) * 2;
                                                                                                    const exY = clickY + (my - cy) * 2;
                                                                                                    msg += `City ${m.city}: (${exX.toFixed(1)}, ${exY.toFixed(1)})\n`;
                                                                                                }
                                                                                            }
                                                                                        });
                                                                                    }, 550); // Wait for 0.5s transition
                                                                                }
                                                                            }
                                                                        }}
                                                                        onMouseEnter={() => {
                                                                            if (!expandedState && stateCode) {
                                                                                setHoveredState(stateCode);

                                                                                // Alert for Hover Coordinates
                                                                                // Use current centroid calculation for hover
                                                                                const centroid = geoCentroid(activeGeo);
                                                                                const projCentroid = projection(centroid);
                                                                                if (projCentroid) {
                                                                                    const [cx, cy] = projCentroid;
                                                                                    let msg = `[Hover State: ${stateCode}]\n`;
                                                                                    msg += `Centroid: (${cx.toFixed(1)}, ${cy.toFixed(1)})\n`;

                                                                                    stateMuseums.forEach(m => {
                                                                                        if (m.coordinates) {
                                                                                            const proj = projection(m.coordinates);
                                                                                            if (proj) {
                                                                                                const [mx, my] = proj;
                                                                                                msg += `City ${m.city}: (${mx.toFixed(1)}, ${my.toFixed(1)})\n`;
                                                                                            }
                                                                                        }
                                                                                    });
                                                                                }
                                                                            }
                                                                        }}
                                                                        onMouseLeave={() => {
                                                                            if (!expandedState) setHoveredState(null);
                                                                        }}
                                                                        style={{
                                                                            default: {
                                                                                outline: "none",
                                                                                filter: (isHovered || isExpanded) ? "url(#state-shadow)" : "none",
                                                                                transition: "fill 0.5s ease, filter 0.3s ease",
                                                                                cursor: isExpanded ? "default" : "pointer"
                                                                            },
                                                                            hover: {
                                                                                outline: "none",
                                                                                filter: "url(#state-shadow)",
                                                                                transition: "fill 0.5s ease, filter 0.3s ease",
                                                                                cursor: isExpanded ? "default" : "pointer"
                                                                            },
                                                                            pressed: { outline: "none" }
                                                                        }}
                                                                    />

                                                                    {/* Museum Pins - only show when expanded */}
                                                                    {isExpanded && (() => {
                                                                        // 1. Group museums by exact coordinates (backend data might have dupes or same-building museums)
                                                                        const groupedMuseums = stateMuseums.reduce<Record<string, ArtMuseum[]>>((acc, museum: ArtMuseum) => {
                                                                            if (!museum.coordinates) return acc;
                                                                            const key = `${museum.coordinates[0]},${museum.coordinates[1]}`;
                                                                            if (!acc[key]) {
                                                                                acc[key] = [];
                                                                            }
                                                                            acc[key].push(museum);
                                                                            return acc;
                                                                        }, {});

                                                                        return Object.entries(groupedMuseums).map(([coordKey, museums], idx) => {
                                                                            const museum = museums[0]; // Use first museum for pin location

                                                                            // Use coordKey as hover identifier
                                                                            const pinId = coordKey;
                                                                            // Click on museum with artworks, or first one if none have artworks
                                                                            const museumToOpen = museums.find((m: ArtMuseum) => m.artworks && m.artworks.length > 0) || museums[0];

                                                                            return (
                                                                                <Marker key={museum._id || `museum-${coordKey}`} coordinates={museum.coordinates as [number, number]}>
                                                                                    <g
                                                                                        transform="scale(0.5) translate(-12, -24)"
                                                                                        onMouseEnter={() => setHoveredPin(pinId)}
                                                                                        onMouseLeave={() => setHoveredPin(null)}
                                                                                        onClick={() => handleMuseumClick(museumToOpen)}
                                                                                        style={{ cursor: 'pointer' }}
                                                                                    >
                                                                                        <path
                                                                                            d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.12 8.5 15.5 8.5 15.5s8.5-9.38 8.5-15.5C20.5 3.81 16.69 0 12 0zm0 11.75c-1.79 0-3.25-1.46-3.25-3.25S10.21 5.25 12 5.25s3.25 1.46 3.25 3.25-1.46 3.25-3.25 3.25z"
                                                                                            fill="#DC2626"
                                                                                            stroke="#FFFFFF"
                                                                                            strokeWidth="1"
                                                                                            style={{ pointerEvents: 'auto' }}
                                                                                        />
                                                                                    </g>
                                                                                    {/* Tooltips - show first museum only */}
                                                                                    {hoveredPin === pinId && (
                                                                                        <g transform="translate(0, -35)">
                                                                                            <text
                                                                                                textAnchor="middle"
                                                                                                y={-10}
                                                                                                style={{
                                                                                                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                                                                                    fill: '#000',
                                                                                                    fontWeight: '600',
                                                                                                    fontSize: '11px'
                                                                                                }}
                                                                                            >
                                                                                                {museumToOpen.museum_name}
                                                                                            </text>
                                                                                            <text
                                                                                                textAnchor="middle"
                                                                                                y={0}
                                                                                                style={{
                                                                                                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                                                                                    fill: '#64748b',
                                                                                                    fontSize: '10px'
                                                                                                }}
                                                                                            >
                                                                                                {museum.city_name || museum.city}
                                                                                            </text>
                                                                                        </g>
                                                                                    )}
                                                                                </Marker>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </g>
                                                            );
                                                        })()}
                                                    </>
                                                );
                                            }}
                                        </Geographies>
                                    </ComposableMap>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <div className="animate-fadeIn flex gap-6">
                            {/* Left Navigation - Similar to Tech and Bio */}
                            <div className="w-64 flex-shrink-0 space-y-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Insights</h3>
                                <hr className="border-slate-200 my-2" />
                                <div className="space-y-3">
                                    <div
                                        onClick={() => navigate('/interests/data/1')}
                                        className={`
                                            group cursor-pointer transition-all duration-200
                                            bg-slate-50 px-4 py-3 rounded-lg border border-slate-200
                                            hover:bg-orange-50 hover:border-orange-200
                                            ${subId === '1' ? 'bg-orange-50 border-orange-200' : ''}
                                        `}
                                    >
                                        <p className={`
                                            text-sm font-medium text-slate-600 truncate
                                            group-hover:text-orange-600
                                            ${subId === '1' ? 'text-orange-600' : ''}
                                        `}>
                                            1. Gold Timing Model
                                        </p>
                                    </div>
                                    <div
                                        onClick={() => navigate('/interests/data/2')}
                                        className={`
                                            group cursor-pointer transition-all duration-200
                                            bg-slate-50 px-4 py-3 rounded-lg border border-slate-200
                                            hover:bg-orange-50 hover:border-orange-200
                                            ${subId === '2' ? 'bg-orange-50 border-orange-200' : ''}
                                        `}
                                    >
                                        <p className={`
                                            text-sm font-medium text-slate-600 truncate
                                            group-hover:text-orange-600
                                            ${subId === '2' ? 'text-orange-600' : ''}
                                        `}>
                                            2. Real Estate Time Series
                                        </p>
                                    </div>
                                    <div
                                        onClick={() => navigate('/interests/data/3')}
                                        className={`
                                            group cursor-pointer transition-all duration-200
                                            bg-slate-50 px-4 py-3 rounded-lg border border-slate-200
                                            hover:bg-orange-50 hover:border-orange-200
                                            ${subId === '3' ? 'bg-orange-50 border-orange-200' : ''}
                                        `}
                                    >
                                        <p className={`
                                            text-sm font-medium text-slate-600 truncate
                                            group-hover:text-orange-600
                                            ${subId === '3' ? 'text-orange-600' : ''}
                                        `}>
                                            3. FC Series Data Analytics
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Content Area */}
                            <div className="flex-1 space-y-8">
                                {subId === '1' && (
                                    <MarketCommodities />
                                )}

                                {subId === '2' && (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Real Estate Time Series</h3>
                                                <p className="text-slate-500 text-lg">Detailed analysis and visualization</p>
                                            </div>
                                            <div className="flex gap-3">
                                                <select className="bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 outline-none cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <option>Option A</option>
                                                    <option>Option B</option>
                                                    <option>Option C</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="h-[400px] w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={mockInteractionData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                                    <XAxis dataKey="pos" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                    />
                                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                                    <Bar dataKey="enhancer" barSize={30} fill="#FFE0B2" name="Metric A" radius={[4, 4, 0, 0]} />
                                                    <Line type="monotone" dataKey="interaction" stroke="#FFA300" strokeWidth={4} name="Metric B" dot={false} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100">
                                                <h4 className="font-bold text-orange-900 mb-2">Key Insight 1</h4>
                                                <p className="text-sm text-orange-800/80">Description of the first key insight derived from the data analysis.</p>
                                            </div>
                                            <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100">
                                                <h4 className="font-bold text-orange-900 mb-2">Key Insight 2</h4>
                                                <p className="text-sm text-orange-800/80">Description of the second key insight derived from the data analysis.</p>
                                            </div>
                                            <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100">
                                                <h4 className="font-bold text-orange-900 mb-2">Key Insight 3</h4>
                                                <p className="text-sm text-orange-800/80">Description of the third key insight derived from the data analysis.</p>
                                            </div>
                                        </div>
                                    </>
                                )}



                                {subId === '3' && (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="text-2xl font-bold text-slate-900 mb-2">FC Series Data Analytics</h3>
                                                <p className="text-slate-500 text-lg">Detailed analysis and visualization</p>
                                            </div>
                                        </div>

                                        <div className="h-[400px] w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-center">
                                            <p className="text-slate-400 text-lg">FC Series Data Analytics content coming soon...</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
                                                <h4 className="font-bold text-green-900 mb-2">FC26 Metric 1</h4>
                                                <p className="text-sm text-green-800/80">Key performance indicator analysis.</p>
                                            </div>
                                            <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
                                                <h4 className="font-bold text-green-900 mb-2">FC26 Metric 2</h4>
                                                <p className="text-sm text-green-800/80">Trend analysis and forecasting.</p>
                                            </div>
                                            <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
                                                <h4 className="font-bold text-green-900 mb-2">FC26 Metric 3</h4>
                                                <p className="text-sm text-green-800/80">Comparative analytics and insights.</p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Museum Modal - Moved to root level for full viewport coverage */}
            {selectedMuseum && (
                <div
                    className={`fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 transition-all duration-300 ${selectedArtwork ? 'backdrop-blur-md' : 'backdrop-blur-sm'}`}
                    onClick={() => {
                        if (!selectedArtwork) {
                            setSelectedMuseum(null);
                        }
                    }}
                    style={{ animation: 'fadeIn 0.5s ease-out' }}
                >
                    <div
                        className={`relative w-full max-w-5xl h-[80vh] bg-white rounded-3xl shadow-2xl overflow-hidden transition-[filter] duration-300 ease-out ${selectedArtwork ? 'blur-lg pointer-events-none' : 'blur-0'}`}
                        onClick={e => e.stopPropagation()}
                        style={{ animation: 'scaleIn 0.5s ease-out' }}
                    >
                        {/* Close button - inside the plate */}
                        <button
                            onClick={() => setSelectedMuseum(null)}
                            className="absolute top-4 right-4 z-10 text-slate-600 hover:text-slate-900 transition-colors bg-white/80 rounded-full p-2 shadow-lg"
                        >
                            <X size={24} />
                        </button>

                        {/* Masonry Layout */}
                        <div className="w-full h-full overflow-y-auto scrollbar-hide p-6 pt-16">
                            <div className="columns-4 gap-1">
                                {selectedMuseum.artworks && selectedMuseum.artworks.length > 0 ? selectedMuseum.artworks.map((artwork, index) => {
                                    // Generate random scale between 0.6 and 1.0 for variety
                                    const randomScale = 0.6 + (Math.sin(index * 12345) * 0.5 + 0.5) * 0.4;
                                    // Generate random X-axis offset for staggered effect
                                    const randomOffsetX = (Math.sin(index * 7890) * 0.5 + 0.5) * 30 - 15; // -15px to +15px

                                    return (
                                        <div key={index} className="break-inside-avoid mb-1">
                                            <div
                                                className="rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedArtwork(artwork);
                                                }}
                                                style={{
                                                    transform: `translateX(${randomOffsetX}px) scale(${randomScale})`,
                                                    transformOrigin: 'center'
                                                }}
                                            >
                                                <img
                                                    src={artwork}
                                                    alt={`Artwork ${index + 1}`}
                                                    className="w-full h-auto object-cover"
                                                />
                                            </div>
                                        </div>
                                    );
                                }) : loadingArtworks ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <div className="w-8 h-8 border-4 border-slate-300 border-t-[#FFA300] rounded-full animate-spin mb-4"></div>
                                        <p className="text-slate-500">Loading artworks...</p>
                                    </div>
                                ) : (
                                    <p className="text-slate-500">No artworks available</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Single Artwork Zoom Modal - Overlay on top of blurred museum modal */}
            {selectedArtwork && selectedMuseum && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 cursor-pointer"
                    onClick={() => setSelectedArtwork(null)}
                    style={{ animation: 'fadeIn 0.3s ease-out' }}
                >
                    {/* Close button - fixed position inside viewport */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedArtwork(null);
                        }}
                        className="fixed top-8 right-8 z-30 text-white hover:text-slate-300 transition-colors bg-black/50 rounded-full p-3 shadow-lg"
                        aria-label="Close Preview"
                    >
                        <X size={28} />
                    </button>

                    {/* Navigation Buttons */}
                    {(() => {
                        const currentIndex = selectedMuseum.artworks?.indexOf(selectedArtwork) ?? -1;
                        const totalArtworks = selectedMuseum.artworks?.length ?? 0;
                        const isFirst = currentIndex <= 0;
                        const isLast = currentIndex >= totalArtworks - 1;

                        return (
                            <>
                                {/* Previous Button - Left */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isFirst && selectedMuseum.artworks) {
                                            setSelectedArtwork(selectedMuseum.artworks[currentIndex - 1]);
                                        }
                                    }}
                                    disabled={isFirst}
                                    aria-label="Previous Artwork"
                                    className={`absolute left-4 md:left-12 z-20 p-4 rounded-full transition-all duration-300 ${isFirst
                                        ? 'bg-white/10 text-white/20 cursor-not-allowed border-2 border-white/10'
                                        : 'bg-white/20 text-white hover:bg-white hover:text-black backdrop-blur-md border-2 border-white/50 hover:border-white hover:scale-110 shadow-[0_0_15px_rgba(0,0,0,0.5)]'
                                        }`}
                                >
                                    <ChevronLeft size={40} strokeWidth={2.5} />
                                </button>

                                {/* Next Button - Right */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isLast && selectedMuseum.artworks) {
                                            setSelectedArtwork(selectedMuseum.artworks[currentIndex + 1]);
                                        }
                                    }}
                                    disabled={isLast}
                                    aria-label="Next Artwork"
                                    className={`absolute right-4 md:right-12 z-20 p-4 rounded-full transition-all duration-300 ${isLast
                                        ? 'bg-white/10 text-white/20 cursor-not-allowed border-2 border-white/10'
                                        : 'bg-white/20 text-white hover:bg-white hover:text-black backdrop-blur-md border-2 border-white/50 hover:border-white hover:scale-110 shadow-[0_0_15px_rgba(0,0,0,0.5)]'
                                        }`}
                                >
                                    <ChevronRight size={40} strokeWidth={2.5} />
                                </button>
                            </>
                        );
                    })()}

                    {/* Artwork Image with Y-axis 360° rotation */}
                    <div className="relative z-10">
                        <img
                            key={selectedArtwork} // Force re-render animation on change
                            src={selectedArtwork}
                            alt="Artwork"
                            className="max-w-[80vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl cursor-default"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                animation: 'rotateY360 1s ease-out forwards',
                                transform: 'perspective(1000px) rotateY(0deg)'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
