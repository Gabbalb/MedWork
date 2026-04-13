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
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addMinutes, parse, isBefore, isAfter } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
}

interface Dipendente {
  aziendaId: string;
  nome: string;
  email: string;
  sesso?: string;
}

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

const Dashboard = () => {
  const [aziende, setAziende] = useState<Azienda[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({
    nome: '',
    logo: '',
    indirizzo: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAziende = () => {
    setLoading(true);
    fetch('/api/aziende')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAziende(data);
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

  useEffect(() => {
    fetchAziende();
  }, []);

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/aziende', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompany)
      });
      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setNewCompany({ nome: '', logo: '', indirizzo: '' });
        fetchAziende();
      } else {
        setError(data.details || data.error || 'Errore durante il salvataggio');
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

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Aziendale</h1>
          <p className="text-gray-500 mt-2">Seleziona un'azienda per gestire dipendenti e disponibilità.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 w-fit"
        >
          <Plus className="w-5 h-5" />
          Nuova Azienda
        </button>
      </header>

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
  const [loading, setLoading] = useState(true);
  
  // Modal State for New Employee
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [newEmp, setNewEmp] = useState({
    nome: '',
    email: '',
    sesso: ''
  });
  const [empSaving, setEmpSaving] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editCompany, setEditCompany] = useState({
    nome: '',
    logo: '',
    indirizzo: ''
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

  const fetchDipendenti = () => {
    fetch(`/api/dipendenti/${id}`)
      .then(res => res.json())
      .then(data => {
        setDipendenti(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/aziende').then(res => res.json()),
      fetch(`/api/dipendenti/${id}`).then(res => res.json())
    ]).then(([aziende, dipendentiData]) => {
      const aziendeList = Array.isArray(aziende) ? aziende : [];
      const found = aziendeList.find((a: Azienda) => a.id === id);
      setAzienda(found || null);
      if (found) {
        setEditCompany({
          nome: found.nome,
          logo: found.logo,
          indirizzo: found.indirizzo
        });
      }
      setDipendenti(Array.isArray(dipendentiData) ? dipendentiData : []);
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
      const res = await fetch('/api/dipendenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newEmp, aziendaId: id })
      });
      const data = await res.json();
      if (res.ok) {
        setIsEmpModalOpen(false);
        setNewEmp({ nome: '', email: '', sesso: '' });
        fetchDipendenti();
      } else {
        setEmpError(data.details || data.error || 'Errore durante il salvataggio');
      }
    } catch (err) {
      console.error(err);
      setEmpError('Errore di connessione al server');
    } finally {
      setEmpSaving(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const res = await fetch(`/api/aziende/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editCompany)
      });
      if (res.ok) {
        setAzienda({ ...azienda!, ...editCompany });
        setIsSettingsModalOpen(false);
      } else {
        const data = await res.json();
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
      const res = await fetch(`/api/aziende/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        navigate('/');
      } else {
        const data = await res.json();
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
      const res = await fetch('/api/disponibilita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aziendaId: azienda.id, slots })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (!azienda) return <div className="text-center py-20">Azienda non trovata.</div>;

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
        <div className="space-y-4">
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

      {/* Modal Impostazioni Azienda */}
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
