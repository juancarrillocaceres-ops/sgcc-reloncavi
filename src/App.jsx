import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  LayoutDashboard, Users, FileText, AlertTriangle, CheckCircle, Clock, Plus, Activity, LogOut,
  Bell, Copy, Loader2, Edit2, Trash2, ListTodo, MessageSquare, CheckSquare, Square, Calendar,
  UploadCloud, Lock, User, ClipboardCheck, BookOpen, Download, Wand2, Settings, UserPlus, 
  Shield, Key, Timer, BarChart3, Target, Printer, ExternalLink, BrainCircuit, Sparkles, 
  ShieldAlert, Eye, UserCheck, Menu, X, Maximize2, Minimize2
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

// --- UTILIDADES PROTEGIDAS ---
const safeArr = (arr) => Array.isArray(arr) ? arr : [];
const safeStr = (str) => (str !== null && str !== undefined) ? String(str) : '';

const getUserCentros = (user) => {
  if (!user) return [];
  let c = safeArr(user.centrosAsignados);
  if (c.length === 0 && user.dispositivo && typeof user.dispositivo === 'string') return [user.dispositivo];
  return c;
};

const diffInDays = (d1, d2) => {
  if (!d1 || !d2) return null;
  return Math.ceil(Math.abs(new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24));
};

const getTaskStatus = (fecha) => {
  if (!fecha || typeof fecha !== 'string' || !fecha.includes('-')) return { status: 'none', bgClass: 'bg-slate-100 text-slate-700', showWarning: false };
  const diffDays = Math.ceil((new Date(fecha).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { status: 'overdue', bgClass: 'bg-red-100 text-red-800', showWarning: true };
  if (diffDays <= 10) return { status: 'upcoming', bgClass: 'bg-amber-100 text-amber-800', showWarning: true };
  return { status: 'safe', bgClass: 'bg-emerald-100 text-emerald-800', showWarning: false };
};

const getSemaforoDoc = (docData) => {
  if (!docData) return { color: 'red', hex: '#ef4444', bgClass: 'bg-red-100 text-red-700', label: '🔴 Error de Datos' };
  if (!safeArr(docData.archivosOficiales).filter(Boolean).length) return { color: 'red', hex: '#ef4444', bgClass: 'bg-red-100 text-red-700', label: '🔴 Vacío Normativo' };
  if (docData.requiereActualizacionTecnica) return { color: 'amber', hex: '#f59e0b', bgClass: 'bg-amber-100 text-amber-700', label: '🟡 Requiere Actualización' };
  if (docData.fechaVencimiento) {
     const expDate = new Date(docData.fechaVencimiento + 'T12:00:00Z');
     const msDiff = expDate.getTime() - new Date().getTime();
     if (!isNaN(msDiff)) {
       const days = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
       if (days < 0) return { color: 'red', hex: '#ef4444', bgClass: 'bg-red-100 text-red-700', label: '🔴 Vencido' };
       if (days <= (docData.diasAvisoVencimiento || 90)) return { color: 'amber', hex: '#f59e0b', bgClass: 'bg-amber-100 text-amber-700', label: `🟡 Vence (${days}d)` };
       return { color: 'emerald', hex: '#10b981', bgClass: 'bg-emerald-100 text-emerald-700', label: '🟢 Vigente' };
     }
  }
  const resolDate = new Date((docData.fechaResolucion || '') + 'T12:00:00Z');
  if (isNaN(resolDate.getTime())) return { color: 'amber', hex: '#f59e0b', bgClass: 'bg-amber-100 text-amber-700', label: '🟡 Desactualizado' };
  const daysOld = Math.ceil((new Date().getTime() - resolDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysOld > (3 * 365)) return { color: 'amber', hex: '#f59e0b', bgClass: 'bg-amber-100 text-amber-700', label: '🟡 > 3 años' };
  return { color: 'emerald', hex: '#10b981', bgClass: 'bg-emerald-100 text-emerald-700', label: '🟢 Vigente' };
};

const parseOpciones = (str) => {
  if (!str) return [{ label: 'SÍ', value: 1 }, { label: 'NO', value: 0 }];
  return String(str).split(',').map(o => {
    const p = o.split('=');
    return { label: p[0]?.trim() || '', value: Number(p[1]) || 0 };
  }).filter(o => o.label !== '');
};

const generateTextWithRetry = async (apiKey, prompt, sys = "", inlineData = null) => {
  if (!apiKey) throw new Error("Falta Clave API");
  const parts = [{ text: prompt }];
  if (inlineData) {
    let mime = inlineData.mimeType || 'application/pdf'; 
    parts.push({ inlineData: { mimeType: mime, data: inlineData.data } });
  }
  const payload = { contents: [{ parts }] };
  if (sys) payload.systemInstruction = { parts: [{ text: sys }] };
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) return data.candidates[0].content.parts[0].text;
      throw new Error("Respuesta vacía");
    } catch (e) {
      if (i === 4 || (!e.message.includes('429') && !e.message.includes('quota'))) throw e;
      await new Promise(r => setTimeout(r, [1000, 2000, 4000, 8000, 16000][i]));
    }
  }
};

// --- COMPONENTES UI REUTILIZABLES ---
const clsInp = "w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 bg-white shadow-sm transition-colors disabled:bg-slate-50 disabled:text-slate-400";
const clsLbl = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 mt-2";
const clsBtnP = "bg-blue-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer";
const clsBtnS = "px-5 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors cursor-pointer";

const Inp = (p) => <input {...p} className={`${clsInp} ${p.className||''}`} />;
const Txt = (p) => <textarea {...p} className={`${clsInp} resize-y ${p.className||''}`} />;
const Sel = (p) => <select {...p} className={`${clsInp} ${p.className||''}`}>{p.children}</select>;
const Lbl = (p) => <label className={`${clsLbl} ${p.className||''}`}>{p.children}</label>;

