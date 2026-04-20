import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  LayoutDashboard, Users, FileText, AlertTriangle, CheckCircle, Clock, Plus, Activity, LogOut,
  Bell, Copy, Loader2, Edit2, Trash2, ListTodo, MessageSquare, CheckSquare, Square, Calendar,
  UploadCloud, Paperclip, File as FileIcon, Lock, User, ClipboardCheck, BookOpen, Download,
  Wand2, Settings, UserPlus, Shield, Key, Timer, TrendingUp, BarChart3, Target, Printer, ExternalLink,
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

const diffInDays = (d1, d2) => {
  if (!d1 || !d2) return null;
  return Math.ceil(Math.abs(new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24));
};

const getTaskStatus = (fecha) => {
  if (!fecha || typeof fecha !== 'string' || !fecha.includes('-')) return { status: 'none', bgClass: 'bg-slate-100 text-slate-700', showWarning: false };
  const [y, m, d] = fecha.split('-');
  const diffDays = Math.ceil((new Date(y, m - 1, d).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { status: 'overdue', bgClass: 'bg-red-100 text-red-800', showWarning: true };
  if (diffDays <= 10) return { status: 'upcoming', bgClass: 'bg-amber-100 text-amber-800', showWarning: true };
  return { status: 'safe', bgClass: 'bg-emerald-100 text-emerald-800', showWarning: false };
};

const getSemaforoDoc = (fechaResolucion, oficiales) => {
  if (!safeArr(oficiales).length) return { color: 'red', label: '🔴 Inexistente / Vacío Normativo' };
  const days = diffInDays(fechaResolucion, new Date().toISOString().split('T')[0]);
  if (days === null || days > (3 * 365)) return { color: 'amber', label: '🟡 Desactualizado (> 3 años)' };
  return { color: 'emerald', label: '🟢 Vigente' };
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
    let mime = inlineData.mimeType;
    // Forzamos a PDF si Firebase lo guardó como binario genérico o vacío
    if (!mime || mime === 'application/octet-stream' || mime === '') {
        mime = 'application/pdf'; 
    }
    parts.push({ inlineData: { mimeType: mime, data: inlineData.data } });
  }

  const payload = { contents: [{ parts }] };
  if (sys) payload.systemInstruction = { parts: [{ text: sys }] };
  
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) return data.candidates[0].content.parts[0].text;
      throw new Error("Respuesta vacía");
    } catch (e) {
      if (i === 4) throw e;
      await new Promise(r => setTimeout(r, [1000, 2000, 4000, 8000, 16000][i]));
    }
  }
};

