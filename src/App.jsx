import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  LayoutDashboard, Users, FileText, AlertTriangle, CheckCircle, Clock, Plus, Activity, LogOut,
  Bell, Copy, Loader2, Edit2, Trash2, ListTodo, MessageSquare, CheckSquare, Square, Calendar,
  UploadCloud, Paperclip, File as FileIcon, Lock, User, ClipboardCheck, BookOpen, Download,
  Wand2, Settings, UserPlus, Shield, Key, Timer, TrendingUp, BarChart3, Target, Printer, Search, ExternalLink
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
  if (inlineData) parts.push({ inlineData });
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
  const [newBitacoraEntry, setNewBitacoraEntry] = useState({ tipo: 'Nota Adm.', descripcion: '', responsable: '', fechaCumplimiento: '' });

  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [docForm, setDocForm] = useState({ nombre: '', ambito: 'Red Integral', fase: 'Levantamiento', avance: 10, notas: '', bitacora: [], archivos: [] });
  const [activeDocModalTab, setActiveDocModalTab] = useState('datos');
  const [newDocBitacoraEntry, setNewDocBitacoraEntry] = useState({ tipo: 'Tarea', descripcion: '', responsable: '', fechaCumplimiento: '' });

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  
  const [auditForm, setAuditForm] = useState({ centro: '', templateId: '', headerAnswers: {}, answers: {}, tipo: 'Auditoría', observaciones: '', fecha: new Date().toISOString().split('T')[0], estadoManual: '' });
  const [templateForm, setTemplateForm] = useState({ nombre: '', metodoCalculo: 'Suma Automática', instruccionesDiagnostico: '', encabezados: [{ id: 'enc_1', label: 'Centro Evaluado', type: 'text' }, { id: 'enc_2', label: 'Fecha', type: 'date' }], criterios: [{ id: 'crit_1', pregunta: '', opciones: 'SÍ=1, NO=0' }], rangos: [], tipo: 'Ambos' });
  
  const [printingAudit, setPrintingAudit] = useState(null);
  const [rawTextForAI, setRawTextForAI] = useState('');
  
  const [centroFilterAuditorias, setCentroFilterAuditorias] = useState('Todos');
  const [centroFilterConsultorias, setCentroFilterConsultorias] = useState('Todos');
  const [caseFilterCentro, setCaseFilterCentro] = useState('Todos');
  const [caseSearch, setCaseSearch] = useState('');
  
  const [isDigitizing, setIsDigitizing] = useState(false);
  
  // ESTADOS DE CARGA PARA STORAGE
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
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (e) { console.warn("Auth", e.message); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubCases = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'cases'), snap => setCases(safeArr(snap.docs.map(d => d.data()))));
    const unsubDocs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'docs'), snap => setDocs(safeArr(snap.docs.map(d => d.data()))));
    const unsubAudits = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'audits'), snap => setAudits(safeArr(snap.docs.map(d => d.data()))));
    const unsubTemplates = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'auditTemplates'), snap => setAuditTemplates(safeArr(snap.docs.map(d => d.data()))));
    const unsubDir = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'directory'), snap => setDirectory(safeArr(snap.docs.map(d => d.data()))));
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), snap => setUsers(safeArr(snap.docs.map(d => d.data()))));
    const unsubCentros = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'centros'), snap => { if (snap.exists() && safeArr(snap.data().list).length > 0) setCentros(snap.data().list); });
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), snap => { 
      if (snap.exists()) { const data = snap.data(); setAppConfig({ targetDays: 7, plazos: {}, ...data }); if (data?.apiKey) setApiConfigKey(data.apiKey); } 
    });

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
    const headers = ['ID_Seguimiento', 'RUT', 'Paciente', 'Edad', 'Origen', 'Destino', 'Estado', 'Fecha_Egreso', 'Fecha_Recepcion', 'Fecha_Ingreso_Efectivo', 'Plazo_Meta_Dias', 'Brecha_Dias', 'Ultimo_Hito_Fecha', 'Ultimo_Hito_Tipo', 'Responsable_Hito'];
    const rows = filteredCases.map(c => {
       const target = getTargetDaysForCase(c.destino);
       const brecha = diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo);
       const ultBit = safeArr(c.bitacora)[0] || {};
       return [c.id, c.paciente, c.nombre, c.edad||'', c.origen, c.destino, c.estado, c.fechaEgreso||'', c.fechaRecepcionRed||'', c.fechaIngresoEfectivo||'', target, brecha||'', ultBit.fecha||'', ultBit.tipo||'', ultBit.responsable||''];
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

  // --- IA Y GENERACIÓN ---
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
    setIsCaseModalOpen(false); setEditingCaseId(null); setCaseForm(defaultCaseState); setCaseSummary('');
  };

  const handleAddBitacora = () => {
    if (!newBitacoraEntry.descripcion) return;
    setCaseForm({ ...caseForm, bitacora: [{ id: Date.now(), ...newBitacoraEntry, fecha: new Date().toISOString().split('T')[0], completada: false }, ...safeArr(caseForm.bitacora)] });
    setNewBitacoraEntry({ tipo: 'Nota Adm.', descripcion: '', responsable: '', fechaCumplimiento: '' });
  };
  
  const toggleTaskCompletion = async (caseId, entryId) => {
     const caso = safeArr(cases).find(c => c.id === caseId);
     if (!caso) return;
     const updatedBitacora = safeArr(caso.bitacora).map(entry => entry.id === entryId ? { ...entry, completada: !entry.completada } : entry);
     await saveToCloud('cases', caseId, { ...caso, bitacora: updatedBitacora });
  };

  const handleSaveDoc = async () => {
    if(!docForm.nombre) return alert("Nombre obligatorio"); 
    const finalId = editingDocId || `DOC-00${docs.length + 1}`;
    await saveToCloud('docs', finalId, { ...docForm, id: finalId });
    setIsDocModalOpen(false); setEditingDocId(null);
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
     await saveToCloud('docs', docId, { ...documento, bitacora: updatedBitacora });
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
      e.target.value = null; // Limpiar input
    }
  };

  const handleDocFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingDocFile(true);
    try {
      const storageRef = ref(storage, `protocolos/${editingDocId || 'nuevo'}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setDocForm(prev => ({ 
        ...prev, 
        archivos: [{ id: Date.now().toString(), nombre: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB', fecha: new Date().toISOString().split('T')[0], url: url }, ...safeArr(prev.archivos)] 
      }));
    } catch (err) {
      console.error(err);
      alert("Error al subir el archivo. Verifica las reglas de Firebase Storage.");
    } finally {
      setIsUploadingDocFile(false);
      e.target.value = null; // Limpiar input
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

  // ================= VISTA DE IMPRESIÓN =================
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

           {/* BLOQUE INQUEBRANTABLE IMPRESIÓN */}
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
    <div className="min-h-screen bg-[#0a2540] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-200"><Activity size={28} className="text-white" /></div>
        <h1 className="text-2xl font-bold text-slate-800">SGCC-SM</h1>
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1 mb-6">Hospital Puerto Montt</p>
        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div><Lbl><User size={12} className="inline mr-1"/> RUT DE USUARIO</Lbl><Inp type="text" value={loginData.rut} onChange={(e) => setLoginData({...loginData, rut: e.target.value})} placeholder="11.111.111-1" /></div>
          <div><Lbl><Lock size={12} className="inline mr-1"/> CONTRASEÑA</Lbl><Inp type="password" value={loginData.password} onChange={(e) => setLoginData({...loginData, password: e.target.value})} placeholder="••••••" /></div>
          {loginError && <p className="text-red-500 text-xs text-center font-black uppercase">{loginError}</p>}
          <button type="submit" className={clsBtnP + " w-full justify-center py-4"}>INGRESAR AL SISTEMA</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans print:hidden">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-[#0a2540] text-white flex flex-col h-screen sticky top-0 shrink-0 shadow-xl overflow-y-auto">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-start gap-3 mb-1">
             <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-sm shadow-lg shrink-0 mt-0.5">{String(currentUser?.iniciales || 'U')}</div>
             <div className="flex-1 w-full flex flex-col justify-center min-w-0">
               <h1 className="text-sm font-black tracking-tight leading-tight text-white whitespace-normal break-words" style={{wordBreak:'break-word'}}>{String(currentUser?.nombre || 'Usuario')}</h1>
               <p className="text-[9px] text-blue-300 font-black uppercase tracking-widest mt-1.5 leading-snug whitespace-normal break-words" style={{wordBreak:'break-word'}}>{String(currentUser?.cargo || 'SGCC-SM')}</p>
             </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><LayoutDashboard size={18}/> Panel Principal</button>
          <button onClick={() => setActiveTab('stats')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'stats' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><BarChart3 size={18}/> Plazos Meta</button>
          <button onClick={() => setActiveTab('cases')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'cases' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><Users size={18}/> Casos de Red</button>
          <button onClick={() => setActiveTab('docs')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'docs' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><FileText size={18}/> Protocolos</button>
          <div className="pt-5 pb-2 px-4 text-[10px] font-black text-blue-400 uppercase tracking-widest">Evaluación y Red</div>
          <button onClick={() => setActiveTab('auditorias')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'auditorias' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><ClipboardCheck size={18}/> Auditorías</button>
          <button onClick={() => setActiveTab('consultorias')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'consultorias' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><MessageSquare size={18}/> Consultorías</button>
          <button onClick={() => setActiveTab('dir')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'dir' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><BookOpen size={18}/> Directorio</button>
          {currentUser?.rol === 'Admin' && (
             <>
               <div className="pt-5 pb-2 px-4 text-[10px] font-black text-blue-400 uppercase tracking-widest">Administración</div>
               <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><UserPlus size={18}/> Usuarios</button>
               <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'config' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><Settings size={18}/> Ajustes</button>
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

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto relative">
        <div className="absolute top-6 right-6 z-20">
          <div className="relative">
            <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm relative transition-all"><Bell size={20} />{notifications.length > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}</button>
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden fade-in">
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
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Panel de Gestión Integral</h2><p className="text-xs text-slate-500 font-medium mt-1">Resumen de actividad clínica y normativa</p></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border-l-[6px] border-l-red-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Pérdida Continuidad</p><h3 className="text-2xl font-black text-red-600 mt-1">{alertCases.length}</h3></div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border-l-[6px] border-l-blue-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Pacientes en Tránsito</p><h3 className="text-2xl font-black text-blue-600 mt-1">{safeArr(visibleCases).filter(c => c.estado === 'Pendiente').length}</h3></div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border-l-[6px] border-l-amber-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Tareas Críticas</p><h3 className="text-2xl font-black text-amber-600 mt-1">{tareasCriticas}</h3></div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border-l-[6px] border-l-indigo-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Auditorías</p><h3 className="text-2xl font-black text-indigo-600 mt-1">{safeArr(visibleAudits).filter(a => a.tipo === 'Auditoría').length}</h3></div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border-l-[6px] border-l-teal-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Consultorías</p><h3 className="text-2xl font-black text-teal-600 mt-1">{safeArr(visibleAudits).filter(a => a.tipo === 'Consultoría').length}</h3></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 lg:col-span-2 overflow-hidden">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" /> Casos Requiriendo Rescate</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead><tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400"><th className="p-3 rounded-l-lg">ID</th><th className="p-3">Paciente</th><th className="p-3">Destino</th><th className="p-3 rounded-r-lg">Estado</th></tr></thead>
                    <tbody>
                      {alertCases.map(c => (<tr key={c.id} className="border-b border-slate-50"><td className="p-3 text-xs font-bold text-slate-500">{String(c.id)}</td><td className="p-3 text-sm font-bold text-slate-800">{String(c.nombre)}</td><td className="p-3 text-xs font-bold text-indigo-600">{String(c.destino)}</td><td className="p-3"><StatusBadge status={c.estado}/></td></tr>))}
                      {alertCases.length === 0 && (<tr><td colSpan="4" className="p-6 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">No hay alertas activas.</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-indigo-900 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden flex flex-col">
                <div className="relative z-10 flex-1 flex flex-col">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2"><Wand2 size={16} className="text-blue-300"/> Asistente de Rescate</h3>
                  <p className="text-[10px] text-indigo-200 font-medium mb-4 leading-relaxed">Genera un correo formal automático para solicitar revisión urgente a los directores de los {alertCases.length} casos perdidos.</p>
                  {currentUser?.rol === 'Admin' ? (
                    <button onClick={() => handleGenerateReport('alerts')} disabled={alertCases.length === 0 || isGeneratingReport} className="w-full bg-white text-indigo-900 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg disabled:opacity-50 transition-transform hover:-translate-y-1 mt-auto">
                      {isGeneratingReport ? <Loader2 size={14} className="animate-spin"/> : <MessageSquare size={14}/>} Redactar Correo
                    </button>
                  ) : (<div className="mt-auto p-3 bg-white/10 rounded-xl text-center text-[9px] font-black uppercase tracking-widest text-indigo-300">Exclusivo Administradores</div>)}
                </div>
                {reportContent && activeTab === 'dashboard' && currentUser?.rol === 'Admin' && (
                  <div className="mt-4 bg-[#081b30] p-4 rounded-xl border border-white/10 relative z-10"><div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10"><span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">Borrador:</span><button onClick={()=>copyToClipboard(reportContent)} className="text-white hover:text-blue-300"><Copy size={12}/></button></div><p className="text-[10px] font-medium text-slate-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{String(reportContent)}</p></div>
                )}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full -mr-10 -mt-10 blur-xl"></div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2"><ListTodo size={16} className="text-blue-500" /> Tareas Pendientes</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead><tr className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400"><th className="p-3 w-10">Est.</th><th className="p-3">Origen</th><th className="p-3">Tarea Asignada</th><th className="p-3">Responsable</th><th className="p-3">Acción / Vencimiento</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {allPendingTasks.map(tarea => {
                      const statusInfo = getTaskStatus(tarea.fechaCumplimiento);
                      return (
                        <tr key={tarea.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="p-3 text-slate-300"><button onClick={() => tarea.source === 'Caso' ? toggleTaskCompletion(tarea.parentId, tarea.id) : toggleDocTaskCompletion(tarea.parentId, tarea.id)} className="hover:text-emerald-500"><Square size={16} /></button></td>
                          <td className="p-3"><div className="text-[11px] font-black text-slate-800 flex items-center gap-2">{String(tarea.parentName)} {statusInfo.status === 'upcoming' && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[7px] uppercase animate-pulse">Próximo</span>} {statusInfo.status === 'overdue' && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[7px] uppercase">Vencida</span>}</div><div className="text-[8px] text-slate-400 mt-1 uppercase font-bold">{String(tarea.source)}</div></td>
                          <td className="p-3 text-xs font-medium text-slate-600">{String(tarea.descripcion)}</td>
                          <td className="p-3 text-[10px] font-bold text-slate-500">{String(tarea.responsable || 'No asignado')}</td>
                          <td className="p-3"><span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg flex items-center gap-1.5 w-fit ${statusInfo.bgClass}`}>{statusInfo.showWarning && <AlertTriangle size={10}/>}{String(tarea.fechaCumplimiento || 'Sin Fecha')}</span></td>
                        </tr>
                      );
                    })}
                    {allPendingTasks.length === 0 && (<tr><td colSpan="5" className="p-8 text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest">No hay tareas pendientes.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: ESTADÍSTICAS Y PLAZOS */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Estadísticas y Plazos</h2><p className="text-xs text-slate-500 font-medium mt-1">Análisis de respuesta en red</p></div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-4 flex items-center gap-2"><Target size={16} className="text-blue-600"/> Configuración de Plazos Meta</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <Lbl>Meta General por Defecto</Lbl>
                    <p className="text-[10px] text-slate-500 mb-4 font-medium">Aplica para dispositivos sin plazo específico.</p>
                    <div className="flex items-center gap-2">
                       {currentUser?.rol === 'Admin' ? (<input type="number" value={appConfig?.targetDays || 7} onChange={(e) => handleUpdateTarget(e.target.value)} className="w-24 p-3 bg-white border border-blue-100 rounded-xl text-center font-black text-blue-600 outline-none focus:border-blue-500 text-sm shadow-sm"/>) : (<span className="px-4 py-3 bg-white border border-slate-200 rounded-xl font-black text-blue-600 text-sm">{String(appConfig?.targetDays || 7)}</span>)}
                       <span className="text-[10px] font-black text-slate-500 uppercase">Días</span>
                    </div>
                  </div>
                  <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                    <label className="block text-[10px] font-black text-blue-800 uppercase tracking-widest mb-2">Metas por Dispositivo</label>
                    <p className="text-[10px] text-blue-600 mb-4 font-medium">Asigna plazos distintos según la realidad del centro.</p>
                    {currentUser?.rol === 'Admin' && (
                      <div className="flex gap-2 mb-4">
                        <input type="text" list="centros-list-plazos" value={plazoCentroInput} onChange={e=>setPlazoCentroInput(e.target.value)} placeholder="Centro..." className="flex-1 p-2.5 border border-white rounded-xl text-xs font-bold outline-none"/>
                        <datalist id="centros-list-plazos">{safeArr(centros).map(c=><option key={c} value={c}/>)}</datalist>
                        <input type="number" placeholder="Días" value={plazoDaysInput} onChange={e=>setPlazoDaysInput(e.target.value)} className="w-20 p-2.5 border border-white rounded-xl text-xs font-bold text-center outline-none"/>
                        <button onClick={handleAddPlazoCentro} className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700"><Plus size={16}/></button>
                      </div>
                    )}
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                      {Object.entries(appConfig?.plazos || {}).map(([centroStr, dias]) => (
                        <div key={centroStr} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-blue-50">
                           <span className="text-[10px] font-black text-slate-700 uppercase">{String(centroStr)}</span>
                           <div className="flex items-center gap-3"><span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{String(dias)} Días</span>{currentUser?.rol === 'Admin' && <button onClick={() => handleDeletePlazoCentro(centroStr)} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>}</div>
                        </div>
                      ))}
                    </div>
                  </div>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-l-[8px] border-l-indigo-500"><div className="flex justify-between mb-3"><div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Timer size={18}/></div></div><h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enlace Administrativo</h3><p className="text-4xl font-black text-slate-800 mt-1">{String(redMetrics.avgEnlace)} <span className="text-xs text-slate-300">Días</span></p></div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-l-[8px] border-l-blue-500"><div className="flex justify-between mb-3"><div className="p-2 bg-blue-50 rounded-xl text-blue-600"><BarChart3 size={18}/></div></div><h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ingreso Efectivo</h3><p className="text-4xl font-black text-slate-800 mt-1">{String(redMetrics.avgIngreso)} <span className="text-xs text-slate-300">Días</span></p></div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-l-[8px] border-l-red-500"><div className="flex justify-between mb-3"><div className="p-2 bg-red-50 rounded-xl text-red-600"><AlertTriangle size={18}/></div></div><h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Casos sobre meta</h3><p className="text-4xl font-black text-slate-800 mt-1">{String(redMetrics.fueraDePlazo)} <span className="text-xs text-slate-300">Casos</span></p></div>
            </div>
            {redMetrics.fueraDePlazo > 0 && currentUser?.rol === 'Admin' && (
              <div className="bg-gradient-to-br from-indigo-900 to-[#0a2540] rounded-2xl p-8 text-white shadow-xl">
                 <div className="flex justify-between items-center"><div className="max-w-2xl"><h3 className="text-lg font-black mb-2"><TrendingUp size={20} className="inline text-blue-400"/> Análisis Estratégico (IA)</h3></div><button onClick={() => handleGenerateReport('stats')} disabled={isGeneratingReport} className={clsBtnP}>{isGeneratingReport ? <Loader2 size={16} className="animate-spin"/> : <FileText size={16}/>} Procesar</button></div>
                 {reportContent && activeTab === 'stats' && (<div className="mt-6 bg-[#081b30] p-6 rounded-xl border border-white/10"><div className="flex justify-between mb-4"><span className="text-[9px] font-black uppercase text-blue-300">Borrador:</span><button onClick={()=>copyToClipboard(reportContent)} className="text-white hover:text-blue-300"><Copy size={14}/></button></div><p className="text-xs font-medium text-slate-300 whitespace-pre-wrap">{String(reportContent)}</p></div>)}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 3: CASOS DE RED */}
        {activeTab === 'cases' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div className="flex justify-between items-end"><div><h2 className="text-2xl font-black text-slate-800">Casos en Red</h2></div>
              <div className="flex gap-2">
                <button onClick={handleExportCSV} className={clsBtnS + " bg-emerald-100 hover:bg-emerald-200 text-emerald-700"}><Download size={14} className="inline mr-1"/> Exportar Excel</button>
                <button onClick={() => { setEditingCaseId(null); setCaseForm(defaultCaseState); setCaseSummary(''); setIsCaseModalOpen(true); }} className={clsBtnP}><Plus size={16}/> Nuevo Seguimiento</button>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-4 items-center">
              <div className="flex-1"><Lbl>Buscar Paciente</Lbl><Inp value={caseSearch} onChange={e=>setCaseSearch(e.target.value)} placeholder="RUT o Nombre..." className="py-2" /></div>
              <div className="w-64"><Lbl>Filtrar Dispositivo</Lbl><Sel value={caseFilterCentro} onChange={e=>setCaseFilterCentro(e.target.value)} className="py-2"><option value="Todos">Todos</option>{safeArr(centros).map(c=><option key={c} value={c}>{c}</option>)}</Sel></div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="bg-slate-50 border-b border-slate-100"><tr className="text-xs font-bold text-slate-500 uppercase tracking-wider"><th className="p-4">Paciente</th><th className="p-4">Ruta Traslado</th><th className="p-4 text-center">Hitos (A-B-C)</th><th className="p-4 text-center">Estado</th><th className="p-4 text-right">Acción</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredCases.map(c => {
                      const daysC = diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo);
                      const target = getTargetDaysForCase(c.destino);
                      const isOver = daysC !== null && daysC > target;
                      return (
                        <tr key={c.id} className={`hover:bg-slate-50/80 transition-colors ${isOver ? 'bg-red-50/20' : ''}`}>
                          <td className="p-4"><div className="font-bold text-slate-800 text-sm uppercase">{String(c.nombre)}</div><div className="text-xs text-slate-500 mt-1">{String(c.paciente)}</div></td>
                          <td className="p-4"><div className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg w-fit flex items-center gap-2 border border-blue-100">{String(c.origen)} <Timer size={14}/> {String(c.destino)}</div></td>
                          <td className="p-4"><div className="flex justify-center gap-6"><div className="text-center"><span className="text-[10px] font-bold text-slate-400 block uppercase">Egreso</span><span className="text-sm font-bold text-slate-700">{String(c.fechaEgreso || '---')}</span></div><div className="text-center border-l pl-6"><span className="text-[10px] font-bold text-indigo-400 block uppercase">Recep</span><span className="text-sm font-bold text-indigo-700">{String(c.fechaRecepcionRed || '---')}</span></div><div className="text-center border-l pl-6"><span className="text-[10px] font-bold text-green-500 block uppercase">Ingreso</span><span className={`text-sm font-bold ${isOver ? 'text-red-600' : 'text-green-600'}`}>{String(c.fechaIngresoEfectivo || '---')}</span></div></div></td>
                          <td className="p-4"><div className="flex justify-center"><StatusBadge status={c.estado}/></div></td>
                          <td className="p-4 text-right"><button onClick={() => { setEditingCaseId(c.id); setCaseForm({ ...c, rut: c.paciente, edad: c.edad||'', tutor: c.tutor || {nombre:'', relacion:'', telefono:''}, referentes: safeArr(c.referentes), archivos: safeArr(c.archivos), epicrisis: c.epicrisis || '' }); setCaseSummary(''); setIsCaseModalOpen(true); }} className="text-slate-400 hover:text-blue-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 hover:border-blue-200"><Edit2 size={18}/></button></td>
                        </tr>
                      );
                    })}
                    {filteredCases.length === 0 && (<tr><td colSpan="5" className="p-12 text-center"><p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No hay registros.</p></td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 4: PROTOCOLOS */}
        {activeTab === 'docs' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div className="flex justify-between items-end"><div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Normativas y Protocolos</h2></div><button onClick={() => { setEditingDocId(null); setDocForm({ nombre: '', ambito: 'Red Integral', fase: 'Levantamiento', avance: 10, notas: '', bitacora: [], archivos: [] }); setActiveDocModalTab('datos'); setIsDocModalOpen(true); }} className={clsBtnP}><Plus size={18}/> Nuevo Protocolo</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {safeArr(docs).map((d) => (
                <div key={d.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3"><span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{String(d.id)}</span>
                      <div className="flex gap-2"><button onClick={() => { setEditingDocId(d.id); setDocForm(d); setActiveDocModalTab('datos'); setIsDocModalOpen(true); }} className="text-slate-400 hover:text-blue-600 p-1.5 bg-slate-50 rounded-lg"><Edit2 size={14} /></button>{currentUser?.rol === 'Admin' && (<button onClick={async () => { if(window.confirm('¿Eliminar protocolo?')) await deleteFromCloud('docs', d.id); }} className="text-slate-400 hover:text-red-500 p-1.5 bg-slate-50 rounded-lg"><Trash2 size={14}/></button>)}</div>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-1">{String(d.nombre)}</h3><p className="text-[10px] font-bold text-slate-400 mb-4 uppercase">{String(d.ambito)} • {String(d.fase)}</p>
                  </div>
                  <div><div className="flex justify-between text-[9px] font-black uppercase mb-1.5 text-slate-400"><span>Avance Técnico</span><span>{String(d.avance)}%</span></div><div className="w-full bg-slate-100 rounded-full h-2.5"><div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${d.avance}%` }}></div></div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA 5 Y 6: AUDITORÍAS */}
        {(activeTab === 'auditorias' || activeTab === 'consultorias') && (() => {
          const tipoLabel = activeTab === 'auditorias' ? 'Auditoría' : 'Consultoría';
          const currentFilter = activeTab === 'auditorias' ? centroFilterAuditorias : centroFilterConsultorias;
          const setFilter = activeTab === 'auditorias' ? setCentroFilterAuditorias : setCentroFilterConsultorias;
          const filteredAudits = safeArr(visibleAudits).filter(a => a.tipo === tipoLabel && (currentFilter === 'Todos' || a.centro === currentFilter));

          return (
            <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
              <div className="flex justify-between items-end">
                <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">{tipoLabel === 'Auditoría' ? 'Auditorías Normativas' : 'Consultorías Clínicas'}</h2></div>
                <div className="flex gap-3">
                  <select value={currentFilter} onChange={e => setFilter(e.target.value)} className="px-3 py-2.5 border-2 border-slate-200 rounded-xl text-[10px] font-bold bg-white outline-none"><option value="Todos">Toda la Red</option>{centros.map(c => <option key={c} value={c}>{c}</option>)}</select>
                  {currentUser?.rol === 'Admin' && (<button onClick={() => { setEditingTemplateId(null); setTemplateForm({nombre: '', metodoCalculo: 'Suma Automática', instruccionesDiagnostico: '', encabezados: [{ id: 'enc_1', label: 'Centro Evaluado', type: 'text' }, { id: 'enc_2', label: 'Fecha', type: 'date' }], criterios: [{ id: 'crit_1', pregunta: '', opciones: 'SÍ=1, NO=0' }], rangos: [], tipo: 'Ambos'}); setIsTemplateModalOpen(true); }} className={clsBtnS}><Settings size={14} /> Pautas</button>)}
                  <button onClick={() => { setAuditForm({ centro: centros[0] || '', templateId: auditTemplates.find(t => t.tipo === 'Ambos' || t.tipo === tipoLabel)?.id || '', headerAnswers: {}, answers: {}, tipo: tipoLabel, observaciones: '', fecha: new Date().toISOString().split('T')[0], estadoManual: '' }); setIsAuditModalOpen(true); }} className={clsBtnP}><ClipboardCheck size={16} /> Evaluar</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAudits.map(a => {
                    const template = auditTemplates.find(t => t.id === a.templateId);
                    return (
                    <div key={a.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                       <div className="flex justify-between w-full">
                         <div>
                           <h3 className="font-black text-slate-800 uppercase text-xs mb-1">{String(a.centro)}</h3>
                           <p className="text-[9px] text-blue-600 font-black uppercase mb-2 bg-blue-50 px-2 py-0.5 rounded w-fit">{template ? String(template.nombre) : 'Pauta Eliminada'}</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase"><Calendar size={10} className="inline"/> {String(a.fecha)} • {String(a.evaluador)}</p>
                         </div>
                         <div className="text-right">
                            {a.cumplimiento !== undefined && <div className="text-3xl font-black text-slate-800">{String(a.cumplimiento)}%</div>}
                            <span className="text-[8px] uppercase text-slate-400 font-black block">{String(a.puntaje)}</span>
                            <span className="text-[8px] uppercase text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg font-black">{String(a.estado)}</span>
                         </div>
                       </div>
                       <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
                         {a.observaciones && <p className="text-[10px] text-slate-500 font-medium italic"><MessageSquare size={12} className="inline"/> {String(a.observaciones)}</p>}
                         <div className="flex justify-end gap-2 mt-2">
                           <button onClick={() => setPrintingAudit(a)} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-slate-200 flex items-center gap-1.5 transition-colors"><Printer size={12}/> Ver / Imprimir</button>
                           {currentUser?.rol === 'Admin' && (<button onClick={async () => { if(window.confirm('¿Eliminar evaluación?')) await deleteFromCloud('audits', a.id); }} className="bg-red-50 text-red-500 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-red-100 flex items-center gap-1.5 transition-colors"><Trash2 size={12}/> Eliminar</button>)}
                         </div>
                       </div>
                    </div>
                    );
                  })}
              </div>
            </div>
          );
        })()}

        {/* PESTAÑA 7: DIRECTORIO */}
        {activeTab === 'dir' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div className="flex justify-between items-end">
              <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Directorio Intersectorial</h2></div>
              <div className="flex gap-3 items-center w-full md:w-auto">
                <input type="text" value={dirSearch} onChange={e => setDirSearch(e.target.value)} className={clsInp} placeholder="Buscar contacto..."/>
                <button onClick={() => { setEditingDirId(null); setDirForm({ nombre: '', cargo: '', institucion: '', telefono: '', correo: '' }); setIsDirModalOpen(true); }} className={clsBtnP}><Plus size={16} /> Nuevo</button>
                {currentUser?.rol === 'Admin' && <button onClick={handleWipeDirectory} className="bg-red-50 text-red-500 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Trash2 size={14}/> Reset BDD</button>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {safeArr(directory).filter(d => {
                 if (!d) return false;
                 const search = String(dirSearch || '').toLowerCase();
                 return String(d.nombre||'').toLowerCase().includes(search) || String(d.institucion||'').toLowerCase().includes(search) || String(d.cargo||'').toLowerCase().includes(search);
              }).map((d, i) => (
                <div key={d.id || `dir-${i}`} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative group hover:border-blue-200 transition-colors">
                   <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                     <button onClick={() => { setEditingDirId(d.id); setDirForm(d); setIsDirModalOpen(true); }} className="p-1.5 bg-slate-50 hover:text-blue-600 rounded-lg"><Edit2 size={14}/></button>
                     <button onClick={() => deleteFromCloud('directory', d.id)} className="p-1.5 bg-slate-50 hover:text-red-600 rounded-lg"><Trash2 size={14}/></button>
                   </div>
                   <h3 className="font-black text-slate-800 text-base mb-1"><User size={16} className="inline text-blue-600 mr-1"/>{String(d.nombre || 'Sin nombre')}</h3>
                   <p className="text-[10px] text-indigo-600 font-black uppercase mb-3 ml-6">{String(d.cargo || '---')} • {String(d.institucion || '---')}</p>
                   <div className="space-y-0.5 ml-6"><p className="text-[10px] font-bold text-slate-500">{String(d.telefono || '')}</p><p className="text-[10px] font-bold text-slate-500">{String(d.correo || '')}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA 8: USUARIOS */}
        {activeTab === 'users' && currentUser?.rol === 'Admin' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div className="flex justify-between items-end"><div><h2 className="text-2xl font-black text-slate-800">Gestión de Usuarios</h2></div><button onClick={() => { setEditingUserId(null); setUserForm({ rut: '', nombre: '', iniciales: '', cargo: '', password: '', rol: 'Usuario', centrosAsignados: [] }); setIsUserModalOpen(true); }} className={clsBtnP}><UserPlus size={16} /> Crear Credencial</button></div>
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-slate-50 border-b"><tr className="text-[9px] font-black text-slate-400 uppercase"><th className="p-4">Profesional</th><th className="p-4">Rol</th><th className="p-4">Visibilidad</th><th className="p-4 text-right">Ajustes</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {safeArr(users).map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 font-black flex items-center justify-center">{String(u.iniciales)}</div><div><p className="font-black text-slate-800 text-xs uppercase">{String(u.nombre)}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{String(u.rut)} • {String(u.cargo)}</p></div></div></td>
                      <td className="p-4"><span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border shadow-sm ${u.rol === 'Admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-white text-slate-600 border-slate-200'}`}>{String(u.rol)}</span></td>
                      <td className="p-4 text-[9px] font-black uppercase">{u.rol === 'Admin' ? <span className="text-indigo-500">Acceso Total</span> : <div className="flex flex-wrap gap-1.5">{safeArr(u.centrosAsignados).map(c => <span key={c} className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{String(c)}</span>)}</div>}</td>
                      <td className="p-4 text-right"><button onClick={() => { setEditingUserId(u.id); setUserForm(u); setIsUserModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 bg-white border shadow-sm rounded-lg mr-1.5"><Edit2 size={14}/></button>{u.rol !== 'Admin' && <button onClick={() => deleteFromCloud('users', u.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white border shadow-sm rounded-lg"><Trash2 size={14}/></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PESTAÑA 9: CONFIGURACIÓN */}
        {activeTab === 'config' && currentUser?.rol === 'Admin' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <h2 className="text-2xl font-black text-slate-800">Configuración del Sistema</h2>
            <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-3xl">
               <h3 className="font-black text-slate-800 text-base mb-2"><Activity size={18} className="inline text-blue-600"/> Catálogo de Dispositivos</h3>
               <div className="flex gap-3 mb-6"><input type="text" value={newCentroName} onChange={e=>setNewCentroName(e.target.value)} className={clsInp}/><button onClick={async ()=>{if(newCentroName.trim()) { await saveToCloud('settings', 'centros', { list: [...safeArr(centros), newCentroName.trim()].sort() }); setNewCentroName(''); }}} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase"><Plus size={14}/> Añadir</button></div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{safeArr(centros).map(c => (<div key={c} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border group"><span className="text-[10px] font-black text-slate-700 uppercase">{String(c)}</span><button onClick={async ()=>{ if(window.confirm(`¿Eliminar ${c}?`)) await saveToCloud('settings', 'centros', { list: safeArr(centros).filter(x=>x!==c) }); }} className="text-slate-300 hover:text-red-600 p-1.5 bg-white rounded-lg opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button></div>))}</div>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-3xl mt-6">
               <h3 className="font-black text-slate-800 text-base mb-2"><ClipboardCheck size={18} className="inline text-blue-600"/> Pautas Digitalizadas</h3>
               <div className="space-y-3">
                 {safeArr(auditTemplates).map(t => (
                   <div key={t.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border">
                     <div><span className="text-xs font-black text-slate-700 uppercase block">{String(t.nombre)}</span><span className="text-[9px] font-bold text-slate-400 uppercase mt-1">{String(t.metodoCalculo || 'Suma Automática')} • {safeArr(t.criterios).length} Criterios</span></div>
                     <div className="flex gap-2"><button onClick={() => openTemplateEditor(t)} className="text-slate-400 hover:text-blue-600 p-2 bg-white rounded-lg"><Edit2 size={14}/></button><button onClick={async ()=>{ if(window.confirm(`¿Eliminar pauta ${t.nombre}?`)) await deleteFromCloud('auditTemplates', t.id); }} className="text-slate-400 hover:text-red-600 p-2 bg-white rounded-lg"><Trash2 size={14}/></button></div>
                   </div>
                 ))}
               </div>
               <button onClick={() => { setEditingTemplateId(null); setTemplateForm({nombre: '', metodoCalculo: 'Suma Automática', instruccionesDiagnostico: '', encabezados: [{ id: 'e1', label: 'Centro Evaluado', type: 'text' }, { id: 'e2', label: 'Fecha', type: 'date' }], criterios: [{ id: 'c1', pregunta: '', opciones: 'SÍ=1, NO=0' }], rangos: [], tipo: 'Ambos'}); setIsTemplateModalOpen(true); }} className={clsBtnP + " mt-4"}><Plus size={14}/> Crear Nueva Pauta</button>
            </div>
            <div className="mt-8 bg-indigo-50 p-8 rounded-2xl border border-indigo-100 max-w-3xl">
               <h3 className="font-bold text-indigo-900 text-sm mb-4"><Wand2 size={18} className="inline"/> Llave API de Google IA</h3>
               <div className="flex gap-4 items-center"><input type="password" value={apiConfigKey} onChange={e=>setApiConfigKey(e.target.value)} className={clsInp} placeholder="AIzaSyB..."/><button onClick={async ()=>{ await saveToCloud('settings', 'config', { ...appConfig, apiKey: apiConfigKey.trim() }); alert("Guardado!"); }} className={clsBtnP}>Guardar</button></div>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODALES COMPLETOS ================= */}
      <ModalWrap isOpen={isCaseModalOpen}>
        <ModalHdr t={editingCaseId ? `Editar: ${caseForm.nombre}` : 'Nuevo Seguimiento'} onClose={()=>setIsCaseModalOpen(false)} icon={Users} />
        <div className="flex bg-slate-50 border-b shrink-0 px-6">
          <button onClick={() => setActiveModalTab('datos')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 ${activeModalTab === 'datos' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Datos Básicos</button>
          <button onClick={() => setActiveModalTab('bitacora')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 ${activeModalTab === 'bitacora' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Bitácora</button>
          <button onClick={() => setActiveModalTab('archivos')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 ${activeModalTab === 'archivos' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Epicrisis y Archivos</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 bg-white">
            {activeModalTab === 'datos' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div><Lbl>RUT</Lbl><Inp type="text" value={caseForm.rut} onChange={e=>setCaseForm({...caseForm, rut: e.target.value})}/></div>
                  <div><Lbl>Nombre Paciente</Lbl><Inp type="text" value={caseForm.nombre} onChange={e=>setCaseForm({...caseForm, nombre: e.target.value})}/></div>
                  <div><Lbl>Edad</Lbl><Inp type="number" value={caseForm.edad || ''} onChange={e=>setCaseForm({...caseForm, edad: e.target.value})} placeholder="Ej: 15" /></div>
                  <div><Lbl>Estado</Lbl><Sel value={caseForm.estado} onChange={e=>setCaseForm({...caseForm, estado: e.target.value})}><option>Pendiente</option><option>Concretado</option><option>Alerta</option></Sel></div>
                  <div><Lbl>Fecha Egreso</Lbl><Inp type="date" value={caseForm.fechaEgreso} onChange={e=>setCaseForm({...caseForm, fechaEgreso: e.target.value})}/></div>
                  <div><Lbl>Ingreso Efectivo</Lbl><Inp type="date" value={caseForm.fechaIngresoEfectivo} onChange={e=>setCaseForm({...caseForm, fechaIngresoEfectivo: e.target.value})}/></div>
                  
                  <div>
                    <Lbl>Origen</Lbl>
                    <Inp list="centros-list" value={caseForm.origen} onChange={e=>setCaseForm({...caseForm, origen: e.target.value})} placeholder="Escriba o seleccione..."/>
                  </div>
                  <div>
                    <Lbl>Destino</Lbl>
                    <Inp list="centros-list" value={caseForm.destino} onChange={e=>setCaseForm({...caseForm, destino: e.target.value})} placeholder="Escriba o seleccione..."/>
                  </div>
                  <datalist id="centros-list">{safeArr(centros).map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="mt-4 border-t pt-4">
                  <Lbl>Tutor Legal / Familiar</Lbl>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <Inp value={caseForm.tutor?.nombre||''} onChange={e=>setCaseForm({...caseForm, tutor: {...caseForm.tutor, nombre: e.target.value}})} placeholder="Nombre"/>
                    <Inp value={caseForm.tutor?.relacion||''} onChange={e=>setCaseForm({...caseForm, tutor: {...caseForm.tutor, relacion: e.target.value}})} placeholder="Parentesco"/>
                    <Inp value={caseForm.tutor?.telefono||''} onChange={e=>setCaseForm({...caseForm, tutor: {...caseForm.tutor, telefono: e.target.value}})} placeholder="Teléfono"/>
                  </div>
                  <Lbl>Referentes Clínicos</Lbl>
                  {safeArr(caseForm.referentes).map((ref, i) => (
                     <div key={i} className="flex gap-2 mb-2">
                       <Inp value={ref.nombre} onChange={e=>{const r=[...safeArr(caseForm.referentes)]; r[i].nombre=e.target.value; setCaseForm({...caseForm, referentes: r})}} placeholder="Nombre"/>
                       <Inp value={ref.dispositivo} onChange={e=>{const r=[...safeArr(caseForm.referentes)]; r[i].dispositivo=e.target.value; setCaseForm({...caseForm, referentes: r})}} placeholder="Dispositivo"/>
                       <Inp value={ref.contacto} onChange={e=>{const r=[...safeArr(caseForm.referentes)]; r[i].contacto=e.target.value; setCaseForm({...caseForm, referentes: r})}} placeholder="Contacto"/>
                       <button onClick={()=>{const r=[...safeArr(caseForm.referentes)]; r.splice(i,1); setCaseForm({...caseForm, referentes: r})}} className="p-3 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"><Trash2 size={16}/></button>
                     </div>
                  ))}
                  <button onClick={()=>setCaseForm({...caseForm, referentes: [...safeArr(caseForm.referentes), {nombre:'', dispositivo:'', contacto:''}]})} className="text-[10px] text-blue-600 font-black uppercase mt-2 p-2 hover:bg-blue-50 rounded-lg"><Plus size={12} className="inline"/> Añadir Referente</button>
                </div>
              </div>
            )}
            {activeModalTab === 'bitacora' && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl grid grid-cols-4 gap-3">
                   <Sel value={newBitacoraEntry.tipo} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, tipo: e.target.value})}>
                     <option value="Nota Adm.">📝 Nota Adm.</option>
                     <option value="Intervención">🗣️ Intervención</option>
                     <option value="Reunión">🤝 Reunión de Red</option>
                     <option value="Tarea">🎯 Tarea Enlace</option>
                   </Sel>
                   <Inp value={newBitacoraEntry.responsable} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, responsable: e.target.value})} placeholder="Resp..." />
                   <Txt rows="2" value={newBitacoraEntry.descripcion} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, descripcion: e.target.value})} placeholder="Detalle de la acción o acuerdo..." className="col-span-2" />
                   {newBitacoraEntry.tipo === 'Tarea' && <Inp type="date" value={newBitacoraEntry.fechaCumplimiento} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, fechaCumplimiento: e.target.value})} className="col-span-4 bg-amber-50" />}
                   <button onClick={handleAddBitacora} className={clsBtnP + " col-span-4"}>Añadir Registro</button>
                </div>
                {safeArr(caseForm.bitacora).map(b => <div key={b.id} className="p-4 border rounded-xl flex justify-between"><div className="flex-1"><p className="text-sm font-bold whitespace-pre-wrap">{String(b.descripcion)}</p><p className="text-[10px] text-slate-400 mt-1 uppercase">{String(b.tipo)} | {String(b.fecha)} | Resp: {String(b.responsable)}</p></div><button onClick={() => setCaseForm({ ...caseForm, bitacora: safeArr(caseForm.bitacora).filter(x => x.id !== b.id) })} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></div>)}
              </div>
            )}
            {activeModalTab === 'archivos' && (
              <div className="space-y-4">
                 <div className="bg-indigo-50 p-4 rounded-xl text-center mb-4">
                   <label className="cursor-pointer block text-indigo-700 font-black text-xs uppercase"><UploadCloud size={20} className="mx-auto mb-1"/> Subir Archivo de Respaldo / Link Drive
                   <div className="flex gap-2 mt-3 items-center px-4">
                     <Inp type="text" value={newCaseLink?.nombre || ''} onChange={e=>setNewCaseLink({...newCaseLink, nombre: e.target.value})} placeholder="Nombre del archivo..." className="flex-1 text-xs py-2"/>
                     <Inp type="text" value={newCaseLink?.url || ''} onChange={e=>setNewCaseLink({...newCaseLink, url: e.target.value})} placeholder="Pegar enlace de Google Drive..." className="flex-1 text-xs py-2"/>
                     <button onClick={(e) => {
                       e.preventDefault();
                       if (!newCaseLink.nombre || !newCaseLink.url) return alert("Ingresa nombre y enlace");
                       setCaseForm(p=>({...p, archivos: [{id: Date.now().toString(), nombre: newCaseLink.nombre, size: 'Enlace Externo', fecha: new Date().toISOString().split('T')[0], url: newCaseLink.url}, ...safeArr(p.archivos)]}));
                       setNewCaseLink({nombre:'', url:''});
                     }} className="bg-indigo-600 text-white p-2 rounded-lg"><Plus size={16}/></button>
                   </div>
                   </label>
                 </div>
                 {safeArr(caseForm.archivos).map(f => (
                   <div key={f.id} className="flex justify-between items-center p-3 bg-white border rounded-xl">
                      <span className="text-xs font-bold">{f.nombre} <span className="text-[9px] text-slate-400 ml-2">{f.size}</span></span>
                      <div className="flex gap-2 items-center">
                        {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1"><ExternalLink size={12}/> Abrir</a>}
                        {currentUser?.rol === 'Admin' && <button onClick={()=>setCaseForm(p=>({...p, archivos: p.archivos.filter(a=>a.id!==f.id)}))} className="text-red-400 p-1 hover:bg-red-50 rounded"><Trash2 size={14}/></button>}
                      </div>
                   </div>
                 ))}
                 <Lbl>Epicrisis / Resumen General</Lbl><Txt value={caseForm.epicrisis || ''} onChange={e=>setCaseForm({...caseForm, epicrisis: e.target.value})} className="min-h-[140px]"/>
                 <div className="flex justify-between items-center"><Lbl>Resumen IA</Lbl>{currentUser?.rol === 'Admin' && <button onClick={handleGenerateCaseSummary} disabled={isGeneratingCaseSummary} className={clsBtnP}>Generar</button>}</div>
                 {caseSummary && currentUser?.rol === 'Admin' && <div className="p-4 bg-indigo-50 rounded-xl whitespace-pre-wrap text-sm">{String(caseSummary)}</div>}
              </div>
            )}
        </div>
        <ModalFtr onCancel={()=>setIsCaseModalOpen(false)} onSave={handleSaveCase} />
      </ModalWrap>

      <ModalWrap isOpen={isDocModalOpen}>
        <ModalHdr t={editingDocId ? 'Editar Protocolo' : 'Nuevo Protocolo'} onClose={()=>setIsDocModalOpen(false)} icon={FileText} />
        <div className="flex bg-slate-50 border-b shrink-0 px-6">
          <button onClick={() => setActiveDocModalTab('datos')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 ${activeDocModalTab === 'datos' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Datos</button>
          <button onClick={() => setActiveDocModalTab('bitacora')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 ${activeDocModalTab === 'bitacora' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Tareas</button>
          <button onClick={() => setActiveDocModalTab('archivos')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 ${activeDocModalTab === 'archivos' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Archivos</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 bg-white space-y-6">
          {activeDocModalTab === 'datos' && (
            <div className="space-y-4">
              <div><Lbl>Nombre</Lbl><Inp value={docForm.nombre} onChange={e=>setDocForm({...docForm, nombre: e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Lbl>Ámbito</Lbl><Inp list="ambitos-list" value={docForm.ambito} onChange={e=>setDocForm({...docForm, ambito: e.target.value})}/></div>
                <div><Lbl>Fase</Lbl><Sel value={docForm.fase} onChange={e=>setDocForm({...docForm, fase: e.target.value})}><option>Levantamiento</option><option>Validación Técnica</option><option>Resolución Exenta</option><option>Difusión</option></Sel></div>
              </div>
              <div><Lbl>Notas y Observaciones Generales</Lbl><Txt rows="3" value={docForm.notas || ''} onChange={e=>setDocForm({...docForm, notas: e.target.value})} placeholder="Apuntes o ideas principales..." /></div>
              <div><Lbl>Avance: {docForm.avance}%</Lbl><input type="range" min="0" max="100" step="5" value={docForm.avance} onChange={e=>setDocForm({...docForm, avance: e.target.value})} className="w-full" /></div>
            </div>
          )}
          {activeDocModalTab === 'bitacora' && (
             <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl grid grid-cols-2 gap-3"><Inp value={newDocBitacoraEntry.responsable} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, responsable: e.target.value})} placeholder="Resp..." /><Inp type="date" value={newDocBitacoraEntry.fechaCumplimiento} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, fechaCumplimiento: e.target.value})} /><Txt rows="1" value={newDocBitacoraEntry.descripcion} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, descripcion: e.target.value})} placeholder="Tarea..." className="col-span-2"/><button onClick={handleAddDocBitacora} className={clsBtnP + " col-span-2"}>Añadir Tarea</button></div>
                {safeArr(docForm.bitacora).map(b => <div key={b.id} className="p-4 border rounded-xl flex justify-between"><p className="text-sm font-bold">{String(b.descripcion)}</p><button onClick={() => setDocForm({ ...docForm, bitacora: safeArr(docForm.bitacora).filter(x => x.id !== b.id) })} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></div>)}
             </div>
          )}
          {activeDocModalTab === 'archivos' && (
            <div className="space-y-4">
               <div className="bg-indigo-50 p-4 rounded-xl text-center mb-4">
                 <label className="cursor-pointer block text-indigo-700 font-black text-xs uppercase"><UploadCloud size={20} className="mx-auto mb-1"/> Subir Insumo o Enlace Externo
                   <div className="flex gap-2 mt-3 items-center px-4">
                     <Inp type="text" value={newDocLink?.nombre || ''} onChange={e=>setNewDocLink({...newDocLink, nombre: e.target.value})} placeholder="Nombre del archivo..." className="flex-1 text-xs py-2"/>
                     <Inp type="text" value={newDocLink?.url || ''} onChange={e=>setNewDocLink({...newDocLink, url: e.target.value})} placeholder="Pegar enlace de Google Drive..." className="flex-1 text-xs py-2"/>
                     <button onClick={(e) => {
                       e.preventDefault();
                       if (!newDocLink.nombre || !newDocLink.url) return alert("Ingresa nombre y enlace");
                       setDocForm(p=>({...p, archivos: [{id: Date.now().toString(), nombre: newDocLink.nombre, size: 'Enlace Externo', fecha: new Date().toISOString().split('T')[0], url: newDocLink.url}, ...safeArr(p.archivos)]}));
                       setNewDocLink({nombre:'', url:''});
                     }} className="bg-indigo-600 text-white p-2 rounded-lg"><Plus size={16}/></button>
                   </div>
                 </label>
               </div>
               {safeArr(docForm.archivos).map(f => (
                 <div key={f.id} className="flex justify-between items-center p-3 bg-white border rounded-xl">
                    <span className="text-xs font-bold">{f.nombre} <span className="text-[9px] text-slate-400 ml-2">{f.size}</span></span>
                    <div className="flex gap-2 items-center">
                      {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1"><ExternalLink size={12}/> Abrir</a>}
                      {currentUser?.rol === 'Admin' && <button onClick={()=>setDocForm(p=>({...p, archivos: p.archivos.filter(a=>a.id!==f.id)}))} className="text-red-400 p-1 hover:bg-red-50 rounded"><Trash2 size={14}/></button>}
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>
        <ModalFtr onCancel={()=>setIsDocModalOpen(false)} onSave={handleSaveDoc} />
      </ModalWrap>

      <ModalWrap isOpen={isTemplateModalOpen} mw="max-w-5xl">
        <ModalHdr t={editingTemplateId ? 'Editar Formulario' : 'Diseñador de Pautas'} onClose={()=>setIsTemplateModalOpen(false)} icon={Settings} />
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-50 grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 text-center">
                <h4 className="text-[11px] font-black text-indigo-900 uppercase tracking-widest mb-3"><Wand2 size={16} className="inline mr-2"/> Carga IA</h4>
                <label className="flex items-center justify-center w-full h-12 border-2 border-indigo-300 border-dashed rounded-xl cursor-pointer bg-white mb-2"><span className="text-[9px] font-black uppercase text-indigo-700">Subir PDF</span><input type="file" className="hidden" accept=".pdf" onChange={handlePdfUploadForAI} /></label>
                <Txt value={rawTextForAI} onChange={e=>setRawTextForAI(e.target.value)} className="mb-2 text-xs min-h-[60px]" placeholder="O pega el texto..." />
                <button onClick={handleProcessRawTextForAI} disabled={!rawTextForAI.trim() || isDigitizing} className="w-full bg-indigo-600 text-white py-3 rounded-xl text-[10px] font-black uppercase">{isDigitizing ? 'Procesando...' : 'Generar'}</button>
              </div>
              <div className="bg-white p-5 border border-slate-200 rounded-2xl">
                <Lbl>Nombre del Instrumento</Lbl><Inp value={templateForm.nombre} onChange={e=>setTemplateForm({...templateForm, nombre: e.target.value})}/>
                <Lbl className="mt-4">Método de Evaluación</Lbl>
                <Sel value={templateForm.metodoCalculo || 'Suma Automática'} onChange={e=>setTemplateForm({...templateForm, metodoCalculo: e.target.value})}>
                  <option value="Suma Automática">Suma Automática</option><option value="Juicio Clínico">Juicio Clínico</option>
                </Sel>
                {templateForm.metodoCalculo === 'Juicio Clínico' && (
                  <div className="mt-3"><Lbl className="text-amber-600">Instrucciones</Lbl><Txt value={templateForm.instruccionesDiagnostico || ''} onChange={e=>setTemplateForm({...templateForm, instruccionesDiagnostico: e.target.value})} className="bg-amber-50 border-amber-200 text-xs"/></div>
                )}
              </div>
            </div>
            <div className="lg:col-span-3 flex flex-col gap-6">
              <div className="bg-white p-5 border border-slate-200 rounded-2xl">
                <Lbl className="bg-slate-50 p-2 rounded-lg">1. Encabezados</Lbl>
                {safeArr(templateForm.encabezados).map((h, i) => (
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <Inp value={h.label} onChange={e=>{const n=[...safeArr(templateForm.encabezados)]; n[i].label=e.target.value; setTemplateForm({...templateForm, encabezados: n});}} placeholder="Nombre Campo"/>
                    <Sel value={h.type} onChange={e=>{const n=[...safeArr(templateForm.encabezados)]; n[i].type=e.target.value; setTemplateForm({...templateForm, encabezados: n});}} className="w-32"><option value="text">Texto</option><option value="date">Fecha</option></Sel>
                    <button onClick={()=>{const n=[...safeArr(templateForm.encabezados)]; n.splice(i,1); setTemplateForm({...templateForm, encabezados: n});}} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={16}/></button>
                  </div>
                ))}
                <button onClick={()=>setTemplateForm({...templateForm, encabezados: [...safeArr(templateForm.encabezados), {id: `enc_${Date.now()}`, label: '', type: 'text'}]})} className="text-[9px] text-slate-500 font-black uppercase mt-2 hover:bg-slate-50 p-2 rounded-lg"><Plus size={12} className="inline"/> Campo Extra</button>
              </div>
              <div className="bg-white p-5 border border-slate-200 rounded-2xl flex-1">
                <Lbl className="bg-slate-50 p-2 rounded-lg">2. Criterios</Lbl>
                <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
                  {safeArr(templateForm.criterios).map((c, i) => (
                    <div key={i} className="p-4 border-2 border-slate-100 rounded-xl bg-slate-50 relative group">
                      <button onClick={()=>{const newC=[...safeArr(templateForm.criterios)]; newC.splice(i,1); setTemplateForm({...templateForm, criterios: newC});}} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                      <Txt rows="2" value={c.pregunta} onChange={e=>{const newC=[...safeArr(templateForm.criterios)]; newC[i].pregunta=e.target.value; setTemplateForm({...templateForm, criterios: newC});}} className="mb-2 text-xs" placeholder="Criterio a evaluar..." />
                      <Inp value={c.opciones} onChange={e=>{const newC=[...safeArr(templateForm.criterios)]; newC[i].opciones=e.target.value; setTemplateForm({...templateForm, criterios: newC});}} placeholder="Ej: SÍ=1, NO=0" className="text-xs"/>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setTemplateForm({...templateForm, criterios: [...safeArr(templateForm.criterios), {id: `crit_${Date.now()}`, pregunta: '', opciones: 'SÍ=1, NO=0'}]})} className="text-[10px] text-indigo-600 font-black uppercase mt-4 hover:bg-indigo-50 p-2 rounded-lg"><Plus size={14} className="inline"/> Fila Manual</button>
              </div>
            </div>
        </div>
        <ModalFtr onCancel={()=>setIsTemplateModalOpen(false)} onSave={handleSaveTemplate} />
      </ModalWrap>

      <ModalWrap isOpen={isAuditModalOpen}>
         <ModalHdr t="Evaluar" onClose={()=>setIsAuditModalOpen(false)} icon={ClipboardCheck} />
         <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 bg-slate-50">
            <Sel value={auditForm.templateId} onChange={e=>setAuditForm({...auditForm, templateId: e.target.value, answers: {}, headerAnswers: {}})}>
              <option value="">Seleccione formulario...</option>
              {safeArr(auditTemplates).map(t => <option key={t.id} value={t.id}>{String(t.nombre)}</option>)}
            </Sel>
            {auditForm.templateId && (() => {
              const tpl = safeArr(auditTemplates).find(t => t.id === auditForm.templateId);
              if (!tpl) return null;
              return (
                <div className="space-y-6">
                   {safeArr(tpl.encabezados).length > 0 && (
                     <div className="bg-white p-6 rounded-2xl border shadow-sm grid grid-cols-2 gap-4">
                       {safeArr(tpl.encabezados).map(h => (
                         <div key={h.id}><Lbl>{String(h.label)}</Lbl><Inp type={h.type} value={auditForm.headerAnswers[h.id] || ''} onChange={e=>setAuditForm({...auditForm, headerAnswers: {...auditForm.headerAnswers, [h.id]: e.target.value}})} /></div>
                       ))}
                       <div className="col-span-2"><Lbl>Dispositivo Evaluado</Lbl><Sel value={auditForm.centro} onChange={e=>setAuditForm({...auditForm, centro: e.target.value})}><option value="">Seleccione...</option>{safeArr(centros).map(c=><option key={c} value={c}>{String(c)}</option>)}</Sel></div>
                     </div>
                   )}
                   <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-3">
                     {safeArr(tpl.criterios).map((c, idx) => {
                       const cId = c.id || idx;
                       const ops = parseOpciones(c.opciones || 'SÍ=1, NO=0');
                       return (
                         <div key={cId} className="p-4 bg-slate-50 rounded-xl border flex flex-col gap-2">
                           <span className="font-bold text-sm">{idx + 1}. {String(c.pregunta)}</span>
                           <div className="flex flex-wrap gap-2">
                             {ops.map((opt, i) => (
                               <label key={i} className={`px-4 py-2 rounded-xl cursor-pointer font-black text-[10px] uppercase border-2 ${auditForm.answers[cId]?.label === opt.label ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-white text-slate-500 border-transparent hover:bg-slate-100'}`}>
                                 <input type="radio" checked={auditForm.answers[cId]?.label === opt.label} onChange={() => setAuditForm({...auditForm, answers: {...auditForm.answers, [cId]: opt}})} className="hidden" />{String(opt.label)}
                               </label>
                             ))}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                   {tpl.metodoCalculo === 'Juicio Clínico' && (
                     <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200">
                       <Lbl className="text-amber-800">Resultado Clínico Final</Lbl>
                       <p className="text-xs text-amber-700 mb-4">{tpl.instruccionesDiagnostico}</p>
                       <Sel value={auditForm.estadoManual || ''} onChange={e=>setAuditForm({...auditForm, estadoManual: e.target.value})} className="border-amber-300">
                          <option value="">Seleccione...</option><option value="Riesgo Bajo">Riesgo Bajo</option><option value="Riesgo Medio">Riesgo Medio</option><option value="Riesgo Alto">Riesgo Alto</option><option value="Óptimo">Óptimo</option>
                       </Sel>
                     </div>
                   )}
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

      <ModalWrap isOpen={isUserModalOpen} mw="max-w-lg">
        <ModalHdr t="Usuario" onClose={()=>setIsUserModalOpen(false)} icon={UserPlus}/>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4"><Inp value={userForm.rut} onChange={e=>setUserForm({...userForm, rut: e.target.value})} placeholder="RUT"/><Inp value={userForm.password} onChange={e=>setUserForm({...userForm, password: e.target.value})} placeholder="Clave"/></div>
          <div className="grid grid-cols-4 gap-4"><Inp value={userForm.nombre} onChange={e=>setUserForm({...userForm, nombre: e.target.value})} placeholder="Nombre" className="col-span-3"/><Inp value={userForm.iniciales} onChange={e=>setUserForm({...userForm, iniciales: e.target.value.toUpperCase()})} placeholder="INI" maxLength={3}/></div>
          <div><Lbl>Rol</Lbl><Sel value={userForm.rol} onChange={e=>setUserForm({...userForm, rol: e.target.value})}><option>Usuario</option><option>Admin</option></Sel></div>
        </div>
        <ModalFtr onCancel={()=>setIsUserModalOpen(false)} onSave={handleSaveUser} />
      </ModalWrap>
      
      <ModalWrap isOpen={isProfileModalOpen} mw="max-w-sm">
        <ModalHdr t="Seguridad" onClose={()=>setIsProfileModalOpen(false)} icon={Key}/>
        <div className="p-6 space-y-4">
          <div><Lbl>Clave Actual</Lbl><Inp type="password" value={passwordForm.current} onChange={e=>setPasswordForm({...passwordForm, current: e.target.value})}/></div>
          <div><Lbl>Nueva Clave</Lbl><Inp type="password" value={passwordForm.new} onChange={e=>setPasswordForm({...passwordForm, new: e.target.value})}/></div>
          <div><Lbl>Repetir Clave</Lbl><Inp type="password" value={passwordForm.confirm} onChange={e=>setPasswordForm({...passwordForm, confirm: e.target.value})}/></div>
        </div>
        <ModalFtr onCancel={()=>setIsProfileModalOpen(false)} onSave={handleUpdatePassword} saveTxt="Actualizar" />
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