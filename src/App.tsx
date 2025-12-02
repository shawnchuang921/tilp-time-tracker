import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, query, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Users, DollarSign, Clock, Calendar, Shield, LogOut, Edit2, Trash2, Plus, Download, Save, Lock, Mail, User as UserIcon } from 'lucide-react';

// --- START: CUSTOMIZED FIREBASE CONFIG (EDIT THIS SECTION) ---
const firebaseConfig = {
    // !!! IMPORTANT: REPLACE THESE PLACEHOLDERS WITH YOUR ACTUAL KEYS FROM FIREBASE !!!
    apiKey: "AIzaSyD-XyZ123...", 
    authDomain: "tilp-tracker-12345.firebaseapp.com",
    projectId: "tilp-tracker-12345", // MUST BE CORRECT!
    storageBucket: "tilp-tracker-12345.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef12345"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Use the projectId as the App ID for simplicity
const appId = firebaseConfig.projectId || 'tilp-default'; 
// --- END: CUSTOMIZED FIREBASE CONFIG ---


// --- 1. TYPE DEFINITIONS ---
interface StaffMember {
    id: string;
    name: string;
    role: string;
    systemRole: 'Admin' | 'Staff';
    directRate: number;
    indirectRate: number;
    baseMonthlyPay: number;
    email: string; // Used as login ID
}

interface TimeLog {
    id: string;
    staffId: string;
    staffName: string;
    date: string; // YYYY-MM-DD
    directHours: number;
    indirectHours: number;
    directPay: number;
    indirectPay: number;
    totalPay: number;
    notes: string;
    timestamp: number;
}

interface ModalState {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel: string;
    isAlert: boolean;
}

// --- 2. AUTH & HOOKS ---

function useStaff(appId: string): StaffMember[] {
    const [staffList, setStaffList] = useState<StaffMember[]>([]);

    useEffect(() => {
        if (!appId) return;
        const staffColRef = collection(db, 'artifacts', appId, 'public', 'data', 'staff');
        
        const unsubscribe = onSnapshot(staffColRef, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as StaffMember));
            setStaffList(list);
        });

        return () => unsubscribe();
    }, [appId]);

    return staffList;
}

function useTimeLogs(appId: string): TimeLog[] {
    const [logs, setLogs] = useState<TimeLog[]>([]);

    useEffect(() => {
        if (!appId) return;
        const logsColRef = collection(db, 'artifacts', appId, 'public', 'data', 'time_logs');
        
        const q = query(logsColRef); 
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TimeLog)).sort((a, b) => b.timestamp - a.timestamp); 
            setLogs(list);
        });

        return () => unsubscribe();
    }, [appId]);

    return logs;
}

// --- 3. MAIN APP COMPONENT ---

function TILPTimeTracker() {
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<ModalState | null>(null);

    // Data Hooks
    const staffList = useStaff(appId);
    const allLogs = useTimeLogs(appId);
    
    // Auth State Hook
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setFirebaseUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Derived User Info
    const currentUserEmail = firebaseUser?.email || '';
    const currentUser = staffList.find(s => s.email.toLowerCase() === currentUserEmail.toLowerCase()) || null;
    const isAdmin = currentUser?.systemRole === 'Admin';

    if (loading) {
        return <div className="loading-screen">Loading application...</div>;
    }

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setModal(null);
        } catch (error) {
            console.error("Sign Out Error:", error);
        }
    };

    const handleConfirm = () => {
        if (modal) {
            modal.onConfirm();
        }
        setModal(null);
    };

    // --- RENDER LOGIC ---

    let content;
    if (!firebaseUser || !currentUser) {
        content = <LoginScreen staffList={staffList} />;
    } else if (isAdmin) {
        content = <AdminDashboard 
            currentUser={currentUser} 
            allLogs={allLogs} 
            staffList={staffList} 
            appId={appId} 
            setModal={setModal}
        />;
    } else {
        const myLogs = allLogs.filter(log => log.staffId === currentUser.id);
        content = <StaffDashboard 
            currentUser={currentUser} 
            myLogs={myLogs} 
            appId={appId} 
            setModal={setModal}
        />;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <Header 
                currentUser={currentUser} 
                signOut={() => setModal({
                    title: "Confirm Sign Out",
                    message: "Are you sure you want to sign out?",
                    onConfirm: signOut,
                    confirmLabel: 'Sign Out',
                    isAlert: false
                })} 
            />
            <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                {content}
            </main>
            {modal && <ConfirmModal modal={modal} onConfirm={handleConfirm} onClose={() => setModal(null)} />}
            {/* Global Styles for CodeSandbox Environment */}
            <style>{`
                .loading-screen { padding: 40px; text-align: center; font-size: 1.25rem; color: #475569; }
                .input-field { width: 100%; padding: 0.625rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; outline: none; transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out; }
                .input-field:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.5); }
            `}</style>
        </div>
    );
}
export default TILPTimeTracker;


