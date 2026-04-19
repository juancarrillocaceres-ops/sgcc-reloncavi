import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, Users, FileText, AlertTriangle, CheckCircle, Clock, Plus, Activity, LogOut,
  Bell, Copy, Loader2, Edit2, Trash2, ListTodo, MessageSquare, CheckSquare, Square, Calendar,
  UploadCloud, Paperclip, File as FileIcon, Lock, User, ClipboardCheck, BookOpen, Download,
  Wand2, Settings, UserPlus, Shield, Key, Timer, TrendingUp, BarChart3, Target, Printer
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

// Conversor de Opciones (De string a objeto y viceversa)
const parseOpciones = (str) => {
  if (!str) return [{ label: 'SÍ', value: 1 }, { label: 'NO', value: 0 }];
  return str.split(',').map(o => {
    const parts = o.split('=');
    return { label: parts[0]?.trim() || '', value: Number(parts[1]) || 0 };
  }).filter(o => o.label !== '');
};

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
    tutor: { nombre: '', relacion: '', telefono: '' }, referentes: [], bitacora: [], archivos: [], epicrisis: '' 
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
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  
  // Nuevo formato de auditoría dinámica
  const [auditForm, setAuditForm] = useState({ centro: '', templateId: '', headerAnswers: {}, answers: {}, tipo: 'Auditoría', observaciones: '' });
  
  // Nuevo formato de pauta dinámica
  const [templateForm, setTemplateForm] = useState({ 
    nombre: '', 
    encabezados: [{ id: 'enc_1', label: 'Servicio de Salud', type: 'text' }, { id: 'enc_2', label: 'Fecha', type: 'date' }], 
    criterios: [{ id: 'crit_1', pregunta: '', opciones: 'SÍ=1, NO=0' }], 
    rangos: [], 
    tipo: 'Ambos' 
  });
  
  const [printingAudit, setPrintingAudit] = useState(null);
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

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); alert("Copiado al portapapeles"); };

  // --- IA Y GENERACIÓN DINÁMICA ---
  const extractFormFromAI = async (prompt, inlineData = null) => {
    if (!appConfig.apiKey) throw new Error("Falta configurar la Clave API de IA en Configuración.");
    setIsDigitizing(true);
    
    const fullPrompt = `${prompt}\n\nREGLA ESTRICTA: Devuelve ÚNICAMENTE un objeto JSON con este formato exacto (sin markdown, sin \`\`\`json, sin texto adicional):\n{ "encabezados": [ {"id": "enc_1", "label": "Ej: Servicio", "type": "text"}, {"id": "enc_2", "label": "Ej: Fecha", "type": "date"} ], "criterios": [ {"id": "crit_1", "pregunta": "Texto del criterio", "opciones": "SÍ=1, NO=0"} ] }\nPara las opciones, usa el formato 'Etiqueta=Valor, Etiqueta=Valor'. Deduce inteligentemente los encabezados y opciones que la pauta necesite.`;

    try {
      const result = await generateTextWithRetry(appConfig.apiKey, fullPrompt, "", inlineData);
      const cleanJsonStr = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanJsonStr);
      
      if (!parsedData.criterios || parsedData.criterios.length === 0) throw new Error("No se encontraron criterios.");
      
      setTemplateForm({
        ...templateForm,
        nombre: templateForm.nombre || 'Pauta Extraída',
        encabezados: parsedData.encabezados || [],
        criterios: parsedData.criterios || []
      });
      alert(`¡Pauta digitalizada exitosamente con ${parsedData.criterios.length} criterios! Revisa los campos y ajusta si es necesario.`);
    } catch (err) { 
      console.error(err);
      alert("La IA no pudo procesar el documento o el formato. Intenta copiando fragmentos más pequeños o revisa tu Llave API."); 
    } finally { 
      setIsDigitizing(false); 
      setRawTextForAI('');
    }
  };

  const handleProcessRawTextForAI = () => {
    if (!rawTextForAI.trim()) return;
    extractFormFromAI(`Analiza este texto de una pauta o instrumento de evaluación: \n\n${rawTextForAI}`);
  };

  const handlePdfUploadForAI = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      extractFormFromAI(`Analiza el documento adjunto y construye la pauta digital.`, { mimeType: file.type || 'application/pdf', data: base64Data });
    };
    reader.onerror = () => alert("Error al leer el archivo desde el navegador.");
    reader.readAsDataURL(file);
  };

  // --- GUARDADOS EN NUBE Y MODALES ---
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

  const handleCaseFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const newFile = { id: Date.now().toString(), nombre: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB', fecha: new Date().toISOString().split('T')[0] };
    setCaseForm(prev => ({ ...prev, archivos: [...(prev.archivos || []), newFile] }));
  };

  const handleSaveTemplate = async () => {
    const validCriterios = templateForm.criterios.filter(c => c.pregunta?.trim() !== '');
    if (!templateForm.nombre || validCriterios.length === 0) return alert("Ingresa un nombre y al menos un criterio válido.");
    
    // Normalizar para compatibilidad (asegurar id en criterios)
    const normCriterios = validCriterios.map((c, i) => ({ ...c, id: c.id || `crit_${Date.now()}_${i}` }));

    const finalId = editingTemplateId || `TPL-${Date.now()}`;
    await saveToCloud('auditTemplates', finalId, { 
      id: finalId, 
      nombre: templateForm.nombre, 
      tipo: templateForm.tipo, 
      encabezados: templateForm.encabezados || [],
      criterios: normCriterios, 
      rangos: templateForm.rangos || [] 
    });
    setIsTemplateModalOpen(false);
    setEditingTemplateId(null);
  };

  const openTemplateEditor = (t) => {
    // Normalizar pautas antiguas que eran arreglos de strings
    const normCriterios = t.criterios.map((c, i) => {
      if (typeof c === 'string') return { id: `crit_${i}`, pregunta: c, opciones: 'SÍ=1, NO=0' };
      return c;
    });
    setEditingTemplateId(t.id);
    setTemplateForm({ 
      nombre: t.nombre, 
      encabezados: t.encabezados || [{ id: 'enc_1', label: 'Centro', type: 'text' }, { id: 'enc_2', label: 'Fecha', type: 'date' }],
      criterios: normCriterios, 
      rangos: t.rangos || [], 
      tipo: t.tipo || 'Ambos' 
    });
    setIsTemplateModalOpen(true);
  };

  const handleSaveAudit = async () => {
    const selectedTemplate = auditTemplates.find(t => t.id === auditForm.templateId);
    if (!selectedTemplate) return;
    
    let maxScore = 0;
    let actualScore = 0;

    // Calculo dinámico basado en las opciones guardadas
    selectedTemplate.criterios.forEach((c, idx) => {
      const isOldFormat = typeof c === 'string';
      const opcionesStr = isOldFormat ? 'SÍ=1, NO=0' : (c.opciones || 'SÍ=1, NO=0');
      const ops = parseOpciones(opcionesStr);
      
      maxScore += Math.max(...ops.map(o => o.value));
      
      const answer = auditForm.answers[c.id || idx];
      if (answer) {
        actualScore += answer.value;
      }
    });

    const scorePercentage = maxScore > 0 ? Math.round((actualScore / maxScore) * 100) : 0;
    
    let estadoTexto = scorePercentage >= 75 ? 'Óptimo' : 'Riesgo';
    if (selectedTemplate.rangos && selectedTemplate.rangos.length > 0) {
       const match = selectedTemplate.rangos.find(r => actualScore >= Number(r.min) && actualScore <= Number(r.max));
       if (match) estadoTexto = match.resultado;
    }

    const finalId = `AUD-${Date.now()}`;
    await saveToCloud('audits', finalId, { 
       id: finalId, 
       centro: auditForm.centro, 
       tipo: auditForm.tipo, 
       templateId: selectedTemplate.id, 
       headerAnswers: auditForm.headerAnswers || {},
       answers: auditForm.answers || {},
       cumplimiento: scorePercentage, 
       puntaje: `${actualScore} / ${maxScore}`, 
       estado: estadoTexto, 
       evaluador: currentUser.nombre, 
       fecha: new Date().toISOString().split('T')[0],
       observaciones: auditForm.observaciones || '' 
    });
    setIsAuditModalOpen(false);
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

  // ================= VISTAS ESPECIALES =================
  
  if (printingAudit) {
    const template = auditTemplates.find(t => t.id === printingAudit.templateId);
    if (!template) return <div className="p-10 text-red-500">Error: Pauta no encontrada.</div>;

    // Normalizar viejos formatos
    const isOldFormat = typeof template.criterios[0] === 'string';
    const criterios = isOldFormat ? template.criterios.map((c,i) => ({id: i, pregunta: c, opciones: 'SÍ=1, NO=0'})) : template.criterios;

    return (
      <div className="bg-white text-black min-h-screen w-full absolute inset-0 z-[100] font-sans">
        <div className="max-w-4xl mx-auto p-12 print:p-0 print:m-0 print:w-full print:max-w-full">
           <div className="flex justify-end gap-3 mb-8 print:hidden">
             <button onClick={() => window.print()} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg"><Printer size={16}/> Confirmar Impresión</button>
             <button onClick={() => setPrintingAudit(null)} className="bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest">Cerrar</button>
           </div>

           <div className="border-b-2 border-slate-800 pb-5 mb-8">
             <h1 className="text-2xl font-black text-center uppercase tracking-widest">{template.nombre}</h1>
             <p className="text-center text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Aplicada en terreno - SGCC-SM Reloncaví</p>
           </div>
           
           {/* Encabezados Dinámicos */}
           <div className="grid grid-cols-2 gap-6 mb-10 text-sm border-2 border-slate-200 p-6 rounded-2xl">
             <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dispositivo Evaluado</span><span className="font-bold text-slate-800 text-base">{printingAudit.centro}</span></div>
             {(template.encabezados || []).map(h => (
                <div key={h.id} className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{h.label}</span>
                  <span className="font-bold text-slate-800 text-base">{printingAudit.headerAnswers?.[h.id] || '---'}</span>
                </div>
             ))}
           </div>

           <table className="w-full text-left border-collapse border-2 border-slate-200 mb-10">
             <thead>
               <tr className="bg-slate-100 border-b-2 border-slate-200">
                 <th className="p-4 text-[10px] font-black uppercase tracking-widest w-12 text-center border-r-2 border-slate-200">Nº</th>
                 <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-slate-200">Criterio Evaluado</th>
                 <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center w-32 border-r-2 border-slate-200">Respuesta</th>
                 <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center w-16">Valor</th>
               </tr>
             </thead>
             <tbody>
               {criterios.map((c, i) => {
                 // Soportar respuestas viejas ('si'/'no') y nuevas (objetos)
                 const rawAns = printingAudit.answers[c.id];
                 let label = '---'; let val = 0;
                 if (typeof rawAns === 'object') { label = rawAns.label; val = rawAns.value; }
                 else if (rawAns === 'si') { label = 'SÍ'; val = 1; }
                 else if (rawAns === 'no') { label = 'NO'; val = 0; }

                 return (
                 <tr key={i} className="border-b border-slate-200">
                   <td className="p-4 text-sm font-black text-center text-slate-400 border-r-2 border-slate-200">{i+1}</td>
                   <td className="p-4 text-sm font-medium text-slate-800 border-r-2 border-slate-200 leading-relaxed">{c.pregunta}</td>
                   <td className="p-4 text-center font-black text-sm border-r-2 border-slate-200 text-indigo-600">{label}</td>
                   <td className="p-4 text-center font-black text-sm text-slate-500">{val}</td>
                 </tr>
                 )
               })}
             </tbody>
           </table>

           <div className="flex justify-end mb-10">
              <div className="border-2 border-slate-200 p-6 rounded-2xl w-72 text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Puntaje / Porcentaje</p>
                <p className="text-4xl font-black text-slate-800">{printingAudit.puntaje}</p>
                <p className="text-sm font-black text-slate-600 uppercase tracking-widest mt-2">{printingAudit.estado}</p>
              </div>
           </div>

           {printingAudit.observaciones && (
             <div className="mb-12">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b-2 border-slate-800 pb-2">Observaciones Generales</h3>
                <div className="p-5 border-2 border-slate-100 rounded-2xl text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                   {printingAudit.observaciones}
                </div>
             </div>
           )}

           <div className="mt-20 pt-12 border-t-2 border-slate-200 flex justify-between px-16">
              <div className="text-center">
                 <div className="w-56 border-b-2 border-slate-800 mb-3"></div>
                 <p className="text-xs font-black uppercase tracking-widest text-slate-800">{printingAudit.evaluador}</p>
                 <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Evaluador SGCC-SM</p>
              </div>
              <div className="text-center">
                 <div className="w-56 border-b-2 border-slate-800 mb-3"></div>
                 <p className="text-xs font-black uppercase tracking-widest text-slate-800">Firma de Recepción</p>
                 <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">{printingAudit.centro}</p>
              </div>
           </div>
        </div>
      </div>
    );
  }

  // ================= PANTALLAS DE LOGIN Y APP NORMAL =================
  if (!currentUser) return (
    <div className="min-h-screen bg-[#0a2540] flex items-center justify-center p-4 fade-in">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-200"><Activity size={28} className="text-white" /></div>
          <h1 className="text-2xl font-bold text-slate-800">SGCC-SM</h1>
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Hospital Puerto Montt</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><User size={12}/> RUT DE USUARIO</label><input type="text" value={loginData.rut} onChange={(e) => setLoginData({...loginData, rut: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold" placeholder="11.111.111-1" /></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Lock size={12}/> CONTRASEÑA</label><input type="password" value={loginData.password} onChange={(e) => setLoginData({...loginData, password: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold" placeholder="••••••" /></div>
          {loginError && <p className="text-red-500 text-xs text-center font-black uppercase tracking-widest">{loginError}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all">INGRESAR AL SISTEMA</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* SIDEBAR */}
      <aside className="no-print w-full md:w-64 bg-[#0a2540] text-white flex flex-col h-screen sticky top-0 shrink-0 shadow-xl overflow-y-auto">
        <div className="p-5 border-b border-white/5"><h1 className="text-xl font-bold tracking-tight">SGCC-SM</h1><p className="text-xs text-blue-400 font-black uppercase tracking-widest mt-1">UHCIP INFANTO JUVENIL</p></div>
        <nav className="flex-1 p-3 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><LayoutDashboard size={18}/> Panel Principal</button>
          <button onClick={() => setActiveTab('stats')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'stats' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><BarChart3 size={18}/> Plazos Meta</button>
          <button onClick={() => setActiveTab('cases')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'cases' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><Users size={18}/> Casos de Red</button>
          
          <div className="pt-5 pb-2 px-4 text-[10px] font-black text-blue-400 uppercase tracking-widest">Evaluación y Red</div>
          <button onClick={() => setActiveTab('auditorias')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'auditorias' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><ClipboardCheck size={18}/> Auditorías</button>
          <button onClick={() => setActiveTab('consultorias')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'consultorias' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><MessageSquare size={18}/> Consultorías</button>

          {currentUser.rol === 'Admin' && (
             <>
               <div className="pt-5 pb-2 px-4 text-[10px] font-black text-blue-400 uppercase tracking-widest">Administración</div>
               <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><UserPlus size={18}/> Usuarios</button>
               <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'config' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-80'}`}><Settings size={18}/> Ajustes</button>
             </>
          )}
        </nav>
        <div className="p-4 border-t border-white/5 shrink-0 bg-[#071c31]">
           <button onClick={() => setCurrentUser(null)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-300 bg-red-900/30 hover:bg-red-500/30 transition-colors"><LogOut size={14}/> Salir</button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto relative no-print">
        
        {/* PESTAÑA 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in">
            <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Panel de Gestión Integral</h2></div>
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
                    <button onClick={() => handleGenerateReport('alerts')} disabled={alertCases.length === 0 || isGeneratingReport} className="w-full bg-white text-indigo-900 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg mt-auto">{isGeneratingReport ? <Loader2 size={14} className="animate-spin"/> : <MessageSquare size={14}/>} Redactar Correo</button>
                  ) : (<div className="mt-auto p-3 bg-white/10 rounded-xl text-center text-[9px] font-black uppercase tracking-widest text-indigo-300">Exclusivo Administradores</div>)}
                </div>
                {reportContent && activeTab === 'dashboard' && currentUser?.rol === 'Admin' && (
                  <div className="mt-4 bg-[#081b30] p-4 rounded-xl border border-white/10 relative z-10"><div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10"><span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">Borrador:</span><button onClick={()=>copyToClipboard(reportContent)} className="text-white hover:text-blue-300"><Copy size={12}/></button></div><p className="text-[10px] font-medium text-slate-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{reportContent}</p></div>
                )}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full -mr-10 -mt-10 blur-xl"></div>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: ESTADÍSTICAS Y PLAZOS */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between gap-4"><div><h2 className="text-2xl font-black text-slate-800">Estadísticas</h2></div><button onClick={handleExportCSV} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Download size={14}/> Exportar Excel</button></div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-center"><div className="flex items-center gap-4"><div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Target size={24}/></div><div><h3 className="font-black text-slate-800 uppercase text-[11px]">Plazo Meta Operacional</h3></div></div><div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200"><span className="text-[9px] font-black text-slate-400 ml-2 uppercase">META RED:</span>{currentUser?.rol === 'Admin' ? (<input type="number" value={targetDays} onChange={(e) => handleUpdateTarget(e.target.value)} className="w-16 p-2 bg-white border border-blue-100 rounded-lg text-center font-black text-blue-600 outline-none text-sm"/>) : (<span className="px-3 py-2 font-black text-blue-600 text-sm">{targetDays}</span>)}<span className="text-[9px] font-black text-slate-500 mr-2 uppercase">Días</span></div></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-l-[8px] border-l-indigo-500">
                <div className="flex justify-between items-start mb-3"><div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Timer size={18}/></div><span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50 px-2 py-1 rounded-lg">Hito A-B</span></div>
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Promedio Enlace</h3><p className="text-4xl font-black text-slate-800 mt-1">{redMetrics.avgEnlace} <span className="text-xs text-slate-300">Días</span></p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-l-[8px] border-l-blue-500">
                <div className="flex justify-between items-start mb-3"><div className="p-2 bg-blue-50 rounded-xl text-blue-600"><BarChart3 size={18}/></div><span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50 px-2 py-1 rounded-lg">Hito A-C</span></div>
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ingreso Efectivo</h3><p className="text-4xl font-black text-slate-800 mt-1">{redMetrics.avgIngreso} <span className="text-xs text-slate-300">Días</span></p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-l-[8px] border-l-red-500">
                <div className="flex justify-between items-start mb-3"><div className="p-2 bg-red-50 rounded-xl text-red-600"><AlertTriangle size={18}/></div><div className="px-2 py-1 bg-red-100 text-red-700 text-[8px] font-black rounded-lg uppercase tracking-[0.2em] shadow-sm">Brecha</div></div>
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Casos sobre meta</h3><p className="text-4xl font-black text-slate-800 mt-1">{redMetrics.fueraDePlazo} <span className="text-xs text-slate-300">Casos</span></p>
              </div>
            </div>
            {redMetrics.fueraDePlazo > 0 && currentUser?.rol === 'Admin' && (
              <div className="bg-gradient-to-br from-indigo-900 to-[#0a2540] rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                 <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                   <div className="max-w-2xl"><h3 className="text-lg font-black mb-2 flex items-center gap-2"><TrendingUp size={20} className="text-blue-400"/> Análisis Estratégico (IA)</h3><p className="text-xs text-blue-100 font-medium">Genera un informe directivo sobre nudos críticos.</p></div>
                   <button onClick={() => handleGenerateReport('stats')} disabled={isGeneratingReport} className="bg-white text-indigo-900 px-6 py-3 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">{isGeneratingReport ? <Loader2 size={16} className="animate-spin"/> : <FileText size={16}/>} Procesar Reporte</button>
                 </div>
                 {reportContent && activeTab === 'stats' && (
                   <div className="mt-6 bg-[#081b30] p-6 rounded-xl border border-white/10 relative z-10"><div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3"><span className="text-[9px] font-black uppercase text-blue-300">Borrador Generado:</span><button onClick={()=>copyToClipboard(reportContent)} className="text-white hover:text-blue-300"><Copy size={14}/></button></div><p className="text-xs font-medium text-slate-300 whitespace-pre-wrap">{reportContent}</p></div>
                 )}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 3: CASOS DE RED */}
        {activeTab === 'cases' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div><h2 className="text-2xl font-black text-slate-800">Casos en Red</h2></div>
              <button onClick={() => { setEditingCaseId(null); setCaseForm(defaultCaseState); setCaseSummary(''); setIsCaseModalOpen(true); }} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Plus size={16}/> Nuevo Seguimiento</button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                  <thead className="bg-slate-50 border-b border-slate-100"><tr className="text-xs font-bold text-slate-500 uppercase tracking-wider"><th className="p-4">Paciente</th><th className="p-4">Ruta Traslado</th><th className="p-4 text-center">Hitos (A-B-C)</th><th className="p-4 text-center">Estado</th><th className="p-4 text-right">Acción</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {visibleCases.map(c => {
                      const daysC = diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo);
                      const isOver = daysC !== null && daysC > targetDays;
                      return (
                        <tr key={c.id} className={`hover:bg-slate-50/80 transition-colors ${isOver ? 'bg-red-50/20' : ''}`}>
                          <td className="p-4"><div className="font-bold text-slate-800 text-sm uppercase">{c.nombre}</div><div className="text-xs font-medium text-slate-500 mt-1 whitespace-nowrap">{c.paciente}</div></td>
                          <td className="p-4"><div className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg w-fit flex items-center gap-2 uppercase whitespace-nowrap border border-blue-100">{c.origen} <Timer size={14}/> {c.destino}</div></td>
                          <td className="p-4"><div className="flex justify-center gap-6"><div className="text-center"><span className="text-[10px] font-bold text-slate-400 block uppercase">Egreso</span><span className="text-sm font-bold text-slate-700 whitespace-nowrap">{c.fechaEgreso || '---'}</span></div><div className="text-center border-l pl-6"><span className="text-[10px] font-bold text-indigo-400 block uppercase">Recep</span><span className="text-sm font-bold text-indigo-700 whitespace-nowrap">{c.fechaRecepcionRed || '---'}</span></div><div className="text-center border-l pl-6"><span className="text-[10px] font-bold text-green-500 block uppercase">Ingreso</span><span className={`text-sm font-bold whitespace-nowrap ${isOver ? 'text-red-600' : 'text-green-600'}`}>{c.fechaIngresoEfectivo || '---'}</span></div></div></td>
                          <td className="p-4"><div className="flex justify-center"><StatusBadge status={c.estado}/></div></td>
                          <td className="p-4 text-right"><button onClick={() => { setEditingCaseId(c.id); setCaseForm({ ...c, rut: c.paciente, tutor: c.tutor || {nombre:'', relacion:'', telefono:''}, referentes: c.referentes || [], archivos: c.archivos || [], epicrisis: c.epicrisis || '' }); setCaseSummary(''); setIsCaseModalOpen(true); }} className="text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 p-2.5 rounded-lg border border-slate-100"><Edit2 size={18}/></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">{tipoLabel === 'Auditoría' ? 'Auditorías Normativas' : 'Consultorías Clínicas'}</h2></div>
                <div className="flex flex-wrap gap-3">
                  <select value={currentFilter} onChange={e => setFilter(e.target.value)} className="px-3 py-2.5 border-2 border-slate-200 rounded-xl text-[10px] font-bold bg-white uppercase text-slate-600"><option value="Todos">Toda la Red</option>{centros.map(c => <option key={c} value={c}>{c}</option>)}</select>
                  {currentUser?.rol === 'Admin' && (<button onClick={() => { setEditingTemplateId(null); setTemplateForm({nombre: '', encabezados: [{ id: 'enc_1', label: 'Centro Evaluado', type: 'text' }, { id: 'enc_2', label: 'Fecha', type: 'date' }], criterios: [{ id: 'crit_1', pregunta: '', opciones: 'SÍ=1, NO=0' }], rangos: [], tipo: 'Ambos'}); setIsTemplateModalOpen(true); }} className="bg-white border-2 border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Settings size={14} /> Pautas</button>)}
                  <button onClick={() => { setAuditForm({ centro: centros[0] || '', templateId: auditTemplates.find(t => t.tipo === 'Ambos' || t.tipo === tipoLabel)?.id || '', headerAnswers: {}, answers: {}, tipo: tipoLabel, observaciones: '', fecha: new Date().toISOString().split('T')[0] }); setIsAuditModalOpen(true); }} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><ClipboardCheck size={16} /> Evaluar</button>
                </div>
              </div>
              {filteredAudits.length === 0 ? (<div className="text-center py-16 bg-white rounded-2xl border border-slate-100"><p className="text-slate-400 font-black uppercase text-[10px]">No hay evaluaciones.</p></div>) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAudits.map(a => {
                    const template = auditTemplates.find(t => t.id === a.templateId);
                    return (
                    <div key={a.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:border-blue-200 transition-colors">
                       <div className="flex items-start justify-between w-full">
                         <div>
                           <h3 className="font-black text-slate-800 uppercase text-xs mb-1">{a.centro}</h3>
                           <p className="text-[9px] text-blue-600 font-black uppercase mb-2 bg-blue-50 px-2 py-0.5 rounded w-fit">{template ? template.nombre : 'Pauta Eliminada'}</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1"><Calendar size={10}/> {a.fecha} • {a.evaluador}</p>
                         </div>
                         <div className="text-right flex flex-col items-end">
                            <div className="text-3xl font-black text-slate-800">{a.cumplimiento}%</div>
                            <span className="text-[8px] uppercase text-slate-400 font-black block mb-1.5">{a.puntaje}</span>
                            <span className={`text-[8px] uppercase px-2 py-1 rounded-lg font-black ${a.estado === 'Óptimo' || a.cumplimiento >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{a.estado}</span>
                         </div>
                       </div>
                       
                       <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
                         {a.observaciones && <p className="text-[10px] text-slate-500 font-medium italic"><MessageSquare size={12} className="inline mr-1"/> {a.observaciones}</p>}
                         <div className="flex justify-end gap-2 mt-2">
                           <button onClick={() => setPrintingAudit(a)} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-slate-200 flex items-center gap-1.5"><Printer size={12}/> Ver / Imprimir</button>
                           {currentUser?.rol === 'Admin' && (<button onClick={async () => { if(window.confirm('¿Eliminar evaluación permanente?')) await deleteFromCloud('audits', a.id); }} className="bg-red-50 text-red-500 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-red-100 flex items-center gap-1.5"><Trash2 size={12}/> Eliminar</button>)}
                         </div>
                       </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* PESTAÑA CONFIGURACIÓN */}
        {activeTab === 'config' && currentUser.rol === 'Admin' && (
          <div className="space-y-6 animate-in fade-in mt-12 md:mt-0">
            <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Configuración del Sistema</h2></div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-3xl">
               <h3 className="font-black text-slate-800 text-base flex items-center gap-2 mb-2"><Activity size={18} className="text-blue-600"/> Catálogo de Dispositivos Clínicos</h3>
               <div className="flex gap-3 mb-6"><input type="text" value={newCentroName} onChange={e=>setNewCentroName(e.target.value)} placeholder="Ej: CESFAM Carmela Carvajal..." className="border-2 border-slate-100 p-3 rounded-xl flex-1 text-xs font-bold outline-none focus:border-blue-500"/><button onClick={async ()=>{if(newCentroName.trim()) { await saveToCloud('settings', 'centros', { list: [...centros, newCentroName.trim()].sort() }); setNewCentroName(''); }}} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 hover:bg-black"><Plus size={14}/> Añadir</button></div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{centros.map(c => (<div key={c} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border-2 border-slate-100 group"><span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{c}</span><button onClick={async ()=>{ if(window.confirm(`¿Eliminar ${c}?`)) await saveToCloud('settings', 'centros', { list: centros.filter(x=>x!==c) }); }} className="text-slate-300 hover:text-red-600 p-1.5 rounded-lg bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button></div>))}</div>
            </div>

            {/* MÓDULO DE PAUTAS */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-3xl mt-6">
               <h3 className="font-black text-slate-800 text-base flex items-center gap-2 mb-2"><ClipboardCheck size={18} className="text-blue-600"/> Catálogo de Pautas Dinámicas</h3>
               <p className="text-[10px] text-slate-500 font-medium mb-6">Administra las pautas y formularios. Puedes editarlas sin afectar los resultados anteriores.</p>
               <div className="space-y-3">
                 {auditTemplates.map(t => (
                   <div key={t.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border-2 border-slate-100 hover:border-blue-200 group">
                     <div><span className="text-xs font-black text-slate-700 uppercase block">{t.nombre}</span><span className="text-[9px] font-bold text-slate-400 uppercase mt-1">{t.tipo} • {t.criterios.length} Criterios</span></div>
                     <div className="flex gap-2"><button onClick={() => openTemplateEditor(t)} className="text-slate-400 hover:text-blue-600 p-2 rounded-lg bg-white border border-slate-100"><Edit2 size={14}/></button><button onClick={async ()=>{ if(window.confirm(`¿Eliminar pauta ${t.nombre}?`)) await deleteFromCloud('auditTemplates', t.id); }} className="text-slate-400 hover:text-red-600 p-2 rounded-lg bg-white border border-slate-100"><Trash2 size={14}/></button></div>
                   </div>
                 ))}
                 {auditTemplates.length === 0 && <p className="text-[10px] text-slate-400 italic font-bold">No hay pautas registradas.</p>}
               </div>
               <button onClick={() => { setEditingTemplateId(null); setTemplateForm({nombre: '', encabezados: [{ id: 'enc_1', label: 'Dispositivo', type: 'text' }, { id: 'enc_2', label: 'Fecha', type: 'date' }], criterios: [{ id: 'crit_1', pregunta: '', opciones: 'SÍ=1, NO=0' }], rangos: [], tipo: 'Ambos'}); setIsTemplateModalOpen(true); }} className="mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 hover:bg-black"><Plus size={14}/> Crear Nueva Pauta</button>
            </div>

            {/* MÓDULO IA */}
            <div className="mt-8 bg-indigo-50 p-8 rounded-2xl border border-indigo-100 max-w-3xl">
               <h3 className="font-bold text-indigo-900 text-sm flex items-center gap-2 mb-2"><Wand2 size={18}/> Motor de Inteligencia Artificial (Gemini)</h3>
               <p className="text-xs text-indigo-700 mb-6 font-medium">Configura tu Clave API oficial de Google AI Studio. Las funciones IA automáticas son exclusivas de Administradores.</p>
               <div className="flex gap-4 items-center">
                 <input type="password" value={apiConfigKey} onChange={e=>setApiConfigKey(e.target.value)} placeholder="Ej: AIzaSyB-..." className="border-2 border-white p-4 rounded-xl flex-1 text-sm font-bold bg-white"/>
                 <button onClick={async ()=>{ await saveToCloud('settings', 'config', { ...appConfig, apiKey: apiConfigKey.trim() }); alert("¡Llave IA guardada!"); }} className="bg-indigo-600 text-white px-8 py-4 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-indigo-700"><Key size={16}/> Guardar Llave IA</button>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODALES ================= */}

      {/* MODAL GESTOR DE PAUTAS DINÁMICAS */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in no-print">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="bg-slate-800 p-6 text-white flex justify-between items-center shrink-0 relative">
               <div className="flex items-center gap-4 relative z-10"><div className="p-3 bg-white/20 rounded-xl"><Settings size={24}/></div><div><h3 className="font-black text-xl uppercase drop-shadow-md">{editingTemplateId ? 'Editar Formulario' : 'Diseñador de Pautas'}</h3></div></div>
               <button onClick={() => setIsTemplateModalOpen(false)} className="text-white/60 hover:text-white font-bold text-3xl">&times;</button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-white">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                
                {/* PANEL IZQUIERDO: EXTRACCIÓN Y CONFIG BASE */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-indigo-50/50 p-6 rounded-2xl border-2 border-indigo-100 text-center">
                    <h4 className="text-[11px] font-black text-indigo-900 uppercase tracking-[0.2em] mb-2 flex items-center justify-center gap-2"><Wand2 size={16}/> Constructor por IA</h4>
                    <p className="text-[10px] text-indigo-700/80 mb-4 font-medium leading-relaxed">Sube el PDF o pega el texto para armar el formulario completo automáticamente.</p>
                    
                    <div className="flex flex-col gap-3 w-full">
                      <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-indigo-300 border-dashed rounded-xl cursor-pointer bg-white hover:bg-indigo-50 transition-colors shadow-sm">
                        <div className="flex flex-col items-center justify-center pt-2 pb-2">
                          <UploadCloud className="w-6 h-6 text-indigo-400 mb-1" />
                          <p className="text-[9px] text-indigo-900 font-black uppercase tracking-widest">1. Cargar PDF</p>
                        </div>
                        <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUploadForAI} />
                      </label>
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">O LA OPCIÓN MÁS RÁPIDA:</span>
                      <textarea value={rawTextForAI} onChange={e=>setRawTextForAI(e.target.value)} className="w-full border-2 border-indigo-200 p-3 rounded-xl text-xs font-medium outline-none focus:border-indigo-400 resize-y min-h-[80px]" placeholder="2. Pega el texto aquí..."/>
                      <button onClick={handleProcessRawTextForAI} disabled={!rawTextForAI.trim() || isDigitizing} className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center gap-2">
                        {isDigitizing ? <Loader2 size={14} className="animate-spin"/> : <Wand2 size={14}/>} Estructurar con IA
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Nombre del Instrumento</label><input type="text" value={templateForm.nombre} onChange={e=>setTemplateForm({...templateForm, nombre: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold"/></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Tipo de Actividad</label><select value={templateForm.tipo} onChange={e=>setTemplateForm({...templateForm, tipo: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold bg-slate-50"><option value="Ambos">Híbrida (Audit/Consult)</option><option value="Auditoría">Solo Auditorías</option><option value="Consultoría">Solo Consultorías</option></select></div>
                  </div>
                  
                  {/* RANGOS */}
                  <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200">
                    <label className="block text-[10px] font-black text-slate-600 uppercase mb-2">Rangos de Resultado</label>
                    {templateForm.rangos.map((r, i) => (
                       <div key={i} className="flex gap-1.5 mb-2 items-center">
                          <input type="number" placeholder="Min" value={r.min} onChange={(e) => {const newR=[...templateForm.rangos]; newR[i].min=e.target.value; setTemplateForm({...templateForm, rangos: newR})}} className="w-12 border-2 border-white rounded-lg p-2.5 text-[10px] font-black text-center" />
                          <span className="text-[10px] font-black text-slate-300">-</span>
                          <input type="number" placeholder="Max" value={r.max} onChange={(e) => {const newR=[...templateForm.rangos]; newR[i].max=e.target.value; setTemplateForm({...templateForm, rangos: newR})}} className="w-12 border-2 border-white rounded-lg p-2.5 text-[10px] font-black text-center" />
                          <input type="text" placeholder="Ej: Riesgo" value={r.resultado} onChange={(e) => {const newR=[...templateForm.rangos]; newR[i].resultado=e.target.value; setTemplateForm({...templateForm, rangos: newR})}} className="flex-1 border-2 border-white rounded-lg p-2.5 text-xs font-bold" />
                          <button onClick={()=>{const newR=[...templateForm.rangos]; newR.splice(i,1); setTemplateForm({...templateForm, rangos: newR});}} className="p-2.5 bg-red-50 text-red-500 rounded-lg"><Trash2 size={14}/></button>
                       </div>
                    ))}
                    <button onClick={()=>setTemplateForm({...templateForm, rangos: [...templateForm.rangos, {min:'', max:'', resultado:''}]})} className="text-[10px] text-indigo-600 font-black uppercase flex items-center gap-1.5 mt-4"><Plus size={14}/> Añadir Rango</button>
                  </div>
                </div>

                {/* PANEL DERECHO: CONSTRUCTOR DINÁMICO */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                  
                  {/* ENCABEZADOS DINÁMICOS */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 bg-slate-100 p-2 rounded-lg">1. Encabezados Libres (Identificación)</label>
                    <div className="space-y-2">
                      {templateForm.encabezados.map((h, i) => (
                        <div key={i} className="flex gap-3 items-center">
                          <input type="text" value={h.label} onChange={e=>{const n=[...templateForm.encabezados]; n[i].label=e.target.value; setTemplateForm({...templateForm, encabezados: n});}} className="flex-1 border-2 border-slate-100 p-2 rounded-xl text-xs font-bold" placeholder="Ej: Nombre del Referente"/>
                          <select value={h.type} onChange={e=>{const n=[...templateForm.encabezados]; n[i].type=e.target.value; setTemplateForm({...templateForm, encabezados: n});}} className="border-2 border-slate-100 p-2 rounded-xl text-xs font-bold bg-slate-50">
                            <option value="text">Texto Corto</option>
                            <option value="date">Fecha</option>
                          </select>
                          <button onClick={()=>{const n=[...templateForm.encabezados]; n.splice(i,1); setTemplateForm({...templateForm, encabezados: n});}} className="p-2 bg-red-50 text-red-500 rounded-xl"><Trash2 size={16}/></button>
                        </div>
                      ))}
                      <button onClick={()=>setTemplateForm({...templateForm, encabezados: [...templateForm.encabezados, {id: `enc_${Date.now()}`, label: '', type: 'text'}]})} className="text-[9px] bg-slate-50 text-slate-500 px-4 py-2 rounded-lg font-black uppercase flex items-center gap-2 mt-2 border border-slate-200"><Plus size={12}/> Agregar Encabezado</button>
                    </div>
                  </div>

                  {/* CRITERIOS DINÁMICOS */}
                  <div className="flex-1 flex flex-col min-h-[400px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 bg-slate-100 p-2 rounded-lg">2. Criterios y Alternativas de Puntuación</label>
                    <div className="overflow-y-auto pr-2 space-y-4">
                      {templateForm.criterios.map((c, i) => (
                        <div key={i} className="flex flex-col gap-2 p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 relative">
                          <button onClick={()=>{const newC=[...templateForm.criterios]; newC.splice(i,1); setTemplateForm({...templateForm, criterios: newC});}} className="absolute top-3 right-3 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                          <div className="flex items-start gap-2 pr-8">
                             <div className="p-2 bg-white text-slate-400 rounded-lg text-[10px] font-black shrink-0 border border-slate-100">{i+1}</div>
                             <textarea rows="2" value={c.pregunta} onChange={e=>{const newC=[...templateForm.criterios]; newC[i].pregunta=e.target.value; setTemplateForm({...templateForm, criterios: newC});}} className="flex-1 border-2 border-white p-2.5 rounded-xl text-sm font-medium resize-y shadow-sm" placeholder="Escribe el criterio a evaluar..."/>
                          </div>
                          <div className="pl-10">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">Opciones y Puntajes (Formato: Nombre=Valor)</label>
                            <input type="text" value={c.opciones} onChange={e=>{const newC=[...templateForm.criterios]; newC[i].opciones=e.target.value; setTemplateForm({...templateForm, criterios: newC});}} className="w-full border-2 border-white p-2.5 rounded-xl text-xs font-bold text-indigo-700 shadow-sm" placeholder="Ej: SÍ=1, NO=0  o  Siempre=3, A veces=2, Nunca=0"/>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>setTemplateForm({...templateForm, criterios: [...templateForm.criterios, {id: `crit_${Date.now()}`, pregunta: '', opciones: 'SÍ=1, NO=0'}]})} className="mt-4 text-[10px] bg-slate-800 text-white px-5 py-3 rounded-xl font-black uppercase flex items-center justify-center gap-2 hover:bg-slate-900"><Plus size={14}/> Agregar Pregunta Manual</button>
                  </div>

                </div>
              </div>
            </div>
            <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-4 shrink-0"><button onClick={() => setIsTemplateModalOpen(false)} className="px-8 py-3 text-slate-500 font-bold text-xs uppercase hover:text-slate-700">Cancelar</button><button onClick={handleSaveTemplate} className="px-10 py-3 bg-slate-900 text-white font-black text-[10px] uppercase rounded-xl shadow-lg hover:bg-black flex items-center gap-2"><CheckCircle size={16}/> Guardar Formulario</button></div>
          </div>
        </div>
      )}

      {/* 4. MODAL REALIZAR AUDITORÍA / FORMULARIO DINÁMICO */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in no-print">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
             <div className="bg-blue-600 p-6 text-white font-black text-lg uppercase tracking-widest flex justify-between shrink-0 relative">
               <div className="flex items-center gap-3 relative z-10"><ClipboardCheck size={24}/> Aplicación de Pauta</div>
               <button onClick={() => setIsAuditModalOpen(false)} className="text-white/60 hover:text-white font-bold text-3xl relative z-10">&times;</button>
             </div>
             
             <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 bg-slate-50">
                {/* SELECTOR DE PAUTA BASE */}
                <div className="bg-white p-5 rounded-2xl border-2 border-slate-100">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Instrumento a Evaluar</label>
                  <select value={auditForm.templateId} onChange={e=>setAuditForm({...auditForm, templateId: e.target.value, answers: {}, headerAnswers: {}})} className="w-full p-4 border-2 border-blue-100 rounded-xl bg-blue-50 text-blue-900 font-black text-sm outline-none cursor-pointer shadow-sm">
                    <option value="">Seleccione formulario del catálogo...</option>
                    {auditTemplates.filter(t => t.tipo === 'Ambos' || t.tipo === auditForm.tipo).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>

                {auditForm.templateId && (() => {
                  const template = auditTemplates.find(t => t.id === auditForm.templateId);
                  if (!template) return null;

                  return (
                    <div className="space-y-8 animate-in fade-in">
                       {/* ENCABEZADOS DINÁMICOS */}
                       {template.encabezados && template.encabezados.length > 0 && (
                         <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b-2 border-slate-100 pb-2">Identificación de la Evaluación</h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                               <label className="block text-[10px] font-black text-slate-600 uppercase mb-1.5">Centro a Evaluar (Vinculación)</label>
                               <select value={auditForm.centro} onChange={e=>setAuditForm({...auditForm, centro: e.target.value})} className="w-full p-3 border-2 border-slate-200 rounded-xl text-xs font-bold"><option value="">Seleccione...</option>{centros.map(c=><option key={c}>{c}</option>)}</select>
                             </div>
                             {template.encabezados.map(h => (
                               <div key={h.id}>
                                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1.5">{h.label}</label>
                                  <input type={h.type} value={auditForm.headerAnswers[h.id] || ''} onChange={e=>setAuditForm({...auditForm, headerAnswers: {...auditForm.headerAnswers, [h.id]: e.target.value}})} className="w-full p-3 border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400"/>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}

                       {/* CRITERIOS DINÁMICOS */}
                       <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm">
                         <div className="flex justify-between items-center mb-6 border-b-2 border-slate-100 pb-3">
                           <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><CheckSquare size={16}/> Desarrollo de Pauta</h4>
                         </div>
                         
                         <div className="space-y-4">
                           {template.criterios.map((c, idx) => {
                             const isOldFormat = typeof c === 'string';
                             const pregunta = isOldFormat ? c : c.pregunta;
                             const critId = isOldFormat ? idx : c.id;
                             const opciones = parseOpciones(isOldFormat ? 'SÍ=1, NO=0' : c.opciones);
                             const currentAns = auditForm.answers[critId];

                             return (
                               <div key={critId} className="flex flex-col gap-3 p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-blue-200 transition-colors">
                                 <span className="text-slate-800 font-bold text-sm leading-relaxed">{idx + 1}. {pregunta}</span>
                                 <div className="flex flex-wrap gap-2 mt-2">
                                   {opciones.map((opt, i) => {
                                     const isSelected = currentAns?.label === opt.label;
                                     return (
                                       <label key={i} className={`flex items-center justify-center px-4 py-2.5 rounded-xl cursor-pointer transition-all font-black text-[10px] uppercase tracking-widest border-2 ${isSelected ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-inner' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100 shadow-sm'}`}>
                                         <input type="radio" checked={isSelected} onChange={() => setAuditForm({...auditForm, answers: {...auditForm.answers, [critId]: opt}})} className="hidden" />
                                         {opt.label} ({opt.value})
                                       </label>
                                     )
                                   })}
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                       </div>

                       <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm">
                         <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2"><MessageSquare size={14}/> Notas Clínicas o Aclaraciones (Opcional)</label>
                         <textarea rows="3" value={auditForm.observaciones || ''} onChange={e=>setAuditForm({...auditForm, observaciones: e.target.value})} className="w-full border-2 border-slate-200 p-4 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 bg-slate-50" placeholder="Observaciones generales para imprimir en el documento..."/>
                       </div>
                    </div>
                  );
                })()}
             </div>
             
             <div className="bg-white p-6 border-t-2 border-slate-100 flex justify-end gap-3 shrink-0"><button onClick={() => setIsAuditModalOpen(false)} className="px-8 py-3.5 text-slate-500 font-bold text-xs uppercase tracking-widest">Cancelar</button><button onClick={handleSaveAudit} disabled={!auditForm.templateId || !auditForm.centro} className="px-10 py-3.5 bg-blue-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50">Guardar Evaluación</button></div>
          </div>
        </div>
      )}
    </div>
  );
}