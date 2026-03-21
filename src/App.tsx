/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  setDoc,
  doc,
  query, 
  where, 
  onSnapshot, 
  orderBy
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { GoogleGenAI } from "@google/genai";
import { 
  Calendar, 
  MapPin, 
  User as UserIcon, 
  Mail, 
  Cpu, 
  FileText, 
  Plus, 
  List, 
  LogOut, 
  LogIn,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Upload,
  X,
  Lock,
  File as FileIcon,
  Navigation,
  Camera,
  Video,
  Share2,
  Trash2,
  Shield,
  BarChart3,
  Database,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface Receipt {
  name: string;
  data: string;
  type: string;
}

interface EventSubmission {
  id?: string;
  teamMemberName: string;
  email: string;
  eventName: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  location: string;
  perDiemRate: number;
  eventTicketCost: number;
  totalReimbursable: number;
  totalTravelPay: number;
  paymentMethod: 'Zelle' | 'CashApp' | 'Direct Invoice' | '';
  paymentDetails: string;
  objectives: string[];
  purposeSummary: string;
  operationalFlow: string;
  aiIntegrationAudit: string;
  takeawayA: string;
  takeawayB: string;
  leadLog: string;
  attachments: string[];
  receipts: Receipt[];
  signature: string;
  signatureDate: string;
  status: 'PRE_EVENT' | 'POST_EVENT';
  aiAnalysis?: string;
  userId: string;
  createdAt: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

// --- Components ---

const ErrorBoundary = ({ error, onReset }: { error: string, onReset: () => void }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-red-100">
      <div className="flex items-center gap-3 text-red-600 mb-4">
        <AlertCircle size={32} />
        <h2 className="text-xl font-bold">Something went wrong</h2>
      </div>
      <p className="text-gray-600 mb-6 font-mono text-sm bg-red-50 p-4 rounded-lg break-all">
        {error}
      </p>
      <button 
        onClick={onReset}
        className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors"
      >
        Dismiss
      </button>
    </div>
  </div>
);



export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'form' | 'list'>('form');
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'assets' | 'reports' | 'issues' | 'new'>('all');
  const [success, setSuccess] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    teamMemberName: '',
    email: '',
    eventName: '',
    startDate: '',
    endDate: '',
    numberOfDays: 0,
    location: '',
    perDiemRate: 0,
    eventTicketCost: 0,
    totalReimbursable: 0,
    totalTravelPay: 0,
    paymentMethod: '',
    paymentDetails: '',
    objectives: [] as string[],
    purposeSummary: '',
    operationalFlow: '',
    aiIntegrationAudit: '',
    takeawayA: '',
    takeawayB: '',
    leadLog: '',
    attachments: [] as string[],
    receipts: [] as Receipt[],
    signature: '',
    signatureDate: new Date().toISOString().split('T')[0],
    status: 'PRE_EVENT' as const,
    aiAnalysis: '',
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const missionObjectives = [
    "Data Collection",
    "Sponsor/Partner Recruitment",
    "Educational Insights",
    "Operational Research",
    "Innovation/Idea Generation"
  ];

  const attachmentOptions = [
    "5+ High-quality photos/videos attached",
    "Brief narrative storyboard describing attendee journey"
  ];

  // --- Firebase Logic ---

  useEffect(() => {
    const testConnection = async () => {
      try {
        const { getDocFromServer, doc } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();

    // Check for redirect result
    getRedirectResult(auth).catch((err: any) => {
      console.error("Redirect Error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(`Authentication Failed: This domain is not authorized. Please add this Netlify URL (${window.location.hostname}) to your Firebase Console -> Authentication -> Settings -> Authorized Domains.`);
      } else {
        setError(`Login failed: ${err.message || err.code || 'Unknown error occurred'}`);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthReady) return;

    const q = query(
      collection(db, 'events'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EventSubmission[];
      
      // Sort client-side to avoid requiring a composite index in Firestore
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setSubmissions(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'events');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleFirestoreError = (err: any, operation: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: err instanceof Error ? err.message : String(err),
      operationType: operation,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    setError(JSON.stringify(errInfo));
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Login Error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(`Authentication Failed: This domain is not authorized. Please add this Netlify URL (${window.location.hostname}) to your Firebase Console -> Authentication -> Settings -> Authorized Domains.`);
      } else if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request' || err.code === 'auth/cross-origin-opener-policy-failed') {
        const provider = new GoogleAuthProvider();
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectErr: any) {
          setError(`Redirect Login Error: ${redirectErr.message}`);
        }
      } else {
        setError(`Login failed: ${err.message || err.code || 'Unknown error occurred'}`);
      }
    }
  };

  const handleLogout = () => signOut(auth);

  const generateAiAnalysis = async () => {
    if (!formData.eventName || !formData.purposeSummary) {
      setError("Please provide at least the Event Name and Purpose Summary for AI analysis.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3.1-pro-preview";
      
      const prompt = `
        As a Senior Strategic Analyst for AI ICON, provide a high-level strategic briefing for the following mission:
        
        Mission Name: ${formData.eventName}
        Purpose Summary: ${formData.purposeSummary}
        Objectives: ${formData.objectives.join(', ')}
        Location: ${formData.location}
        
        Please provide:
        1. STRATEGIC ALIGNMENT: How this mission aligns with AI ICON's goals of innovation and educational leadership.
        2. RISK ASSESSMENT: Potential operational or strategic risks.
        3. INNOVATION OPPORTUNITIES: Specific areas where AI or new technologies could be leveraged during this mission.
        
        Keep the tone professional, tactical, and concise. Use uppercase headers for each section.
      `;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const text = response.text;
      if (text) {
        setFormData(prev => ({ ...prev, aiAnalysis: text }));
        setSuccess("AI Strategic Analysis generated successfully!");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error("AI Analysis Error:", err);
      setError("Failed to generate AI analysis. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation for Post-Event
    if (editingId) {
      if (!formData.operationalFlow || !formData.aiIntegrationAudit || !formData.takeawayA || !formData.signature) {
        setError("Please complete all Section IV and V fields for the final post-event submission.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const submission: Partial<EventSubmission> = {
        ...formData,
        status: editingId ? 'POST_EVENT' : 'PRE_EVENT',
        userId: user.uid,
        createdAt: formData.createdAt || new Date().toISOString(),
        aiAnalysis: formData.aiAnalysis || ''
      };

      if (editingId) {
        await setDoc(doc(db, 'events', editingId), submission, { merge: true });
      } else {
        await addDoc(collection(db, 'events'), submission);
      }

      // Send email and GitHub notification
      try {
        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formData: submission })
        });
        const result = await res.json();
        
        let successMsg = editingId ? "Final mission report submitted successfully!" : "Pre-event strategic document authorized!";
        
        if (result.githubSaved?.success) {
          successMsg += ` Mission report saved to GitHub repository: ${formData.githubRepo}`;
        } else if (formData.githubRepo && !result.githubSaved?.success) {
          console.warn("GitHub save failed:", result.githubSaved?.error);
        }

        if (!result.emailSent) {
          console.warn("Email notification skipped (SMTP not configured).");
        }

        setSuccess(successMsg);
      } catch (submitErr) {
        console.error('Failed to process mission submission:', submitErr);
        setSuccess(editingId ? "Final mission report submitted successfully!" : "Pre-event strategic document authorized!");
      }
      
      resetForm();
      setView('list');
      setTimeout(() => setSuccess(null), 8000);
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.WRITE : OperationType.CREATE, 'events');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      teamMemberName: '',
      email: '',
      eventName: '',
      startDate: '',
      endDate: '',
      numberOfDays: 0,
      location: '',
      perDiemRate: 0,
      eventTicketCost: 0,
      totalReimbursable: 0,
      totalTravelPay: 0,
      paymentMethod: '',
      paymentDetails: '',
      objectives: [],
      purposeSummary: '',
      operationalFlow: '',
      aiIntegrationAudit: '',
      takeawayA: '',
      takeawayB: '',
      leadLog: '',
      attachments: [],
      receipts: [],
      signature: '',
      signatureDate: new Date().toISOString().split('T')[0],
      status: 'PRE_EVENT',
      githubRepo: '',
      aiAnalysis: '',
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to purge this record? This action is irreversible.')) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'events', id));
      setSuccess('Record purged successfully.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `events/${id}`);
    }
  };

  const handleResume = (sub: EventSubmission) => {
    setFormData({
      teamMemberName: sub.teamMemberName || '',
      email: sub.email || '',
      eventName: sub.eventName || '',
      startDate: sub.startDate || '',
      endDate: sub.endDate || '',
      numberOfDays: sub.numberOfDays || 0,
      location: sub.location || '',
      perDiemRate: sub.perDiemRate || 0,
      eventTicketCost: sub.eventTicketCost || 0,
      totalReimbursable: sub.totalReimbursable || 0,
      totalTravelPay: sub.totalTravelPay || 0,
      paymentMethod: sub.paymentMethod || '',
      paymentDetails: sub.paymentDetails || '',
      objectives: sub.objectives || [],
      purposeSummary: sub.purposeSummary || '',
      operationalFlow: sub.operationalFlow || '',
      aiIntegrationAudit: sub.aiIntegrationAudit || '',
      takeawayA: sub.takeawayA || '',
      takeawayB: sub.takeawayB || '',
      leadLog: sub.leadLog || '',
      attachments: sub.attachments || [],
      receipts: sub.receipts || [],
      signature: sub.signature || '',
      signatureDate: sub.signatureDate || new Date().toISOString().split('T')[0],
      status: sub.status || 'PRE_EVENT',
      aiAnalysis: sub.aiAnalysis || '',
    });
    setEditingId(sub.id!);
    setView('form');
  };

  const toggleObjective = (objective: string) => {
    setFormData(prev => ({
      ...prev,
      objectives: prev.objectives.includes(objective)
        ? prev.objectives.filter(o => o !== objective)
        : [...prev.objectives, objective]
    }));
  };

  const toggleAttachment = (option: string) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.includes(option)
        ? prev.attachments.filter(a => a !== option)
        : [...prev.attachments, option]
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newReceipts: Receipt[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 500000) { // 500KB limit per file to stay within Firestore 1MB doc limit
        setError(`File ${file.name} is too large. Please upload files smaller than 500KB.`);
        continue;
      }
      
      const reader = new FileReader();
      const promise = new Promise<Receipt>((resolve) => {
        reader.onload = (event) => {
          resolve({
            name: file.name,
            type: file.type,
            data: event.target?.result as string
          });
        };
      });
      reader.readAsDataURL(file);
      newReceipts.push(await promise);
    }

    setFormData(prev => ({
      ...prev,
      receipts: [...prev.receipts, ...newReceipts]
    }));
  };

  const removeReceipt = (index: number) => {
    setFormData(prev => ({
      ...prev,
      receipts: prev.receipts.filter((_, i) => i !== index)
    }));
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-display">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-kelly-green/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-kelly-green/10 blur-[120px] rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-6 md:p-10 rounded-[24px] md:rounded-[32px] shadow-2xl max-w-md w-full border-white/5 relative z-10"
        >
          <div className="flex flex-col items-center mb-10">

            <h1 className="text-3xl font-bold text-white tracking-tight glow-text">AI ICON</h1>
            <p className="text-kelly-green text-[10px] mt-2 uppercase tracking-[0.3em] font-bold">Strategic Document Portal</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white font-bold ml-1">Access Protocol</label>
              <button 
                onClick={handleLogin}
                className="w-full bg-kelly-green text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-[#5ce61c] transition-all shadow-[0_0_20px_rgba(76,187,23,0.3)] group"
              >
                <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                Initialize Session
              </button>
            </div>
            
            <div className="flex items-center gap-4 py-2">
              <div className="h-[1px] flex-1 bg-white/10" />
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Secure Environment</span>
              <div className="h-[1px] flex-1 bg-white/10" />
            </div>

            <p className="text-center text-gray-500 text-[10px] leading-relaxed uppercase tracking-wider">
              Designed for smart energy management & IoT platforms. <br/>
              Simplicity, clarity, and trust.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-6 py-4 transition-all relative group ${active ? 'text-kelly-green' : 'text-gray-400 hover:text-white'}`}
    >
      {active && (
        <motion.div 
          layoutId="sidebar-active"
          className="absolute left-0 w-1 h-8 bg-kelly-green rounded-r-full shadow-[0_0_10px_#4CBB17]"
        />
      )}
      <Icon size={20} className={active ? 'glow-text' : ''} />
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      {!active && <div className="absolute inset-0 bg-kelly-green/0 group-hover:bg-kelly-green/5 transition-colors" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex overflow-hidden">
      {error && <ErrorBoundary error={error} onReset={() => setError(null)} />}
      
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 md:top-8 md:right-8 z-[100] bg-kelly-green text-black px-4 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl font-bold shadow-[0_0_30px_rgba(76,187,23,0.4)] flex items-center gap-3 border border-black/10 text-xs md:text-base"
          >
            <CheckCircle2 size={24} />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <AnimatePresence>
        {(isSidebarOpen || window.innerWidth >= 768) && (
          <motion.aside 
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed md:relative w-64 h-full bg-[#0a0a0a] border-r border-white/5 flex flex-col z-50 md:z-40 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
          >
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tighter glow-text">AI ICON</h2>
                  <p className="text-[8px] text-kelly-green font-bold uppercase tracking-[0.2em]">Strategic Portal</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden text-gray-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 py-6 overflow-y-auto">
              <div className="px-6 mb-4">
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Management</p>
              </div>
              <SidebarItem 
                icon={Plus} 
                label="New Mission" 
                active={view === 'form'} 
                onClick={() => { resetForm(); setView('form'); setIsSidebarOpen(false); }} 
              />
              <SidebarItem 
                icon={List} 
                label="Mission Log" 
                active={view === 'list'} 
                onClick={() => { setView('list'); setIsSidebarOpen(false); }} 
              />
              
              <div className="px-6 mt-8 mb-4">
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Operations</p>
              </div>
              <SidebarItem icon={FileIcon} label="Assets" active={false} onClick={() => {}} />
              <SidebarItem icon={FileText} label="Reports" active={false} onClick={() => {}} />
              <SidebarItem icon={AlertCircle} label="Active Issues" active={false} onClick={() => {}} />
            </div>

            <div className="p-6 border-t border-white/5">
              <div className="flex items-center gap-3 mb-6 px-2">
                <div className="w-10 h-10 rounded-full bg-kelly-green/10 border border-kelly-green/20 flex items-center justify-center">
                  <UserIcon size={20} className="text-kelly-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{user.displayName || 'Agent'}</p>
                  <p className="text-[9px] text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-400/5 transition-all text-xs font-bold uppercase tracking-widest"
              >
                <LogOut size={18} />
                Terminate Session
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden w-full">
        {/* Background Gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-kelly-green/5 blur-[150px] rounded-full" />
        </div>

        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-[#050505]/50 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3 md:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 bg-white/5 rounded-lg border border-white/10 text-gray-400"
            >
              <Menu size={20} />
            </button>
            <div className="p-2 bg-kelly-green/10 rounded-lg border border-kelly-green/20">
              {view === 'form' ? <Plus size={20} className="text-kelly-green" /> : <List size={20} className="text-kelly-green" />}
            </div>
            <div>
              <h1 className="text-base md:text-xl font-bold tracking-tight uppercase font-display truncate max-w-[150px] sm:max-w-none">
                {view === 'form' ? (editingId ? 'Final Mission Report' : 'New Strategic Authorization') : 'Mission Log'}
              </h1>
              <p className="text-[8px] md:text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                {view === 'form' ? 'Operational Intelligence Gathering' : 'Historical Strategic Data'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-8">
              <div className="text-right">
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">System Status</p>
                <div className="flex items-center gap-2 justify-end">
                  <div className="w-1.5 h-1.5 bg-kelly-green rounded-full animate-pulse shadow-[0_0_5px_#4CBB17]" />
                  <span className="text-[10px] font-bold text-kelly-green uppercase">Operational</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Encryption</p>
                <div className="flex items-center gap-2 justify-end">
                  <Lock size={12} className="text-kelly-green" />
                  <span className="text-[10px] font-bold text-kelly-green uppercase">AES-256 Active</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10">
          <div className="max-w-5xl mx-auto">
            <AnimatePresence mode="wait">
              {view === 'form' ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="glass-panel rounded-[24px] md:rounded-[32px] overflow-hidden border-white/5"
                >
                  <div className="bg-gradient-to-b from-white/5 to-transparent p-6 md:p-10 text-center border-b border-white/5">
                    <div className="flex flex-col items-center mb-6 md:mb-10">
                      <div className="relative">
                        <div className="absolute inset-0 bg-kelly-green/10 blur-3xl rounded-full" />
                        <img 
                          src="https://mail.google.com/mail/u/0?ui=2&ik=ad5ae8e4c6&attid=0.1&permmsgid=msg-a:r3454779504397814056&th=19d080cbd640f0c6&view=att&disp=safe&realattid=f_mmxzx30k0&zw" 
                          alt="AI ICON Robot" 
                          className="relative h-[100px] w-[100px] md:h-[150px] md:w-[150px] object-contain drop-shadow-[0_0_30px_rgba(76,217,100,0.5)]"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight glow-text font-display">STRATEGIC AUTHORIZATION</h2>
                    <div className="flex flex-wrap justify-center gap-2 md:gap-4 text-[8px] md:text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">
                      <span>PROTOCOL: AI-ICON-EF-2026</span>
                      <span className="text-kelly-green/30">•</span>
                      <span>LEVEL: INTERNAL STRATEGIC</span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-8 md:space-y-12">
                {/* Section I: Personnel & Logistics */}
                <section className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3 text-kelly-green">
                      <UserIcon size={18} className="glow-text" />
                      <span className="text-sm font-bold uppercase tracking-[0.2em] font-display">SECTION I: PERSONNEL & LOGISTICS</span>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-kelly-green/10 border border-kelly-green/20 text-[9px] font-bold text-kelly-green uppercase tracking-widest">Pre-Event Phase</div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Team Member Name</label>
                      <input 
                        required
                        type="text" 
                        value={formData.teamMemberName}
                        onChange={e => setFormData({...formData, teamMemberName: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium"
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          required
                          type="email" 
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium"
                          placeholder="agent@aiicon.org"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Event Name</label>
                      <input 
                        required
                        type="text" 
                        value={formData.eventName}
                        onChange={e => setFormData({...formData, eventName: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium"
                        placeholder="Mission Title"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Start Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          required
                          type="date" 
                          value={formData.startDate}
                          onChange={e => {
                            const newStart = e.target.value;
                            const startDate = new Date(newStart);
                            const endDate = new Date(formData.endDate);
                            let days = 0;
                            if (newStart && formData.endDate) {
                              const diffTime = endDate.getTime() - startDate.getTime();
                              days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                              if (days < 0) days = 0;
                            }
                            setFormData({
                              ...formData, 
                              startDate: newStart,
                              numberOfDays: days,
                              totalTravelPay: (days * formData.perDiemRate) + formData.eventTicketCost
                            });
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium [color-scheme:dark]"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">End Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          required
                          type="date" 
                          value={formData.endDate}
                          onChange={e => {
                            const newEnd = e.target.value;
                            const startDate = new Date(formData.startDate);
                            const endDate = new Date(newEnd);
                            let days = 0;
                            if (formData.startDate && newEnd) {
                              const diffTime = endDate.getTime() - startDate.getTime();
                              days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                              if (days < 0) days = 0;
                            }
                            setFormData({
                              ...formData, 
                              endDate: newEnd,
                              numberOfDays: days,
                              totalTravelPay: (days * formData.perDiemRate) + formData.eventTicketCost
                            });
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium [color-scheme:dark]"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Operational Duration (Days)</label>
                      <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-kelly-green glow-text">
                        {formData.numberOfDays || '0'} DAYS
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Mission Location</label>
                      <div className="relative">
                        <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          required
                          type="text" 
                          value={formData.location}
                          onChange={e => setFormData({...formData, location: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-14 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium"
                          placeholder="City, Country"
                        />
                        {formData.location && (
                          <button
                            type="button"
                            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.location)}`, '_blank')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-kelly-green hover:text-white transition-colors"
                          >
                            <Navigation size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section II: Fiscal Allocation */}
                <section className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3 text-kelly-green">
                      <FileText size={18} className="glow-text" />
                      <span className="text-sm font-bold uppercase tracking-[0.2em] font-display">SECTION II: FISCAL ALLOCATION</span>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-kelly-green/10 border border-kelly-green/20 text-[9px] font-bold text-kelly-green uppercase tracking-widest">Pre-Event Phase</div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Per Diem Rate ($)</label>
                      <input 
                        type="number" 
                        value={formData.perDiemRate || ''}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setFormData({
                            ...formData, 
                            perDiemRate: val, 
                            totalReimbursable: (val * formData.numberOfDays) + formData.eventTicketCost,
                            totalTravelPay: (val * formData.numberOfDays) + formData.eventTicketCost
                          });
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Ticket Cost ($)</label>
                      <input 
                        type="number" 
                        value={formData.eventTicketCost || ''}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setFormData({
                            ...formData, 
                            eventTicketCost: val, 
                            totalReimbursable: (formData.numberOfDays * formData.perDiemRate) + val,
                            totalTravelPay: (formData.numberOfDays * formData.perDiemRate) + val
                          });
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium"
                      />
                    </div>
                    {editingId && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Total Reimbursable ($)</label>
                        <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-kelly-green glow-text">
                          ${formData.totalReimbursable.toFixed(2)}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Total Travel Pay ($)</label>
                      <div className="w-full bg-kelly-green/10 border border-kelly-green/30 rounded-2xl px-5 py-4 text-sm font-bold text-kelly-green glow-text">
                        ${formData.totalTravelPay.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Travel Pay Policy Note */}
                  <div className="p-6 bg-kelly-green/5 rounded-3xl border border-kelly-green/10 flex items-start gap-4">
                    <AlertCircle className="text-kelly-green mt-1" size={20} />
                    <p className="text-[11px] text-gray-400 font-medium leading-relaxed uppercase tracking-wider">
                      <span className="text-kelly-green font-bold">STRATEGIC PROTOCOL:</span> Travel pay must be requested and paid out two weeks prior to the event for proper planning. Not all expenses are reimbursable.
                    </p>
                  </div>

                  {/* Payment Method Selection */}
                  <div className="space-y-6">
                    <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Preferred Payment Protocol</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {['Zelle', 'CashApp', 'Direct Invoice'].map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setFormData({ ...formData, paymentMethod: method as any })}
                          className={`px-6 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] border transition-all ${
                            formData.paymentMethod === method 
                              ? 'bg-kelly-green text-black border-kelly-green shadow-[0_0_20px_rgba(76,187,23,0.3)]' 
                              : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/20'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                    {formData.paymentMethod && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">
                          {formData.paymentMethod === 'Direct Invoice' ? 'Invoice Reference / Email' : `${formData.paymentMethod} Handle / Email`}
                        </label>
                        <input 
                          type="text" 
                          required
                          value={formData.paymentDetails}
                          onChange={(e) => setFormData({ ...formData, paymentDetails: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium"
                          placeholder={`Enter ${formData.paymentMethod} identification...`}
                        />
                      </motion.div>
                    )}
                  </div>
                </section>

                {/* Section III: Mission Objectives & Purpose */}
                <section className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3 text-kelly-green">
                      <Cpu size={18} className="glow-text" />
                      <span className="text-sm font-bold uppercase tracking-[0.2em] font-display">SECTION III: MISSION OBJECTIVES & PURPOSE</span>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-kelly-green/10 border border-kelly-green/20 text-[9px] font-bold text-kelly-green uppercase tracking-widest">Pre-Event Phase</div>
                  </div>
                  
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Strategic Objectives (Select all that apply)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {missionObjectives.map(obj => (
                          <button
                            key={obj}
                            type="button"
                            onClick={() => toggleObjective(obj)}
                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${
                              formData.objectives.includes(obj)
                                ? 'bg-kelly-green/10 border-kelly-green text-white'
                                : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                              formData.objectives.includes(obj) ? 'bg-kelly-green border-kelly-green' : 'border-white/20 group-hover:border-white/40'
                            }`}>
                              {formData.objectives.includes(obj) && <CheckCircle2 size={14} className="text-black" />}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">{obj}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Narrative Summary of Purpose</label>
                      <textarea 
                        rows={4} 
                        value={formData.purposeSummary}
                        onChange={e => setFormData({...formData, purposeSummary: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium resize-none"
                        placeholder="Describe the mission parameters and expected outcomes..."
                      />
                    </div>
                  </div>

                  {!editingId && (
                    <div className="mt-12 pt-12 border-t border-white/10">
                      <button 
                        disabled={submitting}
                        type="submit"
                        className="w-full bg-kelly-green text-black py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(76,187,23,0.4)] transition-all disabled:opacity-50 uppercase tracking-[0.3em] text-xs"
                      >
                        {submitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                        Authorize Pre-Event Strategy
                      </button>
                      <p className="text-center text-[9px] text-gray-500 uppercase font-bold mt-4 tracking-[0.3em]">
                        PHASE 01: PRE-EVENT AUTHORIZATION PROTOCOL
                      </p>
                    </div>
                  )}
                </section>

                {/* Section AI: Strategic Intelligence Analysis */}
                <section className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3 text-kelly-green">
                      <Cpu size={18} className="glow-text" />
                      <span className="text-sm font-bold uppercase tracking-[0.2em] font-display">SECTION AI: STRATEGIC INTELLIGENCE ANALYSIS</span>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-kelly-green/10 border border-kelly-green/20 text-[9px] font-bold text-kelly-green uppercase tracking-widest">AI-Powered Insights</div>
                  </div>
                  
                  <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-white/5 space-y-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-kelly-green/10 flex items-center justify-center text-kelly-green border border-kelly-green/20">
                          <Cpu size={24} className={isAnalyzing ? 'animate-spin' : 'animate-pulse'} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Strategic Briefing Generator</h3>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Leverage Gemini to analyze mission objectives and identify innovation opportunities.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isAnalyzing || !formData.eventName || !formData.purposeSummary}
                        onClick={generateAiAnalysis}
                        className="px-6 py-3 bg-kelly-green text-black rounded-xl font-bold text-[10px] uppercase tracking-widest hover:shadow-[0_0_20px_rgba(76,187,23,0.3)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:grayscale"
                      >
                        {isAnalyzing ? <Loader2 className="animate-spin" size={14} /> : <Cpu size={14} />}
                        {formData.aiAnalysis ? 'Regenerate Analysis' : 'Generate Strategic Brief'}
                      </button>
                    </div>

                    {formData.aiAnalysis && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-6 p-6 bg-black/40 rounded-2xl border border-kelly-green/20 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap"
                      >
                        <div className="flex items-center gap-2 mb-4 text-kelly-green border-b border-kelly-green/10 pb-2">
                          <Shield size={14} />
                          <span className="font-bold uppercase tracking-widest">Classified Strategic Briefing</span>
                        </div>
                        {formData.aiAnalysis}
                      </motion.div>
                    )}
                  </div>
                </section>

                {/* Section IV: Event Storyboard & Reconnaissance */}
                <section className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3 text-kelly-green">
                      <Camera size={18} className="glow-text" />
                      <span className="text-sm font-bold uppercase tracking-[0.2em] font-display">SECTION IV: EVENT STORYBOARD & RECONNAISSANCE</span>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase tracking-widest">Post-Event Phase</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Operational Flow & Friction Points</label>
                      <p className="text-[9px] text-gray-500 mb-2 italic uppercase tracking-wider">Identify friction points (e.g., registration delays, poor tech) to ensure AI ICON remains the gold standard.</p>
                      <textarea 
                        rows={3} 
                        value={formData.operationalFlow}
                        onChange={e => setFormData({...formData, operationalFlow: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium resize-none"
                        placeholder="Detailed timeline and narrative of the event execution..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">AI Integration Audit</label>
                      <p className="text-[9px] text-gray-500 mb-2 italic uppercase tracking-wider">Did the event "Enhance AI IQ" through its own operations (e.g., AI chatbots, generative art)?</p>
                      <textarea 
                        rows={3} 
                        value={formData.aiIntegrationAudit}
                        onChange={e => setFormData({...formData, aiIntegrationAudit: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium resize-none"
                        placeholder="How was AI utilized during this mission?"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Strategic Takeaways & "Flight Simulator" Lessons</label>
                      <p className="text-[9px] text-gray-500 mb-2 italic uppercase tracking-wider">List key insights gathered through hands-on observation rather than just theory.</p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold text-kelly-green glow-text w-4">A</span>
                          <input 
                            type="text" 
                            value={formData.takeawayA}
                            onChange={e => setFormData({...formData, takeawayA: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium"
                            placeholder="Primary Insight"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold text-kelly-green glow-text w-4">B</span>
                          <input 
                            type="text" 
                            value={formData.takeawayB}
                            onChange={e => setFormData({...formData, takeawayB: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium"
                            placeholder="Secondary Insight"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Sponsor & Educator Lead Log</label>
                      <p className="text-[9px] text-gray-500 mb-2 italic uppercase tracking-wider">List entities for Ronnie Russell (partnership@aiicon.org) to contact.</p>
                      <textarea 
                        rows={3} 
                        value={formData.leadLog}
                        onChange={e => setFormData({...formData, leadLog: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium resize-none"
                        placeholder="New connections and potential opportunities..."
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Media/Storyboard Attachments</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {attachmentOptions.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleAttachment(opt)}
                          className={`flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all group ${
                            formData.attachments.includes(opt)
                              ? 'bg-kelly-green/10 border-kelly-green text-white'
                              : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                            formData.attachments.includes(opt) ? 'bg-kelly-green text-black' : 'bg-white/5 group-hover:bg-white/10'
                          }`}>
                            {opt === 'Photos' && <Camera size={20} />}
                            {opt === 'Videos' && <Video size={20} />}
                            {opt === 'Social Media' && <Share2 size={20} />}
                            {opt === 'Other' && <FileText size={20} />}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest">{opt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Section V: Authorization & Signatures */}
                <section className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3 text-kelly-green">
                      <CheckCircle2 size={18} className="glow-text" />
                      <span className="text-sm font-bold uppercase tracking-[0.2em] font-display">SECTION V: AUTHORIZATION & SIGNATURES</span>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase tracking-widest">Post-Event Phase</div>
                  </div>

                  {/* Receipt Upload Sub-section */}
                  <div className="glass-panel p-6 md:p-8 rounded-2xl md:rounded-3xl border border-white/5">
                    <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1 mb-4 block">Final Receipt Documentation</label>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                      <div className="relative group">
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf"
                          onChange={handleFileUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="border-2 border-dashed border-white/10 rounded-2xl p-6 md:p-10 flex flex-col items-center justify-center gap-4 group-hover:border-kelly-green transition-all bg-white/5">
                          <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-kelly-green/10 flex items-center justify-center text-kelly-green group-hover:bg-kelly-green group-hover:text-black transition-all">
                            <Upload size={24} />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-bold text-white uppercase tracking-widest">Click or Drag Receipts</p>
                            <p className="text-[10px] text-gray-500 uppercase mt-1">Images or PDF (Max 500KB each)</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {formData.receipts.map((receipt, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-white/10 transition-all">
                            <div className="flex items-center gap-4 overflow-hidden">
                              <div className="p-3 bg-kelly-green/10 rounded-xl text-kelly-green">
                                <FileText size={20} />
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-xs font-bold text-white truncate">{receipt.name}</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">{(receipt.data.length * 0.75 / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeReceipt(idx)}
                              className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ))}
                        {formData.receipts.length === 0 && (
                          <div className="h-full min-h-[150px] flex items-center justify-center border border-dashed border-white/5 rounded-2xl p-6 bg-white/5">
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.2em]">No receipts uploaded</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Team Member Signature</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Type full name as signature"
                        value={formData.signature}
                        onChange={e => setFormData({...formData, signature: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium italic font-serif"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white uppercase tracking-widest ml-1">Date of Authorization</label>
                      <input 
                        required
                        type="date" 
                        value={formData.signatureDate}
                        onChange={e => setFormData({...formData, signatureDate: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-kelly-green focus:ring-1 focus:ring-kelly-green/30 outline-none transition-all text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div className="mt-12 pt-12 border-t border-white/10">
                    <button 
                      disabled={submitting}
                      type="submit"
                      className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all disabled:opacity-50 uppercase tracking-[0.3em] text-xs"
                    >
                      {submitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                      Authorize Final Mission Report
                    </button>
                    <p className="text-center text-[9px] text-gray-500 uppercase font-bold mt-4 tracking-[0.3em]">
                      PHASE 02: POST-EVENT RECONNAISSANCE PROTOCOL
                    </p>
                  </div>
                </section>

                <div className="mt-10 pt-10 border-t border-gray-100">
                  {editingId ? (
                    <>
                      <button 
                        disabled={submitting}
                        type="submit"
                        className="w-full bg-[#00FF00] text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-[#00CC00] transition-all shadow-lg disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                        Submit Final Post-Event Reconnaissance
                      </button>
                      <p className="text-center text-[10px] text-gray-400 uppercase font-bold mt-3 tracking-widest">
                        Phase 2 of 2: Final Mission Completion
                      </p>
                    </>
                  ) : (
                    <div className="opacity-40 grayscale cursor-not-allowed">
                      <button 
                        disabled
                        type="button"
                        className="w-full bg-gray-100 text-gray-400 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 border border-gray-200"
                      >
                        <Lock size={20} />
                        Submit Final Post-Event Reconnaissance
                      </button>
                      <p className="text-center text-[10px] text-gray-400 uppercase font-bold mt-3 tracking-widest">
                        Locked: Submit Pre-Event Strategic Document First
                      </p>
                    </div>
                  )}
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {activeTab === 'list' ? (
                <>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-kelly-green/10 flex items-center justify-center text-kelly-green border border-kelly-green/20">
                        <List size={24} className="glow-text" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold font-display uppercase tracking-[0.2em] text-white">Mission Log</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Operational History & Intelligence</p>
                      </div>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                      <span className="text-xs font-bold text-white">{submissions.length}</span>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active Records</span>
                    </div>
                  </div>

                  {submissions.length === 0 ? (
                    <div className="glass-panel rounded-3xl p-20 text-center border border-white/5">
                      <div className="w-20 h-20 bg-white/5 text-gray-600 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/5">
                        <FileText size={40} />
                      </div>
                      <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">No Active Missions</h3>
                      <p className="text-gray-500 text-sm max-w-xs mx-auto">The mission log is currently empty. Initiate a new mission protocol to begin tracking.</p>
                      <button 
                        onClick={() => setActiveTab('new')}
                        className="mt-8 px-8 py-3 bg-kelly-green text-black rounded-xl font-bold text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(76,187,23,0.3)] transition-all"
                      >
                        Initiate Mission
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:gap-6">
                      {submissions.map((sub) => (
                        <motion.div 
                          layout
                          key={sub.id}
                          className="glass-panel p-6 md:p-8 rounded-2xl md:rounded-3xl border border-white/5 hover:border-kelly-green/30 transition-all group relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-kelly-green/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-kelly-green/10 transition-all"></div>
                          
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 w-full">
                              <div className="space-y-4 flex-1 w-full">
                                <div>
                                  <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <h3 className="text-lg md:text-xl font-bold text-white font-display uppercase tracking-wider truncate max-w-[200px] sm:max-w-none">{sub.eventName}</h3>
                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest border whitespace-nowrap ${
                                      sub.status === 'POST_EVENT' 
                                        ? 'bg-kelly-green/10 text-kelly-green border-kelly-green/20' 
                                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                      {sub.status === 'POST_EVENT' ? 'Finalized' : 'Pre-Event'}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                    <span className="flex items-center gap-2">
                                      <Calendar size={14} className="text-kelly-green" />
                                      {sub.startDate} — {sub.endDate}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <MapPin size={14} className="text-kelly-green" />
                                      <span className="truncate max-w-[150px]">{sub.location || 'Undisclosed Location'}</span>
                                      {sub.location && (
                                        <button
                                          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sub.location)}`, '_blank')}
                                          className="p-1 hover:text-white transition-colors"
                                          title="View on Google Maps"
                                        >
                                          <Navigation size={12} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {sub.objectives.map(obj => (
                                    <span key={obj} className="bg-white/5 text-gray-400 px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-white/5">
                                      {obj}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start w-full md:w-auto gap-4 md:gap-6 pt-4 md:pt-0 border-t md:border-t-0 border-white/5">
                                <div className="text-left md:text-right">
                                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1">Mission Value</p>
                                  <p className="text-xl md:text-2xl font-bold text-white font-display">${sub.totalReimbursable}</p>
                                  {sub.receipts && sub.receipts.length > 0 && (
                                    <div className="flex items-center justify-start md:justify-end gap-2 mt-2 text-[9px] font-bold text-kelly-green uppercase tracking-widest">
                                      <FileText size={10} />
                                      {sub.receipts.length} Documentation Files
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <div className="text-right hidden sm:block">
                                    <p className="text-[9px] font-bold text-white uppercase tracking-widest">{sub.teamMemberName}</p>
                                    <p className="text-[8px] text-gray-500 uppercase tracking-widest">{sub.email}</p>
                                  </div>
                                  <div className="w-10 h-10 rounded-xl bg-kelly-green/10 border border-kelly-green/20 flex items-center justify-center text-kelly-green font-bold text-sm">
                                    {sub.teamMemberName?.charAt(0) || 'U'}
                                  </div>
                                </div>
                              </div>
                            </div>

                          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
                            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.3em]">
                              Record ID: {sub.id.slice(-8).toUpperCase()} • {new Date(sub.createdAt).toLocaleDateString()}
                            </span>
                            <div className="flex items-center gap-3">
                              {sub.status !== 'POST_EVENT' && (
                                <button
                                  onClick={() => handleResume(sub)}
                                  className="px-4 py-2 rounded-lg bg-kelly-green text-black text-[10px] font-bold uppercase tracking-widest hover:shadow-[0_0_15px_rgba(76,187,23,0.3)] transition-all"
                                >
                                  Complete Mission
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(sub.id)}
                                className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-all border border-white/5"
                                title="Purge Record"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="glass-panel rounded-3xl p-20 text-center border border-white/5">
                  <div className="w-20 h-20 bg-kelly-green/10 text-kelly-green rounded-3xl flex items-center justify-center mx-auto mb-6 border border-kelly-green/20">
                    {activeTab === 'assets' && <Shield size={40} className="glow-text" />}
                    {activeTab === 'reports' && <BarChart3 size={40} className="glow-text" />}
                    {activeTab === 'issues' && <AlertCircle size={40} className="glow-text" />}
                  </div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">
                    {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Module
                  </h3>
                  <p className="text-gray-500 text-sm max-w-xs mx-auto">
                    This module is currently initializing. Strategic data for {activeTab} will be available in the next system update.
                  </p>
                  <div className="mt-8 flex justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-kelly-green animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-kelly-green animate-pulse delay-75"></div>
                    <div className="w-2 h-2 rounded-full bg-kelly-green animate-pulse delay-150"></div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
          </div>
        </div>

        <footer className="max-w-3xl mx-auto px-4 py-12 text-center text-gray-400 text-xs">
          <p>© {new Date().getFullYear()} AI ICON Event Engagement. Professional Grade AI Integration.</p>
        </footer>
      </div>
    </div>
  );
}
