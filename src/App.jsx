import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  LayoutDashboard,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Activity,
  LogOut,
  Bell,
  Copy,
  Loader2,
  Edit2,
  Trash2,
  ListTodo,
  MessageSquare,
  CheckSquare,
  Square,
  Calendar,
  UploadCloud,
  Paperclip,
  File as FileIcon,
  Lock,
  User,
  ClipboardCheck,
  BookOpen,
  Download,
  Wand2,
  GitCommit,
  Search,
  Settings,
  Filter,
  UserPlus,
  Shield,
  Key,
} from 'lucide-react';

// --- CONFIGURACIÓN DE BASE DE DATOS Y NUBE ---
const firebaseConfig =
  typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : {
        apiKey: 'AIzaSyADlW5WRPWOokJQbVFUF9UuYRxLXa4-MqU',
        authDomain: 'sgcc-reloncavi.firebaseapp.com',
        projectId: 'sgcc-reloncavi',
        storageBucket: 'sgcc-reloncavi.firebasestorage.app',
        messagingSenderId: '247963397382',
        appId: '1:247963397382:web:972ee82f2cc7b8f7760287',
        measurementId: 'G-KCWQ4H964D',
      };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'sgcc-reloncavi-v1';

// --- CONFIGURACIÓN GEMINI API ---
const apiKey = '';

const generateTextWithRetry = async (
  prompt,
  systemInstruction = '',
  retries = 5
) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  if (systemInstruction)
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      return result.candidates[0].content.parts[0].text;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((res) => setTimeout(res, delays[i]));
    }
  }
};

// --- DATOS SIMULADOS PARA INICIALIZACIÓN ---
const initialCases = [
  {
    id: 'CASO-001',
    paciente: '12.345.678-9',
    nombre: 'Martín Pérez',
    edad: 15,
    origen: 'UHCIP HPM',
    destino: 'COSAM Puerto Montt',
    fechaEgreso: '2026-04-10',
    estado: 'Pendiente',
    prioridad: 'Alta',
    tutor: {
      nombre: 'María González',
      relacion: 'Madre',
      telefono: '+56987654321',
    },
    referentes: [
      {
        nombre: 'Dra. Silva',
        telefono: '987654321',
        correo: 'psilva@cosam.cl',
        institucion: 'COSAM',
      },
    ],
    bitacora: [
      {
        id: 1,
        tipo: 'Reunión',
        fecha: '2026-04-12',
        descripcion:
          'Reunión clínica de traspaso.\nSe acuerda mantener dosis de Quetiapina y evaluar en 2 semanas.',
        responsable: '',
      },
      {
        id: 2,
        tipo: 'Tarea',
        fecha: '2026-04-12',
        descripcion:
          'Contactar a colegio para informar reincorporación paulatina.',
        responsable: 'AS María Paz',
        completada: false,
        fechaCumplimiento: '2026-04-20',
      },
    ],
    documentos: [
      {
        id: 'doc-1',
        nombre: 'Epicrisis_UHCIP.pdf',
        size: '1.2 MB',
        fecha: '2026-04-10',
        tipo: 'application/pdf',
      },
    ],
  },
  {
    id: 'CASO-002',
    paciente: '10.987.654-3',
    nombre: 'Luis Soto',
    edad: 42,
    origen: 'UHCIP Adultos',
    destino: 'Residencia Terapéutica',
    fechaEgreso: '2026-04-05',
    estado: 'Concretado',
    prioridad: 'Media',
    tutor: {
      nombre: 'Ana Soto',
      relacion: 'Hermana',
      telefono: '+56912345678',
    },
    referentes: [],
    bitacora: [],
    documentos: [],
  },
  {
    id: 'CASO-003',
    paciente: '23.456.789-0',
    nombre: 'Sofía Castro',
    edad: 12,
    origen: 'Hospital de Castro',
    destino: 'COSAM Reloncaví',
    fechaEgreso: '2026-04-01',
    estado: 'Alerta',
    prioridad: 'Crítica',
    tutor: {
      nombre: 'Juan Castro',
      relacion: 'Padre',
      telefono: '+56922334455',
    },
    referentes: [
      {
        nombre: 'Ps. Carlos Pinto',
        telefono: '912345678',
        correo: 'cpinto@cosam.cl',
        institucion: 'COSAM',
      },
      {
        nombre: 'AS María Paz',
        telefono: '922334455',
        correo: 'mpaz@prm.cl',
        institucion: 'PRM',
      },
    ],
    bitacora: [],
    documentos: [],
  },
];

const initialDocs = [
  {
    id: 'DOC-001',
    nombre: 'Protocolo Ref/Contrareferencia',
    ambito: 'Red Integral',
    fase: 'Validación Técnica',
    avance: 75,
    bitacora: [
      {
        id: 1,
        tipo: 'Tarea',
        fecha: '2026-04-12',
        descripcion: 'Revisión final con equipo jurídico.',
        responsable: 'Abogado SS',
        completada: false,
        fechaCumplimiento: '2026-04-25',
      },
    ],
    archivos: [],
  },
  {
    id: 'DOC-002',
    nombre: 'Manual Urgencia Psiquiátrica HPM',
    ambito: 'Hospitalario',
    fase: 'Levantamiento',
    avance: 20,
    bitacora: [],
    archivos: [],
  },
];

const initialAuditTemplates = [
  {
    id: 'TPL-001',
    nombre: 'Pauta Estándar de Continuidad',
    tipo: 'Ambos',
    criterios: [
      'Cuenta con Protocolo de Agitación visible.',
      'Registros de derivación al día en SIDRA.',
      'Conoce Flujo de Prevención Suicidio.',
      'Realiza seguimiento a inasistencias en 48 hrs.',
    ],
    rangos: [
      { min: 0, max: 2, resultado: 'Riesgo Crítico' },
      { min: 3, max: 3, resultado: 'Cumplimiento Parcial' },
      { min: 4, max: 4, resultado: 'Cumplimiento Óptimo' },
    ],
  },
];

const initialAudits = [
  {
    id: 'AUD-001',
    centro: 'COSAM Puerto Montt',
    fecha: '2026-03-15',
    templateId: 'TPL-001',
    cumplimiento: 100,
    puntaje: '4 / 4 pts',
    estado: 'Cumplimiento Óptimo',
    evaluador: 'Juan Carrillo',
    tipo: 'Auditoría',
  },
  {
    id: 'AUD-002',
    centro: 'Hospital de Castro',
    fecha: '2026-04-10',
    templateId: 'TPL-001',
    cumplimiento: 50,
    puntaje: '2 / 4 pts',
    estado: 'Riesgo Crítico',
    evaluador: 'Juan Carrillo',
    tipo: 'Consultoría',
  },
];

const initialDirectory = [
  {
    id: 1,
    nombre: 'Ps. Carlos Pinto',
    cargo: 'Psicólogo Clínico',
    institucion: 'COSAM Reloncaví',
    telefono: '+56 9 1234 5678',
    correo: 'cpinto@cosam.cl',
  },
  {
    id: 2,
    nombre: 'AS María Paz',
    cargo: 'Trabajadora Social',
    institucion: 'PRM Ancud',
    telefono: '+56 9 2233 4455',
    correo: 'mpaz@prm.cl',
  },
  {
    id: 3,
    nombre: 'Dra. Andrea Silva',
    cargo: 'Directora',
    institucion: 'COSAM Puerto Montt',
    telefono: '+56 9 8765 4321',
    correo: 'psilva@cosam.cl',
  },
  {
    id: 4,
    nombre: 'Enf. Pedro Sánchez',
    cargo: 'Enfermero',
    institucion: 'Urgencia HPM',
    telefono: '+56 9 3333 1111',
    correo: 'psanchez@hospital.cl',
  },
];

const initialCentros = [
  'COSAM Puerto Montt',
  'COSAM Reloncaví',
  'Hospital de Castro',
  'Hospital Puerto Montt',
  'Urgencia Psiquiátrica HPM',
  'Residencia Terapéutica',
  'APS Alerce',
  'APS Carmela Carvajal',
];

const initialUsers = [
  {
    id: 1,
    rut: '11.111.111-1',
    password: '123',
    nombre: 'Juan Carrillo',
    iniciales: 'JC',
    cargo: 'Ref. Calidad / UHCIP',
    rol: 'Admin',
    centrosAsignados: [],
  },
  {
    id: 2,
    rut: '22.222.222-2',
    password: '123',
    nombre: 'Dra. Andrea Silva',
    iniciales: 'AS',
    cargo: 'Directora COSAM',
    rol: 'Usuario',
    centrosAsignados: ['COSAM Puerto Montt'],
  },
];

const ambitosProtocolo = ['Red Integral', 'Hospitalario', 'COSAM', 'APS'];
const fasesProtocolo = [
  'Levantamiento',
  'Redacción',
  'Validación Técnica',
  'Revisión Jurídica',
  'Resolución Exenta',
  'Difusión',
];

