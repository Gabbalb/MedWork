/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
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
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addMinutes, parse, isBefore, isAfter, isValid } from 'date-fns';
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
}

interface Dipendente {
  id: string;
  aziendaId: string;
  nome: string;
  email: string;
  sesso: string;
}

const normalizeSlot = (s: any): Slot => {
  if (!s) return { aziendaId: '', data: '', inizio: '', fine: '', durata: '', stato: '' };
  return {
    aziendaId: s.aziendaId || s['Id-Azienda'] || s['id-azienda'] || s['aziendaid'] || '',
    data: s.data || s['Data'] || s['data'] || '',
    inizio: s.inizio || s['Inizio'] || s['inizio'] || '',
    fine: s.fine || s['Fine'] || s['fine'] || '',
    durata: s.durata || s['Durata'] || s['durata'] || '',
    stato: s.stato || s['Stato'] || s['stato'] || ''
  };
};

const normalizeAzienda = (a: any): Azienda => ({
  id: a.id || a['Id'] || '',
  nome: a.nome || a['Nome'] || '',
  logo: a.logo || a['Logo'] || '',
  indirizzo: a.indirizzo || a['Indirizzo'] || '',
  prossimaConvocazione: a.prossimaConvocazione || a['ProssimaConvocazione'] || ''
});

const normalizeDipendente = (d: any): Dipendente => {
  if (!d) return { id: '', aziendaId: '', nome: '', email: '', sesso: '' };
  return {
    id: d.id || d['Id'] || d['ID'] || '',
    aziendaId: d.aziendaId || d['Id-Azienda'] || d['id-azienda'] || d['aziendaid'] || '',
    nome: d.nome || d['Nome'] || d['nome'] || '',
    email: d.email || d['Email'] || d['email'] || '',
    sesso: d.sesso || d['Sesso'] || d['sesso'] || ''
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
    
    const options: any = {
      method: body ? 'POST' : 'GET',
      mode: 'cors',
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const res = await fetch(url.toString(), options);
    return res.json();
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
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [isSlotDetailOpen, setIsSlotDetailOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
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

  const fetchDipendentiAzienda = async (aziendaId: string) => {
    if (!aziendaId) {
      console.warn('fetchDipendentiAzienda called without aziendaId');
      return;
    }
    console.log('Fetching dipendenti for aziendaId:', aziendaId);
    setIsDipendentiLoading(true);
    try {
      const data = await fetchGAS({ action: 'getDipendenti', aziendaId });
      console.log('Dipendenti data received:', data);
      if (Array.isArray(data)) {
        setDipendentiAzienda(data.map(normalizeDipendente));
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
    
    // Find employee email if dipendenteId is provided
    let dipendenteEmail = '';
    if (dipendenteId) {
      const emp = dipendentiAzienda.find(d => d.id === dipendenteId);
      if (emp) dipendenteEmail = emp.email;
    }

    try {
      const data = await fetchGAS({ action: 'updateSlot' }, {
        action: 'updateSlot',
        aziendaId: selectedSlot.aziendaId,
        data: selectedSlot.data,
        inizio: selectedSlot.inizio,
        stato: newStatus,
        dipendenteId: dipendenteId || '',
        dipendenteEmail: dipendenteEmail
      });
      if (data.success) {
        fetchAllSlots();
        setIsSlotDetailOpen(false);
      }
    } catch (err) {
      console.error('Error updating slot:', err);
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
            events={allSlots.map(s => {
              const slot = normalizeSlot(s);
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
              fetchDipendentiAzienda(slot.aziendaId);
              setIsSlotDetailOpen(true);
            }}
            eventContent={(eventInfo) => (
              <div className="p-1 overflow-hidden">
                <div className="font-bold text-[10px] truncate">{eventInfo.event.title}</div>
                <div className="text-[9px] opacity-80">{eventInfo.timeText}</div>
              </div>
            )}
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
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Azienda</p>
                      <p className="text-lg font-bold text-gray-900">{selectedSlot.aziendaNome}</p>
                    </div>
                  </div>

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

  const fetchDipendenti = () => {
    fetchGAS({ action: 'getDipendenti', aziendaId: id })
      .then(data => {
        setDipendenti(Array.isArray(data) ? data.map(normalizeDipendente) : []);
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
      const found = aziendeList.find((a: Azienda) => a.id === id);
      setAzienda(found || null);
      if (found) {
        setEditCompany({
          nome: found.nome,
          logo: found.logo,
          indirizzo: found.indirizzo,
          prossimaConvocazione: found.prossimaConvocazione || ''
        });
      }
      setDipendenti(Array.isArray(dipendentiData) ? dipendentiData.map(normalizeDipendente) : []);
      setSlots(Array.isArray(slotsData) ? slotsData.map(normalizeSlot) : []);
      setLoading(false);
    }).catch(err => {
      console.error(err);
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
        ...newEmp,
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
        ...newEmp
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
        ...editCompany
      });
      if (data.success) {
        setAzienda({ ...azienda!, ...editCompany });
        setIsSettingsModalOpen(false);
        fetchGAS({ action: 'getAziende' }).then(aziende => {
          const aziendeList = Array.isArray(aziende) ? aziende : [];
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

      slots.push([
        azienda.id,
        date,
        format(current, 'HH:mm'),
        format(slotEnd, 'HH:mm'),
        duration.toString(),
        'Libero'
      ]);
      current = slotEnd;
    }

    try {
      const data = await fetchGAS({ action: 'addDisponibilita' }, {
        action: 'addDisponibilita',
        aziendaId: azienda.id,
        date: originalDate || date, // Use original date to overwrite if it changed
        slots
      });
      if (data.success) {
        setSuccess(true);
        setOriginalDate(date); // Update original date to new date
        fetchSlots();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
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
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dipendenti.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
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

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/azienda/:id" element={<CompanyDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
