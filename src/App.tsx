/**
 * @license
 * SPDX-License-Identifier: Apache-2.0

 */

import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Calendar as CalendarIcon, 
  ChevronRight, 
  Plus, 
  Clock, 
  ArrowLeft,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  X,
  Settings,
  Trash2,
  Pencil,
  User,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addMinutes, parse, isBefore, isAfter, isValid } from 'date-fns';
import { it } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import itLocale from '@fullcalendar/core/locales/it';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Azienda {
  id: string;
  nome: string;
  logo: string;
  indirizzo: string;
  prossimaConvocazione?: string;
}

interface Slot {
  aziendaId: string;
  data: string;
  inizio: string;
  fine: string;
  durata: string;
  stato: string;
  dipendenteEmail?: string;
  dipendenteNome?: string;
}

interface Dipendente {
  id: string;
  aziendaId: string;
  nome: string;
  email: string;
  sesso: string;
}

const normalizeSlot = (s: any): Slot => {
  if (!s) return { aziendaId: '', data: '', inizio: '', fine: '', durata: '', stato: '', dipendenteEmail: '', dipendenteNome: '' };
  
  const get = (keys: string[]) => {
    for (const k of keys) {
      if (s[k] !== undefined && s[k] !== null) return s[k];
      const lowerK = k.toLowerCase().trim();
      const foundKey = Object.keys(s).find(key => key.toLowerCase().trim() === lowerK);
      if (foundKey && s[foundKey] !== undefined && s[foundKey] !== null) return s[foundKey];
    }
    return '';
  };

  let rawData = String(get(['Data', 'data']) || '');
  if (rawData.includes('T')) {
    rawData = rawData.split('T')[0];
  }

  const rawStato = String(get(['Stato', 'stato']) || '').trim();
  const stato = rawStato.toLowerCase() === 'occupato' ? 'Occupato' : 
                rawStato.toLowerCase() === 'libero' ? 'Libero' : rawStato;

  return {
    aziendaId: String(get(['Id-Azienda', 'aziendaId', 'IdAzienda']) || ''),
    data: rawData,
    inizio: String(get(['Inizio', 'inizio']) || ''),
    fine: String(get(['Fine', 'fine']) || ''),
    durata: String(get(['Durata', 'durata']) || ''),
    stato: stato,
    dipendenteEmail: String(get(['Mail Lavoratore', 'mail lavoratore', 'dipendenteEmail', 'email', 'Mail']) || '').trim(),
    dipendenteNome: String(get(['Nome', 'nome', 'dipendenteNome', 'Nome Lavoratore', 'Nominativo', 'nominativo']) || '').trim()
  };
};

const normalizeAzienda = (a: any): Azienda => {
  if (!a) return { id: '', nome: '', logo: '', indirizzo: '' };
  const getVal = (obj: any, key: string) => {
    const target = key.toLowerCase().trim();
    const actualKey = Object.keys(obj).find(k => k.toLowerCase().trim() === target);
    return actualKey ? obj[actualKey] : undefined;
  };
  return {
    id: String(getVal(a, 'ID') || getVal(a, 'id') || ''),
    nome: String(getVal(a, 'Nome') || getVal(a, 'nome') || ''),
    logo: String(getVal(a, 'Logo') || getVal(a, 'logo') || ''),
    indirizzo: String(getVal(a, 'Indirizzo') || getVal(a, 'indirizzo') || ''),
    prossimaConvocazione: String(getVal(a, 'ProssimaConvocazione') || getVal(a, 'prossimaconvocazione') || '')
  };
};

const normalizeDipendente = (d: any): Dipendente => {
  if (!d) return { id: '', aziendaId: '', nome: '', email: '', sesso: '' };
  const getVal = (obj: any, key: string) => {
    const target = key.toLowerCase().trim();
    const actualKey = Object.keys(obj).find(k => k.toLowerCase().trim() === target);
    return actualKey ? obj[actualKey] : undefined;
  };
  return {
    id: String(getVal(d, 'ID') || getVal(d, 'id') || ''),
    aziendaId: String(d.aziendaId || ''),
    nome: String(getVal(d, 'Nome') || getVal(d, 'nome') || '').trim(),
    email: String(getVal(d, 'Mail') || getVal(d, 'mail') || getVal(d, 'Email') || getVal(d, 'email') || '').toLowerCase().trim(),
    sesso: String(getVal(d, 'Sesso') || getVal(d, 'sesso') || '')
  };
};

// Components
const Navbar = () => (
  <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between h-16 items-center">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">MedWork Manager</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Dashboard</Link>
        </div>
      </div>
    </div>
  </nav>
);

const GAS_URL = import.meta.env.VITE_GAS_URL;

const fetchGAS = async (params: any, body?: any) => {
  if (!GAS_URL) {
    console.error('VITE_GAS_URL is not defined in environment variables');
    throw new Error('Configurazione mancante: VITE_GAS_URL non trovata.');
  }
  
  try {
    const url = new URL(GAS_URL);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    const options: RequestInit = {
      method: body ? 'POST' : 'GET',
      mode: 'cors',
      redirect: 'follow',
    };
    
    if (body) {
      // Using URLSearchParams for POST body is often more reliable with GAS
      // as it populates e.parameter in the doPost(e) function.
      const formData = new URLSearchParams();
      Object.keys(body).forEach(key => {
        const value = body[key];
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      });
      options.body = formData;
      // Content-Type is automatically set to application/x-www-form-urlencoded
    }
    
    const res = await fetch(url.toString(), options);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Error in fetchGAS:', err);
    throw err;
  }
};

