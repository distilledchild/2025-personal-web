import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TodoPersonal } from './TodoPersonal';
import { TodoDev } from './TodoDev';
import { TodoNote } from './TodoNote';
import { TodoBilling } from './TodoBilling';
import { API_URL } from '../utils/apiConfig';
import { PageHeader } from '../components/PageHeader';
import { fetchMemberRole, getStoredUserProfile } from '../utils/auth';

const AUDIT_STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const AUDIT_POLL_INTERVAL_MS = 5 * 60 * 1000;
const AUDIT_MISSED_GRACE_MS = 5 * 60 * 1000;
const ANSI_ESCAPE_REGEX = /(?:\u001B|\u009B|\uFFFD)\[[0-?]*[ -/]*[@-~]/g;

const sanitizeAuditOutput = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    return raw
        .replace(ANSI_ESCAPE_REGEX, '')
        .replace(/\u0000/g, '')
        .trim();
};

const removeSummaryLineFromAuditOutput = (value: string): string => {
    return value
        .split('\n')
        .filter((line) => !/^\s*summary:\s*\d+\s*critical[^\d]+\d+\s*warn[^\d]+\d+\s*info\s*$/i.test(line.trim()))
        .join('\n')
        .trim();
};

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
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [authLoading, setAuthLoading] = React.useState(true);
    const [auditResult, setAuditResult] = React.useState<any>(null);
    const [auditLoading, setAuditLoading] = React.useState(false);
    const [auditError, setAuditError] = React.useState<string | null>(null);

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
                    setIsAdmin(String(data.role || '').toUpperCase() === 'ADMIN');
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

    const fetchSecurityAuditResult = React.useCallback(async () => {
        if (!isAdmin || !user?.email) return;
        setAuditLoading(true);
        setAuditError(null);
        try {
            const params = new URLSearchParams({ email: user.email });
            const response = await fetch(`${API_URL}/api/security-audit/latest?${params.toString()}`);
            if (!response.ok) {
                let message = 'Failed to fetch security audit result';
                try {
                    const errJson = await response.json();
                    message = errJson?.error || message;
                } catch {
                    // Keep fallback message.
                }
                throw new Error(message);
            }
            const result = await response.json();
            setAuditResult(result);
        } catch (err: any) {
            setAuditError(err.message || 'Failed to fetch security audit result');
        } finally {
            setAuditLoading(false);
        }
    }, [isAdmin, user?.email]);

    React.useEffect(() => {
        if (!isAdmin || !user?.email) return;
        fetchSecurityAuditResult();
        const interval = setInterval(fetchSecurityAuditResult, AUDIT_POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [isAdmin, user?.email, fetchSecurityAuditResult]);

    const formatAuditDate = (value: any) => {
        if (!value) return '-';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '-';
        return parsed.toLocaleString();
    };

    const latestAuditTimeRaw = auditResult?.finishedAt || auditResult?.updatedAt || auditResult?.startedAt;
    const nextRunAtRaw = auditResult?.nextRunAt;
    const latestAuditTime = latestAuditTimeRaw ? new Date(latestAuditTimeRaw) : null;
    const nextRunAt = nextRunAtRaw ? new Date(nextRunAtRaw) : null;
    const auditCritical = Number.isFinite(Number(auditResult?.critical)) ? Number(auditResult?.critical) : 0;
    const auditWarn = Number.isFinite(Number(auditResult?.warn)) ? Number(auditResult?.warn) : 0;
    const auditInfo = Number.isFinite(Number(auditResult?.info)) ? Number(auditResult?.info) : 0;
    const isAuditStale = !latestAuditTime || Number.isNaN(latestAuditTime.getTime())
        ? true
        : (Date.now() - latestAuditTime.getTime()) > AUDIT_STALE_THRESHOLD_MS;
    const isAuditOverdue = !!nextRunAt && !Number.isNaN(nextRunAt.getTime()) && Date.now() > (nextRunAt.getTime() + AUDIT_MISSED_GRACE_MS);

    const securityAuditPanel = isAdmin ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-slate-800">OpenClaw Audit</h4>
                <button
                    onClick={fetchSecurityAuditResult}
                    className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                    Refresh
                </button>
            </div>

            {auditLoading && (
                <p className="text-xs text-slate-500">Loading security audit...</p>
            )}

            {auditError && (
                <p className="text-xs text-red-600">{auditError}</p>
            )}

            {!auditLoading && !auditError && auditResult && (
                <div className="space-y-2">
                    <div className="text-xs text-slate-600">
                        <span className="font-semibold">Status:</span>{' '}
                        <span className={auditResult.status === 'success' ? 'text-green-600 font-semibold' : auditResult.status === 'failed' ? 'text-red-600 font-semibold' : 'text-slate-700 font-semibold'}>
                            {String(auditResult.status || 'unknown').toUpperCase()}
                        </span>
                        {isAuditStale && (
                            <span className="ml-2 text-amber-600 font-semibold">STALE</span>
                        )}
                    </div>
                    <div className="text-xs text-slate-500">
                        <div>Source: {auditResult.sourceMachine || 'unknown'}</div>
                        <div>Last Run: {formatAuditDate(auditResult.finishedAt)}</div>
                        <div>Last Seen: {formatAuditDate(auditResult.updatedAt || auditResult.reportedAt || auditResult.startedAt)}</div>
                        <div>Next Run: {formatAuditDate(auditResult.nextRunAt)}</div>
                    </div>
                    {isAuditOverdue && (
                        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                            No new report received after the scheduled interval. Check Ubuntu laptop power, network, or reporter status.
                        </p>
                    )}
                    <div className="text-xs flex items-center gap-2">
                        <span className="font-semibold text-slate-700">Counts:</span>
                        <span className={auditCritical > 0 ? 'px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold' : 'px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold'}>
                            critical {auditCritical}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">warn {auditWarn}</span>
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">info {auditInfo}</span>
                    </div>
                    <pre className="text-[11px] text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 max-h-36 overflow-auto whitespace-pre-wrap">
                        {removeSummaryLineFromAuditOutput(sanitizeAuditOutput(auditResult.output)) || 'No output'}
                    </pre>
                </div>
            )}
        </div>
    ) : null;

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
                            securityAuditPanel={securityAuditPanel}
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
                            securityAuditPanel={securityAuditPanel}
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
