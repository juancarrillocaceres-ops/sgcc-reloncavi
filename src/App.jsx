import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  LayoutDashboard, Users, FileText, AlertTriangle, CheckCircle, Clock, Plus, Activity, LogOut,
  Bell, Copy, Loader2, Edit2, Trash2, ListTodo, MessageSquare, CheckSquare, Square, Calendar,
  UploadCloud, Lock, User, ClipboardCheck, BookOpen, Download, Wand2, Settings, UserPlus, 
  Shield, Key, Timer, TrendingUp, BarChart3, Target, Printer, Search, ExternalLink, 
  BrainCircuit, Sparkles, ShieldAlert
} from 'lucide-react';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyADlW5WRPWOokJQbVFUF9UuYRxLXa4-MqU",
  authDomain: "sgcc-reloncavi.firebaseapp.com",
  projectId: "sgcc-reloncavi",
  storageBucket: "sgcc-reloncavi.firebasestorage.app",
  messagingSenderId: "247963397382",
  appId: "1:247963397382:web:972ee82f2cc7b8f7760287",
  measurementId: "G-KCWQ4H964D"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : "sgcc-reloncavi-v1";

// --- UTILIDADES ---
const safeArr = (arr) => Array.isArray(arr) ? arr : [];
const safeStr = (str) => (str !== null && str !== undefined) ? String(str) : '';
const diffInDays = (d1, d2) => (!d1 || !d2) ? null : Math.ceil(Math.abs(new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24));