// --- FUNCIONES DE UTILIDAD (Fuera del componente para inicialización temprana) ---
const getTaskStatus = (fecha) => {
  if (!fecha)
    return {
      status: 'none',
      bgClass: 'bg-gray-100 text-gray-700',
      textClass: 'text-gray-500',
      showWarning: false,
    };
  const [y, m, d] = fecha.split('-');
  const taskDate = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0)
    return {
      status: 'overdue',
      bgClass: 'bg-red-100 text-red-800',
      textClass: 'text-red-600',
      showWarning: true,
    };
  if (diffDays <= 10)
    return {
      status: 'upcoming',
      bgClass: 'bg-yellow-100 text-yellow-800',
      textClass: 'text-yellow-600',
      showWarning: true,
    };
  return {
    status: 'safe',
    bgClass: 'bg-green-100 text-green-800',
    textClass: 'text-green-600',
    showWarning: false,
  };
};

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ rut: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');

  // Tablas Maestras (Conectadas a la Nube)
  const [centros, setCentros] = useState([]);
  const [cases, setCases] = useState([]);
  const [docs, setDocs] = useState([]);
  const [audits, setAudits] = useState([]);
  const [auditTemplates, setAuditTemplates] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [users, setUsers] = useState([]);

  const [newCentroName, setNewCentroName] = useState('');

  // Modales y Formularios
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const defaultCaseState = {
    rut: '',
    nombre: '',
    edad: '',
    origen: '',
    destino: '',
    prioridad: 'Media',
    estado: 'Pendiente',
    fechaEgreso: new Date().toISOString().split('T')[0],
    tutor: { nombre: '', relacion: '', telefono: '' },
    referentes: [],
    bitacora: [],
    documentos: [],
  };
  const [editingCaseId, setEditingCaseId] = useState(null);
  const [caseForm, setCaseForm] = useState(defaultCaseState);
  const [activeModalTab, setActiveModalTab] = useState('datos');

  const [editingDocId, setEditingDocId] = useState(null);
  const [newDocName, setNewDocName] = useState('');
  const [newDocAmbito, setNewDocAmbito] = useState(ambitosProtocolo[0]);
  const [newDocFase, setNewDocFase] = useState('Levantamiento');
  const [newDocAvance, setNewDocAvance] = useState(10);
  const [docBitacora, setDocBitacora] = useState([]);
  const [docArchivos, setDocArchivos] = useState([]);
  const [activeDocModalTab, setActiveDocModalTab] = useState('datos');

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [auditForm, setAuditForm] = useState({
    centro: '',
    templateId: '',
    answers: {},
    tipo: 'Auditoría',
  });
  const [templateForm, setTemplateForm] = useState({
    nombre: '',
    criterios: [''],
    rangos: [],
    tipo: 'Ambos',
  });
  const [isDigitizing, setIsDigitizing] = useState(false);
  const [centroFilterAuditorias, setCentroFilterAuditorias] = useState('Todos');
  const [centroFilterConsultorias, setCentroFilterConsultorias] =
    useState('Todos');

  const [newBitacoraEntry, setNewBitacoraEntry] = useState({
    tipo: 'Nota',
    descripcion: '',
    responsable: '',
    fechaCumplimiento: '',
  });
  const [newDocBitacoraEntry, setNewDocBitacoraEntry] = useState({
    tipo: 'Nota',
    descripcion: '',
    responsable: '',
    fechaCumplimiento: '',
  });

  const [isDirModalOpen, setIsDirModalOpen] = useState(false);
  const [editingDirId, setEditingDirId] = useState(null);
  const [dirForm, setDirForm] = useState({
    nombre: '',
    cargo: '',
    institucion: '',
    telefono: '',
    correo: '',
  });
  const [dirSearch, setDirSearch] = useState('');

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState({
    rut: '',
    nombre: '',
    iniciales: '',
    cargo: '',
    password: '',
    rol: 'Usuario',
    centrosAsignados: [],
  });

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [ageFilter, setAgeFilter] = useState('all');

  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isGeneratingCaseSummary, setIsGeneratingCaseSummary] = useState(false);
  const [caseSummary, setCaseSummary] = useState('');

  // --- LÓGICA DE INICIALIZACIÓN DE LA NUBE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== 'undefined' &&
          __initial_auth_token &&
          typeof __firebase_config !== 'undefined'
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.warn(
          'Aviso de Firebase Auth: Habilita el inicio de sesión Anónimo en tu consola.',
          e.message
        );
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    const unsubCases = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'cases'),
      (snap) => setCases(snap.docs.map((d) => d.data())),
      console.error
    );
    const unsubDocs = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'docs'),
      (snap) => setDocs(snap.docs.map((d) => d.data())),
      console.error
    );
    const unsubAudits = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'audits'),
      (snap) => setAudits(snap.docs.map((d) => d.data())),
      console.error
    );
    const unsubTemplates = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'auditTemplates'),
      (snap) => setAuditTemplates(snap.docs.map((d) => d.data())),
      console.error
    );
    const unsubDir = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'directory'),
      (snap) => setDirectory(snap.docs.map((d) => d.data())),
      console.error
    );
    const unsubUsers = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'users'),
      (snap) => setUsers(snap.docs.map((d) => d.data())),
      console.error
    );
    const unsubCentros = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'centros'),
      (snap) => {
        if (snap.exists() && snap.data().list) setCentros(snap.data().list);
      },
      console.error
    );

    return () => {
      unsubCases();
      unsubDocs();
      unsubAudits();
      unsubTemplates();
      unsubDir();
      unsubUsers();
      unsubCentros();
    };
  }, [firebaseUser]);

  // Funciones de Guardado en la Nube
  const saveToCloud = async (coll, id, data) => {
    if (!firebaseUser) return;
    await setDoc(
      doc(db, 'artifacts', appId, 'public', 'data', coll, id.toString()),
      data
    );
  };
  const deleteFromCloud = async (coll, id) => {
    if (!firebaseUser) return;
    await deleteDoc(
      doc(db, 'artifacts', appId, 'public', 'data', coll, id.toString())
    );
  };

  const seedDatabase = async () => {
    if (!firebaseUser) {
      return alert(
        "Error: Firebase Auth bloqueó la conexión. Ve a Firebase > Authentication > Sign-in method y habilita 'Anónimo' para poder inicializar la base de datos."
      );
    }
    try {
      for (const c of initialCases) await saveToCloud('cases', c.id, c);
      for (const d of initialDocs) await saveToCloud('docs', d.id, d);
      for (const a of initialAudits) await saveToCloud('audits', a.id, a);
      for (const t of initialAuditTemplates)
        await saveToCloud('auditTemplates', t.id, t);
      for (const dir of initialDirectory)
        await saveToCloud('directory', dir.id, dir);
      for (const u of initialUsers) await saveToCloud('users', u.id, u);
      await saveToCloud('settings', 'centros', { list: initialCentros });
      alert(
        'Base de datos inicializada correctamente. Ya puedes iniciar sesión.'
      );
    } catch (e) {
      console.error('Error sembrando', e);
      alert('Error al conectar con la base de datos.');
    }
  };

  // --- LÓGICA DE CONTROL DE ACCESO ---
  const visibleCases = useMemo(() => {
    if (currentUser?.rol === 'Admin') return cases;
    return cases.filter(
      (c) =>
        currentUser?.centrosAsignados.includes(c.origen) ||
        currentUser?.centrosAsignados.includes(c.destino)
    );
  }, [cases, currentUser]);

  const visibleAudits = useMemo(() => {
    if (currentUser?.rol === 'Admin') return audits;
    return audits.filter((a) =>
      currentUser?.centrosAsignados.includes(a.centro)
    );
  }, [audits, currentUser]);

  const notifications = useMemo(() => {
    const alertCasesNotif = visibleCases.filter((c) => c.estado === 'Alerta');
    const criticalTasksNotif = [
      ...visibleCases.flatMap((c) =>
        (c.bitacora || [])
          .filter((b) => b.tipo === 'Tarea' && !b.completada)
          .map((b) => ({ ...b, parentName: c.nombre || c.paciente }))
      ),
      ...docs.flatMap((d) =>
        (d.bitacora || [])
          .filter((b) => b.tipo === 'Tarea' && !b.completada)
          .map((b) => ({ ...b, parentName: d.nombre }))
      ),
    ].filter((t) => {
      const s = getTaskStatus(t.fechaCumplimiento);
      return s.status === 'upcoming' || s.status === 'overdue';
    });

    return [
      ...alertCasesNotif.map((c) => ({
        id: `alert-${c.id}`,
        type: 'alerta',
        title: 'Pérdida de Enlace',
        desc: `Paciente ${c.nombre} no se ha presentado en ${c.destino}.`,
      })),
      ...criticalTasksNotif.map((t) => {
        const s = getTaskStatus(t.fechaCumplimiento);
        return {
          id: `task-${t.id}`,
          type: s.status,
          title: s.status === 'overdue' ? 'Tarea Vencida' : 'Pronta a Vencer',
          desc: `(${t.parentName}) ${t.descripcion}`,
        };
      }),
    ];
  }, [visibleCases, docs]);

  // --- FUNCIONES IA Y UTILIDADES ---

  const handleGenerateDraft = async () => {
    if (!newDocName) return alert('Por favor ingresa el nombre del documento.');
    setIsGeneratingDraft(true);
    setDraftContent('');
    const prompt = `Escribe una propuesta de estructura base (índice detallado, objetivo general, alcance y propuesta de flujo de 5 pasos) para un protocolo llamado "${newDocName}" enfocado en el ámbito "${newDocAmbito}". Usa formato Markdown.`;
    const sys =
      'Eres un experto Asesor de Calidad del Ministerio de Salud de Chile.';
    try {
      setDraftContent(await generateTextWithRetry(prompt, sys));
    } catch (e) {
      setDraftContent('Error.');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleGenerateReport = async () => {
    const alertCases = visibleCases.filter((c) => c.estado === 'Alerta');
    if (alertCases.length === 0) return;
    setIsGeneratingReport(true);
    setReportContent('');
    const prompt = `Basado en los siguientes casos críticos: ${JSON.stringify(
      alertCases.map((c) => ({
        id: c.id,
        paciente: c.nombre,
        destino: c.destino,
      }))
    )}\n\nRedacta un correo formal dirigido a "Directores de Dispositivos" solicitando revisión.`;
    try {
      setReportContent(await generateTextWithRetry(prompt));
    } catch (e) {
      setReportContent('Error.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleGenerateCaseSummary = async () => {
    setIsGeneratingCaseSummary(true);
    setCaseSummary('');
    const prompt = `Como experto clínico de Salud Mental y supervisor de UHCIP, genera un resumen clínico narrativo muy breve y profesional (máximo 1 párrafo estructurado) del siguiente caso de traslado en la red.
    Paciente: ${caseForm.nombre}, Edad: ${caseForm.edad} años. 
    Origen: ${caseForm.origen}, Destino: ${caseForm.destino}. Estado actual: ${
      caseForm.estado
    }.
    Contactos involucrados: Tutor ${
      caseForm.tutor.nombre
    }, Referentes: ${caseForm.referentes.map((r) => r.institucion).join(', ')}.
    Hitos de la bitácora: ${caseForm.bitacora
      .map((b) => b.descripcion)
      .join(' | ')}.
    Genera un reporte listo para ser copiado en una ficha clínica o epicrisis de derivación.`;
    try {
      const result = await generateTextWithRetry(prompt);
      setCaseSummary(result);
    } catch (e) {
      setCaseSummary('Error al contactar al asistente IA.');
    } finally {
      setIsGeneratingCaseSummary(false);
    }
  };

  const handlePdfUploadForAI = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsDigitizing(true);
    const prompt = `Actúa como un experto en extracción de datos de calidad hospitalaria. El usuario ha subido un documento de pauta o auditoría llamado "${file.name}". Tu tarea es extraer TEXTUALMENTE Y LITERALMENTE los criterios, preguntas o puntos a evaluar que aparecen en el texto. NO resumas, NO cambies las palabras, y NO reinterpretes los textos. Devuelve ÚNICAMENTE los criterios encontrados, uno por línea, sin números ni viñetas al inicio, listos para ser usados en un checklist digital de Sí/No.`;
    try {
      const result = await generateTextWithRetry(prompt);
      const criteriosGenerados = result
        .split('\n')
        .map((c) => c.trim().replace(/^[-*•\d.)]+\s*/, ''))
        .filter((c) => c.length > 2);
      setTemplateForm({
        ...templateForm,
        nombre: `Evaluación de: ${file.name.replace(/\.[^/.]+$/, '')}`,
        criterios: [
          ...templateForm.criterios.filter((c) => c !== ''),
          ...criteriosGenerados,
        ],
      });
      alert(`¡Documento procesado exitosamente!`);
    } catch (err) {
      alert('Hubo un error al procesar el documento con la IA.');
    } finally {
      setIsDigitizing(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'ID_Seguimiento',
      'RUT',
      'Nombre_Paciente',
      'Edad',
      'Origen',
      'Destino',
      'Estado_Enlace',
      'Prioridad',
      'Fecha_Egreso',
    ];
    const rows = visibleCases.map((c) => [
      c.id,
      c.paciente,
      c.nombre,
      c.edad,
      c.origen,
      c.destino,
      c.estado,
      c.prioridad,
      c.fechaEgreso,
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Continuidad_SSReloncavi_${
      new Date().toISOString().split('T')[0]
    }.csv`;
    link.click();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('¡Texto copiado!');
  };

  const handleFileUpload = (e, target) => {
    const file = e.target.files[0];
    if (!file) return;
    const newFile = {
      id: Date.now().toString(),
      nombre: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      fecha: new Date().toISOString().split('T')[0],
      tipo: file.type || 'unknown',
    };
    if (target === 'case')
      setCaseForm({
        ...caseForm,
        documentos: [...caseForm.documentos, newFile],
      });
    else setDocArchivos([...docArchivos, newFile]);
  };
  const deleteFile = (fileId, target) => {
    if (target === 'case')
      setCaseForm({
        ...caseForm,
        documentos: caseForm.documentos.filter((d) => d.id !== fileId),
      });
    else setDocArchivos(docArchivos.filter((d) => d.id !== fileId));
  };

  // --- LOGIN ---
  const handleLogin = (e) => {
    e.preventDefault();
    const user = users.find(
      (u) => u.rut === loginData.rut && u.password === loginData.password
    );
    if (user) {
      setCurrentUser(user);
      setLoginError('');
    } else {
      setLoginError('RUT o contraseña incorrectos.');
    }
  };

  const renderLogin = () => (
    <div className="min-h-screen bg-[#0a2540] flex flex-col justify-center items-center p-4 fade-in">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-blue-600 p-8 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Activity size={32} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-white">SGCC-SM</h1>
          <p className="text-blue-100 mt-2 text-sm">
            Servicio de Salud Reloncaví
          </p>
        </div>
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                RUT de Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  value={loginData.rut}
                  onChange={(e) =>
                    setLoginData({ ...loginData, rut: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: 11.111.111-1"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  type="password"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••"
                  required
                />
              </div>
            </div>
            {loginError && (
              <p className="text-red-500 text-xs font-bold text-center bg-red-50 py-2 rounded">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={users.length === 0}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 shadow-md transition-colors disabled:opacity-50"
            >
              Ingresar
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            {users.length > 0 ? (
              <>
                <p className="text-xs text-gray-500 font-medium mb-3">
                  Accesos Directos (Demo):
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {users.slice(0, 3).map((u) => (
                    <span
                      key={u.id}
                      onClick={() =>
                        setLoginData({ rut: u.rut, password: u.password })
                      }
                      className="text-[10px] bg-gray-100 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-200 text-gray-700 font-medium border border-gray-200 transition-colors"
                    >
                      {u.nombre} ({u.rol})
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <p className="text-xs text-red-600 font-bold mb-2 flex items-center justify-center gap-1">
                  <AlertTriangle size={14} /> Base de Datos Vacía
                </p>
                <button
                  onClick={seedDatabase}
                  className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded transition-colors shadow-sm"
                >
                  Inicializar Nube (Cargar Demo)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // --- GESTORES DE GUARDADO EN NUBE ---
  const handleSaveCase = async () => {
    if (
      !caseForm.rut ||
      !caseForm.nombre ||
      !caseForm.origen ||
      !caseForm.destino
    )
      return alert(
        'Por favor, completa los campos obligatorios: RUT, Nombre, Origen y Destino.'
      );
    const caseData = {
      paciente: caseForm.rut,
      nombre: caseForm.nombre,
      edad: parseInt(caseForm.edad) || null,
      origen: caseForm.origen,
      destino: caseForm.destino,
      prioridad: caseForm.prioridad,
      estado: caseForm.estado,
      fechaEgreso: caseForm.fechaEgreso,
      tutor: caseForm.tutor,
      referentes: caseForm.referentes,
      bitacora: caseForm.bitacora,
      documentos: caseForm.documentos,
    };
    const finalId =
      editingCaseId || `CASO-${String(cases.length + 1).padStart(3, '0')}`;
    await saveToCloud('cases', finalId, { id: finalId, ...caseData });
    setIsCaseModalOpen(false);
    setEditingCaseId(null);
    setCaseForm(defaultCaseState);
    setCaseSummary('');
  };

  const handleAddBitacora = () => {
    if (!newBitacoraEntry.descripcion) return;
    setCaseForm({
      ...caseForm,
      bitacora: [
        {
          id: Date.now(),
          ...newBitacoraEntry,
          fecha: new Date().toISOString().split('T')[0],
          completada: false,
        },
        ...caseForm.bitacora,
      ],
    });
    setNewBitacoraEntry({
      tipo: 'Nota',
      descripcion: '',
      responsable: '',
      fechaCumplimiento: '',
    });
  };
  const toggleTaskCompletion = (entryId) =>
    setCaseForm({
      ...caseForm,
      bitacora: caseForm.bitacora.map((entry) =>
        entry.id === entryId
          ? { ...entry, completada: !entry.completada }
          : entry
      ),
    });

  const handleSaveProtocol = async () => {
    if (!newDocName) return alert('Ponle un nombre');
    const finalId = editingDocId || `DOC-00${docs.length + 1}`;
    const docData = {
      id: finalId,
      nombre: newDocName,
      ambito: newDocAmbito,
      fase: newDocFase,
      avance: newDocAvance,
      bitacora: docBitacora,
      archivos: docArchivos,
    };
    await saveToCloud('docs', finalId, docData);
    setIsDocModalOpen(false);
    setEditingDocId(null);
    setNewDocName('');
    setDraftContent('');
  };

  const handleAddDocBitacora = () => {
    if (!newDocBitacoraEntry.descripcion) return;
    setDocBitacora([
      {
        id: Date.now(),
        ...newDocBitacoraEntry,
        fecha: new Date().toISOString().split('T')[0],
        completada: false,
      },
      ...docBitacora,
    ]);
    setNewDocBitacoraEntry({
      tipo: 'Nota',
      descripcion: '',
      responsable: '',
      fechaCumplimiento: '',
    });
  };
  const toggleDocTaskCompletion = (entryId) =>
    setDocBitacora(
      docBitacora.map((entry) =>
        entry.id === entryId
          ? { ...entry, completada: !entry.completada }
          : entry
      )
    );

  const handleSaveDir = async () => {
    if (!dirForm.nombre || !dirForm.institucion)
      return alert('Nombre e Institución son obligatorios');
    const finalId = editingDirId || Date.now();
    await saveToCloud('directory', finalId, { ...dirForm, id: finalId });
    setIsDirModalOpen(false);
  };
  const handleDeleteDir = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este contacto?'))
      await deleteFromCloud('directory', id);
  };

  const handleSaveTemplate = async () => {
    if (
      !templateForm.nombre ||
      templateForm.criterios.filter((c) => c.trim() !== '').length === 0
    )
      return alert('Ingresa un nombre y al menos un criterio válido.');
    const validCriterios = templateForm.criterios.filter(
      (c) => c.trim() !== ''
    );
    const validRangos = templateForm.rangos
      .filter((r) => r.resultado && r.min !== '' && r.max !== '')
      .map((r) => ({
        min: Number(r.min),
        max: Number(r.max),
        resultado: r.resultado,
      }));
    const finalId = `TPL-00${auditTemplates.length + 1}`;
    await saveToCloud('auditTemplates', finalId, {
      id: finalId,
      nombre: templateForm.nombre,
      tipo: templateForm.tipo,
      criterios: validCriterios,
      rangos: validRangos,
    });
    setIsTemplateModalOpen(false);
  };

  const handleSaveAudit = async () => {
    const selectedTemplate = auditTemplates.find(
      (t) => t.id === auditForm.templateId
    );
    if (!selectedTemplate) return;
    const totalCriterios = selectedTemplate.criterios.length;
    const aprobados = Object.values(auditForm.answers).filter(
      (val) => val === 'si'
    ).length;
    const score =
      totalCriterios > 0 ? Math.round((aprobados / totalCriterios) * 100) : 0;
    const puntajeTexto = `${aprobados} / ${totalCriterios} pts`;
    let estadoTexto = score >= 75 ? 'Cerrada' : 'Con Observaciones';
    if (selectedTemplate.rangos && selectedTemplate.rangos.length > 0) {
      const match = selectedTemplate.rangos.find(
        (r) => aprobados >= r.min && aprobados <= r.max
      );
      if (match) estadoTexto = match.resultado;
    }
    const finalId = `AUD-00${audits.length + 1}`;
    await saveToCloud('audits', finalId, {
      id: finalId,
      centro: auditForm.centro,
      tipo: auditForm.tipo,
      templateId: selectedTemplate.id,
      fecha: new Date().toISOString().split('T')[0],
      cumplimiento: score,
      puntaje: puntajeTexto,
      estado: estadoTexto,
      evaluador: currentUser.nombre,
    });
    setIsAuditModalOpen(false);
    setAuditForm({
      centro: centros[0] || '',
      templateId: auditTemplates[0]?.id || '',
      answers: {},
      tipo: 'Auditoría',
    });
  };

  const handleSaveUser = async () => {
    if (!userForm.rut || !userForm.nombre || !userForm.password)
      return alert('RUT, Nombre y Contraseña son obligatorios.');
    const finalId = editingUserId || Date.now();
    await saveToCloud('users', finalId, { ...userForm, id: finalId });
    setIsUserModalOpen(false);
  };
  const handleDeleteUser = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este usuario?'))
      await deleteFromCloud('users', id);
  };

  const toggleCentroAsignado = (centroName) => {
    const isAsignado = userForm.centrosAsignados.includes(centroName);
    if (isAsignado) {
      setUserForm({
        ...userForm,
        centrosAsignados: userForm.centrosAsignados.filter(
          (c) => c !== centroName
        ),
      });
    } else {
      setUserForm({
        ...userForm,
        centrosAsignados: [...userForm.centrosAsignados, centroName],
      });
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      return alert('Por favor, completa todos los campos.');
    }
    if (passwordForm.current !== currentUser.password) {
      return alert('La contraseña actual es incorrecta.');
    }
    if (passwordForm.new !== passwordForm.confirm) {
      return alert('Las nuevas contraseñas no coinciden.');
    }
    if (passwordForm.new.length < 4) {
      return alert('La nueva contraseña debe tener al menos 4 caracteres.');
    }

    try {
      const updatedUser = { ...currentUser, password: passwordForm.new };
      await saveToCloud('users', currentUser.id, updatedUser);
      setCurrentUser(updatedUser);
      setIsProfileModalOpen(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
      alert('¡Contraseña actualizada exitosamente!');
    } catch (e) {
      console.error(e);
      alert('Hubo un error al actualizar la contraseña en la nube.');
    }
  };

  // UI Components
  const StatusBadge = ({ status }) => {
    if (status === 'Alerta')
      return (
        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
          <AlertTriangle size={12} /> ALERTA
        </span>
      );
    if (status === 'Pendiente')
      return (
        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
          <Clock size={12} /> PENDIENTE
        </span>
      );
    if (status === 'Concretado')
      return (
        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
          <CheckCircle size={12} /> CONCRETADO
        </span>
      );
    return (
      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">
        {status}
      </span>
    );
  };
  const ProgressBar = ({ progress }) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full ${
          progress === 100 ? 'bg-green-600' : 'bg-blue-600'
        }`}
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
  const FileList = ({ files, target }) => (
    <div className="space-y-3">
      {files.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
          <Paperclip size={24} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">No hay documentos adjuntos.</p>
        </div>
      ) : (
        files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  file.tipo && file.tipo.includes('pdf')
                    ? 'bg-red-50 text-red-600'
                    : 'bg-blue-50 text-blue-600'
                }`}
              >
                <FileIcon size={20} />
              </div>
              <div className="truncate">
                <p
                  className="text-sm font-bold text-gray-800 truncate"
                  title={file.nombre}
                >
                  {file.nombre}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
                  <span>{file.size}</span> • <span>Subido: {file.fecha}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => deleteFile(file.id, target)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
              title="Eliminar archivo"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))
      )}
    </div>
  );

  const Timeline = ({ origen, destino, estado }) => {
    const isReady = estado === 'Concretado';
    const isAlert = estado === 'Alerta';
    return (
      <div className="flex items-center w-full mb-6 max-w-lg mx-auto bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div className="flex-1 flex flex-col items-center relative">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shadow-sm z-10 border border-blue-200">
            1
          </div>
          <p className="text-[10px] font-bold text-gray-600 mt-2 text-center absolute top-10 w-24">
            {origen || 'Origen'}
          </p>
        </div>
        <div
          className={`flex-1 h-1 ${
            isReady ? 'bg-green-300' : 'bg-blue-200'
          } -ml-12 -mr-12 relative z-0 mt-[-20px]`}
        ></div>
        <div className="flex-1 flex flex-col items-center relative">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm z-10 border ${
              isAlert
                ? 'bg-red-100 text-red-600 border-red-300 animate-pulse'
                : isReady
                ? 'bg-green-100 text-green-600 border-green-300'
                : 'bg-yellow-100 text-yellow-600 border-yellow-300'
            }`}
          >
            <GitCommit size={14} />
          </div>
          <p
            className={`text-[10px] font-bold mt-2 text-center absolute top-10 w-24 ${
              isAlert ? 'text-red-500' : 'text-gray-500'
            }`}
          >
            {estado}
          </p>
        </div>
        <div
          className={`flex-1 h-1 ${
            isReady ? 'bg-green-300' : 'bg-gray-200'
          } -ml-12 -mr-12 relative z-0 mt-[-20px]`}
        ></div>
        <div className="flex-1 flex flex-col items-center relative">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm z-10 border ${
              isReady
                ? 'bg-green-100 text-green-600 border-green-300'
                : 'bg-gray-100 text-gray-400 border-gray-200'
            }`}
          >
            3
          </div>
          <p className="text-[10px] font-bold text-gray-600 mt-2 text-center absolute top-10 w-24">
            {destino || 'Destino'}
          </p>
        </div>
      </div>
    );
  };

  // --- VISTAS PRINCIPALES ---
  const renderDashboard = () => {
    const alertCases = visibleCases.filter((c) => c.estado === 'Alerta');
    const tareasCriticas = visibleCases
      .flatMap((c) => c.bitacora || [])
      .concat(docs.flatMap((d) => d.bitacora || []))
      .filter(
        (t) =>
          !t.completada &&
          (getTaskStatus(t.fechaCumplimiento).status === 'upcoming' ||
            getTaskStatus(t.fechaCumplimiento).status === 'overdue')
      ).length;
    const allPendingTasks = [
      ...visibleCases.flatMap((c) =>
        (c.bitacora || [])
          .filter((b) => b.tipo === 'Tarea' && !b.completada)
          .map((b) => ({
            ...b,
            parentId: c.id,
            parentName: c.nombre || c.paciente,
            source: 'Caso',
          }))
      ),
      ...docs.flatMap((d) =>
        (d.bitacora || [])
          .filter((b) => b.tipo === 'Tarea' && !b.completada)
          .map((b) => ({
            ...b,
            parentId: d.id,
            parentName: d.nombre,
            source: 'Protocolo',
          }))
      ),
    ].sort((a, b) =>
      (a.fechaCumplimiento || '9999-99-99').localeCompare(
        b.fechaCumplimiento || '9999-99-99'
      )
    );

    return (
      <div className="space-y-6 fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">
            Resumen de mi Red
          </h2>
          <button
            onClick={handleExportCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <Download size={16} /> Exportar Excel
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100 border-l-4 border-l-red-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase">
                  Pérdida Continuidad
                </p>
                <h3 className="text-2xl font-bold text-red-600 mt-1">
                  {alertCases.length}
                </h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100 border-l-4 border-l-blue-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase">
                  Pacientes en Tránsito
                </p>
                <h3 className="text-2xl font-bold text-blue-600 mt-1">
                  {visibleCases.filter((c) => c.estado === 'Pendiente').length}
                </h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-yellow-100 border-l-4 border-l-yellow-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase">
                  Tareas Críticas
                </p>
                <h3 className="text-2xl font-bold text-yellow-600 mt-1">
                  {tareasCriticas}
                </h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-indigo-100 border-l-4 border-l-indigo-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase">
                  Auditorías Normativas
                </p>
                <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                  {visibleAudits.filter((a) => a.tipo === 'Auditoría').length}
                </h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-teal-100 border-l-4 border-l-teal-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase">
                  Consultorías Clínicas
                </p>
                <h3 className="text-2xl font-bold text-teal-600 mt-1">
                  {visibleAudits.filter((a) => a.tipo === 'Consultoría').length}
                </h3>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-500" /> Casos
              Críticos Requiriendo Rescate
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-sm border-b">
                    <th className="p-3">ID</th>
                    <th className="p-3">Paciente</th>
                    <th className="p-3">Destino</th>
                    <th className="p-3">Prioridad</th>
                  </tr>
                </thead>
                <tbody>
                  {alertCases.map((c) => (
                    <tr key={c.id} className="border-b">
                      <td className="p-3 text-sm">{c.id}</td>
                      <td className="p-3 text-sm font-bold">{c.nombre}</td>
                      <td className="p-3 text-sm">{c.destino}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                          {c.prioridad}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {alertCases.length === 0 && (
                    <tr>
                      <td
                        colSpan="4"
                        className="p-4 text-center text-gray-500 text-sm"
                      >
                        No hay casos en alerta actualmente en tus centros
                        asignados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-indigo-50 rounded-xl shadow-sm border border-indigo-100 p-6 flex flex-col">
            <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
              Asistente de Gestión
            </h3>
            <p className="text-xs text-indigo-700 mb-4">
              Usa IA para redactar un reporte a las jefaturas sobre los{' '}
              {alertCases.length} casos críticos actuales.
            </p>
            <button
              onClick={handleGenerateReport}
              disabled={alertCases.length === 0 || isGeneratingReport}
              className={`w-full py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all shadow-sm ${
                alertCases.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isGeneratingReport ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}{' '}
              ✨ Redactar Reporte
            </button>
            {reportContent && (
              <div className="mt-4 flex-1 flex flex-col fade-in">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-indigo-800">
                    Borrador Generado:
                  </span>
                  <button
                    onClick={() => copyToClipboard(reportContent)}
                    className="text-indigo-600 hover:text-indigo-800"
                    title="Copiar"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <textarea
                  className="w-full flex-1 min-h-[150px] p-3 rounded-lg border border-indigo-200 text-xs text-gray-700 resize-none outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  value={reportContent}
                  onChange={(e) => setReportContent(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ListTodo size={20} className="text-blue-500" /> Seguimiento de
            Tareas Intersectoriales
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm border-b">
                  <th className="p-3 font-semibold w-12">Est.</th>
                  <th className="p-3 font-semibold">Paciente / Caso</th>
                  <th className="p-3 font-semibold">Tarea Asignada</th>
                  <th className="p-3 font-semibold">Responsable</th>
                  <th className="p-3 font-semibold">Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {allPendingTasks.map((tarea) => {
                  const statusInfo = getTaskStatus(tarea.fechaCumplimiento);
                  return (
                    <tr
                      key={tarea.id}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-3">
                        <Square size={16} className="text-gray-400" />
                      </td>
                      <td className="p-3 text-sm text-gray-800 font-medium">
                        <div className="flex items-center gap-2">
                          {tarea.parentName}
                          {statusInfo.status === 'upcoming' && (
                            <span
                              className="flex items-center gap-1 text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded text-[10px] font-bold animate-pulse"
                              title="Vence en 10 días o menos"
                            >
                              <Bell size={12} className="fill-yellow-600" />{' '}
                              Alarma
                            </span>
                          )}
                          {statusInfo.status === 'overdue' && (
                            <span
                              className="flex items-center gap-1 text-red-700 bg-red-100 px-1.5 py-0.5 rounded text-[10px] font-bold"
                              title="Tarea vencida"
                            >
                              <AlertTriangle
                                size={12}
                                className="fill-red-600"
                              />{' '}
                              Vencida
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          {tarea.parentId} ({tarea.source})
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {tarea.descripcion}
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {tarea.responsable || 'No asignado'}
                      </td>
                      <td className="p-3">
                        {tarea.fechaCumplimiento ? (
                          <span
                            className={`px-2 py-1 text-xs font-bold rounded flex items-center gap-1 w-fit ${statusInfo.bgClass}`}
                          >
                            {statusInfo.showWarning && (
                              <AlertTriangle size={12} />
                            )}
                            {tarea.fechaCumplimiento}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            Sin fecha límite
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {allPendingTasks.length === 0 && (
                  <tr>
                    <td
                      colSpan="5"
                      className="p-4 text-center text-gray-500 text-sm"
                    >
                      No hay tareas pendientes en tu red.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCases = () => {
    const filteredCases =
      ageFilter === 'all'
        ? visibleCases
        : ageFilter === 'child'
        ? visibleCases.filter((c) => c.edad < 18)
        : visibleCases.filter((c) => c.edad >= 18);
    return (
      <div className="space-y-6 fade-in">
        <div className="flex justify-between items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Continuidad de Cuidados
          </h2>
          <div className="flex gap-3">
            <div className="flex bg-white rounded-lg p-1 border shadow-sm">
              <button
                onClick={() => setAgeFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                  ageFilter === 'all' ? 'bg-gray-100' : ''
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setAgeFilter('child')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                  ageFilter === 'child' ? 'bg-blue-100 text-blue-800' : ''
                }`}
              >
                Infanto (&lt;18)
              </button>
            </div>
            <button
              onClick={() => {
                setEditingCaseId(null);
                setCaseForm(defaultCaseState);
                setActiveModalTab('datos');
                setIsCaseModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <Plus size={16} /> Nuevo
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">Paciente</th>
                <th className="p-4">Origen → Destino</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-sm font-bold text-gray-800">
                    {c.id}
                    {c.referentes && c.referentes.length > 0 && (
                      <div className="text-[10px] text-blue-600 font-normal mt-0.5 flex items-center gap-1">
                        <Users size={10} /> {c.referentes.length} ref(s)
                      </div>
                    )}
                    {c.documentos && c.documentos.length > 0 && (
                      <div className="text-[10px] text-gray-500 font-normal mt-0.5 flex items-center gap-1">
                        <Paperclip size={10} /> {c.documentos.length} doc(s)
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    <div className="font-bold text-gray-800 flex items-center gap-2">
                      {c.nombre || c.paciente}{' '}
                      {c.edad && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            c.edad < 18
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {c.edad}a
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      RUT: {c.paciente}
                    </div>
                    {c.tutor && c.tutor.nombre && (
                      <div
                        className="text-[10px] text-gray-400 mt-1"
                        title={`Tutor Legal: ${c.tutor.relacion}`}
                      >
                        Tutor: {c.tutor.nombre}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-sm text-gray-700">
                    <div className="font-medium">{c.origen}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      ↳ {c.destino}
                    </div>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={c.estado} />
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => {
                        setEditingCaseId(c.id);
                        setCaseForm({ ...c, rut: c.paciente });
                        setActiveModalTab('datos');
                        setIsCaseModalOpen(true);
                      }}
                      className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                    >
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    No hay pacientes asignados a tu centro con este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDocs = () => (
    <div className="space-y-6 fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">
          Normativa y Protocolos
        </h2>
        <button
          onClick={() => {
            setEditingDocId(null);
            setNewDocName('');
            setNewDocAmbito(ambitosProtocolo[0]);
            setNewDocFase('Levantamiento');
            setNewDocAvance(10);
            setDocBitacora([]);
            setDocArchivos([]);
            setActiveDocModalTab('datos');
            setDraftContent('');
            setIsDocModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus size={16} /> Iniciar Protocolo
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {docs.map((d) => (
          <div
            key={d.id}
            className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow"
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  {d.id}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                    <Activity size={12} /> {d.ambito}
                  </span>
                  <button
                    onClick={() => {
                      setEditingDocId(d.id);
                      setNewDocName(d.nombre);
                      setNewDocAmbito(d.ambito);
                      setNewDocFase(d.fase);
                      setNewDocAvance(d.avance);
                      setDocBitacora(d.bitacora || []);
                      setDocArchivos(d.archivos || []);
                      setActiveDocModalTab('datos');
                      setDraftContent('');
                      setIsDocModalOpen(true);
                    }}
                    className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                    title="Editar Protocolo"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">
                {d.nombre}
              </h3>
              <p className="text-sm text-gray-500 mb-2">
                Fase Actual:{' '}
                <span className="font-semibold text-gray-700">{d.fase}</span>
              </p>
              {d.archivos && d.archivos.length > 0 && (
                <div className="text-[10px] font-medium text-blue-600 flex items-center gap-1 mb-4 bg-blue-50 w-fit px-2 py-1 rounded">
                  <Paperclip size={12} /> {d.archivos.length} adjunto(s)
                </div>
              )}
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1 font-medium text-gray-600">
                <span>Avance General</span>
                <span>{d.avance}%</span>
              </div>
              <ProgressBar progress={d.avance} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderEvaluations = (tipoLabel) => {
    const isAuditoria = tipoLabel === 'Auditoría';
    const currentFilter = isAuditoria
      ? centroFilterAuditorias
      : centroFilterConsultorias;
    const setFilter = isAuditoria
      ? setCentroFilterAuditorias
      : setCentroFilterConsultorias;

    const filteredAudits = visibleAudits.filter(
      (a) =>
        a.tipo === tipoLabel &&
        (currentFilter === 'Todos' || a.centro === currentFilter)
    );

    return (
      <div className="space-y-6 fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">
            {isAuditoria
              ? 'Auditorías y Pautas Normativas'
              : 'Consultorías Clínicas e Intersectoriales'}
          </h2>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter size={14} className="text-gray-400" />
              </div>
              <select
                value={currentFilter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Todos">Todos los Dispositivos</option>
                {centros.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {currentUser?.rol === 'Admin' && (
              <button
                onClick={() => {
                  setTemplateForm({
                    nombre: '',
                    criterios: [''],
                    rangos: [],
                    tipo: 'Ambos',
                  });
                  setIsTemplateModalOpen(true);
                }}
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <Settings size={16} /> Configurar Pautas
              </button>
            )}
            <button
              onClick={() => {
                setAuditForm({
                  centro: centros[0] || '',
                  templateId:
                    auditTemplates.find(
                      (t) => t.tipo === 'Ambos' || t.tipo === tipoLabel
                    )?.id || '',
                  answers: {},
                  tipo: tipoLabel,
                });
                setIsAuditModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <ClipboardCheck size={16} /> Nueva Evaluación
            </button>
          </div>
        </div>

        {filteredAudits.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
            <ClipboardCheck size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">
              No se encontraron registros para tu perfil en este filtro.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAudits.map((a) => {
              const template = auditTemplates.find(
                (t) => t.id === a.templateId
              );
              return (
                <div
                  key={a.id}
                  className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-bold text-gray-800">{a.centro}</h3>
                    <p className="text-xs text-blue-600 font-bold mb-1">
                      {template ? template.nombre : 'Pauta Desconocida'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Fecha: {a.fecha} • Por: {a.evaluador}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-gray-800">
                      {a.cumplimiento}%
                    </div>
                    <span className="text-[10px] uppercase text-gray-500 font-bold block mb-0.5">
                      {a.puntaje}
                    </span>
                    <span
                      className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                        a.cumplimiento >= 75
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {a.estado}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderDirectory = () => {
    const filteredDir = directory.filter(
      (d) =>
        d.nombre.toLowerCase().includes(dirSearch.toLowerCase()) ||
        d.institucion.toLowerCase().includes(dirSearch.toLowerCase())
    );
    return (
      <div className="space-y-6 fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">
            Directorio Intersectorial
          </h2>
          <div className="flex gap-4 items-center">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Buscar contacto..."
              />
            </div>
            <button
              onClick={() => {
                setEditingDirId(null);
                setDirForm({
                  nombre: '',
                  cargo: '',
                  institucion: '',
                  telefono: '',
                  correo: '',
                });
                setIsDirModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <Plus size={16} /> Nuevo
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredDir.map((d) => (
            <div
              key={d.id}
              className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative group hover:border-blue-200 transition-colors"
            >
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  onClick={() => {
                    setEditingDirId(d.id);
                    setDirForm(d);
                    setIsDirModalOpen(true);
                  }}
                  className="p-1.5 bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600 rounded"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => handleDeleteDir(d.id)}
                  className="p-1.5 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <h3 className="font-bold text-gray-800 flex items-center gap-2 pr-12">
                <User size={16} className="text-blue-500" /> {d.nombre}
              </h3>
              <p className="text-xs text-gray-600 font-bold mb-3">
                {d.cargo} •{' '}
                <span className="text-indigo-600">{d.institucion}</span>
              </p>
              <p className="text-xs text-gray-500">{d.telefono}</p>
              <p className="text-xs text-gray-500">{d.correo}</p>
            </div>
          ))}
          {filteredDir.length === 0 && (
            <div className="col-span-3 text-center py-8 text-gray-500">
              No se encontraron contactos.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConfig = () => (
    <div className="space-y-6 fade-in">
      <h2 className="text-2xl font-bold text-gray-800">
        Configuración de la Plataforma
      </h2>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-3xl">
        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Activity size={18} className="text-blue-600" /> Dispositivos y
          Centros de la Red
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Agrega o elimina los centros de salud mental, hospitales y
          dispositivos intersectoriales de tu red. Estos se reflejarán en los
          formularios de traslados y auditorías.
        </p>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newCentroName}
            onChange={(e) => setNewCentroName(e.target.value)}
            placeholder="Ej: CESFAM Angelmó..."
            className="border p-2 rounded-lg flex-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={async () => {
              if (newCentroName.trim()) {
                await saveToCloud('settings', 'centros', {
                  list: [...centros, newCentroName.trim()].sort(),
                });
                setNewCentroName('');
              }
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus size={16} /> Agregar Centro
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {centros.map((c) => (
            <div
              key={c}
              className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">{c}</span>
              <button
                onClick={async () => {
                  if (window.confirm(`¿Seguro que deseas eliminar ${c}?`))
                    await saveToCloud('settings', 'centros', {
                      list: centros.filter((x) => x !== c),
                    });
                }}
                className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6 fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">
          Gestión de Usuarios y Accesos
        </h2>
        <button
          onClick={() => {
            setEditingUserId(null);
            setUserForm({
              rut: '',
              nombre: '',
              iniciales: '',
              cargo: '',
              password: '',
              rol: 'Usuario',
              centrosAsignados: [],
            });
            setIsUserModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
        >
          <UserPlus size={16} /> Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-sm border-b">
              <th className="p-4 font-semibold text-gray-600">Usuario</th>
              <th className="p-4 font-semibold text-gray-600">
                Rol / Privilegios
              </th>
              <th className="p-4 font-semibold text-gray-600">
                Dispositivos Asignados (Visibilidad)
              </th>
              <th className="p-4 font-semibold text-gray-600 text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs">
                      {u.iniciales}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800">
                        {u.nombre}
                      </p>
                      <p className="text-xs text-gray-500">
                        {u.rut} • {u.cargo}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit ${
                      u.rol === 'Admin'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {u.rol === 'Admin' && <Shield size={12} />} {u.rol}
                  </span>
                </td>
                <td className="p-4 text-xs text-gray-600">
                  {u.rol === 'Admin' ? (
                    <span className="text-indigo-600 font-medium">
                      Acceso Total a la Red
                    </span>
                  ) : u.centrosAsignados.length > 0 ? (
                    u.centrosAsignados.map((c) => (
                      <span
                        key={c}
                        className="block bg-gray-100 px-1.5 py-0.5 rounded w-fit mb-1 border border-gray-200"
                      >
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-red-500 font-medium">
                      Sin centros asignados (No verá datos)
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => {
                      setEditingUserId(u.id);
                      setUserForm(u);
                      setIsUserModalOpen(true);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 rounded transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  {u.rol !== 'Admin' && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (!currentUser) return renderLogin();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-64 bg-[#0a2540] text-white flex flex-col hidden md:flex h-screen sticky top-0 shrink-0">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold">SGCC-SM</h1>
          <p className="text-xs text-blue-200">SS Reloncaví</p>
        </div>
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center font-bold">
            {currentUser.iniciales}
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">
              {currentUser.nombre}
            </p>
            <p className="text-[10px] text-blue-200 uppercase">
              {currentUser.cargo}
            </p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
              activeTab === 'dashboard' ? 'bg-blue-600' : 'hover:bg-white/5'
            }`}
          >
            <LayoutDashboard size={18} /> Panel
          </button>
          <button
            onClick={() => setActiveTab('cases')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
              activeTab === 'cases' ? 'bg-blue-600' : 'hover:bg-white/5'
            }`}
          >
            <Users size={18} /> Casos Clínicos
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
              activeTab === 'docs' ? 'bg-blue-600' : 'hover:bg-white/5'
            }`}
          >
            <FileText size={18} /> Protocolos
          </button>

          <div className="pt-2 pb-1">
            <p className="px-4 text-[10px] text-blue-300 font-bold uppercase tracking-wider">
              Evaluación en Red
            </p>
          </div>
          <button
            onClick={() => setActiveTab('auditorias')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
              activeTab === 'auditorias' ? 'bg-blue-600' : 'hover:bg-white/5'
            }`}
          >
            <ClipboardCheck size={18} /> Auditorías / Pautas
          </button>
          <button
            onClick={() => setActiveTab('consultorias')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
              activeTab === 'consultorias' ? 'bg-blue-600' : 'hover:bg-white/5'
            }`}
          >
            <MessageSquare size={18} /> Consultorías Clínicas
          </button>
          <button
            onClick={() => setActiveTab('directory')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
              activeTab === 'directory' ? 'bg-blue-600' : 'hover:bg-white/5'
            }`}
          >
            <BookOpen size={18} /> Directorio
          </button>

          {currentUser.rol === 'Admin' && (
            <>
              <div className="pt-2 pb-1 border-t border-white/10 mt-2">
                <p className="px-4 text-[10px] text-blue-300 font-bold uppercase tracking-wider">
                  Administración
                </p>
              </div>
              <button
                onClick={() => setActiveTab('usuarios')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'usuarios' ? 'bg-blue-600' : 'hover:bg-white/5'
                }`}
              >
                <UserPlus size={18} /> Usuarios y Accesos
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                  activeTab === 'config' ? 'bg-blue-600' : 'hover:bg-white/5'
                }`}
              >
                <Settings size={18} /> Configuración
              </button>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => setCurrentUser(null)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm hover:bg-red-500/20"
          >
            <LogOut size={18} /> Salir
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-medium text-gray-500">
              Gestión de Calidad y Continuidad
            </h2>
            <p className="text-gray-800 font-bold hidden md:block">
              ¡Hola {currentUser.nombre.split(' ')[0]}!
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="p-2 bg-white rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
              title="Cambiar Mi Contraseña"
            >
              <Key size={20} />
            </button>
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 bg-white rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 relative shadow-sm"
              >
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 fade-in">
                  <div className="bg-[#0a2540] text-white px-4 py-3 font-bold flex justify-between items-center">
                    Notificaciones
                    <span className="bg-blue-600 text-xs px-2 py-0.5 rounded-full">
                      {notifications.length}
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-500">
                        No hay notificaciones pendientes.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className="p-3 hover:bg-gray-50 transition-colors flex gap-3 items-start"
                          >
                            <div className="mt-0.5">
                              {n.type === 'alerta' ? (
                                <AlertTriangle
                                  size={16}
                                  className="text-red-500"
                                />
                              ) : n.type === 'overdue' ? (
                                <AlertTriangle
                                  size={16}
                                  className="text-red-600"
                                />
                              ) : (
                                <Bell size={16} className="text-yellow-500" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-800">
                                {n.title}
                              </p>
                              <p className="text-[10px] text-gray-600 mt-0.5">
                                {n.desc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'cases' && renderCases()}
        {activeTab === 'docs' && renderDocs()}
        {activeTab === 'auditorias' && renderEvaluations('Auditoría')}
        {activeTab === 'consultorias' && renderEvaluations('Consultoría')}
        {activeTab === 'directory' && renderDirectory()}
        {activeTab === 'config' &&
          currentUser.rol === 'Admin' &&
          renderConfig()}
        {activeTab === 'usuarios' &&
          currentUser.rol === 'Admin' &&
          renderUsers()}
      </main>

      {/* MODAL USUARIOS */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-gray-800 p-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-bold flex items-center gap-2">
                <UserPlus size={18} />{' '}
                {editingUserId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-white hover:text-gray-300 font-bold text-xl"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    RUT *
                  </label>
                  <input
                    type="text"
                    value={userForm.rut}
                    onChange={(e) =>
                      setUserForm({ ...userForm, rut: e.target.value })
                    }
                    className="w-full border rounded p-2 text-sm outline-none focus:ring-2 focus:ring-gray-800"
                    placeholder="11.111.111-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contraseña *
                  </label>
                  <input
                    type="text"
                    value={userForm.password}
                    onChange={(e) =>
                      setUserForm({ ...userForm, password: e.target.value })
                    }
                    className="w-full border rounded p-2 text-sm outline-none focus:ring-2 focus:ring-gray-800"
                    placeholder="••••••"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={userForm.nombre}
                    onChange={(e) =>
                      setUserForm({ ...userForm, nombre: e.target.value })
                    }
                    className="w-full border rounded p-2 text-sm outline-none focus:ring-2 focus:ring-gray-800"
                    placeholder="Ej: Dra. Andrea Silva"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Iniciales
                  </label>
                  <input
                    type="text"
                    value={userForm.iniciales}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        iniciales: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full border rounded p-2 text-sm outline-none focus:ring-2 focus:ring-gray-800"
                    placeholder="AS"
                    maxLength={3}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Cargo
                </label>
                <input
                  type="text"
                  value={userForm.cargo}
                  onChange={(e) =>
                    setUserForm({ ...userForm, cargo: e.target.value })
                  }
                  className="w-full border rounded p-2 text-sm outline-none focus:ring-2 focus:ring-gray-800"
                  placeholder="Ej: Directora COSAM"
                />
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  Permisos y Privilegios
                </label>
                <select
                  value={userForm.rol}
                  onChange={(e) =>
                    setUserForm({ ...userForm, rol: e.target.value })
                  }
                  className="w-full border rounded p-2 text-sm outline-none focus:ring-2 focus:ring-gray-800 mb-4 bg-gray-50 font-semibold"
                >
                  <option value="Usuario">
                    Usuario Estándar (Acceso Parcial a su Centro)
                  </option>
                  <option value="Admin">
                    Administrador (Acceso Total a la Red)
                  </option>
                </select>

                {userForm.rol === 'Usuario' && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-800 font-bold mb-2">
                      Selecciona los dispositivos que este usuario puede
                      gestionar:
                    </p>
                    <div className="space-y-1 max-h-[150px] overflow-y-auto">
                      {centros.map((c) => (
                        <label
                          key={c}
                          className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-1 hover:bg-blue-100 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={userForm.centrosAsignados.includes(c)}
                            onChange={() => toggleCentroAsignado(c)}
                            className="accent-blue-600"
                          />
                          {c}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-gray-50 p-4 border-t flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveUser}
                className="px-4 py-2 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-900"
              >
                {editingUserId ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MI PERFIL / CAMBIAR CONTRASEÑA */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-bold flex items-center gap-2">
                <Key size={18} /> Cambiar Contraseña
              </h3>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="text-white hover:text-blue-200 font-bold text-xl"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 mb-2">
                Ingresa tu contraseña actual y la nueva clave que deseas
                utilizar en la red.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Contraseña Actual *
                </label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      current: e.target.value,
                    })
                  }
                  className="w-full border rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••"
                />
              </div>
              <div className="border-t border-gray-100 pt-4 mt-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nueva Contraseña *
                </label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, new: e.target.value })
                  }
                  className="w-full border rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Confirmar Nueva Contraseña *
                </label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirm: e.target.value,
                    })
                  }
                  className="w-full border rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••"
                />
              </div>
            </div>
            <div className="bg-gray-50 p-4 border-t flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdatePassword}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CASOS */}
      {isCaseModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-bold">
                {editingCaseId
                  ? `Gestión: ${caseForm.nombre}`
                  : 'Nuevo Ingreso'}
              </h3>
              <button
                onClick={() => setIsCaseModalOpen(false)}
                className="text-white font-bold text-xl hover:text-blue-200"
              >
                &times;
              </button>
            </div>
            <div className="flex border-b bg-gray-50 px-4 pt-2 shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveModalTab('datos')}
                className={`px-4 py-2 text-sm font-bold border-b-2 ${
                  activeModalTab === 'datos'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500'
                }`}
              >
                1. Datos y Ruta
              </button>
              <button
                onClick={() => setActiveModalTab('bitacora')}
                className={`px-4 py-2 text-sm font-bold border-b-2 ${
                  activeModalTab === 'bitacora'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500'
                }`}
              >
                2. Evolución y Tareas
              </button>
              <button
                onClick={() => setActiveModalTab('archivos')}
                className={`px-4 py-2 text-sm font-bold border-b-2 ${
                  activeModalTab === 'archivos'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500'
                }`}
              >
                3. Archivos
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {activeModalTab === 'datos' && (
                <div className="space-y-6 fade-in">
                  <Timeline
                    origen={caseForm.origen}
                    destino={caseForm.destino}
                    estado={caseForm.estado}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Paciente
                      </label>
                      <input
                        type="text"
                        value={caseForm.nombre}
                        onChange={(e) =>
                          setCaseForm({ ...caseForm, nombre: e.target.value })
                        }
                        className="w-full border rounded p-2 text-sm"
                        placeholder="Ej: Martín Pérez"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Edad
                      </label>
                      <input
                        type="number"
                        value={caseForm.edad}
                        onChange={(e) =>
                          setCaseForm({ ...caseForm, edad: e.target.value })
                        }
                        className="w-full border rounded p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        RUT
                      </label>
                      <input
                        type="text"
                        value={caseForm.rut}
                        onChange={(e) =>
                          setCaseForm({ ...caseForm, rut: e.target.value })
                        }
                        className="w-full border rounded p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Estado
                      </label>
                      <select
                        value={caseForm.estado}
                        onChange={(e) =>
                          setCaseForm({ ...caseForm, estado: e.target.value })
                        }
                        className="w-full border rounded p-2 text-sm bg-white"
                      >
                        <option>Pendiente</option>
                        <option>Concretado</option>
                        <option>Alerta</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Prioridad
                      </label>
                      <select
                        value={caseForm.prioridad}
                        onChange={(e) =>
                          setCaseForm({
                            ...caseForm,
                            prioridad: e.target.value,
                          })
                        }
                        className="w-full border rounded p-2 text-sm bg-white"
                      >
                        <option>Media</option>
                        <option>Alta</option>
                        <option>Crítica</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Origen
                      </label>
                      <select
                        value={caseForm.origen}
                        onChange={(e) =>
                          setCaseForm({ ...caseForm, origen: e.target.value })
                        }
                        className="w-full border rounded p-2 text-sm bg-white"
                      >
                        <option value="">Seleccione...</option>
                        {centros.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Destino
                      </label>
                      <select
                        value={caseForm.destino}
                        onChange={(e) =>
                          setCaseForm({ ...caseForm, destino: e.target.value })
                        }
                        className="w-full border rounded p-2 text-sm bg-white"
                      >
                        <option value="">Seleccione...</option>
                        {centros.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mt-6">
                    <h4 className="text-sm font-bold text-orange-900 mb-3 flex items-center gap-2">
                      <Users size={16} /> 2. Datos del Tutor Legal o Responsable
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-orange-800 mb-1">
                          Nombre Completo
                        </label>
                        <input
                          type="text"
                          value={caseForm.tutor?.nombre || ''}
                          onChange={(e) =>
                            setCaseForm({
                              ...caseForm,
                              tutor: {
                                ...caseForm.tutor,
                                nombre: e.target.value,
                              },
                            })
                          }
                          className="w-full border border-orange-200 rounded p-1.5 text-sm bg-white outline-none focus:ring-1 focus:ring-orange-500"
                          placeholder="Ej: María González"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-orange-800 mb-1">
                          Parentesco / Relación
                        </label>
                        <input
                          type="text"
                          value={caseForm.tutor?.relacion || ''}
                          onChange={(e) =>
                            setCaseForm({
                              ...caseForm,
                              tutor: {
                                ...caseForm.tutor,
                                relacion: e.target.value,
                              },
                            })
                          }
                          className="w-full border border-orange-200 rounded p-1.5 text-sm bg-white outline-none focus:ring-1 focus:ring-orange-500"
                          placeholder="Ej: Madre"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-orange-800 mb-1">
                          Teléfono de Contacto
                        </label>
                        <input
                          type="text"
                          value={caseForm.tutor?.telefono || ''}
                          onChange={(e) =>
                            setCaseForm({
                              ...caseForm,
                              tutor: {
                                ...caseForm.tutor,
                                telefono: e.target.value,
                              },
                            })
                          }
                          className="w-full border border-orange-200 rounded p-1.5 text-sm bg-white outline-none focus:ring-1 focus:ring-orange-500"
                          placeholder="+569..."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="flex justify-between items-center border-b pb-2 mb-3">
                      <h4 className="text-sm font-bold text-gray-800">
                        3. Referentes Institucionales de la Red
                      </h4>
                      <button
                        onClick={() =>
                          setCaseForm({
                            ...caseForm,
                            referentes: [
                              ...(caseForm.referentes || []),
                              {
                                nombre: '',
                                telefono: '',
                                correo: '',
                                institucion: '',
                              },
                            ],
                          })
                        }
                        className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded font-bold flex items-center gap-1 transition-colors"
                      >
                        <Plus size={12} /> Agregar Referente
                      </button>
                    </div>
                    <div className="space-y-3">
                      {!caseForm.referentes ||
                      caseForm.referentes.length === 0 ? (
                        <p className="text-xs text-gray-500 italic text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                          No hay referentes registrados. Presiona "Agregar
                          Referente" si el paciente es atendido por PRM, Mejor
                          Niñez, etc.
                        </p>
                      ) : (
                        caseForm.referentes.map((ref, index) => (
                          <div
                            key={index}
                            className="bg-gray-50 border border-gray-200 rounded-lg p-3 relative"
                          >
                            <button
                              onClick={() =>
                                setCaseForm({
                                  ...caseForm,
                                  referentes: caseForm.referentes.filter(
                                    (_, i) => i !== index
                                  ),
                                })
                              }
                              className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors bg-white rounded-full p-1 shadow-sm"
                              title="Eliminar referente"
                            >
                              <Trash2 size={14} />
                            </button>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs pr-8">
                              <div className="md:col-span-2">
                                <label className="block text-gray-600 font-semibold mb-0.5">
                                  Nombre y Cargo
                                </label>
                                <input
                                  type="text"
                                  value={ref.nombre}
                                  onChange={(e) => {
                                    const newRefs = [...caseForm.referentes];
                                    newRefs[index].nombre = e.target.value;
                                    setCaseForm({
                                      ...caseForm,
                                      referentes: newRefs,
                                    });
                                  }}
                                  className="w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder="Ej: Ps. Pedro Silva"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-gray-600 font-semibold mb-0.5">
                                  Institución / Programa
                                </label>
                                <input
                                  type="text"
                                  value={ref.institucion}
                                  onChange={(e) => {
                                    const newRefs = [...caseForm.referentes];
                                    newRefs[index].institucion = e.target.value;
                                    setCaseForm({
                                      ...caseForm,
                                      referentes: newRefs,
                                    });
                                  }}
                                  className="w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder="Ej: PRM Ancud"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-gray-600 font-semibold mb-0.5">
                                  Teléfono
                                </label>
                                <input
                                  type="text"
                                  value={ref.telefono}
                                  onChange={(e) => {
                                    const newRefs = [...caseForm.referentes];
                                    newRefs[index].telefono = e.target.value;
                                    setCaseForm({
                                      ...caseForm,
                                      referentes: newRefs,
                                    });
                                  }}
                                  className="w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder="Ej: +569..."
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-gray-600 font-semibold mb-0.5">
                                  Correo Electrónico
                                </label>
                                <input
                                  type="email"
                                  value={ref.correo}
                                  onChange={(e) => {
                                    const newRefs = [...caseForm.referentes];
                                    newRefs[index].correo = e.target.value;
                                    setCaseForm({
                                      ...caseForm,
                                      referentes: newRefs,
                                    });
                                  }}
                                  className="w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder="correo@red.cl"
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
              {activeModalTab === 'bitacora' && (
                <div className="flex flex-col h-full gap-4">
                  <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <div>
                      <h4 className="font-bold text-indigo-900 text-sm">
                        Resumen Clínico Inteligente
                      </h4>
                      <p className="text-xs text-indigo-700">
                        Genera una síntesis clínica para copiar en la ficha.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateCaseSummary}
                      disabled={isGeneratingCaseSummary}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
                    >
                      {isGeneratingCaseSummary ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Wand2 size={14} />
                      )}{' '}
                      Generar Resumen
                    </button>
                  </div>
                  {caseSummary && (
                    <div className="p-3 bg-white border rounded-lg text-xs font-mono text-gray-700 relative">
                      <button
                        onClick={() => copyToClipboard(caseSummary)}
                        className="absolute top-2 right-2 text-blue-600"
                      >
                        <Copy size={14} />
                      </button>
                      {caseSummary}
                    </div>
                  )}

                  <div className="bg-gray-50 p-4 rounded-xl border">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                      <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-gray-800 mb-1">
                          Tipo
                        </label>
                        <select
                          value={newBitacoraEntry.tipo}
                          onChange={(e) =>
                            setNewBitacoraEntry({
                              ...newBitacoraEntry,
                              tipo: e.target.value,
                            })
                          }
                          className="w-full border rounded p-2 text-sm bg-white"
                        >
                          <option value="Nota">📝 Nota</option>
                          <option value="Reunión">🤝 Reunión</option>
                          <option value="Tarea">🎯 Tarea</option>
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-gray-800 mb-1">
                          Descripción / Evolución
                        </label>
                        <textarea
                          rows={3}
                          value={newBitacoraEntry.descripcion}
                          onChange={(e) =>
                            setNewBitacoraEntry({
                              ...newBitacoraEntry,
                              descripcion: e.target.value,
                            })
                          }
                          className="w-full border rounded p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                          placeholder="Escribe aquí los detalles del acuerdo o la evolución clínica..."
                        />
                      </div>
                      {newBitacoraEntry.tipo === 'Tarea' && (
                        <>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-800 mb-1">
                              Responsable
                            </label>
                            <input
                              type="text"
                              value={newBitacoraEntry.responsable}
                              onChange={(e) =>
                                setNewBitacoraEntry({
                                  ...newBitacoraEntry,
                                  responsable: e.target.value,
                                })
                              }
                              className="w-full border rounded p-2 text-sm"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-800 mb-1">
                              Vencimiento
                            </label>
                            <input
                              type="date"
                              value={newBitacoraEntry.fechaCumplimiento}
                              onChange={(e) =>
                                setNewBitacoraEntry({
                                  ...newBitacoraEntry,
                                  fechaCumplimiento: e.target.value,
                                })
                              }
                              className="w-full border rounded p-2 text-sm"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleAddBitacora}
                        disabled={!newBitacoraEntry.descripcion}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                      >
                        Agregar Registro
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3">
                    {caseForm.bitacora.map((entry) => (
                      <div
                        key={entry.id}
                        className={`p-3 rounded-lg border ${
                          entry.tipo === 'Tarea'
                            ? entry.completada
                              ? 'bg-green-50 border-green-200'
                              : 'bg-yellow-50 border-yellow-200'
                            : 'bg-white border-gray-200'
                        } shadow-sm`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">
                            {entry.tipo === 'Tarea' ? (
                              <button
                                onClick={() => toggleTaskCompletion(entry.id)}
                              >
                                {entry.completada ? (
                                  <CheckSquare
                                    size={16}
                                    className="text-green-600"
                                  />
                                ) : (
                                  <Square
                                    size={16}
                                    className="text-yellow-600"
                                  />
                                )}
                              </button>
                            ) : entry.tipo === 'Reunión' ? (
                              <Users size={16} className="text-indigo-500" />
                            ) : (
                              <MessageSquare
                                size={16}
                                className="text-blue-500"
                              />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100">
                                {entry.tipo}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Calendar size={10} /> {entry.fecha}
                              </span>
                              {entry.tipo === 'Tarea' &&
                                entry.fechaCumplimiento && (
                                  <span
                                    className={`text-[10px] font-bold ${
                                      entry.completada
                                        ? 'text-gray-400'
                                        : getTaskStatus(entry.fechaCumplimiento)
                                            .textClass
                                    }`}
                                  >
                                    Vence: {entry.fechaCumplimiento}
                                  </span>
                                )}
                            </div>
                            <p
                              className={`text-sm text-gray-800 whitespace-pre-wrap ${
                                entry.completada
                                  ? 'line-through text-gray-500'
                                  : ''
                              }`}
                            >
                              {entry.descripcion}
                            </p>
                            {entry.responsable && (
                              <p className="text-xs text-gray-600 mt-1 font-medium">
                                Resp: {entry.responsable}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              setCaseForm({
                                ...caseForm,
                                bitacora: caseForm.bitacora.filter(
                                  (b) => b.id !== entry.id
                                ),
                              })
                            }
                            className="text-gray-300 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeModalTab === 'archivos' && (
                <div className="space-y-6 fade-in h-full flex flex-col">
                  <div className="bg-gray-50 border border-gray-200 border-dashed rounded-lg p-6 text-center">
                    <UploadCloud
                      size={32}
                      className="mx-auto text-blue-500 mb-2"
                    />
                    <h4 className="text-sm font-bold text-gray-800 mb-1">
                      Cargar Documento de Respaldo
                    </h4>
                    <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors inline-block mt-3">
                      Seleccionar Archivo
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, 'case')}
                        accept=".pdf,.doc,.docx,.jpg,.png"
                      />
                    </label>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <FileList files={caseForm.documentos} target="case" />
                  </div>
                </div>
              )}
            </div>
            <div className="bg-gray-50 p-4 border-t flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsCaseModalOpen(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
              >
                Cerrar
              </button>
              <button
                onClick={handleSaveCase}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
              >
                Guardar Todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PROTOCOLOS */}
      {isDocModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-bold flex items-center gap-2">
                <FileText size={18} />{' '}
                {editingDocId ? 'Editar Protocolo' : 'Iniciar Nuevo Protocolo'}
              </h3>
              <button
                onClick={() => setIsDocModalOpen(false)}
                className="text-white hover:text-blue-200 font-bold text-xl"
              >
                &times;
              </button>
            </div>
            <div className="flex border-b bg-gray-50 px-4 pt-2 shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveDocModalTab('datos')}
                className={`whitespace-nowrap px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                  activeDocModalTab === 'datos'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                1. Datos y Borrador
              </button>
              <button
                onClick={() => setActiveDocModalTab('bitacora')}
                className={`whitespace-nowrap px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                  activeDocModalTab === 'bitacora'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                2. Evolución y Tareas
              </button>
              <button
                onClick={() => setActiveDocModalTab('archivos')}
                className={`whitespace-nowrap px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                  activeDocModalTab === 'archivos'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                3. Archivos Adjuntos
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col">
              {activeDocModalTab === 'datos' && (
                <div className="space-y-4 fade-in flex-1 flex flex-col">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 shrink-0">
                    <h4 className="text-sm font-bold text-indigo-900 mb-1">
                      {editingDocId
                        ? 'Datos del Protocolo'
                        : 'Asistente de Redacción'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Nombre del Documento
                        </label>
                        <input
                          type="text"
                          value={newDocName}
                          onChange={(e) => setNewDocName(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Ámbito
                        </label>
                        <select
                          value={newDocAmbito}
                          onChange={(e) => setNewDocAmbito(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          {ambitosProtocolo.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Fase Actual
                        </label>
                        <select
                          value={newDocFase}
                          onChange={(e) => {
                            setNewDocFase(e.target.value);
                            const val = e.target.value;
                            if (val === 'Levantamiento') setNewDocAvance(10);
                            else if (val === 'Redacción') setNewDocAvance(30);
                            else if (val === 'Validación Técnica')
                              setNewDocAvance(60);
                            else if (val === 'Revisión Jurídica')
                              setNewDocAvance(80);
                            else if (
                              val === 'Resolución Exenta' ||
                              val === 'Difusión'
                            )
                              setNewDocAvance(100);
                          }}
                          className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          {fasesProtocolo.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Avance: {newDocAvance}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={newDocAvance}
                          onChange={(e) =>
                            setNewDocAvance(Number(e.target.value))
                          }
                          className="w-full mt-2 accent-indigo-600"
                        />
                      </div>
                    </div>
                    {!editingDocId && (
                      <button
                        onClick={handleGenerateDraft}
                        disabled={isGeneratingDraft}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-sm flex justify-center items-center gap-2"
                      >
                        {isGeneratingDraft ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : null}{' '}
                        ✨ Generar Borrador Base
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col flex-1 min-h-[200px]">
                    <div className="flex justify-between items-end mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Contenido
                      </label>
                      {draftContent && (
                        <button
                          onClick={() => copyToClipboard(draftContent)}
                          className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                        >
                          <Copy size={12} /> Copiar
                        </button>
                      )}
                    </div>
                    <textarea
                      className="w-full flex-1 border border-gray-300 rounded-lg p-3 text-sm resize-none font-mono outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                    ></textarea>
                  </div>
                </div>
              )}
              {activeDocModalTab === 'bitacora' && (
                <div className="space-y-6 fade-in h-full flex flex-col">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 shrink-0">
                    <h4 className="text-sm font-bold text-blue-900 mb-2">
                      Nuevo Registro
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                      <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-blue-800 mb-1">
                          Tipo
                        </label>
                        <select
                          value={newDocBitacoraEntry.tipo}
                          onChange={(e) =>
                            setNewDocBitacoraEntry({
                              ...newDocBitacoraEntry,
                              tipo: e.target.value,
                            })
                          }
                          className="w-full border border-blue-200 rounded p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Nota">📝 Nota</option>
                          <option value="Reunión">🤝 Reunión</option>
                          <option value="Tarea">🎯 Tarea</option>
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-blue-800 mb-1">
                          Descripción / Avance
                        </label>
                        <textarea
                          rows={3}
                          value={newDocBitacoraEntry.descripcion}
                          onChange={(e) =>
                            setNewDocBitacoraEntry({
                              ...newDocBitacoraEntry,
                              descripcion: e.target.value,
                            })
                          }
                          className="w-full border border-blue-200 rounded p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                          placeholder="Detalla los avances o acuerdos tomados..."
                        />
                      </div>
                      {newDocBitacoraEntry.tipo === 'Tarea' && (
                        <>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-blue-800 mb-1">
                              Responsable
                            </label>
                            <input
                              type="text"
                              value={newDocBitacoraEntry.responsable}
                              onChange={(e) =>
                                setNewDocBitacoraEntry({
                                  ...newDocBitacoraEntry,
                                  responsable: e.target.value,
                                })
                              }
                              className="w-full border border-blue-200 rounded p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-blue-800 mb-1">
                              Vencimiento
                            </label>
                            <input
                              type="date"
                              value={newDocBitacoraEntry.fechaCumplimiento}
                              onChange={(e) =>
                                setNewDocBitacoraEntry({
                                  ...newDocBitacoraEntry,
                                  fechaCumplimiento: e.target.value,
                                })
                              }
                              className="w-full border border-blue-200 rounded p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleAddDocBitacora}
                        disabled={!newDocBitacoraEntry.descripcion}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3">
                    <h4 className="text-sm font-bold text-gray-800 border-b pb-2 sticky top-0 bg-white z-10">
                      Historial
                    </h4>
                    {docBitacora.map((entry) => (
                      <div
                        key={entry.id}
                        className={`p-3 rounded-lg border ${
                          entry.tipo === 'Tarea'
                            ? entry.completada
                              ? 'bg-green-50 border-green-200'
                              : 'bg-yellow-50 border-yellow-200'
                            : 'bg-white border-gray-200'
                        } shadow-sm`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">
                            {entry.tipo === 'Tarea' ? (
                              <button
                                onClick={() =>
                                  toggleDocTaskCompletion(entry.id)
                                }
                              >
                                {entry.completada ? (
                                  <CheckSquare
                                    size={16}
                                    className="text-green-600"
                                  />
                                ) : (
                                  <Square
                                    size={16}
                                    className="text-yellow-600"
                                  />
                                )}
                              </button>
                            ) : entry.tipo === 'Reunión' ? (
                              <Users size={16} className="text-indigo-500" />
                            ) : (
                              <MessageSquare
                                size={16}
                                className="text-blue-500"
                              />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100">
                                {entry.tipo}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Calendar size={10} /> {entry.fecha}
                              </span>
                              {entry.tipo === 'Tarea' &&
                                entry.fechaCumplimiento && (
                                  <span
                                    className={`text-[10px] font-bold ${
                                      entry.completada
                                        ? 'text-gray-400'
                                        : getTaskStatus(entry.fechaCumplimiento)
                                            .textClass
                                    }`}
                                  >
                                    Vence: {entry.fechaCumplimiento}
                                  </span>
                                )}
                            </div>
                            <p
                              className={`text-sm text-gray-800 whitespace-pre-wrap ${
                                entry.completada
                                  ? 'line-through text-gray-500'
                                  : ''
                              }`}
                            >
                              {entry.descripcion}
                            </p>
                            {entry.responsable && (
                              <p className="text-xs text-gray-600 mt-1 font-medium">
                                Resp: {entry.responsable}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              setDocBitacora(
                                docBitacora.filter((b) => b.id !== entry.id)
                              )
                            }
                            className="text-gray-300 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeDocModalTab === 'archivos' && (
                <div className="space-y-6 fade-in h-full flex flex-col">
                  <div className="bg-gray-50 border border-gray-200 border-dashed rounded-lg p-6 text-center">
                    <UploadCloud
                      size={32}
                      className="mx-auto text-blue-500 mb-2"
                    />
                    <h4 className="text-sm font-bold text-gray-800 mb-1">
                      Cargar Documento de Protocolo
                    </h4>
                    <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors inline-block mt-3">
                      Seleccionar Archivo
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, 'doc')}
                        accept=".pdf,.doc,.docx,.jpg,.png"
                      />
                    </label>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <FileList files={docArchivos} target="doc" />
                  </div>
                </div>
              )}
            </div>
            <div className="bg-gray-50 p-4 border-t flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsDocModalOpen(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProtocol}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition"
              >
                {editingDocId ? 'Actualizar Protocolo' : 'Guardar Documento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR PAUTAS DE AUDITORÍA CON RANGOS MANUALES E IA */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gray-800 p-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-bold flex items-center gap-2">
                <Settings size={18} /> Gestor de Pautas (Auditorías /
                Consultorías)
              </h3>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-white hover:text-gray-300 font-bold text-xl"
              >
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Digitalizador con IA REAL (Extracción Literal) */}
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col text-center">
                  <h4 className="text-sm font-bold text-indigo-900 mb-2 flex items-center justify-center gap-2">
                    <Wand2 size={16} /> ✨ Digitalizar Pauta con IA
                  </h4>
                  <p className="text-xs text-indigo-700 mb-4 flex-1">
                    Sube tu documento PDF o Word. La IA extraerá{' '}
                    <b>textual y literalmente</b> los criterios a evaluar sin
                    reinterpretarlos, generando tu checklist automáticamente.
                  </p>

                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-indigo-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-indigo-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="w-8 h-8 text-indigo-500 mb-2" />
                      <p className="text-sm text-indigo-800 font-semibold">
                        Haz clic para subir documento
                      </p>
                      <p className="text-xs text-indigo-500">PDF o DOCX</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={handlePdfUploadForAI}
                    />
                  </label>
                  {isDigitizing && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-indigo-600 font-bold">
                      <Loader2 size={16} className="animate-spin" /> Extrayendo
                      texto...
                    </div>
                  )}
                </div>

                {/* Formulario Manual y Rangos */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col">
                  <h4 className="text-sm font-bold text-gray-800 mb-3">
                    Configuración de la Pauta
                  </h4>
                  <div className="space-y-3 flex-1 flex flex-col">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Nombre de la Pauta
                      </label>
                      <input
                        type="text"
                        value={templateForm.nombre}
                        onChange={(e) =>
                          setTemplateForm({
                            ...templateForm,
                            nombre: e.target.value,
                          })
                        }
                        className="w-full border rounded p-2 text-sm outline-none focus:ring-2 focus:ring-gray-800"
                        placeholder="Ej: Consultoría Riesgo Suicida"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Clasificación de Uso
                      </label>
                      <select
                        value={templateForm.tipo}
                        onChange={(e) =>
                          setTemplateForm({
                            ...templateForm,
                            tipo: e.target.value,
                          })
                        }
                        className="w-full border rounded p-2 text-sm outline-none focus:ring-2 focus:ring-gray-800 bg-white"
                      >
                        <option value="Ambos">
                          Para Auditorías y Consultorías
                        </option>
                        <option value="Auditoría">
                          Solo para Auditorías Normativas
                        </option>
                        <option value="Consultoría">
                          Solo para Consultorías Clínicas
                        </option>
                      </select>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Criterios a Evaluar (Checklist)
                      </label>
                      {templateForm.criterios.map((c, i) => (
                        <div key={i} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={c}
                            onChange={(e) => {
                              const newC = [...templateForm.criterios];
                              newC[i] = e.target.value;
                              setTemplateForm({
                                ...templateForm,
                                criterios: newC,
                              });
                            }}
                            className="flex-1 border rounded p-2 text-xs outline-none focus:ring-2 focus:ring-gray-800"
                            placeholder={`Criterio ${i + 1}...`}
                          />
                          <button
                            onClick={() => {
                              const newC = [...templateForm.criterios];
                              newC.splice(i, 1);
                              setTemplateForm({
                                ...templateForm,
                                criterios: newC,
                              });
                            }}
                            className="p-1.5 bg-red-50 text-red-500 rounded hover:bg-red-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          setTemplateForm({
                            ...templateForm,
                            criterios: [...templateForm.criterios, ''],
                          })
                        }
                        className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-2 hover:underline"
                      >
                        <Plus size={12} /> Agregar Criterio Manual
                      </button>
                    </div>

                    <div className="border-t pt-3 mt-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-2">
                        Resultados según Puntaje (Opcional)
                      </label>
                      {templateForm.rangos.map((r, i) => (
                        <div key={i} className="flex gap-2 mb-2 items-center">
                          <input
                            type="number"
                            placeholder="Min"
                            value={r.min}
                            onChange={(e) => {
                              const newR = [...templateForm.rangos];
                              newR[i].min = e.target.value;
                              setTemplateForm({
                                ...templateForm,
                                rangos: newR,
                              });
                            }}
                            className="w-16 border rounded p-2 text-xs outline-none focus:ring-1 focus:ring-gray-800"
                          />
                          <span className="text-xs text-gray-500">-</span>
                          <input
                            type="number"
                            placeholder="Max"
                            value={r.max}
                            onChange={(e) => {
                              const newR = [...templateForm.rangos];
                              newR[i].max = e.target.value;
                              setTemplateForm({
                                ...templateForm,
                                rangos: newR,
                              });
                            }}
                            className="w-16 border rounded p-2 text-xs outline-none focus:ring-1 focus:ring-gray-800"
                          />
                          <input
                            type="text"
                            placeholder="Ej: Riesgo Alto"
                            value={r.resultado}
                            onChange={(e) => {
                              const newR = [...templateForm.rangos];
                              newR[i].resultado = e.target.value;
                              setTemplateForm({
                                ...templateForm,
                                rangos: newR,
                              });
                            }}
                            className="flex-1 border rounded p-2 text-xs outline-none focus:ring-1 focus:ring-gray-800"
                          />
                          <button
                            onClick={() => {
                              const newR = [...templateForm.rangos];
                              newR.splice(i, 1);
                              setTemplateForm({
                                ...templateForm,
                                rangos: newR,
                              });
                            }}
                            className="p-1.5 bg-red-50 text-red-500 rounded hover:bg-red-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          setTemplateForm({
                            ...templateForm,
                            rangos: [
                              ...templateForm.rangos,
                              { min: '', max: '', resultado: '' },
                            ],
                          })
                        }
                        className="text-xs text-indigo-600 font-bold flex items-center gap-1 mt-1 hover:underline"
                      >
                        <Plus size={12} /> Agregar Rango de Resultado
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end pt-3 mt-auto">
                    <button
                      onClick={handleSaveTemplate}
                      className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-bold hover:bg-gray-900 w-full transition-colors"
                    >
                      Guardar Pauta
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-2 border-b pb-2">
                  Pautas Disponibles en Sistema
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {auditTemplates.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 border rounded-lg flex flex-col gap-2 bg-white shadow-sm"
                    >
                      <div className="flex justify-between">
                        <p className="font-bold text-sm text-gray-800">
                          {t.nombre}
                        </p>
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {t.criterios.length} items
                        </span>
                      </div>
                      {t.rangos && t.rangos.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.rangos.map((r, idx) => (
                            <span
                              key={idx}
                              className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded"
                            >
                              {r.min} a {r.max} pts: {r.resultado}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {auditTemplates.length === 0 && (
                    <p className="text-sm text-gray-500 col-span-2">
                      No hay pautas configuradas.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REALIZAR AUDITORIA / CONSULTORÍA CON SÍ/NO Y PUNTAJES EXACTOS */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-blue-600 p-4 text-white font-bold flex justify-between shrink-0">
              Nuevo Registro de Evaluación{' '}
              <button onClick={() => setIsAuditModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">
                    Tipo de Actividad
                  </label>
                  <select
                    disabled
                    value={auditForm.tipo}
                    className="w-full p-2 border rounded bg-gray-100 text-gray-600 font-bold"
                  >
                    <option>{auditForm.tipo}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">
                    Centro / Dispositivo Evaluado
                  </label>
                  <select
                    value={auditForm.centro}
                    onChange={(e) =>
                      setAuditForm({ ...auditForm, centro: e.target.value })
                    }
                    className="w-full p-2 border rounded bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {centros.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">
                  Pauta a Aplicar
                </label>
                <select
                  value={auditForm.templateId}
                  onChange={(e) =>
                    setAuditForm({
                      ...auditForm,
                      templateId: e.target.value,
                      answers: {},
                    })
                  }
                  className="w-full p-2 border rounded bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {auditTemplates
                    .filter(
                      (t) => t.tipo === 'Ambos' || t.tipo === auditForm.tipo
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-bold text-gray-800 bg-gray-100 p-3 rounded flex justify-between items-center">
                  Checklist de Evaluación
                  <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                    Puntaje:{' '}
                    {
                      Object.values(auditForm.answers).filter((a) => a === 'si')
                        .length
                    }{' '}
                    /{' '}
                    {auditTemplates.find((t) => t.id === auditForm.templateId)
                      ?.criterios.length || 0}{' '}
                    pts
                  </span>
                </p>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {auditTemplates
                    .find((t) => t.id === auditForm.templateId)
                    ?.criterios.map((criterio, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-gray-50 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                      >
                        <span className="text-gray-800 font-medium text-sm flex-1">
                          {criterio}
                        </span>
                        <div className="flex gap-2 shrink-0">
                          <label
                            className={`flex items-center gap-1 px-3 py-1.5 rounded cursor-pointer transition-colors font-bold text-sm ${
                              auditForm.answers[idx] === 'si'
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`crit-${idx}`}
                              value="si"
                              checked={auditForm.answers[idx] === 'si'}
                              onChange={() =>
                                setAuditForm({
                                  ...auditForm,
                                  answers: {
                                    ...auditForm.answers,
                                    [idx]: 'si',
                                  },
                                })
                              }
                              className="hidden"
                            />
                            Sí
                          </label>
                          <label
                            className={`flex items-center gap-1 px-3 py-1.5 rounded cursor-pointer transition-colors font-bold text-sm ${
                              auditForm.answers[idx] === 'no'
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`crit-${idx}`}
                              value="no"
                              checked={auditForm.answers[idx] === 'no'}
                              onChange={() =>
                                setAuditForm({
                                  ...auditForm,
                                  answers: {
                                    ...auditForm.answers,
                                    [idx]: 'no',
                                  },
                                })
                              }
                              className="hidden"
                            />
                            No
                          </label>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-4 border-t flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAudit}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
              >
                Finalizar Evaluación
              </button>
            </div>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `.fade-in { animation: fadeIn 0.3s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }`,
        }}
      />
    </div>
  );
}
