import React from 'react';
import { Plus, Bell } from 'lucide-react';
import {
    AnalogClock,
    WeatherWidget,
    sortTodos,
    formatDate,
    getPriorityColor,
    getStatusColor,
    CreateTodoModal,
    TodoDetailModal,
    EditTodoModal,
    SuccessPopup,
    TodoFormData
} from '../components/TodoComponents';
import { Pagination } from '../components/Pagination';
import { API_URL } from '../utils/apiConfig';

interface TodoPersonalProps {
    user: any;
    isAuthorized: boolean;
    projects: any[];
}

export const TodoPersonal: React.FC<TodoPersonalProps> = ({ user, isAuthorized, projects }) => {
    // ============================================================================
    // CORE STATE - Todos
    // ============================================================================
    const [todos, setTodos] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    // ============================================================================
    // TODO CREATION/EDIT STATE
    // ============================================================================
    const [showCreateModal, setShowCreateModal] = React.useState(false);
    const [selectedDate, setSelectedDate] = React.useState(new Date());
    const [selectedTodo, setSelectedTodo] = React.useState<any>(null);
    const [isEditMode, setIsEditMode] = React.useState(false);

    // ============================================================================
    // UI STATE - Popups, Pagination
    // ============================================================================
    const [showSuccessPopup, setShowSuccessPopup] = React.useState(false);
    const [successMessage, setSuccessMessage] = React.useState('');
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 10;

    // ============================================================================
    // FILTER & SEARCH STATE
    // ============================================================================
    const [filterDate, setFilterDate] = React.useState<Date | null>(null);
    const [filterMode, setFilterMode] = React.useState<'all' | 'exact_date' | 'today'>('all');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isSearching, setIsSearching] = React.useState(false);

    // ============================================================================
    // LOCATION & TIMEZONE STATE
    // ============================================================================
    const [locationTimezone, setLocationTimezone] = React.useState<string>('America/Chicago');
    const [locationLabel, setLocationLabel] = React.useState<string>('Location');

    React.useEffect(() => {
        fetchTodos();
        fetchLocationTimezone();
    }, []);

    // ============================================================================
    // API FUNCTIONS
    // ============================================================================
    const fetchTodos = async () => {
        try {
            const response = await fetch(`${API_URL}/api/todos`);
            if (response.ok) {
                const data = await response.json();
                // Filter only personal category todos
                const personalTodos = data.filter((todo: any) => todo.category === 'personal' || !todo.category);
                setTodos(sortTodos(personalTodos));
            }
        } catch (error) {
            console.error('Failed to fetch todos:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLocationTimezone = async () => {
        try {
            const response = await fetch(`${API_URL}/api/contact`);
            if (response.ok) {
                const data = await response.json();
                if (data?.Location) {
                    const { city, state, country } = data.Location;
                    let timezone = 'America/Chicago';
                    let label = 'Location';

                    const locationParts = [city, state, country].filter(Boolean);
                    if (locationParts.length > 0) {
                        label = locationParts[0];
                    }

                    if (country === 'South Korea' || country === 'Korea') {
                        timezone = 'Asia/Seoul';
                    } else if (country === 'United States' || country === 'USA') {
                        const stateTimezones: { [key: string]: string } = {
                            'Illinois': 'America/Chicago',
                            'Texas': 'America/Chicago',
                            'Wisconsin': 'America/Chicago',
                            'California': 'America/Los_Angeles',
                            'New York': 'America/New_York',
                            'Florida': 'America/New_York',
                        };
                        timezone = stateTimezones[state] || 'America/Chicago';
                    } else if (country === 'United Kingdom' || country === 'UK') {
                        timezone = 'Europe/London';
                    } else if (country === 'Japan') {
                        timezone = 'Asia/Tokyo';
                    } else if (country === 'China') {
                        timezone = 'Asia/Shanghai';
                    }

                    setLocationTimezone(timezone);
                    setLocationLabel(label);
                }
            }
        } catch (error) {
            console.error('Failed to fetch location timezone:', error);
        }
    };

    // ============================================================================
    // TODO HANDLERS
    // ============================================================================
    const handleCreateTodo = async (formData: TodoFormData) => {
        if (!user || !user.email) {
            alert('Please login to create a TODO');
            return;
        }

        let finalDueDate = formData.due_date;
        if (!finalDueDate) {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            finalDueDate = nextWeek.toISOString().split('T')[0];
        }

        try {
            const todoData = {
                ...formData,
                due_date: finalDueDate,
                email: user.email
            };

            const response = await fetch(`${API_URL}/api/todos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(todoData)
            });

            if (response.ok) {
                const createdTodo = await response.json();
                // Only add if it matches current tab's category
                if (createdTodo.category === 'personal' || !createdTodo.category) {
                    setTodos(sortTodos([createdTodo, ...todos]));
                }
                setShowCreateModal(false);
                setSuccessMessage('TODO created successfully!');
                setShowSuccessPopup(true);
            }
        } catch (error) {
            console.error('Failed to create todo:', error);
        }
    };

    const handleTodoClick = (todo: any) => {
        setSelectedTodo(todo);
        setIsEditMode(false);
    };

    const handleEditClick = () => {
        setIsEditMode(true);
    };

    const handleSaveEdit = async (formData: TodoFormData) => {
        if (!selectedTodo || !user || !user.email) return;

        try {
            const response = await fetch(`${API_URL}/api/todos/${selectedTodo._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    ...formData
                })
            });

            if (response.ok) {
                const updatedTodo = await response.json();
                // If category changed to dev, remove from this list
                if (updatedTodo.category === 'dev') {
                    setTodos(sortTodos(todos.filter(t => t._id !== selectedTodo._id)));
                } else {
                    setTodos(sortTodos(todos.map(t => t._id === selectedTodo._id ? updatedTodo : t)));
                }
                setSelectedTodo(null);
                setIsEditMode(false);
                setSuccessMessage('TODO has been updated successfully!');
                setShowSuccessPopup(true);
            }
        } catch (error) {
            console.error('Failed to update todo:', error);
        }
    };

    const handleDeleteTodo = async (todoId: string) => {
        if (!user || !user.email) {
            alert('Please login to delete TODO');
            return;
        }

        if (!confirm('Are you sure you want to delete this TODO?')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/todos/${todoId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email })
            });

            if (response.ok) {
                setTodos(todos.filter(t => t._id !== todoId));
                setSelectedTodo(null);
                setSuccessMessage('TODO has been deleted successfully!');
                setShowSuccessPopup(true);
            }
        } catch (error) {
            console.error('Failed to delete todo:', error);
        }
    };

    // ============================================================================
    // FILTER & SEARCH
    // ============================================================================
    const handleSearch = () => {
        setIsSearching(true);
        setCurrentPage(1);
        if (!searchQuery.trim()) {
            setIsSearching(false);
        }
    };

    const handlePageChange = (pageNumber: number) => {
        setCurrentPage(pageNumber);
    };

    const handleDateClick = (date: Date) => {
        if (filterDate && filterDate.toDateString() === date.toDateString() && filterMode === 'exact_date') {
            setFilterDate(null);
            setFilterMode('all');
        } else {
            setFilterDate(date);
            setFilterMode('exact_date');
        }
    };

    // Filter todos
    const filteredTodos = React.useMemo(() => {
        let result = todos;

        // Search filter
        if (isSearching && searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(todo =>
                todo.title?.toLowerCase().includes(query) ||
                todo.description?.toLowerCase().includes(query)
            );
        }

        // Date filter
        if (filterMode === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            result = result.filter(todo => {
                if (!todo.due_date) return false;
                const dueDate = new Date(todo.due_date);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate >= today && dueDate < tomorrow;
            });
        } else if (filterMode === 'exact_date' && filterDate) {
            // Exact date matching - show only todos with this deadline
            const targetDate = new Date(filterDate);
            targetDate.setHours(0, 0, 0, 0);
            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);
            result = result.filter(todo => {
                if (!todo.due_date) return false;
                const dueDate = new Date(todo.due_date);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate >= targetDate && dueDate < nextDay;
            });
        }

        return result;
    }, [todos, isSearching, searchQuery, filterMode, filterDate]);

    // Pagination
    const totalPages = Math.ceil(filteredTodos.length / itemsPerPage);
    const currentTodos = filteredTodos.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Today's todo count
    const todayCount = React.useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return todos.filter(todo => {
            if (!todo.due_date) return false;
            const dueDate = new Date(todo.due_date);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate >= today && dueDate < tomorrow;
        }).length;
    }, [todos]);

    // Get dates that have todos with deadlines
    const deadlineDates = React.useMemo(() => {
        const dates = new Set<string>();
        todos.forEach(todo => {
            if (todo.due_date) {
                const date = new Date(todo.due_date);
                dates.add(date.toDateString());
            }
        });
        return dates;
    }, [todos]);

    // ============================================================================
    // CALENDAR RENDER
    // ============================================================================
    const renderCalendar = () => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const isToday = new Date().toDateString() === date.toDateString();
            const isSelected = filterDate && filterDate.toDateString() === date.toDateString();
            const hasDeadline = deadlineDates.has(date.toDateString());

            days.push(
                <button
                    key={day}
                    onClick={() => handleDateClick(date)}
                    className={`w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors relative
                        ${isToday ? 'bg-blue-500 text-white font-bold' : ''}
                        ${isSelected ? 'ring-2 ring-blue-400' : ''}
                        ${!isToday ? 'hover:bg-slate-100' : ''}`}
                >
                    {day}
                    {hasDeadline && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500" />
                    )}
                </button>
            );
        }

        return days;
    };

    if (loading) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Loading...</p>
            </div>
        );
    }

    return (
        <>
            <div className="flex gap-8">
                {/* Left: Calendar */}
                <div className="w-1/3 flex flex-col gap-6">
                    {isAuthorized && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    ←
                                </button>
                                <h3 className="text-lg font-bold text-slate-900">
                                    {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </h3>
                                <button
                                    onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    →
                                </button>
                            </div>
                            <div className="grid grid-cols-7 gap-2 mb-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                    <div key={day} className="text-xs font-bold text-slate-500 text-center">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {renderCalendar()}
                            </div>
                        </div>
                    )}

                    {/* World Clocks */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="grid grid-cols-2 gap-4 justify-items-center">
                            <AnalogClock timezone={locationTimezone} label={locationLabel} />
                            <AnalogClock timezone="Asia/Seoul" label="Seoul" />
                        </div>
                    </div>

                </div>

                {/* Right: TODO Table */}
                <div className="flex-1 max-w-6xl">
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-700">Title</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-700">Description</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-700">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-700">Priority</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-700">Deadline</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTodos.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                                            {filterMode === 'all' ? 'No TODO items found' :
                                                filterMode === 'today' ? 'No tasks due today' :
                                                    'No tasks found for selected period'}
                                        </td>
                                    </tr>
                                ) : (
                                    currentTodos.map((todo) => {
                                        const isStrikethrough = todo.status === 'completed' || todo.status === 'cancelled';

                                        return (
                                            <tr key={todo._id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${getStatusColor(todo.status)}`}>
                                                <td
                                                    className={`px-4 py-3 ${isStrikethrough ? 'line-through text-slate-400' : 'text-slate-900'} cursor-pointer hover:text-blue-600 font-medium`}
                                                    onClick={() => handleTodoClick(todo)}
                                                >
                                                    {todo.title}
                                                </td>
                                                <td
                                                    className={`px-4 py-3 ${isStrikethrough ? 'line-through text-slate-400' : 'text-slate-600'} text-sm cursor-pointer hover:text-blue-600`}
                                                    onClick={() => handleTodoClick(todo)}
                                                >
                                                    <div className="whitespace-pre-wrap line-clamp-5 overflow-hidden">
                                                        {todo.description}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${todo.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                        todo.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                            todo.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                                'bg-slate-100 text-slate-700'
                                                        }`}>
                                                        {todo.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-sm font-bold capitalize ${getPriorityColor(todo.priority)}`}>
                                                        {todo.priority}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                                                    {formatDate(todo.due_date)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination and Search Section */}
                    <div className="flex justify-between items-center gap-4 mt-8">
                        <div className="flex-1 max-w-sm"></div>

                        {/* Pagination Controls */}
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages || 1}
                            onPageChange={handlePageChange}
                            theme="gray"
                        />

                        {/* Search Section */}
                        <div className="flex items-center gap-2 flex-1 max-w-sm justify-end">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSearch();
                                    }
                                }}
                                placeholder="Search..."
                                className="w-48 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                            />
                            <button
                                onClick={handleSearch}
                                className="w-10 h-10 rounded-lg bg-white border border-slate-300 hover:border-slate-400 transition-all flex items-center justify-center group"
                                title="Search"
                            >
                                <svg
                                    className="w-5 h-5 text-slate-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Weather Widget */}
            <WeatherWidget />

            {/* Fixed Action Buttons */}
            {isAuthorized && (
                <>
                    <button
                        onClick={() => setFilterMode(prev => prev === 'today' ? 'all' : 'today')}
                        className={`fixed bottom-64 left-6 w-14 h-14 rounded-full transition-all hover:scale-110 flex items-center justify-center z-40 todo-action-button
                            ${filterMode === 'today' ? 'bg-blue-600 text-white' : 'bg-gray-500 text-white hover:bg-gray-600'}`}
                        title="Show today's tasks"
                    >
                        <div className="relative">
                            <Bell size={24} />
                            {todayCount > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-gray-500">
                                    {todayCount}
                                </span>
                            )}
                        </div>
                    </button>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="fixed bottom-24 left-6 w-14 h-14 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-all hover:scale-110 flex items-center justify-center z-40 todo-action-button"
                        title="Create new TODO"
                    >
                        <Plus size={28} />
                    </button>
                </>
            )}

            {/* Shared Create Modal */}
            <CreateTodoModal
                show={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreateTodo}
                projects={projects}
                defaultCategory="personal"
            />

            {/* Shared Detail Modal */}
            {selectedTodo && !isEditMode && (
                <TodoDetailModal
                    todo={selectedTodo}
                    onClose={() => setSelectedTodo(null)}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteTodo}
                    isAuthorized={isAuthorized}
                    projects={projects}
                />
            )}

            {/* Shared Edit Modal */}
            {selectedTodo && isEditMode && (
                <EditTodoModal
                    todo={selectedTodo}
                    onClose={() => setIsEditMode(false)}
                    onSave={handleSaveEdit}
                    projects={projects}
                />
            )}

            {/* Shared Success Popup */}
            <SuccessPopup
                show={showSuccessPopup}
                message={successMessage}
                onClose={() => setShowSuccessPopup(false)}
            />
        </>
    );
};