const ModalHdr = ({ t, onClose, icon: Icon }) => (
  <div className="bg-slate-800 p-5 text-white flex justify-between items-center shrink-0">
    <h3 className="font-black text-lg uppercase tracking-widest flex items-center gap-2">{Icon && <Icon size={20}/>} {t}</h3>
    <button onClick={onClose} className="text-white/60 hover:text-white font-bold text-3xl cursor-pointer">&times;</button>
  </div>
);
const ModalFtr = ({ onCancel, onSave, saveTxt, disableSave, hideSave }) => (
  <div className="bg-slate-50 p-5 border-t border-slate-200 flex justify-end gap-3 shrink-0">
    <button onClick={onCancel} className={clsBtnS}>{hideSave ? 'Cerrar' : 'Cancelar'}</button>
    {!hideSave && <button onClick={onSave} disabled={disableSave} className={clsBtnP}>{saveTxt || 'Guardar'}</button>}
  </div>
);
const ModalWrap = ({ isOpen, children, mw }) => isOpen ? (
  <div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in no-print">
    <div className={`bg-white rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden border border-slate-200 max-h-[90vh] ${mw || 'max-w-4xl'}`}>
      {children}
    </div>
  </div>
) : null;

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ rut: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [dbStatus, setDbStatus] = useState('Autenticando...');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);
  
  const [centros, setCentros] = useState([]);
  const [cases, setCases] = useState([]);
  const [docs, setDocs] = useState([]);
  const [audits, setAudits] = useState([]);
  const [auditTemplates, setAuditTemplates] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [appConfig, setAppConfig] = useState({ targetDays: 7, geminiKey: '', plazos: {}, showMetricsToNetwork: false });
  const [newCentroName, setNewCentroName] = useState('');
  const [plazoCentroInput, setPlazoCentroInput] = useState('');
  const [plazoDaysInput, setPlazoDaysInput] = useState('');

  const defaultCaseState = { rut: '', nombre: '', edad: '', origen: '', destino: '', prioridad: 'Media', estado: 'Pendiente', fechaEgreso: new Date().toISOString().split('T')[0], fechaRecepcionRed: '', fechaIngresoEfectivo: '', tutor: { nombre: '', relacion: '', telefono: '' }, referentes: [], liderCaso: '', bitacora: [], archivos: [], epicrisis: '', creadorId: '' };
  const [editingCaseId, setEditingCaseId] = useState(null);
  const [caseForm, setCaseForm] = useState(defaultCaseState);
  const [activeModalTab, setActiveModalTab] = useState('datos');
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  
  const [newBitacoraEntry, setNewBitacoraEntry] = useState({ tipo: 'Nota Adm.', descripcion: '', fechaCumplimiento: '', barrera: 'Ninguna' });

  const defaultDocState = { nombre: '', ambito: 'Red Integral', fase: 'Levantamiento', avance: 0, prioridad: 'Media', fechaResolucion: '', fechaVencimiento: '', diasAvisoVencimiento: 90, requiereActualizacionTecnica: false, notas: '', bitacora: [], archivos: [], archivosOficiales: [] };
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [docForm, setDocForm] = useState(defaultDocState);
  const [activeDocModalTab, setActiveDocModalTab] = useState('datos');
  const [newDocBitacoraEntry, setNewDocBitacoraEntry] = useState({ tipo: 'Tarea', descripcion: '', responsable: '', fechaCumplimiento: '' });

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [auditForm, setAuditForm] = useState({ centro: '', templateId: '', headerAnswers: {}, answers: {}, tipo: 'Auditoría', observaciones: '', fecha: new Date().toISOString().split('T')[0], estadoFinal: '' });
  const [templateForm, setTemplateForm] = useState({ nombre: '', metodoCalculo: 'Suma Automática', instruccionesDiagnostico: '', encabezados: [{ id: 'enc_1', label: 'Centro Evaluado', type: 'text' }, { id: 'enc_2', label: 'Fecha', type: 'date' }], criterios: [{ id: 'crit_1', pregunta: '', opciones: 'SÍ=1, NO=0' }], rangos: [], tipo: 'Ambos' });
  const [newRango, setNewRango] = useState({ min: '', max: '', resultado: '' });
  
  const [printingAudit, setPrintingAudit] = useState(null);
  const [rawTextForAI, setRawTextForAI] = useState('');
  
  const [aiFileContext, setAiFileContext] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);

  const [centroFilterAuditorias, setCentroFilterAuditorias] = useState('Todos');
  const [centroFilterConsultorias, setCentroFilterConsultorias] = useState('Todos');
  const [caseFilterCentro, setCaseFilterCentro] = useState('Todos');
  const [caseSearch, setCaseSearch] = useState('');
  const [docFilterAmbito, setDocFilterAmbito] = useState('Todos');
  const [docFilterFase, setDocFilterFase] = useState('Todos');
  
  const [isDigitizing, setIsDigitizing] = useState(false);
  const [isUploadingCaseFile, setIsUploadingCaseFile] = useState(false);
  const [isUploadingDocFile, setIsUploadingDocFile] = useState(false);
  
  const [isDirModalOpen, setIsDirModalOpen] = useState(false);
  const [editingDirId, setEditingDirId] = useState(null);
  const [dirForm, setDirForm] = useState({ nombre: '', cargo: '', institucion: '', telefono: '', correo: '' });
  const [dirSearch, setDirSearch] = useState('');

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState({ rut: '', nombre: '', iniciales: '', cargo: '', telefono: '', correo: '', password: '', rol: 'Usuario', centrosAsignados: [] });

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isGeneratingCaseSummary, setIsGeneratingCaseSummary] = useState(false);
  const [caseSummary, setCaseSummary] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // --- EFECTOS Y CONEXIÓN ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { 
        setDbStatus('⚠️ Error de Autenticación.');
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if(user) setDbStatus('Conexión Segura Establecida');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const errH = (err) => { console.error(err); setDbStatus('⚠️ Error de Firestore.'); };
    
    const unsubCases = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'cases'), snap => setCases(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubDocs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'docs'), snap => setDocs(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubAudits = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'audits'), snap => setAudits(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubTemplates = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'auditTemplates'), snap => setAuditTemplates(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubDir = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'directory'), snap => setDirectory(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), snap => setUsers(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubCentros = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'centros'), snap => { if (snap.exists()) setCentros(safeArr(snap.data().list)); }, errH);
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), snap => { 
      if (snap.exists()) setAppConfig({ targetDays: 7, plazos: {}, showMetricsToNetwork: false, ...snap.data() }); 
    }, errH);

    return () => { unsubCases(); unsubDocs(); unsubAudits(); unsubTemplates(); unsubDir(); unsubUsers(); unsubCentros(); unsubConfig(); };
  }, [firebaseUser]);

  useEffect(() => {
    if (currentUser && currentUser.rut !== 'admin') {
      const myCentros = getUserCentros(currentUser);
      if (!currentUser.nombre || !currentUser.correo || !currentUser.telefono || myCentros.length === 0) {
        setIsOnboardingOpen(true);
        setUserForm(prev => ({ ...prev, ...currentUser, centrosAsignados: myCentros }));
      }
    }
  }, [currentUser]);

  const saveToCloud = async (coll, id, data) => { if (firebaseUser) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id.toString()), data); };
  const deleteFromCloud = async (coll, id) => { if (firebaseUser) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id.toString())); };

  const getTargetDaysForCase = (destino) => {
    if (!destino) return Number(appConfig?.targetDays || 7);
    if (appConfig?.plazos && appConfig.plazos[destino] !== undefined) return Number(appConfig.plazos[destino]);
    return Number(appConfig?.targetDays || 7);
  };

  // --- FILTROS INTELIGENTES Y MÉTRICAS CON NULL SAFETY ---
  const visibleCases = useMemo(() => {
    let arr = safeArr(cases).filter(Boolean); 
    if (currentUser?.rol !== 'Admin') {
      const myCentros = getUserCentros(currentUser);
      arr = arr.filter(c => 
        myCentros.includes(c.origen) || 
        myCentros.includes(c.destino) ||
        c.creadorId === currentUser?.id ||
        safeArr(c.referentes).some(r => r?.nombre === currentUser?.nombre)
      );
    }
    return arr;
  }, [cases, currentUser]);

  const filteredCases = useMemo(() => {
    return visibleCases.filter(c => {
      const mC = caseFilterCentro === 'Todos' || c.origen === caseFilterCentro || c.destino === caseFilterCentro;
      const mS = String(c.nombre || '').toLowerCase().includes(String(caseSearch || '').toLowerCase()) || String(c.paciente || '').includes(caseSearch);
      return mC && mS;
    });
  }, [visibleCases, caseFilterCentro, caseSearch]);

  const filteredDocs = useMemo(() => {
    return safeArr(docs).filter(Boolean).filter(d => {
      const myCentros = getUserCentros(currentUser);
      const isMyCentroDoc = myCentros.includes(d.ambito) || d.ambito === 'Red Integral';
      const visible = currentUser?.rol === 'Admin' || isMyCentroDoc;
      if(!visible) return false;
      const matchAmbito = docFilterAmbito === 'Todos' || d.ambito === docFilterAmbito;
      const matchFase = docFilterFase === 'Todos' || d.fase === docFilterFase;
      return matchAmbito && matchFase;
    });
  }, [docs, docFilterAmbito, docFilterFase, currentUser]);

  const visibleAudits = useMemo(() => {
    const validAudits = safeArr(audits).filter(Boolean);
    if (currentUser?.rol === 'Admin') return validAudits;
    const myCentros = getUserCentros(currentUser);
    return validAudits.filter(a => myCentros.includes(a.centro));
  }, [audits, currentUser]);

  const alertCases = visibleCases.filter(c => c.estado === 'Alerta');
  
  const allPendingTasks = useMemo(() => {
    return [
      ...safeArr(visibleCases).flatMap(c => safeArr(c.bitacora).filter(Boolean).filter(b => b.tipo === 'Tarea' && !b.completada).map(b => ({ ...b, parentId: c.id, parentName: c.nombre || c.paciente, source: 'Caso' }))),
      ...safeArr(filteredDocs).flatMap(d => safeArr(d.bitacora).filter(Boolean).filter(b => b.tipo === 'Tarea' && !b.completada).map(b => ({ ...b, parentId: d.id, parentName: d.nombre, source: 'Protocolo' })))
    ].sort((a, b) => safeStr(a.fechaCumplimiento || '9999-99-99').localeCompare(safeStr(b.fechaCumplimiento || '9999-99-99')));
  }, [visibleCases, filteredDocs]);

  const tareasCriticas = allPendingTasks.filter(t => getTaskStatus(t.fechaCumplimiento).status !== 'safe').length;

  const notifications = useMemo(() => [
      ...alertCases.map(c => ({ id: `alert-${c.id}`, type: 'alerta', title: 'Pérdida de Enlace', desc: `Paciente ${String(c.nombre || 'Desconocido')} no se ha presentado.` })),
      ...allPendingTasks.filter(t => getTaskStatus(t.fechaCumplimiento).status !== 'safe').map(t => ({ id: `task-${t.id}`, type: getTaskStatus(t.fechaCumplimiento).status, title: getTaskStatus(t.fechaCumplimiento).status === 'overdue' ? 'Tarea Vencida' : 'Pronta a Vencer', desc: `(${String(t.parentName)}) ${String(t.descripcion)}` }))
  ], [alertCases, allPendingTasks]);
  
  const statsDocs = useMemo(() => {
    let v = 0, d = 0, vac = 0;
    filteredDocs.forEach(doc => {
      const s = getSemaforoDoc(doc);
      if (s.color === 'emerald') v++; else if (s.color === 'amber') d++; else vac++;
    });
    return { v, d, vac };
  }, [filteredDocs]);

  const redMetrics = useMemo(() => {
    let sumEnlace = 0, countEnlace = 0, sumIngreso = 0, countIngreso = 0, alertCount = 0;
    visibleCases.forEach(c => {
      const enlaceDays = diffInDays(c.fechaEgreso, c.fechaRecepcionRed);
      const ingresoDays = diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo);
      const currentTarget = getTargetDaysForCase(c.destino);
      if (enlaceDays !== null) { sumEnlace += enlaceDays; countEnlace++; }
      if (ingresoDays !== null) { sumIngreso += ingresoDays; countIngreso++; if (ingresoDays > currentTarget) alertCount++; }
    });
    return { avgEnlace: countEnlace > 0 ? (sumEnlace / countEnlace).toFixed(1) : '---', avgIngreso: countIngreso > 0 ? (sumIngreso / countIngreso).toFixed(1) : '---', fueraDePlazo: alertCount };
  }, [visibleCases, appConfig]);

  // --- MÉTODOS DE USUARIO ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.rut === 'admin' && loginData.password === 'reloncavi') {
       setCurrentUser({ id: 'admin', rut: 'admin', nombre: 'Juan Carrillo Cáceres', iniciales: 'JC', cargo: 'Enfermero Supervisor UHCIP', rol: 'Admin', dispositivo: 'UHCIP HPM', centrosAsignados: ['UHCIP HPM'] });
       setLoginError('');
       return;
    }
    const user = safeArr(users).filter(Boolean).find(u => u.rut === loginData.rut && u.password === loginData.password);
    if (user) { 
      setCurrentUser(user); 
      setUserForm({ ...user, centrosAsignados: getUserCentros(user) }); 
      setLoginError('');
    } else { 
      setLoginError('RUT o Contraseña incorrectos.'); 
    }
  };

  const handleSaveOnboarding = async () => {
    const userCentros = getUserCentros(userForm);
    if (!userForm.nombre || !userForm.correo || !userForm.telefono || !userForm.cargo || userCentros.length === 0) return alert("Complete todos los campos requeridos para el Directorio Institucional.");
    
    const updatedUser = { ...currentUser, ...userForm, centrosAsignados: userCentros, dispositivo: '', id: currentUser.id || currentUser.rut };
    await saveToCloud('users', updatedUser.id, updatedUser);

    await saveToCloud('directory', updatedUser.id, { 
      id: updatedUser.id, 
      nombre: userForm.nombre, 
      cargo: userForm.cargo, 
      institucion: userCentros.join(' / ') || 'Red SM', 
      telefono: userForm.telefono, 
      correo: userForm.correo 
    });
    
    setCurrentUser(updatedUser);
    setIsOnboardingOpen(false);
  };

  // MÉTODOS PARA GESTIÓN DE RED (DISPOSITIVOS)
  const handleAddCentro = async () => {
    if (!newCentroName.trim()) return;
    const currentList = safeArr(centros).filter(Boolean);
    if (currentList.includes(newCentroName.trim())) return alert("El dispositivo ya existe en la red.");
    await saveToCloud('settings', 'centros', { list: [...currentList, newCentroName.trim()].sort() });
    setNewCentroName('');
  };

  const handleEditCentro = async (oldName) => {
    const newName = window.prompt("Editar nombre del dispositivo:", oldName);
    if (!newName || newName.trim() === "" || newName.trim() === oldName) return;
    const finalName = newName.trim();
    
    const updatedCentros = safeArr(centros).filter(Boolean).map(c => c === oldName ? finalName : c).sort();
    await saveToCloud('settings', 'centros', { list: updatedCentros });
    
    const usersToUpdate = safeArr(users).filter(Boolean).filter(u => getUserCentros(u).includes(oldName));
    for (let u of usersToUpdate) {
      const updatedList = getUserCentros(u).map(x => x === oldName ? finalName : x);
      await saveToCloud('users', u.id, { ...u, centrosAsignados: updatedList });
    }
    alert(`Dispositivo actualizado a "${finalName}". Se han actualizado ${usersToUpdate.length} credenciales asociadas.`);
  };

  const handleDeleteCentro = async (name) => {
    if(!window.confirm(`¿Estás seguro de eliminar "${name}" de la red?`)) return;
    const updated = safeArr(centros).filter(Boolean).filter(c => c !== name);
    await saveToCloud('settings', 'centros', { list: updated });
  };

  const handleUpdateTarget = async (days) => {
    const newDays = parseInt(days);
    if (!isNaN(newDays)) { await saveToCloud('settings', 'config', { ...appConfig, targetDays: newDays }); }
  };

  const handleAddPlazoCentro = async () => {
    if (!plazoCentroInput.trim() || !plazoDaysInput) return;
    const newPlazos = { ...(appConfig?.plazos || {}) };
    newPlazos[plazoCentroInput.trim()] = parseInt(plazoDaysInput);
    await saveToCloud('settings', 'config', { ...appConfig, plazos: newPlazos });
    setPlazoCentroInput(''); setPlazoDaysInput('');
  };

  const handleDeletePlazoCentro = async (centroStr) => {
    const newPlazos = { ...(appConfig?.plazos || {}) };
    delete newPlazos[centroStr];
    await saveToCloud('settings', 'config', { ...appConfig, plazos: newPlazos });
  };

  const handleToggleMetricsVisibility = async (val) => {
    await saveToCloud('settings', 'config', { ...appConfig, showMetricsToNetwork: val });
  };

  const handleExportCSV = () => {
    const BOM = '\uFEFF';
    const headers = ['ID_Seguimiento', 'RUT', 'Paciente', 'Edad', 'Origen', 'Destino', 'Estado', 'Fecha_Egreso', 'Fecha_Recepcion', 'Fecha_Ingreso_Efectivo', 'Plazo_Meta_Dias', 'Brecha_Dias', 'Ultimo_Hito_Fecha', 'Ultimo_Hito_Tipo', 'Responsable_Hito', 'Barrera_Detectada'];
    const rows = filteredCases.map(c => {
       const target = getTargetDaysForCase(c.destino);
       const brecha = diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo);
       const ultBit = safeArr(c.bitacora)[0] || {};
       return [c.id, c.paciente || c.rut, c.nombre, c.edad||'', c.origen, c.destino, c.estado, c.fechaEgreso||'', c.fechaRecepcionRed||'', c.fechaIngresoEfectivo||'', target, brecha||'', ultBit.fecha||'', ultBit.tipo||'', ultBit.responsable||'', ultBit.barrera||'Ninguna'];
    });
    const csvContent = BOM + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `Reporte_Red_${new Date().toISOString().split('T')[0]}.csv`; link.click();
  };

  const copyToClipboard = (text) => { 
    try {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      alert("Copiado al portapapeles exitosamente"); 
    } catch(err) {
      alert("Error al copiar: " + err.message);
    }
  };

  const handleWipeDirectory = async () => {
    if(window.confirm('⚠️ ¿Estás seguro de eliminar TODO el directorio para empezar de cero?')) {
       safeArr(directory).filter(Boolean).forEach(async (d) => { if (d && d.id) await deleteFromCloud('directory', d.id); });
       alert('Directorio limpiado.');
    }
  };

  // --- IA Y GENERACIÓN ---
  const handleAskAiAboutFile = async () => {
    if (!appConfig.geminiKey) return alert("Falta Clave API de IA en la Configuración.");
    if (!aiPrompt.trim()) return;
    setIsAnalyzingFile(true); setAiResponse('');
    try {
      const res = await fetch(aiFileContext.url);
      if (!res.ok) throw new Error("CORS");
      const blob = await res.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const result = await generateTextWithRetry(
            appConfig.geminiKey, 
            `${aiPrompt}\n\n[Documento: ${aiFileContext.nombre}]`, 
            "Responde basándote estrictamente en el documento proporcionado.", 
            { mimeType: blob.type || 'application/pdf', data: reader.result.split(',')[1] }
          );
          setAiResponse(result);
        } catch (err) { setAiResponse(`⚠️ Error IA: ${err.message}`); }
        setIsAnalyzingFile(false);
      };
    } catch (e) {
      setAiResponse("⚠️ Error de acceso al archivo (CORS). Firebase está bloqueando la descarga cruzada para la IA.");
      setIsAnalyzingFile(false);
    }
  };

  const handleGenerateReport = async (type) => { 
    if (!appConfig.geminiKey) return alert("Falta Clave API de IA.");
    setIsGeneratingReport(true); setReportContent('');
    let prompt = "";
    if (type === 'stats') {
      const delayCases = visibleCases.filter(c => diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo) > getTargetDaysForCase(c.destino));
      if (delayCases.length === 0) { setIsGeneratingReport(false); return alert("No hay casos fuera de plazo."); }
      prompt = `Actúa como clínico experto. Redacta un reporte breve sobre estos ${delayCases.length} casos fuera de plazo: ${JSON.stringify(delayCases.map(c => ({ paciente: c.nombre, destino: c.destino })))}$. Identifica nudos críticos.`;
    } else {
      if (alertCases.length === 0) { setIsGeneratingReport(false); return alert("No hay casos en alerta."); }
      prompt = `Redacta correo urgente para rescatar pacientes en alerta: ${JSON.stringify(alertCases.map(c => ({ paciente: c.nombre, destino: c.destino })))}$.`;
    }
    try { setReportContent(await generateTextWithRetry(appConfig.geminiKey, prompt)); } catch (e) { setReportContent("Error de conexión IA."); } finally { setIsGeneratingReport(false); }
  };

  const handleGenerateCaseSummary = async () => {
    if (!appConfig.geminiKey) return alert("Falta Clave API.");
    setIsGeneratingCaseSummary(true); setCaseSummary('');
    const epicrisisText = caseForm.epicrisis ? `\nEpicrisis: ${caseForm.epicrisis}` : '';
    const prompt = `Actúa como clínico. Genera resumen profesional: Nombre: ${caseForm.nombre}, Origen: ${caseForm.origen}, Destino: ${caseForm.destino}.${epicrisisText} Eventos bitácora: ${safeArr(caseForm.bitacora).filter(Boolean).map(b => `[${b.fecha}] ${b.tipo}: ${b.descripcion}`).join(' | ')}. Solo resumen directo.`;
    try { setCaseSummary(await generateTextWithRetry(appConfig.geminiKey, prompt)); } catch (e) { setCaseSummary("Error IA."); } finally { setIsGeneratingCaseSummary(false); }
  };

  const handleSummarizeCase = async () => {
    if (!appConfig.geminiKey) return alert("Falta Clave API de IA.");
    if (safeArr(caseForm.bitacora).length === 0) return alert("Bitacora vacía.");
    setIsAiLoading(true);
    try {
      const hist = safeArr(caseForm.bitacora).filter(Boolean).map(b => `Fecha: ${b.fecha}, Tipo: ${b.tipo}, Barrera: ${b.barrera}, Detalle: ${b.descripcion}`).join('\n');
      const prompt = `Eres un asistente clínico experto en psiquiatría y enlace de red. Resume el siguiente historial clínico de derivación de un paciente en 3 o 4 viñetas breves, destacando los nudos críticos, demoras y barreras de red. Sé profesional, estructurado y muy conciso.\n\nHistorial:\n${hist}`;
      const res = await generateTextWithRetry(appConfig.geminiKey, prompt);
      
      setCaseForm(prev => ({
        ...prev,
        bitacora: [{
          id: Date.now(),
          tipo: 'Nota Adm.',
          descripcion: `🤖 [ANÁLISIS IA GEMINI]:\n${res}`,
          responsable: 'Gemini (Asistente IA)',
          firma: 'Gemini 2.5 Flash',
          fecha: new Date().toISOString().split('T')[0],
          barrera: 'Ninguna',
          completada: false,
          creadorId: 'ia'
        }, ...safeArr(prev.bitacora)]
      }));
    } catch (err) { alert("⚠️ Error de IA: " + err.message); } finally { setIsAiLoading(false); }
  };

  const extractFormFromAI = async (prompt, inlineData = null) => {
    if (!appConfig.geminiKey) return alert("Falta configurar la Clave API de IA en Configuración.");
    setIsDigitizing(true);
    const fullPrompt = `${prompt}\n\nERES UN ANALISTA CLÍNICO. Analiza el documento y devuelve ÚNICAMENTE un objeto JSON válido con este formato exacto:\n{ \n  "nombre": "TÍTULO COMPLETO DEL DOCUMENTO", \n  "metodoCalculo": "Elige 'Suma Automática' si se calcula sumando puntos, o 'Juicio Clínico' si requiere interpretación del profesional o es un árbol de decisión", \n  "instruccionesDiagnostico": "Si elegiste Juicio Clínico, redacta cómo el evaluador debe interpretar las respuestas para dar el diagnóstico", \n  "encabezados": [ {"id": "enc_1", "label": "Nombre del campo (Ej: Servicio, Fecha)", "type": "text"} ], \n  "criterios": [ {"id": "crit_1", "pregunta": "Criterio", "opciones": "Estructura opciones con puntaje numérico. Ej: SÍ=1, NO=0. O escala: Siempre=3, A veces=2, Nunca=1"} ] \n}`;
    try {
      const result = await generateTextWithRetry(appConfig.geminiKey, fullPrompt, "", inlineData);
      let cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);
      setTemplateForm(prev => ({
        ...prev,
        nombre: parsedData.nombre || prev.nombre || 'Pauta Extraída',
        metodoCalculo: parsedData.metodoCalculo === 'Juicio Clínico' ? 'Juicio Clínico' : 'Suma Automática',
        instruccionesDiagnostico: parsedData.instruccionesDiagnostico || '',
        encabezados: safeArr(parsedData.encabezados).filter(Boolean),
        criterios: [...safeArr(prev.criterios).filter(Boolean).filter(c=>c.pregunta.trim()!==''), ...safeArr(parsedData.criterios).filter(Boolean).map((c, i) => ({ ...c, id: `ai_${Date.now()}_${i}` }))]
      }));
      alert(`¡Pauta digitalizada exitosamente!`);
    } catch (err) { alert("Error IA. Revisa tu Llave API o comprueba que el PDF es legible."); } 
    finally { setIsDigitizing(false); setRawTextForAI(''); }
  };

  const handleProcessRawTextForAI = () => { if (!rawTextForAI.trim()) return; extractFormFromAI(`Analiza este texto correspondiente a un instrumento de evaluación: \n\n${rawTextForAI}`); };
  const handlePdfUploadForAI = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return alert("⚠️ Archivo muy pesado (>15MB)");
    const reader = new FileReader();
    reader.onload = (ev) => extractFormFromAI(`Analiza el documento PDF adjunto.`, { mimeType: file.type || 'application/pdf', data: ev.target.result.split(',')[1] });
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  // --- MÉTODOS CORE ---
  const handleSaveCase = async () => { 
    if (!caseForm.rut || !caseForm.nombre) return alert("RUT y Nombre obligatorios.");
    const finalId = editingCaseId || `CASO-${String(cases.length + 1).padStart(3, '0')}`;
    const data = { ...caseForm, id: finalId, paciente: caseForm.rut };
    if (!editingCaseId) data.creadorId = currentUser?.id;
    await saveToCloud('cases', finalId, data);
    setIsCaseModalOpen(false); setEditingCaseId(null); setCaseForm(defaultCaseState);
  };

  const handleAddBitacora = () => {
    if (!newBitacoraEntry.descripcion) return;
    const firmaDigital = `${currentUser?.nombre} (${currentUser?.cargo || currentUser?.rol})`;
    setCaseForm({ ...caseForm, bitacora: [{ id: Date.now(), ...newBitacoraEntry, firma: firmaDigital, fecha: new Date().toISOString().split('T')[0], completada: false, creadorId: currentUser?.id }, ...safeArr(caseForm.bitacora)] });
    setNewBitacoraEntry({ tipo: 'Nota Adm.', descripcion: '', responsable: '', fechaCumplimiento: '', barrera: 'Ninguna' });
  };
  
  const toggleTaskCompletion = async (caseId, entryId) => {
     const caso = safeArr(cases).filter(Boolean).find(c => c.id === caseId);
     if (!caso) return;
     const tarea = safeArr(caso.bitacora).filter(Boolean).find(e => e.id === entryId);
     if (!tarea) return;

     const isAuth = currentUser?.rol === 'Admin' || String(tarea.responsable || '').includes(String(currentUser?.nombre)) || tarea.creadorId === currentUser?.id;
     if (!isAuth) return alert("Seguridad Clínica: Solo el administrador o el profesional asignado pueden marcar esta tarea como completada.");

     const updatedBitacora = safeArr(caso.bitacora).filter(Boolean).map(entry => entry.id === entryId ? { ...entry, completada: !entry.completada } : entry);
     await saveToCloud('cases', caseId, { ...caso, bitacora: updatedBitacora });
  };

  const toggleCaseModalTask = (entryId) => {
     const tarea = safeArr(caseForm.bitacora).filter(Boolean).find(e => e.id === entryId);
     if (!tarea) return;
     const isAuth = currentUser?.rol === 'Admin' || String(tarea.responsable || '').includes(String(currentUser?.nombre)) || tarea.creadorId === currentUser?.id;
     if (!isAuth) return alert("Seguridad Clínica: Solo el administrador o el profesional asignado pueden marcar esta tarea como completada.");
     
     setCaseForm(p => ({
         ...p, 
         bitacora: safeArr(p.bitacora).filter(Boolean).map(entry => entry.id === entryId ? { ...entry, completada: !entry.completada } : entry)
     }));
  };

  const docTareas = safeArr(docForm.bitacora).filter(Boolean).filter(b => b.tipo === 'Tarea');
  const docAvanceActual = docTareas.length > 0 ? Math.round((docTareas.filter(t => t.completada).length / docTareas.length) * 100) : (docForm.avance || 0);

  const handleSaveDoc = async () => {
    if(!docForm.nombre) return alert("Nombre obligatorio"); 
    const finalId = editingDocId || `DOC-${String(docs.length + 1).padStart(3, '0')}`;
    await saveToCloud('docs', finalId, { ...docForm, id: finalId, avance: docAvanceActual });
    setIsDocModalOpen(false); setEditingDocId(null);
  };

  const handleAddDocBitacora = () => {
    if (!newDocBitacoraEntry.descripcion) return;
    const firmaDigital = `${currentUser?.nombre} (${currentUser?.cargo || currentUser?.rol})`;
    setDocForm(prev => ({ ...prev, bitacora: [{ id: Date.now(), ...newDocBitacoraEntry, firma: firmaDigital, fecha: new Date().toISOString().split('T')[0], completada: false, creadorId: currentUser?.id }, ...safeArr(prev.bitacora)] }));
    setNewDocBitacoraEntry({ tipo: 'Tarea', descripcion: '', responsable: '', fechaCumplimiento: '' });
  };
  
  const toggleDocTaskCompletion = async (docId, entryId) => {
     const documento = safeArr(docs).filter(Boolean).find(d => d.id === docId);
     if (!documento) return;
     
     const tarea = safeArr(documento.bitacora).filter(Boolean).find(e => e.id === entryId);
     if (!tarea) return;
     
     const isAuth = currentUser?.rol === 'Admin' || String(tarea.responsable || '').includes(String(currentUser?.nombre)) || tarea.creadorId === currentUser?.id;
     if (!isAuth) return alert("Seguridad Técnica: Solo el administrador o el responsable asignado pueden completar esta tarea.");

     const updatedBitacora = safeArr(documento.bitacora).filter(Boolean).map(entry => entry.id === entryId ? { ...entry, completada: !entry.completada } : entry);
     const tareas = updatedBitacora.filter(b => b.tipo === 'Tarea');
     let nuevoAvance = documento.avance;
     if(tareas.length > 0) { nuevoAvance = Math.round((tareas.filter(t => t.completada).length / tareas.length) * 100); }
     await saveToCloud('docs', docId, { ...documento, bitacora: updatedBitacora, avance: nuevoAvance });
  };

  const toggleDocModalTask = (entryId) => {
     const tarea = safeArr(docForm.bitacora).filter(Boolean).find(e => e.id === entryId);
     if (!tarea) return;
     const isAuth = currentUser?.rol === 'Admin' || String(tarea.responsable || '').includes(String(currentUser?.nombre)) || tarea.creadorId === currentUser?.id;
     if (!isAuth) return alert("Seguridad Técnica: Solo el administrador o el profesional asignado pueden marcar esta tarea como completada.");
     
     setDocForm(p => ({
         ...p, 
         bitacora: safeArr(p.bitacora).filter(Boolean).map(entry => entry.id === entryId ? { ...entry, completada: !entry.completada } : entry)
     }));
  };

  const handleOficializarBorrador = () => {
    if(window.confirm("¿Estás seguro de promover el borrador actual como Documento Oficial? Esto reiniciará el Semáforo de Vigencia a Verde.")){
       setDocForm(p => ({
           ...p,
           archivosOficiales: [...safeArr(p.archivos).filter(Boolean).map(a => ({...a, isOfficial: true})), ...safeArr(p.archivosOficiales).filter(Boolean)],
           archivos: [],
           fechaResolucion: new Date().toISOString().split('T')[0],
           fase: 'Oficialización',
           avance: 100,
           requiereActualizacionTecnica: false
       }));
    }
  };

  const handleUploadFileStrict = async (file, folder, id, setUploadingFlag) => {
    if (!file) return null;
    if (file.size > 15 * 1024 * 1024) { alert("⚠️ El archivo es demasiado pesado (máximo 15 MB)."); return null; }
    setUploadingFlag(true);
    try {
      const storageRef = ref(storage, `artifacts/${appId}/public/storage/${folder}/${id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setUploadingFlag(false);
      return { id: Date.now().toString(), nombre: file.name, url, fecha: new Date().toISOString().split('T')[0], size: (file.size / 1024 / 1024).toFixed(2) + ' MB', creadorId: currentUser?.id };
    } catch (err) {
      setUploadingFlag(false);
      alert(`⚠️ Error de Storage: ${err.message}.`);
      return null;
    }
  };

  const handleCaseFileUpload = async (e) => {
    const res = await handleUploadFileStrict(e.target.files[0], 'casos', editingCaseId || 'nuevo', setIsUploadingCaseFile);
    if (res) setCaseForm(prev => ({ ...prev, archivos: [res, ...safeArr(prev.archivos)] }));
    e.target.value = null; 
  };

  const handleDocFileUpload = async (e, targetArray = 'archivos') => {
    const res = await handleUploadFileStrict(e.target.files[0], 'protocolos', editingDocId || 'nuevo', setIsUploadingDocFile);
    if (res) setDocForm(prev => ({ ...prev, [targetArray]: [res, ...safeArr(prev[targetArray])] }));
    e.target.value = null; 
  };

  const handleSaveTemplate = async () => {
    const validCriterios = safeArr(templateForm.criterios).filter(Boolean).filter(c => { const t = typeof c === 'string' ? c : c.pregunta; return t && t.trim() !== ''; }).map((c, i) => { if (typeof c === 'string') return { id: `crit_${Date.now()}_${i}`, pregunta: c, opciones: 'SÍ=1, NO=0' }; return { ...c, id: c.id || `crit_${Date.now()}_${i}` }; });
    if (!templateForm.nombre || validCriterios.length === 0) return alert("Ingresa nombre y al menos un criterio.");
    const finalId = editingTemplateId || `TPL-${Date.now()}`;
    await saveToCloud('auditTemplates', finalId, { id: finalId, nombre: templateForm.nombre, tipo: templateForm.tipo, metodoCalculo: templateForm.metodoCalculo || 'Suma Automática', instruccionesDiagnostico: templateForm.instruccionesDiagnostico || '', encabezados: safeArr(templateForm.encabezados).filter(Boolean), criterios: validCriterios, rangos: safeArr(templateForm.rangos).filter(Boolean) });
    setIsTemplateModalOpen(false); setEditingTemplateId(null);
  };

  const openTemplateEditor = (t) => {
    const normCriterios = safeArr(t.criterios).filter(Boolean).map((c, i) => { if (typeof c === 'string') return { id: `crit_${i}`, pregunta: c, opciones: 'SÍ=1, NO=0' }; return c; });
    setEditingTemplateId(t.id);
    setTemplateForm({ nombre: t.nombre || '', metodoCalculo: t.metodoCalculo || 'Suma Automática', instruccionesDiagnostico: t.instruccionesDiagnostico || '', encabezados: safeArr(t.encabezados).filter(Boolean), criterios: normCriterios.length > 0 ? normCriterios : [{ id: 'crit_1', pregunta: '', opciones: 'SÍ=1, NO=0' }], rangos: safeArr(t.rangos).filter(Boolean), tipo: t.tipo || 'Ambos' });
    setIsTemplateModalOpen(true);
  };

  const handleSaveAudit = async () => {
    const selectedTemplate = safeArr(auditTemplates).filter(Boolean).find(t => t.id === auditForm.templateId);
    if (!selectedTemplate) return;
    
    let maxScore = 0; let actualScore = 0; let calcPct = 0; let calcStatus = '';
    
    if (selectedTemplate.metodoCalculo === 'Suma Automática') {
       safeArr(selectedTemplate.criterios).filter(Boolean).forEach((c, idx) => {
         const opcionesStr = typeof c === 'string' ? 'SÍ=1, NO=0' : (c.opciones || 'SÍ=1, NO=0');
         const ops = parseOpciones(opcionesStr);
         maxScore += Math.max(...ops.map(o => o.value));
         const answer = auditForm.answers[c.id || idx];
         if (answer && typeof answer === 'object') actualScore += answer.value; 
         else if (answer === 'si') actualScore += 1;
       });
       calcPct = maxScore > 0 ? Math.round((actualScore / maxScore) * 100) : 0;
       
       if (safeArr(selectedTemplate.rangos).filter(Boolean).length > 0) {
          const match = safeArr(selectedTemplate.rangos).filter(Boolean).find(r => actualScore >= Number(r.min) && actualScore <= Number(r.max));
          if (match) calcStatus = match.resultado;
       } else {
          calcStatus = calcPct >= 75 ? 'Óptimo' : 'Riesgo';
       }
    }

    const finalStateText = auditForm.estadoFinal || calcStatus || 'Sin Resultado';
    if (selectedTemplate.metodoCalculo === 'Juicio Clínico' && (!finalStateText || finalStateText === 'Sin Resultado')) {
         return alert("Por favor, ingrese el Resultado Final o Diagnóstico basado en el juicio clínico.");
    }

    const finalId = `AUD-${Date.now()}`;
    await saveToCloud('audits', finalId, { 
       ...auditForm, 
       id: finalId, 
       cumplimiento: calcPct, 
       puntaje: selectedTemplate.metodoCalculo === 'Juicio Clínico' ? 'N/A' : `${actualScore} / ${maxScore}`, 
       estado: finalStateText, 
       evaluador: currentUser.nombre 
    });
    setIsAuditModalOpen(false);
  };

  const handleSaveDir = async () => {
    if (!dirForm.nombre) return alert("Nombre obligatorio");
    const finalId = editingDirId || Date.now().toString();
    await saveToCloud('directory', finalId, { ...dirForm, id: finalId });
    setIsDirModalOpen(false);
  };

  const handleSaveUser = async () => {
    if (!userForm.rut || !userForm.password || !userForm.nombre) return alert("RUT, Nombre y Contraseña obligatorios.");
    const finalId = editingUserId || Date.now().toString();
    await saveToCloud('users', finalId, { ...userForm, id: finalId, centrosAsignados: getUserCentros(userForm), dispositivo: '' });
    setIsUserModalOpen(false);
  };

  const handleUpdatePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) return alert("Contraseñas no coinciden.");
    if (passwordForm.current !== currentUser.password) return alert("Contraseña actual incorrecta.");
    await saveToCloud('users', currentUser.id, { ...currentUser, password: passwordForm.new });
    setCurrentUser({ ...currentUser, password: passwordForm.new }); setIsProfileModalOpen(false); alert("Actualizada exitosamente!");
  };

  // ================= VISTA DE IMPRESIÓN =================
  if (printingAudit) {
    const template = safeArr(auditTemplates).filter(Boolean).find(t => t.id === printingAudit.templateId);
    if (!template) return <div className="p-10 text-red-500">Error: Pauta base no encontrada.</div>;
    const criterios = typeof safeArr(template.criterios).filter(Boolean)[0] === 'string' ? safeArr(template.criterios).filter(Boolean).map((c,i) => ({id: i, pregunta: c, opciones: 'SÍ=1, NO=0'})) : safeArr(template.criterios).filter(Boolean);

    return (
      <div className="bg-white text-black min-h-screen w-full font-sans absolute inset-0 z-[100] print:static">
        <div className="max-w-4xl mx-auto p-12 print:p-0 print:w-full print:max-w-full text-[11px] print:text-[10px]">
           <div className="flex justify-end gap-3 mb-4 print:hidden">
             <button onClick={() => window.print()} className={clsBtnP}><Printer size={14}/> Imprimir Documento</button>
             <button onClick={() => setPrintingAudit(null)} className={clsBtnS}>Volver</button>
           </div>
           <div className="border-b-2 border-black pb-2 mb-4 text-center">
             <h1 className="text-lg font-black uppercase tracking-widest">{String(template.nombre || '---')}</h1>
             <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">UHCIP INFANTO JUVENIL - Hospital Puerto Montt</p>
           </div>
           <div className="grid grid-cols-2 gap-2 mb-4 border border-gray-300 p-3 rounded-lg">
             <div className="flex flex-col"><span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Dispositivo Evaluado</span><span className="font-bold text-black">{String(printingAudit.centro || '---')}</span></div>
             <div className="flex flex-col"><span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Fecha Evaluación</span><span className="font-bold text-black">{String(printingAudit.fecha)}</span></div>
             {safeArr(template.encabezados).filter(Boolean).map(h => (
                <div key={h.id} className="flex flex-col"><span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{String(h.label)}</span><span className="font-bold text-black">{String(printingAudit.headerAnswers?.[h.id] || '---')}</span></div>
             ))}
           </div>
           <table className="w-full text-left border-collapse border border-gray-300 mb-4">
             <thead>
               <tr className="bg-gray-100 border-b border-gray-300">
                 <th className="p-2 w-8 text-center border-r border-gray-300">Nº</th>
                 <th className="p-2 border-r border-gray-300">Criterio Evaluado</th>
                 <th className="p-2 w-24 text-center border-r border-gray-300">Respuesta</th>
                 <th className="p-2 w-12 text-center">Pts</th>
               </tr>
             </thead>
             <tbody>
               {criterios.map((c, i) => {
                 const rawAns = printingAudit.answers[c.id || i];
                 let label = '---'; let val = 0;
                 if (typeof rawAns === 'object' && rawAns !== null) { label = rawAns.label; val = rawAns.value; }
                 else if (rawAns === 'si') { label = 'SÍ'; val = 1; }
                 else if (rawAns === 'no') { label = 'NO'; val = 0; }
                 return (
                 <tr key={i} className="border-b border-gray-200 break-inside-avoid">
                   <td className="p-2 text-center border-r border-gray-200">{i+1}</td>
                   <td className="p-2 border-r border-gray-200 leading-tight">{String(c.pregunta)}</td>
                   <td className="p-2 text-center font-bold border-r border-gray-200">{String(label)}</td>
                   <td className="p-2 text-center">{template.metodoCalculo === 'Juicio Clínico' ? '-' : String(val)}</td>
                 </tr>
                 )
               })}
             </tbody>
           </table>
           <div className="print:break-inside-avoid w-full border border-gray-300 p-4 rounded-lg bg-gray-50 mt-4">
              <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 pr-4">
                    <h3 className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1 border-b border-gray-300 pb-1">Observaciones</h3>
                    <p className="text-[10px] font-medium text-black whitespace-pre-wrap leading-tight">{String(printingAudit.observaciones || 'Sin observaciones.')}</p>
                  </div>
                  <div className="w-40 text-right border-l border-gray-300 pl-4">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">{template.metodoCalculo === 'Juicio Clínico' ? 'Diagnóstico' : 'Puntaje Total'}</p>
                    <p className="text-xl font-black text-black leading-none">{String(printingAudit.puntaje)} {template.metodoCalculo !== 'Juicio Clínico' && <span className="text-[10px]">({String(printingAudit.cumplimiento)}%)</span>}</p>
                    <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest mt-1">{String(printingAudit.estado)}</p>
                  </div>
              </div>
              <div className="pt-6 flex justify-between px-8">
                  <div className="text-center"><div className="w-32 border-b border-black mb-1"></div><p className="text-[9px] font-black uppercase text-black">{String(printingAudit.evaluador)}</p><p className="text-[7px] font-bold text-gray-500 uppercase">Evaluador SGCC-SM</p></div>
                  <div className="text-center"><div className="w-32 border-b border-black mb-1"></div><p className="text-[9px] font-black uppercase text-black">Firma Recepción</p><p className="text-[7px] font-bold text-gray-500 uppercase">{String(printingAudit.centro || 'Dispositivo')}</p></div>
              </div>
           </div>
        </div>
      </div>
    );
  }

  // ================= LOGIN =================
  if (!currentUser) return (
    <div className="min-h-screen bg-[#0a2540] flex items-center justify-center p-4 text-center">
      <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 border-t-8 border-blue-600">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl"><Activity size={40} className="text-white" /></div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">SGCC Reloncaví</h1>
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-8">UHCIP Hospital Puerto Montt</p>
        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div><Lbl>RUT de Usuario</Lbl><Inp type="text" value={loginData.rut} onChange={e=>setLoginData({...loginData, rut: e.target.value})} placeholder="11.222.333-4" /></div>
          <div><Lbl>Contraseña</Lbl><Inp type="password" value={loginData.password} onChange={e=>setLoginData({...loginData, password: e.target.value})} placeholder="••••" /></div>
          {loginError && <p className="text-red-500 text-xs font-black uppercase text-center mt-2">{loginError}</p>}
          <button type="submit" className={clsBtnP + " w-full py-5 rounded-3xl text-sm shadow-blue-200 mt-6"}>Ingresar al Sistema</button>
        </form>
        <p className={`text-[9px] font-black uppercase text-center mt-6 ${dbStatus.includes('Error') ? 'text-red-500' : 'text-slate-400'}`}>{dbStatus}</p>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans print:hidden transition-all duration-300 ${isCompactMode ? 'text-[0.92rem]' : ''}`}>
      {/* DATALISTS GLOBALES */}
      <datalist id="sys-users-dir">
        {safeArr(directory).filter(Boolean).map(d => (
           <option key={d.id || Math.random()} value={`${String(d.nombre)} - ${String(d.cargo)} - ${String(d.institucion)}`} />
        ))}
      </datalist>

      <datalist id="app-users-list">
        {safeArr(users).filter(Boolean).map(u => (
           <option key={u.id || Math.random()} value={`${String(u.nombre)} - ${String(u.cargo)} - ${safeArr(u.centrosAsignados).length ? safeArr(u.centrosAsignados).join(', ') : String(u.dispositivo || '')}`} />
        ))}
      </datalist>

      {/* ENCABEZADO MÓVIL */}
      <div className="md:hidden bg-[#0a2540] text-white p-4 flex justify-between items-center z-30 shadow-md">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xs shadow-lg shrink-0">{String(currentUser?.iniciales || 'U')}</div>
            <div className="font-black text-sm uppercase tracking-widest">SGCC Reloncaví</div>
         </div>
         <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"><Menu size={20}/></button>
      </div>

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 md:relative md:translate-x-0 bg-[#0a2540] text-white w-64 flex flex-col h-screen shrink-0 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-white/5 flex justify-between items-start">
          <div className="flex items-start gap-3 min-w-0">
             <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-sm shadow-lg shrink-0 mt-0.5">{String(currentUser?.iniciales || 'U')}</div>
             <div className="flex-1 w-full flex flex-col justify-center min-w-0">
               <h1 className="text-sm font-black tracking-tight leading-tight text-white whitespace-normal break-words" style={{wordBreak:'break-word'}}>{String(currentUser?.nombre || 'Usuario')}</h1>
               <p className="text-[9px] text-blue-300 font-black uppercase tracking-widest mt-1.5 leading-snug whitespace-normal break-words" style={{wordBreak:'break-word'}}>{String(currentUser?.cargo || 'SGCC-SM')}</p>
             </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 text-white/50 hover:text-white"><X size={20}/></button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <button onClick={()=>{setActiveTab('dashboard'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab==='dashboard'?'bg-blue-600 shadow-lg':'hover:bg-white/5 opacity-80'}`}><LayoutDashboard size={18}/> Panel Principal</button>
          
          {(currentUser?.rol === 'Admin' || appConfig.showMetricsToNetwork) && (
            <button onClick={()=>{setActiveTab('stats'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab==='stats'?'bg-blue-600 shadow-lg':'hover:bg-white/5 opacity-80'}`}><BarChart3 size={18}/> Plazos Meta</button>
          )}

          <button onClick={()=>{setActiveTab('cases'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab==='cases'?'bg-blue-600 shadow-lg':'hover:bg-white/5 opacity-80'}`}><Users size={18}/> Casos de Red</button>
          <button onClick={()=>{setActiveTab('docs'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab==='docs'?'bg-blue-600 shadow-lg':'hover:bg-white/5 opacity-80'}`}><FileText size={18}/> Protocolos</button>
          
          <div className="pt-5 pb-2 px-4 text-[10px] font-black text-blue-400 uppercase tracking-widest">Evaluación y Red</div>
          <button onClick={()=>{setActiveTab('auditorias'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab==='auditorias'?'bg-blue-600 shadow-lg':'hover:bg-white/5 opacity-80'}`}><ClipboardCheck size={18}/> Auditorías</button>
          <button onClick={()=>{setActiveTab('consultorias'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab==='consultorias'?'bg-blue-600 shadow-lg':'hover:bg-white/5 opacity-80'}`}><MessageSquare size={18}/> Consultorías</button>
          <button onClick={()=>{setActiveTab('dir'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab==='dir'?'bg-blue-600 shadow-lg':'hover:bg-white/5 opacity-80'}`}><BookOpen size={18}/> Directorio</button>

          {currentUser?.rol === 'Admin' && (
             <>
               <div className="pt-5 pb-2 px-4 text-[10px] font-black text-blue-400 uppercase tracking-widest">Administración</div>
               <button onClick={()=>{setActiveTab('centros'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab==='centros'?'bg-blue-600 shadow-lg':'hover:bg-white/5 opacity-80'}`}><Activity size={18}/> Dispositivos</button>
               <button onClick={()=>{setActiveTab('users'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab==='users'?'bg-blue-600 shadow-lg':'hover:bg-white/5 opacity-80'}`}><UserPlus size={18}/> Usuarios</button>
               <button onClick={()=>{setActiveTab('config'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab==='config'?'bg-blue-600 shadow-lg':'hover:bg-white/5 opacity-80'}`}><Settings size={18}/> Ajustes</button>
             </>
          )}
        </nav>
        <div className="p-4 border-t border-white/5 shrink-0 bg-[#071c31]">
           <div className="flex gap-2">
             <button onClick={() => setIsProfileModalOpen(true)} className="flex-1 flex justify-center items-center gap-2 py-2 text-[10px] uppercase font-black tracking-widest text-slate-300 hover:bg-white/10 rounded-lg"><Key size={14}/> Clave</button>
             <button onClick={() => setCurrentUser(null)} className="flex-1 flex justify-center items-center gap-2 py-2 text-[10px] uppercase font-black tracking-widest text-red-400 hover:bg-red-500/20 rounded-lg"><LogOut size={14}/> Salir</button>
           </div>
        </div>
      </aside>

      {/* Overlay oscuro móvil */}
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-[#0a2540]/60 z-30 md:hidden backdrop-blur-sm"></div>}

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto relative w-full h-[calc(100vh-64px)] md:h-screen">
        
        {/* BARRA SUPERIOR DERECHA */}
        <div className="absolute top-4 right-4 md:top-8 md:right-8 z-20 flex gap-3">
          <button onClick={() => setIsCompactMode(!isCompactMode)} className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm transition-all hidden sm:flex items-center gap-2" title={isCompactMode ? "Vista Amplia" : "Vista Compacta"}>
             {isCompactMode ? <Maximize2 size={16} className="text-blue-600"/> : <Minimize2 size={16} className="text-slate-400"/>}
          </button>

          <div className="relative">
            <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm relative transition-all"><Bell size={20} />{notifications.length > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}</button>
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-[300px] md:w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden fade-in">
                <div className="bg-[#0a2540] text-white px-4 py-3 font-bold flex justify-between items-center text-xs">Notificaciones <span className="bg-blue-600 text-[10px] px-2 py-0.5 rounded-full">{notifications.length}</span></div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (<div className="p-6 text-center text-xs text-slate-500 font-medium">No hay notificaciones.</div>) : (
                    <div className="divide-y divide-slate-50">
                      {notifications.map(n => (
                        <div key={n.id} className="p-4 hover:bg-slate-50 transition-colors flex gap-3 items-start"><div className="mt-0.5">{n.type === 'alerta' || n.type === 'overdue' ? <AlertTriangle size={14} className="text-red-500"/> : <Bell size={14} className="text-amber-500"/>}</div><div><p className="text-sm font-bold text-slate-800">{String(n.title)}</p><p className="text-xs text-slate-500 mt-1 font-medium">{String(n.desc)}</p></div></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PESTAÑA 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in mt-14 md:mt-0">
            <div><h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter">Panel de Gestión Integral</h2><p className="text-xs md:text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Estatus del Dispositivo: {getUserCentros(currentUser).join(', ') || 'Red SGCC'}</p></div>

            {currentUser.rol === 'Admin' && (
              <div className="bg-slate-900 rounded-[32px] p-6 md:p-8 text-white shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-48 md:w-64 h-48 md:h-64 bg-blue-500/10 rounded-full blur-[80px]"></div>
                <div className="flex items-center gap-4 md:gap-6 relative z-10">
                  <div className="p-4 md:p-5 bg-white/10 rounded-2xl md:rounded-3xl text-blue-400 shadow-inner"><Shield size={32}/></div>
                  <div className="space-y-1">
                    <h3 className="text-base md:text-lg font-black uppercase tracking-[0.1em] text-blue-400">Control Normativo Regional</h3>
                    <p className="text-[10px] md:text-xs font-bold text-slate-300 max-w-xl leading-relaxed">Existen <strong className="text-white underline">{safeArr(docs).filter(Boolean).filter(d=>d.fase==='Levantamiento').length} protocolos</strong> en levantamiento. El sistema Gemini IA está listo para asistir en el rescate de pacientes.</p>
                  </div>
                </div>
                <button onClick={()=>setActiveTab('docs')} className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-[11px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl relative z-10 flex justify-center items-center gap-2"><Settings size={16}/> Gestionar Normas</button>
              </div>
            )}

            <div className={`grid gap-4 ${isCompactMode ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-1 md:grid-cols-5'}`}>
              <div className="bg-white p-5 rounded-2xl shadow-sm border-l-[6px] border-l-red-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Alerta Red</p><h3 className="text-2xl font-black text-red-600 mt-1">{alertCases.length}</h3></div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border-l-[6px] border-l-blue-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">En Tránsito</p><h3 className="text-2xl font-black text-blue-600 mt-1">{visibleCases.filter(c=>c.estado==='Pendiente').length}</h3></div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border-l-[6px] border-l-amber-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Tareas Pendientes</p><h3 className="text-2xl font-black text-amber-600 mt-1">{tareasCriticas}</h3></div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border-l-[6px] border-l-emerald-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Vigentes</p><h3 className="text-2xl font-black text-emerald-600 mt-1">{statsDocs.v}</h3></div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border-l-[6px] border-l-indigo-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Auditorías</p><h3 className="text-2xl font-black text-indigo-600 mt-1">{visibleAudits.length}</h3></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 overflow-hidden">
                <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-3"><AlertTriangle size={20} className="text-red-500" /> Pacientes Requiriendo Rescate</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[500px]">
                    <thead className="bg-slate-50"><tr className="text-[9px] md:text-[10px] font-black uppercase text-slate-400"><th className="p-3 md:p-4 rounded-l-xl">Paciente</th><th className="p-3 md:p-4">Origen/Destino</th><th className="p-3 md:p-4 text-center rounded-r-xl">Estado</th></tr></thead>
                    <tbody>
                      {alertCases.map(c => (<tr key={c.id} className="border-b border-slate-50"><td className="p-3 md:p-4 text-[10px] md:text-xs font-black text-slate-800 uppercase">{String(c.nombre || '---')}</td><td className="p-3 md:p-4 text-[9px] md:text-[10px] font-bold text-slate-500">{String(c.origen || '---')} ➔ {String(c.destino || '---')}</td><td className="p-3 md:p-4 text-center"><StatusBadge status={c.estado}/></td></tr>))}
                      {alertCases.length === 0 && (<tr><td colSpan="3" className="p-8 md:p-12 text-center text-slate-300 font-black uppercase text-xs">No hay alertas activas en tu centro.</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>

              {currentUser.rol === 'Admin' && (
                <div className="bg-indigo-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl flex flex-col justify-between border-t-8 border-blue-400 relative overflow-hidden">
                  <div className="relative z-10 flex-1 flex flex-col">
                    <h3 className="text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-3 mb-4"><Wand2 size={20} className="text-blue-300"/> Asistente de Gestión IA</h3>
                    <p className="text-[10px] md:text-[11px] text-indigo-200 font-bold leading-relaxed mb-6">Analiza los casos de red y genera minutas de derivación automática para la red del Reloncaví.</p>
                    <button onClick={()=>handleGenerateReport('alerts')} disabled={alertCases.length===0||isGeneratingReport} className="mt-auto w-full bg-white text-indigo-900 py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-blue-50 transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                      {isGeneratingReport?<Loader2 size={14} className="animate-spin"/>:<MessageSquare size={14}/>} Redactar Correo
                    </button>
                  </div>
                  {reportContent && (
                    <div className="mt-4 bg-white/5 p-4 rounded-2xl border border-white/10 relative z-10"><div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10"><span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">Borrador:</span><button onClick={()=>copyToClipboard(reportContent)} className="text-white hover:text-blue-300"><Copy size={12}/></button></div><p className="text-[9px] md:text-[10px] font-medium text-slate-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{String(reportContent)}</p></div>
                  )}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full -mr-10 -mt-10 blur-xl"></div>
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-3"><ListTodo size={20} className="text-blue-500" /> Tareas Pendientes en la Red</h3>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mb-6">(Mostrando solo tareas pendientes. Ver ficha del paciente para el historial completo)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead><tr className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400"><th className="p-3 md:p-4 rounded-l-xl w-16">Acción</th><th className="p-3 md:p-4">Paciente / Protocolo</th><th className="p-3 md:p-4">Tarea Asignada</th><th className="p-3 md:p-4">Responsable</th><th className="p-3 md:p-4 rounded-r-xl">Vencimiento</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {allPendingTasks.map(tarea => {
                      const statusInfo = getTaskStatus(tarea.fechaCumplimiento);
                      return (
                        <tr key={tarea.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-3 md:p-4 text-slate-300"><button onClick={() => tarea.source === 'Caso' ? toggleTaskCompletion(tarea.parentId, tarea.id) : toggleDocTaskCompletion(tarea.parentId, tarea.id)} className="hover:text-emerald-500 transition-colors"><Square size={20} /></button></td>
                          <td className="p-3 md:p-4"><div className="text-[10px] md:text-[11px] font-black text-slate-800 flex flex-wrap items-center gap-2 uppercase leading-tight">{String(tarea.parentName)} {statusInfo.status === 'upcoming' && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[7px] uppercase animate-pulse">Próximo</span>} {statusInfo.status === 'overdue' && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[7px] uppercase">Vencida</span>}</div><div className="text-[8px] md:text-[9px] text-slate-400 mt-1 uppercase font-bold">{String(tarea.source)}</div></td>
                          <td className="p-3 md:p-4 text-[11px] md:text-xs font-medium text-slate-700 leading-snug">{String(tarea.descripcion)}</td>
                          <td className="p-3 md:p-4 text-[9px] md:text-[10px] font-black text-blue-600 uppercase leading-snug">{String(tarea.responsable || 'No asignado')}</td>
                          <td className="p-3 md:p-4"><span className={`px-2 md:px-3 py-1.5 text-[8px] md:text-[9px] font-black uppercase rounded-lg flex items-center gap-1.5 w-fit border shadow-sm ${statusInfo.bgClass}`}>{statusInfo.showWarning && <AlertTriangle size={12}/>}{String(tarea.fechaCumplimiento || 'Sin Fecha')}</span></td>
                        </tr>
                      );
                    })}
                    {allPendingTasks.length === 0 && (<tr><td colSpan="5" className="p-8 md:p-12 text-center text-slate-300 font-black uppercase text-xs">No hay tareas pendientes en su red.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: ESTADÍSTICAS Y PLAZOS */}
        {activeTab === 'stats' && (currentUser.rol === 'Admin' || appConfig.showMetricsToNetwork) && (
          <div className="space-y-6 animate-in fade-in mt-14 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Estadísticas y Plazos</h2><p className="text-xs text-slate-500 font-medium mt-1">Análisis de respuesta en red</p></div>
            </div>
            {currentUser.rol === 'Admin' && (
              <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6 flex items-center gap-2"><Target size={16} className="text-blue-600"/> Configuración de Plazos Meta</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                      <div>
                        <Lbl>Meta General por Defecto</Lbl>
                        <p className="text-[10px] text-slate-500 mb-4 font-medium">Aplica para dispositivos sin plazo específico.</p>
                      </div>
                      <div className="flex items-center gap-2">
                         <input type="number" value={appConfig?.targetDays || 7} onChange={(e) => handleUpdateTarget(e.target.value)} className="w-24 p-3 bg-white border border-blue-100 rounded-xl text-center font-black text-blue-600 outline-none focus:border-blue-500 text-sm shadow-sm"/>
                         <span className="text-[10px] font-black text-slate-500 uppercase">Días</span>
                      </div>
                    </div>
                    <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                      <label className="block text-[10px] font-black text-blue-800 uppercase tracking-widest mb-2">Metas por Dispositivo</label>
                      <p className="text-[10px] text-blue-600 mb-4 font-medium">Asigna plazos distintos según la realidad del centro.</p>
                      <div className="flex gap-2 mb-4">
                        <input type="text" list="centros-list-plazos" value={plazoCentroInput} onChange={e=>setPlazoCentroInput(e.target.value)} placeholder="Centro..." className="flex-1 p-2.5 bg-white border border-blue-100 rounded-xl text-xs font-bold outline-none"/>
                        <datalist id="centros-list-plazos">{safeArr(centros).map(c=><option key={String(c)} value={String(c)}>{String(c)}</option>)}</datalist>
                        <input type="number" placeholder="Días" value={plazoDaysInput} onChange={e=>setPlazoDaysInput(e.target.value)} className="w-20 p-2.5 bg-white border border-blue-100 rounded-xl text-xs font-bold text-center outline-none"/>
                        <button onClick={handleAddPlazoCentro} className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 shadow-md"><Plus size={16}/></button>
                      </div>
                      <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                        {Object.entries(appConfig?.plazos || {}).map(([centroStr, dias]) => (
                          <div key={centroStr} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-blue-50">
                             <span className="text-[10px] font-black text-slate-700 uppercase leading-tight">{String(centroStr)}</span>
                             <div className="flex items-center gap-3 shrink-0"><span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{String(dias)} Días</span><button onClick={() => handleDeletePlazoCentro(centroStr)} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button></div>
                          </div>
                        ))}
                      </div>
                    </div>
                 </div>
              </div>
            )}
            <div className={`grid gap-4 ${isCompactMode ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-3'}`}>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-l-[8px] border-l-indigo-500"><div className="flex justify-between mb-3"><div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Timer size={18}/></div></div><h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enlace Administrativo</h3><p className="text-3xl md:text-4xl font-black text-slate-800 mt-1">{String(redMetrics.avgEnlace)} <span className="text-xs text-slate-300">Días</span></p></div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-l-[8px] border-l-blue-500"><div className="flex justify-between mb-3"><div className="p-2 bg-blue-50 rounded-xl text-blue-600"><BarChart3 size={18}/></div></div><h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ingreso Efectivo</h3><p className="text-3xl md:text-4xl font-black text-slate-800 mt-1">{String(redMetrics.avgIngreso)} <span className="text-xs text-slate-300">Días</span></p></div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-l-[8px] border-l-red-500 col-span-full md:col-span-1"><div className="flex justify-between mb-3"><div className="p-2 bg-red-50 rounded-xl text-red-600"><AlertTriangle size={18}/></div></div><h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Casos sobre meta</h3><p className="text-3xl md:text-4xl font-black text-slate-800 mt-1">{String(redMetrics.fueraDePlazo)} <span className="text-xs text-slate-300">Casos</span></p></div>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: CASOS DE RED */}
        {activeTab === 'cases' && (
          <div className="space-y-6 animate-in fade-in mt-14 md:mt-0">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
               <div><h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Seguimiento de Red</h2><p className="text-[10px] font-black text-slate-400 uppercase">Casos asociados a {getUserCentros(currentUser).join(', ') || 'Red SGCC'}</p></div>
               <div className="flex flex-wrap gap-2 w-full md:w-auto">
                 <button onClick={handleExportCSV} className={`${clsBtnS} bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex-1 md:flex-none justify-center`}><Download size={14} className="inline mr-1"/> Excel</button>
                 <button onClick={()=>{setEditingCaseId(null); setCaseForm(defaultCaseState); setIsCaseModalOpen(true);}} className={`${clsBtnP} flex-1 md:flex-none justify-center`}><Plus size={18}/> Nuevo Caso</button>
               </div>
             </div>
             <div className="bg-white p-5 rounded-2xl md:rounded-3xl shadow-sm border flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1 w-full"><Lbl className="!mt-0">Buscar Paciente</Lbl><Inp value={caseSearch} onChange={e=>setCaseSearch(e.target.value)} placeholder="Nombre o RUT..." className="py-2.5" /></div>
              <div className="w-full md:w-64"><Lbl className="!mt-0">Filtrar por Centro</Lbl><Sel value={caseFilterCentro} onChange={e=>setCaseFilterCentro(e.target.value)} className="py-2.5"><option value="Todos">Toda la Red</option>{safeArr(centros).map(c=>c && <option key={String(c)} value={String(c)}>{String(c)}</option>)}</Sel></div>
            </div>
             <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                     <thead className="bg-slate-50 border-b"><tr className="text-[9px] md:text-[10px] font-black uppercase text-slate-400"><th className="p-4 md:p-5">Paciente</th><th className="p-4 md:p-5">Ruta Traslado</th><th className="p-4 md:p-5 text-center">Hitos (A-B-C)</th><th className="p-4 md:p-5 text-center">Estado</th><th className="p-4 md:p-5 text-right">Ficha</th></tr></thead>
                     <tbody>{filteredCases.map(c => {
                       const daysC = diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo);
                       const target = getTargetDaysForCase(c.destino);
                       const isOver = daysC !== null && daysC > target;
                       return (
                         <tr key={c.id} className={`hover:bg-slate-50/80 transition-colors ${isOver ? 'bg-red-50/20' : ''}`}>
                            <td className="p-4 md:p-5"><p className="font-black text-[11px] md:text-xs uppercase text-slate-800">{String(c.nombre || '---')}</p><p className="text-[9px] text-slate-400 mt-1">{String(c.paciente || '---')}</p></td>
                            <td className="p-4 md:p-5">
                               <div className="text-[10px] font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg w-fit flex items-center gap-2 border border-blue-100">
                                 {String(c.origen || '---')} <Timer size={14}/> {String(c.destino || '---')}
                               </div>
                            </td>
                            <td className="p-4 md:p-5">
                               <div className="flex items-center justify-center gap-4 md:gap-8">
                                 <div className="text-center"><span className="text-[8px] font-bold text-slate-400 block uppercase mb-1">Egreso</span><span className="text-[11px] md:text-xs font-black text-slate-800">{String(c.fechaEgreso || '---')}</span></div>
                                 <div className="text-center border-l border-slate-200 pl-4 md:pl-8"><span className="text-[8px] font-bold text-blue-500 block uppercase mb-1">Recep</span><span className="text-[11px] md:text-xs font-black text-blue-700">{String(c.fechaRecepcionRed || '---')}</span></div>
                                 <div className="text-center border-l border-slate-200 pl-4 md:pl-8"><span className="text-[8px] font-bold text-emerald-500 block uppercase mb-1">Ingreso</span><span className={`text-[11px] md:text-xs font-black ${isOver ? 'text-red-600' : 'text-emerald-700'}`}>{String(c.fechaIngresoEfectivo || '---')}</span></div>
                               </div>
                            </td>
                            <td className="p-4 md:p-5 text-center"><StatusBadge status={c.estado}/></td>
                            <td className="p-4 md:p-5 text-right">
                              <button onClick={()=>{
                                const safeTutor = c.tutor && typeof c.tutor === 'object' ? c.tutor : { nombre: typeof c.tutor==='string'?c.tutor:'', relacion:'', telefono:'' };
                                const safeRefs = safeArr(c.referentes).filter(Boolean).map(r => typeof r === 'string' ? { nombre: r, dispositivo:'', contacto:'' } : r);
                                setEditingCaseId(c.id); 
                                setCaseForm({...c, tutor: safeTutor, referentes: safeRefs}); 
                                setIsCaseModalOpen(true);
                              }} className="p-2 md:p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><Eye size={16} className="md:w-5 md:h-5"/></button>
                            </td>
                         </tr>
                       );
                     })}
                     {filteredCases.length === 0 && (<tr><td colSpan="5" className="p-12 text-center text-slate-400 font-bold text-sm uppercase tracking-widest">No hay registros.</td></tr>)}
                     </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}

        {/* PESTAÑA 4: PROTOCOLOS - VISTA COMPACTA E HÍBRIDA */}
        {activeTab === 'docs' && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in mt-14 md:mt-0">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 md:gap-6">
              <div><h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Biblioteca de Protocolos</h2><p className="text-[10px] font-black text-slate-400 uppercase mt-1">Consultas y Normativas Vigentes de la Red</p></div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto items-start sm:items-end">
                <div className="flex-1 w-full sm:w-48"><Lbl className="!mt-0">Filtrar Ámbito</Lbl><Sel value={docFilterAmbito} onChange={e=>setDocFilterAmbito(e.target.value)} className="py-2.5 text-xs"><option value="Todos">Todos</option><option value="Red Integral">Red Integral</option>{safeArr(centros).map(c=>c && <option key={String(c)} value={String(c)}>{String(c)}</option>)}</Sel></div>
                <div className="flex-1 w-full sm:w-48"><Lbl className="!mt-0">Fase Trabajo</Lbl><Sel value={docFilterFase} onChange={e=>setDocFilterFase(e.target.value)} className="py-2.5 text-xs"><option value="Todos">Todas</option><option value="Levantamiento">Levantamiento</option><option value="Validación Técnica">Validación Técnica</option><option value="Resolución Exenta">Oficializado</option><option value="Difusión">Difusión</option></Sel></div>
                {currentUser.rol === 'Admin' && <button onClick={()=>{setEditingDocId(null); setDocForm(defaultDocState); setIsDocModalOpen(true);}} className={`${clsBtnP} w-full sm:w-auto h-[46px] sm:px-6 rounded-2xl`}><Plus size={16}/> Nueva Norma</button>}
              </div>
            </div>
            
            {/* LÓGICA DE VISTA COMPACTA / NORMAL */}
            {isCompactMode ? (
              <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-slate-50 border-b">
                      <tr className="text-[9px] md:text-[10px] font-black uppercase text-slate-400">
                        <th className="p-4 md:p-5">Ámbito</th>
                        <th className="p-4 md:p-5">Protocolo</th>
                        <th className="p-4 md:p-5">Fase</th>
                        <th className="p-4 md:p-5">Vigencia</th>
                        <th className="p-4 md:p-5 text-center">Avance</th>
                        <th className="p-4 md:p-5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredDocs.map(d => {
                        const sem = getSemaforoDoc(d);
                        return (
                          <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                             <td className="p-3 md:p-4"><span className="text-[8px] md:text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase whitespace-nowrap">{String(d.ambito || '---')}</span></td>
                             <td className="p-3 md:p-4"><h3 className="font-black text-xs md:text-sm text-slate-800 leading-tight uppercase">{String(d.nombre || '---')}</h3></td>
                             <td className="p-3 md:p-4"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase">{String(d.fase)}</span></td>
                             <td className="p-3 md:p-4"><span className={`font-black uppercase rounded-full ${sem.bgClass} text-[8px] md:text-[9px] px-2.5 py-1 whitespace-nowrap`}>{sem.label}</span></td>
                             <td className="p-3 md:p-4 w-32">
                                <div className="flex items-center gap-2">
                                   <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all" style={{width:`${d.avance || 0}%`}}></div></div>
                                   <span className="text-[9px] font-black text-slate-500">{String(d.avance || 0)}%</span>
                                </div>
                             </td>
                             <td className="p-3 md:p-4 text-right">
                               <div className="flex gap-1.5 justify-end">
                                 <button onClick={()=>{setEditingDocId(d.id); setDocForm(d); setIsDocModalOpen(true);}} className="p-1.5 md:p-2 text-slate-400 hover:text-blue-600 bg-white rounded-lg shadow-sm border border-slate-100">{currentUser.rol === 'Admin' ? <Edit2 size={14}/> : <Eye size={14}/>}</button>
                                 {currentUser.rol === 'Admin' && <button onClick={async ()=>{if(window.confirm('¿Eliminar?')) await deleteFromCloud('docs', d.id);}} className="p-1.5 md:p-2 text-slate-400 hover:text-red-600 bg-white rounded-lg shadow-sm border border-slate-100"><Trash2 size={14}/></button>}
                               </div>
                             </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredDocs.map((d) => {
                   const sem = getSemaforoDoc(d);
                   return (
                    <div key={d.id} className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 border-l-[8px] flex flex-col justify-between hover:shadow-lg transition-all" style={{ borderLeftColor: sem.hex }}>
                      <div>
                        <div className="flex justify-between items-start mb-3 md:mb-4">
                          <span className="text-[9px] md:text-[10px] font-black text-blue-600 bg-blue-50 px-2 md:px-3 py-1 rounded-lg uppercase">{String(d.ambito || '---')}</span>
                          <div className="flex gap-1.5 md:gap-2">
                             <button onClick={()=>{setEditingDocId(d.id); setDocForm(d); setIsDocModalOpen(true);}} className="p-1.5 md:p-2 text-slate-400 hover:text-blue-600">{currentUser.rol === 'Admin' ? <Edit2 size={14}/> : <Eye size={14}/>}</button>
                             {currentUser.rol === 'Admin' && <button onClick={async ()=>{if(window.confirm('¿Eliminar?')) await deleteFromCloud('docs', d.id);}} className="p-1.5 md:p-2 text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>}
                          </div>
                        </div>
                        <h3 className="text-sm md:text-base font-black text-slate-800 leading-tight uppercase mb-2">{String(d.nombre || '---')}</h3>
                        <span className={`text-[8px] md:text-[9px] font-black uppercase px-2 md:px-3 py-1 rounded-full ${sem.bgClass}`}>{sem.label}</span>
                      </div>
                      <div className="mt-6 md:mt-8">
                         <div className="flex justify-between text-[8px] md:text-[9px] font-black uppercase mb-1.5 text-slate-400"><span>Avance Técnico</span><span>{String(d.avance || 0)}%</span></div>
                         <div className="w-full bg-slate-100 rounded-full h-2 md:h-2.5"><div className="bg-blue-600 h-2 md:h-2.5 rounded-full transition-all" style={{width:`${d.avance || 0}%`}}></div></div>
                      </div>
                    </div>
                   )
                })}
                {filteredDocs.length === 0 && <div className="col-span-full py-12 text-center text-slate-400 font-bold uppercase text-xs md:text-sm tracking-widest">No hay protocolos.</div>}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑAS 5 Y 6: AUDITORÍAS Y CONSULTORÍAS */}
        {(activeTab === 'auditorias' || activeTab === 'consultorias') && (() => {
          const tipoLabel = activeTab === 'auditorias' ? 'Auditoría' : 'Consultoría';
          const currentFilter = activeTab === 'auditorias' ? centroFilterAuditorias : centroFilterConsultorias;
          const setFilter = activeTab === 'auditorias' ? setCentroFilterAuditorias : setCentroFilterConsultorias;
          const filteredAudits = safeArr(visibleAudits).filter(a => a.tipo === tipoLabel && (currentFilter === 'Todos' || a.centro === currentFilter));

          return (
            <div className="space-y-6 animate-in fade-in mt-14 md:mt-0">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">{tipoLabel === 'Auditoría' ? 'Auditorías Normativas' : 'Consultorías Clínicas'}</h2></div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <select value={currentFilter} onChange={e => setFilter(e.target.value)} className="flex-1 md:flex-none px-3 py-2.5 border-2 border-slate-200 rounded-xl text-[10px] font-bold bg-white outline-none"><option value="Todos">Toda la Red</option>{safeArr(centros).map(c => c && <option key={String(c)} value={String(c)}>{String(c)}</option>)}</select>
                  {currentUser?.rol === 'Admin' && (<button onClick={() => { setEditingTemplateId(null); setTemplateForm({nombre: '', metodoCalculo: 'Suma Automática', instruccionesDiagnostico: '', encabezados: [{ id: 'enc_1', label: 'Centro Evaluado', type: 'text' }, { id: 'enc_2', label: 'Fecha', type: 'date' }], criterios: [{ id: 'crit_1', pregunta: '', opciones: 'SÍ=1, NO=0' }], rangos: [], tipo: 'Ambos'}); setIsTemplateModalOpen(true); }} className={`${clsBtnS} flex-1 md:flex-none justify-center`}><Settings size={14} className="inline mr-1"/> Pautas</button>)}
                  <button onClick={() => { setAuditForm({ centro: centros[0] || '', templateId: auditTemplates.filter(Boolean).find(t => t.tipo === 'Ambos' || t.tipo === tipoLabel)?.id || '', headerAnswers: {}, answers: {}, tipo: tipoLabel, observaciones: '', fecha: new Date().toISOString().split('T')[0], estadoFinal: '' }); setIsAuditModalOpen(true); }} className={`${clsBtnP} w-full md:w-auto justify-center`}><ClipboardCheck size={16} /> Evaluar</button>
                </div>
              </div>
              <div className={`grid gap-4 ${isCompactMode ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                  {filteredAudits.map(a => {
                    const template = safeArr(auditTemplates).filter(Boolean).find(t => t.id === a.templateId);
                    return (
                    <div key={a.id} className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                       <div className="flex justify-between w-full gap-2">
                         <div className="min-w-0">
                           <h3 className="font-black text-slate-800 uppercase text-xs md:text-sm mb-1 truncate">{String(a.centro || '---')}</h3>
                           <p className="text-[8px] md:text-[9px] text-blue-600 font-black uppercase mb-2 bg-blue-50 px-2 py-0.5 rounded w-fit truncate max-w-full">{template ? String(template.nombre) : 'Pauta Eliminada'}</p>
                           <p className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase truncate"><Calendar size={10} className="inline"/> {String(a.fecha)} • {String(a.evaluador)}</p>
                         </div>
                         <div className="text-right shrink-0">
                            {a.cumplimiento !== undefined && <div className="text-2xl md:text-3xl font-black text-slate-800">{String(a.cumplimiento)}%</div>}
                            <span className="text-[7px] md:text-[8px] uppercase text-slate-400 font-black block">{String(a.puntaje)}</span>
                            <span className="text-[7px] md:text-[8px] uppercase text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg font-black mt-1 inline-block">{String(a.estado)}</span>
                         </div>
                       </div>
                       <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
                         {a.observaciones && <p className="text-[9px] md:text-[10px] text-slate-500 font-medium italic line-clamp-2"><MessageSquare size={12} className="inline mr-1"/> {String(a.observaciones)}</p>}
                         <div className="flex justify-end gap-2 mt-2">
                           <button onClick={() => setPrintingAudit(a)} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[8px] md:text-[9px] font-black uppercase hover:bg-slate-200 flex items-center gap-1.5 transition-colors"><Printer size={12}/> Ver / Imprimir</button>
                           {currentUser?.rol === 'Admin' && (<button onClick={async () => { if(window.confirm('¿Eliminar evaluación?')) await deleteFromCloud('audits', a.id); }} className="bg-red-50 text-red-500 px-3 py-1.5 rounded-lg text-[8px] md:text-[9px] font-black uppercase hover:bg-red-100 flex items-center gap-1.5 transition-colors"><Trash2 size={12}/> Eliminar</button>)}
                         </div>
                       </div>
                    </div>
                    );
                  })}
              </div>
            </div>
          );
        })()}

        {/* PESTAÑA: CENTROS / DISPOSITIVOS */}
        {activeTab === 'centros' && currentUser?.rol === 'Admin' && (
          <div className="space-y-6 animate-in fade-in mt-14 md:mt-0 p-6 md:p-8">
            <div className="flex justify-between items-end mb-6">
              <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Red de Dispositivos</h2><p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Administra los centros de la red SGCC</p></div>
            </div>
            <div className="bg-white p-5 md:p-8 rounded-[32px] shadow-sm border border-slate-200">
               <div className="flex flex-col md:flex-row gap-3 items-end mb-6 md:mb-8 border-b border-slate-100 pb-6 md:pb-8">
                 <div className="flex-1 w-full"><Lbl className="!mt-0">Crear Nuevo Dispositivo o Centro</Lbl><Inp value={newCentroName} onChange={e=>setNewCentroName(e.target.value)} placeholder="Ej: COSAM Castro..." /></div>
                 <button onClick={handleAddCentro} className={`${clsBtnP} w-full md:w-auto h-[46px] md:px-8`}><Plus size={16}/> Agregar a la Red</button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                 {safeArr(centros).filter(Boolean).map(c => {
                   const assignedUsers = safeArr(users).filter(Boolean).filter(u => getUserCentros(u).includes(c));
                   return (
                     <div key={String(c)} className="bg-slate-50 p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-4">
                             <h3 className="font-black text-base md:text-lg text-blue-700 uppercase tracking-tight">{String(c)}</h3>
                             <div className="flex gap-2">
                               <button onClick={()=>handleEditCentro(c)} className="p-2 text-slate-400 hover:text-blue-600 bg-white rounded-lg shadow-sm transition-colors" title="Editar Nombre"><Edit2 size={16}/></button>
                               <button onClick={()=>handleDeleteCentro(c)} className="p-2 text-slate-400 hover:text-red-600 bg-white rounded-lg shadow-sm transition-colors" title="Eliminar"><Trash2 size={16}/></button>
                             </div>
                          </div>
                          <div className="mb-4">
                             <Sel onChange={async (e) => {
                                const uId = e.target.value;
                                if(!uId) return;
                                const uToUpdate = users.find(x => x.id === uId);
                                if(uToUpdate) {
                                   const cList = getUserCentros(uToUpdate);
                                   if(!cList.includes(c)) await saveToCloud('users', uToUpdate.id, {...uToUpdate, centrosAsignados: [...cList, c]});
                                }
                                e.target.value = "";
                             }} className="py-2.5 text-xs border-blue-200 text-blue-700 bg-blue-50/50">
                                <option value="">+ Asignar Funcionario a este centro...</option>
                                {safeArr(users).filter(Boolean).filter(u => !getUserCentros(u).includes(c)).map(u => <option key={u.id} value={u.id}>{String(u.nombre)} ({String(u.cargo)})</option>)}
                             </Sel>
                          </div>
                          <Lbl className="!mb-2 text-slate-600">Funcionarios Asignados:</Lbl>
                          {assignedUsers.length > 0 ? (
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                              {assignedUsers.map(u => (
                                <div key={u.id} className="text-[10px] md:text-xs font-medium text-slate-700 bg-white px-3 py-2.5 rounded-xl border border-slate-200 flex justify-between items-center gap-2">
                                  <span className="flex items-center gap-2 min-w-0"><UserCheck size={14} className="text-emerald-500 shrink-0"/> <span className="truncate">{String(u.nombre)}</span> <span className="text-[8px] md:text-[9px] text-slate-400 uppercase hidden sm:inline truncate">({String(u.cargo)})</span></span>
                                  <button onClick={async () => {
                                     if(window.confirm(`¿Quitar a ${u.nombre} de ${c}?`)) {
                                        const newList = getUserCentros(u).filter(x => x !== c);
                                        await saveToCloud('users', u.id, {...u, centrosAsignados: newList});
                                     }
                                  }} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors shrink-0"><Trash2 size={14}/></button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] md:text-xs text-slate-400 italic bg-white px-3 py-2 rounded-xl border border-slate-200">Ningún usuario asignado aún.</p>
                          )}
                        </div>
                     </div>
                   );
                 })}
                 {safeArr(centros).length === 0 && <div className="col-span-full py-12 text-center text-slate-400 font-bold uppercase text-sm tracking-widest">No hay dispositivos creados en la red.</div>}
               </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: DIRECTORIO */}
        {activeTab === 'dir' && (
          <div className="space-y-6 animate-in fade-in mt-14 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Directorio Intersectorial</h2></div>
              <div className="flex w-full md:w-auto gap-3 items-center">
                <input type="text" value={dirSearch} onChange={e => setDirSearch(e.target.value)} className={`${clsInp} flex-1 md:w-64`} placeholder="Buscar contacto..."/>
              </div>
            </div>
            <div className={`grid gap-4 ${isCompactMode ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
              {safeArr(directory).filter(Boolean).filter(d => {
                 const search = String(dirSearch || '').toLowerCase();
                 return String(d.nombre||'').toLowerCase().includes(search) || String(d.institucion||'').toLowerCase().includes(search) || String(d.cargo||'').toLowerCase().includes(search);
              }).map((d, i) => (
                <div key={d.id || `dir-${i}`} className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 relative group hover:border-blue-200 transition-colors">
                   <h3 className="font-black text-slate-800 text-sm md:text-base mb-1 flex items-center gap-2"><User size={16} className="text-blue-600 shrink-0"/> <span className="truncate">{String(d.nombre || 'Sin nombre')}</span></h3>
                   <p className="text-[9px] md:text-[10px] text-indigo-600 font-black uppercase mb-3 ml-6 leading-tight">{String(d.cargo || '---')} • {String(d.institucion || '---')}</p>
                   <div className="space-y-0.5 ml-6"><p className="text-[9px] md:text-[10px] font-bold text-slate-500">{String(d.telefono || '')}</p><p className="text-[9px] md:text-[10px] font-bold text-slate-500 truncate">{String(d.correo || '')}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA: USUARIOS */}
        {activeTab === 'users' && currentUser?.rol === 'Admin' && (
          <div className="space-y-6 animate-in fade-in mt-14 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div><h2 className="text-2xl font-black text-slate-800">Gestión de Usuarios</h2></div>
              <button onClick={() => { setEditingUserId(null); setUserForm({ rut: '', nombre: '', iniciales: '', cargo: '', dispositivo: '', telefono: '', correo: '', password: '', rol: 'Usuario', centrosAsignados: [] }); setIsUserModalOpen(true); }} className={`${clsBtnP} w-full md:w-auto`}><UserPlus size={16} /> Crear Credencial</button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead className="bg-slate-50 border-b"><tr className="text-[9px] font-black text-slate-400 uppercase"><th className="p-4">Profesional</th><th className="p-4">Rol</th><th className="p-4">Dispositivo / Visibilidad</th><th className="p-4 text-right">Ajustes</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {safeArr(users).filter(Boolean).map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/80">
                        <td className="p-4"><div className="flex items-center gap-3"><div className="w-8 md:w-10 h-8 md:h-10 rounded-xl bg-blue-50 text-blue-600 font-black flex items-center justify-center shrink-0">{String(u.iniciales || 'U')}</div><div className="min-w-0"><p className="font-black text-slate-800 text-[11px] md:text-xs uppercase truncate">{String(u.nombre || 'Sin nombre')}</p><p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase mt-0.5 truncate">{String(u.rut || '---')} • {String(u.cargo || '---')}</p></div></div></td>
                        <td className="p-4"><span className={`px-2.5 py-1 rounded-lg text-[8px] md:text-[9px] font-black uppercase border shadow-sm ${u.rol === 'Admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-white text-slate-600 border-slate-200'}`}>{String(u.rol || 'Usuario')}</span></td>
                        <td className="p-4 text-[8px] md:text-[9px] font-black uppercase">
                          {u.rol === 'Admin' && <span className="text-indigo-500 block mb-1">Acceso Total a la Red</span>}
                          <div className="flex flex-wrap gap-1.5">
                            {getUserCentros(u).length > 0 ? getUserCentros(u).map(c => <span key={c} className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{String(c)}</span>) : <span className="text-slate-400">Ninguno asignado</span>}
                          </div>
                        </td>
                        <td className="p-4 text-right"><button onClick={() => { setEditingUserId(u.id); setUserForm({...u, centrosAsignados: getUserCentros(u), dispositivo: ''}); setIsUserModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 bg-white border shadow-sm rounded-lg mr-1.5"><Edit2 size={14}/></button>{u.rol !== 'Admin' && <button onClick={() => deleteFromCloud('users', u.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white border shadow-sm rounded-lg"><Trash2 size={14}/></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: CONFIGURACIÓN */}
        {activeTab === 'config' && currentUser?.rol === 'Admin' && (
          <div className="space-y-6 animate-in fade-in mt-14 md:mt-0">
            <h2 className="text-2xl font-black text-slate-800">Ajustes del Sistema</h2>
            
            <div className="bg-white p-6 md:p-8 rounded-[32px] border shadow-sm max-w-3xl space-y-8">
               <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 md:p-6 bg-blue-50 rounded-[24px] border border-blue-100 shadow-inner">
                  <div className="space-y-1">
                    <h4 className="font-black text-blue-800 text-xs md:text-sm uppercase">Visibilidad de Métricas de Red</h4>
                    <p className="text-[10px] md:text-xs font-bold text-blue-600 leading-relaxed">Activa o desactiva la pestaña "Plazos Meta" para los usuarios externos.</p>
                  </div>
                  <button onClick={()=>handleToggleMetricsVisibility(!appConfig.showMetricsToNetwork)} className={`w-16 h-8 rounded-full transition-all relative shrink-0 ${appConfig.showMetricsToNetwork?'bg-emerald-500':'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all ${appConfig.showMetricsToNetwork?'left-9':'left-1'}`}></div>
                  </button>
               </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border max-w-3xl mt-6 border-l-[8px] border-l-purple-500">
               <h3 className="font-black text-slate-800 text-sm md:text-base mb-2"><Activity size={18} className="inline text-purple-600 mr-2"/> Motor de Inteligencia Artificial</h3>
               <p className="text-[10px] md:text-xs text-slate-500 mb-6 font-medium">Ingresa tu API Key de Google AI Studio para habilitar los resúmenes automáticos y el análisis de bitácoras en la red.</p>
               <div className="flex flex-col sm:flex-row gap-3">
                 <Inp type="password" placeholder="AIzaSy..." value={appConfig?.geminiKey || ''} onChange={e => setAppConfig({...appConfig, geminiKey: e.target.value})} className="border-purple-200 focus:border-purple-500"/>
                 <button onClick={async () => { await saveToCloud('settings', 'config', { ...appConfig, geminiKey: appConfig.geminiKey }); alert("Llave Guardada"); }} className="bg-purple-600 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase hover:bg-purple-700 whitespace-nowrap transition-colors w-full sm:w-auto">Guardar Llave</button>
               </div>
            </div>
            
            <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border max-w-3xl mt-6">
               <h3 className="font-black text-slate-800 text-sm md:text-base mb-4"><ClipboardCheck size={18} className="inline text-blue-600 mr-2"/> Pautas Manuales</h3>
               <div className="space-y-3">
                 {safeArr(auditTemplates).filter(Boolean).map(t => (
                   <div key={t.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-xl border">
                     <div><span className="text-xs font-black text-slate-700 uppercase block">{String(t.nombre)}</span><span className="text-[9px] font-bold text-slate-400 uppercase mt-1 block">{String(t.metodoCalculo || 'Suma Automática')} • {safeArr(t.criterios).filter(Boolean).length} Criterios</span></div>
                     <div className="flex gap-2 w-full sm:w-auto"><button onClick={() => openTemplateEditor(t)} className="flex-1 sm:flex-none justify-center text-slate-400 hover:text-blue-600 p-2 bg-white rounded-lg border shadow-sm flex items-center"><Edit2 size={14}/></button><button onClick={async ()=>{ if(window.confirm(`¿Eliminar pauta ${t.nombre}?`)) await deleteFromCloud('auditTemplates', t.id); }} className="flex-1 sm:flex-none justify-center text-slate-400 hover:text-red-600 p-2 bg-white rounded-lg border shadow-sm flex items-center"><Trash2 size={14}/></button></div>
                   </div>
                 ))}
               </div>
               <button onClick={() => { setEditingTemplateId(null); setTemplateForm({nombre: '', metodoCalculo: 'Suma Automática', instruccionesDiagnostico: '', encabezados: [{ id: 'e1', label: 'Centro Evaluado', type: 'text' }, { id: 'e2', label: 'Fecha', type: 'date' }], criterios: [{ id: 'c1', pregunta: '', opciones: 'SÍ=1, NO=0' }], rangos: [], tipo: 'Ambos'}); setIsTemplateModalOpen(true); }} className={`${clsBtnP} mt-6 w-full sm:w-auto`}><Plus size={14}/> Crear Nueva Pauta</button>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL ASISTENTE IA DE DOCUMENTO ================= */}
      <ModalWrap isOpen={!!aiFileContext} mw="max-w-2xl">
         <ModalHdr t={`Asistente IA: ${aiFileContext?.nombre}`} onClose={()=>{setAiFileContext(null); setAiResponse(''); setAiPrompt('');}} icon={BrainCircuit} />
         <div className="p-4 md:p-6 flex flex-col h-[70vh] md:h-[60vh] bg-slate-50">
             <div className="flex-1 overflow-y-auto mb-4 bg-white p-4 md:p-5 rounded-2xl border shadow-inner text-xs md:text-sm whitespace-pre-wrap leading-relaxed text-slate-700">
                 {aiResponse || <span className="text-slate-400 italic">Escribe abajo tu consulta sobre este documento (resumen, diagnósticos, fechas)...</span>}
             </div>
             <div className="flex gap-2 md:gap-3 shrink-0">
                 <Inp value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="Ej: Haz un resumen clínico..." onKeyDown={e=>e.key==='Enter' && handleAskAiAboutFile()} disabled={isAnalyzingFile} className="py-3 md:py-auto" />
                 <button onClick={handleAskAiAboutFile} disabled={isAnalyzingFile || !aiPrompt.trim()} className={`${clsBtnP} px-4 md:px-5`}>{isAnalyzingFile ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}</button>
             </div>
         </div>
      </ModalWrap>

      {/* MODAL ONBOARDING OBLIGATORIO */}
      <ModalWrap isOpen={isOnboardingOpen} mw="max-w-xl">
         <div className="p-6 md:p-10 text-center space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="w-16 md:w-20 h-16 md:h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner"><UserCheck size={32} className="md:w-10 md:h-10"/></div>
            <h3 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight">Bienvenido a SGCC-SM</h3>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">Para habilitar tu acceso y formar parte del Directorio Regional, necesitamos completar tus datos oficiales.</p>
            <div className="grid grid-cols-1 gap-4 text-left">
               <div><Lbl>Nombre Completo</Lbl><Inp value={userForm.nombre || ''} onChange={e=>setUserForm({...userForm, nombre: e.target.value})} /></div>
               <div><Lbl>Cargo / Función en la Red</Lbl><Inp value={userForm.cargo || ''} onChange={e=>setUserForm({...userForm, cargo: e.target.value})} placeholder="Ej: Médico, Psicóloga, EU..." /></div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Lbl>Teléfono de Contacto</Lbl><Inp value={userForm.telefono || ''} onChange={e=>setUserForm({...userForm, telefono: e.target.value})} /></div>
                  <div><Lbl>Correo Electrónico Institucional</Lbl><Inp type="email" value={userForm.correo || ''} onChange={e=>setUserForm({...userForm, correo: e.target.value})} /></div>
               </div>
               <div className="border-t border-slate-100 pt-4 mt-2">
                  <Lbl>Dispositivos a los que pertenece (Puede marcar varios)</Lbl>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-40 overflow-y-auto p-4 border border-slate-200 rounded-2xl bg-slate-50 shadow-sm mt-1">
                    {safeArr(centros).filter(Boolean).map(c => {
                       const isChecked = getUserCentros(userForm).includes(c);
                       return (
                         <label key={String(c)} className={`flex items-center gap-3 text-xs font-bold p-3 rounded-xl cursor-pointer transition-colors ${isChecked?'bg-blue-100 text-blue-800 border border-blue-200':'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                           <input type="checkbox" className="accent-blue-600 w-5 h-5 cursor-pointer shrink-0" checked={isChecked} onChange={(e) => {
                               const curr = getUserCentros(userForm);
                               if(e.target.checked) setUserForm({...userForm, centrosAsignados: [...curr, c]});
                               else setUserForm({...userForm, centrosAsignados: curr.filter(x=>x!==c)});
                           }}/> <span className="leading-tight">{String(c)}</span>
                         </label>
                       );
                    })}
                  </div>
               </div>
            </div>
            <button onClick={handleSaveOnboarding} className={clsBtnP + " w-full py-4 md:py-5 rounded-3xl mt-4"}>Registrarme y Entrar</button>
         </div>
      </ModalWrap>

      {/* ================= MODALES COMPLETOS ================= */}
      <ModalWrap isOpen={isCaseModalOpen}>
        <ModalHdr t={editingCaseId ? `Paciente: ${caseForm.nombre}` : 'Nuevo Seguimiento de Red'} onClose={()=>setIsCaseModalOpen(false)} icon={Users} />
        <div className="flex bg-slate-50 border-b px-6 shrink-0 overflow-x-auto">
          <button onClick={() => setActiveModalTab('datos')} className={`px-4 md:px-6 py-3 md:py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest md:tracking-[0.2em] border-b-4 whitespace-nowrap ${activeModalTab === 'datos' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Ficha Básica</button>
          <button onClick={() => setActiveModalTab('bitacora')} className={`px-4 md:px-6 py-3 md:py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest md:tracking-[0.2em] border-b-4 whitespace-nowrap ${activeModalTab === 'bitacora' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Bitácora Clínica</button>
          <button onClick={() => setActiveModalTab('archivos')} className={`px-4 md:px-6 py-3 md:py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest md:tracking-[0.2em] border-b-4 whitespace-nowrap ${activeModalTab === 'archivos' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Epicrisis e IA</button>
        </div>
        <div className="p-4 md:p-8 overflow-y-auto flex-1 bg-white">
          {activeModalTab === 'datos' && (
            <div className="space-y-6 md:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div><Lbl>RUT Paciente</Lbl><Inp value={caseForm.rut || ''} onChange={e=>setCaseForm({...caseForm, rut: e.target.value})} disabled={!!editingCaseId} /></div>
                <div className="md:col-span-2"><Lbl>Nombre Completo</Lbl><Inp value={caseForm.nombre || ''} onChange={e=>setCaseForm({...caseForm, nombre: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                 <div><Lbl>Origen</Lbl><Sel value={caseForm.origen || ''} onChange={e=>setCaseForm({...caseForm, origen: e.target.value})}><option value="">Seleccione...</option>{safeArr(centros).map(c=><option key={String(c)} value={String(c)}>{String(c)}</option>)}</Sel></div>
                 <div><Lbl>Destino</Lbl><Sel value={caseForm.destino || ''} onChange={e=>setCaseForm({...caseForm, destino: e.target.value})}><option value="">Seleccione...</option>{safeArr(centros).map(c=><option key={String(c)} value={String(c)}>{String(c)}</option>)}</Sel></div>
                 <div><Lbl>Prioridad</Lbl><Sel value={caseForm.prioridad || ''} onChange={e=>setCaseForm({...caseForm, prioridad: e.target.value})}><option>Baja</option><option>Media</option><option>Alta</option></Sel></div>
                 <div><Lbl>Estado Enlace</Lbl><Sel value={caseForm.estado || ''} onChange={e=>setCaseForm({...caseForm, estado: e.target.value})}><option>Pendiente</option><option>Concretado</option><option>Alerta</option></Sel></div>
              </div>
              <div className="border-t border-slate-100 pt-6 md:pt-8 mt-2">
                 <Lbl className="!mb-3 md:!mb-4">Tutor Legal / Familiar Responsable</Lbl>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8 bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
                   <div><Lbl className="!mt-0">Nombre Completo</Lbl><Inp value={caseForm.tutor?.nombre||''} onChange={e=>setCaseForm({...caseForm, tutor: {...caseForm.tutor, nombre: e.target.value}})} placeholder="Ej: María Cáceres"/></div>
                   <div><Lbl className="!mt-0">Parentesco</Lbl><Inp value={caseForm.tutor?.relacion||''} onChange={e=>setCaseForm({...caseForm, tutor: {...caseForm.tutor, relacion: e.target.value}})} placeholder="Ej: Madre"/></div>
                   <div><Lbl className="!mt-0">Teléfono</Lbl><Inp value={caseForm.tutor?.telefono||''} onChange={e=>setCaseForm({...caseForm, tutor: {...caseForm.tutor, telefono: e.target.value}})} placeholder="+56 9..."/></div>
                 </div>

                 <div className="flex flex-col mb-4 md:mb-6 border-t border-slate-100 pt-6 md:pt-8">
                    <h4 className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><UserCheck size={16} className="text-blue-600"/> Liderazgo y Profesionales Intervinientes</h4>
                    <p className="text-[9px] md:text-[10px] text-slate-500 font-bold mt-1">El Líder Clínico es el único facultado para registrar una Reunión de Red.</p>
                 </div>
                 
                 <div className="mb-4 md:mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                    <Lbl className="!mt-0 text-indigo-800">Líder Clínico del Caso (Opcional)</Lbl>
                    <Sel value={caseForm.liderCaso || ''} onChange={e=>setCaseForm({...caseForm, liderCaso: e.target.value})} className="border-indigo-200">
                       <option value="">Ninguno / Sin asignar</option>
                       {safeArr(caseForm.referentes).filter(Boolean).filter(r=>r.nombre).map(r => (
                          <option key={String(r.nombre)} value={String(r.nombre)}>{String(r.nombre)}</option>
                       ))}
                    </Sel>
                 </div>

                 {safeArr(caseForm.referentes).filter(Boolean).map((ref, i) => (
                    <div key={i} className="flex gap-2 md:gap-4 mb-3 bg-slate-50 p-3 md:p-4 rounded-[20px] border border-slate-100">
                      <div className="flex-1"><Inp list="sys-users-dir" value={ref?.nombre || ''} onChange={e=>{const r=[...caseForm.referentes]; r[i].nombre=e.target.value; setCaseForm({...caseForm, referentes:r})}} placeholder="Buscar en Directorio..." /></div>
                      <button onClick={()=>{const r=[...caseForm.referentes]; r.splice(i,1); setCaseForm({...caseForm, referentes:r})}} className="p-3 bg-red-50 text-red-500 rounded-xl"><Trash2 size={16}/></button>
                    </div>
                 ))}
                 <button onClick={()=>setCaseForm({...caseForm, referentes: [...safeArr(caseForm.referentes), {nombre:'', dispositivo:'', contacto:''}]})} className="text-[9px] md:text-[10px] font-black uppercase text-blue-600 bg-blue-50 w-full md:w-auto px-5 py-3.5 md:py-3 rounded-xl hover:bg-blue-100 transition-all">+ Añadir Referente</button>
              </div>
            </div>
          )}
          {activeModalTab === 'bitacora' && (
             <div className="space-y-6">
                <div className="bg-slate-900 rounded-[24px] md:rounded-[32px] p-5 md:p-8 text-white">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
                      <div><Lbl className="text-blue-300">Tipo de Intervención</Lbl>
                        <Sel value={newBitacoraEntry.tipo || ''} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, tipo: e.target.value})} className="bg-white/10 border-white/20 text-white">
                           <option value="Nota Adm." className="text-black">Nota Administrativa</option>
                           <option value="Intervención" className="text-black">Intervención Clínica</option>
                           {(currentUser?.rol === 'Admin' || caseForm.liderCaso === currentUser?.nombre) && <option value="Reunión" className="text-black">🤝 Reunión de Red (Líderes)</option>}
                           {currentUser?.rol === 'Admin' && <option value="Tarea" className="text-black">🎯 Asignar Tarea de Enlace</option>}
                        </Sel>
                      </div>
                      <div className="flex flex-col items-center justify-center border border-white/10 rounded-2xl bg-white/5 p-3">
                        <p className="text-[8px] md:text-[9px] text-blue-200 uppercase mb-1">Firma Digital Automática</p>
                        <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-blue-400 text-center">{String(currentUser?.nombre)}</p>
                      </div>
                   </div>
                   <select value={newBitacoraEntry.barrera || ''} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, barrera: e.target.value})} className={newBitacoraEntry.barrera !== 'Ninguna' ? `${clsInp} bg-red-50 text-red-700 border-red-200 mb-4` : `${clsInp} mb-4`}>
                       <option value="Ninguna">✅ Sin Barrera (Gestión Exitosa)</option>
                       <optgroup label="Dispositivo / Red">
                           <option value="Falta Cupo Médico">⚠️ Falta Cupo Médico (Psiquiatra)</option>
                           <option value="Falta Cupo Psicosocial">⚠️ Falta Cupo Equipo Psicosocial</option>
                           <option value="Rechazo Derivación">⚠️ Rechazo de Derivación</option>
                           <option value="Error Documentación">⚠️ Error en Documentación / Trámite</option>
                       </optgroup>
                       <optgroup label="Usuario / Familia">
                           <option value="Inasistencia Usuario">🚨 Inasistencia Usuario</option>
                           <option value="Inaccesibilidad/Traslado">🚨 Inaccesibilidad Geográfica/Traslado</option>
                           <option value="Rechazo Tratamiento">🚨 Rechazo Tratamiento (Tutor/Pte)</option>
                           <option value="Crisis Social/Familiar">🚨 Crisis Social/Familiar Aguda</option>
                       </optgroup>
                       <optgroup label="Intersectorial">
                           <option value="Espera Resolución Judicial">⚖️ Espera Resolución Judicial</option>
                           <option value="Falta Plaza Residencia">🏠 Falta Plaza Residencia (Mejor Niñez)</option>
                       </optgroup>
                   </select>

                   {newBitacoraEntry.tipo === 'Tarea' && (
                     <div className="mb-4 space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
                       <Inp list="app-users-list" placeholder="Asignar a... (Buscar por Nombre/Cargo)" value={newBitacoraEntry.responsable || ''} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, responsable: e.target.value})} className="mb-2 text-black" />
                       <Inp type="date" value={newBitacoraEntry.fechaCumplimiento || ''} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, fechaCumplimiento: e.target.value})} className="text-black" />
                     </div>
                   )}
                   <Txt rows="3" value={newBitacoraEntry.descripcion || ''} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, descripcion: e.target.value})} placeholder="Detalle la gestión o acuerdo alcanzado..." className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" />
                   <div className="flex justify-end mt-4"><button onClick={handleAddBitacora} className={`${clsBtnP} w-full md:w-auto py-3.5 md:py-3`}>Sellar Registro</button></div>
                </div>
                <div className="space-y-3">
                   {safeArr(caseForm.bitacora).filter(Boolean).map(b => (
                     <div key={b.id} className="p-4 md:p-6 border border-slate-200 rounded-[20px] md:rounded-[24px] bg-white shadow-sm flex flex-col gap-2">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[9px] md:text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">{String(b.tipo)}</span>
                            {b.barrera && b.barrera !== 'Ninguna' && <span className="bg-red-100 text-red-700 text-[8px] font-black px-2 py-0.5 rounded uppercase flex items-center gap-1"><AlertTriangle size={10}/> Barrera: {String(b.barrera)}</span>}
                          </div>
                          <span className="text-[9px] md:text-[10px] font-bold text-slate-400">{String(b.fecha)}</span>
                        </div>
                        
                        {b.tipo === 'Tarea' && (
                           <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <button onClick={() => toggleCaseModalTask(b.id)} className={`flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest ${b.completada ? "text-emerald-600" : "text-amber-500 hover:text-amber-600"}`}>
                                  {b.completada ? <CheckSquare size={16} className="md:w-5 md:h-5"/> : <Square size={16} className="md:w-5 md:h-5"/>} 
                                  {b.completada ? 'Tarea Completada' : 'Marcar como Completada'}
                              </button>
                              <span className="text-[8px] md:text-[10px] text-slate-500 sm:ml-auto uppercase leading-tight">Asignado a: {String(b.responsable || 'Sin asignar')} <br className="sm:hidden"/>| Vence: {String(b.fechaCumplimiento)}</span>
                           </div>
                        )}

                        <p className={`text-xs md:text-sm font-medium leading-relaxed whitespace-pre-wrap mt-2 ${b.completada ? 'line-through text-slate-400' : 'text-slate-700'}`}>{String(b.descripcion)}</p>
                        
                        <div className="flex justify-between items-center mt-2 border-t pt-2 md:pt-3">
                          <p className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 flex items-center gap-1 md:gap-2"><UserCheck size={12}/> Firmado por: {String(b.firma || b.responsable || 'S.A.')}</p>
                          {(currentUser?.rol === 'Admin' || b.creadorId === currentUser?.id) && (
                            <button onClick={()=>setCaseForm({...caseForm, bitacora: caseForm.bitacora.filter(x=>x.id!==b.id)})} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={14}/></button>
                          )}
                        </div>
                     </div>
                   ))}
                   {safeArr(caseForm.bitacora).length === 0 && <p className="text-center text-xs text-slate-400 italic py-8">No hay registros en la bitácora.</p>}
                </div>
             </div>
          )}
          {activeModalTab === 'archivos' && (
            <div className="space-y-4">
               <div className="bg-indigo-50 p-6 rounded-2xl text-center border-dashed border-2 border-indigo-200">
                 <label className={`cursor-pointer font-black text-xs uppercase ${isUploadingCaseFile ? 'text-slate-400' : 'text-indigo-700 hover:text-indigo-900'}`}>
                    <UploadCloud size={20} className="mx-auto mb-2"/> 
                    {isUploadingCaseFile ? 'Subiendo Documento...' : 'Subir Documento Clínico'}
                    <input type="file" className="hidden" disabled={isUploadingCaseFile} onChange={handleCaseFileUpload} />
                 </label>
               </div>
               <div className="space-y-2">
                 {safeArr(caseForm.archivos).filter(Boolean).map(f => (
                   <div key={f.id} className="p-3 bg-white border rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 group hover:border-indigo-200 transition-colors">
                      <span className="text-[10px] md:text-xs font-bold text-slate-700 w-full truncate">{String(f.nombre)} <span className="text-[8px] md:text-[9px] text-slate-400 ml-2">{String(f.size)}</span></span>
                      <div className="flex gap-2 self-end sm:self-auto">
                        {currentUser?.rol === 'Admin' && <button onClick={(e)=>{e.preventDefault(); setAiFileContext(f);}} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"><BrainCircuit size={14}/></button>}
                        <a href={f.url} target="_blank" rel="noreferrer" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"><ExternalLink size={14}/></a>
                        {(currentUser?.rol === 'Admin' || f.creadorId === currentUser?.id) && (
                          <button onClick={()=>setCaseForm(p=>({...p, archivos: p.archivos.filter(a=>a.id!==f.id)}))} className="text-red-400 p-2 hover:bg-red-50 rounded-lg ml-2"><Trash2 size={14}/></button>
                        )}
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>
        <ModalFtr onCancel={()=>setIsCaseModalOpen(false)} onSave={handleSaveCase} />
      </ModalWrap>

      <ModalWrap isOpen={isDocModalOpen}>
        <ModalHdr t={editingDocId ? 'Editar Protocolo' : 'Nuevo Protocolo'} onClose={()=>setIsDocModalOpen(false)} icon={FileText} />
        <div className="flex bg-slate-50 border-b shrink-0 px-6">
          <button onClick={() => setActiveDocModalTab('datos')} className={`px-4 md:px-6 py-3 md:py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest md:tracking-[0.2em] border-b-4 whitespace-nowrap ${activeDocModalTab === 'datos' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Datos Generales</button>
          <button onClick={() => setActiveDocModalTab('bitacora')} className={`px-4 md:px-6 py-3 md:py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest md:tracking-[0.2em] border-b-4 whitespace-nowrap ${activeDocModalTab === 'bitacora' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Tareas y Fases</button>
          <button onClick={() => setActiveDocModalTab('archivos')} className={`px-4 md:px-6 py-3 md:py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest md:tracking-[0.2em] border-b-4 whitespace-nowrap ${activeDocModalTab === 'archivos' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Archivos e IA</button>
        </div>
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-white space-y-6">
          {activeDocModalTab === 'datos' && (
            <div className="space-y-4">
              <div><Lbl>Nombre del Protocolo</Lbl><Inp value={docForm.nombre || ''} onChange={e=>setDocForm({...docForm, nombre: e.target.value})} disabled={currentUser?.rol !== 'Admin'} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Lbl>Ámbito Aplicable</Lbl>
                  <Inp list="ambitos-list" value={docForm.ambito || ''} onChange={e=>setDocForm({...docForm, ambito: e.target.value})} placeholder="Escriba o seleccione..." disabled={currentUser?.rol !== 'Admin'} />
                  <datalist id="ambitos-list">
                    <option value="APS"/>
                    <option value="Atención Cerrada"/>
                    <option value="Red Integral"/>
                    <option value="Hospitalario"/>
                    {safeArr(centros).filter(Boolean).map(c=><option key={String(c)} value={String(c)}>{String(c)}</option>)}
                  </datalist>
                </div>
                <div><Lbl>Fase de Trabajo</Lbl><Sel value={docForm.fase || ''} onChange={e=>setDocForm({...docForm, fase: e.target.value})} disabled={currentUser?.rol !== 'Admin'}><option>Levantamiento</option><option>Validación Técnica</option><option>Resolución Exenta</option><option>Difusión</option></Sel></div>
                <div><Lbl>Prioridad de Gestión</Lbl><Sel value={docForm.prioridad || ''} onChange={e=>setDocForm({...docForm, prioridad: e.target.value})} disabled={currentUser?.rol !== 'Admin'}><option>Alta</option><option>Media</option><option>Baja</option></Sel></div>
                <div><Lbl>Fecha Resolución Oficial</Lbl><Inp type="date" value={docForm.fechaResolucion || ''} onChange={e=>setDocForm({...docForm, fechaResolucion: e.target.value})} disabled={currentUser?.rol !== 'Admin'} /></div>
                
                <div><Lbl>Fecha Fin de Vigencia (Opcional)</Lbl><Inp type="date" value={docForm.fechaVencimiento || ''} onChange={e=>setDocForm({...docForm, fechaVencimiento: e.target.value})} disabled={currentUser?.rol !== 'Admin'} /></div>
                <div><Lbl>Días de aviso previo a vencer</Lbl><Inp type="number" placeholder="Ej: 90" value={docForm.diasAvisoVencimiento || 90} onChange={e=>setDocForm({...docForm, diasAvisoVencimiento: parseInt(e.target.value) || 90})} disabled={currentUser?.rol !== 'Admin'} /></div>
                
                {currentUser?.rol === 'Admin' && (
                   <div className="col-span-1 sm:col-span-2 flex items-center gap-3 mt-2 bg-red-50 p-4 rounded-xl border border-red-100">
                       <input type="checkbox" id="reqAct" checked={docForm.requiereActualizacionTecnica || false} onChange={e=>setDocForm({...docForm, requiereActualizacionTecnica: e.target.checked})} className="w-5 h-5 cursor-pointer accent-red-600 shrink-0" />
                       <label htmlFor="reqAct" className="text-[9px] md:text-[10px] font-black text-red-600 uppercase cursor-pointer flex items-center gap-2 leading-tight"><ShieldAlert size={14} className="shrink-0"/> Marcar como "Requiere Actualización Técnica" (Invalida fechas y activa alerta roja)</label>
                   </div>
                )}
              </div>
              <div><Lbl>Notas y Observaciones Generales</Lbl><Txt rows="3" value={docForm.notas || ''} onChange={e=>setDocForm({...docForm, notas: e.target.value})} placeholder="Apuntes o ideas principales..." disabled={currentUser?.rol !== 'Admin'} /></div>
            </div>
          )}
          {activeDocModalTab === 'bitacora' && (() => {
             const docTareas = safeArr(docForm.bitacora).filter(Boolean).filter(b => b.tipo === 'Tarea');
             const docAvanceTemp = docTareas.length > 0 ? Math.round((docTareas.filter(t => t.completada).length / docTareas.length) * 100) : (docForm.avance || 0);
             return (
             <div className="space-y-4">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                  <div className="flex flex-col"><span className="text-[9px] md:text-[10px] font-black uppercase text-blue-800 tracking-widest">Avance Automatizado</span><span className="text-[10px] md:text-xs text-blue-600 font-medium">Calculado por tareas cumplidas</span></div>
                  <span className="text-xl md:text-2xl font-black text-blue-600">{docAvanceTemp}%</span>
                </div>
                {currentUser?.rol === 'Admin' && (
                  <div className="bg-slate-50 p-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Inp list="app-users-list" value={newDocBitacoraEntry.responsable || ''} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, responsable: e.target.value})} placeholder="Resp (Nombre)..." />
                    <Inp type="date" value={newDocBitacoraEntry.fechaCumplimiento || ''} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, fechaCumplimiento: e.target.value})} />
                    <Txt rows="1" value={newDocBitacoraEntry.descripcion || ''} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, descripcion: e.target.value})} placeholder="Asignar tarea a la red..." className="col-span-2"/>
                    <button onClick={handleAddDocBitacora} className={clsBtnP + " col-span-2 py-3.5"}>Añadir Tarea</button>
                  </div>
                )}
                {safeArr(docForm.bitacora).filter(Boolean).map(b => (
                  <div key={b.id} className="p-4 border border-slate-200 rounded-xl flex items-start gap-3 md:gap-4 hover:border-blue-200 transition-colors flex-col bg-white">
                    <div className="flex w-full justify-between items-start gap-4">
                      <div className="flex-1">
                         <div className="flex items-center gap-2 mb-1">
                           <span className="text-[9px] md:text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 md:px-3 py-1 rounded-lg">{String(b.tipo)}</span>
                           <span className="text-[9px] md:text-[10px] font-bold text-slate-400">{String(b.fecha)}</span>
                         </div>
                         <p className={`text-xs md:text-sm font-bold mt-2 ${b.completada ? 'line-through text-slate-400' : 'text-slate-800'}`}>{String(b.descripcion)}</p>
                      </div>
                      {currentUser?.rol === 'Admin' && <button onClick={() => setDocForm(p => ({ ...p, bitacora: safeArr(p.bitacora).filter(x => x.id !== b.id) }))} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>}
                    </div>

                    {b.tipo === 'Tarea' && (
                       <div className="flex w-full flex-col sm:flex-row sm:items-center gap-3 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <button onClick={() => toggleDocModalTask(b.id)} className={`flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest ${b.completada ? "text-emerald-600" : "text-amber-500 hover:text-amber-600"}`}>
                              {b.completada ? <CheckSquare size={16} className="md:w-5 md:h-5"/> : <Square size={16} className="md:w-5 md:h-5"/>} 
                              {b.completada ? 'Completada' : 'Marcar Completada'}
                          </button>
                          <span className="text-[8px] md:text-[10px] text-slate-500 sm:ml-auto uppercase leading-tight">Asignado a: {String(b.responsable || 'Sin asignar')} <br className="sm:hidden"/>| Vence: {String(b.fechaCumplimiento)}</span>
                       </div>
                    )}
                    <div className="flex justify-between items-center w-full mt-2 border-t pt-2 md:pt-3">
                       <p className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 flex items-center gap-1 md:gap-2"><UserCheck size={12}/> Firmado por: {String(b.firma || b.responsable || 'S.A.')}</p>
                    </div>
                  </div>
                ))}
             </div>
             );
          })()}
          {activeDocModalTab === 'archivos' && (() => {
             const docTareas = safeArr(docForm.bitacora).filter(Boolean).filter(b => b.tipo === 'Tarea');
             const docAvanceTemp = docTareas.length > 0 ? Math.round((docTareas.filter(t => t.completada).length / docTareas.length) * 100) : (docForm.avance || 0);
             return (
             <div className="space-y-6">
               {docAvanceTemp === 100 && safeArr(docForm.archivos).filter(Boolean).length > 0 && currentUser?.rol === 'Admin' && (
                 <div className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><CheckCircle size={24}/></div>
                    <div><h4 className="font-black text-emerald-800 uppercase tracking-widest">¡Tareas al 100%!</h4><p className="text-xs text-emerald-700">El borrador está listo para convertirse en oficial.</p></div>
                    <button onClick={handleOficializarBorrador} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 flex items-center gap-2">🌟 Oficializar Borrador</button>
                 </div>
               )}
               
               <div>
                 <Lbl className="bg-indigo-50 text-indigo-800 px-3 py-2 rounded-lg border border-indigo-100 inline-block mb-3">1. Documento Oficial Vigente</Lbl>
                 <div className="space-y-2 mb-4">
                   {safeArr(docForm.archivosOficiales).filter(Boolean).map(f => (
                     <div key={f.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 bg-white border-2 border-indigo-50 rounded-xl group hover:border-indigo-200 transition-colors">
                        <span className="text-[10px] md:text-xs font-black text-indigo-900 w-full truncate">{String(f.nombre)} <span className="text-[8px] md:text-[9px] text-slate-400 ml-2 font-medium">{String(f.size)}</span></span>
                        <div className="flex gap-2 items-center self-end sm:self-auto">
                          {currentUser?.rol === 'Admin' && <button onClick={(e)=>{e.preventDefault(); setAiFileContext(f);}} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all" title="Analizar con IA"><BrainCircuit size={14}/></button>}
                          {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="text-[9px] md:text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded flex items-center gap-1"><ExternalLink size={12}/> Abrir</a>}
                          {currentUser?.rol === 'Admin' && <button onClick={()=>setDocForm(p=>({...p, archivosOficiales: p.archivosOficiales.filter(a=>a.id!==f.id)}))} className="text-red-400 p-1.5 hover:bg-red-50 rounded"><Trash2 size={14}/></button>}
                        </div>
                     </div>
                   ))}
                   {safeArr(docForm.archivosOficiales).filter(Boolean).length === 0 && <p className="text-[10px] text-slate-400 italic">No hay documento oficial publicado.</p>}
                 </div>
                 {currentUser?.rol === 'Admin' && (
                   <label className={`cursor-pointer inline-block text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors ${isUploadingDocFile ? 'opacity-50 pointer-events-none' : ''}`}>
                     <UploadCloud size={14} className="inline mr-2"/> {isUploadingDocFile ? 'Subiendo...' : 'Subir Oficial Manualmente'}
                     <input type="file" className="hidden" disabled={isUploadingDocFile} onChange={(e) => handleDocFileUpload(e, 'archivosOficiales')} />
                   </label>
                 )}
               </div>

               <div className="border-t border-slate-100 pt-6">
                 <Lbl className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg border border-slate-200 inline-block mb-3">2. Borradores e Insumos (Mesa Técnica)</Lbl>
                 {currentUser?.rol === 'Admin' && (
                   <div className="bg-slate-50 p-4 rounded-xl text-center mb-4 border border-dashed border-slate-300">
                     <label className={`cursor-pointer block text-slate-600 font-black text-[10px] md:text-xs uppercase ${isUploadingDocFile ? 'text-slate-400 pointer-events-none' : 'text-slate-600'}`}>
                        <UploadCloud size={20} className="mx-auto mb-1 md:mb-2 text-slate-400"/> 
                        {isUploadingDocFile ? 'Subiendo Documento...' : 'Subir Borrador / Insumo'}
                        <input type="file" className="hidden" disabled={isUploadingDocFile} onChange={(e) => handleDocFileUpload(e, 'archivos')} />
                     </label>
                   </div>
                 )}
                 <div className="space-y-2">
                   {safeArr(docForm.archivos).filter(Boolean).map(f => (
                     <div key={f.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl group hover:border-indigo-200 transition-colors">
                        <span className="text-[10px] md:text-xs font-bold text-slate-700 w-full truncate">{String(f.nombre)} <span className="text-[8px] md:text-[9px] text-slate-400 ml-2">{String(f.size)}</span></span>
                        <div className="flex gap-2 items-center self-end sm:self-auto">
                          {currentUser?.rol === 'Admin' && <button onClick={(e)=>{e.preventDefault(); setAiFileContext(f);}} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all" title="Analizar con IA"><BrainCircuit size={14}/></button>}
                          {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="text-[9px] md:text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded flex items-center gap-1"><ExternalLink size={12}/> Abrir</a>}
                          {currentUser?.rol === 'Admin' && <button onClick={()=>setDocForm(p=>({...p, archivos: p.archivos.filter(a=>a.id!==f.id)}))} className="text-red-400 p-1.5 hover:bg-red-50 rounded ml-2"><Trash2 size={14}/></button>}
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
             );
          })()}
        </div>
        <ModalFtr onCancel={()=>setIsDocModalOpen(false)} onSave={handleSaveDoc} disableSave={currentUser?.rol !== 'Admin'} saveTxt={currentUser?.rol === 'Admin' ? 'Guardar' : 'Cerrar (Solo Lectura)'} hideSave={currentUser?.rol !== 'Admin'} />
      </ModalWrap>

      <ModalWrap isOpen={isTemplateModalOpen} mw="max-w-5xl">
        <ModalHdr t={editingTemplateId ? 'Editar Formulario' : 'Diseñador de Pautas'} onClose={()=>setIsTemplateModalOpen(false)} icon={Settings} />
        <div className="p-4 md:p-8 overflow-y-auto flex-1 bg-slate-50 grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-indigo-50 p-5 md:p-6 rounded-2xl border border-indigo-100 text-center">
                <h4 className="text-[11px] font-black text-indigo-900 uppercase tracking-widest mb-3"><Wand2 size={16} className="inline mr-2"/> Carga IA</h4>
                <label className="flex items-center justify-center w-full h-12 border-2 border-indigo-300 border-dashed rounded-xl cursor-pointer bg-white mb-2"><span className="text-[9px] font-black uppercase text-indigo-700">Subir PDF</span><input type="file" className="hidden" accept=".pdf" onChange={handlePdfUploadForAI} /></label>
                <Txt value={rawTextForAI} onChange={e=>setRawTextForAI(e.target.value)} className="mb-2 text-[10px] md:text-xs min-h-[60px]" placeholder="O pega el texto..." />
                <button onClick={handleProcessRawTextForAI} disabled={!rawTextForAI.trim() || isDigitizing} className="w-full bg-indigo-600 text-white py-3 rounded-xl text-[10px] font-black uppercase">{isDigitizing ? 'Procesando...' : 'Generar'}</button>
              </div>
              <div className="bg-white p-4 md:p-5 border border-slate-200 rounded-2xl">
                <Lbl>Nombre del Instrumento</Lbl><Inp value={templateForm.nombre || ''} onChange={e=>setTemplateForm({...templateForm, nombre: e.target.value})}/>
                <Lbl className="mt-4">Método de Evaluación</Lbl>
                <Sel value={templateForm.metodoCalculo || 'Suma Automática'} onChange={e=>setTemplateForm({...templateForm, metodoCalculo: e.target.value})}>
                  <option value="Suma Automática">Suma Automática</option><option value="Juicio Clínico">Juicio Clínico</option>
                </Sel>
                
                {templateForm.metodoCalculo === 'Suma Automática' && (
                  <div className="mt-4 p-4 md:p-5 bg-blue-50/80 rounded-2xl border border-blue-100 shadow-sm">
                    <Lbl className="text-blue-800 text-[10px] md:text-xs">Definir Rangos de Puntaje (Opcional)</Lbl>
                    <p className="text-[9px] md:text-[10px] text-blue-600 mb-4 font-bold">El sistema asignará el resultado según estos cortes.</p>
                    
                    <div className="flex flex-col gap-3 mb-5">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Lbl className="mt-0 !text-[9px] md:!text-[10px]">Pt. Mínimo</Lbl><Inp type="number" placeholder="0" value={newRango.min} onChange={e=>setNewRango({...newRango, min: e.target.value})} /></div>
                        <div><Lbl className="mt-0 !text-[9px] md:!text-[10px]">Pt. Máximo</Lbl><Inp type="number" placeholder="5" value={newRango.max} onChange={e=>setNewRango({...newRango, max: e.target.value})} /></div>
                      </div>
                      <div className="flex gap-2 md:gap-3 items-end">
                        <div className="flex-1"><Lbl className="mt-0 !text-[9px] md:!text-[10px]">Resultado</Lbl><Inp placeholder="Ej: Riesgo Bajo" value={newRango.resultado} onChange={e=>setNewRango({...newRango, resultado: e.target.value})} /></div>
                        <button onClick={()=>{
                           if(newRango.min !== '' && newRango.max !== '' && newRango.resultado) {
                              setTemplateForm(p=>({...p, rangos: [...safeArr(p.rangos), { id: Date.now(), min: Number(newRango.min), max: Number(newRango.max), resultado: newRango.resultado }]}));
                              setNewRango({min:'', max:'', resultado:''});
                           }
                        }} className="bg-blue-600 text-white px-4 md:px-5 py-3 rounded-xl font-black h-[46px] hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center"><Plus size={16} className="md:w-5 md:h-5"/></button>
                      </div>
                    </div>
                    
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {safeArr(templateForm.rangos).filter(Boolean).sort((a,b)=>a.min-b.min).map(r => (
                         <div key={r.id} className="flex justify-between items-center bg-white p-2.5 md:p-3 rounded-xl border text-[10px] md:text-xs font-bold shadow-sm">
                            <span>De {r.min} a {r.max} pts ➡️ <span className="text-blue-600 uppercase ml-1">{String(r.resultado)}</span></span>
                            <button onClick={()=>setTemplateForm(p=>({...p, rangos: p.rangos.filter(x=>x.id!==r.id)}))} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
                         </div>
                      ))}
                      {safeArr(templateForm.rangos).filter(Boolean).length === 0 && <p className="text-[9px] md:text-[10px] text-slate-400 italic text-center py-2">Usará Óptimo (≥75%) por defecto.</p>}
                    </div>
                  </div>
                )}

                {templateForm.metodoCalculo === 'Juicio Clínico' && (
                  <div className="mt-3"><Lbl className="text-amber-600">Instrucciones Diagnóstico</Lbl><Txt value={templateForm.instruccionesDiagnostico || ''} onChange={e=>setTemplateForm({...templateForm, instruccionesDiagnostico: e.target.value})} className="bg-amber-50 border-amber-200 text-xs min-h-[100px]"/></div>
                )}
              </div>
            </div>
            <div className="lg:col-span-3 flex flex-col gap-6">
              <div className="bg-white p-4 md:p-5 border border-slate-200 rounded-2xl">
                <Lbl className="bg-slate-50 p-2 rounded-lg inline-block">1. Encabezados</Lbl>
                {safeArr(templateForm.encabezados).filter(Boolean).map((h, i) => (
                  <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-center mb-3 sm:mb-2">
                    <Inp value={h.label || ''} onChange={e=>{const n=[...safeArr(templateForm.encabezados)]; n[i].label=e.target.value; setTemplateForm({...templateForm, encabezados: n});}} placeholder="Nombre Campo" className="w-full sm:flex-1"/>
                    <Sel value={h.type || 'text'} onChange={e=>{const n=[...safeArr(templateForm.encabezados)]; n[i].type=e.target.value; setTemplateForm({...templateForm, encabezados: n});}} className="flex-1 sm:w-32"><option value="text">Texto</option><option value="date">Fecha</option></Sel>
                    <button onClick={()=>{const n=[...safeArr(templateForm.encabezados)]; n.splice(i,1); setTemplateForm({...templateForm, encabezados: n});}} className="p-3 text-red-500 hover:bg-red-50 rounded-xl shrink-0"><Trash2 size={16}/></button>
                  </div>
                ))}
                <button onClick={()=>setTemplateForm({...templateForm, encabezados: [...safeArr(templateForm.encabezados), {id: `enc_${Date.now()}`, label: '', type: 'text'}]})} className="text-[9px] text-slate-500 font-black uppercase mt-2 hover:bg-slate-50 p-2 rounded-lg"><Plus size={12} className="inline"/> Campo Extra</button>
              </div>
              <div className="bg-white p-4 md:p-5 border border-slate-200 rounded-2xl flex-1 flex flex-col">
                <Lbl className="bg-slate-50 p-2 rounded-lg inline-block">2. Criterios</Lbl>
                <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3 flex-1">
                  {safeArr(templateForm.criterios).filter(Boolean).map((c, i) => (
                    <div key={i} className="p-3 md:p-4 border-2 border-slate-100 rounded-xl bg-slate-50 relative group">
                      <button onClick={()=>{const newC=[...safeArr(templateForm.criterios)]; newC.splice(i,1); setTemplateForm({...templateForm, criterios: newC});}} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                      <Txt rows="2" value={c.pregunta || ''} onChange={e=>{const newC=[...safeArr(templateForm.criterios)]; newC[i].pregunta=e.target.value; setTemplateForm({...templateForm, criterios: newC});}} className="mb-2 text-[11px] md:text-xs pr-8" placeholder="Criterio a evaluar..." />
                      <Inp value={c.opciones || ''} onChange={e=>{const newC=[...safeArr(templateForm.criterios)]; newC[i].opciones=e.target.value; setTemplateForm({...templateForm, criterios: newC});}} placeholder="Ej: SÍ=1, NO=0" className="text-[10px] md:text-xs"/>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setTemplateForm({...templateForm, criterios: [...safeArr(templateForm.criterios), {id: `crit_${Date.now()}`, pregunta: '', opciones: 'SÍ=1, NO=0'}]})} className="text-[10px] text-indigo-600 font-black uppercase mt-4 hover:bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-center w-full sm:w-auto self-start"><Plus size={14} className="inline mr-1"/> Fila Manual</button>
              </div>
            </div>
        </div>
        <ModalFtr onCancel={()=>setIsTemplateModalOpen(false)} onSave={handleSaveTemplate} />
      </ModalWrap>

      <ModalWrap isOpen={isAuditModalOpen}>
         <ModalHdr t="Evaluar" onClose={()=>setIsAuditModalOpen(false)} icon={ClipboardCheck} />
         <div className="p-4 md:p-8 overflow-y-auto space-y-6 flex-1 bg-slate-50">
            <Sel value={auditForm.templateId || ''} onChange={e=>setAuditForm({...auditForm, templateId: e.target.value, answers: {}, headerAnswers: {}, estadoFinal: ''})}>
              <option value="">Seleccione formulario...</option>
              {safeArr(auditTemplates).filter(Boolean).map(t => <option key={t.id} value={t.id}>{String(t.nombre)}</option>)}
            </Sel>
            {auditForm.templateId && (() => {
              const tpl = safeArr(auditTemplates).filter(Boolean).find(t => t.id === auditForm.templateId);
              if (!tpl) return null;

              let currentScore = 0; let maxScore = 0; let calcStatus = ''; let calcPct = 0;
              if (tpl.metodoCalculo === 'Suma Automática') {
                 safeArr(tpl.criterios).filter(Boolean).forEach((c, idx) => {
                    const ops = parseOpciones(c.opciones || 'SÍ=1, NO=0');
                    maxScore += Math.max(...ops.map(o => o.value));
                    const answer = auditForm.answers[c.id || idx];
                    if (answer && typeof answer === 'object') currentScore += answer.value; 
                    else if (answer === 'si') currentScore += 1;
                 });
                 calcPct = maxScore > 0 ? Math.round((currentScore / maxScore) * 100) : 0;
                 
                 if (safeArr(tpl.rangos).filter(Boolean).length > 0) {
                    const match = safeArr(tpl.rangos).filter(Boolean).find(r => currentScore >= Number(r.min) && currentScore <= Number(r.max));
                    if (match) calcStatus = match.resultado;
                 } else {
                    calcStatus = calcPct >= 75 ? 'Óptimo' : 'Riesgo';
                 }
              }

              return (
                <div className="space-y-4 md:space-y-6">
                   {safeArr(tpl.encabezados).filter(Boolean).length > 0 && (
                     <div className="bg-white p-4 md:p-6 rounded-2xl border shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {safeArr(tpl.encabezados).filter(Boolean).map(h => (
                         <div key={h.id}><Lbl>{String(h.label)}</Lbl><Inp type={h.type} value={auditForm.headerAnswers[h.id] || ''} onChange={e=>setAuditForm({...auditForm, headerAnswers: {...auditForm.headerAnswers, [h.id]: e.target.value}})} /></div>
                       ))}
                       <div className="col-span-1 sm:col-span-2"><Lbl>Dispositivo Evaluado</Lbl><Sel value={auditForm.centro || ''} onChange={e=>setAuditForm({...auditForm, centro: e.target.value})}><option value="">Seleccione...</option>{safeArr(centros).map(c=><option key={String(c)} value={String(c)}>{String(c)}</option>)}</Sel></div>
                     </div>
                   )}
                   <div className="bg-white p-4 md:p-6 rounded-2xl border shadow-sm space-y-3">
                     {safeArr(tpl.criterios).filter(Boolean).map((c, idx) => {
                       const cId = c.id || idx;
                       const ops = parseOpciones(c.opciones || 'SÍ=1, NO=0');
                       return (
                         <div key={cId} className="p-3 md:p-4 bg-slate-50 rounded-xl border flex flex-col gap-2">
                           <span className="font-bold text-[11px] md:text-sm">{idx + 1}. {String(c.pregunta)}</span>
                           <div className="flex flex-wrap gap-2 mt-1">
                             {ops.map((opt, i) => (
                               <label key={i} className={`px-3 md:px-4 py-2 rounded-xl cursor-pointer font-black text-[9px] md:text-[10px] uppercase border-2 flex-1 sm:flex-none text-center ${auditForm.answers[cId]?.label === opt.label ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-white text-slate-500 border-transparent hover:bg-slate-100 shadow-sm'}`}>
                                 <input type="radio" checked={auditForm.answers[cId]?.label === opt.label} onChange={() => setAuditForm({...auditForm, answers: {...auditForm.answers, [cId]: opt}})} className="hidden" />{String(opt.label)}
                               </label>
                             ))}
                           </div>
                         </div>
                       );
                     })}
                   </div>

                   <div className={`p-4 md:p-6 rounded-2xl border-2 mt-4 ${tpl.metodoCalculo === 'Juicio Clínico' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                      <h3 className="font-black text-sm md:text-lg uppercase mb-2 flex items-center gap-2">
                        {tpl.metodoCalculo === 'Juicio Clínico' ? <><Activity size={18} className="md:w-5 md:h-5"/> Juicio Clínico del Profesional</> : <><CheckCircle size={18} className="md:w-5 md:h-5"/> Resultado: {currentScore}/{maxScore} pts ({calcPct}%)</>}
                      </h3>
                      
                      {tpl.metodoCalculo === 'Juicio Clínico' && (
                         <div className="mb-4 bg-white p-3 md:p-4 rounded-xl border border-amber-100 shadow-sm">
                            <p className="text-[9px] md:text-[10px] font-black text-amber-800 uppercase mb-1">Instrucciones de Clasificación</p>
                            <p className="text-[11px] md:text-xs text-slate-700 whitespace-pre-wrap">{tpl.instruccionesDiagnostico || 'Sin instrucciones.'}</p>
                         </div>
                      )}

                      <div className="bg-white p-3 md:p-4 rounded-xl border shadow-sm mt-3">
                         <Lbl>Estado o Resultado Final (Editable)</Lbl>
                         <p className="text-[8px] md:text-[9px] text-slate-500 mb-2">Puede modificarlo manualmente según su criterio clínico.</p>
                         <Inp 
                            type="text" 
                            className="text-xs md:text-sm py-2.5 md:py-3 border-slate-300 font-black text-slate-800 uppercase tracking-widest focus:bg-blue-50"
                            value={auditForm.estadoFinal !== undefined && auditForm.estadoFinal !== '' ? auditForm.estadoFinal : (tpl.metodoCalculo === 'Suma Automática' ? calcStatus : '')} 
                            onChange={e => setAuditForm({...auditForm, estadoFinal: e.target.value})}
                            placeholder="Ej: Riesgo Bajo..."
                         />
                      </div>
                   </div>
                   <div className="bg-white p-4 md:p-4 rounded-xl border shadow-sm">
                     <Lbl>Observaciones Generales</Lbl>
                     <Txt rows="3" value={auditForm.observaciones || ''} onChange={e=>setAuditForm({...auditForm, observaciones: e.target.value})} placeholder="Detalles, justificación de puntaje..." className="bg-slate-50 text-[11px] md:text-xs" />
                   </div>
                </div>
              );
            })()}
         </div>
         <ModalFtr onCancel={()=>setIsAuditModalOpen(false)} onSave={handleSaveAudit} />
      </ModalWrap>

      <ModalWrap isOpen={isDirModalOpen} mw="max-w-sm">
        <ModalHdr t={editingDirId ? 'Editar' : 'Nuevo'} onClose={()=>setIsDirModalOpen(false)} />
        <div className="p-6 space-y-4">
          <div><Lbl>Nombre</Lbl><Inp value={dirForm.nombre || ''} onChange={e=>setDirForm({...dirForm, nombre: e.target.value})} /></div>
          <div><Lbl>Institución</Lbl><Inp value={dirForm.institucion || ''} onChange={e=>setDirForm({...dirForm, institucion: e.target.value})} /></div>
          <div><Lbl>Cargo</Lbl><Inp value={dirForm.cargo || ''} onChange={e=>setDirForm({...dirForm, cargo: e.target.value})} /></div>
          <div><Lbl>Teléfono</Lbl><Inp value={dirForm.telefono || ''} onChange={e=>setDirForm({...dirForm, telefono: e.target.value})} /></div>
          <div><Lbl>Correo</Lbl><Inp type="email" value={dirForm.correo || ''} onChange={e=>setDirForm({...dirForm, correo: e.target.value})} /></div>
        </div>
        <ModalFtr onCancel={()=>setIsDirModalOpen(false)} onSave={handleSaveDir} />
      </ModalWrap>

      {/* MEJORA: MODAL USUARIO CON CARGO */}
      <ModalWrap isOpen={isUserModalOpen} mw="max-w-lg">
        <ModalHdr t={editingUserId ? "Editar Credencial" : "Nueva Credencial"} onClose={()=>setIsUserModalOpen(false)} icon={UserPlus}/>
        <div className="p-4 md:p-6 space-y-4 bg-slate-50">
          <div className="bg-white p-5 md:p-6 rounded-2xl border shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Inp value={userForm.rut || ''} onChange={e=>setUserForm({...userForm, rut: e.target.value})} placeholder="RUT (11.111.111-1)"/><Inp value={userForm.password || ''} onChange={e=>setUserForm({...userForm, password: e.target.value})} placeholder="Contraseña"/></div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4"><Inp value={userForm.nombre || ''} onChange={e=>setUserForm({...userForm, nombre: e.target.value})} placeholder="Nombre Completo" className="sm:col-span-3"/><Inp value={userForm.iniciales || ''} onChange={e=>setUserForm({...userForm, iniciales: e.target.value.toUpperCase()})} placeholder="INI (Ej: JC)" maxLength={3}/></div>
            <div><Lbl>Cargo Institucional</Lbl><Inp value={userForm.cargo || ''} onChange={e=>setUserForm({...userForm, cargo: e.target.value})} placeholder="Ej: Enfermero Supervisor UHCIP" /></div>
            <div><Lbl>Rol en Plataforma</Lbl><Sel value={userForm.rol || 'Usuario'} onChange={e=>setUserForm({...userForm, rol: e.target.value})}><option value="Usuario">👤 Usuario Estandar</option><option value="Admin">⭐ Administrador de Red</option></Sel></div>
            
            <div className="border-t border-slate-100 pt-4 mt-2">
               <Lbl>Dispositivos a los que pertenece (Múltiple)</Lbl>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-40 overflow-y-auto p-4 border border-slate-200 rounded-xl bg-slate-50 mt-1">
                 {safeArr(centros).filter(Boolean).map(c => {
                    const isChecked = getUserCentros(userForm).includes(c);
                    return (
                      <label key={String(c)} className={`flex items-center gap-3 text-xs font-bold p-3 rounded-lg cursor-pointer transition-colors ${isChecked?'bg-blue-100 text-blue-800 border border-blue-200':'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                        <input type="checkbox" checked={isChecked} onChange={(e) => {
                            const curr = getUserCentros(userForm);
                            if(e.target.checked) setUserForm({...userForm, centrosAsignados: [...curr, c]});
                            else setUserForm({...userForm, centrosAsignados: curr.filter(x=>x!==c)});
                        }} className="accent-blue-600 w-5 h-5 cursor-pointer shrink-0"/>
                        <span className="leading-tight">{String(c)}</span>
                      </label>
                    );
                 })}
               </div>
            </div>
          </div>
        </div>
        <ModalFtr onCancel={()=>setIsUserModalOpen(false)} onSave={handleSaveUser} />
      </ModalWrap>
      
      <ModalWrap isOpen={isProfileModalOpen} mw="max-w-sm">
        <ModalHdr t="Seguridad" onClose={()=>setIsProfileModalOpen(false)} icon={Key}/>
        <div className="p-6 space-y-4">
          <div><Lbl>Clave Actual</Lbl><Inp type="password" value={passwordForm.current || ''} onChange={e=>setPasswordForm({...passwordForm, current: e.target.value})}/></div>
          <div><Lbl>Nueva Clave</Lbl><Inp type="password" value={passwordForm.new || ''} onChange={e=>setPasswordForm({...passwordForm, new: e.target.value})}/></div>
          <div><Lbl>Repetir Clave</Lbl><Inp type="password" value={passwordForm.confirm || ''} onChange={e=>setPasswordForm({...passwordForm, confirm: e.target.value})}/></div>
        </div>
        <ModalFtr onCancel={()=>setIsProfileModalOpen(false)} onSave={handleUpdatePassword} saveTxt="Actualizar Clave" />
      </ModalWrap>

      <style dangerouslySetInnerHTML={{__html: `
        .fade-in { animation: fadeIn 0.4s ease-out; }
        .animate-in { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @media print {
          body, html { background-color: white !important; font-size: 10px !important; }
          .no-print { display: none !important; }
          .break-inside-avoid { break-inside: avoid !important; }
        }
        /* Ocultar barra scroll esteticamente */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}

const StatusBadge = ({ status }) => {
  const s = safeStr(status);
  if(s === 'Alerta') return <span className="px-2 md:px-3 py-1 md:py-1.5 bg-red-100 text-red-700 rounded-lg text-[8px] md:text-[9px] font-black uppercase flex items-center gap-1 md:gap-1.5 animate-pulse whitespace-nowrap"><AlertTriangle size={10} className="md:w-3 md:h-3"/> Alerta</span>;
  if(s === 'Pendiente') return <span className="px-2 md:px-3 py-1 md:py-1.5 bg-amber-100 text-amber-700 rounded-lg text-[8px] md:text-[9px] font-black uppercase flex items-center gap-1 md:gap-1.5 whitespace-nowrap"><Clock size={10} className="md:w-3 md:h-3"/> Tránsito</span>;
  return <span className="px-2 md:px-3 py-1 md:py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-[8px] md:text-[9px] font-black uppercase flex items-center gap-1 md:gap-1.5 whitespace-nowrap"><CheckCircle size={10} className="md:w-3 md:h-3"/> Cerrado</span>;
};