const getTaskStatus = (fecha) => {
  if (!fecha || typeof fecha !== 'string' || !fecha.includes('-')) return { status: 'none', bgClass: 'bg-slate-100 text-slate-700', showWarning: false };
  const [y, m, d] = fecha.split('-');
  const diffDays = Math.ceil((new Date(y, m - 1, d).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { status: 'overdue', bgClass: 'bg-red-100 text-red-800', showWarning: true };
  if (diffDays <= 10) return { status: 'upcoming', bgClass: 'bg-amber-100 text-amber-800', showWarning: true };
  return { status: 'safe', bgClass: 'bg-emerald-100 text-emerald-800', showWarning: false };
};

const getSemaforoDoc = (fechaResolucion, oficiales) => {
  if (!safeArr(oficiales).length) return { color: 'red', label: '🔴 Inexistente / Sin Firma' };
  const days = diffInDays(fechaResolucion, new Date().toISOString().split('T')[0]);
  if (days === null || days > (3 * 365)) return { color: 'amber', label: '🟡 Desactualizado' };
  return { color: 'emerald', label: '🟢 Vigente' };
};

const generateAI = async (apiKey, prompt, sys = "", inlineData = null) => {
  if (!apiKey) throw new Error("Falta Clave API");
  const parts = [{ text: prompt }];
  if (inlineData) {
    let mime = inlineData.mimeType;
    if (!mime || mime === 'application/octet-stream' || mime === '') mime = 'application/pdf'; 
    parts.push({ inlineData: { mimeType: mime, data: inlineData.data } });
  }
  const payload = { contents: [{ parts }], systemInstruction: { parts: [{ text: sys || "Eres un experto en salud mental." }] } };
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`API Error ${res.status}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta.";
    } catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 1000)); }
  }
};

// --- COMPONENTES UI ---
const clsInp = "w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 bg-white shadow-sm transition-colors";
const clsLbl = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 mt-2";
const clsBtnP = "bg-blue-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer";
const clsBtnS = "px-5 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors cursor-pointer";

const Inp = (p) => <input {...p} className={`${clsInp} ${p.className||''}`} />;
const Txt = (p) => <textarea {...p} className={`${clsInp} resize-y ${p.className||''}`} />;
const Sel = (p) => <select {...p} className={`${clsInp} ${p.className||''}`}>{p.children}</select>;
const Lbl = (p) => <label className={`${clsLbl} ${p.className||''}`}>{p.children}</label>;

const ModalWrap = ({ isOpen, children, mw }) => isOpen ? (<div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in no-print"><div className={`bg-white rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden border border-slate-200 max-h-[90vh] ${mw || 'max-w-4xl'}`}>{children}</div></div>) : null;
const ModalHdr = ({ t, onClose, icon: Icon }) => (<div className="bg-slate-800 p-5 text-white flex justify-between items-center shrink-0"><h3 className="font-black text-lg uppercase tracking-widest flex items-center gap-2">{Icon && <Icon size={20}/>} {t}</h3><button onClick={onClose} className="text-white/60 hover:text-white font-bold text-3xl cursor-pointer">&times;</button></div>);
const ModalFtr = ({ onCancel, onSave, saveTxt, disableSave }) => (<div className="bg-slate-50 p-5 border-t border-slate-200 flex justify-end gap-3 shrink-0"><button onClick={onCancel} className={clsBtnS}>Cancelar</button><button onClick={onSave} disabled={disableSave} className={clsBtnP}>{saveTxt || 'Guardar'}</button></div>);

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ rut: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [dbStatus, setDbStatus] = useState('Autenticando...');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [centros, setCentros] = useState([]);
  const [cases, setCases] = useState([]);
  const [docs, setDocs] = useState([]);
  const [audits, setAudits] = useState([]);
  const [auditTemplates, setAuditTemplates] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [users, setUsers] = useState([]);
  const [appConfig, setAppConfig] = useState({ targetDays: 7, apiKey: '', plazos: {} });
  
  // Estados de Fichas
  const [caseForm, setCaseForm] = useState({ rut: '', nombre: '', edad: '', origen: '', destino: '', prioridad: 'Media', estado: 'Pendiente', fechaEgreso: new Date().toISOString().split('T')[0], bitacora: [], archivos: [] });
  const [docForm, setDocForm] = useState({ nombre: '', ambito: 'Red Integral', fase: 'Levantamiento', avance: 0, prioridad: 'Media', bitacora: [], archivos: [], archivosOficiales: [] });
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('datos');
  const [activeDocModalTab, setActiveDocModalTab] = useState('datos');
  const [newBitacoraEntry, setNewBitacoraEntry] = useState({ tipo: 'Nota Adm.', descripcion: '', responsable: '', barrera: 'Ninguna' });
  const [newDocBitacoraEntry, setNewDocBitacoraEntry] = useState({ tipo: 'Tarea', descripcion: '', responsable: '' });
  
  // Estados IA
  const [aiFileContext, setAiFileContext] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isGeneratingCaseSummary, setIsGeneratingCaseSummary] = useState(false);
  const [caseSummary, setCaseSummary] = useState('');

  const [isUploadingCaseFile, setIsUploadingCaseFile] = useState(false);
  const [isUploadingDocFile, setIsUploadingDocFile] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.warn("Auth", e.message);
        setDbStatus('⚠️ Error Firebase: Habilita Anónimo');
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, u => { setFirebaseUser(u); if(u) setDbStatus('Conexión Segura'); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.uid) return;
    
    // Interceptor blindado para errores de Firebase (especialmente permission-denied)
    const errH = (err) => { 
      console.error("Firestore Error:", err); 
      if (err.code === 'permission-denied') {
        setDbStatus('⚠️ PERMISO DENEGADO: Actualiza las reglas de Firestore (Ver instrucciones).');
      } else {
        setDbStatus('⚠️ Error DB: ' + err.message);
      }
    };

    const unsubCases = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'cases'), snap => setCases(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubDocs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'docs'), snap => setDocs(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubAudits = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'audits'), snap => setAudits(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), snap => setUsers(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubTemplates = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'auditTemplates'), snap => setAuditTemplates(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubCentros = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'centros'), snap => { if (snap.exists()) setCentros(safeArr(snap.data().list)); }, errH);
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), snap => { if (snap.exists()) { setAppConfig(prev => ({...prev, ...snap.data()})); } }, errH);
    
    return () => { unsubCases(); unsubDocs(); unsubAudits(); unsubUsers(); unsubTemplates(); unsubCentros(); unsubConfig(); };
  }, [firebaseUser]);

  const saveToCloud = async (coll, id, data) => { if (firebaseUser) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id.toString()), data); };
  const deleteFromCloud = async (coll, id) => { if (firebaseUser) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id.toString())); };

  const visibleCases = useMemo(() => {
    if (currentUser?.rol === 'Admin') return cases;
    const assigned = safeArr(currentUser?.centrosAsignados);
    return cases.filter(c => assigned.includes(c.origen) || assigned.includes(c.destino));
  }, [cases, currentUser]);

  const proactiveAlerts = useMemo(() => {
    const alerts = [];
    visibleCases.forEach(c => {
      const days = diffInDays(c.fechaEgreso, new Date().toISOString().split('T')[0]);
      const target = appConfig.plazos?.[c.destino] || appConfig.targetDays;
      if (c.estado === 'Pendiente' && days > target) {
        alerts.push({ id: c.id, type: 'critical', title: `Atraso: ${c.nombre}`, desc: `Supera meta (${target} días) hacia ${c.destino}.` });
      }
      if (safeArr(c.bitacora).filter(b => b.barrera === 'Inasistencia Usuario').length >= 2) {
        alerts.push({ id: `risk-${c.id}`, type: 'risk', title: `Riesgo Abandono: ${c.nombre}`, desc: `Múltiples inasistencias registradas.` });
      }
    });
    return alerts;
  }, [visibleCases, appConfig]);

  const allPendingTasks = useMemo(() => {
    return [
      ...safeArr(visibleCases).flatMap(c => safeArr(c.bitacora).filter(b => b.tipo === 'Tarea' && !b.completada).map(b => ({ ...b, parentId: c.id, parentName: c.nombre, source: 'Caso' }))),
      ...safeArr(docs).flatMap(d => safeArr(d.bitacora).filter(b => b.tipo === 'Tarea' && !b.completada).map(b => ({ ...b, parentId: d.id, parentName: d.nombre, source: 'Protocolo' })))
    ].sort((a, b) => safeStr(a.fechaCumplimiento || '9999-99-99').localeCompare(safeStr(b.fechaCumplimiento || '9999-99-99')));
  }, [visibleCases, docs]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.rut === 'admin' && loginData.password === 'reloncavi') return setCurrentUser({ rut: 'admin', nombre: 'Admin Emergencia', iniciales: 'ADM', rol: 'Admin' });
    const user = safeArr(users).find(u => u.rut === loginData.rut && u.password === loginData.password);
    if (user) { setCurrentUser(user); setLoginError(''); } else { setLoginError('Credenciales incorrectas'); }
  };

  const handleAskAiAboutFile = async () => {
    if (!appConfig.apiKey) return alert("Falta API Key de IA.");
    if (!aiPrompt.trim()) return;
    setIsAnalyzingFile(true); setAiResponse('');
    try {
      const res = await fetch(aiFileContext.url);
      if (!res.ok) throw new Error("CORS o Permisos");
      const blob = await res.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const result = await generateAI(appConfig.apiKey, `${aiPrompt}\n\n[Documento: ${aiFileContext.nombre}]`, "Responde basándote en el documento clínico.", { mimeType: blob.type || 'application/pdf', data: reader.result.split(',')[1] });
          setAiResponse(result);
        } catch (err) { setAiResponse(`⚠️ Error IA: ${err.message}`); }
        setIsAnalyzingFile(false);
      };
    } catch (e) {
      setAiResponse("⚠️ Error de descarga (CORS). Firebase bloquea la IA. Por favor, aplica las reglas CORS de gsutil en Google Cloud Shell.");
      setIsAnalyzingFile(false);
    }
  };

  const handleAddBitacora = () => {
    if (!newBitacoraEntry.descripcion) return;
    setCaseForm({ ...caseForm, bitacora: [{ id: Date.now(), ...newBitacoraEntry, fecha: new Date().toISOString().split('T')[0], completada: false }, ...safeArr(caseForm.bitacora)] });
    setNewBitacoraEntry({ tipo: 'Nota Adm.', descripcion: '', responsable: '', barrera: 'Ninguna' });
  };
  
  const toggleTaskCompletion = async (caseId, entryId) => {
     const caso = safeArr(cases).find(c => c.id === caseId);
     if (!caso) return;
     const updatedBitacora = safeArr(caso.bitacora).map(entry => entry.id === entryId ? { ...entry, completada: !entry.completada } : entry);
     await saveToCloud('cases', caseId, { ...caso, bitacora: updatedBitacora });
  };

  const handleAddDocBitacora = () => {
    if (!newDocBitacoraEntry.descripcion) return;
    setDocForm(prev => ({ ...prev, bitacora: [{ id: Date.now(), ...newDocBitacoraEntry, fecha: new Date().toISOString().split('T')[0], completada: false }, ...safeArr(prev.bitacora)] }));
    setNewDocBitacoraEntry({ tipo: 'Tarea', descripcion: '', responsable: '' });
  };

  const toggleDocTaskCompletion = async (docId, entryId) => {
     const documento = safeArr(docs).find(d => d.id === docId);
     if (!documento) return;
     const updatedBitacora = safeArr(documento.bitacora).map(entry => entry.id === entryId ? { ...entry, completada: !entry.completada } : entry);
     const tareas = updatedBitacora.filter(b => b.tipo === 'Tarea');
     const nuevoAvance = tareas.length > 0 ? Math.round((tareas.filter(t => t.completada).length / tareas.length) * 100) : documento.avance;
     await saveToCloud('docs', docId, { ...documento, bitacora: updatedBitacora, avance: nuevoAvance });
  };

  const handleSaveDoc = async () => {
    if(!docForm.nombre) return alert("Nombre obligatorio");
    const tareas = safeArr(docForm.bitacora).filter(b => b.tipo === 'Tarea');
    const avance = tareas.length > 0 ? Math.round((tareas.filter(t => t.completada).length / tareas.length) * 100) : (docForm.avance || 0);
    const finalId = editingDocId || `DOC-${String(docs.length + 1).padStart(3, '0')}`;
    await saveToCloud('docs', finalId, { ...docForm, id: finalId, avance });
    setIsDocModalOpen(false); setEditingDocId(null);
  };

  const handleCaseFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingCaseFile(true);
    try {
      const storageRef = ref(storage, `casos/${editingCaseId || 'nuevo'}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setCaseForm(prev => ({ ...prev, archivos: [{ id: Date.now().toString(), nombre: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB', url }, ...safeArr(prev.archivos)] }));
    } catch (err) { alert("Error subiendo a Storage"); } finally { setIsUploadingCaseFile(false); }
  };

  const handleDocFileUpload = async (e, targetArray = 'archivos') => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingDocFile(true);
    try {
      const storageRef = ref(storage, `protocolos/${editingDocId || 'nuevo'}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setDocForm(prev => ({ ...prev, [targetArray]: [{ id: Date.now().toString(), nombre: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB', url }, ...safeArr(prev[targetArray])] }));
    } catch (err) { alert("Error subiendo a Storage"); } finally { setIsUploadingDocFile(false); }
  };

  const handleExportCSV = () => {
    const BOM = '\uFEFF';
    const headers = ['ID', 'Paciente', 'Origen', 'Destino', 'Estado', 'Barrera_Detectada'];
    const rows = visibleCases.map(c => [c.id, c.nombre, c.origen, c.destino, c.estado, safeArr(c.bitacora)[0]?.barrera || 'Ninguna']);
    const csvContent = BOM + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Reporte_Red.csv`; link.click();
  };

  if (!currentUser) return (
    <div className="min-h-screen bg-[#0a2540] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-10 text-center shadow-2xl">
        <Activity size={48} className="text-blue-600 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-slate-800">SGCC-SM</h1>
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1 mb-8">Hospital Puerto Montt</p>
        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <Lbl>RUT de Usuario</Lbl><Inp type="text" value={loginData.rut} onChange={e=>setLoginData({...loginData, rut: e.target.value})} placeholder="11.222.333-4" />
          <Lbl>Contraseña</Lbl><Inp type="password" value={loginData.password} onChange={e=>setLoginData({...loginData, password: e.target.value})} placeholder="••••" />
          <button className={clsBtnP + " w-full py-4 mt-4"}>Ingresar al Sistema</button>
        </form>
        <p className={`text-[9px] mt-6 uppercase font-black ${dbStatus.includes('DENEGADO') || dbStatus.includes('Error') ? 'text-red-500' : 'text-slate-400'}`}>{dbStatus}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans print:hidden">
      <aside className="w-full md:w-64 bg-[#0a2540] text-white flex flex-col h-screen sticky top-0 shrink-0 shadow-xl overflow-y-auto">
        <div className="p-6 border-b border-white/5"><h1 className="text-xl font-black">SGCC-SM</h1><p className="text-[10px] text-blue-400 font-bold uppercase">UHCIP INFANTO JUVENIL</p></div>
        <nav className="flex-1 p-3 space-y-1">
          <button onClick={()=>setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'dashboard' ? 'bg-blue-600' : 'opacity-70 hover:opacity-100'}`}><LayoutDashboard size={18}/> Panel Principal</button>
          <button onClick={()=>setActiveTab('cases')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'cases' ? 'bg-blue-600' : 'opacity-70 hover:opacity-100'}`}><Users size={18}/> Casos de Red</button>
          <button onClick={()=>setActiveTab('docs')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'docs' ? 'bg-blue-600' : 'opacity-70 hover:opacity-100'}`}><FileText size={18}/> Protocolos</button>
        </nav>
        <div className="p-4 border-t border-white/5 bg-[#071c31]"><button onClick={()=>setCurrentUser(null)} className="w-full py-2 text-[10px] uppercase font-black text-red-400 hover:bg-red-500/10 rounded-lg">Cerrar Sesión</button></div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-black text-slate-800">Panel de Gestión Integral</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border-l-4 border-red-500 shadow-sm"><p className="text-[9px] text-slate-400 font-black uppercase">Pérdida Continuidad</p><h3 className="text-2xl font-black text-red-600">{visibleCases.filter(c=>c.estado==='Alerta').length}</h3></div>
              <div className="bg-white p-4 rounded-2xl border-l-4 border-blue-500 shadow-sm"><p className="text-[9px] text-slate-400 font-black uppercase">En Tránsito</p><h3 className="text-2xl font-black text-blue-600">{visibleCases.filter(c=>c.estado==='Pendiente').length}</h3></div>
              <div className="bg-white p-4 rounded-2xl border-l-4 border-teal-500 shadow-sm"><p className="text-[9px] text-slate-400 font-black uppercase">Alertas IA</p><h3 className="text-2xl font-black text-teal-600">{proactiveAlerts.length}</h3></div>
              <div className="bg-white p-4 rounded-2xl border-l-4 border-indigo-500 shadow-sm"><p className="text-[9px] text-slate-400 font-black uppercase">Auditorías</p><h3 className="text-2xl font-black text-indigo-600">{audits.length}</h3></div>
            </div>

            {/* DASHBOARD EJECUTIVO PARA JEFATURA RESTAURADO */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-700 relative overflow-hidden">
               <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
               <div className="flex items-center gap-4 relative z-10">
                 <div className="p-4 bg-white/10 rounded-2xl text-blue-400"><Shield size={32}/></div>
                 <div>
                   <h3 className="text-sm font-black uppercase tracking-[0.2em] text-blue-400 mb-1">Estatus Normativo y Resolutivo de Red</h3>
                   <p className="text-xs font-medium text-slate-300 leading-relaxed">Actualmente tenemos <strong className="text-white underline">{safeArr(docs).filter(d => d.fase === 'Validación Técnica').length} protocolos</strong> en Fase de Validación Técnica y <strong className="text-white underline">{safeArr(docs).filter(d => d.prioridad === 'Alta').length} con Prioridad Alta</strong> que requieren sanción directiva.</p>
                 </div>
               </div>
               <button onClick={()=>setActiveTab('docs')} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shrink-0 relative z-10">Gestionar Normas</button>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
               <h3 className="text-xs font-black uppercase mb-4 flex items-center gap-2 text-slate-800"><AlertTriangle size={16} className="text-red-500"/> Riesgos Proactivos IA</h3>
               {proactiveAlerts.map(a => (
                 <div key={a.id} className="p-4 bg-red-50 border border-red-100 rounded-xl mb-2 flex items-start gap-4">
                    <div className="p-2 bg-white rounded-lg text-red-500 shadow-sm"><ShieldAlert size={16}/></div>
                    <div><p className="text-sm font-black text-red-900">{a.title}</p><p className="text-xs text-red-700">{a.desc}</p></div>
                 </div>
               ))}
               {proactiveAlerts.length === 0 && <p className="text-xs text-slate-400 font-bold uppercase text-center py-4">No se detectan nudos críticos hoy</p>}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-xs font-black uppercase mb-4 flex items-center gap-2"><ListTodo size={16} className="text-blue-500"/> Tareas Críticas de Seguimiento</h3>
              <div className="overflow-x-auto"><table className="w-full text-left">
                <thead><tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-400"><th className="p-3 w-10">Est.</th><th className="p-3">Paciente/Protocolo</th><th className="p-3">Tarea</th><th className="p-3">Vencimiento</th></tr></thead>
                <tbody>{allPendingTasks.map(t => (<tr key={t.id} className="border-b border-slate-50">
                  <td className="p-3 text-slate-300"><button onClick={() => t.source === 'Caso' ? toggleTaskCompletion(t.parentId, t.id) : toggleDocTaskCompletion(t.parentId, t.id)} className="hover:text-emerald-500"><Square size={16} /></button></td>
                  <td className="p-3 text-xs font-bold">{t.parentName}</td><td className="p-3 text-xs text-slate-600">{t.descripcion}</td><td className="p-3"><span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${getTaskStatus(t.fechaCumplimiento).bgClass}`}>{t.fechaCumplimiento}</span></td></tr>))}
                  {allPendingTasks.length === 0 && (<tr><td colSpan="4" className="p-6 text-center text-slate-400 font-bold text-xs uppercase">Sin tareas pendientes.</td></tr>)}
                </tbody>
              </table></div>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: CASOS DE RED */}
        {activeTab === 'cases' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-end"><h2 className="text-2xl font-black text-slate-800">Seguimiento de Red</h2>
            <div className="flex gap-2">
              <button onClick={handleExportCSV} className={clsBtnS + " bg-emerald-100 hover:bg-emerald-200 text-emerald-700"}><Download size={14} className="inline mr-1"/> Exportar Excel</button>
              <button onClick={()=>{setCaseForm({ rut:'', nombre:'', edad:'', origen:'', destino:'', prioridad:'Media', estado:'Pendiente', fechaEgreso: new Date().toISOString().split('T')[0], bitacora:[], archivos:[] }); setIsCaseModalOpen(true);}} className={clsBtnP}><Plus size={16}/> Nuevo Caso</button>
            </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
               <table className="w-full text-left">
                 <thead className="bg-slate-50 border-b"><tr className="text-[10px] font-black uppercase text-slate-400"><th className="p-4">Paciente</th><th className="p-4">Ruta</th><th className="p-4 text-center">Estado</th><th className="p-4 text-right">Acción</th></tr></thead>
                 <tbody>{visibleCases.map(c => (
                   <tr key={c.id} className="border-b hover:bg-slate-50">
                     <td className="p-4"><p className="font-bold text-sm uppercase">{c.nombre}</p><p className="text-[10px] text-slate-400">{c.paciente}</p></td>
                     <td className="p-4 text-xs font-black text-blue-600 uppercase">{c.origen} → {c.destino}</td>
                     <td className="p-4"><div className="flex justify-center"><StatusBadge status={c.estado}/></div></td>
                     <td className="p-4 text-right"><button onClick={()=>{setCaseForm(c); setIsCaseModalOpen(true);}} className="p-2 text-slate-300 hover:text-blue-600"><Edit2 size={20}/></button></td>
                   </tr>
                 ))}</tbody>
               </table>
            </div>
          </div>
        )}

        {/* PESTAÑA 4: PROTOCOLOS */}
        {activeTab === 'docs' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-end"><h2 className="text-2xl font-black text-slate-800">Gestión Normativa de Red</h2><button onClick={()=>{setDocForm({ nombre: '', ambito: 'Red Integral', fase: 'Levantamiento', avance: 0, prioridad: 'Media', bitacora: [], archivos: [], archivosOficiales: [] }); setIsDocModalOpen(true);}} className={clsBtnP}><Plus size={16}/> Nueva Norma</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {safeArr(docs).map(d => {
                 const s = getSemaforoDoc(d.fechaResolucion, d.archivosOficiales);
                 return (
                   <div key={d.id} className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-[8px] border-l-${s.color}-500 flex flex-col justify-between`}>
                     <div><div className="flex justify-between mb-3"><span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded">{d.id}</span><div className="flex gap-2"><span className={`text-[8px] font-black uppercase px-2 py-1 rounded border ${d.prioridad==='Alta'?'text-red-500 border-red-200 bg-red-50':d.prioridad==='Media'?'text-amber-500 border-amber-200 bg-amber-50':'text-blue-500 border-blue-200 bg-blue-50'}`}>{d.prioridad}</span><button onClick={()=>{setDocForm(d); setIsDocModalOpen(true);}} className="text-slate-300 hover:text-blue-600"><Edit2 size={16}/></button></div></div><h3 className="text-lg font-black leading-tight mb-2">{d.nombre}</h3><p className="text-[10px] font-bold text-slate-400 uppercase mb-4">{d.ambito} • {s.label}</p></div>
                     <div><div className="flex justify-between text-[9px] font-black uppercase mb-1"><span>Avance Técnico</span><span>{d.avance || 0}%</span></div><div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full" style={{width: `${d.avance || 0}%`}}></div></div></div>
                   </div>
                 );
               })}
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL ASISTENTE IA DOCUMENTOS ================= */}
      <ModalWrap isOpen={!!aiFileContext} mw="max-w-2xl">
         <ModalHdr t={`Analizador IA: ${aiFileContext?.nombre}`} onClose={()=>{setAiFileContext(null); setAiResponse(''); setAiPrompt('');}} icon={BrainCircuit} />
         <div className="p-6 flex flex-col h-[60vh] bg-slate-50">
             <div className="flex-1 overflow-y-auto mb-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-inner text-sm whitespace-pre-wrap leading-relaxed text-slate-700">
                 {aiResponse ? aiResponse : <span className="text-slate-400 italic">Escribe tu instrucción (ej. "Haz un resumen médico de este PDF", "Detecta medicamentos", "¿Cuál es el flujo de derivación?")...</span>}
             </div>
             <div className="flex gap-3 shrink-0">
                 <Inp value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="¿Qué quieres saber de este documento?" onKeyDown={e=>e.key==='Enter' && handleAskAiAboutFile()} disabled={isAnalyzingFile} />
                 <button onClick={handleAskAiAboutFile} disabled={isAnalyzingFile || !aiPrompt.trim()} className={clsBtnP}>
                     {isAnalyzingFile ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                 </button>
             </div>
         </div>
      </ModalWrap>

      {/* ================= MODAL CASOS ================= */}
      <ModalWrap isOpen={isCaseModalOpen}>
        <ModalHdr t={caseForm.id ? `Caso: ${caseForm.nombre}` : 'Nuevo Seguimiento'} onClose={()=>setIsCaseModalOpen(false)} icon={Users} />
        <div className="flex bg-slate-50 border-b px-6 shrink-0">
          {['datos','bitacora','archivos'].map(tab => (<button key={tab} onClick={()=>setActiveModalTab(tab)} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-4 ${activeModalTab === tab ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>{tab}</button>))}
        </div>
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {activeModalTab === 'datos' && (
            <div className="grid grid-cols-2 gap-4">
              <div><Lbl>RUT</Lbl><Inp type="text" value={caseForm.rut} onChange={e=>setCaseForm({...caseForm, rut: e.target.value})} /></div>
              <div><Lbl>Nombre</Lbl><Inp type="text" value={caseForm.nombre} onChange={e=>setCaseForm({...caseForm, nombre: e.target.value})} /></div>
              <div><Lbl>Origen</Lbl><Inp list="cent-list" value={caseForm.origen} onChange={e=>setCaseForm({...caseForm, origen: e.target.value})} /></div>
              <div><Lbl>Destino</Lbl><Inp list="cent-list" value={caseForm.destino} onChange={e=>setCaseForm({...caseForm, destino: e.target.value})} /></div>
              <datalist id="cent-list">{centros.map(c=><option key={c} value={c}/>)}</datalist>
              <div><Lbl>Estado</Lbl><Sel value={caseForm.estado} onChange={e=>setCaseForm({...caseForm, estado: e.target.value})}><option>Pendiente</option><option>Concretado</option><option>Alerta</option></Sel></div>
              <div><Lbl>Fecha Egreso</Lbl><Inp type="date" value={caseForm.fechaEgreso} onChange={e=>setCaseForm({...caseForm, fechaEgreso: e.target.value})} /></div>
            </div>
          )}
          {activeModalTab === 'bitacora' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4">
                 <Sel value={newBitacoraEntry.tipo} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, tipo: e.target.value})}><option>Nota Adm.</option><option>Intervención</option><option>Tarea</option></Sel>
                 <Sel value={newBitacoraEntry.barrera} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, barrera: e.target.value})} className={newBitacoraEntry.barrera !== 'Ninguna' ? 'bg-red-50 text-red-700 border-red-200' : ''}>
                   <option value="Ninguna">✅ Sin Barrera</option><option value="Falta Cupo Psiquiatra">⚠️ Falta Cupo Médico</option><option value="Inasistencia Usuario">🚨 Inasistencia</option><option value="Espera Resolución Judicial">⚖️ Judicial</option><option value="Falta Plaza Mejor Niñez">🏠 Plaza Residencia</option>
                 </Sel>
                 <Inp placeholder="Resp..." value={newBitacoraEntry.responsable} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, responsable: e.target.value})} />
                 <Txt placeholder="Detalle..." value={newBitacoraEntry.descripcion} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, descripcion: e.target.value})} />
                 {newBitacoraEntry.tipo === 'Tarea' && <Inp type="date" value={newBitacoraEntry.fechaCumplimiento || ''} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, fechaCumplimiento: e.target.value})} className="col-span-4 bg-amber-50" />}
                 <button onClick={handleAddBitacora} className={clsBtnP + " md:col-span-4"}>Añadir Registro</button>
              </div>
              <div className="space-y-2">
                {safeArr(caseForm.bitacora).map(b => (
                  <div key={b.id} className="p-4 bg-white border rounded-xl flex justify-between items-start">
                    <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="text-[10px] font-black uppercase text-blue-600">{b.tipo}</span>{b.barrera !== 'Ninguna' && <span className="bg-red-100 text-red-700 text-[8px] font-black px-2 py-0.5 rounded uppercase">Barrera: {b.barrera}</span>}</div><p className="text-sm font-medium">{b.descripcion}</p></div>
                    <button onClick={()=>setCaseForm({...caseForm, bitacora: caseForm.bitacora.filter(x=>x.id!==b.id)})} className="text-slate-200 hover:text-red-500"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeModalTab === 'archivos' && (
            <div className="space-y-4">
               <div className="bg-indigo-50 p-6 rounded-2xl text-center border-dashed border-2 border-indigo-200">
                 <label className="cursor-pointer font-black text-xs text-indigo-700 uppercase"><UploadCloud size={20} className="mx-auto mb-2"/> {isUploadingCaseFile ? 'Subiendo...' : 'Subir Documento (Para IA)'}<input type="file" className="hidden" disabled={isUploadingCaseFile} onChange={handleCaseFileUpload} /></label>
               </div>
               <div className="space-y-2">
                 {safeArr(caseForm.archivos).map(f => (
                   <div key={f.id} className="p-3 bg-white border rounded-xl flex justify-between items-center group">
                      <span className="text-xs font-black">{f.nombre}</span>
                      <div className="flex gap-2">
                        <button onClick={()=>setAiFileContext(f)} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"><BrainCircuit size={14}/></button>
                        <a href={f.url} target="_blank" rel="noreferrer" className="p-2 bg-blue-50 text-blue-600 rounded-lg"><ExternalLink size={14}/></a>
                        <button onClick={()=>setCaseForm(p=>({...p, archivos: p.archivos.filter(a=>a.id!==f.id)}))} className="text-red-400 p-2 hover:bg-red-50 rounded-lg ml-2"><Trash2 size={14}/></button>
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>
        <ModalFtr onCancel={()=>setIsCaseModalOpen(false)} onSave={()=>{saveToCloud('cases', caseForm.id || `CASO-${Date.now()}`, caseForm); setIsCaseModalOpen(false);}} />
      </ModalWrap>

      {/* ================= MODAL PROTOCOLOS ================= */}
      <ModalWrap isOpen={isDocModalOpen}>
        <ModalHdr t={editingDocId ? 'Editar Protocolo' : 'Nuevo Protocolo'} onClose={()=>setIsDocModalOpen(false)} icon={FileText} />
        <div className="flex bg-slate-50 border-b shrink-0 px-6">
          <button onClick={() => setActiveDocModalTab('datos')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 ${activeDocModalTab === 'datos' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Datos Generales</button>
          <button onClick={() => setActiveDocModalTab('bitacora')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 ${activeDocModalTab === 'bitacora' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Tareas y Fases</button>
          <button onClick={() => setActiveDocModalTab('archivos')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 ${activeDocModalTab === 'archivos' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Archivos e IA</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 bg-white space-y-6">
          {activeDocModalTab === 'datos' && (
            <div className="space-y-4">
              <div><Lbl>Nombre del Protocolo</Lbl><Inp value={docForm.nombre} onChange={e=>setDocForm({...docForm, nombre: e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Lbl>Ámbito Aplicable</Lbl>
                  <Inp list="ambitos-list" value={docForm.ambito} onChange={e=>setDocForm({...docForm, ambito: e.target.value})} placeholder="Escriba o seleccione..."/>
                  <datalist id="ambitos-list">
                    <option value="APS"/><option value="Atención Cerrada"/><option value="Red Integral"/><option value="Hospitalario"/>
                    {safeArr(centros).map(c=><option key={c} value={c}/>)}
                  </datalist>
                </div>
                <div><Lbl>Fase de Trabajo</Lbl><Sel value={docForm.fase} onChange={e=>setDocForm({...docForm, fase: e.target.value})}><option>Levantamiento</option><option>Validación Técnica</option><option>Resolución Exenta</option><option>Difusión</option></Sel></div>
                <div><Lbl>Prioridad</Lbl><Sel value={docForm.prioridad} onChange={e=>setDocForm({...docForm, prioridad: e.target.value})}><option>Alta</option><option>Media</option><option>Baja</option></Sel></div>
                <div><Lbl>Fecha Resolución (Para Semáforo)</Lbl><Inp type="date" value={docForm.fechaResolucion || ''} onChange={e=>setDocForm({...docForm, fechaResolucion: e.target.value})} /></div>
              </div>
              <div><Lbl>Notas y Observaciones Generales</Lbl><Txt rows="3" value={docForm.notas || ''} onChange={e=>setDocForm({...docForm, notas: e.target.value})} /></div>
            </div>
          )}
          {activeDocModalTab === 'bitacora' && (() => {
             const docTareas = safeArr(docForm.bitacora).filter(b => b.tipo === 'Tarea');
             const docAvanceTemp = docTareas.length > 0 ? Math.round((docTareas.filter(t => t.completada).length / docTareas.length) * 100) : (docForm.avance || 0);
             return (
             <div className="space-y-4">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                  <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-blue-800 tracking-widest">Avance Automatizado</span><span className="text-xs text-blue-600 font-medium">Calculado por tareas cumplidas</span></div>
                  <span className="text-2xl font-black text-blue-600">{docAvanceTemp}%</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl grid grid-cols-2 gap-3"><Inp value={newDocBitacoraEntry.responsable} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, responsable: e.target.value})} placeholder="Resp..." /><Inp type="date" value={newDocBitacoraEntry.fechaCumplimiento} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, fechaCumplimiento: e.target.value})} /><Txt rows="1" value={newDocBitacoraEntry.descripcion} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, descripcion: e.target.value})} placeholder="Tarea..." className="col-span-2"/><button onClick={handleAddDocBitacora} className={clsBtnP + " col-span-2"}>Añadir Tarea</button></div>
                {safeArr(docForm.bitacora).map(b => (
                  <div key={b.id} className="p-4 border rounded-xl flex items-start gap-4 hover:border-blue-200 transition-colors">
                    <button onClick={() => setDocForm(p => ({...p, bitacora: p.bitacora.map(x => x.id === b.id ? {...x, completada: !x.completada} : x)}))} className={b.completada ? "text-emerald-500" : "text-amber-500"}><CheckSquare size={20}/></button>
                    <div className="flex-1"><p className={`text-sm font-bold ${b.completada ? 'line-through text-slate-400' : 'text-slate-800'}`}>{String(b.descripcion)}</p><p className="text-[10px] text-slate-400 mt-1 uppercase">Resp: {String(b.responsable)} | Vence: {String(b.fechaCumplimiento)}</p></div>
                    <button onClick={() => setDocForm({ ...docForm, bitacora: safeArr(docForm.bitacora).filter(x => x.id !== b.id) })} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                  </div>
                ))}
             </div>
             );
          })()}
          {activeDocModalTab === 'archivos' && (() => {
             const docTareas = safeArr(docForm.bitacora).filter(b => b.tipo === 'Tarea');
             const docAvanceTemp = docTareas.length > 0 ? Math.round((docTareas.filter(t => t.completada).length / docTareas.length) * 100) : (docForm.avance || 0);
             return (
             <div className="space-y-6">
               {docAvanceTemp === 100 && safeArr(docForm.archivos).length > 0 && (
                 <div className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><CheckCircle size={24}/></div>
                    <div><h4 className="font-black text-emerald-800 uppercase tracking-widest">¡Tareas al 100%!</h4><p className="text-xs text-emerald-700">El borrador está listo para convertirse en oficial.</p></div>
                    <button onClick={() => setDocForm(p => ({ ...p, archivosOficiales: [...safeArr(p.archivos), ...safeArr(p.archivosOficiales)], archivos: [], fechaResolucion: new Date().toISOString().split('T')[0], fase: 'Oficialización', avance: 100 }))} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 flex items-center gap-2">🌟 Oficializar Borrador</button>
                 </div>
               )}
               <div>
                 <Lbl className="bg-indigo-50 text-indigo-800 px-3 py-2 rounded-lg border border-indigo-100 inline-block mb-3">1. Documento Oficial Vigente</Lbl>
                 <div className="space-y-2 mb-4">
                   {safeArr(docForm.archivosOficiales).map(f => (
                     <div key={f.id} className="flex justify-between items-center p-3 bg-white border-2 border-indigo-50 rounded-xl group">
                        <span className="text-xs font-black text-indigo-900">{f.nombre}</span>
                        <div className="flex gap-2 items-center">
                          <button onClick={()=>setAiFileContext(f)} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white p-1.5 rounded transition-all flex items-center gap-1 shadow-sm"><BrainCircuit size={14}/> <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">IA</span></button>
                          {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded flex items-center gap-1"><ExternalLink size={12}/> Abrir</a>}
                          <button onClick={()=>setDocForm(p=>({...p, archivosOficiales: p.archivosOficiales.filter(a=>a.id!==f.id)}))} className="text-red-400 p-1 hover:bg-red-50 rounded ml-2"><Trash2 size={14}/></button>
                        </div>
                     </div>
                   ))}
                   {safeArr(docForm.archivosOficiales).length === 0 && <p className="text-[10px] text-slate-400 italic">No hay documento oficial publicado.</p>}
                 </div>
                 <label className="cursor-pointer inline-block text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors border border-indigo-200"><UploadCloud size={14} className="inline mr-2"/> Subir Oficial Directo
                   <input type="file" className="hidden" disabled={isUploadingDocFile} onChange={(e) => handleDocFileUpload(e, 'archivosOficiales')} />
                 </label>
               </div>

               <div className="border-t border-slate-100 pt-6">
                 <Lbl className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg border border-slate-200 inline-block mb-3">2. Borradores e Insumos (Mesa Técnica)</Lbl>
                 <div className="bg-slate-50 p-4 rounded-xl text-center mb-4 border border-dashed border-slate-300">
                   <label className="cursor-pointer block text-slate-600 font-black text-xs uppercase"><UploadCloud size={20} className="mx-auto mb-1 text-slate-400"/> {isUploadingDocFile ? 'Subiendo...' : 'Subir Borrador'}
                     <input type="file" className="hidden" disabled={isUploadingDocFile} onChange={(e) => handleDocFileUpload(e, 'archivos')} />
                   </label>
                 </div>
                 <div className="space-y-2">
                   {safeArr(docForm.archivos).map(f => (
                     <div key={f.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl group hover:border-indigo-200 transition-colors">
                        <span className="text-xs font-bold text-slate-700">{f.nombre}</span>
                        <div className="flex gap-2 items-center">
                          <button onClick={()=>setAiFileContext(f)} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white p-1.5 rounded transition-all flex items-center gap-1 shadow-sm"><BrainCircuit size={14}/> <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">IA</span></button>
                          {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded flex items-center gap-1"><ExternalLink size={12}/> Abrir</a>}
                          <button onClick={()=>setDocForm(p=>({...p, archivos: p.archivos.filter(a=>a.id!==f.id)}))} className="text-red-400 p-1 hover:bg-red-50 rounded ml-2"><Trash2 size={14}/></button>
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
             );
          })()}
        </div>
        <ModalFtr onCancel={()=>setIsDocModalOpen(false)} onSave={handleSaveDoc} />
      </ModalWrap>

      <style dangerouslySetInnerHTML={{__html: `
        .fade-in { animation: fadeIn 0.4s ease-out; }
        .animate-in { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}

const StatusBadge = ({ status }) => {
  const s = safeStr(status);
  if(s === 'Alerta') return <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 animate-pulse"><AlertTriangle size={10} /> Alerta</span>;
  if(s === 'Pendiente') return <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-[9px] font-black uppercase flex items-center gap-1"><Clock size={10} /> Tránsito</span>;
  return <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase flex items-center gap-1"><CheckCircle size={10} /> Cerrado</span>;
};