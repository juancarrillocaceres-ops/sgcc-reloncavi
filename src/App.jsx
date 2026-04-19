import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, Users, AlertTriangle, CheckCircle, Clock, Plus, Activity, LogOut,
  Bell, Copy, Loader2, Edit2, Trash2, MessageSquare, Calendar, File as FileIcon, 
  Lock, User, Download, Wand2, Timer, TrendingUp, BarChart3, Target, Shield
} from 'lucide-react';

/**
 * instrucciones para PERMANENCIA DEFINITIVA:
 * 1. Ve a tu consola de Firebase (https://console.firebase.google.com/)
 * 2. Entra en "Firestore Database" -> Pestaña "Rules" (Reglas).
 * 3. Verás una línea que dice: allow read, write: if request.time < timestamp.date(2026, 5, 18);
 * 4. Cámbiala por: allow read, write: if request.auth != null;
 * 5. Haz clic en "Publicar". 
 */

// --- CONFIGURACIÓN DE BASE DE DATOS ---
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

const apiKey = ""; 

// --- UTILIDADES ---
const diffInDays = (d1, d2) => {
  if (!d1 || !d2) return null;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  const diff = Math.abs(date2 - date1);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const generateTextWithRetry = async (prompt, systemInstruction = "", retries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      return result.candidates[0].content.parts[0].text;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ rut: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [centros, setCentros] = useState([]);
  const [cases, setCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [targetDays, setTargetDays] = useState(7); // Días meta por defecto

  const defaultCaseState = { 
    rut: '', nombre: '', edad: '', origen: '', destino: '', prioridad: 'Media', estado: 'Pendiente', 
    fechaEgreso: new Date().toISOString().split('T')[0],
    fechaRecepcionRed: '',
    fechaIngresoEfectivo: '',
    tutor: { nombre: '', relacion: '', telefono: '' }, referentes: [], bitacora: [], documentos: [] 
  };

  const [editingCaseId, setEditingCaseId] = useState(null);
  const [caseForm, setCaseForm] = useState(defaultCaseState);
  const [activeModalTab, setActiveModalTab] = useState('datos');
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [newBitacoraEntry, setNewBitacoraEntry] = useState({ tipo: 'Nota', descripcion: '', responsable: '', fechaCumplimiento: '' });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportContent, setReportContent] = useState('');

  // --- EFECTOS DE FIREBASE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token && typeof __firebase_config !== 'undefined') {
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
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), snap => setUsers(snap.docs.map(d => d.data())), console.error);
    const unsubCentros = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'centros'), snap => {
      if (snap.exists() && snap.data().list) setCentros(snap.data().list);
    }, console.error);
    
    // Escuchar configuración de Plazo Meta
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), snap => {
      if (snap.exists() && snap.data().targetDays) setTargetDays(snap.data().targetDays);
    });

    return () => { unsubCases(); unsubUsers(); unsubCentros(); unsubConfig(); };
  }, [firebaseUser]);

  const saveToCloud = async (coll, id, data) => {
    if (!firebaseUser) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id.toString()), data);
  };

  const handleUpdateTarget = async (days) => {
    const newDays = parseInt(days);
    if (isNaN(newDays)) return;
    setTargetDays(newDays);
    await saveToCloud('settings', 'config', { targetDays: newDays });
  };

  // --- FILTROS Y MÉTRICAS ---
  const visibleCases = useMemo(() => {
    if (currentUser?.rol === 'Admin') return cases;
    return cases.filter(c => currentUser?.centrosAsignados.includes(c.origen) || currentUser?.centrosAsignados.includes(c.destino));
  }, [cases, currentUser]);

  const redMetrics = useMemo(() => {
    let sumEnlace = 0, countEnlace = 0;
    let sumIngreso = 0, countIngreso = 0;
    let alertCount = 0;

    visibleCases.forEach(c => {
      const enlaceDays = diffInDays(c.fechaEgreso, c.fechaRecepcionRed);
      const ingresoDays = diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo);

      if (enlaceDays !== null) { sumEnlace += enlaceDays; countEnlace++; }
      if (ingresoDays !== null) { 
        sumIngreso += ingresoDays; 
        countIngreso++; 
        if (ingresoDays > targetDays) alertCount++; 
      }
    });

    return {
      avgEnlace: countEnlace > 0 ? (sumEnlace / countEnlace).toFixed(1) : '---',
      avgIngreso: countIngreso > 0 ? (sumIngreso / countIngreso).toFixed(1) : '---',
      fueraDePlazo: alertCount
    };
  }, [visibleCases, targetDays]);

  const handleExportCSV = () => {
    const headers = ['ID_Seguimiento', 'RUT', 'Paciente', 'Origen', 'Destino', 'Estado', 'Fecha_Egreso', 'Fecha_Recepcion', 'Fecha_Ingreso_Efectivo', 'Plazo_Meta'];
    const rows = visibleCases.map(c => [c.id, c.paciente, c.nombre, c.origen, c.destino, c.estado, c.fechaEgreso||'', c.fechaRecepcionRed||'', c.fechaIngresoEfectivo||'', targetDays]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Continuidad_HPM_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleGenerateReport = async () => { 
    const alertCases = visibleCases.filter(c => diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo) > targetDays || c.estado === 'Alerta');
    if (alertCases.length === 0) return alert("No hay casos críticos o fuera de plazo para reportar.");
    setIsGeneratingReport(true); setReportContent('');
    const prompt = `Basado en los siguientes casos críticos que superan la meta de ${targetDays} días: ${JSON.stringify(alertCases.map(c => ({ paciente: c.nombre, destino: c.destino, estado: c.estado })))}\n\nRedacta un correo formal breve como Enfermero Supervisor de UHCIP dirigido a los dispositivos solicitando revisión de estos casos.`;
    try { setReportContent(await generateTextWithRetry(prompt)); } catch (e) { setReportContent("Error al generar reporte."); } finally { setIsGeneratingReport(false); }
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); alert("Copiado al portapapeles"); };

  // --- LOGIN ---
  const handleLogin = (e) => {
    e.preventDefault();
    const user = users.find(u => u.rut === loginData.rut && u.password === loginData.password);
    if (user) { setCurrentUser(user); setLoginError(''); } else { setLoginError('RUT o Contraseña incorrectos.'); }
  };

  // --- GESTIÓN DE CASOS ---
  const handleSaveCase = async () => { 
    if (!caseForm.rut || !caseForm.nombre) return alert("RUT y Nombre son obligatorios.");
    const finalId = editingCaseId || `CASO-${String(cases.length + 1).padStart(3, '0')}`;
    await saveToCloud('cases', finalId, { ...caseForm, id: finalId, paciente: caseForm.rut });
    setIsCaseModalOpen(false); setEditingCaseId(null); setCaseForm(defaultCaseState);
  };

  const handleAddBitacora = () => {
    if (!newBitacoraEntry.descripcion) return;
    setCaseForm({ ...caseForm, bitacora: [{ id: Date.now(), ...newBitacoraEntry, fecha: new Date().toISOString().split('T')[0] }, ...caseForm.bitacora] });
    setNewBitacoraEntry({ tipo: 'Nota', descripcion: '', responsable: '', fechaCumplimiento: '' });
  };

  // ================= RENDERIZADO =================

  if (!currentUser) return (
    <div className="min-h-screen bg-[#0a2540] flex items-center justify-center p-4 fade-in">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Activity size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">SGCC-SM</h1>
          <p className="text-xs font-black text-blue-500 uppercase tracking-widest mt-1">Hospital Puerto Montt</p>
        </div>
        
        {/* PANTALLA LIMPIA DE INGRESO (SIN BOTONES DEMO) */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><User size={12}/> RUT DE USUARIO</label>
            <input type="text" value={loginData.rut} onChange={(e) => setLoginData({...loginData, rut: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold" placeholder="11.111.111-1" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Lock size={12}/> CONTRASEÑA</label>
            <input type="password" value={loginData.password} onChange={(e) => setLoginData({...loginData, password: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold" placeholder="••••••" />
          </div>
          {loginError && <p className="text-red-500 text-[10px] text-center font-black uppercase tracking-widest">{loginError}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white font-black text-xs uppercase tracking-widest py-4 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all">INGRESAR AL SISTEMA</button>
        </form>
        
        <div className="mt-8 text-center pt-6 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter flex items-center justify-center gap-1"><Shield size={12}/> Acceso restringido personal UHCIP / Red Reloncaví</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-[#0a2540] text-white flex flex-col h-screen sticky top-0 shrink-0 shadow-xl">
        <div className="p-6 border-b border-white/5">
          <h1 className="text-xl font-bold tracking-tight">SGCC-SM</h1>
          <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1">UHCIP INFANTO JUVENIL</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-70'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => setActiveTab('cases')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'cases' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-70'}`}><Users size={18}/> Casos de Red</button>
        </nav>
        <div className="p-6 border-t border-white/5">
           <div className="flex items-center gap-3 mb-4">
             <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xs">{currentUser.iniciales}</div>
             <p className="text-[10px] text-blue-200 font-black truncate uppercase tracking-widest">{currentUser.nombre}</p>
           </div>
           <button onClick={() => setCurrentUser(null)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase text-red-300 bg-red-900/30 hover:bg-red-500/30 transition-colors"><LogOut size={14}/> Cerrar Sesión</button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        
        {/* PESTAÑA 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Indicadores de Red</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Monitoreo de plazos y brechas operativas</p>
              </div>
              <button onClick={handleExportCSV} className="bg-emerald-600 text-white px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md"><Download size={18}/> Reporte de Brechas</button>
            </div>

            {/* PANEL DE CONFIGURACIÓN DE META */}
            <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                 <div className="flex items-center gap-5">
                   <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Target size={32}/></div>
                   <div>
                     <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Ajuste de Plazo Meta Operacional</h3>
                     <p className="text-xs text-slate-500 mt-1 font-medium">Días considerados "dentro de lo esperado" según capacidad instalada actual de los dispositivos.</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border-2 border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 ml-3 uppercase tracking-widest">META RED:</span>
                    <input 
                      type="number" 
                      value={targetDays} 
                      onChange={(e) => handleUpdateTarget(e.target.value)}
                      className="w-16 p-2 bg-white border-2 border-blue-100 rounded-xl text-center font-black text-blue-600 outline-none focus:border-blue-500 text-base shadow-sm"
                    />
                    <span className="text-[10px] font-black text-slate-500 mr-3 uppercase tracking-widest">Días</span>
                 </div>
              </div>
            </div>

            {/* TARJETAS DE MÉTRICAS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 border-l-[12px] border-l-indigo-500 hover:-translate-y-1 transition-transform">
                <div className="flex justify-between items-start mb-4">
                   <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><Timer size={24}/></div>
                   <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] bg-slate-50 px-2 py-1 rounded">Hito A-B</span>
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Promedio Enlace</h3>
                <p className="text-5xl font-black text-slate-800 mt-2">{redMetrics.avgEnlace} <span className="text-base font-bold text-slate-300 uppercase tracking-widest">Días</span></p>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 border-l-[12px] border-l-blue-500 hover:-translate-y-1 transition-transform">
                <div className="flex justify-between items-start mb-4">
                   <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><BarChart3 size={24}/></div>
                   <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] bg-slate-50 px-2 py-1 rounded">Hito A-C</span>
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingreso Efectivo</h3>
                <p className="text-5xl font-black text-slate-800 mt-2">{redMetrics.avgIngreso} <span className="text-base font-bold text-slate-300 uppercase tracking-widest">Días</span></p>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 border-l-[12px] border-l-red-500 hover:-translate-y-1 transition-transform relative overflow-hidden">
                <div className="flex justify-between items-start mb-4 relative z-10">
                   <div className="p-3 bg-red-50 rounded-2xl text-red-600"><AlertTriangle size={24}/></div>
                   <div className="px-3 py-1.5 bg-red-100 text-red-700 text-[9px] font-black rounded-xl uppercase tracking-[0.2em] shadow-sm">Crítico</div>
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Superan la meta ({targetDays} días)</h3>
                <p className="text-5xl font-black text-slate-800 mt-2 relative z-10">{redMetrics.fueraDePlazo} <span className="text-base font-bold text-slate-300 uppercase tracking-widest">Casos</span></p>
                {redMetrics.fueraDePlazo > 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-10 -mt-10 blur-xl"></div>}
              </div>
            </div>

            {/* SECCIÓN IA */}
            <div className="bg-gradient-to-br from-indigo-900 to-[#0a2540] rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                 <div className="max-w-xl">
                   <h3 className="text-xl font-black mb-2 flex items-center gap-3"><Wand2 size={24} className="text-blue-300"/> Asistente Estratégico IA</h3>
                   <p className="text-sm text-blue-100 opacity-90 font-medium leading-relaxed">Genera un informe formal automático sobre los {redMetrics.fueraDePlazo} casos que superan la meta establecida para presentar a las jefaturas de la red.</p>
                 </div>
                 <button onClick={handleGenerateReport} disabled={isGeneratingReport} className="bg-white text-indigo-900 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center gap-3 shadow-lg shrink-0 disabled:opacity-50">
                   {isGeneratingReport ? <Loader2 size={18} className="animate-spin"/> : <TrendingUp size={18}/>} Redactar Reporte
                 </button>
               </div>
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
               
               {reportContent && (
                 <div className="mt-8 bg-[#081b30] p-6 rounded-3xl border border-white/10 animate-in slide-in-from-top-4 relative z-10">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Borrador Sugerido:</span>
                      <button onClick={()=>copyToClipboard(reportContent)} className="text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors"><Copy size={16}/></button>
                    </div>
                    <p className="text-sm font-medium text-slate-300 whitespace-pre-wrap leading-relaxed">{reportContent}</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* PESTAÑA 2: CASOS EN RED */}
        {activeTab === 'cases' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Casos en Red</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Gestión de la continuidad de cuidados intersectorial</p>
              </div>
              <button onClick={() => { setEditingCaseId(null); setCaseForm(defaultCaseState); setIsCaseModalOpen(true); }} className="bg-blue-600 text-white px-8 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-3"><Plus size={20}/> Nuevo Seguimiento</button>
            </div>
            
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <th className="p-6">Paciente</th>
                    <th className="p-6">Ruta de Traslado</th>
                    <th className="p-6 text-center">Hitos Críticos (A-B-C)</th>
                    <th className="p-6 text-center">Estado</th>
                    <th className="p-6 text-right">Gestión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {visibleCases.map(c => {
                    // Validar retraso contra la meta actual para pintar de rojo la fila
                    const daysC = diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo);
                    const isOver = daysC !== null && daysC > targetDays;
                    
                    return (
                      <tr key={c.id} className={`hover:bg-slate-50/80 transition-colors ${isOver ? 'bg-red-50/30' : ''}`}>
                        <td className="p-6"><div className="font-black text-slate-800 text-sm uppercase">{c.nombre}</div><div className="text-[10px] font-bold text-slate-400 mt-1">{c.paciente}</div></td>
                        <td className="p-6"><div className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-3 py-2 rounded-xl w-fit flex items-center gap-2 uppercase tracking-widest">{c.origen} <Timer size={12}/> {c.destino}</div></td>
                        <td className="p-6">
                          <div className="flex justify-center gap-8">
                             <div className="text-center"><span className="text-[8px] font-black text-slate-300 block mb-1 uppercase tracking-[0.2em]">EGRESO</span><span className="text-xs font-black text-slate-700">{c.fechaEgreso || '---'}</span></div>
                             <div className="text-center border-l border-slate-100 pl-8"><span className="text-[8px] font-black text-indigo-300 block mb-1 uppercase tracking-[0.2em]">RECEP</span><span className="text-xs font-black text-indigo-700">{c.fechaRecepcionRed || '---'}</span></div>
                             <div className="text-center border-l border-slate-100 pl-8"><span className="text-[8px] font-black text-green-400 block mb-1 uppercase tracking-[0.2em]">INGRESO</span><span className={`text-xs font-black ${isOver ? 'text-red-600' : 'text-green-600'}`}>{c.fechaIngresoEfectivo || '---'}</span></div>
                          </div>
                        </td>
                        <td className="p-6"><div className="flex justify-center"><StatusBadge status={c.estado}/></div></td>
                        <td className="p-6 text-right"><button onClick={() => { setEditingCaseId(c.id); setCaseForm({ ...c, rut: c.paciente }); setIsCaseModalOpen(true); }} className="text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 p-3 rounded-xl transition-all border border-slate-100 hover:border-blue-200"><Edit2 size={20}/></button></td>
                      </tr>
                    );
                  })}
                  {visibleCases.length === 0 && (<tr><td colSpan="5" className="p-20 text-center"><p className="text-slate-300 font-black text-sm uppercase tracking-widest">No hay registros de seguimiento en la red</p></td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL INTEGRAL DE CASOS ================= */}
      {isCaseModalOpen && (
        <div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 border border-slate-200">
            
            {/* CABECERA MODAL */}
            <div className="bg-blue-600 p-8 text-white flex justify-between items-center shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-2xl"></div>
              <div className="flex items-center gap-5 relative z-10">
                 <div className="p-4 bg-white/20 rounded-[1.5rem] backdrop-blur-sm border border-white/20"><FileIcon size={32}/></div>
                 <div>
                    <h3 className="font-black text-2xl uppercase tracking-widest drop-shadow-md">{editingCaseId ? `${caseForm.nombre}` : 'Nuevo Seguimiento'}</h3>
                    <p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.4em] mt-1">{editingCaseId || 'ASIGNANDO ID...'}</p>
                 </div>
              </div>
              <button onClick={() => setIsCaseModalOpen(false)} className="text-white/60 hover:text-white font-bold text-4xl transition-colors relative z-10">&times;</button>
            </div>
            
            {/* TABS MODAL */}
            <div className="flex bg-slate-50 border-b border-slate-200 shrink-0 px-8">
              <button onClick={() => setActiveModalTab('datos')} className={`px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeModalTab === 'datos' ? 'border-blue-600 text-blue-600 bg-white shadow-inner' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>1. Hitos de Red</button>
              <button onClick={() => setActiveModalTab('bitacora')} className={`px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeModalTab === 'bitacora' ? 'border-blue-600 text-blue-600 bg-white shadow-inner' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>2. Bitácora Clínica</button>
            </div>

            {/* CONTENIDO MODAL */}
            <div className="p-10 overflow-y-auto flex-1 bg-white">
              
              {/* TAB 1: DATOS */}
              {activeModalTab === 'datos' && (
                <div className="space-y-12 animate-in slide-in-from-left-4">
                  
                  {/* SECCIÓN TIEMPOS */}
                  <div className="bg-blue-50/50 p-10 rounded-[2.5rem] border-2 border-blue-100 shadow-inner">
                    <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-[0.3em] mb-8 flex items-center gap-3"><Clock size={20}/> Tiempos de la Continuidad</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                      <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-slate-100 hover:border-slate-300 transition-colors">
                        <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">A. EGRESO UHCIP</label>
                        <input type="date" value={caseForm.fechaEgreso} onChange={e=>setCaseForm({...caseForm, fechaEgreso: e.target.value})} className="w-full font-black text-slate-700 outline-none text-sm bg-transparent border-none p-0 focus:ring-0 cursor-pointer" />
                      </div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-indigo-50 hover:border-indigo-200 transition-colors">
                        <label className="block text-[10px] font-black text-indigo-400 mb-3 uppercase tracking-widest">B. RECEPCIÓN EN RED</label>
                        <input type="date" value={caseForm.fechaRecepcionRed} onChange={e=>setCaseForm({...caseForm, fechaRecepcionRed: e.target.value})} className="w-full font-black text-indigo-700 outline-none text-sm bg-transparent border-none p-0 focus:ring-0 cursor-pointer" />
                      </div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-green-50 hover:border-green-200 transition-colors">
                        <label className="block text-[10px] font-black text-green-400 mb-3 uppercase tracking-widest">C. INGRESO EFECTIVO</label>
                        <input type="date" value={caseForm.fechaIngresoEfectivo} onChange={e=>setCaseForm({...caseForm, fechaIngresoEfectivo: e.target.value})} className="w-full font-black text-green-700 outline-none text-sm bg-transparent border-none p-0 focus:ring-0 cursor-pointer" />
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN IDENTIFICACIÓN */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-3">Identificación Paciente</h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</label>
                          <input type="text" value={caseForm.nombre} onChange={e=>setCaseForm({...caseForm, nombre: e.target.value})} className="w-full border-b-2 border-slate-100 py-3 outline-none focus:border-blue-500 font-black text-sm text-slate-700 transition-colors" placeholder="Ej: Juan Pérez" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RUT</label>
                          <input type="text" value={caseForm.rut} onChange={e=>setCaseForm({...caseForm, rut: e.target.value})} className="w-full border-b-2 border-slate-100 py-3 outline-none focus:border-blue-500 font-black text-sm text-slate-700 transition-colors" placeholder="Ej: 11.111.111-1" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-3">Derivación</h4>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispositivo Receptor</label>
                        <select value={caseForm.destino} onChange={e=>setCaseForm({...caseForm, destino: e.target.value})} className="w-full border-b-2 border-slate-100 py-3 outline-none focus:border-blue-500 font-black text-sm text-slate-700 bg-transparent transition-colors cursor-pointer">
                          <option value="">Seleccione dispositivo...</option>
                          {centros.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BITÁCORA */}
              {activeModalTab === 'bitacora' && (
                <div className="space-y-10 animate-in slide-in-from-right-4 h-full flex flex-col">
                  
                  {/* FORMULARIO BITÁCORA */}
                  <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-slate-200 shrink-0 shadow-inner">
                    <h4 className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-6">Nuevo Hito o Intervención</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                      <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo</label>
                        <select value={newBitacoraEntry.tipo} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, tipo: e.target.value})} className="border-2 border-white p-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm outline-none focus:border-blue-300 cursor-pointer">
                          <option value="Nota">📝 Nota Adm.</option>
                          <option value="Intervención">🗣️ Intervención</option>
                          <option value="Tarea">🎯 Tarea Enlace</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Responsable</label>
                        <input type="text" value={newBitacoraEntry.responsable} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, responsable: e.target.value})} className="border-2 border-white p-4 rounded-2xl text-xs font-black shadow-sm outline-none focus:border-blue-300" placeholder="Ej: Ps. Silva" />
                      </div>
                      <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción</label>
                        <input type="text" value={newBitacoraEntry.descripcion} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, descripcion: e.target.value})} className="border-2 border-white p-4 rounded-2xl text-xs font-black shadow-sm outline-none focus:border-blue-300" placeholder="Detalle de la acción..." />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={handleAddBitacora} disabled={!newBitacoraEntry.descripcion} className="bg-blue-600 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-700 disabled:opacity-50 shadow-xl shadow-blue-100 transition-all flex items-center gap-2"><Plus size={16}/> Registrar Acción</button>
                    </div>
                  </div>

                  {/* LISTA BITÁCORA */}
                  <div className="flex-1 space-y-6 overflow-y-auto pr-6">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-4 sticky top-0 bg-white z-10 pt-2">Evolución Cronológica</h4>
                    {caseForm.bitacora.map(entry => (
                      <div key={entry.id} className="p-6 bg-white border-2 border-slate-100 rounded-[1.5rem] shadow-sm flex gap-6 items-start group hover:border-blue-200 transition-all">
                        <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors shrink-0">
                          {entry.tipo === 'Intervención' ? <Users size={20}/> : <MessageSquare size={20}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg tracking-widest">{entry.tipo}</span>
                            <span className="text-[10px] font-black text-slate-300 uppercase flex items-center gap-1"><Calendar size={12}/> {entry.fecha}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-700 leading-relaxed mb-3">{entry.descripcion}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic opacity-70 bg-slate-50 px-2 py-1 rounded w-fit">Resp: {entry.responsable || 'No indicado'}</p>
                        </div>
                        <button onClick={() => setCaseForm({ ...caseForm, bitacora: caseForm.bitacora.filter(b => b.id !== entry.id) })} className="opacity-0 group-hover:opacity-100 p-3 text-slate-300 hover:text-red-500 transition-all bg-slate-50 rounded-xl hover:bg-red-50"><Trash2 size={20}/></button>
                      </div>
                    ))}
                    {caseForm.bitacora.length === 0 && (
                       <div className="text-center py-24 border-2 border-dashed border-slate-100 rounded-[2rem]">
                          <Activity size={32} className="text-slate-200 mx-auto mb-4"/>
                          <p className="text-slate-300 font-black text-xs uppercase tracking-widest italic">Sin registros de intervención</p>
                       </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* FOOTER MODAL */}
            <div className="bg-slate-50 p-10 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-8 shrink-0">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100"><Shield size={14} className="text-blue-500"/> Auditoría HPM - Ley 20.584</p>
              <div className="flex gap-4">
                <button onClick={() => setIsCaseModalOpen(false)} className="px-10 py-5 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-all">Cancelar</button>
                <button onClick={handleSaveCase} className="px-12 py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] shadow-2xl hover:bg-black transition-all hover:-translate-y-1 flex items-center gap-2"><CheckCircle size={18}/> Guardar Seguimiento</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .fade-in { animation: fadeIn 0.5s ease-out; }
        .animate-in { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}

const StatusBadge = ({ status }) => {
  if(status === 'Alerta') return <span className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-3 animate-pulse border border-red-200 shadow-sm"><AlertTriangle size={12} /> Alerta</span>;
  if(status === 'Pendiente') return <span className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-3 border border-amber-200 shadow-sm"><Clock size={12} /> En Tránsito</span>;
  if(status === 'Concretado') return <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-3 border border-emerald-200 shadow-sm"><CheckCircle size={12} /> Cerrado</span>;
  return <span className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border border-slate-200">{status}</span>;
};