const Dashboard = () => {
  const [aziende, setAziende] = useState<Azienda[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'aziende' | 'calendario'>('aziende');
  const [allSlots, setAllSlots] = useState<any[]>([]);
  const [dipendentiCache, setDipendentiCache] = useState<Record<string, Dipendente[]>>({});
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [isSlotDetailOpen, setIsSlotDetailOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [dipendentiAzienda, setDipendentiAzienda] = useState<Dipendente[]>([]);
  const [isDipendentiLoading, setIsDipendentiLoading] = useState(false);
  const [isSlotActionLoading, setIsSlotActionLoading] = useState(false);
  const [newCompany, setNewCompany] = useState({
    nome: '',
    logo: '',
    indirizzo: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAziende = () => {
    setLoading(true);
    fetchGAS({ action: 'getAziende' })
      .then(data => {
        if (Array.isArray(data)) {
          setAziende(data.map(normalizeAzienda));
        } else {
          console.error('API returned non-array data:', data);
          setAziende([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const fetchAllSlots = async () => {
    try {
      const data = await fetchGAS({ action: 'getAllSlots' });
      if (Array.isArray(data)) {
        setAllSlots(data.map(normalizeSlot));
      }
    } catch (err) {
      console.error('Error fetching all slots:', err);
    }
  };

  useEffect(() => {
    fetchAziende();
    fetchAllSlots();
  }, []);

  useEffect(() => {
    if (aziende.length > 0) {
      aziende.forEach(az => {
        if (az.id && !dipendentiCache[az.id]) {
          fetchDipendentiAzienda(az.id);
        }
      });
    }
  }, [aziende]);

  const fetchDipendentiAzienda = async (aziendaId: string) => {
    if (!aziendaId) {
      console.warn('fetchDipendentiAzienda called without aziendaId');
      return;
    }

    // Check cache first
    if (dipendentiCache[aziendaId]) {
      setDipendentiAzienda(dipendentiCache[aziendaId]);
      return;
    }

    setIsDipendentiLoading(true);
    try {
      const data = await fetchGAS({ action: 'getDipendenti', aziendaId });
      if (Array.isArray(data)) {
        const normalized = data.map(normalizeDipendente);
        setDipendentiAzienda(normalized);
        // Save to cache
        setDipendentiCache(prev => ({ ...prev, [aziendaId]: normalized }));
      } else {
        setDipendentiAzienda([]);
      }
    } catch (err) {
      console.error('Error fetching dipendenti for azienda:', err);
      setDipendentiAzienda([]);
    } finally {
      setIsDipendentiLoading(false);
    }
  };

  const handleUpdateSlotStatus = async (newStatus: string, dipendenteId?: string) => {
    if (!selectedSlot) return;
    setIsSlotActionLoading(true);
    
    let dipendenteEmail = '';
    let dipendenteNome = '';
    if (dipendenteId) {
      const emp = dipendentiAzienda.find(d => d.id === dipendenteId);
      if (emp) {
        dipendenteEmail = emp.email;
        dipendenteNome = emp.nome;
      }
    }

    try {
      // Pulizia drastica della data: prendiamo solo i primi 10 caratteri (YYYY-MM-DD)
      // Questo evita che "2026-04-14" diventi "2026-04-13T22:00..."
      const slotDate = selectedSlot.data.substring(0, 10);
      
      const data = await fetchGAS({ action: 'updateSlot' }, {
        action: 'updateSlot',
        aziendaId: selectedSlot.aziendaId,
        data: slotDate,
        inizio: selectedSlot.inizio,
        stato: newStatus,
        dipendenteEmail: dipendenteEmail,
        dipendenteNome: dipendenteNome
      });
      if (data.success) {
        fetchAllSlots();
        setIsSlotDetailOpen(false);
        setIsEditingEmployee(false);
      } else {
        console.error('Update slot failed:', data.error);
        alert('Errore: ' + (data.error || 'Impossibile aggiornare lo slot'));
      }
    } catch (err) {
      console.error('Error updating slot:', err);
      alert('Errore di connessione durante l\'aggiornamento dello slot');
    } finally {
      setIsSlotActionLoading(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!selectedSlot || !window.confirm('Sei sicuro di voler eliminare definitivamente questo slot?')) return;
    setIsSlotActionLoading(true);
    try {
      const data = await fetchGAS({ action: 'deleteSlot' }, {
        action: 'deleteSlot',
        aziendaId: selectedSlot.aziendaId,
        data: selectedSlot.data,
        inizio: selectedSlot.inizio
      });
      if (data.success) {
        fetchAllSlots();
        setIsSlotDetailOpen(false);
      }
    } catch (err) {
      console.error('Error deleting slot:', err);
    } finally {
      setIsSlotActionLoading(false);
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = await fetchGAS({ action: 'addAzienda' }, {
        action: 'addAzienda',
        ...newCompany
      });
      if (data.success) {
        setIsModalOpen(false);
        setNewCompany({ nome: '', logo: '', indirizzo: '' });
        fetchAziende();
      } else {
        setError(data.error || 'Errore durante il salvataggio');
      }
    } catch (err) {
      console.error(err);
      setError('Errore di connessione al server');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!GAS_URL) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-8 bg-amber-50 border border-amber-200 rounded-3xl text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-amber-900 mb-2">Configurazione Mancante</h2>
        <p className="text-amber-700 mb-6">
          Non è stato configurato l'URL di Google Apps Script. 
          Assicurati di aver aggiunto la variabile d'ambiente <strong>VITE_GAS_URL</strong> su Vercel o nel file .env.
        </p>
        <div className="bg-white p-4 rounded-xl text-left text-sm font-mono text-gray-600 border border-amber-100">
          1. Vai su Vercel &gt; Settings &gt; Environment Variables<br/>
          2. Aggiungi VITE_GAS_URL con l'URL del tuo script<br/>
          3. Fai il Redeploy dell'app
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard MedWork</h1>
          <p className="text-gray-500 mt-2">Gestione dipendenti e disponibilità visite mediche.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-xl border border-gray-200 flex shadow-sm">
            <button 
              onClick={() => setActiveTab('aziende')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                activeTab === 'aziende' ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              Aziende
            </button>
            <button 
              onClick={() => setActiveTab('calendario')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                activeTab === 'calendario' ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              Calendario
            </button>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 w-fit"
          >
            <Plus className="w-5 h-5" />
            Nuova Azienda
          </button>
        </div>
      </header>

      {activeTab === 'aziende' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {aziende.map((azienda) => (
            <motion.div
              key={azienda.id}
              whileHover={{ y: -4 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden group"
            >
              <Link to={`/azienda/${azienda.id}`} className="block p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                    {azienda.logo ? (
                      <img src={azienda.logo} alt={azienda.nome} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                    ) : (
                      <Building2 className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{azienda.nome}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>{azienda.indirizzo || 'Indirizzo non specificato'}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            locale={itLocale}
            slotMinTime="07:00:00"
            slotMaxTime="20:00:00"
            allDaySlot={false}
            height="auto"
            events={allSlots.map(slot => {
              const azienda = aziende.find(a => a.id === slot.aziendaId);
              const dateObj = new Date(slot.data);
              
              if (!isValid(dateObj)) {
                console.warn('Invalid date found in slot:', slot);
                return null;
              }

              const dateISO = format(dateObj, 'yyyy-MM-dd');
              return {
                id: `${slot.aziendaId}-${slot.data}-${slot.inizio}`,
                title: azienda ? azienda.nome : 'Slot',
                start: `${dateISO}T${slot.inizio}`,
                end: `${dateISO}T${slot.fine}`,
                backgroundColor: slot.stato === 'Occupato' ? '#ef4444' : '#3b82f6',
                borderColor: 'transparent',
                extendedProps: { ...slot, aziendaNome: azienda ? azienda.nome : 'N/A' }
              };
            }).filter(Boolean)}
            eventClick={(info) => {
              const slot = info.event.extendedProps;
              setSelectedSlot(slot);
              setSelectedEmployeeId('');
              setIsEditingEmployee(false);
              fetchDipendentiAzienda(slot.aziendaId);
              setIsSlotDetailOpen(true);
            }}
            eventContent={(eventInfo) => {
              const slot = eventInfo.event.extendedProps as Slot;
              const isOccupied = slot.stato?.toLowerCase() === 'occupato';
              
              // Priorità al nome già presente nello slot
              let employeeName = slot.dipendenteNome || '';
              
              // Se occupato ma manca il nome, proviamo a cercarlo in cache tramite email
              if (isOccupied && !employeeName && slot.dipendenteEmail) {
                const searchEmail = slot.dipendenteEmail.toLowerCase().trim();
                for (const azId in dipendentiCache) {
                  const list = dipendentiCache[azId];
                  if (Array.isArray(list)) {
                    const emp = list.find(d => d.email.toLowerCase().trim() === searchEmail);
                    if (emp) {
                      employeeName = emp.nome;
                      break;
                    }
                  }
                }
                // Se ancora non lo troviamo, usiamo il prefisso dell'email
                if (!employeeName) employeeName = slot.dipendenteEmail.split('@')[0];
              }

              return (
                <div className="p-1 overflow-hidden flex flex-col h-full">
                  <div className="font-bold text-[10px] truncate leading-tight">
                    {isOccupied ? (employeeName || 'Occupato') : 'Libero'}
                  </div>
                  <div className="text-[9px] opacity-80 truncate leading-tight mt-0.5">
                    {slot.aziendaId} • {eventInfo.timeText}
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}

      {/* Modal Dettaglio Slot */}
      <AnimatePresence>
        {isSlotDetailOpen && selectedSlot && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSlotDetailOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Dettaglio Slot</h2>
                  <button onClick={() => setIsSlotDetailOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        selectedSlot.stato === 'Occupato' ? "bg-red-500" : "bg-green-500"
                      )} />
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stato Attuale</p>
                        <p className="font-bold text-gray-900">{selectedSlot.stato}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Azienda</p>
                      <p className="font-bold text-gray-900">{selectedSlot.aziendaNome}</p>
                    </div>
                  </div>

                  {selectedSlot.stato === 'Occupato' && (selectedSlot.dipendenteEmail || selectedSlot.dipendenteNome) && (
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Dettagli Lavoratore</p>
                        {!isEditingEmployee && (
                          <button 
                            onClick={() => {
                              setIsEditingEmployee(true);
                              // Trova l'ID del dipendente attuale se possibile
                              const currentEmp = dipendentiAzienda.find(d => 
                                d.email.toLowerCase().trim() === selectedSlot.dipendenteEmail?.toLowerCase().trim()
                              );
                              if (currentEmp) setSelectedEmployeeId(currentEmp.id);
                            }}
                            className="p-1 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                            title="Modifica lavoratore"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      {isEditingEmployee ? (
                        <div className="space-y-3">
                          <select 
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                            className="w-full p-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                          >
                            <option value="">Seleziona un altro dipendente...</option>
                            {dipendentiAzienda.map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.nome} ({emp.email})</option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateSlotStatus('Occupato', selectedEmployeeId)}
                              disabled={!selectedEmployeeId || isSlotActionLoading}
                              className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-all"
                            >
                              {isSlotActionLoading ? 'Salvataggio...' : 'Conferma Modifica'}
                            </button>
                            <button
                              onClick={() => setIsEditingEmployee(false)}
                              className="px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all"
                            >
                              Annulla
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-blue-900">
                              {(() => {
                                if (selectedSlot.dipendenteNome) return selectedSlot.dipendenteNome;
                                if (!selectedSlot.dipendenteEmail) return 'N/A';
                                const searchEmail = selectedSlot.dipendenteEmail.toLowerCase().trim();
                                for (const azId in dipendentiCache) {
                                  const emp = dipendentiCache[azId].find(d => 
                                    d.email.toLowerCase().trim() === searchEmail
                                  );
                                  if (emp) return emp.nome;
                                }
                                return selectedSlot.dipendenteEmail.split('@')[0];
                              })()}
                            </p>
                            <p className="text-xs text-blue-600 font-medium">{selectedSlot.dipendenteEmail || 'Email non disponibile'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Data</p>
                      <p className="font-bold text-gray-900">
                        {(() => {
                          const d = new Date(selectedSlot.data);
                          return isValid(d) ? format(d, 'dd/MM/yyyy') : 'Data non valida';
                        })()}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Stato</p>
                      <p className={cn(
                        "font-bold",
                        selectedSlot.stato === 'Occupato' ? "text-red-600" : "text-green-600"
                      )}>{selectedSlot.stato}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Orario</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <p className="font-bold text-gray-900">{selectedSlot.inizio} - {selectedSlot.fine}</p>
                      <span className="text-xs text-gray-400 font-medium">({selectedSlot.durata} min)</span>
                    </div>
                  </div>

                  {selectedSlot.stato === 'Libero' && (
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Assegna a Dipendente</label>
                        <select 
                          value={selectedEmployeeId}
                          onChange={(e) => setSelectedEmployeeId(e.target.value)}
                          disabled={isDipendentiLoading}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          {isDipendentiLoading ? (
                            <option>Caricamento dipendenti...</option>
                          ) : (
                            <>
                              <option value="">Seleziona dipendente...</option>
                              {dipendentiAzienda.map(d => (
                                <option key={d.id} value={d.id}>{d.nome}</option>
                              ))}
                              {dipendentiAzienda.length === 0 && (
                                <option disabled>Nessun dipendente trovato</option>
                              )}
                            </>
                          )}
                        </select>
                      </div>
                      
                      <button 
                        onClick={() => handleUpdateSlotStatus('Occupato', selectedEmployeeId)}
                        disabled={!selectedEmployeeId || isSlotActionLoading}
                        className={cn(
                          "w-full py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2",
                          !selectedEmployeeId || isSlotActionLoading ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"
                        )}
                      >
                        {isSlotActionLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : "Segna come Occupato"}
                      </button>
                    </div>
                  )}

                  {selectedSlot.stato === 'Occupato' && !isEditingEmployee && (
                    <button 
                      onClick={() => handleUpdateSlotStatus('Libero')}
                      disabled={isSlotActionLoading}
                      className="w-full py-3 bg-green-50 text-green-600 rounded-2xl font-bold hover:bg-green-100 transition-all flex items-center justify-center gap-2 mb-2"
                    >
                      {isSlotActionLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div> : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Rendi Libero
                        </>
                      )}
                    </button>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button 
                      onClick={handleDeleteSlot}
                      disabled={isSlotActionLoading}
                      className="flex-1 bg-red-50 text-red-600 py-4 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                    >
                      {isSlotActionLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div> : (
                        <>
                          <Trash2 className="w-5 h-5" />
                          Elimina Slot
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => setIsSlotDetailOpen(false)}
                      className="flex-1 bg-gray-100 text-gray-900 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Nuova Azienda */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Aggiungi Nuova Azienda</h2>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleAddCompany} className="space-y-5">
                  {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Nome Azienda</label>
                    <input 
                      required
                      placeholder="es. Rossi S.p.A."
                      value={newCompany.nome}
                      onChange={e => setNewCompany({...newCompany, nome: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">URL Logo (opzionale)</label>
                    <input 
                      placeholder="https://..."
                      value={newCompany.logo}
                      onChange={e => setNewCompany({...newCompany, logo: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Indirizzo (opzionale)</label>
                    <input 
                      placeholder="es. Via Roma 10, Milano"
                      value={newCompany.indirizzo}
                      onChange={e => setNewCompany({...newCompany, indirizzo: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all border border-gray-200"
                    >
                      Annulla
                    </button>
                    <button 
                      type="submit"
                      disabled={saving}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                    >
                      {saving ? 'Salvataggio...' : 'Salva Azienda'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CompanyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [azienda, setAzienda] = useState<Azienda | null>(null);
  const [dipendenti, setDipendenti] = useState<Dipendente[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State for New Employee
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [isEditEmpModalOpen, setIsEditEmpModalOpen] = useState(false);
  const [newEmp, setNewEmp] = useState({
    nome: '',
    email: '',
    sesso: ''
  });
  const [editingEmp, setEditingEmp] = useState<Dipendente | null>(null);
  const [empSaving, setEmpSaving] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isConvocationModalOpen, setIsConvocationModalOpen] = useState(false);
  const [editCompany, setEditCompany] = useState({
    nome: '',
    logo: '',
    indirizzo: '',
    prossimaConvocazione: ''
  });
  const [convocationData, setConvocationData] = useState({
    date: '',
    timeRange: ''
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Slot Generator State
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [originalDate, setOriginalDate] = useState('');
  const [inviting, setInviting] = useState(false);
  const [invitationSuccess, setInvitationSuccess] = useState<string | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  const fetchDipendenti = () => {
    fetchGAS({ action: 'getDipendenti', aziendaId: id })
      .then(data => {
        const normalized = Array.isArray(data) ? data.map(normalizeDipendente) : [];
        setDipendenti(normalized);
        // Pre-seleziona tutti i dipendenti per default
        setSelectedEmails(normalized.map(d => d.email));
      })
      .catch(err => console.error(err));
  };

  const fetchSlots = () => {
    fetchGAS({ action: 'getSlots', aziendaId: id })
      .then(data => {
        setSlots(Array.isArray(data) ? data.map(normalizeSlot) : []);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchGAS({ action: 'getAziende' }),
      fetchGAS({ action: 'getDipendenti', aziendaId: id }),
      fetchGAS({ action: 'getSlots', aziendaId: id })
    ]).then(([aziende, dipendentiData, slotsData]) => {
      const aziendeList = Array.isArray(aziende) ? aziende.map(normalizeAzienda) : [];
      
      // Robust search: check ID and Name, case-insensitive and trimmed
      const searchId = (id || '').trim().toLowerCase();
      const found = aziendeList.find((a: Azienda) => {
        const aId = (a.id || '').trim().toLowerCase();
        const aNome = (a.nome || '').trim().toLowerCase();
        return aId === searchId || aNome === searchId;
      });
      
      setAzienda(found || null);
      if (found) {
        setEditCompany({
          nome: found.nome,
          logo: found.logo,
          indirizzo: found.indirizzo,
          prossimaConvocazione: found.prossimaConvocazione || ''
        });
      }
      const normalizedDipendenti = Array.isArray(dipendentiData) ? dipendentiData.map(normalizeDipendente) : [];
      setDipendenti(normalizedDipendenti);
      setSelectedEmails(normalizedDipendenti.map(d => d.email));
      setSlots(Array.isArray(slotsData) ? slotsData.map(normalizeSlot) : []);
      setLoading(false);
    }).catch(err => {
      console.error('Error in CompanyDetail:', err);
      setLoading(false);
    });
  }, [id]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpSaving(true);
    setEmpError(null);
    try {
      const dipendenteId = "EMP-" + Math.floor(Date.now() / 1000).toString().slice(-6);
      const data = await fetchGAS({ action: 'addDipendente' }, {
        action: 'addDipendente',
        id: dipendenteId,
        nome: newEmp.nome,
        email: newEmp.email,
        sesso: newEmp.sesso,
        aziendaId: id
      });
      if (data.success) {
        setIsEmpModalOpen(false);
        setNewEmp({ nome: '', email: '', sesso: '' });
        fetchDipendenti();
      } else {
        setEmpError(data.error || 'Errore durante il salvataggio');
      }
    } catch (err) {
      console.error(err);
      setEmpError('Errore di connessione al server');
    } finally {
      setEmpSaving(false);
    }
  };

  const handleUpdateDipendente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    setEmpSaving(true);
    setEmpError(null);
    try {
      const data = await fetchGAS({ action: 'updateDipendente' }, {
        action: 'updateDipendente',
        aziendaId: id,
        dipendenteId: editingEmp.id,
        nome: newEmp.nome,
        email: newEmp.email,
        sesso: newEmp.sesso
      });
      if (data.success) {
        setIsEditEmpModalOpen(false);
        setEditingEmp(null);
        setNewEmp({ nome: '', email: '', sesso: '' });
        fetchDipendenti();
      } else {
        setEmpError(data.error || 'Errore durante l\'aggiornamento');
      }
    } catch (err) {
      console.error(err);
      setEmpError('Errore di connessione');
    } finally {
      setEmpSaving(false);
    }
  };

  const handleDeleteDipendente = async (dipendenteId: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo dipendente?')) return;
    try {
      const data = await fetchGAS({ action: 'deleteDipendente' }, {
        action: 'deleteDipendente',
        aziendaId: id,
        dipendenteId
      });
      if (data.success) {
        fetchDipendenti();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateConvocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    const prossimaConvocazione = `${convocationData.date} | ${convocationData.timeRange}`;
    try {
      const data = await fetchGAS({ action: 'updateAzienda' }, {
        action: 'updateAzienda',
        id,
        ...editCompany,
        prossimaConvocazione
      });
      if (data.success) {
        setAzienda({ ...azienda!, prossimaConvocazione });
        setIsConvocationModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDeleteConvocation = async (targetDate: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa convocazione? Tutti gli slot di questo giorno verranno rimossi.')) return;
    setSaving(true);
    try {
      const data = await fetchGAS({ action: 'addDisponibilita' }, {
        action: 'addDisponibilita',
        aziendaId: id,
        date: targetDate,
        slots: [] // Empty array means delete for this date
      });
      if (data.success) {
        fetchSlots();
        setIsConvocationModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const data = await fetchGAS({ action: 'updateAzienda' }, {
        action: 'updateAzienda',
        id,
        nome: editCompany.nome,
        logo: editCompany.logo,
        indirizzo: editCompany.indirizzo,
        prossimaConvocazione: editCompany.prossimaConvocazione
      });
      if (data.success) {
        setAzienda({ ...azienda!, ...editCompany });
        setIsSettingsModalOpen(false);
        // Refresh aziende list to update dashboard
        fetchGAS({ action: 'getAziende' }).then(aziende => {
          const aziendeList = Array.isArray(aziende) ? aziende.map(normalizeAzienda) : [];
          const found = aziendeList.find((a: Azienda) => a.id === id);
          if (found) setAzienda(found);
        });
      } else {
        setSettingsError(data.error || 'Errore durante l\'aggiornamento');
      }
    } catch (err) {
      console.error(err);
      setSettingsError('Errore di connessione');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!window.confirm('Sei sicuro di voler eliminare questa azienda e tutti i suoi dipendenti? L\'operazione è irreversibile.')) return;
    
    setSettingsSaving(true);
    try {
      const data = await fetchGAS({ action: 'deleteAzienda' }, {
        action: 'deleteAzienda',
        id
      });
      if (data.success) {
        navigate('/');
      } else {
        setSettingsError(data.error || 'Errore durante l\'eliminazione');
      }
    } catch (err) {
      console.error(err);
      setSettingsError('Errore di connessione');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleGenerateSlots = async () => {
    if (!azienda) return;
    setSaving(true);
    
    const slots = [];
    let current = parse(startTime, 'HH:mm', new Date());
    const end = parse(endTime, 'HH:mm', new Date());

    while (isBefore(current, end)) {
      const slotEnd = addMinutes(current, duration);
      if (isAfter(slotEnd, end)) break;

      // Assicuriamoci che 'date' sia una stringa YYYY-MM-DD pulita
      const cleanDate = typeof date === 'string' ? date.split('T')[0] : format(date, 'yyyy-MM-dd');

      slots.push([
        azienda.id, // This is the ID (Name or Name01)
        cleanDate,
        format(current, 'HH:mm'),
        format(slotEnd, 'HH:mm'),
        duration.toString(),
        'Libero'
      ]);
      current = slotEnd;
    }

    try {
      const data = await fetchGAS({ action: 'addSlots' }, {
        action: 'addSlots',
        slots: slots
      });
      if (data.success) {
        setSuccess(true);
        setOriginalDate(date);
        fetchSlots();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvitations = async () => {
    if (selectedEmails.length === 0) {
      alert("Seleziona almeno un dipendente da invitare.");
      return;
    }
    if (!window.confirm(`Sei sicuro di voler inviare gli inviti a ${selectedEmails.length} dipendenti selezionati?`)) return;
    setInviting(true);
    setInvitationSuccess(null);
    try {
      const res = await fetchGAS({ 
        action: 'sendInvitations', 
        aziendaId: id,
        emailsToInvite: JSON.stringify(selectedEmails)
      });
      if (res.success) {
        setInvitationSuccess(`Inviti inviati con successo a ${res.sent} dipendenti!`);
        setTimeout(() => setInvitationSuccess(null), 5000);
      } else {
        alert("Errore durante l'invio: " + res.error);
      }
    } catch (err) {
      console.error(err);
      alert("Errore di connessione");
    } finally {
      setInviting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (!GAS_URL) return <div className="text-center py-20 text-amber-600 font-medium">Configurazione mancante: VITE_GAS_URL non impostata.</div>;
  if (!azienda) return <div className="text-center py-20">Azienda non trovata.</div>;

  // Calculate next convocation from slots
  const nextConvocation = slots.length > 0 ? (() => {
    const sortedSlots = [...slots].sort((a, b) => {
      const dateA = new Date(a.data.includes('T') ? a.data : `${a.data}T${a.inizio}`);
      const dateB = new Date(b.data.includes('T') ? b.data : `${b.data}T${b.inizio}`);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Group slots by date
    const firstSlot = sortedSlots[0];
    const firstDateObj = new Date(firstSlot.data);
    
    if (!isValid(firstDateObj)) return null;

    const firstDateISO = format(firstDateObj, 'yyyy-MM-dd');
    
    const sameDateSlots = sortedSlots.filter(s => {
      const sDateObj = new Date(s.data);
      return isValid(sDateObj) && format(sDateObj, 'yyyy-MM-dd') === firstDateISO;
    });
    
    if (sameDateSlots.length === 0) return null;

    const startTime = sameDateSlots[0].inizio;
    const endTime = sameDateSlots[sameDateSlots.length - 1].fine;
    const duration = sameDateSlots[0].durata;
    
    return {
      date: format(firstDateObj, 'dd/MM/yyyy'),
      rawDate: firstDateISO,
      start: startTime,
      end: endTime,
      duration: duration
    };
  })() : null;

  return (
    <div className="space-y-8 pb-20">
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Torna alla Dashboard
      </button>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
            {azienda.logo ? (
              <img src={azienda.logo} alt={azienda.nome} className="w-full h-full object-contain p-3" referrerPolicy="no-referrer" />
            ) : (
              <Building2 className="w-12 h-12 text-gray-400" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{azienda.nome}</h1>
            <p className="text-gray-500">{azienda.indirizzo || 'Indirizzo non specificato'}</p>
            {nextConvocation && (
              <div className="mt-3 inline-flex items-center gap-3 bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl">
                <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
                  <CalendarIcon className="w-4 h-4" />
                  <span>Prossima convocazione il giorno <strong>{nextConvocation.date}</strong> dalle ore <strong>{nextConvocation.start}</strong> alle ore <strong>{nextConvocation.end}</strong></span>
                </div>
                <div className="flex gap-2 border-l border-amber-200 pl-3">
                  <button 
                    onClick={() => {
                      if (nextConvocation) {
                        setDate(nextConvocation.rawDate);
                        setOriginalDate(nextConvocation.rawDate);
                        setStartTime(nextConvocation.start);
                        setEndTime(nextConvocation.end);
                        setDuration(parseInt(nextConvocation.duration) || 30);
                        setIsConvocationModalOpen(true);
                      }
                    }}
                    className="text-amber-600 hover:text-amber-700 text-xs font-bold uppercase tracking-wider"
                  >
                    Modifica
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          {invitationSuccess && (
            <div className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 animate-pulse">
              <CheckCircle2 className="w-4 h-4" />
              {invitationSuccess}
            </div>
          )}
          <button 
            onClick={handleSendInvitations}
            disabled={inviting}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              inviting || selectedEmails.length === 0
                ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
            )}
            title="Invia inviti via email ai dipendenti selezionati"
          >
            <Mail className="w-4 h-4" />
            {inviting ? "Invio in corso..." : `Invia Inviti (${selectedEmails.length})`}
          </button>
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" />
            {dipendenti.length} Dipendenti
          </div>
          <button 
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-blue-600"
            title="Impostazioni Azienda"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Slot Generator Form */}
        <div className="space-y-4" id="slot-generator">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            Genera Slot Visite
          </h2>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Data</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Inizio</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="time" 
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Fine</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="time" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Durata Slot (minuti)</label>
              <select 
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={15}>15 minuti</option>
                <option value={20}>20 minuti</option>
                <option value={30}>30 minuti</option>
                <option value={45}>45 minuti</option>
                <option value={60}>60 minuti</option>
              </select>
            </div>

            <button
              onClick={handleGenerateSlots}
              disabled={saving}
              className={cn(
                "w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                saving ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
              )}
            >
              {saving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Salva Disponibilità
                </>
              )}
            </button>

            <AnimatePresence>
              {success && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-xl text-sm font-medium"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Slot generati e salvati con successo!
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Dipendenti Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Elenco Dipendenti
            </h2>
            <button 
              onClick={() => setIsEmpModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Aggiungi Dipendente
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 w-10">
                    <input 
                      type="checkbox" 
                      checked={dipendenti.length > 0 && selectedEmails.length === dipendenti.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmails(dipendenti.map(d => d.email));
                        } else {
                          setSelectedEmails([]);
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dipendenti.map((d, i) => (
                  <tr key={i} className={cn("hover:bg-gray-50 transition-colors", selectedEmails.includes(d.email) ? "bg-blue-50/30" : "")}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        checked={selectedEmails.includes(d.email)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmails([...selectedEmails, d.email]);
                          } else {
                            setSelectedEmails(selectedEmails.filter(email => email !== d.email));
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{d.nome}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{d.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{d.sesso || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            setEditingEmp(d);
                            setNewEmp({ nome: d.nome, email: d.email, sesso: d.sesso });
                            setIsEditEmpModalOpen(true);
                          }}
                          className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition-colors"
                          title="Modifica"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteDipendente(d.id)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {dipendenti.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-gray-400 italic">
                      Nessun dipendente trovato per questa azienda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nuovo Dipendente */}
      <AnimatePresence>
        {isEmpModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEmpModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Aggiungi Dipendente</h2>
                  <button 
                    onClick={() => setIsEmpModalOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleAddEmployee} className="space-y-5">
                  {empError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>{empError}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Nome e Cognome</label>
                    <input 
                      required
                      placeholder="es. Mario Rossi"
                      value={newEmp.nome}
                      onChange={e => setNewEmp({...newEmp, nome: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Email (obbligatoria)</label>
                    <input 
                      required
                      type="email"
                      placeholder="mario.rossi@azienda.it"
                      value={newEmp.email}
                      onChange={e => setNewEmp({...newEmp, email: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Sesso (opzionale)</label>
                    <select 
                      value={newEmp.sesso}
                      onChange={e => setNewEmp({...newEmp, sesso: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Seleziona...</option>
                      <option value="M">Maschio</option>
                      <option value="F">Femmina</option>
                      <option value="Altro">Altro</option>
                    </select>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsEmpModalOpen(false)}
                      className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all border border-gray-200"
                    >
                      Annulla
                    </button>
                    <button 
                      type="submit"
                      disabled={empSaving}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                    >
                      {empSaving ? 'Salvataggio...' : 'Salva Dipendente'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Modifica Dipendente */}
      <AnimatePresence>
        {isEditEmpModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsEditEmpModalOpen(false);
                setEditingEmp(null);
                setNewEmp({ nome: '', email: '', sesso: '' });
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Modifica Dipendente</h2>
                  <button 
                    onClick={() => {
                      setIsEditEmpModalOpen(false);
                      setEditingEmp(null);
                      setNewEmp({ nome: '', email: '', sesso: '' });
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleUpdateDipendente} className="space-y-5">
                  {empError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>{empError}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Nome e Cognome</label>
                    <input 
                      required
                      value={newEmp.nome}
                      onChange={e => setNewEmp({...newEmp, nome: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Email</label>
                    <input 
                      required
                      type="email"
                      value={newEmp.email}
                      onChange={e => setNewEmp({...newEmp, email: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Sesso</label>
                    <select 
                      value={newEmp.sesso}
                      onChange={e => setNewEmp({...newEmp, sesso: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Seleziona...</option>
                      <option value="M">Maschio</option>
                      <option value="F">Femmina</option>
                      <option value="Altro">Altro</option>
                    </select>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsEditEmpModalOpen(false);
                        setEditingEmp(null);
                        setNewEmp({ nome: '', email: '', sesso: '' });
                      }}
                      className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      Annulla
                    </button>
                    <button 
                      type="submit"
                      disabled={empSaving}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                    >
                      {empSaving ? 'Salvataggio...' : 'Salva Modifiche'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Convocation Modal */}
      <AnimatePresence>
        {isConvocationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Imposta Convocazione</h2>
                  <button onClick={() => setIsConvocationModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 ml-1">Data</label>
                    <div className="relative">
                      <input 
                        type="date" 
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full px-5 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-700 font-medium bg-gray-50/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-900 ml-1">Inizio</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                          type="time" 
                          value={startTime}
                          onChange={e => setStartTime(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-700 font-medium bg-gray-50/30"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-900 ml-1">Fine</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                          type="time" 
                          value={endTime}
                          onChange={e => setEndTime(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-700 font-medium bg-gray-50/30"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 ml-1">Durata Slot (minuti)</label>
                    <select 
                      value={duration}
                      onChange={e => setDuration(parseInt(e.target.value))}
                      className="w-full px-5 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-700 font-medium bg-gray-50/30 appearance-none cursor-pointer"
                    >
                      <option value="15">15 minuti</option>
                      <option value="20">20 minuti</option>
                      <option value="30">30 minuti</option>
                      <option value="45">45 minuti</option>
                      <option value="60">60 minuti</option>
                    </select>
                  </div>

                  <div className="pt-6 flex flex-col gap-3">
                    <button 
                      onClick={async () => {
                        await handleGenerateSlots();
                        setIsConvocationModalOpen(false);
                      }}
                      disabled={saving}
                      className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      {saving ? 'Salvataggio...' : 'Salva Disponibilità'}
                    </button>
                    
                    <button 
                      onClick={async () => {
                        await handleDeleteConvocation(originalDate || date);
                        setIsConvocationModalOpen(false);
                      }}
                      disabled={saving}
                      className="w-full py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Elimina Convocazione
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Impostazioni Azienda</h2>
                  <button 
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleUpdateCompany} className="space-y-5">
                  {settingsError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>{settingsError}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Nome Azienda</label>
                    <input 
                      required
                      value={editCompany.nome}
                      onChange={e => setEditCompany({...editCompany, nome: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">URL Logo</label>
                    <input 
                      value={editCompany.logo}
                      onChange={e => setEditCompany({...editCompany, logo: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Indirizzo</label>
                    <input 
                      value={editCompany.indirizzo}
                      onChange={e => setEditCompany({...editCompany, indirizzo: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="pt-4 flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button 
                        type="button"
                        onClick={() => setIsSettingsModalOpen(false)}
                        className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all border border-gray-200"
                      >
                        Annulla
                      </button>
                      <button 
                        type="submit"
                        disabled={settingsSaving}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                      >
                        {settingsSaving ? 'Salvataggio...' : 'Salva Modifiche'}
                      </button>
                    </div>
                    
                    <div className="pt-4 border-t border-gray-100">
                      <button 
                        type="button"
                        onClick={handleDeleteCompany}
                        disabled={settingsSaving}
                        className="w-full py-3 rounded-xl font-bold text-red-600 hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-5 h-5" />
                        Elimina Azienda
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BookingView = ({ token }: { token: string }) => {
  const info = React.useMemo(() => {
    try {
      const decoded = atob(token);
      const [aziendaId, dipendenteId, dipendenteNome, dipendenteEmail] = decoded.split('|');
      return { aziendaId, dipendenteId, dipendenteNome, dipendenteEmail };
    } catch (e) {
      return null;
    }
  }, [token]);

  const [allSlots, setAllSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [confirmingSlot, setConfirmingSlot] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const data = await fetchGAS({ action: 'getAllSlots' });
      if (Array.isArray(data)) {
        setAllSlots(data.map(normalizeSlot));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (info) fetchSlots();
  }, [info]);

  if (!info) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-gray-50">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Link non valido</h1>
        <p className="text-gray-600">Il link utilizzato non è corretto o è scaduto.</p>
      </div>
    );
  }

  const companySlots = allSlots.filter(s => s.aziendaId === info.aziendaId);
  const myBooking = companySlots.find(s => s.dipendenteEmail === info.dipendenteEmail);

  // Raggruppa gli slot per giorno
  const groupedSlots = React.useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    companySlots
      .filter(s => s.stato === 'Libero' || (myBooking && s.data === myBooking.data && s.inizio === myBooking.inizio))
      .sort((a, b) => new Date(a.data + 'T' + a.inizio).getTime() - new Date(b.data + 'T' + b.inizio).getTime())
      .forEach(slot => {
        const dateKey = slot.data;
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(slot);
      });
    return Object.entries(groups).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
  }, [companySlots, myBooking]);

  const handleBook = async (slot: any) => {
    if (bookingLoading) return;
    setBookingLoading(true);
    setMessage(null);
    // Non chiudiamo il modale di conferma qui, lo lasciamo aperto per mostrare il caricamento
    try {
      // 1. Occupiamo il nuovo slot
      const res = await fetchGAS({
        action: 'updateSlot',
        aziendaId: info.aziendaId,
        data: slot.data,
        inizio: slot.inizio,
        stato: 'Occupato',
        dipendenteEmail: info.dipendenteEmail,
        dipendenteNome: info.dipendenteNome
      });

      if (res.success) {
        // 2. Se avevamo un vecchio slot diverso, lo liberiamo
        if (myBooking && (myBooking.data !== slot.data || myBooking.inizio !== slot.inizio)) {
          await fetchGAS({
            action: 'updateSlot',
            aziendaId: info.aziendaId,
            data: myBooking.data,
            inizio: myBooking.inizio,
            stato: 'Libero',
            dipendenteEmail: '',
            dipendenteNome: ''
          });
        }
        setConfirmingSlot(null); // Chiudiamo il modale solo al successo
        setMessage({ type: 'success', text: 'Prenotazione confermata con successo! Riceverai una mail di conferma a breve.' });
        fetchSlots();
      } else {
        setConfirmingSlot(null);
        setMessage({ type: 'error', text: 'Errore: ' + (res.error || 'Riprova più tardi.') });
      }
    } catch (err) {
      setConfirmingSlot(null);
      setMessage({ type: 'error', text: 'Errore di connessione. Controlla la tua rete e riprova.' });
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="bg-blue-600 p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <CalendarIcon className="w-6 h-6" />
              <h1 className="text-xl font-bold">Prenotazione Visita Medica</h1>
            </div>
            <p className="text-blue-100">Ciao <strong>{info.dipendenteNome}</strong>, seleziona l'orario che preferisci per la tua visita medica.</p>
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {message && (
                <motion.div 
                  key="success-message"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "p-8 rounded-3xl flex flex-col items-center text-center gap-4 mb-8 shadow-xl",
                    message.type === 'success' ? "bg-green-50 text-green-900 border-2 border-green-200" : "bg-red-50 text-red-900 border-2 border-red-200"
                  )}
                >
                  {message.type === 'success' ? (
                    <div className="bg-green-500 p-4 rounded-full text-white mb-2 shadow-lg shadow-green-200">
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                  ) : (
                    <div className="bg-red-500 p-4 rounded-full text-white mb-2 shadow-lg shadow-red-200">
                      <AlertCircle className="w-12 h-12" />
                    </div>
                  )}
                  <h2 className="text-2xl font-black">{message.type === 'success' ? 'Fatto!' : 'Ops!'}</h2>
                  <p className="text-lg font-bold leading-tight">{message.text}</p>
                  {message.type === 'success' && (
                    <p className="text-sm text-green-700 font-medium">Puoi chiudere questa pagina in sicurezza.</p>
                  )}
                  {message.type === 'error' && (
                    <button 
                      onClick={() => setMessage(null)}
                      className="mt-4 px-6 py-2 bg-white border-2 border-current rounded-full text-sm font-bold hover:bg-white/50 transition-colors"
                    >
                      Torna alla lista
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {myBooking && !message && (
              <div className="mb-12 p-1 bg-gradient-to-br from-blue-500 to-blue-600 rounded-[2rem] shadow-xl shadow-blue-100">
                <div className="bg-white/95 backdrop-blur-sm p-6 rounded-[1.8rem]">
                  <h2 className="text-[10px] font-black text-blue-600 mb-4 flex items-center gap-2 uppercase tracking-[0.2em]">
                    <Clock className="w-3 h-3" />
                    Prenotazione Attiva
                  </h2>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <p className="text-2xl font-black text-gray-900 capitalize leading-tight">
                        {format(new Date(myBooking.data), 'EEEE d MMMM', { locale: it })}
                      </p>
                      <p className="text-blue-600 font-black text-lg mt-1">{myBooking.inizio} — {myBooking.fine}</p>
                    </div>
                    <div className="bg-green-500 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-green-100 flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3" />
                      Confermata
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!message && (
              <>
                <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-4">
                  Scegli un orario
                  <div className="h-px bg-gray-100 flex-1"></div>
                </h3>
                
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-100 border-b-blue-600"></div>
                    <p className="text-gray-500 font-bold animate-pulse">Caricamento orari...</p>
                  </div>
                ) : (
                  <div className="space-y-12">
                    {groupedSlots.length === 0 ? (
                      <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                        <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 font-black text-lg">Nessun orario disponibile</p>
                        <p className="text-sm text-gray-400 max-w-xs mx-auto mt-2">Al momento non ci sono slot liberi per l'azienda selezionata.</p>
                      </div>
                    ) : (
                      groupedSlots.map(([date, daySlots]) => (
                        <div key={date} className="space-y-6">
                          <div className="flex items-center gap-4">
                            <div className="bg-blue-600 text-white px-4 py-1 rounded-lg text-xs font-black uppercase tracking-widest">
                              {format(new Date(date), 'MMM', { locale: it })}
                            </div>
                            <h4 className="text-lg font-black text-gray-900 capitalize">
                              {format(new Date(date), 'EEEE d', { locale: it })}
                            </h4>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {daySlots.map((slot, idx) => {
                              const isCurrent = myBooking && slot.data === myBooking.data && slot.inizio === myBooking.inizio;
                              return (
                                <button
                                  key={idx}
                                  disabled={isCurrent || bookingLoading}
                                  onClick={() => setConfirmingSlot(slot)}
                                  className={cn(
                                    "relative flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left group",
                                    isCurrent 
                                      ? "bg-blue-50 border-blue-400 cursor-default" 
                                      : "bg-white border-gray-100 hover:border-blue-600 hover:shadow-xl active:scale-[0.98]"
                                  )}
                                >
                                  <div className={cn(
                                    "w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-sm transition-colors",
                                    isCurrent ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 group-hover:bg-blue-600 group-hover:text-white"
                                  )}>
                                    <span className="text-sm font-black leading-none">{format(new Date(slot.data), 'd')}</span>
                                    <span className="text-[9px] font-bold uppercase mt-1 opacity-70">{format(new Date(slot.data), 'MMM', { locale: it })}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-black text-xl text-gray-900 leading-none mb-1 group-hover:text-blue-600 transition-colors">
                                      {slot.inizio}
                                    </p>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                                      Fino alle {slot.fine}
                                    </p>
                                  </div>
                                  {!isCurrent && (
                                    <div className="bg-blue-50 p-2 rounded-full text-blue-600 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                                      <ChevronRight className="w-5 h-5" />
                                    </div>
                                  )}
                                  {isCurrent && (
                                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white">
                                      <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 font-bold uppercase tracking-widest">
          MedWork Manager &copy; 2024
        </p>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmingSlot && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !bookingLoading && setConfirmingSlot(null)}
              className="absolute inset-0 bg-gray-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              {bookingLoading && (
                <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                  <div className="relative w-24 h-24 mb-6">
                    <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                    <CalendarIcon className="absolute inset-0 m-auto w-10 h-10 text-blue-600 animate-pulse" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Conferma in corso</h3>
                  <p className="text-gray-500 font-medium">Stiamo registrando la tua visita, non chiudere questa pagina...</p>
                </div>
              )}

              <div className="p-10 text-center">
                <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 shadow-inner">
                  <CalendarIcon className="w-12 h-12" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-3">Confermi?</h2>
                <p className="text-gray-500 font-medium mb-8 leading-relaxed">
                  Hai scelto di prenotare la visita per il seguente orario:
                </p>
                
                <div className="bg-gray-50 p-8 rounded-[2rem] border-2 border-gray-100 mb-10 shadow-inner">
                  <p className="text-4xl font-black text-blue-600 mb-2">{confirmingSlot.inizio}</p>
                  <p className="text-lg font-black text-gray-800 capitalize">
                    {format(new Date(confirmingSlot.data), 'EEEE d MMMM', { locale: it })}
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={() => handleBook(confirmingSlot)}
                    disabled={bookingLoading}
                    className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all"
                  >
                    Sì, conferma ora
                  </button>
                  <button
                    onClick={() => setConfirmingSlot(null)}
                    disabled={bookingLoading}
                    className="w-full py-2 text-gray-400 font-black uppercase tracking-widest text-xs hover:text-gray-600 transition-colors"
                  >
                    Annulla e torna indietro
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function AppContent() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const isBookingMode = !!token;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {!isBookingMode && <Navbar />}
      <main className={isBookingMode ? "" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10"}>
        <Routes>
          <Route path="/" element={isBookingMode ? <BookingView token={token} /> : <Dashboard />} />
          <Route path="/azienda/:id" element={<CompanyDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