// --- 4. CORE COMPONENTS ---

// Header
const Header = ({ currentUser, signOut }: { currentUser: StaffMember | null, signOut: () => void }) => (
    <header className="bg-white shadow-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
                <Clock className="w-6 h-6" /> TILP Time Tracker
            </h1>
            {currentUser && (
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm font-medium text-slate-800">{currentUser.name}</p>
                        <p className={`text-xs ${currentUser.systemRole === 'Admin' ? 'text-red-500' : 'text-slate-500'}`}>
                            {currentUser.systemRole} | {currentUser.role}
                        </p>
                    </div>
                    <button 
                        onClick={signOut}
                        className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600"
                        title="Sign Out"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    </header>
);

// Confirm Modal
const ConfirmModal = ({ modal, onConfirm, onClose }: { modal: ModalState, onConfirm: () => void, onClose: () => void }) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999]">
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-slate-800 mb-4">{modal.title}</h3>
            <p className="text-slate-600 mb-6">{modal.message}</p>
            <div className={`flex ${modal.isAlert ? 'justify-end' : 'justify-between'} gap-3`}>
                {!modal.isAlert && (
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                )}
                <button 
                    onClick={onConfirm}
                    className={`px-4 py-2 text-white rounded-lg transition-colors ${modal.confirmLabel.includes('Delete') ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                    {modal.confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

// --- 5. LOGIN SCREEN ---

function LoginScreen({ staffList }: { staffList: StaffMember[] }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        const staff = staffList.find(s => s.email.toLowerCase() === email.toLowerCase());

        if (!staff) {
            setError("Login ID not found. Please check your email/username.");
            return;
        }

        try {
            if (password !== 'password') { 
                setError("Incorrect password. Use 'password' for the demo.");
                return;
            }
            
            await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);

        } catch (err: any) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError("Invalid Login ID or Password. Use 'password' for demo.");
            } else {
                console.error("Login error:", err);
                setError("An unexpected error occurred during login. Check console.");
            }
        }
    };

    const demoLogins = useMemo(() => staffList
        .filter(s => s.email && (s.systemRole === 'Admin' || s.role.toLowerCase().includes('lead')))
        .slice(0, 3) 
        .map(s => ({
            name: s.name,
            role: s.systemRole,
            email: s.email,
        })), [staffList]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
                <h2 className="text-3xl font-bold text-center text-slate-800 mb-6 flex items-center justify-center gap-2">
                    <Lock className="w-7 h-7 text-indigo-600" /> Secure Login
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Login ID (Email/Username)</label>
                        <input
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="input-field"
                            placeholder="e.g., admin@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="input-field"
                            placeholder="password"
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{error}</p>
                    )}
                    <button
                        type="submit"
                        className="w-full px-4 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Sign In
                    </button>
                </form>
                
                <div className="mt-8 pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-500 mb-3">Demo Login Credentials:</h3>
                    <ul className="space-y-2 text-xs text-slate-600">
                        {demoLogins.map(login => (
                            <li key={login.email} className="flex justify-between p-2 bg-slate-50 rounded-md">
                                <span>{login.name} <span className="text-indigo-500">({login.role})</span></span>
                                <span className="font-mono">{login.email}</span>
                            </li>
                        ))}
                        <li className="flex justify-between p-2 bg-slate-50 rounded-md">
                            <span>Universal Password:</span>
                            <span className="font-mono font-bold">password</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}


// --- 6. STAFF DASHBOARD ---

function StaffDashboard({ currentUser, myLogs, appId, setModal }: { currentUser: StaffMember, myLogs: TimeLog[], appId: string, setModal: (modal: ModalState | null) => void }) {
    const [isLogging, setIsLogging] = useState(false);
    const [newLog, setNewLog] = useState({ date: new Date().toISOString().split('T')[0], directHours: '', indirectHours: '', notes: '' });

    const staffId = currentUser.id;

    const handleLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const dHours = parseFloat(newLog.directHours) || 0;
        const iHours = parseFloat(newLog.indirectHours) || 0;

        if (dHours + iHours <= 0) {
            setModal({
                title: "Input Error",
                message: "Total logged hours must be greater than zero.",
                onConfirm: () => {},
                confirmLabel: 'OK',
                isAlert: true
            });
            return;
        }

        const dRate = currentUser.directRate;
        const iRate = currentUser.indirectRate;
        
        const logData: Omit<TimeLog, 'id'> = {
            staffId: staffId,
            staffName: currentUser.name,
            date: newLog.date,
            directHours: dHours,
            indirectHours: iHours,
            directPay: dHours * dRate,
            indirectPay: iHours * iRate,
            totalPay: (dHours * dRate) + (iHours * iRate),
            notes: newLog.notes,
            timestamp: Date.now(),
        };

        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'time_logs'), logData);
            setNewLog({ date: new Date().toISOString().split('T')[0], directHours: '', indirectHours: '', notes: '' });
            setIsLogging(false);
        } catch (err) {
            console.error(err);
            setModal({
                title: "Error Submitting Log",
                message: "Failed to submit time log. Check console for details.",
                onConfirm: () => {},
                confirmLabel: 'Close',
                isAlert: true
            });
        }
    };
    
    // Summary
    const totalHours = myLogs.reduce((sum, log) => sum + log.directHours + log.indirectHours, 0);
    const totalPay = myLogs.reduce((sum, log) => sum + log.totalPay, 0);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <p className="text-sm text-slate-500">Total Hours Logged (Current Cycle)</p>
                    <h3 className="text-2xl font-bold text-slate-800">{totalHours.toFixed(2)}h</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <p className="text-sm text-slate-500">Estimated Variable Pay</p>
                    <h3 className="text-2xl font-bold text-slate-800 text-green-600">${totalPay.toFixed(2)}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <p className="text-sm text-slate-500">Base Monthly Pay</p>
                    <h3 className="text-2xl font-bold text-slate-800">${currentUser.baseMonthlyPay.toFixed(2)}</h3>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                    <h2 className="text-xl font-bold text-slate-800">New Time Log</h2>
                    <button
                        onClick={() => setIsLogging(!isLogging)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" /> {isLogging ? 'Cancel Log' : 'Log New Time'}
                    </button>
                </div>

                {isLogging && (
                    <form onSubmit={handleLogSubmit} className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
                                <input 
                                    type="date" 
                                    required 
                                    value={newLog.date} 
                                    onChange={(e) => setNewLog({ ...newLog, date: e.target.value })} 
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Direct Hours ($<span className="font-bold">{currentUser.directRate}</span>/hr)</label>
                                <input 
                                    type="number" 
                                    step="0.25"
                                    min="0"
                                    value={newLog.directHours} 
                                    onChange={(e) => setNewLog({ ...newLog, directHours: e.target.value })} 
                                    className="input-field"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Indirect Hours ($<span className="font-bold">{currentUser.indirectRate}</span>/hr)</label>
                                <input 
                                    type="number" 
                                    step="0.25"
                                    min="0"
                                    value={newLog.indirectHours} 
                                    onChange={(e) => setNewLog({ ...newLog, indirectHours: e.target.value })} 
                                    className="input-field"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    type="submit"
                                    className="w-full px-4 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> Submit Log
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Notes (Optional)</label>
                            <textarea 
                                rows={2}
                                value={newLog.notes} 
                                onChange={(e) => setNewLog({ ...newLog, notes: e.target.value })} 
                                className="input-field resize-none"
                                placeholder="Brief description of work done."
                            />
                        </div>
                    </form>
                )}
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800">My Recent Logs</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                                <th className="p-4 font-semibold">Date</th>
                                <th className="p-4 font-semibold">Total Hours</th>
                                <th className="p-4 font-semibold text-right">Variable Pay</th>
                                <th className="p-4 font-semibold">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                            {myLogs.slice(0, 10).map(log => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 whitespace-nowrap">{log.date}</td>
                                    <td className="p-4 font-medium">
                                        {(log.directHours + log.indirectHours).toFixed(2)}h
                                    </td>
                                    <td className="p-4 text-right font-medium text-green-600">
                                        ${log.totalPay.toFixed(2)}
                                    </td>
                                    <td className="p-4 max-w-xs truncate text-slate-500 text-xs">{log.notes || 'N/A'}</td>
                                </tr>
                            ))}
                            {myLogs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-400">
                                        No time logs submitted yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// --- 7. ADMIN DASHBOARD (Complete Component) ---

function AdminDashboard({ currentUser, allLogs, staffList, appId, setModal }: { 
    currentUser: StaffMember, 
    allLogs: TimeLog[], 
    staffList: StaffMember[], 
    appId: string,
    setModal: (modal: ModalState | null) => void 
}) {
    const [activeTab, setActiveTab] = useState<'logs' | 'payroll' | 'staff'>('logs');
    const [staffFilter, setStaffFilter] = useState('all');
    const [editingLog, setEditingLog] = useState<TimeLog | null>(null);
    
    // Staff Management State
    const [isAddingStaff, setIsAddingStaff] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
    
    // Filter logs
    const displayedLogs = staffFilter === 'all' 
        ? allLogs 
        : allLogs.filter(l => l.staffId === staffFilter);

    // Payroll Calculation (Memoized for performance)
    const payrollSummary = useMemo(() => {
        const summary: Record<string, { name: string, directPay: number, indirectPay: number, basePay: number, total: number, hours: number }> = {};
        
        // Initialize
        staffList.forEach(s => {
            if (s.id) {
                summary[s.id] = { 
                    name: s.name, 
                    directPay: 0, 
                    indirectPay: 0, 
                    basePay: s.baseMonthlyPay || 0,
                    total: s.baseMonthlyPay || 0,
                    hours: 0
                };
            }
        });

        // Sum logs
        allLogs.forEach(log => {
            if (summary[log.staffId]) {
                summary[log.staffId].directPay += log.directPay;
                summary[log.staffId].indirectPay += log.indirectPay;
                summary[log.staffId].total += log.totalPay;
                summary[log.staffId].hours += (log.directHours + log.indirectHours);
            }
        });

        // Add variable pay to total pay
        Object.values(summary).forEach(s => {
            s.total = s.basePay + s.directPay + s.indirectPay;
        });

        return Object.values(summary).sort((a, b) => a.name.localeCompare(b.name));
    }, [allLogs, staffList]);

    // --- Actions ---

    const handleDeleteLog = (id: string) => {
        setModal({
            title: "Confirm Deletion",
            message: "Are you sure you want to permanently delete this time log entry? This action cannot be undone.",
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'time_logs', id));
                } catch (error) {
                    console.error("Error deleting log:", error);
                }
            },
            confirmLabel: 'Delete Log',
            isAlert: false
        });
    };

    const handleDeleteStaff = (id: string, name: string) => {
        setModal({
            title: "Confirm Staff Deletion",
            message: `Are you sure you want to permanently delete staff member "${name}"? This action cannot be undone and will not delete their associated time logs.`,
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staff', id));
                } catch (err) {
                    console.error("Error deleting staff member:", err);
                }
            },
            confirmLabel: 'Delete Staff',
            isAlert: false
        });
    };

    const handleUpdateLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingLog) return;
        
        const staff = staffList.find(s => s.id === editingLog.staffId);
        if (!staff) return;

        // Calculate new pay based on updated hours and current staff rates
        const dPay = editingLog.directHours * staff.directRate;
        const iPay = editingLog.indirectHours * staff.indirectRate;

        const updatedData = {
            ...editingLog,
            directPay: dPay,
            indirectPay: iPay,
            totalPay: dPay + iPay
        };

        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'time_logs', editingLog.id), updatedData);
            setEditingLog(null);
        } catch (err) {
            console.error(err);
            setModal({
                title: "Error Updating Log",
                message: "Failed to update the time log entry. Check console for details.",
                onConfirm: () => {},
                confirmLabel: 'Close',
                isAlert: true
            });
        }
    };

    const handleSaveStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStaff) return;

        const emailTrimmed = editingStaff.email.toLowerCase().trim();
        
        // Validation: Check for duplicate emails (Login ID)
        const isDuplicate = staffList.some(s => 
            s.email.toLowerCase().trim() === emailTrimmed && s.id !== editingStaff.id
        );

        if (isDuplicate) {
            setModal({
                title: "Error Saving Staff",
                message: `The Login ID "${emailTrimmed}" is already in use. Please choose a unique ID.`,
                onConfirm: () => {},
                confirmLabel: 'Close',
                isAlert: true
            });
            return;
        }
        
        const isNew = isAddingStaff;
        const staffDataToSave = {
            ...editingStaff,
            email: emailTrimmed,
            directRate: Number(editingStaff.directRate) || 0,
            indirectRate: Number(editingStaff.indirectRate) || 0,
            baseMonthlyPay: Number(editingStaff.baseMonthlyPay) || 0,
        }

        try {
            if (isNew) {
                const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'staff'), {
                    ...staffDataToSave,
                    id: 'temp', 
                });
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staff', docRef.id), { id: docRef.id });
            } else {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staff', editingStaff.id), staffDataToSave);
            }
            setEditingStaff(null);
            setIsAddingStaff(false);
        } catch (err) {
            console.error("Error saving staff:", err);
            setModal({
                title: "Database Error",
                message: "An error occurred while saving staff data. Check the browser console for details.",
                onConfirm: () => {},
                confirmLabel: 'Close',
                isAlert: true
            });
        }
    };
    
    const handleExportPayroll = () => {
        const headers = ['Staff Member', 'Total Hours', 'Base Pay', 'Variable Pay', 'Total Due'];
        const rows = payrollSummary.map(p => [
            `"${p.name}"`,
            p.hours.toFixed(2),
            p.basePay.toFixed(2),
            (p.directPay + p.indirectPay).toFixed(2),
            p.total.toFixed(2)
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `payroll_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const totalCompanyPay = payrollSummary.reduce((sum, p) => sum + p.total, 0);

    return (
        <div className="space-y-6">
            
            {/* --- 1. Admin Stats --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 rounded-xl">
                            <Users className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Total Staff</p>
                            <h3 className="text-2xl font-bold text-slate-800">{staffList.length}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-xl">
                            <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Estimated Total Payroll</p>
                            <h3 className="text-2xl font-bold text-slate-800">${totalCompanyPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-100 rounded-xl">
                            <Clock className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Total Logs</p>
                            <h3 className="text-2xl font-bold text-slate-800">{allLogs.length}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- 2. Tab Navigation --- */}
            <div className="flex border-b border-slate-200">
                <TabButton 
                    label="Time Logs" 
                    icon={Calendar} 
                    active={activeTab === 'logs'} 
                    onClick={() => setActiveTab('logs')} 
                />
                <TabButton 
                    label="Payroll Summary" 
                    icon={DollarSign} 
                    active={activeTab === 'payroll'} 
                    onClick={() => setActiveTab('payroll')} 
                />
                <TabButton 
                    label="Staff Management" 
                    icon={Shield} 
                    active={activeTab === 'staff'} 
                    onClick={() => setActiveTab('staff')} 
                />
            </div>
            
            {/* --- 3. Tab Content --- */}
            <div className="pt-4">
                {activeTab === 'logs' && (
                    <LogsTab 
                        displayedLogs={displayedLogs} 
                        staffList={staffList} 
                        staffFilter={staffFilter}
                        setStaffFilter={setStaffFilter}
                        handleDeleteLog={handleDeleteLog}
                        setEditingLog={setEditingLog}
                    />
                )}
                
                {activeTab === 'payroll' && (
                    <PayrollTab 
                        payrollSummary={payrollSummary}
                        handleExportPayroll={handleExportPayroll}
                    />
                )}

                {activeTab === 'staff' && (
                    <StaffTab 
                        staffList={staffList}
                        setIsAddingStaff={setIsAddingStaff}
                        setEditingStaff={setEditingStaff}
                        handleDeleteStaff={handleDeleteStaff}
                    />
                )}
            </div>

            {/* --- 4. Modals for Editing/Adding --- */}
            {editingLog && (
                <EditLogModal
                    log={editingLog}
                    staffList={staffList}
                    onUpdate={handleUpdateLog}
                    onClose={() => setEditingLog(null)}
                />
            )}
            
            {(isAddingStaff || editingStaff) && (
                <EditStaffModal
                    initialStaff={isAddingStaff ? { id: '', name: '', role: '', systemRole: 'Staff', directRate: 0, indirectRate: 0, baseMonthlyPay: 0, email: '' } : editingStaff}
                    isNew={isAddingStaff}
                    onSave={handleSaveStaff}
                    onClose={() => { setEditingStaff(null); setIsAddingStaff(false); }}
                />
            )}
            
        </div>
    );
}

// --- SUPPORTING COMPONENTS (Admin Tabs) ---

const TabButton = ({ label, icon: Icon, active, onClick }: { label: string, icon: any, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            active 
                ? 'text-indigo-600 border-b-2 border-indigo-600' 
                : 'text-slate-500 hover:text-slate-700 hover:border-b-2 hover:border-slate-300'
        }`}
    >
        <Icon className="w-4 h-4" />
        {label}
    </button>
);

// TAB 1: LOGS
function LogsTab({ displayedLogs, staffList, staffFilter, setStaffFilter, handleDeleteLog, setEditingLog }: any) {
    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h4 className="text-xl font-bold text-slate-800">Staff Time Logs</h4>
                <select
                    value={staffFilter}
                    onChange={(e) => setStaffFilter(e.target.value)}
                    className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                    <option value="all">All Staff</option>
                    {staffList.map((s: StaffMember) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                </select>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                            <th className="p-4 font-semibold">Date</th>
                            <th className="p-4 font-semibold">Staff</th>
                            <th className="p-4 font-semibold">Hours</th>
                            <th className="p-4 font-semibold text-right">Variable Pay</th>
                            <th className="p-4 font-semibold">Notes</th>
                            <th className="p-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                        {displayedLogs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-400">
                                    No time logs found for this filter.
                                </td>
                            </tr>
                        ) : (
                            displayedLogs.map((log: TimeLog) => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 whitespace-nowrap">{log.date}</td>
                                    <td className="p-4 font-medium">{log.staffName}</td>
                                    <td className="p-4 whitespace-nowrap">
                                        <div className="text-xs text-slate-500">D: {log.directHours.toFixed(2)} / I: {log.indirectHours.toFixed(2)}</div>
                                        <div className="font-semibold text-slate-900">Total: {(log.directHours + log.indirectHours).toFixed(2)}h</div>
                                    </td>
                                    <td className="p-4 text-right font-medium text-green-600">
                                        ${log.totalPay.toFixed(2)}
                                    </td>
                                    <td className="p-4 max-w-xs truncate text-slate-500 text-xs">{log.notes || 'N/A'}</td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <button 
                                            onClick={() => setEditingLog(log)}
                                            className="p-1 text-indigo-600 hover:text-indigo-800 transition-colors"
                                            title="Edit Log"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteLog(log.id)}
                                            className="p-1 text-red-600 hover:text-red-800 transition-colors"
                                            title="Delete Log"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Edit Log Modal
function EditLogModal({ log, staffList, onUpdate, onClose }: any) {
    const [currentLog, setCurrentLog] = useState(log);
    const staff = staffList.find((s: StaffMember) => s.id === currentLog.staffId);
    
    const isValid = currentLog.directHours >= 0 && currentLog.indirectHours >= 0;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCurrentLog((prev: TimeLog) => ({
            ...prev,
            [name]: name.includes('Hours') ? (parseFloat(value) || 0) : value,
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999]">
            <form onSubmit={onUpdate} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Edit2 className="w-5 h-5 text-indigo-600" /> Edit Time Log
                </h3>
                <p className="text-sm text-slate-600 mb-6">Staff: <span className="font-semibold">{currentLog.staffName}</span> | Date: <span className="font-semibold">{currentLog.date}</span></p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Direct Hours (${staff?.directRate}/hr)</label>
                        <input 
                            type="number" 
                            name="directHours"
                            step="0.25"
                            min="0"
                            required
                            value={currentLog.directHours}
                            onChange={handleChange}
                            className="input-field" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Indirect Hours (${staff?.indirectRate}/hr)</label>
                        <input 
                            type="number" 
                            name="indirectHours"
                            step="0.25"
                            min="0"
                            required
                            value={currentLog.indirectHours}
                            onChange={handleChange}
                            className="input-field" 
                        />
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Notes</label>
                    <textarea 
                        name="notes"
                        rows={2}
                        value={currentLog.notes}
                        onChange={handleChange}
                        className="input-field resize-none" 
                    />
                </div>
                
                <div className="flex justify-end gap-3">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        disabled={!isValid || currentLog.directHours + currentLog.indirectHours === 0}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 inline mr-2" /> Save Changes
                    </button>
                </div>
            </form>
        </div>
    );
}

// TAB 2: PAYROLL
function PayrollTab({ payrollSummary, handleExportPayroll }: any) {
    const totalCompanyPay = payrollSummary.reduce((sum: number, p: any) => sum + p.total, 0);

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h4 className="text-xl font-bold text-slate-800">Monthly Payroll Summary</h4>
                <button
                    onClick={handleExportPayroll}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                >
                    <Download className="w-4 h-4" /> Export CSV
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                            <th className="p-4 font-semibold">Staff Member</th>
                            <th className="p-4 font-semibold text-right">Total Hours</th>
                            <th className="p-4 font-semibold text-right">Base Pay</th>
                            <th className="p-4 font-semibold text-right">Variable Pay</th>
                            <th className="p-4 font-semibold text-right">Total Due</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                        {payrollSummary.map((p: any) => (
                            <tr key={p.name} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-medium text-slate-900">{p.name}</td>
                                <td className="p-4 text-right">{p.hours.toFixed(2)}h</td>
                                <td className="p-4 text-right">${p.basePay.toFixed(2)}</td>
                                <td className="p-4 text-right text-green-600">${(p.directPay + p.indirectPay).toFixed(2)}</td>
                            </tr>
                        ))}
                        <tr className="bg-indigo-50 font-bold text-slate-900">
                            <td className="p-4 text-base">GRAND TOTAL</td>
                            <td className="p-4 text-right"></td>
                            <td className="p-4 text-right"></td>
                            <td className="p-4 text-right"></td>
                            <td className="p-4 text-right text-xl">${totalCompanyPay.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// TAB 3: STAFF MANAGEMENT
function StaffTab({ staffList, setIsAddingStaff, setEditingStaff, handleDeleteStaff }: any) {
    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h4 className="text-xl font-bold text-slate-800">Manage Staff Members</h4>
                <button
                    onClick={() => setIsAddingStaff(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" /> Add New Staff
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                            <th className="p-4 font-semibold">Name / Role</th>
                            <th className="p-4 font-semibold">Login ID</th>
                            <th className="p-4 font-semibold">System Role</th>
                            <th className="p-4 font-semibold text-right">Direct Rate</th>
                            <th className="p-4 font-semibold text-right">Base Pay</th>
                            <th className="p-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                        {staffList.map((staff: StaffMember) => (
                            <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                    <div className="font-medium text-slate-900">{staff.name}</div>
                                    <div className="text-xs text-slate-500">{staff.role}</div>
                                </td>
                                <td className="p-4 font-mono text-xs">{staff.email}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        staff.systemRole === 'Admin' 
                                            ? 'bg-red-100 text-red-800' 
                                            : 'bg-green-100 text-green-800'
                                    }`}>
                                        {staff.systemRole}
                                    </span>
                                </td>
                                <td className="p-4 text-right">${staff.directRate.toFixed(2)}/hr</td>
                                <td className="p-4 text-right font-medium">${staff.baseMonthlyPay.toFixed(2)}</td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button 
                                        onClick={() => setEditingStaff(staff)}
                                        className="p-1 text-indigo-600 hover:text-indigo-800 transition-colors"
                                        title="Edit Staff"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteStaff(staff.id, staff.name)}
                                        className="p-1 text-red-600 hover:text-red-800 transition-colors"
                                        title="Delete Staff"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Edit Staff Modal
