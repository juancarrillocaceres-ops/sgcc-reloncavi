import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, Users, FileText, AlertTriangle, CheckCircle, Clock, Plus, Activity, LogOut,
  Bell, Copy, Loader2, Edit2, Trash2, ListTodo, MessageSquare, CheckSquare, Square, Calendar,
  UploadCloud, Paperclip, File as FileIcon, Lock, User, ClipboardCheck, BookOpen, Download,
  Wand2, GitCommit, Search, Settings, Filter, UserPlus, Shield, Key, Timer, TrendingUp, BarChart3, Target
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
const appId = typeof __app_id !== 'undefined' ? __app_id : "sgcc-reloncavi-v1";

// --- UTILIDADES ---
const diffInDays = (d1, d2) => {
  if (!d1 || !d2) return null;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  const diff = Math.abs(date2 - date1);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const getTaskStatus = (fecha) => {
  if (!fecha) return { status: 'none', bgClass: 'bg-slate-100 text-slate-700', textClass: 'text-slate-500', showWarning: false };
  const [y, m, d] = fecha.split('-');
  const taskDate = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0,0,0,0);
  const diffDays = Math.ceil((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { status: 'overdue', bgClass: 'bg-red-100 text-red-800', textClass: 'text-red-600', showWarning: true };
  if (diffDays <= 10) return { status: 'upcoming', bgClass: 'bg-amber-100 text-amber-800', textClass: 'text-amber-600', showWarning: true };
  return { status: 'safe', bgClass: 'bg-emerald-100 text-emerald-800', textClass: 'text-emerald-600', showWarning: false };
};

// --- ACTUALIZADO: REPARACIÓN IA PARA RECIBIR LA LLAVE DE PRODUCCIÓN ---
const generateTextWithRetry = async (activeApiKey, prompt, systemInstruction = "", inlineData = null, retries = 5) => {
  if (!activeApiKey) throw new Error("Falta configurar la Clave de API de IA");
  
  const delays = [1000, 2000, 4000, 8000, 16000];
  const parts = [{ text: prompt }];
  if (inlineData) parts.push({ inlineData });
  const payload = { contents: [{ parts }] };
  if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeApiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
        return result.candidates[0].content.parts[0].text;
      } else {
        throw new Error("Respuesta vacía o bloqueada por seguridad de la IA");
      }
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

const ambitosProtocolo = ['Red Integral', 'Hospitalario', 'COSAM', 'APS'];

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ rut: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // --- ESTADOS DE LA BASE DE DATOS ---
  const [centros, setCentros] = useState([]);
  const [cases, setCases] = useState([]);
  const [docs, setDocs] = useState([]);
  const [audits, setAudits] = useState([]);
  const [auditTemplates, setAuditTemplates] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [appConfig, setAppConfig] = useState({ targetDays: 7, apiKey: '' });
  const [apiConfigKey, setApiConfigKey] = useState('');
  const [newCentroName, setNewCentroName] = useState('');

  // --- ESTADOS DE MODALES Y FORMULARIOS ---
  const defaultCaseState = { 
    rut: '', nombre: '', edad: '', origen: '', destino: '', prioridad: 'Media', estado: 'Pendiente', 
    fechaEgreso: new Date().toISOString().split('T')[0], fechaRecepcionRed: '', fechaIngresoEfectivo: '',
    tutor: { nombre: '', relacion: '', telefono: '' }, referentes: [], bitacora: [], documentos: [] 
  };
  const [editingCaseId, setEditingCaseId] = useState(null);
  const [caseForm, setCaseForm] = useState(defaultCaseState);
  const [activeModalTab, setActiveModalTab] = useState('datos');
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [newBitacoraEntry, setNewBitacoraEntry] = useState({ tipo: 'Nota Adm.', descripcion: '', responsable: '', fechaCumplimiento: '' });

  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [docForm, setDocForm] = useState({ nombre: '', ambito: ambitosProtocolo[0], fase: 'Levantamiento', avance: 10, notas: '', bitacora: [], archivos: [] });
  const [activeDocModalTab, setActiveDocModalTab] = useState('datos');
  const [newDocBitacoraEntry, setNewDocBitacoraEntry] = useState({ tipo: 'Tarea', descripcion: '', responsable: '', fechaCumplimiento: '' });

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [auditForm, setAuditForm] = useState({ centro: '', templateId: '', answers: {}, tipo: 'Auditoría' });
  const [templateForm, setTemplateForm] = useState({ nombre: '', criterios: [''], rangos: [], tipo: 'Ambos' });
  const [rawTextForAI, setRawTextForAI] = useState('');
  const [centroFilterAuditorias, setCentroFilterAuditorias] = useState('Todos');
  const [centroFilterConsultorias, setCentroFilterConsultorias] = useState('Todos');
  const [isDigitizing, setIsDigitizing] = useState(false);

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

  // --- ESTADOS IA ---
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isGeneratingCaseSummary, setIsGeneratingCaseSummary] = useState(false);
  const [caseSummary, setCaseSummary] = useState('');

  // --- EFECTOS DE FIREBASE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.warn("Aviso Auth", e.message); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubCases = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'cases'), snap => setCases(snap.docs.map(d => d.data())), console.error);
    const unsubDocs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'docs'), snap => setDocs(snap.docs.map(d => d.data())), console.error);
    const unsubAudits = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'audits'), snap => setAudits(snap.docs.map(d => d.data())), console.error);
    const unsubTemplates = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'auditTemplates'), snap => setAuditTemplates(snap.docs.map(d => d.data())), console.error);
    const unsubDir = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'directory'), snap => setDirectory(snap.docs.map(d => d.data())), console.error);
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), snap => setUsers(snap.docs.map(d => d.data())), console.error);
    const unsubCentros = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'centros'), snap => { if (snap.exists() && snap.data().list) setCentros(snap.data().list); }, console.error);
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), snap => { 
      if (snap.exists()) {
        const data = snap.data();
        setAppConfig(data);
        if (data.apiKey) setApiConfigKey(data.apiKey);
      } 
    }, console.error);

    return () => { unsubCases(); unsubDocs(); unsubAudits(); unsubTemplates(); unsubDir(); unsubUsers(); unsubCentros(); unsubConfig(); };
  }, [firebaseUser]);

  const saveToCloud = async (coll, id, data) => { if (firebaseUser) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id.toString()), data); };
  const deleteFromCloud = async (coll, id) => { if (firebaseUser) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id.toString())); };

  // --- DERIVADOS Y FILTROS ---
  const visibleCases = useMemo(() => {
    if (currentUser?.rol === 'Admin') return cases;
    return cases.filter(c => currentUser?.centrosAsignados?.includes(c.origen) || currentUser?.centrosAsignados?.includes(c.destino));
  }, [cases, currentUser]);

  const visibleAudits = useMemo(() => {
    if (currentUser?.rol === 'Admin') return audits;
    return audits.filter(a => currentUser?.centrosAsignados?.includes(a.centro));
  }, [audits, currentUser]);

  const alertCases = visibleCases.filter(c => c.estado === 'Alerta');

  const allPendingTasks = useMemo(() => {
    return [
      ...visibleCases.flatMap(c => (c.bitacora || []).filter(b => b.tipo === 'Tarea' && !b.completada).map(b => ({ ...b, parentId: c.id, parentName: c.nombre || c.paciente, source: 'Caso' }))),
      ...docs.flatMap(d => (d.bitacora || []).filter(b => b.tipo === 'Tarea' && !b.completada).map(b => ({ ...b, parentId: d.id, parentName: d.nombre, source: 'Protocolo' })))
    ].sort((a, b) => (a.fechaCumplimiento || '9999-99-99').localeCompare(b.fechaCumplimiento || '9999-99-99'));
  }, [visibleCases, docs]);

  const tareasCriticas = allPendingTasks.filter(t => getTaskStatus(t.fechaCumplimiento).status === 'upcoming' || getTaskStatus(t.fechaCumplimiento).status === 'overdue').length;

  const notifications = useMemo(() => {
    return [
      ...alertCases.map(c => ({ id: `alert-${c.id}`, type: 'alerta', title: 'Pérdida de Enlace', desc: `Paciente ${c.nombre} no se ha presentado en ${c.destino}.` })),
      ...allPendingTasks.filter(t => getTaskStatus(t.fechaCumplimiento).status !== 'safe').map(t => {
         const s = getTaskStatus(t.fechaCumplimiento);
         return { id: `task-${t.id}`, type: s.status, title: s.status === 'overdue' ? 'Tarea Vencida' : 'Pronta a Vencer', desc: `(${t.parentName}) ${t.descripcion}` };
      })
    ];
  }, [alertCases, allPendingTasks]);

  const redMetrics = useMemo(() => {
    let sumEnlace = 0, countEnlace = 0, sumIngreso = 0, countIngreso = 0, alertCount = 0;
    const currentTarget = appConfig.targetDays || 7;
    visibleCases.forEach(c => {
      const enlaceDays = diffInDays(c.fechaEgreso, c.fechaRecepcionRed);
      const ingresoDays = diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo);
      if (enlaceDays !== null) { sumEnlace += enlaceDays; countEnlace++; }
      if (ingresoDays !== null) { sumIngreso += ingresoDays; countIngreso++; if (ingresoDays > currentTarget) alertCount++; }
    });
    return { avgEnlace: countEnlace > 0 ? (sumEnlace / countEnlace).toFixed(1) : '---', avgIngreso: countIngreso > 0 ? (sumIngreso / countIngreso).toFixed(1) : '---', fueraDePlazo: alertCount };
  }, [visibleCases, appConfig.targetDays]);

  // --- HANDLERS GENERALES ---
  const handleLogin = (e) => {
    e.preventDefault();
    const user = users.find(u => u.rut === loginData.rut && u.password === loginData.password);
    if (user) { setCurrentUser(user); setLoginError(''); } else { setLoginError('RUT o Contraseña incorrectos.'); }
  };

  const handleUpdateTarget = async (days) => {
    const newDays = parseInt(days);
    if (!isNaN(newDays)) { await saveToCloud('settings', 'config', { ...appConfig, targetDays: newDays }); }
  };

  const handleExportCSV = () => {
    const currentTarget = appConfig.targetDays || 7;
    const headers = ['ID_Seguimiento', 'RUT', 'Paciente', 'Origen', 'Destino', 'Estado', 'Fecha_Egreso', 'Fecha_Recepcion', 'Fecha_Ingreso_Efectivo', 'Plazo_Meta'];
    const rows = visibleCases.map(c => [c.id, c.paciente, c.nombre, c.origen, c.destino, c.estado, c.fechaEgreso||'', c.fechaRecepcionRed||'', c.fechaIngresoEfectivo||'', currentTarget]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `Reporte_Continuidad_HPM.csv`; link.click();
  };

  // --- HANDLERS INTELIGENCIA ARTIFICIAL (SOLO ADMINS) ---
  const handleGenerateReport = async (type) => { 
    if (!appConfig.apiKey) return alert("Falta configurar la Clave API de IA en la pestaña 'Configuración'.");
    
    setIsGeneratingReport(true); 
    setReportContent('');
    let prompt = "";
    const currentTarget = appConfig.targetDays || 7;
    
    if (type === 'stats') {
      const delayCases = visibleCases.filter(c => diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo) > currentTarget);
      if (delayCases.length === 0) { setIsGeneratingReport(false); return alert("No hay casos fuera de plazo para reportar."); }
      prompt = `Actúa como clínico experto. Redacta un reporte breve sobre estos ${delayCases.length} casos fuera de plazo (${currentTarget} días): ${JSON.stringify(delayCases.map(c => ({ paciente: c.nombre, destino: c.destino })))}$. Identifica nudos críticos.`;
    } else {
      if (alertCases.length === 0) { setIsGeneratingReport(false); return alert("No hay casos en alerta para reportar."); }
      prompt = `Redacta un correo urgente para rescatar estos pacientes en alerta de red: ${JSON.stringify(alertCases.map(c => ({ paciente: c.nombre, destino: c.destino })))}$. Dirigido a directores de centros.`;
    }
    
    try { 
      const res = await generateTextWithRetry(appConfig.apiKey, prompt);
      setReportContent(res);
    } catch (e) { 
      setReportContent("Error de conexión con la IA. Verifica que tu Llave API sea correcta."); 
    } finally { 
      setIsGeneratingReport(false); 
    }
  };

  const handleGenerateCaseSummary = async () => {
    if (!appConfig.apiKey) return alert("Falta configurar la Clave API de IA en Configuración.");
    setIsGeneratingCaseSummary(true); setCaseSummary('');
    
    const prompt = `Actúa como clínico. Genera un resumen profesional: Paciente: ${caseForm.nombre}, RUT: ${caseForm.rut}, Origen: ${caseForm.origen}, Destino: ${caseForm.destino}. Eventos: ${caseForm.bitacora.map(b => `[${b.fecha}] ${b.tipo}: ${b.descripcion}`).join(' | ')}. Resumen directo sin saludos.`;
    try {
      const result = await generateTextWithRetry(appConfig.apiKey, prompt);
      setCaseSummary(result);
    } catch (e) {
      setCaseSummary("No se pudo generar el resumen. Verifica tu Clave API.");
    } finally {
      setIsGeneratingCaseSummary(false);
    }
  };

  const handleProcessRawTextForAI = async () => {
    if (!appConfig.apiKey) return alert("Falta configurar la Clave API de IA en Configuración.");
    if (!rawTextForAI.trim()) return;
    
    setIsDigitizing(true);
    const prompt = `Actúa como auditor técnico en salud. Del siguiente texto, extrae ÚNICAMENTE los puntos o criterios evaluables. Devuélvelos uno por línea, listos para un checklist de Sí/No. Omite introducciones, saludos o conclusiones. TEXTO: ${rawTextForAI}`;
    try {
      const result = await generateTextWithRetry(appConfig.apiKey, prompt);
      const criteriosGenerados = result.split('\n').map(c => c.trim().replace(/^[-*•\d.)]+\s*/, '')).filter(c => c.length > 2);
      if(criteriosGenerados.length === 0) throw new Error("No se encontraron criterios.");
      setTemplateForm({...templateForm, criterios: [...templateForm.criterios.filter(c=>c!==''), ...criteriosGenerados]});
      setRawTextForAI('');
      alert(`¡Texto procesado correctamente! Se extrajeron ${criteriosGenerados.length} criterios.`);
    } catch (err) { 
      alert("Error al procesar el texto con la IA. Revisa tu Clave API."); 
    } finally { 
      setIsDigitizing(false); 
    }
  };

  const handlePdfUploadForAI = async (e) => {
    if (!appConfig.apiKey) { e.target.value = null; return alert("Falta configurar la Clave API de IA en Configuración."); }
    const file = e.target.files[0];
    if (!file) return;
    setIsDigitizing(true);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result.split(',')[1];
      const inlineData = { mimeType: file.type || 'application/pdf', data: base64Data };
      const prompt = `Actúa como auditor técnico en salud. Extrae los criterios o puntos a evaluar del documento adjunto. Devuelve ÚNICAMENTE los criterios encontrados, uno por línea, listos para un checklist de Sí/No. Omite introducciones, saludos o conclusiones.`;
      
      try {
        const result = await generateTextWithRetry(appConfig.apiKey, prompt, "", inlineData);
        const criteriosGenerados = result.split('\n').map(c => c.trim().replace(/^[-*•\d.)]+\s*/, '')).filter(c => c.length > 2);
        
        if(criteriosGenerados.length === 0) throw new Error("No se encontraron criterios.");
        
        setTemplateForm({...templateForm, nombre: `Evaluación: ${file.name}`, criterios: [...templateForm.criterios.filter(c=>c!==''), ...criteriosGenerados]});
        alert(`¡Documento procesado correctamente! Se encontraron ${criteriosGenerados.length} criterios.`);
      } catch (err) { 
        console.error(err);
        alert("El archivo es muy pesado, ilegible o la Clave API es incorrecta. Intenta copiar y pegar el texto en el cuadro de abajo."); 
      } finally { 
        setIsDigitizing(false); 
      }
    };
    reader.onerror = () => { alert("Error al leer el archivo desde el navegador."); setIsDigitizing(false); };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); alert("Copiado al portapapeles"); };

  // --- GUARDADOS EN NUBE ---
  const handleSaveCase = async () => { 
    if (!caseForm.rut || !caseForm.nombre) return alert("RUT y Nombre son obligatorios.");
    const finalId = editingCaseId || `CASO-${String(cases.length + 1).padStart(3, '0')}`;
    await saveToCloud('cases', finalId, { ...caseForm, id: finalId, paciente: caseForm.rut });
    setIsCaseModalOpen(false); setEditingCaseId(null); setCaseForm(defaultCaseState); setCaseSummary('');
  };

  const handleAddBitacora = () => {
    if (!newBitacoraEntry.descripcion) return;
    setCaseForm({ ...caseForm, bitacora: [{ id: Date.now(), ...newBitacoraEntry, fecha: new Date().toISOString().split('T')[0], completada: false }, ...caseForm.bitacora] });
    setNewBitacoraEntry({ tipo: 'Nota Adm.', descripcion: '', responsable: '', fechaCumplimiento: '' });
  };
  
  const toggleTaskCompletion = async (caseId, entryId) => {
     const caso = cases.find(c => c.id === caseId);
     if (!caso) return;
     const updatedBitacora = (caso.bitacora || []).map(entry => entry.id === entryId ? { ...entry, completada: !entry.completada } : entry);
     await saveToCloud('cases', caseId, { ...caso, bitacora: updatedBitacora });
  };

  const handleSaveDoc = async () => {
    if(!docForm.nombre) return alert("El nombre del protocolo es obligatorio"); 
    const finalId = editingDocId || `DOC-00${docs.length + 1}`;
    await saveToCloud('docs', finalId, { ...docForm, id: finalId });
    setIsDocModalOpen(false); setEditingDocId(null);
  };

  const handleAddDocBitacora = () => {
    if (!newDocBitacoraEntry.descripcion) return;
    setDocForm(prev => ({ ...prev, bitacora: [{ id: Date.now(), ...newDocBitacoraEntry, fecha: new Date().toISOString().split('T')[0], completada: false }, ...(prev.bitacora || [])] }));
    setNewDocBitacoraEntry({ tipo: 'Tarea', descripcion: '', responsable: '', fechaCumplimiento: '' });
  };
  
  const toggleDocTaskCompletion = async (docId, entryId) => {
     const documento = docs.find(d => d.id === docId);
     if (!documento) return;
     const updatedBitacora = (documento.bitacora || []).map(entry => entry.id === entryId ? { ...entry, completada: !entry.completada } : entry);
     await saveToCloud('docs', docId, { ...documento, bitacora: updatedBitacora });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const newFile = { id: Date.now().toString(), nombre: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB', fecha: new Date().toISOString().split('T')[0] };
    setDocForm(prev => ({ ...prev, archivos: [...(prev.archivos || []), newFile] }));
  };

  const handleSaveTemplate = async () => {
    const validCriterios = templateForm.criterios.filter(c=>c.trim()!=='');
    if (!templateForm.nombre || validCriterios.length === 0) return alert("Ingresa nombre y al menos un criterio.");
    const finalId = `TPL-00${auditTemplates.length + 1}`;
    await saveToCloud('auditTemplates', finalId, { id: finalId, nombre: templateForm.nombre, tipo: templateForm.tipo, criterios: validCriterios, rangos: templateForm.rangos });
    setIsTemplateModalOpen(false);
  };

  const handleSaveAudit = async () => {
    const selectedTemplate = auditTemplates.find(t => t.id === auditForm.templateId);
    if (!selectedTemplate) return;
    const totalCriterios = selectedTemplate.criterios.length;
    const aprobados = Object.values(auditForm.answers).filter(val => val === 'si').length;
    const score = totalCriterios > 0 ? Math.round((aprobados / totalCriterios) * 100) : 0;
    
    // Calcular estado según los rangos
    let estadoTexto = score >= 75 ? 'Óptimo' : 'Riesgo';
    if (selectedTemplate.rangos && selectedTemplate.rangos.length > 0) {
       const match = selectedTemplate.rangos.find(r => aprobados >= Number(r.min) && aprobados <= Number(r.max));
       if (match) estadoTexto = match.resultado;
    }

    const finalId = `AUD-00${audits.length + 1}`;
    await saveToCloud('audits', finalId, { id: finalId, centro: auditForm.centro, tipo: auditForm.tipo, templateId: selectedTemplate.id, fecha: new Date().toISOString().split('T')[0], cumplimiento: score, puntaje: `${aprobados} / ${totalCriterios} pts`, estado: estadoTexto, evaluador: currentUser.nombre });
    setIsAuditModalOpen(false);
  };

  const handleSaveDir = async () => {
    if (!dirForm.nombre) return alert("Nombre obligatorio");
    const finalId = editingDirId || Date.now();
    await saveToCloud('directory', finalId, { ...dirForm, id: finalId });
    setIsDirModalOpen(false);
  };

  const handleSaveUser = async () => {
    if (!userForm.rut || !userForm.password) return alert("RUT y Contraseña obligatorios.");
    const finalId = editingUserId || Date.now();
    await saveToCloud('users', finalId, { ...userForm, id: finalId });
    setIsUserModalOpen(false);
  };

  const handleUpdatePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) return alert("Contraseñas no coinciden.");
    if (passwordForm.current !== currentUser.password) return alert("Contraseña actual incorrecta.");
    const updatedUser = { ...currentUser, password: passwordForm.new };
    await saveToCloud('users', currentUser.id, updatedUser);
    setCurrentUser(updatedUser); setIsProfileModalOpen(false); alert("Actualizada exitosamente!");
  };

  // ================= RENDERIZADO PRINCIPAL =================

  if (!currentUser) return (
    <div className="min-h-screen bg-[#0a2540] flex items-center justify-center p-4 fade-in">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-200"><Activity size={28} className="text-white" /></div>
          <h1 className="text-2xl font-bold text-slate-800">SGCC-SM</h1>
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Hospital Puerto Montt</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><User size={12}/> RUT DE USUARIO</label>
            <input type="text" value={loginData.rut} onChange={(e) => setLoginData({...loginData, rut: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold" placeholder="11.111.111-1" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Lock size={12}/> CONTRASEÑA</label>
            <input type="password" value={loginData.password} onChange={(e) => setLoginData({...loginData, password: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold" placeholder="••••••" />
          </div>
          {loginError && <p className="text-red-500 text-xs text-center font-black uppercase tracking-widest">{loginError}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all">INGRESAR AL SISTEMA</button>
        </form>
        <div className="mt-6 text-center pt-4 border-t border-slate-100"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter flex items-center justify-center gap-1"><Shield size={12}/> Acceso restringido red Reloncaví</p></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-[#0a2540] text-white flex flex-col h-screen sticky top-0 shrink-0 shadow-xl overflow-y-auto">
        <div className="p-5 border-b border-white/5">
          <h1 className="text-xl font-bold tracking-tight">SGCC-SM</h1>
          <p className="text-xs text-blue-400 font-black uppercase tracking-widest mt-1">UHCIP INFANTO JUVENIL</p>
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

          {currentUser.rol === 'Admin' && (
             <>
               <div className="pt-5 pb-2 px-4 text-[10px] font-black text-blue-400 uppercase tracking-widest">Administración</div>
               <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><UserPlus size={18}/> Usuarios</button>
               <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'config' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><Settings size={18}/> Ajustes</button>
             </>
          )}
        </nav>
        <div className="p-4 border-t border-white/5 shrink-0 bg-[#071c31]">
           <div className="flex items-center justify-between mb-3 px-2">
             <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xs">{currentUser.iniciales}</div><p className="text-[10px] text-blue-200 font-black truncate uppercase tracking-widest">{currentUser.nombre}</p></div>
             <button onClick={() => setIsProfileModalOpen(true)} className="text-slate-400 hover:text-white transition-colors" title="Cambiar Contraseña"><Key size={16}/></button>
           </div>
           <button onClick={() => setCurrentUser(null)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-300 bg-red-900/30 hover:bg-red-500/30 transition-colors"><LogOut size={14}/> Salir</button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 relative">
        
        {/* HEADER FLOTANTE (NOTIFICACIONES) */}
        <div className="absolute top-6 right-6 z-20">
          <div className="relative">
            <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm relative transition-all">
              <Bell size={20} />
              {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden fade-in">
                <div className="bg-[#0a2540] text-white px-4 py-3 font-bold flex justify-between items-center text-xs">Notificaciones <span className="bg-blue-600 text-[10px] px-2 py-0.5 rounded-full">{notifications.length}</span></div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (<div className="p-6 text-center text-xs text-slate-500 font-medium">No hay notificaciones pendientes.</div>) : (
                    <div className="divide-y divide-slate-50">
                      {notifications.map(n => (
                        <div key={n.id} className="p-4 hover:bg-slate-50 transition-colors flex gap-3 items-start">
                          <div className="mt-0.5">{n.type === 'alerta' || n.type === 'overdue' ? <AlertTriangle size={14} className="text-red-500"/> : <Bell size={14} className="text-amber-500"/>}</div>
                          <div><p className="text-sm font-bold text-slate-800">{n.title}</p><p className="text-xs text-slate-500 mt-1 font-medium">{n.desc}</p></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PESTAÑA 1: DASHBOARD CLÁSICO */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Panel de Gestión Integral</h2><p className="text-xs text-slate-500 font-medium mt-1">Resumen de actividad clínica y normativa</p></div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-[6px] border-l-red-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Pérdida Continuidad</p><h3 className="text-2xl font-black text-red-600 mt-1">{alertCases.length}</h3></div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-[6px] border-l-blue-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Pacientes en Tránsito</p><h3 className="text-2xl font-black text-blue-600 mt-1">{visibleCases.filter(c => c.estado === 'Pendiente').length}</h3></div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-[6px] border-l-amber-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Tareas Críticas</p><h3 className="text-2xl font-black text-amber-600 mt-1">{tareasCriticas}</h3></div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-[6px] border-l-indigo-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Auditorías Normativas</p><h3 className="text-2xl font-black text-indigo-600 mt-1">{visibleAudits.filter(a => a.tipo === 'Auditoría').length}</h3></div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-[6px] border-l-teal-500"><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Consultorías Clínicas</p><h3 className="text-2xl font-black text-teal-600 mt-1">{visibleAudits.filter(a => a.tipo === 'Consultoría').length}</h3></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 lg:col-span-2 overflow-hidden">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" /> Casos Requiriendo Rescate</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead><tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400"><th className="p-3 rounded-l-lg">ID</th><th className="p-3">Paciente</th><th className="p-3">Destino</th><th className="p-3 rounded-r-lg">Estado</th></tr></thead>
                    <tbody>
                      {alertCases.map(c => (<tr key={c.id} className="border-b border-slate-50"><td className="p-3 text-xs font-bold text-slate-500 whitespace-nowrap">{c.id}</td><td className="p-3 text-sm font-bold text-slate-800">{c.nombre}</td><td className="p-3 text-xs font-bold text-indigo-600 whitespace-nowrap">{c.destino}</td><td className="p-3"><StatusBadge status={c.estado}/></td></tr>))}
                      {alertCases.length === 0 && (<tr><td colSpan="4" className="p-6 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">No hay alertas activas en tu red.</td></tr>)}
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
                  ) : (
                    <div className="mt-auto p-3 bg-white/10 rounded-xl text-center text-[9px] font-black uppercase tracking-widest text-indigo-300">Exclusivo Administradores</div>
                  )}
                </div>
                {/* MOSTRANDO REPORTE EN DASHBOARD */}
                {reportContent && activeTab === 'dashboard' && currentUser?.rol === 'Admin' && (
                  <div className="mt-4 bg-[#081b30] p-4 rounded-xl border border-white/10 animate-in slide-in-from-top-4 relative z-10">
                     <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">Borrador de Correo:</span>
                       <button onClick={()=>copyToClipboard(reportContent)} className="text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors"><Copy size={12}/></button>
                     </div>
                     <p className="text-[10px] font-medium text-slate-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{reportContent}</p>
                  </div>
                )}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full -mr-10 -mt-10 blur-xl"></div>
              </div>
            </div>

            {/* SEGUIMIENTO DE TAREAS */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2"><ListTodo size={16} className="text-blue-500" /> Tareas Intersectoriales Pendientes</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead><tr className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400"><th className="p-3 rounded-l-lg w-10">Est.</th><th className="p-3">Origen</th><th className="p-3">Tarea Asignada</th><th className="p-3">Responsable</th><th className="p-3 rounded-r-lg">Acción / Vencimiento</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {allPendingTasks.map(tarea => {
                      const statusInfo = getTaskStatus(tarea.fechaCumplimiento);
                      return (
                        <tr key={tarea.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="p-3 text-slate-300">
                             <button onClick={() => tarea.source === 'Caso' ? toggleTaskCompletion(tarea.parentId, tarea.id) : toggleDocTaskCompletion(tarea.parentId, tarea.id)} className="hover:text-emerald-500 transition-colors"><Square size={16} /></button>
                          </td>
                          <td className="p-3"><div className="text-[11px] font-black text-slate-800 flex items-center gap-2">{tarea.parentName} {statusInfo.status === 'upcoming' && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[7px] uppercase animate-pulse">Próximo</span>} {statusInfo.status === 'overdue' && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[7px] uppercase">Vencida</span>}</div><div className="text-[8px] text-slate-400 mt-1 uppercase tracking-widest font-bold">{tarea.source}</div></td>
                          <td className="p-3 text-xs font-medium text-slate-600">{tarea.descripcion}</td>
                          <td className="p-3 text-[10px] font-bold text-slate-500">{tarea.responsable || 'No asignado'}</td>
                          <td className="p-3"><span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5 w-fit shadow-sm whitespace-nowrap ${statusInfo.bgClass}`}>{statusInfo.showWarning && <AlertTriangle size={10}/>}{tarea.fechaCumplimiento || 'Sin Fecha'}</span></td>
                        </tr>
                      );
                    })}
                    {allPendingTasks.length === 0 && (<tr><td colSpan="5" className="p-8 text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest">No hay tareas pendientes registradas en la red.</td></tr>)}
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
              <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Estadísticas de Continuidad</h2><p className="text-xs text-slate-500 font-medium mt-1">Análisis de tiempos de respuesta en la red</p></div>
              <button onClick={handleExportCSV} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md"><Download size={14}/> Exportar Data Cruda</button>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                 <div className="flex items-center gap-4">
                   <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Target size={24}/></div>
                   <div>
                     <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-widest">Plazo Meta Operacional</h3>
                     <p className="text-[10px] text-slate-500 mt-1 font-medium">Días tolerables para el "Ingreso Efectivo" según la capacidad local.</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <span className="text-[9px] font-black text-slate-400 ml-2 uppercase tracking-widest">META RED:</span>
                    {currentUser?.rol === 'Admin' ? (
                      <input type="number" value={targetDays} onChange={(e) => handleUpdateTarget(e.target.value)} className="w-16 p-2 bg-white border border-blue-100 rounded-lg text-center font-black text-blue-600 outline-none focus:border-blue-500 text-sm shadow-sm"/>
                    ) : (
                      <span className="px-3 py-2 font-black text-blue-600 text-sm">{targetDays}</span>
                    )}
                    <span className="text-[9px] font-black text-slate-500 mr-2 uppercase tracking-widest">Días</span>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-[8px] border-l-indigo-500">
                <div className="flex justify-between items-start mb-3"><div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Timer size={18}/></div><span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50 px-2 py-1 rounded-lg">Hito A-B</span></div>
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Promedio Enlace Administrativo</h3>
                <p className="text-4xl font-black text-slate-800 mt-1">{redMetrics.avgEnlace} <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Días</span></p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-[8px] border-l-blue-500">
                <div className="flex justify-between items-start mb-3"><div className="p-2 bg-blue-50 rounded-xl text-blue-600"><BarChart3 size={18}/></div><span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50 px-2 py-1 rounded-lg">Hito A-C</span></div>
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Promedio Ingreso Efectivo</h3>
                <p className="text-4xl font-black text-slate-800 mt-1">{redMetrics.avgIngreso} <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Días</span></p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-[8px] border-l-red-500 relative overflow-hidden">
                <div className="flex justify-between items-start mb-3 relative z-10"><div className="p-2 bg-red-50 rounded-xl text-red-600"><AlertTriangle size={18}/></div><div className="px-2 py-1 bg-red-100 text-red-700 text-[8px] font-black rounded-lg uppercase tracking-[0.2em] shadow-sm">Brecha</div></div>
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest relative z-10">Casos sobre la meta ({targetDays} d)</h3>
                <p className="text-4xl font-black text-slate-800 mt-1 relative z-10">{redMetrics.fueraDePlazo} <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Casos</span></p>
                {redMetrics.fueraDePlazo > 0 && <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full -mr-8 -mt-8 blur-xl"></div>}
              </div>
            </div>

            {redMetrics.fueraDePlazo > 0 && currentUser?.rol === 'Admin' && (
              <div className="bg-gradient-to-br from-indigo-900 to-[#0a2540] rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                 <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                   <div className="max-w-2xl">
                     <h3 className="text-lg font-black mb-2 flex items-center gap-2"><TrendingUp size={20} className="text-blue-400"/> Análisis Estratégico de Brechas (IA)</h3>
                     <p className="text-xs text-blue-100 opacity-90 font-medium leading-relaxed">Basado en tu meta, {redMetrics.fueraDePlazo} pacientes sufren demoras críticas. Genera un informe para presentar a las direcciones de la red.</p>
                   </div>
                   <button onClick={() => handleGenerateReport('stats')} disabled={isGeneratingReport} className="bg-white text-indigo-900 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center gap-2 shadow-lg shrink-0 disabled:opacity-50">
                     {isGeneratingReport ? <Loader2 size={16} className="animate-spin"/> : <FileText size={16}/>} Procesar Reporte
                   </button>
                 </div>
                 <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                 {reportContent && activeTab === 'stats' && (
                   <div className="mt-6 bg-[#081b30] p-6 rounded-xl border border-white/10 animate-in slide-in-from-top-4 relative z-10">
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10"><span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">Borrador Directivo Generado:</span><button onClick={()=>copyToClipboard(reportContent)} className="text-white bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"><Copy size={14}/></button></div>
                      <p className="text-xs font-medium text-slate-300 whitespace-pre-wrap leading-relaxed">{reportContent}</p>
                   </div>
                 )}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 3: CASOS DE RED */}
        {activeTab === 'cases' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Casos en Red</h2><p className="text-xs text-slate-500 font-medium mt-1">Gestión individual de traslados intersectoriales</p></div>
              <button onClick={() => { setEditingCaseId(null); setCaseForm(defaultCaseState); setCaseSummary(''); setIsCaseModalOpen(true); }} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md flex items-center gap-2"><Plus size={16}/> Nuevo Seguimiento</button>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Paciente</th>
                      <th className="p-4">Ruta de Traslado</th>
                      <th className="p-4 text-center">Hitos Clínicos (A-B-C)</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {visibleCases.map(c => {
                      const daysC = diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo);
                      const isOver = daysC !== null && daysC > targetDays;
                      return (
                        <tr key={c.id} className={`hover:bg-slate-50/80 transition-colors ${isOver ? 'bg-red-50/20' : ''}`}>
                          <td className="p-4">
                            <div className="font-bold text-slate-800 text-sm uppercase">{c.nombre}</div>
                            <div className="text-xs font-medium text-slate-500 mt-1 whitespace-nowrap">{c.paciente}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg w-fit flex items-center gap-2 uppercase tracking-wide border border-blue-100 whitespace-nowrap">
                              {c.origen} <Timer size={14}/> {c.destino}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex justify-center gap-6">
                               <div className="text-center"><span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Egreso</span><span className="text-sm font-bold text-slate-700 whitespace-nowrap">{c.fechaEgreso || '---'}</span></div>
                               <div className="text-center border-l border-slate-100 pl-6"><span className="text-[10px] font-bold text-indigo-400 block mb-1 uppercase tracking-wider">Recep</span><span className="text-sm font-bold text-indigo-700 whitespace-nowrap">{c.fechaRecepcionRed || '---'}</span></div>
                               <div className="text-center border-l border-slate-100 pl-6"><span className="text-[10px] font-bold text-green-500 block mb-1 uppercase tracking-wider">Ingreso</span><span className={`text-sm font-bold whitespace-nowrap ${isOver ? 'text-red-600' : 'text-green-600'}`}>{c.fechaIngresoEfectivo || '---'}</span></div>
                            </div>
                          </td>
                          <td className="p-4"><div className="flex justify-center"><StatusBadge status={c.estado}/></div></td>
                          <td className="p-4 text-right"><button onClick={() => { setEditingCaseId(c.id); setCaseForm({ ...c, rut: c.paciente, tutor: c.tutor || {nombre:'', relacion:'', telefono:''}, referentes: c.referentes || [] }); setCaseSummary(''); setIsCaseModalOpen(true); }} className="text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 p-2.5 rounded-lg transition-all border border-slate-100 hover:border-blue-200"><Edit2 size={18}/></button></td>
                        </tr>
                      );
                    })}
                    {visibleCases.length === 0 && (<tr><td colSpan="5" className="p-12 text-center"><p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No hay registros de seguimiento en la red</p></td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 4: PROTOCOLOS */}
        {activeTab === 'docs' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Normativas y Protocolos</h2><p className="text-xs text-slate-500 font-medium mt-1">Desarrollo documental de la red</p></div>
              <button onClick={() => { setEditingDocId(null); setDocForm({ nombre: '', ambito: ambitosProtocolo[0], fase: 'Levantamiento', avance: 10, notas: '', bitacora: [], archivos: [] }); setActiveDocModalTab('datos'); setIsDocModalOpen(true); }} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-md flex items-center gap-2"><Plus size={18}/> Nuevo Protocolo</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {docs.map((d) => (
                <div key={d.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-200 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3"><span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase tracking-widest">{d.id}</span><button onClick={() => { setEditingDocId(d.id); setDocForm(d); setActiveDocModalTab('datos'); setIsDocModalOpen(true); }} className="text-slate-300 hover:text-blue-600 p-1.5 bg-slate-50 rounded-lg"><Edit2 size={14} /></button></div>
                    <h3 className="text-lg font-black text-slate-800 mb-1 leading-tight">{d.nombre}</h3><p className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-1.5"><Activity size={12}/> {d.ambito} • {d.fase}</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1.5 text-slate-400"><span>Avance Técnico</span><span>{d.avance}%</span></div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden"><div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${d.avance}%` }}></div></div>
                  </div>
                </div>
              ))}
              {docs.length === 0 && <div className="col-span-2 text-center py-16 text-slate-300 font-black uppercase tracking-widest text-xs">Sin protocolos registrados.</div>}
            </div>
          </div>
        )}

        {/* PESTAÑA 5 Y 6: AUDITORÍAS Y CONSULTORÍAS */}
        {(activeTab === 'auditorias' || activeTab === 'consultorias') && (() => {
          const tipoLabel = activeTab === 'auditorias' ? 'Auditoría' : 'Consultoría';
          const currentFilter = activeTab === 'auditorias' ? centroFilterAuditorias : centroFilterConsultorias;
          const setFilter = activeTab === 'auditorias' ? setCentroFilterAuditorias : setCentroFilterConsultorias;
          const filteredAudits = visibleAudits.filter(a => a.tipo === tipoLabel && (currentFilter === 'Todos' || a.centro === currentFilter));

          return (
            <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">{tipoLabel === 'Auditoría' ? 'Auditorías Normativas' : 'Consultorías Clínicas'}</h2><p className="text-xs text-slate-500 font-medium mt-1">Evaluación en dispositivos de la red</p></div>
                <div className="flex flex-wrap gap-3">
                  <select value={currentFilter} onChange={e => setFilter(e.target.value)} className="px-3 py-2.5 border-2 border-slate-200 rounded-xl text-[10px] font-bold bg-white outline-none focus:border-blue-500 uppercase tracking-widest text-slate-600"><option value="Todos">Toda la Red</option>{centros.map(c => <option key={c} value={c}>{c}</option>)}</select>
                  {currentUser?.rol === 'Admin' && (<button onClick={() => { setTemplateForm({nombre: '', criterios: [''], rangos: [], tipo: 'Ambos'}); setIsTemplateModalOpen(true); }} className="bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Settings size={14} /> Pautas</button>)}
                  <button onClick={() => { setAuditForm({ centro: centros[0] || '', templateId: auditTemplates.find(t => t.tipo === 'Ambos' || t.tipo === tipoLabel)?.id || '', answers: {}, tipo: tipoLabel }); setIsAuditModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md"><ClipboardCheck size={16} /> Evaluar</button>
                </div>
              </div>
              {filteredAudits.length === 0 ? (<div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm"><ClipboardCheck size={40} className="mx-auto text-slate-200 mb-3"/><p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No hay evaluaciones en este filtro.</p></div>) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAudits.map(a => {
                    const template = auditTemplates.find(t => t.id === a.templateId);
                    return (
                    <div key={a.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-blue-200 transition-colors">
                       <div>
                         <h3 className="font-black text-slate-800 uppercase text-xs mb-1">{a.centro}</h3>
                         <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest mb-2 bg-blue-50 px-2 py-0.5 rounded w-fit">{template ? template.nombre : 'Pauta Eliminada'}</p>
                         <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1"><Calendar size={10}/> {a.fecha} • Eval: {a.evaluador}</p>
                       </div>
                       <div className="text-right">
                          <div className="text-3xl font-black text-slate-800">{a.cumplimiento}%</div>
                          <span className="text-[8px] uppercase text-slate-400 font-black block mb-1.5 tracking-[0.2em]">{a.puntaje}</span>
                          <span className={`text-[8px] uppercase tracking-widest px-2 py-1 rounded-lg font-black ${a.estado === 'Óptimo' || a.cumplimiento >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{a.estado}</span>
                       </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* PESTAÑA 7: DIRECTORIO */}
        {activeTab === 'dir' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Directorio Intersectorial</h2><p className="text-xs text-slate-500 font-medium mt-1">Contactos operativos de la red</p></div>
              <div className="flex gap-3 items-center w-full md:w-auto">
                <div className="relative flex-1 md:w-64"><div className="absolute inset-y-0 left-0 pl-3 flex items-center"><Search size={14} className="text-slate-400"/></div><input type="text" value={dirSearch} onChange={e => setDirSearch(e.target.value)} className="w-full pl-8 pr-3 py-2.5 border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500 bg-white" placeholder="Buscar contacto..."/></div>
                <button onClick={() => { setEditingDirId(null); setDirForm({ nombre: '', cargo: '', institucion: '', telefono: '', correo: '' }); setIsDirModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md"><Plus size={16} /> Nuevo</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {directory.filter(d => d.nombre.toLowerCase().includes(dirSearch.toLowerCase()) || d.institucion.toLowerCase().includes(dirSearch.toLowerCase())).map(d => (
                <div key={d.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative group hover:border-blue-200 transition-colors">
                   <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                     <button onClick={() => { setEditingDirId(d.id); setDirForm(d); setIsDirModalOpen(true); }} className="p-1.5 bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg"><Edit2 size={14}/></button>
                     <button onClick={() => deleteFromCloud('directory', d.id)} className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={14}/></button>
                   </div>
                   <h3 className="font-black text-slate-800 text-base flex items-center gap-2.5 mb-1"><div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><User size={16}/></div> {d.nombre}</h3>
                   <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mb-3 ml-9">{d.cargo} • {d.institucion}</p>
                   <div className="space-y-0.5 ml-9"><p className="text-[10px] font-bold text-slate-500">{d.telefono}</p><p className="text-[10px] font-bold text-slate-500">{d.correo}</p></div>
                </div>
              ))}
              {directory.length === 0 && <div className="col-span-3 text-center py-16 text-slate-300 font-black uppercase tracking-widest text-xs">Directorio vacío.</div>}
            </div>
          </div>
        )}

        {/* PESTAÑA 8: USUARIOS */}
        {activeTab === 'users' && currentUser.rol === 'Admin' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Gestión de Usuarios</h2><p className="text-xs text-slate-500 font-medium mt-1">Control de accesos y privilegios</p></div>
              <button onClick={() => { setEditingUserId(null); setUserForm({ rut: '', nombre: '', iniciales: '', cargo: '', password: '', rol: 'Usuario', centrosAsignados: [] }); setIsUserModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md"><UserPlus size={16} /> Crear Credencial</button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-100"><tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest"><th className="p-4">Profesional</th><th className="p-4">Rol</th><th className="p-4">Visibilidad</th><th className="p-4 text-right">Ajustes</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 font-black flex items-center justify-center text-sm border border-blue-100">{u.iniciales}</div><div><p className="font-black text-slate-800 uppercase text-xs">{u.nombre}</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{u.rut} • {u.cargo}</p></div></div></td>
                        <td className="p-4"><span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 w-fit border shadow-sm ${u.rol === 'Admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-white text-slate-600 border-slate-200'}`}>{u.rol === 'Admin' && <Shield size={10}/>} {u.rol}</span></td>
                        <td className="p-4 text-[9px] font-black tracking-widest uppercase">
                          {u.rol === 'Admin' ? <span className="text-indigo-500">Acceso Total</span> : 
                           u.centrosAsignados?.length > 0 ? <div className="flex flex-wrap gap-1.5">{u.centrosAsignados.map(c => <span key={c} className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md border border-slate-200">{c}</span>)}</div> : 
                           <span className="text-red-500 bg-red-50 px-2 py-1 rounded-md">Bloqueado</span>}
                        </td>
                        <td className="p-4 text-right"><button onClick={() => { setEditingUserId(u.id); setUserForm(u); setIsUserModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 bg-white border border-slate-100 shadow-sm rounded-lg transition-all mr-1.5"><Edit2 size={14}/></button>{u.rol !== 'Admin' && <button onClick={() => deleteFromCloud('users', u.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white border border-slate-100 shadow-sm rounded-lg transition-all"><Trash2 size={14}/></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 9: CONFIGURACIÓN */}
        {activeTab === 'config' && currentUser.rol === 'Admin' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Configuración del Sistema</h2><p className="text-xs text-slate-500 font-medium mt-1">Ajustes estructurales de la red Reloncaví</p></div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-3xl">
               <h3 className="font-black text-slate-800 text-base flex items-center gap-2 mb-2"><Activity size={18} className="text-blue-600"/> Catálogo de Dispositivos Clínicos</h3>
               <p className="text-[10px] text-slate-500 font-medium mb-6 leading-relaxed">Agrega o elimina los centros de salud mental de la red.</p>
               <div className="flex gap-3 mb-6">
                 <input type="text" value={newCentroName} onChange={e=>setNewCentroName(e.target.value)} placeholder="Ej: CESFAM Carmela Carvajal..." className="border-2 border-slate-100 p-3 rounded-xl flex-1 text-xs font-bold outline-none focus:border-blue-500 transition-colors"/>
                 <button onClick={async ()=>{if(newCentroName.trim()) { await saveToCloud('settings', 'centros', { list: [...centros, newCentroName.trim()].sort() }); setNewCentroName(''); }}} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-black shadow-md transition-all"><Plus size={14}/> Añadir</button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {centros.map(c => (
                   <div key={c} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border-2 border-slate-100 hover:border-blue-200 transition-colors group">
                     <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{c}</span>
                     <button onClick={async ()=>{ if(window.confirm(`¿Eliminar ${c}?`)) await saveToCloud('settings', 'centros', { list: centros.filter(x=>x!==c) }); }} className="text-slate-300 hover:text-red-600 p-1.5 rounded-lg bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                   </div>
                 ))}
               </div>
            </div>

            {/* MÓDULO DE LLAVE API DE IA (SOLO PARA ADMINS) */}
            <div className="mt-8 bg-indigo-50 p-8 rounded-2xl border border-indigo-100 max-w-3xl">
               <h3 className="font-bold text-indigo-900 text-sm flex items-center gap-2 mb-2"><Wand2 size={18}/> Motor de Inteligencia Artificial (Gemini)</h3>
               <p className="text-xs text-indigo-700 mb-6 leading-relaxed font-medium">Para que la extracción de pautas y resúmenes funcionen en tu servidor, debes ingresar tu Clave API oficial de Google AI Studio. **Las funciones automáticas en el menú de la aplicación solo serán visibles y utilizables por los usuarios con rol Administrador.**</p>
               <div className="flex gap-4 items-center">
                 <input type="password" value={apiConfigKey} onChange={e=>setApiConfigKey(e.target.value)} placeholder="Ej: AIzaSyB-..." className="border-2 border-white p-4 rounded-xl flex-1 text-sm font-bold outline-none focus:border-indigo-400 shadow-sm bg-white"/>
                 <button onClick={async ()=>{ await saveToCloud('settings', 'config', { ...appConfig, apiKey: apiConfigKey.trim() }); alert("¡Llave IA guardada con éxito en el servidor de la red!"); }} className="bg-indigo-600 text-white px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2"><Key size={16}/> Guardar Llave IA</button>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODALES DE LA APLICACIÓN ================= */}
      
      {/* 1. MODAL CASOS (CON RED DE APOYO RESTAURADA Y REUNIONES) */}
      {isCaseModalOpen && (
        <div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="bg-blue-600 p-6 text-white flex justify-between items-center shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
              <div className="flex items-center gap-4 relative z-10"><div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/20"><FileIcon size={24}/></div><div><h3 className="font-black text-xl uppercase tracking-widest drop-shadow-md">{editingCaseId ? `${caseForm.nombre}` : 'Nuevo Seguimiento'}</h3><p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.4em] mt-1">{editingCaseId || 'ASIGNANDO ID...'}</p></div></div>
              <button onClick={() => setIsCaseModalOpen(false)} className="text-white/60 hover:text-white font-bold text-3xl transition-colors relative z-10">&times;</button>
            </div>
            <div className="flex bg-slate-50 border-b border-slate-200 shrink-0 px-6 overflow-x-auto">
              <button onClick={() => setActiveModalTab('datos')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all whitespace-nowrap ${activeModalTab === 'datos' ? 'border-blue-600 text-blue-600 bg-white shadow-inner' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>1. Hitos y Red de Apoyo</button>
              <button onClick={() => setActiveModalTab('bitacora')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all whitespace-nowrap ${activeModalTab === 'bitacora' ? 'border-blue-600 text-blue-600 bg-white shadow-inner' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>2. Bitácora Clínica</button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-white">
              {activeModalTab === 'datos' && (
                <div className="space-y-8 animate-in slide-in-from-left-4">
                  <div className="bg-blue-50/50 p-6 rounded-2xl border-2 border-blue-100 shadow-inner">
                    <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2"><Clock size={18}/> Tiempos de la Continuidad</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-4 rounded-xl shadow-sm border-2 border-slate-100 hover:border-slate-300 transition-colors">
                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">A. EGRESO UHCIP</label>
                        <input type="date" value={caseForm.fechaEgreso} onChange={e=>setCaseForm({...caseForm, fechaEgreso: e.target.value})} className="w-full font-bold text-slate-700 outline-none text-sm bg-transparent border-none p-0 focus:ring-0 cursor-pointer" />
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm border-2 border-indigo-50 hover:border-indigo-200 transition-colors">
                        <label className="block text-[10px] font-black text-indigo-400 mb-2 uppercase tracking-widest">B. RECEPCIÓN EN RED</label>
                        <input type="date" value={caseForm.fechaRecepcionRed} onChange={e=>setCaseForm({...caseForm, fechaRecepcionRed: e.target.value})} className="w-full font-bold text-indigo-700 outline-none text-sm bg-transparent border-none p-0 focus:ring-0 cursor-pointer" />
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm border-2 border-green-50 hover:border-green-200 transition-colors">
                        <label className="block text-[10px] font-black text-green-500 mb-2 uppercase tracking-widest">C. INGRESO EFECTIVO</label>
                        <input type="date" value={caseForm.fechaIngresoEfectivo} onChange={e=>setCaseForm({...caseForm, fechaIngresoEfectivo: e.target.value})} className="w-full font-bold text-green-700 outline-none text-sm bg-transparent border-none p-0 focus:ring-0 cursor-pointer" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-2">Identificación Paciente</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</label><input type="text" value={caseForm.nombre} onChange={e=>setCaseForm({...caseForm, nombre: e.target.value})} className="w-full border-b-2 border-slate-100 py-2 outline-none focus:border-blue-500 font-bold text-sm text-slate-800 transition-colors" placeholder="Ej: Juan Pérez" /></div>
                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RUT</label><input type="text" value={caseForm.rut} onChange={e=>setCaseForm({...caseForm, rut: e.target.value})} className="w-full border-b-2 border-slate-100 py-2 outline-none focus:border-blue-500 font-bold text-sm text-slate-800 transition-colors" placeholder="Ej: 11.111.111-1" /></div>
                      </div>
                      <div className="mt-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Clínico Operativo</label><select value={caseForm.estado} onChange={e=>setCaseForm({...caseForm, estado: e.target.value})} className="w-full border-b-2 border-slate-100 py-2 outline-none focus:border-blue-500 font-bold text-sm text-slate-800 bg-transparent transition-colors cursor-pointer mt-1"><option>Pendiente</option><option>Concretado</option><option>Alerta</option></select></div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-2">Ruta Institucional</h4>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Origen del Traslado</label><select value={caseForm.origen} onChange={e=>setCaseForm({...caseForm, origen: e.target.value})} className="w-full border-b-2 border-slate-100 py-2 outline-none focus:border-blue-500 font-bold text-sm text-slate-800 bg-transparent transition-colors cursor-pointer mt-1"><option value="">Seleccione...</option>{centros.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                      <div className="mt-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispositivo Receptor (Destino)</label><select value={caseForm.destino} onChange={e=>setCaseForm({...caseForm, destino: e.target.value})} className="w-full border-b-2 border-slate-100 py-2 outline-none focus:border-blue-500 font-bold text-sm text-slate-800 bg-transparent transition-colors cursor-pointer mt-1"><option value="">Seleccione...</option>{centros.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    </div>
                  </div>

                  {/* RED DE APOYO Y REFERENTES */}
                  <div className="space-y-4 border-t-2 border-slate-100 pt-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-2">Red de Apoyo y Referentes</h4>
                    
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
                       <h5 className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2"><User size={16}/> Tutor Legal / Familiar Responsable</h5>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</label><input type="text" value={caseForm.tutor?.nombre || ''} onChange={e=>setCaseForm({...caseForm, tutor: {...caseForm.tutor, nombre: e.target.value}})} className="w-full border-b-2 border-slate-200 py-2 outline-none focus:border-blue-500 font-bold text-sm text-slate-700 bg-transparent transition-colors" placeholder="Ej: María Cáceres"/></div>
                          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Relación / Parentesco</label><input type="text" value={caseForm.tutor?.relacion || ''} onChange={e=>setCaseForm({...caseForm, tutor: {...caseForm.tutor, relacion: e.target.value}})} className="w-full border-b-2 border-slate-200 py-2 outline-none focus:border-blue-500 font-bold text-sm text-slate-700 bg-transparent transition-colors" placeholder="Ej: Madre"/></div>
                          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teléfono de Contacto</label><input type="text" value={caseForm.tutor?.telefono || ''} onChange={e=>setCaseForm({...caseForm, tutor: {...caseForm.tutor, telefono: e.target.value}})} className="w-full border-b-2 border-slate-200 py-2 outline-none focus:border-blue-500 font-bold text-sm text-slate-700 bg-transparent transition-colors" placeholder="+56 9..."/></div>
                       </div>
                    </div>

                    <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 shadow-sm">
                       <h5 className="text-[11px] font-black text-indigo-800 uppercase tracking-widest mb-4 flex items-center gap-2"><BookOpen size={16}/> Referentes Institucionales y Clínicos</h5>
                       {caseForm.referentes?.map((ref, idx) => (
                          <div key={idx} className="flex flex-col md:flex-row gap-4 mb-4 items-end bg-white p-4 rounded-xl border border-indigo-50 shadow-sm">
                             <div className="flex-1 w-full"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre y Cargo</label><input type="text" value={ref.nombre} onChange={e=>{const newRefs=[...caseForm.referentes]; newRefs[idx].nombre=e.target.value; setCaseForm({...caseForm, referentes: newRefs});}} className="w-full border-b-2 border-indigo-100 py-2 outline-none focus:border-indigo-500 font-bold text-sm text-slate-700 bg-transparent transition-colors" placeholder="Ej: Ps. Andrea Silva"/></div>
                             <div className="flex-1 w-full"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispositivo</label><input type="text" value={ref.dispositivo} onChange={e=>{const newRefs=[...caseForm.referentes]; newRefs[idx].dispositivo=e.target.value; setCaseForm({...caseForm, referentes: newRefs});}} className="w-full border-b-2 border-indigo-100 py-2 outline-none focus:border-indigo-500 font-bold text-sm text-slate-700 bg-transparent transition-colors" placeholder="Ej: COSAM Puerto Montt"/></div>
                             <div className="flex-1 w-full"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contacto</label><input type="text" value={ref.contacto} onChange={e=>{const newRefs=[...caseForm.referentes]; newRefs[idx].contacto=e.target.value; setCaseForm({...caseForm, referentes: newRefs});}} className="w-full border-b-2 border-indigo-100 py-2 outline-none focus:border-indigo-500 font-bold text-sm text-slate-700 bg-transparent transition-colors" placeholder="Teléfono o correo..."/></div>
                             <button onClick={()=>{const newRefs=[...caseForm.referentes]; newRefs.splice(idx,1); setCaseForm({...caseForm, referentes: newRefs});}} className="p-3 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg shadow-sm border border-slate-100 transition-colors mb-1"><Trash2 size={16}/></button>
                          </div>
                       ))}
                       <button onClick={()=>setCaseForm({...caseForm, referentes: [...(caseForm.referentes||[]), {nombre:'', dispositivo:'', contacto:''}]})} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5 mt-2 hover:text-indigo-800 transition-colors bg-indigo-100 px-4 py-2 rounded-lg w-fit"><Plus size={14}/> Añadir Referente de Red</button>
                    </div>
                  </div>
                  
                  {/* RESUMEN IA */}
                  <div className="space-y-4 border-t-2 border-slate-100 pt-6">
                    <div className="flex justify-between items-end">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 flex items-center gap-2"><Wand2 size={16}/> Resumen Clínico Inteligente</h4>
                      
                      {currentUser?.rol === 'Admin' ? (
                        <button onClick={handleGenerateCaseSummary} disabled={isGeneratingCaseSummary || caseForm.bitacora.length === 0} className="bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors flex items-center gap-2 border border-indigo-100 disabled:opacity-50">
                          {isGeneratingCaseSummary ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>} Generar Resumen
                        </button>
                      ) : (
                        <span className="text-[9px] font-black uppercase text-slate-300">Exclusivo Administrador</span>
                      )}
                    </div>
                    {caseSummary && currentUser?.rol === 'Admin' && (
                      <div className="bg-white p-5 rounded-xl border-2 border-indigo-50 text-sm font-medium text-slate-700 relative shadow-sm">
                        <button onClick={() => copyToClipboard(caseSummary)} className="absolute top-3 right-3 p-2 text-indigo-400 hover:text-indigo-600 bg-indigo-50 rounded-lg transition-colors"><Copy size={16}/></button>
                        <p className="pr-8 whitespace-pre-wrap leading-relaxed text-xs">{caseSummary}</p>
                      </div>
                    )}
                    {caseForm.bitacora.length === 0 && !caseSummary && currentUser?.rol === 'Admin' && <p className="text-[10px] text-slate-400 italic font-medium uppercase tracking-widest">Agrega eventos en la bitácora para habilitar el resumen inteligente.</p>}
                  </div>

                </div>
              )}
              {activeModalTab === 'bitacora' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 h-full flex flex-col">
                  <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200 shrink-0 shadow-inner">
                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Nuevo Hito de Intervención / Gestión</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      {/* SELECTOR CON REUNIONES RESTAURADO */}
                      <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</label>
                        <select value={newBitacoraEntry.tipo} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, tipo: e.target.value})} className="border-2 border-white p-3 rounded-xl text-sm font-bold shadow-sm outline-none focus:border-blue-300 cursor-pointer">
                          <option value="Nota Adm.">📝 Nota Adm.</option>
                          <option value="Intervención">🗣️ Intervención</option>
                          <option value="Reunión">🤝 Reunión de Red</option>
                          <option value="Tarea">🎯 Tarea Enlace</option>
                        </select>
                      </div>
                      
                      <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable</label><input type="text" value={newBitacoraEntry.responsable} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, responsable: e.target.value})} className="border-2 border-white p-3 rounded-xl text-sm font-bold shadow-sm outline-none focus:border-blue-300" placeholder="Ej: Ps. Silva" /></div>
                      
                      <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción / Acuerdos</label>
                        <textarea rows="2" value={newBitacoraEntry.descripcion} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, descripcion: e.target.value})} className="border-2 border-white p-3 rounded-xl text-sm font-medium shadow-sm outline-none focus:border-blue-300 resize-y" placeholder="Detalle de la acción, reunión o tarea... (Presiona Enter para nuevo párrafo)" />
                      </div>
                      
                      {newBitacoraEntry.tipo === 'Tarea' && (
                         <div className="flex flex-col gap-2 md:col-span-4 mt-2">
                           <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Fecha Límite para Tarea</label>
                           <input type="date" value={newBitacoraEntry.fechaCumplimiento} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, fechaCumplimiento: e.target.value})} className="border-2 border-amber-200 p-3 rounded-xl text-sm font-bold shadow-sm outline-none focus:border-amber-400 text-amber-800 bg-amber-50/50" />
                         </div>
                      )}
                    </div>
                    <div className="flex justify-end"><button onClick={handleAddBitacora} disabled={!newBitacoraEntry.descripcion} className="bg-blue-600 text-white px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 shadow-md transition-all flex items-center gap-2"><Plus size={14}/> Registrar Acción</button></div>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-3 pt-2">Evolución Cronológica</h4>
                    {caseForm.bitacora.map(entry => (
                      <div key={entry.id} className="p-6 bg-white border-2 border-slate-100 rounded-2xl shadow-sm flex gap-5 items-start group hover:border-blue-200 transition-all">
                        <div className="p-3 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors shrink-0">
                          {entry.tipo === 'Intervención' ? <Activity size={18}/> : entry.tipo === 'Reunión' ? <Users size={18}/> : entry.tipo === 'Tarea' ? <CheckSquare size={18} className="text-amber-500"/> : <MessageSquare size={18}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg tracking-widest">{entry.tipo}</span><span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><Calendar size={12}/> {entry.fecha}</span></div>
                          <p className="text-sm font-medium text-slate-700 leading-relaxed mb-3 whitespace-pre-wrap">{entry.descripcion}</p>
                          <div className="flex gap-3 items-center">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic bg-slate-50 px-3 py-1.5 rounded-lg w-fit border border-slate-100">Resp: {entry.responsable || 'No indicado'}</p>
                            {entry.tipo === 'Tarea' && entry.fechaCumplimiento && <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-lg w-fit border border-amber-100 flex items-center gap-1.5"><Timer size={12}/> Vence: {entry.fechaCumplimiento}</p>}
                          </div>
                        </div>
                        <button onClick={() => setCaseForm({ ...caseForm, bitacora: caseForm.bitacora.filter(b => b.id !== entry.id) })} className="opacity-0 group-hover:opacity-100 p-2.5 text-slate-400 hover:text-red-500 transition-all bg-slate-50 rounded-lg hover:bg-red-50"><Trash2 size={18}/></button>
                      </div>
                    ))}
                    {caseForm.bitacora.length === 0 && (<div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-2xl"><Activity size={28} className="text-slate-200 mx-auto mb-3"/><p className="text-slate-400 font-bold text-xs uppercase tracking-widest italic">Sin registros en bitácora</p></div>)}
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-4 shrink-0">
              <button onClick={() => setIsCaseModalOpen(false)} className="px-8 py-3.5 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-700 transition-all">Cancelar</button>
              <button onClick={handleSaveCase} className="px-10 py-3.5 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg hover:bg-black transition-all flex items-center gap-2"><CheckCircle size={18}/> Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL PROTOCOLOS */}
      {isDocModalOpen && (
        <div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="bg-blue-600 p-6 text-white flex justify-between items-center shrink-0 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
               <div className="flex items-center gap-4 relative z-10"><div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/20"><FileText size={24}/></div><div><h3 className="font-black text-xl uppercase tracking-widest drop-shadow-md">{editingDocId ? 'Editar Protocolo' : 'Nuevo Protocolo'}</h3></div></div>
               <button onClick={() => setIsDocModalOpen(false)} className="text-white/60 hover:text-white font-bold text-3xl transition-colors relative z-10">&times;</button>
            </div>
            
            <div className="flex bg-slate-50 border-b border-slate-200 shrink-0 px-6">
              <button onClick={() => setActiveDocModalTab('datos')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeDocModalTab === 'datos' ? 'border-blue-600 text-blue-600 bg-white shadow-inner' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>1. Datos y Observaciones</button>
              <button onClick={() => setActiveDocModalTab('bitacora')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeDocModalTab === 'bitacora' ? 'border-blue-600 text-blue-600 bg-white shadow-inner' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>2. Tareas de Redacción</button>
              <button onClick={() => setActiveDocModalTab('archivos')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeDocModalTab === 'archivos' ? 'border-blue-600 text-blue-600 bg-white shadow-inner' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>3. Archivos Anexos</button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-white">
              {activeDocModalTab === 'datos' && (
                <div className="space-y-6 animate-in slide-in-from-left-4">
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre del Documento Normativo</label><input type="text" value={docForm.nombre} onChange={e=>setDocForm({...docForm, nombre: e.target.value})} className="w-full border-2 border-slate-100 p-4 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors" placeholder="Ej: Vía Clínica Agitación Psicomotora..." /></div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ámbito de Aplicación</label><select value={docForm.ambito} onChange={e=>setDocForm({...docForm, ambito: e.target.value})} className="w-full border-2 border-slate-100 p-4 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors cursor-pointer"><option>Red Integral</option><option>Hospitalario</option><option>COSAM</option></select></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fase Actual</label><select value={docForm.fase} onChange={e=>setDocForm({...docForm, fase: e.target.value})} className="w-full border-2 border-slate-100 p-4 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors cursor-pointer"><option>Levantamiento</option><option>Redacción</option><option>Validación Técnica</option><option>Revisión Jurídica</option><option>Resolución Exenta</option><option>Difusión</option></select></div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"><MessageSquare size={14} className="inline mr-1.5"/> Notas y Observaciones Generales</label>
                    <textarea 
                      value={docForm.notas || ''} 
                      onChange={e=>setDocForm({...docForm, notas: e.target.value})} 
                      className="w-full border-2 border-slate-100 p-4 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors resize-y min-h-[140px]" 
                      placeholder="Escribe aquí los apuntes, contexto o pensamientos sobre el proceso de creación de este protocolo. Puedes presionar Enter para crear párrafos..." 
                    />
                  </div>

                  <div className="bg-blue-50/50 p-6 rounded-2xl border-2 border-blue-100 mt-2">
                    <label className="flex justify-between items-end mb-3"><span className="block text-[10px] font-black text-blue-900 uppercase tracking-widest">Avance Estimado del Documento</span><span className="text-2xl font-black text-blue-600">{docForm.avance}%</span></label>
                    <input type="range" min="0" max="100" step="5" value={docForm.avance} onChange={e=>setDocForm({...docForm, avance: e.target.value})} className="w-full accent-blue-600 h-2.5 bg-blue-200 rounded-lg appearance-none cursor-pointer" />
                  </div>
                </div>
              )}

              {activeDocModalTab === 'bitacora' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 h-full flex flex-col">
                  <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200 shrink-0 shadow-inner">
                    <h4 className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-4">Asignar Tarea de Desarrollo</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Responsable</label><input type="text" value={newDocBitacoraEntry.responsable} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, responsable: e.target.value})} className="border-2 border-white p-3.5 rounded-xl text-sm font-bold shadow-sm outline-none focus:border-blue-300" placeholder="Ej: Abogado SS" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Fecha Límite</label><input type="date" value={newDocBitacoraEntry.fechaCumplimiento} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, fechaCumplimiento: e.target.value})} className="border-2 border-amber-200 p-3.5 rounded-xl text-sm font-bold shadow-sm outline-none focus:border-amber-400 text-amber-800 bg-amber-50/50" /></div>
                      <div className="flex flex-col gap-1.5 md:col-span-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción de la Tarea</label>
                         <textarea rows="2" value={newDocBitacoraEntry.descripcion} onChange={e=>setNewDocBitacoraEntry({...newDocBitacoraEntry, descripcion: e.target.value})} className="border-2 border-white p-3.5 rounded-xl text-sm font-medium shadow-sm outline-none focus:border-blue-300 resize-y" placeholder="Detalle de la revisión o tarea..." />
                      </div>
                    </div>
                    <div className="flex justify-end"><button onClick={handleAddDocBitacora} disabled={!newDocBitacoraEntry.descripcion} className="bg-blue-600 text-white px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-700 disabled:opacity-50 shadow-md transition-all flex items-center gap-2"><Plus size={16}/> Asignar Tarea</button></div>
                  </div>
                  <div className="flex-1 space-y-4">
                     <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-3 pt-2">Historial y Tareas del Protocolo</h4>
                     {(docForm.bitacora || []).map(entry => (
                       <div key={entry.id} className="p-5 bg-white border-2 border-slate-100 rounded-2xl shadow-sm flex gap-5 items-start group hover:border-blue-200 transition-all">
                         <div className="p-3 bg-slate-50 rounded-xl text-slate-400 shrink-0">{entry.tipo === 'Tarea' ? <CheckSquare size={18} className={entry.completada ? "text-emerald-500" : "text-amber-500"}/> : <MessageSquare size={18}/>}</div>
                         <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-center mb-1.5"><span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg tracking-widest">{entry.tipo}</span><span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5"><Calendar size={12}/> Asignada: {entry.fecha}</span></div>
                           <p className={`text-sm font-medium leading-relaxed mb-3 whitespace-pre-wrap ${entry.completada ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{entry.descripcion}</p>
                           <div className="flex gap-3 items-center">
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic bg-slate-50 px-3 py-1.5 rounded-lg w-fit border border-slate-100">Resp: {entry.responsable || 'Equipo'}</p>
                             {entry.fechaCumplimiento && <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-lg w-fit border border-amber-100 flex items-center gap-1.5"><Timer size={12}/> Vence: {entry.fechaCumplimiento}</p>}
                           </div>
                         </div>
                         <button onClick={() => setDocForm(prev => ({ ...prev, bitacora: prev.bitacora.filter(b => b.id !== entry.id) }))} className="opacity-0 group-hover:opacity-100 p-2.5 text-slate-400 hover:text-red-500 transition-all bg-slate-50 rounded-lg hover:bg-red-50"><Trash2 size={18}/></button>
                       </div>
                     ))}
                     {(!docForm.bitacora || docForm.bitacora.length === 0) && (<div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-2xl"><ListTodo size={28} className="text-slate-200 mx-auto mb-3"/><p className="text-slate-400 font-bold text-xs uppercase tracking-widest italic">Protocolo sin tareas</p></div>)}
                  </div>
                </div>
              )}

              {activeDocModalTab === 'archivos' && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <div className="bg-indigo-50/50 p-8 rounded-2xl border-2 border-indigo-100 flex flex-col text-center">
                    <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-2 flex items-center justify-center gap-2"><UploadCloud size={18}/> Subir Borrador o Anexo</h4>
                    <p className="text-xs text-indigo-700/80 mb-4 font-medium leading-relaxed">Adjunta documentos Word o PDF de respaldo para este protocolo.</p>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-indigo-300 border-dashed rounded-xl cursor-pointer bg-white hover:bg-indigo-50 transition-colors shadow-sm">
                      <div className="flex flex-col items-center justify-center pt-4 pb-5">
                        <Paperclip className="w-8 h-8 text-indigo-400 mb-2" />
                        <p className="text-[10px] text-indigo-900 font-black uppercase tracking-widest">Seleccionar Archivo</p>
                      </div>
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                  <div className="space-y-4">
                     <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-3">Archivos Vinculados</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {(docForm.archivos || []).map(file => (
                         <div key={file.id} className="flex items-center justify-between p-4 bg-white border-2 border-slate-100 rounded-xl shadow-sm group hover:border-blue-200 transition-all">
                           <div className="flex items-center gap-3 min-w-0">
                             <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg"><FileIcon size={18}/></div>
                             <div className="min-w-0"><p className="text-sm font-bold text-slate-700 truncate">{file.nombre}</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{file.size} • Subido el {file.fecha}</p></div>
                           </div>
                           <button onClick={() => setDocForm(prev => ({ ...prev, archivos: prev.archivos.filter(f => f.id !== file.id) }))} className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all bg-slate-50 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                         </div>
                       ))}
                     </div>
                     {(!docForm.archivos || docForm.archivos.length === 0) && <p className="text-center py-10 text-slate-400 font-bold text-xs uppercase tracking-widest italic">No hay archivos adjuntos.</p>}
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-4 shrink-0"><button onClick={() => setIsDocModalOpen(false)} className="px-8 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-700 transition-all">Cancelar</button><button onClick={handleSaveDoc} className="px-10 py-3 bg-blue-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-md hover:bg-blue-700 transition-all hover:-translate-y-1 flex items-center gap-2"><CheckCircle size={16}/> Guardar Protocolo</button></div>
          </div>
        </div>
      )}

      {/* 3. MODAL GESTOR DE PAUTAS */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="bg-slate-800 p-6 text-white flex justify-between items-center shrink-0 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
               <div className="flex items-center gap-4 relative z-10"><div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/20"><Settings size={24}/></div><div><h3 className="font-black text-xl uppercase tracking-widest drop-shadow-md">Gestor de Pautas</h3></div></div>
               <button onClick={() => setIsTemplateModalOpen(false)} className="text-white/60 hover:text-white font-bold text-3xl transition-colors relative z-10">&times;</button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-white">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* SECCIÓN ACTUALIZADA DE EXTRACCIÓN CON IA */}
                  <div className="bg-indigo-50/50 p-6 rounded-2xl border-2 border-indigo-100 flex flex-col text-center">
                    <h4 className="text-[11px] font-black text-indigo-900 uppercase tracking-[0.2em] mb-2 flex items-center justify-center gap-2"><Wand2 size={16}/> Extracción con IA</h4>
                    <p className="text-[10px] text-indigo-700/80 mb-4 font-medium leading-relaxed">Sube el PDF o pega el texto directamente.</p>
                    
                    <div className="flex flex-col gap-3 w-full">
                      <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-indigo-300 border-dashed rounded-xl cursor-pointer bg-white hover:bg-indigo-50 transition-colors shadow-sm">
                        <div className="flex flex-col items-center justify-center pt-2 pb-2">
                          <UploadCloud className="w-6 h-6 text-indigo-400 mb-1" />
                          <p className="text-[9px] text-indigo-900 font-black uppercase tracking-widest">1. Cargar PDF</p>
                        </div>
                        <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUploadForAI} />
                      </label>
                      
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">O LA OPCIÓN MÁS RÁPIDA:</span>
                      
                      <textarea 
                        value={rawTextForAI} 
                        onChange={e=>setRawTextForAI(e.target.value)} 
                        className="w-full border-2 border-indigo-200 p-3 rounded-xl text-xs font-medium outline-none focus:border-indigo-400 resize-y min-h-[80px]" 
                        placeholder="2. Pega el texto de la pauta aquí..."
                      />
                      <button onClick={handleProcessRawTextForAI} disabled={!rawTextForAI.trim() || isDigitizing} className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2">
                        {isDigitizing ? <Loader2 size={14} className="animate-spin"/> : <Wand2 size={14}/>} Procesar Texto
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nombre del Instrumento</label><input type="text" value={templateForm.nombre} onChange={e=>setTemplateForm({...templateForm, nombre: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-slate-800 transition-colors" placeholder="Ej: Pauta Riesgo..."/></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tipo de Actividad</label><select value={templateForm.tipo} onChange={e=>setTemplateForm({...templateForm, tipo: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-slate-800 bg-slate-50 transition-colors cursor-pointer"><option value="Ambos">Híbrida (Audit/Consult)</option><option value="Auditoría">Solo Auditorías</option><option value="Consultoría">Solo Consultorías</option></select></div>
                  </div>
                  
                  <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Rangos de Resultado (Opcional)</label>
                    <p className="text-[10px] text-slate-400 mb-3 font-medium leading-relaxed">Ej: 0 a 2 pts = Riesgo Alto.</p>
                    {templateForm.rangos.map((r, i) => (
                       <div key={i} className="flex gap-1.5 mb-2 items-center">
                          <input type="number" placeholder="Min" value={r.min} onChange={(e) => {const newR=[...templateForm.rangos]; newR[i].min=e.target.value; setTemplateForm({...templateForm, rangos: newR})}} className="w-12 border-2 border-white rounded-lg p-2.5 text-[10px] font-black text-center shadow-sm outline-none focus:border-slate-400" />
                          <span className="text-[10px] font-black text-slate-300">-</span>
                          <input type="number" placeholder="Max" value={r.max} onChange={(e) => {const newR=[...templateForm.rangos]; newR[i].max=e.target.value; setTemplateForm({...templateForm, rangos: newR})}} className="w-12 border-2 border-white rounded-lg p-2.5 text-[10px] font-black text-center shadow-sm outline-none focus:border-slate-400" />
                          <input type="text" placeholder="Ej: Parcial" value={r.resultado} onChange={(e) => {const newR=[...templateForm.rangos]; newR[i].resultado=e.target.value; setTemplateForm({...templateForm, rangos: newR})}} className="flex-1 border-2 border-white rounded-lg p-2.5 text-xs font-bold shadow-sm outline-none focus:border-slate-400" />
                          <button onClick={()=>{const newR=[...templateForm.rangos]; newR.splice(i,1); setTemplateForm({...templateForm, rangos: newR});}} className="p-2.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={14}/></button>
                       </div>
                    ))}
                    <button onClick={()=>setTemplateForm({...templateForm, rangos: [...templateForm.rangos, {min:'', max:'', resultado:''}]})} className="text-[10px] text-indigo-600 font-black uppercase tracking-widest flex items-center gap-1.5 mt-4 hover:text-indigo-800 transition-colors"><Plus size={14}/> Añadir Rango</button>
                  </div>
                </div>

                <div className="lg:col-span-3 flex flex-col">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Criterios a Evaluar (Checklist SÍ / NO)</label>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    {templateForm.criterios.map((c, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="p-3 bg-slate-100 text-slate-400 rounded-xl text-xs font-black shrink-0">{i+1}</div>
                        <textarea rows="2" value={c} onChange={e=>{const newC=[...templateForm.criterios]; newC[i]=e.target.value; setTemplateForm({...templateForm, criterios: newC});}} className="flex-1 border-2 border-slate-100 p-3 rounded-xl text-sm font-medium outline-none focus:border-slate-800 transition-colors resize-y" placeholder="Redacta el punto a evaluar..."/>
                        <button onClick={()=>{const newC=[...templateForm.criterios]; newC.splice(i,1); setTemplateForm({...templateForm, criterios: newC});}} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>setTemplateForm({...templateForm, criterios: [...templateForm.criterios, '']})} className="text-[10px] bg-slate-100 text-slate-600 px-5 py-3.5 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 mt-4 hover:bg-slate-200 transition-colors"><Plus size={16}/> Agregar Fila Manualmente</button>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-4 shrink-0"><button onClick={() => setIsTemplateModalOpen(false)} className="px-8 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-700 transition-colors">Cancelar</button><button onClick={handleSaveTemplate} className="px-10 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-lg hover:bg-black transition-all flex items-center gap-2"><CheckCircle size={16}/> Guardar Pauta Oficial</button></div>
          </div>
        </div>
      )}

      {/* 4. MODAL REALIZAR AUDITORÍA / CHECKLIST */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
             <div className="bg-blue-600 p-6 text-white font-black text-lg uppercase tracking-widest flex justify-between shrink-0 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
               <div className="flex items-center gap-3 relative z-10"><ClipboardCheck size={24}/> Pauta Terreno</div>
               <button onClick={() => setIsAuditModalOpen(false)} className="text-white/60 hover:text-white font-bold text-3xl relative z-10 transition-colors">&times;</button>
             </div>
             
             <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 bg-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tipo de Actividad</label>
                    <select disabled value={auditForm.tipo} className="w-full p-0 border-none bg-transparent text-slate-800 font-black text-sm outline-none appearance-none"><option>{auditForm.tipo}</option></select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Dispositivo a Evaluar</label>
                    <select value={auditForm.centro} onChange={e=>setAuditForm({...auditForm, centro: e.target.value})} className="w-full p-3 border-2 border-slate-100 rounded-xl bg-white font-bold text-sm outline-none focus:border-blue-500 cursor-pointer transition-colors shadow-sm"><option value="">Seleccione...</option>{centros.map(c=><option key={c}>{c}</option>)}</select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Instrumento / Pauta</label>
                  <select value={auditForm.templateId} onChange={e=>setAuditForm({...auditForm, templateId: e.target.value, answers: {}})} className="w-full p-4 border-2 border-blue-100 rounded-xl bg-blue-50/30 text-blue-900 font-bold text-sm outline-none focus:border-blue-500 cursor-pointer transition-colors shadow-sm"><option value="">Seleccione una pauta del catálogo...</option>{auditTemplates.filter(t => t.tipo === 'Ambos' || t.tipo === auditForm.tipo).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
                </div>
                
                {/* CHECKLIST COMPACTO */}
                <div className="space-y-4 border-t-2 border-slate-100 pt-6">
                   <div className="flex justify-between items-center bg-slate-800 text-white p-5 rounded-2xl shadow-md">
                     <span className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><CheckSquare size={18}/> Checklist SÍ/NO</span>
                     <span className="bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase shadow-inner">Puntaje: {Object.values(auditForm.answers).filter(a => a === 'si').length} / {auditTemplates.find(t => t.id === auditForm.templateId)?.criterios.length || 0}</span>
                   </div>
                   
                   <div className="space-y-3">
                     {auditTemplates.find(t => t.id === auditForm.templateId)?.criterios.map((criterio, idx) => (
                       <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white rounded-2xl border-2 border-slate-100 hover:border-blue-200 transition-colors shadow-sm">
                         <span className="text-slate-700 font-bold text-sm flex-1 leading-relaxed">{criterio}</span>
                         <div className="flex gap-2 shrink-0">
                           <label className={`flex items-center justify-center w-16 py-2.5 rounded-xl cursor-pointer transition-all font-black text-[10px] uppercase tracking-widest border-2 ${auditForm.answers[idx] === 'si' ? 'bg-emerald-50 text-emerald-600 border-emerald-300 shadow-sm' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'}`}><input type="radio" name={`crit-${idx}`} value="si" checked={auditForm.answers[idx] === 'si'} onChange={() => setAuditForm({...auditForm, answers: {...auditForm.answers, [idx]: 'si'}})} className="hidden" />SÍ</label>
                           <label className={`flex items-center justify-center w-16 py-2.5 rounded-xl cursor-pointer transition-all font-black text-[10px] uppercase tracking-widest border-2 ${auditForm.answers[idx] === 'no' ? 'bg-red-50 text-red-600 border-red-300 shadow-sm' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'}`}><input type="radio" name={`crit-${idx}`} value="no" checked={auditForm.answers[idx] === 'no'} onChange={() => setAuditForm({...auditForm, answers: {...auditForm.answers, [idx]: 'no'}})} className="hidden" />NO</label>
                         </div>
                       </div>
                     ))}
                     {(!auditForm.templateId) && <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs italic">Selecciona una pauta arriba para cargar el checklist.</div>}
                   </div>
                </div>
             </div>
             
             <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-3 shrink-0"><button onClick={() => setIsAuditModalOpen(false)} className="px-8 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-700 transition-colors">Cancelar</button><button onClick={handleSaveAudit} disabled={!auditForm.templateId || !auditForm.centro} className="px-10 py-3 bg-blue-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-md hover:bg-blue-700 transition-all disabled:opacity-50">Cerrar Evaluación</button></div>
          </div>
        </div>
      )}

      {/* 5. MODAL DIRECTORIO */}
      {isDirModalOpen && (
        <div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="bg-blue-600 p-6 text-white flex justify-between items-center shrink-0">
               <h3 className="font-black text-lg uppercase tracking-widest">{editingDirId ? 'Editar Contacto' : 'Nuevo Contacto'}</h3>
               <button onClick={() => setIsDirModalOpen(false)} className="text-white/60 hover:text-white font-bold text-3xl">&times;</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nombre Completo</label><input type="text" value={dirForm.nombre} onChange={e=>setDirForm({...dirForm, nombre: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500" placeholder="Ej: Ps. Carlos Pinto" /></div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Institución / Centro</label><input type="text" value={dirForm.institucion} onChange={e=>setDirForm({...dirForm, institucion: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500" placeholder="Ej: COSAM Puerto Montt" /></div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cargo</label><input type="text" value={dirForm.cargo} onChange={e=>setDirForm({...dirForm, cargo: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500" placeholder="Ej: Psicólogo Clínico" /></div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Teléfono</label><input type="text" value={dirForm.telefono} onChange={e=>setDirForm({...dirForm, telefono: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500" placeholder="+56 9..." /></div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Correo Electrónico</label><input type="email" value={dirForm.correo} onChange={e=>setDirForm({...dirForm, correo: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500" placeholder="correo@red.cl" /></div>
            </div>
            <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-3 shrink-0"><button onClick={() => setIsDirModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-700">Cancelar</button><button onClick={handleSaveDir} className="px-8 py-3 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-md hover:bg-blue-700">Guardar</button></div>
          </div>
        </div>
      )}

      {/* 6. MODAL USUARIOS */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black text-lg uppercase tracking-widest flex items-center gap-3"><UserPlus size={20}/> {editingUserId ? 'Editar Credencial' : 'Nueva Credencial'}</h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-white font-bold text-3xl">&times;</button>
            </div>
            <div className="p-6 md:p-8 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">RUT Acceso *</label><input type="text" value={userForm.rut} onChange={e=>setUserForm({...userForm, rut: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" placeholder="11.111.111-1"/></div>
                <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contraseña *</label><input type="text" value={userForm.password} onChange={e=>setUserForm({...userForm, password: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" placeholder="••••••"/></div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3"><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nombre Completo *</label><input type="text" value={userForm.nombre} onChange={e=>setUserForm({...userForm, nombre: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" placeholder="Dra. Andrea Silva"/></div>
                <div className="col-span-1"><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Iniciales</label><input type="text" value={userForm.iniciales} onChange={e=>setUserForm({...userForm, iniciales: e.target.value.toUpperCase()})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold text-center outline-none focus:border-indigo-500" placeholder="AS" maxLength={3}/></div>
              </div>
              <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cargo Institucional</label><input type="text" value={userForm.cargo} onChange={e=>setUserForm({...userForm, cargo: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" placeholder="Ej: Directora COSAM"/></div>
              <div className="border-t-2 border-slate-100 pt-4 mt-2">
                <label className="block text-[10px] font-black text-slate-800 mb-2 uppercase tracking-widest">Nivel de Privilegios</label>
                <select value={userForm.rol} onChange={e=>setUserForm({...userForm, rol: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-black outline-none focus:border-indigo-500 mb-3 bg-slate-50 text-slate-600 cursor-pointer">
                  <option value="Usuario">Usuario Clínico Estándar (Limitado)</option>
                  <option value="Admin">Administrador UHCIP (Acceso Total)</option>
                </select>
                {userForm.rol === 'Usuario' && (
                  <div className="bg-indigo-50 p-4 rounded-2xl border-2 border-indigo-100">
                    <p className="text-[9px] text-indigo-800 font-black uppercase tracking-widest mb-3">Dispositivos Permitidos:</p>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-2">
                      {centros.map(c => (
                        <label key={c} className="flex items-center gap-3 text-sm font-bold text-slate-700 cursor-pointer p-2 hover:bg-indigo-100 rounded-lg transition-colors">
                          <input type="checkbox" checked={userForm.centrosAsignados.includes(c)} onChange={() => { const isAsignado = userForm.centrosAsignados.includes(c); setUserForm({ ...userForm, centrosAsignados: isAsignado ? userForm.centrosAsignados.filter(x => x !== c) : [...userForm.centrosAsignados, c] }); }} className="w-4 h-4 accent-indigo-600" /> {c}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsUserModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-700">Cancelar</button>
              <button onClick={handleSaveUser} className="px-8 py-3 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-md hover:bg-indigo-700">Guardar Credencial</button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL PERFIL CONTRASEÑA */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="bg-blue-600 p-6 text-white flex justify-between items-center shrink-0"><h3 className="font-black text-lg uppercase tracking-widest flex items-center gap-2"><Key size={20}/> Seguridad</h3><button onClick={() => setIsProfileModalOpen(false)} className="text-white/60 hover:text-white font-bold text-3xl">&times;</button></div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contraseña Actual</label><input type="password" value={passwordForm.current} onChange={e=>setPasswordForm({...passwordForm, current: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500" placeholder="••••••"/></div>
              <div className="border-t-2 border-slate-100 pt-4 mt-2"><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nueva Contraseña</label><input type="password" value={passwordForm.new} onChange={e=>setPasswordForm({...passwordForm, new: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500" placeholder="••••••"/></div>
              <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Repetir Nueva Contraseña</label><input type="password" value={passwordForm.confirm} onChange={e=>setPasswordForm({...passwordForm, confirm: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500" placeholder="••••••"/></div>
            </div>
            <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-3 shrink-0"><button onClick={() => setIsProfileModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-700 transition-colors">Cancelar</button><button onClick={handleUpdatePassword} className="px-8 py-3 bg-blue-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-md hover:bg-blue-700 transition-colors">Actualizar</button></div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .fade-in { animation: fadeIn 0.4s ease-out; }
        .animate-in { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}

const StatusBadge = ({ status }) => {
  if(status === 'Alerta') return <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 animate-pulse shadow-sm border border-red-200 w-fit"><AlertTriangle size={10} /> Alerta</span>;
  if(status === 'Pendiente') return <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 shadow-sm border border-amber-200 w-fit"><Clock size={10} /> En Tránsito</span>;
  if(status === 'Concretado') return <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 shadow-sm border border-emerald-200 w-fit"><CheckCircle size={10} /> Cerrado</span>;
  return <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border border-slate-200 w-fit">{status}</span>;
};