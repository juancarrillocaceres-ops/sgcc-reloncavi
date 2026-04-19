import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, Users, FileText, AlertTriangle, CheckCircle, Clock, Plus, Activity, LogOut,
  Bell, Copy, Loader2, Edit2, Trash2, ListTodo, MessageSquare, CheckSquare, Square, Calendar,
  UploadCloud, Paperclip, File as FileIcon, Lock, User, ClipboardCheck, BookOpen, Download,
  Wand2, GitCommit, Search, Settings, Filter, UserPlus, Shield, Key, Timer, TrendingUp, BarChart3,
  Target
} from 'lucide-react';

/**
 * instrucciones para PERMANENCIA DEFINITIVA:
 * 1. Ve a tu consola de Firebase (https://console.firebase.google.com/)
 * 2. Entra en "Firestore Database" -> Pestaña "Rules" (Reglas).
 * 3. Verás una línea que dice: allow read, write: if request.time < timestamp.date(2026, 5, 18);
 * 4. Cámbiala por: allow read, write: if request.auth != null;
 * 5. Haz clic en "Publicar". 
 */

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

const diffInDays = (d1, d2) => {
  if (!d1 || !d2) return null;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  const diff = Math.abs(date2 - date1);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
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
  const [targetDays, setTargetDays] = useState(7);

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

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token && typeof __firebase_config !== 'undefined') {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.warn("Auth", e.message); }
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
    const headers = ['ID', 'RUT', 'Paciente', 'Origen', 'Destino', 'Estado', 'Fecha_Egreso', 'Fecha_Recepcion', 'Fecha_Ingreso_Efectivo', 'Plazo_Meta'];
    const rows = visibleCases.map(c => [c.id, c.paciente, c.nombre, c.origen, c.destino, c.estado, c.fechaEgreso||'', c.fechaRecepcionRed||'', c.fechaIngresoEfectivo||'', targetDays]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Continuidad_HPM_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const user = users.find(u => u.rut === loginData.rut && u.password === loginData.password);
    if (user) { setCurrentUser(user); setLoginError(''); } else { setLoginError('RUT o Contraseña incorrectos.'); }
  };

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

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); alert("Copiado al portapapeles"); };

  if (!currentUser) return (
    <div className="min-h-screen bg-[#0a2540] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Activity size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">SGCC-SM</h1>
          <p className="text-xs font-black text-blue-500 uppercase tracking-widest mt-1">Hospital Puerto Montt</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">RUT de Usuario</label>
            <input type="text" value={loginData.rut} onChange={(e) => setLoginData({...loginData, rut: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold" placeholder="11.111.111-1" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
            <input type="password" value={loginData.password} onChange={(e) => setLoginData({...loginData, password: e.target.value})} className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold" placeholder="••••••" />
          </div>
          {loginError && <p className="text-red-500 text-[10px] text-center font-black uppercase">{loginError}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white font-black text-xs uppercase tracking-widest py-4 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all">Ingresar al Sistema</button>
        </form>
        <div className="mt-8 text-center">
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-tighter italic">Acceso restringido personal UHCIP / Red Reloncaví</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-64 bg-[#0a2540] text-white flex flex-col h-screen sticky top-0 shrink-0">
        <div className="p-6 border-b border-white/5">
          <h1 className="text-xl font-bold">SGCC-SM</h1>
          <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">UHCIP INFANTO JUVENIL</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-70'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => setActiveTab('cases')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'cases' ? 'bg-blue-600 shadow-lg' : 'hover:bg-white/5 opacity-70'}`}><Users size={18}/> Casos de Red</button>
        </nav>
        <div className="p-6 border-t border-white/5">
           <p className="text-[10px] text-blue-300 font-black mb-3 truncate uppercase tracking-widest">{currentUser.nombre}</p>
           <button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[10px] font-black uppercase text-red-400 hover:bg-red-500/10"><LogOut size={14}/> Cerrar Sesión</button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div><h2 className="text-3xl font-black text-slate-800">Indicadores de Red</h2><p className="text-sm text-slate-500">Monitoreo de plazos y brechas operativas</p></div>
              <button onClick={handleExportCSV} className="bg-green-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-green-700 transition-all shadow-md"><Download size={18}/> Exportar Excel de Brechas</button>
            </div>

            <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                 <div className="flex items-center gap-4">
                   <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Target size={32}/></div>
                   <div>
                     <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Ajuste de Plazo Meta Operacional</h3>
                     <p className="text-xs text-slate-500 mt-1">Días considerados "dentro de lo esperado" según realidad local.</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border-2 border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 ml-2 uppercase">Meta:</span>
                    <input 
                      type="number" 
                      value={targetDays} 
                      onChange={(e) => handleUpdateTarget(e.target.value)}
                      className="w-16 p-2 bg-white border-2 border-blue-100 rounded-xl text-center font-black text-blue-600 outline-none focus:border-blue-500 text-sm"
                    />
                    <span className="text-[10px] font-black text-slate-600 mr-2 uppercase">Días</span>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 border-l-[12px] border-l-indigo-500">
                <div className="flex justify-between items-start mb-4">
                   <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><Timer size={24}/></div>
                   <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Hito A-B</span>
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Promedio Enlace</h3>
                <p className="text-5xl font-black text-slate-800 mt-1">{redMetrics.avgEnlace} <span className="text-sm font-bold text-slate-300">Días</span></p>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 border-l-[12px] border-l-blue-500">
                <div className="flex justify-between items-start mb-4">
                   <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><BarChart3 size={24}/></div>
                   <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Hito A-C</span>
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingreso Efectivo</h3>
                <p className="text-5xl font-black text-slate-800 mt-1">{redMetrics.avgIngreso} <span className="text-sm font-bold text-slate-300">Días</span></p>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 border-l-[12px] border-l-red-500">
                <div className="flex justify-between items-start mb-4">
                   <div className="p-3 bg-red-50 rounded-2xl text-red-600"><AlertTriangle size={24}/></div>
                   <div className="px-3 py-1 bg-red-100 text-red-700 text-[9px] font-black rounded-lg uppercase tracking-widest">Crítico</div>
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Superan los {targetDays} días</h3>
                <p className="text-5xl font-black text-slate-800 mt-1">{redMetrics.fueraDePlazo} <span className="text-sm font-bold text-slate-300">Casos</span></p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cases' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div><h2 className="text-3xl font-black text-slate-800">Casos en Red</h2><p className="text-sm text-slate-500">Monitoreo activo de derivaciones UHCIP</p></div>
              <button onClick={() => { setEditingCaseId(null); setCaseForm(defaultCaseState); setIsCaseModalOpen(true); }} className="bg-blue-600 text-white px-8 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-2"><Plus size={20}/> Nuevo Seguimiento</button>
            </div>
            
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <th className="p-6">Paciente</th>
                    <th className="p-6">Ruta de Traslado</th>
                    <th className="p-6 text-center">Hitos Críticos</th>
                    <th className="p-6 text-center">Estado</th>
                    <th className="p-6 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {visibleCases.map(c => {
                    const daysC = diffInDays(c.fechaEgreso, c.fechaIngresoEfectivo);
                    const isOver = daysC !== null && daysC > targetDays;
                    return (
                      <tr key={c.id} className={`hover:bg-slate-50/80 transition-colors ${isOver ? 'bg-red-50/30' : ''}`}>
                        <td className="p-6"><div className="font-black text-slate-800 text-sm uppercase">{c.nombre}</div><div className="text-[10px] font-bold text-slate-400">{c.paciente}</div></td>
                        <td className="p-6"><div className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-2 rounded-xl w-fit flex items-center gap-2 uppercase tracking-widest">{c.origen} <Timer size={12}/> {c.destino}</div></td>
                        <td className="p-6">
                          <div className="flex justify-center gap-8">
                             <div className="text-center"><span className="text-[8px] font-black text-slate-300 block mb-1 uppercase tracking-tighter">EGRESO (A)</span><span className="text-xs font-black text-slate-700">{c.fechaEgreso || '---'}</span></div>
                             <div className="text-center border-l border-slate-100 pl-8"><span className="text-[8px] font-black text-indigo-300 block mb-1 uppercase tracking-tighter">RECEP (B)</span><span className="text-xs font-black text-indigo-700">{c.fechaRecepcionRed || '---'}</span></div>
                             <div className="text-center border-l border-slate-100 pl-8"><span className="text-[8px] font-black text-green-300 block mb-1 uppercase tracking-tighter">INGRESO (C)</span><span className={`text-xs font-black ${isOver ? 'text-red-600' : 'text-green-700'}`}>{c.fechaIngresoEfectivo || '---'}</span></div>
                          </div>
                        </td>
                        <td className="p-6"><div className="flex justify-center"><StatusBadge status={c.estado}/></div></td>
                        <td className="p-6 text-right"><button onClick={() => { setEditingCaseId(c.id); setCaseForm({ ...c, rut: c.paciente }); setIsCaseModalOpen(true); }} className="text-slate-300 hover:text-blue-600 p-3 transition-all"><Edit2 size={22}/></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL INTEGRAL */}
      {isCaseModalOpen && (
        <div className="fixed inset-0 bg-[#0a2540]/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="bg-blue-600 p-8 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4"><div className="p-4 bg-white/20 rounded-[1.5rem]"><FileIcon size={32}/></div><div><h3 className="font-black text-xl uppercase tracking-widest">{editingCaseId ? `${caseForm.nombre}` : 'Nuevo Seguimiento'}</h3><p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.4em]">{editingCaseId || 'ASIGNANDO ID...'}</p></div></div>
              <button onClick={() => setIsCaseModalOpen(false)} className="text-white/60 hover:text-white font-bold text-4xl transition-colors">&times;</button>
            </div>
            
            <div className="flex bg-slate-50 border-b shrink-0 px-8">
              <button onClick={() => setActiveModalTab('datos')} className={`px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeModalTab === 'datos' ? 'border-blue-600 text-blue-600 bg-white shadow-inner' : 'border-transparent text-slate-400'}`}>1. Hitos de Red</button>
              <button onClick={() => setActiveModalTab('bitacora')} className={`px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeModalTab === 'bitacora' ? 'border-blue-600 text-blue-600 bg-white shadow-inner' : 'border-transparent text-slate-400'}`}>2. Bitácora Clínica</button>
            </div>

            <div className="p-10 overflow-y-auto flex-1">
              {activeModalTab === 'datos' && (
                <div className="space-y-12 animate-in slide-in-from-left-4">
                  <div className="bg-blue-50/70 p-10 rounded-[2.5rem] border-2 border-blue-100">
                    <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-[0.3em] mb-8 flex items-center gap-3"><Clock size={20}/> Tiempos de la Continuidad</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                      <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-blue-50">
                        <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">A. EGRESO UHCIP</label>
                        <input type="date" value={caseForm.fechaEgreso} onChange={e=>setCaseForm({...caseForm, fechaEgreso: e.target.value})} className="w-full font-black text-slate-700 outline-none text-sm bg-transparent border-none p-0 focus:ring-0" />
                      </div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-indigo-50">
                        <label className="block text-[10px] font-black text-indigo-400 mb-3 uppercase tracking-widest">B. RECEPCIÓN EN RED</label>
                        <input type="date" value={caseForm.fechaRecepcionRed} onChange={e=>setCaseForm({...caseForm, fechaRecepcionRed: e.target.value})} className="w-full font-black text-indigo-700 outline-none text-sm bg-transparent border-none p-0 focus:ring-0" />
                      </div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-green-50">
                        <label className="block text-[10px] font-black text-green-400 mb-3 uppercase tracking-widest">C. INGRESO EFECTIVO</label>
                        <input type="date" value={caseForm.fechaIngresoEfectivo} onChange={e=>setCaseForm({...caseForm, fechaIngresoEfectivo: e.target.value})} className="w-full font-black text-green-700 outline-none text-sm bg-transparent border-none p-0 focus:ring-0" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-3">Identificación Paciente</h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div><label className="text-[10px] font-black text-slate-400 uppercase">Nombre</label><input type="text" value={caseForm.nombre} onChange={e=>setCaseForm({...caseForm, nombre: e.target.value})} className="w-full border-b-2 border-slate-100 py-3 outline-none focus:border-blue-500 font-black text-sm text-slate-700" placeholder="Ej: Juan Pérez" /></div>
                        <div><label className="text-[10px] font-black text-slate-400 uppercase">RUT</label><input type="text" value={caseForm.rut} onChange={e=>setCaseForm({...caseForm, rut: e.target.value})} className="w-full border-b-2 border-slate-100 py-3 outline-none focus:border-blue-500 font-black text-sm text-slate-700" placeholder="Ej: 11.111.111-1" /></div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-3">Derivación</h4>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase">Dispositivo de Destino</label>
                        <select value={caseForm.destino} onChange={e=>setCaseForm({...caseForm, destino: e.target.value})} className="w-full border-b-2 border-slate-100 py-3 outline-none focus:border-blue-500 font-black text-sm text-slate-700 bg-transparent">
                          <option value="">Seleccione dispositivo...</option>
                          {centros.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'bitacora' && (
                <div className="space-y-10 animate-in slide-in-from-right-4 h-full flex flex-col">
                  <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-slate-200 shrink-0 shadow-inner">
                    <h4 className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-6">Nuevo Hito de Gestión o Intervención</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                      <select value={newBitacoraEntry.tipo} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, tipo: e.target.value})} className="border-2 border-white p-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm outline-none focus:border-blue-300">
                        <option value="Nota">📝 Nota Adm.</option>
                        <option value="Intervención">🗣️ Intervención</option>
                        <option value="Tarea">🎯 Tarea Enlace</option>
                      </select>
                      <input type="text" value={newBitacoraEntry.responsable} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, responsable: e.target.value})} className="border-2 border-white p-4 rounded-2xl text-xs font-black shadow-sm outline-none focus:border-blue-300" placeholder="Ej: Psicólogo COSAM" />
                      <input type="text" value={newBitacoraEntry.descripcion} onChange={e=>setNewBitacoraEntry({...newBitacoraEntry, descripcion: e.target.value})} className="md:col-span-2 border-2 border-white p-4 rounded-2xl text-xs font-black shadow-sm outline-none focus:border-blue-300" placeholder="Ej: Visita domiciliaria realizada ante inasistencia..." />
                    </div>
                    <div className="flex justify-end"><button onClick={handleAddBitacora} disabled={!newBitacoraEntry.descripcion} className="bg-blue-600 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-700 disabled:opacity-50 shadow-xl shadow-blue-100 transition-all">Registrar en Bitácora</button></div>
                  </div>

                  <div className="flex-1 space-y-6 overflow-y-auto pr-6">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-4 sticky top-0 bg-white z-10 pt-2">Evolución Cronológica</h4>
                    {caseForm.bitacora.map(entry => (
                      <div key={entry.id} className="p-6 bg-white border-2 border-slate-100 rounded-[1.5rem] shadow-sm flex gap-6 items-start group hover:border-blue-200 transition-all">
                        <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors shrink-0">
                          {entry.tipo === 'Intervención' ? <Users size={20}/> : <MessageSquare size={20}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-lg tracking-widest">{entry.tipo}</span>
                            <span className="text-[10px] font-black text-slate-300 uppercase">{entry.fecha}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-700 leading-relaxed mb-2">{entry.descripcion}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic opacity-70">Responsable: {entry.responsable || 'No indicado'}</p>
                        </div>
                        <button onClick={() => setCaseForm({ ...caseForm, bitacora: caseForm.bitacora.filter(b => b.id !== entry.id) })} className="opacity-0 group-hover:opacity-100 p-3 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={20}/></button>
                      </div>
                    ))}
                    {caseForm.bitacora.length === 0 && <div className="text-center py-20 text-slate-200 font-black text-xs uppercase tracking-widest italic">Sin registros de intervención registrados.</div>}
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 p-10 border-t flex flex-col md:flex-row justify-between items-center gap-8 shrink-0">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] flex items-center gap-3"><Shield size={14}/> Datos protegidos bajo Ley 20.584 - Auditoría HPM</p>
              <div className="flex gap-6">
                <button onClick={() => setIsCaseModalOpen(false)} className="px-10 py-5 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-all">Cancelar</button>
                <button onClick={handleSaveCase} className="px-12 py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:bg-black transition-all hover:-translate-y-1">Guardar Seguimiento Integral</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .animate-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
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