function EditStaffModal({ initialStaff, isNew, onSave, onClose }: any) {
    const [currentStaff, setCurrentStaff] = useState<StaffMember>(initialStaff);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCurrentStaff((prev) => ({
            ...prev,
            [name]: name.includes('Rate') || name.includes('Pay') ? (parseFloat(value) || 0) : value,
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(e);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999]">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xl">
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-600" /> {isNew ? 'Add New Staff Member' : `Edit Staff: ${initialStaff.name}`}
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Full Name</label>
                        <input type="text" name="name" required value={currentStaff.name} onChange={handleChange} className="input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Job Role (Title)</label>
                        <input type="text" name="role" required value={currentStaff.role} onChange={handleChange} className="input-field" />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Direct Hourly Rate ($)</label>
                        <input type="number" name="directRate" step="1" min="0" required value={currentStaff.directRate} onChange={handleChange} className="input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Indirect Hourly Rate ($)</label>
                        <input type="number" name="indirectRate" step="1" min="0" required value={currentStaff.indirectRate} onChange={handleChange} className="input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Base Monthly Pay (Salary $)</label>
                        <input type="number" name="baseMonthlyPay" step="1" min="0" required value={currentStaff.baseMonthlyPay} onChange={handleChange} className="input-field" />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Login ID (Email/Username)</label>
                        <input type="text" name="email" required value={currentStaff.email} onChange={handleChange} className="input-field" />
                        <p className="text-xs text-slate-400 mt-1">Used for portal login.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">System Role (Permissions)</label>
                        <select name="systemRole" required value={currentStaff.systemRole} onChange={handleChange} className="input-field appearance-none">
                            <option value="Staff">Staff (Time Entry)</option>
                            <option value="Admin">Admin (Full Access)</option>
                        </select>
                    </div>
                    
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        disabled={!currentStaff.name || !currentStaff.email || !currentStaff.role || !currentStaff.systemRole}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 inline mr-2" /> {isNew ? 'Add Staff' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}
