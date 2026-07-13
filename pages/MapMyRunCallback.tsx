import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_URL } from '../utils/apiConfig';

export const MapMyRunCallback: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [errorMessage, setErrorMessage] = useState('');
    const hasProcessed = useRef(false);

    useEffect(() => {
        if (hasProcessed.current) {
            return;
        }
        hasProcessed.current = true;

        const handleCallback = async () => {
            const params = new URLSearchParams(location.search);
            const code = params.get('code');
            const error = params.get('error');

            if (error) {
                setStatus('error');
                setErrorMessage('Authorization was denied or failed');
                return;
            }

            if (!code) {
                setStatus('error');
                setErrorMessage('No authorization code received');
                return;
            }

            try {
                const tokenResponse = await fetch(`${API_URL}/api/mapmyrun/exchange_token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });

                if (!tokenResponse.ok) {
                    const errorData = await tokenResponse.json();
                    throw new Error(errorData.details || errorData.error || 'Failed to exchange MapMyRun token');
                }

                const tokenData = await tokenResponse.json();
                localStorage.setItem('mapmyrun_token', JSON.stringify(tokenData));

                setStatus('success');
                setTimeout(() => {
                    navigate('/interests/workout', { replace: true });
                }, 1500);
            } catch (err) {
                setStatus('error');
                setErrorMessage(err instanceof Error ? err.message : 'Failed to complete authorization');
            }
        };

        handleCallback();
    }, [location.search, navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
            <div className="bg-white p-12 rounded-2xl shadow-xl max-w-md w-full text-center">
                {status === 'processing' && (
                    <>
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Processing...</h2>
                        <p className="text-slate-600">Connecting to MapMyRun</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Success!</h2>
                        <p className="text-slate-600">MapMyRun is connected. Redirecting...</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Error</h2>
                        <p className="text-slate-600 break-words">{errorMessage}</p>
                        <button
                            type="button"
                            onClick={() => navigate('/interests/workout')}
                            className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                            Back to Workout
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