// --- COMPONENTES UI REUTILIZABLES ---
const clsInp = "w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 bg-white shadow-sm transition-colors";
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
const ModalFtr = ({ onCancel, onSave, saveTxt, disableSave }) => (
  <div className="bg-slate-50 p-5 border-t border-slate-200 flex justify-end gap-3 shrink-0">
    <button onClick={onCancel} className={clsBtnS}>Cancelar</button>
    <button onClick={onSave} disabled={disableSave} className={clsBtnP}>{saveTxt || 'Guardar'}</button>
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
  
  const [centros, setCentros] = useState([]);
  const [cases, setCases] = useState([]);
  const [docs, setDocs] = useState([]);
  const [audits, setAudits] = useState([]);
  const [auditTemplates, setAuditTemplates] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [appConfig, setAppConfig] = useState({ targetDays: 7, apiKey: '', plazos: {} });
  const [apiConfigKey, setApiConfigKey] = useState('');
  const [newCentroName, setNewCentroName] = useState('');
  const [plazoCentroInput, setPlazoCentroInput] = useState('');
  const [plazoDaysInput, setPlazoDaysInput] = useState('');

  const defaultCaseState = { rut: '', nombre: '', edad: '', origen: '', destino: '', prioridad: 'Media', estado: 'Pendiente', fechaEgreso: new Date().toISOString().split('T')[0], fechaRecepcionRed: '', fechaIngresoEfectivo: '', tutor: { nombre: '', relacion: '', telefono: '' }, referentes: [], bitacora: [], archivos: [], epicrisis: '' };
  const [editingCaseId, setEditingCaseId] = useState(null);
  const [caseForm, setCaseForm] = useState(defaultCaseState);
  const [activeModalTab, setActiveModalTab] = useState('datos');
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  // MEJORA: Se agrega el estado por defecto para la barrera
  const [newBitacoraEntry, setNewBitacoraEntry] = useState({ tipo: 'Nota Adm.', descripcion: '', responsable: '', fechaCumplimiento: '', barrera: 'Ninguna' });
  const [newCaseLink, setNewCaseLink] = useState({ nombre: '', url: '' }); 

  const defaultDocState = { nombre: '', ambito: 'Red Integral', fase: 'Levantamiento', avance: 0, prioridad: 'Media', fechaResolucion: '', notas: '', bitacora: [], archivos: [], archivosOficiales: [] };
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [docForm, setDocForm] = useState(defaultDocState);
  const [activeDocModalTab, setActiveDocModalTab] = useState('datos');
  const [newDocBitacoraEntry, setNewDocBitacoraEntry] = useState({ tipo: 'Tarea', descripcion: '', responsable: '', fechaCumplimiento: '' });
  const [newDocLink, setNewDocLink] = useState({ nombre: '', url: '' }); 

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [auditForm, setAuditForm] = useState({ centro: '', templateId: '', headerAnswers: {}, answers: {}, tipo: 'Auditoría', observaciones: '', fecha: new Date().toISOString().split('T')[0], estadoManual: '' });
  const [templateForm, setTemplateForm] = useState({ nombre: '', metodoCalculo: 'Suma Automática', instruccionesDiagnostico: '', encabezados: [{ id: 'enc_1', label: 'Centro Evaluado', type: 'text' }, { id: 'enc_2', label: 'Fecha', type: 'date' }], criterios: [{ id: 'crit_1', pregunta: '', opciones: 'SÍ=1, NO=0' }], rangos: [], tipo: 'Ambos' });
  
  const [printingAudit, setPrintingAudit] = useState(null);
  const [rawTextForAI, setRawTextForAI] = useState('');
  
  // MEJORA: Estados para la IA de Documentos
  const [aiFileContext, setAiFileContext] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);

  const [centroFilterAuditorias, setCentroFilterAuditorias] = useState('Todos');
  const [centroFilterConsultorias, setCentroFilterConsultorias] = useState('Todos');
  const [caseFilterCentro, setCaseFilterCentro] = useState('Todos');
  const [caseSearch, setCaseSearch] = useState('');
  
  const [isDigitizing, setIsDigitizing] = useState(false);
  const [isUploadingCaseFile, setIsUploadingCaseFile] = useState(false);
  const [isUploadingDocFile, setIsUploadingDocFile] = useState(false);
  
  const [isDirModalOpen, setIsDirModalOpen] = useState(false);
  const [editingDirId, setEditingDirId] = useState(null);
  const [dirForm, setDirForm] = useState({ nombre: '', cargo: '', institucion: '', telefono: '', correo: '' });
  const [dirSearch, setDirSearch] = useState('');

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState({ rut: '', nombre: '', iniciales: '', cargo: '', password: '', rol: 'Usuario', centrosAsignados: [] });

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isGeneratingCaseSummary, setIsGeneratingCaseSummary] = useState(false);
  const [caseSummary, setCaseSummary] = useState('');

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
        setDbStatus('⚠️ Error: Falta habilitar "Anónimo" en Authentication de Firebase.');
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
    const errH = (err) => { console.error(err); setDbStatus('⚠️ Error de Permisos. Revisa las Reglas de Firestore.'); };
    
    const unsubCases = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'cases'), snap => setCases(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubDocs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'docs'), snap => setDocs(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubAudits = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'audits'), snap => setAudits(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubTemplates = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'auditTemplates'), snap => setAuditTemplates(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubDir = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'directory'), snap => setDirectory(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), snap => setUsers(safeArr(snap.docs.map(d => d.data()))), errH);
    const unsubCentros = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'centros'), snap => { if (snap.exists() && safeArr(snap.data().list).length > 0) setCentros(snap.data().list); }, errH);
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), snap => { 
      if (snap.exists()) { const data = snap.data(); setAppConfig({ targetDays: 7, plazos: {}, ...data }); if (data?.apiKey) setApiConfigKey(data.apiKey); } 
    }, errH);

    return () => { unsubCases(); unsubDocs(); unsubAudits(); unsubTemplates(); unsubDir(); unsubUsers(); unsubCentros(); unsubConfig(); };
  }, [firebaseUser]);

  const saveToCloud = async (coll, id, data) => { if (firebaseUser) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id.toString()), data); };
  const deleteFromCloud = async (coll, id) => { if (firebaseUser) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id.toString())); };

  const getTargetDaysForCase = (destino) => {
    if (!destino) return Number(appConfig?.targetDays || 7);
    if (appConfig?.plazos && appConfig.plazos[destino] !== undefined) return Number(appConfig.plazos[destino]);
    return Number(appConfig?.targetDays || 7);
  };

  const visibleCases = useMemo(() => {
    let arr = safeArr(cases);
    if (currentUser?.rol !== 'Admin') {
      const assigned = safeArr(currentUser?.centrosAsignados);
      arr = arr.filter(c => assigned.includes(c.origen) || assigned.includes(c.destino));
    }
    return arr;
  }, [cases, currentUser]);

  const filteredCases = useMemo(() => {
    return visibleCases.filter(c => {
      const mC = caseFilterCentro === 'Todos' || c.origen === caseFilterCentro || c.destino === caseFilterCentro;
      const mS = c.nombre.toLowerCase().includes(caseSearch.toLowerCase()) || c.paciente.includes(caseSearch);
      return mC && mS;
    });
  }, [visibleCases, caseFilterCentro, caseSearch]);

  const visibleAudits = useMemo(() => {
    if (currentUser?.rol === 'Admin') return safeArr(audits);
    const assigned = safeArr(currentUser?.centrosAsignados);
    return safeArr(audits).filter(a => assigned.includes(a.centro));
  }, [audits, currentUser]);

  const alertCases = visibleCases.filter(c => c.estado === 'Alerta');
  const allPendingTasks = useMemo(() => {
    return [
      ...safeArr(visibleCases).flatMap(c => safeArr(c.bitacora).filter(b => b.tipo === 'Tarea' && !b.completada).map(b => ({ ...b, parentId: c.id, parentName: c.nombre || c.paciente, source: 'Caso' }))),
      ...safeArr(docs).flatMap(d => safeArr(d.bitacora).filter(b => b.tipo === 'Tarea' && !b.completada).map(b => ({ ...b, parentId: d.id, parentName: d.nombre, source: 'Protocolo' })))
    ].sort((a, b) => safeStr(a.fechaCumplimiento || '9999-99-99').localeCompare(safeStr(b.fechaCumplimiento || '9999-99-99')));
  }, [visibleCases, docs]);

  const tareasCriticas = allPendingTasks.filter(t => getTaskStatus(t.fechaCumplimiento).status === 'upcoming' || getTaskStatus(t.fechaCumplimiento).status === 'overdue').length;

  const notifications = useMemo(() => [
      ...alertCases.map(c => ({ id: `alert-${c.id}`, type: 'alerta', title: 'Pérdida de Enlace', desc: `Paciente ${c.nombre} no se ha presentado.` })),
      ...allPendingTasks.filter(t => getTaskStatus(t.fechaCumplimiento).status !== 'safe').map(t => ({ id: `task-${t.id}`, type: getTaskStatus(t.fechaCumplimiento).status, title: getTaskStatus(t.fechaCumplimiento).status === 'overdue' ? 'Tarea Vencida' : 'Pronta a Vencer', desc: `(${t.parentName}) ${t.descripcion}` }))
  ], [alertCases, allPendingTasks]);

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

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.rut === 'admin' && loginData.password === 'reloncavi') {
       setCurrentUser({ rut: 'admin', nombre: 'Admin Emergencia', iniciales: 'ADM', cargo: 'Soporte TI', rol: 'Admin', centrosAsignados: [] });
       setLoginError('');
       return;
    }
    const user = safeArr(users).find(u => u.rut === loginData.rut && u.password === loginData.password);
    if (user) { setCurrentUser(user); setLoginError(''); } else { setLoginError('RUT o Contraseña incorrectos.'); }
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

  const handleExportCSV = () => {
    const BOM = '\uFEFF';
    // MEJORA: Columna de Barrera Detectada añadida para métricas exactas
    const headers = ['ID_Seguimiento', 'RUT', 'Paciente', 'Edad', 'Origen', 'Destino', 'Estado', 'Fecha_Egreso', 'Fecha_Recepcion', 'Fecha_Ingreso_Efectivo', 'Plazo_Meta_Dias', 'Brecha_Dias', 'Ultimo_Hito_Fecha', 'Ultimo_Hito_Tipo', 'Responsable_Hito', 'Barrera_Detectada'];
    const rows = filteredCases.map(c => {
       const target = getTargetDaysForCase(c.destino);
       const brecha = diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo);
       const ultBit = safeArr(c.bitacora)[0] || {};
       return [c.id, c.paciente, c.nombre, c.edad||'', c.origen, c.destino, c.estado, c.fechaEgreso||'', c.fechaRecepcionRed||'', c.fechaIngresoEfectivo||'', target, brecha||'', ultBit.fecha||'', ultBit.tipo||'', ultBit.responsable||'', ultBit.barrera||'Ninguna'];
    });
    const csvContent = BOM + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `Reporte_Red_${new Date().toISOString().split('T')[0]}.csv`; link.click();
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); alert("Copiado al portapapeles"); };

  const handleWipeDirectory = async () => {
    if(window.confirm('⚠️ ¿Estás seguro de eliminar TODO el directorio para empezar de cero?')) {
       safeArr(directory).forEach(async (d) => { if (d && d.id) await deleteFromCloud('directory', d.id); });
       alert('Directorio limpiado.');
    }
  };

  // --- MEJORA: FUNCIÓN PARA CHAT IA CON DOCUMENTOS ---
  const handleAskAiAboutFile = async () => {
    if (!appConfig.apiKey) return alert("Falta Clave API de IA en la Configuración.");
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
            appConfig.apiKey, 
            `${aiPrompt}\n\n[Documento: ${aiFileContext.nombre}]`, 
            "Responde basándote estrictamente en el documento proporcionado.", 
            { mimeType: blob.type || 'application/pdf', data: reader.result.split(',')[1] }
          );
          setAiResponse(result);
        } catch (err) { setAiResponse(`⚠️ Error IA: ${err.message}`); }
        setIsAnalyzingFile(false);
      };
    } catch (e) {
      setAiResponse("⚠️ Error de acceso al archivo (CORS). Firebase está bloqueando la descarga para la IA. Por favor, aplica las reglas CORS mediante Google Cloud Shell.");
      setIsAnalyzingFile(false);
    }
  };

  const extractFormFromAI = async (prompt, inlineData = null) => {
    if (!appConfig.apiKey) return alert("Falta configurar la Clave API de IA en Configuración.");
    setIsDigitizing(true);
    const fullPrompt = `${prompt}\n\nERES UN ANALISTA CLÍNICO. Analiza el documento y devuelve ÚNICAMENTE un objeto JSON válido con este formato exacto:\n{ \n  "nombre": "TÍTULO COMPLETO DEL DOCUMENTO", \n  "metodoCalculo": "Elige 'Suma Automática' si se calcula sumando puntos, o 'Juicio Clínico' si requiere interpretación del profesional o es un árbol de decisión", \n  "instruccionesDiagnostico": "Si elegiste Juicio Clínico, redacta cómo el evaluador debe interpretar las respuestas para dar el diagnóstico", \n  "encabezados": [ {"id": "enc_1", "label": "Nombre del campo (Ej: Servicio, Fecha)", "type": "text"} ], \n  "criterios": [ {"id": "crit_1", "pregunta": "Criterio", "opciones": "Estructura opciones con puntaje numérico. Ej: SÍ=1, NO=0. O escala: Siempre=3, A veces=2, Nunca=1"} ] \n}`;
    try {
      const result = await generateTextWithRetry(appConfig.apiKey, fullPrompt, "", inlineData);
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Formato inválido.");
      const parsedData = JSON.parse(jsonMatch[0]);
      setTemplateForm({
        ...templateForm,
        nombre: parsedData.nombre || 'Pauta Extraída',
        metodoCalculo: parsedData.metodoCalculo === 'Juicio Clínico' ? 'Juicio Clínico' : 'Suma Automática',
        instruccionesDiagnostico: parsedData.instruccionesDiagnostico || '',
        encabezados: safeArr(parsedData.encabezados),
        criterios: safeArr(parsedData.criterios)
      });
      alert(`¡Pauta digitalizada!\nTítulo: ${parsedData.nombre}\nRevisa el Diseñador para ajustar detalles.`);
    } catch (err) { alert("Error IA. Revisa tu Llave API o copia fragmentos de texto."); } 
    finally { setIsDigitizing(false); setRawTextForAI(''); }
  };

  const handleProcessRawTextForAI = () => { if (!rawTextForAI.trim()) return; extractFormFromAI(`Analiza este texto correspondiente a un instrumento de evaluación: \n\n${rawTextForAI}`); };
  const handlePdfUploadForAI = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => extractFormFromAI(`Analiza el documento PDF adjunto.`, { mimeType: file.type || 'application/pdf', data: reader.result.split(',')[1] });
    reader.onerror = () => alert("Error al leer el archivo.");
    reader.readAsDataURL(file);
  };

  const handleGenerateReport = async (type) => { 
    if (!appConfig.apiKey) return alert("Falta Clave API de IA.");
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
    try { setReportContent(await generateTextWithRetry(appConfig.apiKey, prompt)); } catch (e) { setReportContent("Error de conexión IA."); } finally { setIsGeneratingReport(false); }
  };

  const handleGenerateCaseSummary = async () => {
    if (!appConfig.apiKey) return alert("Falta Clave API.");
    setIsGeneratingCaseSummary(true); setCaseSummary('');
    const epicrisisText = caseForm.epicrisis ? `\nEpicrisis: ${caseForm.epicrisis}` : '';
    const prompt = `Actúa como clínico. Genera resumen profesional: Nombre: ${caseForm.nombre}, Origen: ${caseForm.origen}, Destino: ${caseForm.destino}.${epicrisisText} Eventos bitácora: ${safeArr(caseForm.bitacora).map(b => `[${b.fecha}] ${b.tipo}: ${b.descripcion}`).join(' | ')}. Solo resumen directo.`;
    try { setCaseSummary(await generateTextWithRetry(appConfig.apiKey, prompt)); } catch (e) { setCaseSummary("Error IA."); } finally { setIsGeneratingCaseSummary(false); }
  };

  // --- GUARDADOS EN NUBE Y MODALES ---
  const handleSaveCase = async () => { 
    if (!caseForm.rut || !caseForm.nombre) return alert("RUT y Nombre obligatorios.");
    const finalId = editingCaseId || `CASO-${String(cases.length + 1).padStart(3, '0')}`;
    await saveToCloud('cases', finalId, { ...caseForm, id: finalId, paciente: caseForm.rut });
    setIsCaseModalOpen(false); setEditingCaseId(null); setCaseForm(defaultCaseState); setCaseSummary(''); setNewCaseLink({nombre:'', url:''});
  };

  const handleAddBitacora = () => {
    if (!newBitacoraEntry.descripcion) return;
    setCaseForm({ ...caseForm, bitacora: [{ id: Date.now(), ...newBitacoraEntry, fecha: new Date().toISOString().split('T')[0], completada: false }, ...safeArr(caseForm.bitacora)] });
    // MEJORA: Se restablece la barrera a 'Ninguna' por defecto.
    setNewBitacoraEntry({ tipo: 'Nota Adm.', descripcion: '', responsable: '', fechaCumplimiento: '', barrera: 'Ninguna' });
  };
  
  const toggleTaskCompletion = async (caseId, entryId) => {
     const caso = safeArr(cases).find(c => c.id === caseId);
     if (!caso) return;
     const updatedBitacora = safeArr(caso.bitacora).map(entry => entry.id === entryId ? { ...entry, completada: !entry.completada } : entry);
     await saveToCloud('cases', caseId, { ...caso, bitacora: updatedBitacora });
  };

  const handleSaveDoc = async () => {
    if(!docForm.nombre) return alert("Nombre obligatorio"); 
    const finalId = editingDocId || `DOC-${String(docs.length + 1).padStart(3, '0')}`;
    await saveToCloud('docs', finalId, { ...docForm, id: finalId });
    setIsDocModalOpen(false); setEditingDocId(null); setNewDocLink({nombre:'', url:''});
  };

  const handleAddDocBitacora = () => {
    if (!newDocBitacoraEntry.descripcion) return;
    setDocForm(prev => ({ ...prev, bitacora: [{ id: Date.now(), ...newDocBitacoraEntry, fecha: new Date().toISOString().split('T')[0], completada: false }, ...safeArr(prev.bitacora)] }));
    setNewDocBitacoraEntry({ tipo: 'Tarea', descripcion: '', responsable: '', fechaCumplimiento: '' });
  };
  
  const toggleDocTaskCompletion = async (docId, entryId) => {
     const documento = safeArr(docs).find(d => d.id === docId);
     if (!documento) return;
     const updatedBitacora = safeArr(documento.bitacora).map(entry => entry.id === entryId ? { ...entry, completada: !entry.completada } : entry);
     
     const tareas = updatedBitacora.filter(b => b.tipo === 'Tarea');
     let nuevoAvance = documento.avance;
     if(tareas.length > 0) {
        nuevoAvance = Math.round((tareas.filter(t => t.completada).length / tareas.length) * 100);
     }
     await saveToCloud('docs', docId, { ...documento, bitacora: updatedBitacora, avance: nuevoAvance });
  };

  const handleOficializarBorrador = () => {
    if(window.confirm("¿Estás seguro de promover el borrador actual como Documento Oficial? Esto reiniciará el Semáforo de Vigencia a Verde.")){
       setDocForm(p => ({
           ...p,
           archivosOficiales: [...safeArr(p.archivos), ...safeArr(p.archivosOficiales)],
           archivos: [],
           fechaResolucion: new Date().toISOString().split('T')[0],
           fase: 'Oficialización',
           avance: 100
       }));
    }
  };

  // --- CARGA DE ARCHIVOS A FIREBASE STORAGE ---
  const handleCaseFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingCaseFile(true);
    try {
      const storageRef = ref(storage, `casos/${editingCaseId || 'nuevo'}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setCaseForm(prev => ({ 
        ...prev, 
        archivos: [{ id: Date.now().toString(), nombre: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB', fecha: new Date().toISOString().split('T')[0], url: url }, ...safeArr(prev.archivos)] 
      }));
    } catch (err) {
      console.error(err);
      alert("Error al subir el archivo. Verifica las reglas de Firebase Storage.");
    } finally {
      setIsUploadingCaseFile(false);
      e.target.value = null; 
    }
  };

  const handleDocFileUpload = async (e, targetArray = 'archivos') => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingDocFile(true);
    try {
      const storageRef = ref(storage, `protocolos/${editingDocId || 'nuevo'}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setDocForm(prev => ({ 
        ...prev, 
        [targetArray]: [{ id: Date.now().toString(), nombre: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB', fecha: new Date().toISOString().split('T')[0], url: url }, ...safeArr(prev[targetArray])] 
      }));
    } catch (err) {
      console.error(err);
      alert("Error al subir el archivo. Verifica las reglas de Firebase Storage.");
    } finally {
      setIsUploadingDocFile(false);
      e.target.value = null; 
    }
  };

  const handleSaveTemplate = async () => {
    const validCriterios = safeArr(templateForm.criterios).filter(c => { const t = typeof c === 'string' ? c : c.pregunta; return t && t.trim() !== ''; }).map((c, i) => { if (typeof c === 'string') return { id: `crit_${Date.now()}_${i}`, pregunta: c, opciones: 'SÍ=1, NO=0' }; return { ...c, id: c.id || `crit_${Date.now()}_${i}` }; });
    if (!templateForm.nombre || validCriterios.length === 0) return alert("Ingresa nombre y al menos un criterio.");
    const finalId = editingTemplateId || `TPL-${Date.now()}`;
    await saveToCloud('auditTemplates', finalId, { id: finalId, nombre: templateForm.nombre, tipo: templateForm.tipo, metodoCalculo: templateForm.metodoCalculo || 'Suma Automática', instruccionesDiagnostico: templateForm.instruccionesDiagnostico || '', encabezados: safeArr(templateForm.encabezados), criterios: validCriterios, rangos: safeArr(templateForm.rangos) });
    setIsTemplateModalOpen(false); setEditingTemplateId(null);
  };

  const openTemplateEditor = (t) => {
    const normCriterios = safeArr(t.criterios).map((c, i) => { if (typeof c === 'string') return { id: `crit_${i}`, pregunta: c, opciones: 'SÍ=1, NO=0' }; return c; });
    setEditingTemplateId(t.id);
    setTemplateForm({ nombre: t.nombre || '', metodoCalculo: t.metodoCalculo || 'Suma Automática', instruccionesDiagnostico: t.instruccionesDiagnostico || '', encabezados: safeArr(t.encabezados), criterios: normCriterios.length > 0 ? normCriterios : [{ id: 'crit_1', pregunta: '', opciones: 'SÍ=1, NO=0' }], rangos: safeArr(t.rangos), tipo: t.tipo || 'Ambos' });
    setIsTemplateModalOpen(true);
  };

  const handleSaveAudit = async () => {
    const selectedTemplate = safeArr(auditTemplates).find(t => t.id === auditForm.templateId);
    if (!selectedTemplate) return;
    if (selectedTemplate.metodoCalculo === 'Juicio Clínico' && !auditForm.estadoManual) return alert("Seleccione un Resultado Clínico.");
    
    let maxScore = 0; let actualScore = 0;
    safeArr(selectedTemplate.criterios).forEach((c, idx) => {
      const opcionesStr = typeof c === 'string' ? 'SÍ=1, NO=0' : (c.opciones || 'SÍ=1, NO=0');
      const ops = parseOpciones(opcionesStr);
      maxScore += Math.max(...ops.map(o => o.value));
      const answer = auditForm.answers[c.id || idx];
      if (answer && typeof answer === 'object') actualScore += answer.value; 
      else if (answer === 'si') actualScore += 1;
    });

    const scorePercentage = maxScore > 0 ? Math.round((actualScore / maxScore) * 100) : 0;
    let estadoTexto = selectedTemplate.metodoCalculo === 'Juicio Clínico' ? auditForm.estadoManual : (scorePercentage >= 75 ? 'Óptimo' : 'Riesgo');
    if (selectedTemplate.metodoCalculo !== 'Juicio Clínico' && safeArr(selectedTemplate.rangos).length > 0) {
       const match = safeArr(selectedTemplate.rangos).find(r => actualScore >= Number(r.min) && actualScore <= Number(r.max));
       if (match) estadoTexto = match.resultado;
    }

    const finalId = `AUD-${Date.now()}`;
    await saveToCloud('audits', finalId, { id: finalId, centro: auditForm.centro, tipo: auditForm.tipo, templateId: selectedTemplate.id, headerAnswers: auditForm.headerAnswers || {}, answers: auditForm.answers || {}, cumplimiento: scorePercentage, puntaje: selectedTemplate.metodoCalculo === 'Juicio Clínico' ? 'N/A' : `${actualScore} / ${maxScore}`, estado: estadoTexto, evaluador: currentUser.nombre, fecha: auditForm.fecha || new Date().toISOString().split('T')[0], observaciones: auditForm.observaciones || '' });
    setIsAuditModalOpen(false);
  };

  const handleSaveDir = async () => {
    if (!dirForm.nombre) return alert("Nombre obligatorio");
    const finalId = editingDirId || Date.now().toString();
    await saveToCloud('directory', finalId, { ...dirForm, id: finalId });
    setIsDirModalOpen(false);
  };

  const handleSaveUser = async () => {
    if (!userForm.rut || !userForm.password) return alert("RUT y Contraseña obligatorios.");
    const finalId = editingUserId || Date.now().toString();
    await saveToCloud('users', finalId, { ...userForm, id: finalId });
    setIsUserModalOpen(false);
  };

  const handleUpdatePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) return alert("Contraseñas no coinciden.");
    if (passwordForm.current !== currentUser.password) return alert("Contraseña actual incorrecta.");
    await saveToCloud('users', currentUser.id, { ...currentUser, password: passwordForm.new });
    setCurrentUser({ ...currentUser, password: passwordForm.new }); setIsProfileModalOpen(false); alert("Actualizada exitosamente!");
  };

  if (printingAudit) {
    const template = safeArr(auditTemplates).find(t => t.id === printingAudit.templateId);
    if (!template) return <div className="p-10 text-red-500">Error: Pauta base no encontrada.</div>;
    const criterios = typeof safeArr(template.criterios)[0] === 'string' ? safeArr(template.criterios).map((c,i) => ({id: i, pregunta: c, opciones: 'SÍ=1, NO=0'})) : safeArr(template.criterios);

    return (
      <div className="bg-white text-black min-h-screen w-full font-sans absolute inset-0 z-[100] print:static">
        <div className="max-w-4xl mx-auto p-12 print:p-0 print:w-full print:max-w-full text-[11px] print:text-[10px]">
           <div className="flex justify-end gap-3 mb-4 print:hidden">
             <button onClick={() => window.print()} className={clsBtnP}><Printer size={14}/> Imprimir Documento</button>
             <button onClick={() => setPrintingAudit(null)} className={clsBtnS}>Volver</button>
           </div>
           <div className="border-b-2 border-black pb-2 mb-4 text-center">
             <h1 className="text-lg font-black uppercase tracking-widest">{String(template.nombre)}</h1>
             <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">UHCIP INFANTO JUVENIL - Hospital Puerto Montt</p>
           </div>
           <div className="grid grid-cols-2 gap-2 mb-4 border border-gray-300 p-3 rounded-lg">
             <div className="flex flex-col"><span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Dispositivo Evaluado</span><span className="font-bold text-black">{String(printingAudit.centro || '---')}</span></div>
             <div className="flex flex-col"><span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Fecha Evaluación</span><span className="font-bold text-black">{String(printingAudit.fecha)}</span></div>
             {safeArr(template.encabezados).map(h => (
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

  if (!currentUser) return (
    <div className="min-h-screen bg-[#0a2540] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center">
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
          <button onClick={()=>setActiveTab('stats')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'stats' ? 'bg-blue-600' : 'opacity-70 hover:opacity-100'}`}><BarChart3 size={18}/> Estadísticas</button>
          <div className="pt-5 pb-2 px-4 text-[10px] font-black text-blue-400 uppercase tracking-widest">Red</div>
          <button onClick={()=>setActiveTab('auditorias')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'auditorias' ? 'bg-blue-600' : 'opacity-70 hover:opacity-100'}`}><ClipboardCheck size={18}/> Auditorías</button>
          {currentUser?.rol === 'Admin' && (
             <>
               <div className="pt-5 pb-2 px-4 text-[10px] font-black text-blue-400 uppercase tracking-widest">Ajustes</div>
               <button onClick={()=>setActiveTab('config')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'config' ? 'bg-blue-600' : 'opacity-70 hover:opacity-100'}`}><Settings size={18}/> Configuración</button>
             </>
          )}
        </nav>
        <div className="p-4 border-t border-white/5 bg-[#071c31]"><button onClick={()=>setCurrentUser(null)} className="w-full py-2 text-[10px] uppercase font-black text-red-400 hover:bg-red-500/10 rounded-lg">Cerrar Sesión</button></div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto relative">
        <div className="absolute top-6 right-6 z-20">
            <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm relative transition-all"><Bell size={20} />{notifications.length > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}</button>
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden fade-in">
                <div className="bg-[#0a2540] text-white px-4 py-3 font-bold flex justify-between items-center text-xs">Alertas de Red <span className="bg-blue-600 text-[10px] px-2 py-0.5 rounded-full">{notifications.length}</span></div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map(n => (
                    <div key={n.id} className="p-4 hover:bg-slate-50 transition-colors flex gap-3 items-start"><AlertTriangle size={14} className="text-red-500 mt-0.5"/><div><p className="text-sm font-bold text-slate-800">{String(n.title)}</p><p className="text-xs text-slate-500 mt-1 font-medium">{String(n.desc)}</p></div></div>
                  ))}
                  {notifications.length === 0 && <div className="p-6 text-center text-xs text-slate-500 font-medium">No hay notificaciones.</div>}
                </div>
              </div>
            )}
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-black text-slate-800">Panel de Gestión Integral</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border-l-4 border-red-500 shadow-sm"><p className="text-[9px] text-slate-400 font-black uppercase">Pérdida Continuidad</p><h3 className="text-2xl font-black text-red-600">{alertCases.length}</h3></div>
              <div className="bg-white p-4 rounded-2xl border-l-4 border-blue-500 shadow-sm"><p className="text-[9px] text-slate-400 font-black uppercase">En Tránsito</p><h3 className="text-2xl font-black text-blue-600">{visibleCases.filter(c=>c.estado==='Pendiente').length}</h3></div>
              <div className="bg-white p-4 rounded-2xl border-l-4 border-amber-500 shadow-sm"><p className="text-[9px] text-slate-400 font-black uppercase">Tareas Críticas</p><h3 className="text-2xl font-black text-amber-600">{tareasCriticas}</h3></div>
              <div className="bg-white p-4 rounded-2xl border-l-4 border-indigo-500 shadow-sm"><p className="text-[9px] text-slate-400 font-black uppercase">Auditorías</p><h3 className="text-2xl font-black text-indigo-600">{audits.length}</h3></div>
            </div>

            {/* DASHBOARD EJECUTIVO PARA JEFATURA */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-700 relative overflow-hidden">
               <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
               <div className="flex items-center gap-4 relative z-10">
                 <div className="p-4 bg-white/10 rounded-2xl text-blue-400"><Shield size={32}/></div>
                 <div>
                   <h3 className="text-sm font-black uppercase tracking-[0.2em] text-blue-400 mb-1">Estatus Normativo y Resolutivo</h3>
                   <p className="text-xs font-medium text-slate-300 leading-relaxed">Actualmente tenemos <strong className="text-white underline">{safeArr(docs).filter(d => d.fase === 'Validación Técnica').length} protocolos</strong> en Fase de Validación Técnica y <strong className="text-white underline">{safeArr(docs).filter(d => d.prioridad === 'Alta').length} con Prioridad Alta</strong> que requieren sanción directiva.</p>
                 </div>
               </div>
               <button onClick={()=>setActiveTab('docs')} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shrink-0 relative z-10">Gestionar Normas</button>
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

        {activeTab === 'cases' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-end"><h2 className="text-2xl font-black text-slate-800">Seguimiento de Red</h2>
            <div className="flex gap-2">
              <button onClick={handleExportCSV} className={clsBtnS + " bg-emerald-100 hover:bg-emerald-200 text-emerald-700"}><Download size={14} className="inline mr-1"/> Exportar Excel</button>
              <button onClick={()=>{setCaseForm({ rut:'', nombre:'', edad:'', origen:'', destino:'', prioridad:'Media', estado:'Pendiente', fechaEgreso: new Date().toISOString().split('T')[0], bitacora:[], archivos:[] }); setIsCaseModalOpen(true);}} className={clsBtnP}><Plus size={16}/> Nuevo Caso</button>
            </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-4 items-center">
              <div className="flex-1"><Lbl>Buscar Paciente</Lbl><Inp value={caseSearch} onChange={e=>setCaseSearch(e.target.value)} placeholder="RUT o Nombre..." className="py-2" /></div>
              <div className="w-64"><Lbl>Filtrar Dispositivo</Lbl><Sel value={caseFilterCentro} onChange={e=>setCaseFilterCentro(e.target.value)} className="py-2"><option value="Todos">Todos</option>{safeArr(centros).map(c=><option key={c} value={c}>{c}</option>)}</Sel></div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
               <table className="w-full text-left">
                 <thead className="bg-slate-50 border-b"><tr className="text-[10px] font-black uppercase text-slate-400"><th className="p-4">Paciente</th><th className="p-4">Ruta</th><th className="p-4 text-center">Estado</th><th className="p-4 text-right">Acción</th></tr></thead>
                 <tbody>{filteredCases.map(c => (
                   <tr key={c.id} className="border-b hover:bg-slate-50">
                     <td className="p-4"><p className="font-bold text-sm uppercase">{c.nombre}</p><p className="text-[10px] text-slate-400">{c.paciente}</p></td>
                     <td className="p-4 text-xs font-black text-blue-600 uppercase">{c.origen} → {c.destino}</td>
                     <td className="p-4">
                       <div className="flex flex-col items-center gap-1">
                         <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${c.estado === 'Alerta' ? 'bg-red-100 text-red-700 animate-pulse' : c.estado === 'Pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{c.estado}</span>
                         {safeArr(c.bitacora).some(b => b.barrera && b.barrera !== 'Ninguna') && <span className="text-[8px] font-black text-red-600 uppercase flex items-center gap-1"><AlertTriangle size={8}/> Barrera Activa</span>}
                       </div>
                     </td>
                     <td className="p-4 text-right"><button onClick={()=>{setCaseForm(c); setIsCaseModalOpen(true);}} className="p-2 text-slate-300 hover:text-blue-600"><Edit2 size={20}/></button></td>
                   </tr>
                 ))}</tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-end"><h2 className="text-2xl font-black text-slate-800">Gestión Normativa de Red</h2><button onClick={()=>{setDocForm({ nombre: '', ambito: '', fase: 'Levantamiento', avance: 0, prioridad: 'Media', bitacora: [], archivos: [], archivosOficiales: [] }); setIsDocModalOpen(true);}} className={clsBtnP}><Plus size={16}/> Nueva Norma</button></div>
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

        {/* OTROS TABS (STATS, AUDITORIAS, CONFIG) */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-in fade-in">
             <h2 className="text-2xl font-black text-slate-800">Estadísticas</h2>
             <div className="bg-white p-6 rounded-2xl shadow-sm border"><Lbl>Plazo General (Días)</Lbl><Inp type="number" value={appConfig.targetDays} onChange={e=>handleUpdateTarget(e.target.value)} className="w-32" /></div>
          </div>
        )}

        {(activeTab === 'auditorias' || activeTab === 'consultorias') && (
           <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-end"><h2 className="text-2xl font-black text-slate-800">{activeTab === 'auditorias' ? 'Auditorías' : 'Consultorías'}</h2><button onClick={()=>setIsAuditModalOpen(true)} className={clsBtnP}>Evaluar</button></div>
           </div>
        )}

        {activeTab === 'config' && currentUser?.rol === 'Admin' && (
          <div className="space-y-6 animate-in fade-in">
             <h2 className="text-2xl font-black text-slate-800">Configuración</h2>
             <div className="bg-white p-6 rounded-2xl border"><Lbl>Llave API Google IA</Lbl><Inp type="password" value={apiConfigKey} onChange={e=>setApiConfigKey(e.target.value)} /><button onClick={async ()=>{await saveToCloud('settings', 'config', { ...appConfig, apiKey: apiConfigKey }); alert("Guardado!");}} className={clsBtnP + " mt-4"}>Guardar Llave</button></div>
          </div>
        )}
      </main>

      {/* ================= MODAL IA DOCUMENTOS ================= */}
      <ModalWrap isOpen={!!aiFileContext} mw="max-w-2xl">
         <ModalHdr t={`Analizador IA: ${aiFileContext?.nombre}`} onClose={()=>{setAiFileContext(null); setAiResponse(''); setAiPrompt('');}} icon={BrainCircuit} />
         <div className="p-6 flex flex-col h-[60vh] bg-slate-50">
             <div className="flex-1 overflow-y-auto mb-4 bg-white p-5 rounded-2xl border shadow-inner text-sm whitespace-pre-wrap leading-relaxed text-slate-700">
                 {aiResponse || <span className="text-slate-400 italic">Escribe tu instrucción (ej. "Haz un resumen médico de este PDF", "¿Detectas medicamentos?")...</span>}
             </div>
             <div className="flex gap-3 shrink-0">
                 <Inp value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="¿Qué necesitas saber?" onKeyDown={e=>e.key==='Enter' && handleAskAiAboutFile()} disabled={isAnalyzingFile} />
                 <button onClick={handleAskAiAboutFile} disabled={isAnalyzingFile || !aiPrompt.trim()} className={clsBtnP}>{isAnalyzingFile ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}</button>
             </div>
         </div>
      </ModalWrap>

      {/* ================= MODAL CASOS ================= */}
      <ModalWrap isOpen={isCaseModalOpen}>
        <ModalHdr t={caseForm.id ? `Caso: ${caseForm.nombre}` : 'Nuevo Seguimiento'} onClose={()=>setIsCaseModalOpen(false)} icon={Users} />
        <div className="flex bg-slate-50 border-b px-6 shrink-0">
          {['datos','bitacora','archivos'].map(tab => (<button key={tab} onClick={()=>setActiveModalTab(tab)} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-4 ${activeModalTab === tab ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>{tab === 'bitacora' ? 'Bitácora y Barreras' : tab === 'archivos' ? 'Archivos e IA' : tab}</button>))}
        </div>
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {activeModalTab === 'datos' && (
            <div className="grid grid-cols-2 gap-4">
              <div><Lbl>RUT</Lbl><Inp type="text" value={caseForm.rut} onChange={e=>setCaseForm({...caseForm, rut: e.target.value})} /></div>
              <div><Lbl>Nombre</Lbl><Inp type="text" value={caseForm.nombre} onChange={e=>setCaseForm({...caseForm, nombre: e.target.value})} /></div>
              <div><Lbl>Origen</Lbl><Inp list="cent-list" value={caseForm.origen} onChange={e=>setCaseForm({...caseForm, origen: e.target.value})} /></div>
              <div><Lbl>Destino</Lbl><Inp list="cent-list" value={caseForm.destino} onChange={e=>setCaseForm({...caseForm, destino: e.target.value})} /></div>
              <datalist id="cent-list">{safeArr(centros).map(c=><option key={c} value={c}/>)}</datalist>
              <div><Lbl>Estado</Lbl><Sel value={caseForm.estado} onChange={e=>setCaseForm({...caseForm, estado: e.target.value})}><option>Pendiente</option><option>Concretado</option><option>Alerta</option></Sel></div>
              <div><Lbl>Fecha Egreso</Lbl><Inp type="date" value={caseForm.fechaEgreso} onChange={e=>setCaseForm({...caseForm, fechaEgreso: e.target.value})} /></div>
            </div>
          )}
          {activeModalTab === 'bitacora' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4">
                 <Sel value={newBitacoraEntry.tipo} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, tipo: e.target.value})}><option>Nota Adm.</option><option>Intervención</option><option>Tarea</option></Sel>
                 <Sel value={newBitacoraEntry.barrera} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, barrera: e.target.value})} className={newBitacoraEntry.barrera !== 'Ninguna' ? 'bg-red-50 text-red-700 border-red-200' : ''}>
                   <option value="Ninguna">✅ Sin Barrera</option>
                   <optgroup label="Dispositivo / Red">
                     <option value="Falta Cupo Médico">⚠️ Falta Cupo Psiquiatra</option>
                     <option value="Falta Cupo Psicosocial">⚠️ Falta Cupo Psicosocial</option>
                     <option value="Rechazo Derivación">⚠️ Rechazo Derivación</option>
                     <option value="Error Documentación">⚠️ Error Documentación</option>
                   </optgroup>
                   <optgroup label="Usuario / Familia">
                     <option value="Inasistencia Usuario">🚨 Inasistencia</option>
                     <option value="Inaccesibilidad/Traslado">🚨 Traslado</option>
                     <option value="Rechazo Tratamiento">🚨 Rechazo Tto.</option>
                     <option value="Crisis Social">🚨 Crisis Social/Familiar</option>
                   </optgroup>
                   <optgroup label="Intersectorial">
                     <option value="Espera Resolución Judicial">⚖️ Judicial</option>
                     <option value="Falta Plaza Mejor Niñez">🏠 Plaza Residencia</option>
                   </optgroup>
                 </Sel>
                 <Inp placeholder="Resp..." value={newBitacoraEntry.responsable} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, responsable: e.target.value})} />
                 <Txt placeholder="Detalle..." value={newBitacoraEntry.descripcion} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, descripcion: e.target.value})} />
                 {newBitacoraEntry.tipo === 'Tarea' && <Inp type="date" value={newBitacoraEntry.fechaCumplimiento || ''} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, fechaCumplimiento: e.target.value})} className="col-span-4 bg-amber-50" />}
                 <button onClick={handleAddBitacora} className={clsBtnP + " md:col-span-4"}>Añadir Registro</button>
              </div>
              <div className="space-y-2">
                {safeArr(caseForm.bitacora).map(b => (
                  <div key={b.id} className="p-4 bg-white border rounded-xl flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase text-blue-600">{b.tipo}</span>
                        {b.barrera && b.barrera !== 'Ninguna' && <span className="bg-red-100 text-red-700 text-[8px] font-black px-2 py-0.5 rounded uppercase flex items-center gap-1"><AlertTriangle size={10}/> Barrera: {b.barrera}</span>}
                      </div>
                      <p className="text-sm font-medium">{b.descripcion}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase">Resp: {b.responsable || 'N/A'}</p>
                    </div>
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
                        <button onClick={(e)=>{e.preventDefault(); setAiFileContext(f);}} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all" title="Analizar con IA"><BrainCircuit size={14}/></button>
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
                <div><Lbl>Fecha Resolución (Semaforización)</Lbl><Inp type="date" value={docForm.fechaResolucion || ''} onChange={e=>setDocForm({...docForm, fechaResolucion: e.target.value})} /></div>
              </div>
            </div>
          )}
          {activeDocModalTab === 'bitacora' && (() => {
             const docTareas = safeArr(docForm.bitacora).filter(b => b.tipo === 'Tarea');
             const docAvanceTemp = docTareas.length > 0 ? Math.round((docTareas.filter(t => t.completada).length / docTareas.length) * 100) : (docForm.avance || 0);
             return (
             <div className="space-y-4">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                  <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-blue-800">Avance Calculado</span></div>
                  <span className="text-2xl font-black text-blue-600">{docAvanceTemp}%</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl grid grid-cols-2 gap-3"><Inp value={newDocBitacoraEntry.responsable} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, responsable: e.target.value})} placeholder="Resp..." /><Txt rows="1" value={newDocBitacoraEntry.descripcion} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, descripcion: e.target.value})} placeholder="Tarea..." className="col-span-2"/><button onClick={handleAddDocBitacora} className={clsBtnP + " col-span-2"}>Añadir Tarea</button></div>
                {safeArr(docForm.bitacora).map(b => (
                  <div key={b.id} className="p-4 border rounded-xl flex items-start gap-4">
                    <button onClick={() => setDocForm(p => ({...p, bitacora: p.bitacora.map(x => x.id === b.id ? {...x, completada: !x.completada} : x)}))} className={b.completada ? "text-emerald-500" : "text-amber-500"}><CheckSquare size={20}/></button>
                    <div className="flex-1"><p className={`text-sm font-bold ${b.completada ? 'line-through text-slate-400' : 'text-slate-800'}`}>{String(b.descripcion)}</p></div>
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
                 <div className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-2xl text-center space-y-3">
                    <button onClick={() => setDocForm(p => ({ ...p, archivosOficiales: [...safeArr(p.archivos), ...safeArr(p.archivosOficiales)], archivos: [], fechaResolucion: new Date().toISOString().split('T')[0], fase: 'Oficialización', avance: 100 }))} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase mx-auto flex items-center gap-2">🌟 Oficializar Borrador (100% Listo)</button>
                 </div>
               )}
               <div>
                 <Lbl className="bg-indigo-50 text-indigo-800 px-3 py-2 rounded-lg border border-indigo-100 inline-block mb-3">1. Documento Oficial Vigente</Lbl>
                 <div className="space-y-2 mb-4">
                   {safeArr(docForm.archivosOficiales).map(f => (
                     <div key={f.id} className="flex justify-between items-center p-3 bg-white border-2 border-indigo-50 rounded-xl group">
                        <span className="text-xs font-black text-indigo-900">{f.nombre}</span>
                        <div className="flex gap-2 items-center">
                          <button onClick={(e)=>{e.preventDefault(); setAiFileContext(f);}} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white p-1.5 rounded transition-all"><BrainCircuit size={14}/></button>
                          <a href={f.url} target="_blank" rel="noreferrer" className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded"><ExternalLink size={12}/></a>
                          <button onClick={()=>setDocForm(p=>({...p, archivosOficiales: p.archivosOficiales.filter(a=>a.id!==f.id)}))} className="text-red-400 p-1"><Trash2 size={14}/></button>
                        </div>
                     </div>
                   ))}
                   {safeArr(docForm.archivosOficiales).length === 0 && <p className="text-[10px] text-slate-400 italic">No hay documento oficial publicado.</p>}
                 </div>
                 <label className="cursor-pointer inline-block text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200"><UploadCloud size={14} className="inline mr-2"/> Subir Oficial Directo<input type="file" className="hidden" disabled={isUploadingDocFile} onChange={(e) => handleDocFileUpload(e, 'archivosOficiales')} /></label>
               </div>

               <div className="border-t border-slate-100 pt-6">
                 <Lbl className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg border inline-block mb-3">2. Borradores e Insumos</Lbl>
                 <label className="cursor-pointer block bg-slate-50 p-4 rounded-xl text-center text-slate-600 font-black text-xs uppercase border border-dashed border-slate-300 mb-4"><UploadCloud size={20} className="mx-auto mb-1 text-slate-400"/> {isUploadingDocFile ? 'Subiendo...' : 'Subir Borrador'}<input type="file" className="hidden" disabled={isUploadingDocFile} onChange={(e) => handleDocFileUpload(e, 'archivos')} /></label>
                 <div className="space-y-2">
                   {safeArr(docForm.archivos).map(f => (
                     <div key={f.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl group">
                        <span className="text-xs font-bold text-slate-700">{f.nombre}</span>
                        <div className="flex gap-2 items-center">
                          <button onClick={(e)=>{e.preventDefault(); setAiFileContext(f);}} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white p-1.5 rounded transition-all"><BrainCircuit size={14}/></button>
                          <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-600 bg-blue-50 px-2 py-1 rounded"><ExternalLink size={12}/></a>
                          <button onClick={()=>setDocForm(p=>({...p, archivos: p.archivos.filter(a=>a.id!==f.id)}))} className="text-red-400 p-1"><Trash2 size={14}/></button>
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