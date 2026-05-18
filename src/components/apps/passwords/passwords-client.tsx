'use client';
// Force rebuild

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePasswords, Password, PasswordInput } from '@/context/PasswordsContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Eye, EyeOff, Copy, RefreshCw, Download, Upload, Edit, Trash2, Lock, Unlock, ShieldCheck, Globe, Smartphone, MapPin, Users, Cloud, Film, ShoppingBag, Briefcase, CreditCard, Folder, ArrowLeft, LayoutGrid, Fingerprint, QrCode, X, CheckCircle2, Loader2, ScanLine } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QRCodeSVG } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { motion, AnimatePresence } from 'framer-motion';

const POPULAR_SERVICES = [
  { name: 'Google', url: 'google.com', category: 'Correo/Nube', color: 'bg-red-500' },
  { name: 'Facebook', url: 'facebook.com', category: 'Redes Sociales', color: 'bg-blue-600' },
  { name: 'Instagram', url: 'instagram.com', category: 'Redes Sociales', color: 'bg-pink-600' },
  { name: 'Twitter (X)', url: 'twitter.com', category: 'Redes Sociales', color: 'bg-black' },
  { name: 'Netflix', url: 'netflix.com', category: 'Entretenimiento', color: 'bg-red-600' },
  { name: 'Spotify', url: 'spotify.com', category: 'Entretenimiento', color: 'bg-green-500' },
  { name: 'Amazon', url: 'amazon.com', category: 'Compras', color: 'bg-orange-500' },
  { name: 'Apple', url: 'apple.com', category: 'Tecnología', color: 'bg-gray-800' },
  { name: 'Microsoft', url: 'microsoft.com', category: 'Trabajo', color: 'bg-blue-500' },
  { name: 'LinkedIn', url: 'linkedin.com', category: 'Trabajo', color: 'bg-blue-700' },
];

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType, color: string, gradient: string }> = {
  'Redes Sociales': { icon: Users, color: 'text-blue-500', gradient: 'from-blue-500/20 to-purple-500/20' },
  'Correo/Nube': { icon: Cloud, color: 'text-sky-500', gradient: 'from-sky-500/20 to-blue-500/20' },
  'Entretenimiento': { icon: Film, color: 'text-red-500', gradient: 'from-red-500/20 to-orange-500/20' },
  'Compras': { icon: ShoppingBag, color: 'text-pink-500', gradient: 'from-pink-500/20 to-rose-500/20' },
  'Trabajo': { icon: Briefcase, color: 'text-indigo-500', gradient: 'from-indigo-500/20 to-slate-500/20' },
  'Finanzas': { icon: CreditCard, color: 'text-green-500', gradient: 'from-green-500/20 to-green-500/20' },
  'Otros': { icon: Folder, color: 'text-gray-500', gradient: 'from-gray-500/20 to-slate-500/20' },
  'Tecnología': { icon: Smartphone, color: 'text-zinc-500', gradient: 'from-zinc-500/20 to-neutral-500/20' },
};

export default function PasswordsClient() {
  const {
    passwords, loading, isLocked, unlock, lock,
    addPassword, updatePassword, deletePassword,
    decryptPassword, importPasswords,
    biometricsAvailable, isBiometricsEnabled, enableBiometrics, disableBiometrics, unlockWithBiometrics,
    generateQrSession, authorizeQrSession, checkQrSession,
    mfaRequired, completeMfaUnlock, cancelMfaUnlock
  } = usePasswords();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState<Password | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string | undefined>>({});
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lock Screen State
  const [masterPasswordInput, setMasterPasswordInput] = useState('');
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [showQrScreen, setShowQrScreen] = useState(false);
  const [currentQrSession, setCurrentQrSession] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scanLock = useRef<boolean>(false);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isWindowSmall = window.innerWidth < 768;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isWindowSmall || isMobileUA);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [device, setDevice] = useState('');
  const [location, setLocation] = useState('');

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPasswordInput) return;

    setUnlocking(true);
    const success = await unlock(masterPasswordInput);
    setUnlocking(false);

    if (success) {
      setMasterPasswordInput('');
      toast.success('Bóveda desbloqueada');
    } else {
      toast.error('Contraseña maestra incorrecta');
    }
  };

  const handleBiometricUnlock = async () => {
    setUnlocking(true);
    const success = await unlockWithBiometrics();
    setUnlocking(false);
    if (!success) {
      toast.error('Error al usar biometría o dispositivo no vinculado');
    }
  };

  const startQrPolling = (sessionId: string) => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);

    pollingInterval.current = setInterval(async () => {
      const isApproved = await checkQrSession(sessionId);
      if (isApproved) {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        setShowQrScreen(false);
      }
    }, 1500);

    setTimeout(() => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      if (showQrScreen) setShowQrScreen(false);
    }, 60000);
  };

  const handleCloseQr = () => {
    setShowQrScreen(false);
    if (pollingInterval.current) clearInterval(pollingInterval.current);
  };

  const handleShowQr = () => {
    const session = generateQrSession();
    setCurrentQrSession(session);
    setShowQrScreen(true);
    startQrPolling(session);
  };

  const handleScanSuccess = async (text: string) => {
    if (scanLock.current) return;

    if (text.startsWith('quioba-pass:')) {
      scanLock.current = true;
      const sessionId = text.replace('quioba-pass:', '');
      await authorizeQrSession(sessionId);
      setIsScanning(false);

      // Liberar el candado tras 3 segundos para prevenir falsos dobles en el render
      setTimeout(() => { scanLock.current = false; }, 3000);
    }
  };

  const resetForm = () => {
    setName('');
    setUsername('');
    setPassword('');
    setWebsite('');
    setCategory('');
    setDevice('');
    setLocation('');
    setIsNewPasswordVisible(false);
    setEditingPassword(null);
  };

  const handleAddNewClick = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleServiceClick = (service: typeof POPULAR_SERVICES[0]) => {
    setName(service.name);
    setWebsite(`https://www.${service.url}`);
    setCategory(service.category);
  };

  const handleEditClick = (p: Password) => {
    setEditingPassword(p);
    setName(p.name);
    setUsername(p.username);
    setPassword(decryptPassword(p.passwordHash)); // Show decrypted password for editing
    setWebsite(p.website || '');
    setCategory(p.category || '');
    setDevice(p.device || '');
    setLocation(p.location || '');
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta contraseña?')) {
      deletePassword(id);
      toast.success('¡Contraseña eliminada!');
    }
  };

  const handleSavePassword = () => {
    if (name && username && password) {
      const passwordData: PasswordInput = { name, username, password, website, category, device, location };
      if (editingPassword) {
        updatePassword(editingPassword.id, passwordData);
      } else {
        addPassword(passwordData);
      }
      setIsDialogOpen(false);
      resetForm();
    }
  };

  const generatePassword = () => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let newPassword = '';
    for (let i = 0; i < 16; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      newPassword += charset[randomIndex];
    }
    setPassword(newPassword);
  };

  const handleExportPasswords = () => {
    if (passwords.length === 0) {
      toast.info('No hay contraseñas para exportar.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const filename = `passwords_${today}.json`;
    const jsonString = JSON.stringify(passwords, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    toast.success('¡Contraseñas exportadas con éxito!');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        const imported = JSON.parse(text as string);
        importPasswords(imported);
      } catch (error) {
        toast.error('El archivo no es válido o está corrupto.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleTogglePasswordVisibility = (id: string, hash: string) => {
    if (visiblePasswords[id]) {
      setVisiblePasswords(prev => ({ ...prev, [id]: undefined }));
    } else {
      const decrypted = decryptPassword(hash);
      setVisiblePasswords(prev => ({ ...prev, [id]: decrypted }));
      setTimeout(() => {
        setVisiblePasswords(prev => ({ ...prev, [id]: undefined }));
      }, 5000);
    }
  };

  const handleCopyPassword = async (hash: string) => {
    const decrypted = decryptPassword(hash);
    try {
      await navigator.clipboard.writeText(decrypted);
      toast.success('¡Contraseña copiada al portapapeles!');
    } catch (err) {
      toast.error('No se pudo copiar la contraseña.');
    }
  };

  const filteredPasswords = useMemo(() => {
    return passwords.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.website?.toLowerCase().includes(search.toLowerCase()) ||
      p.device?.toLowerCase().includes(search.toLowerCase()) ||
      p.location?.toLowerCase().includes(search.toLowerCase())
    );
  }, [passwords, search]);

  const groupedPasswords = useMemo(() => {
    const groups: Record<string, Password[]> = {};
    filteredPasswords.forEach(p => {
      const cat = p.category || 'Otros';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [filteredPasswords]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isLocked) {
    const isFirstTime = passwords.length === 0;

    if (mfaRequired) {
      return (
        <div className="flex items-center justify-center min-h-[70vh] p-4">
          <div className="w-full max-w-md relative">
            <div className="absolute inset-0 -z-10 bg-blue-500/10 blur-3xl rounded-full translate-y-12"></div>
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-zinc-800 shadow-2xl rounded-3xl overflow-hidden p-8 text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600 animate-pulse">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black mb-2">Autorización Requerida</h2>
              <p className="text-sm text-slate-500 mb-8 font-medium">
                Por seguridad 'Zero Trust', la contraseña no es suficiente. Certifica este acceso usando un factor físico.
              </p>

              <div className="space-y-4">
                <Button
                  onClick={async () => {
                    if (window.PublicKeyCredential) {
                      try {
                        await navigator.credentials.create({ publicKey: { challenge: new Uint8Array(16), rp: { name: "Quioba" }, user: { id: new Uint8Array(16), name: "user", displayName: "User" }, pubKeyCredParams: [{ type: "public-key", alg: -7 }], authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" }, timeout: 60000 } });
                        completeMfaUnlock();
                      } catch (e) {
                        toast.error('Autorización biométrica cancelada o fallida.');
                      }
                    } else {
                      toast.error('El dispositivo actual no soporta biometría.');
                    }
                  }}
                  className="w-full py-7 text-lg bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  <Fingerprint className="w-6 h-6 mr-3" /> Certificar con Huella
                </Button>

                {!isMobile && (
                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-slate-200 dark:border-zinc-800"></div>
                    <span className="flex-shrink-0 mx-4 text-xs font-bold uppercase text-slate-400">O bien</span>
                    <div className="flex-grow border-t border-slate-200 dark:border-zinc-800"></div>
                  </div>
                )}

                {!isMobile && (
                  <Button
                    onClick={handleShowQr}
                    variant="outline"
                    className="w-full py-7 text-lg rounded-2xl border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  >
                    <QrCode className="w-6 h-6 mr-3" /> Certificar con tu Móvil (QR)
                  </Button>
                )}
              </div>

              <Button variant="ghost" onClick={cancelMfaUnlock} className="mt-8 text-slate-400">
                Cancelar e ir atrás
              </Button>
            </div>
          </div>

          {/* QR PC MODAL (COPIA PARA MFA) */}
          <AnimatePresence>
            {showQrScreen && (
              <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-white dark:bg-zinc-950 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center relative border border-white/10"
                >
                  <button onClick={handleCloseQr} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                  <div className="mb-6">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-950/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                      <QrCode className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">Certificar Acceso</h2>
                    <div className="bg-slate-50 dark:bg-zinc-900 rounded-xl p-4 mt-4 text-left border border-slate-100 dark:border-zinc-800 shadow-inner">
                      <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 font-medium list-decimal list-inside">
                        <li>Abre <b>Claves</b> en tu móvil y entra con tu huella.</li>
                        <li>Pulsa el botón superior <b>&quot;Escanear QR&quot;</b>.</li>
                        <li>Apunta con la cámara aquí para autorizar este acceso.</li>
                      </ol>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-3xl shadow-inner inline-block mb-6 border-4 border-slate-50">
                    <QRCodeSVG value={`quioba-pass:${currentQrSession}`} size={200} level="H" />
                  </div>

                  <div className="flex items-center justify-center gap-2 text-blue-600 text-sm font-bold animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Esperando autorización...</span>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-[70vh] p-4">
        <div className="w-full max-w-md relative">
          {/* Decorative background glow */}
          <div className="absolute inset-0 -z-10 bg-green-500/10 dark:bg-green-500/5 blur-3xl rounded-full translate-y-12 shrink-0"></div>

          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-zinc-800 shadow-2xl rounded-3xl overflow-hidden">
            <div className="p-8 pb-6 text-center">
              <div className="mx-auto w-24 h-24 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-950/40 dark:to-green-800-950 flex items-center justify-center rounded-3xl shadow-inner mb-6 border border-green-200/50 dark:border-green-950/50 rotate-3 transition-transform hover:rotate-0 duration-500">
                {isFirstTime ? <ShieldCheck className="h-10 w-10 text-green-800 dark:text-green-400 drop-shadow-md" /> : <Lock className="h-10 w-10 text-green-800 dark:text-green-400 drop-shadow-md" />}
              </div>
              <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-2">
                {isFirstTime ? 'Configura tu Bóveda' : 'Bóveda Segura'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed px-2">
                {isFirstTime
                  ? 'Crea una Llave Maestra para cifrar tus contraseñas.'
                  : 'Paso 1: Identificación criptográfica.'}
              </p>
            </div>

            <div className="p-8 pt-0 space-y-6">
              {isFirstTime && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/50 p-4 text-sm text-amber-800 dark:text-amber-300 rounded-2xl flex gap-3 items-start">
                  <div className="mt-0.5"><ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" /></div>
                  <div>
                    <p className="font-bold mb-1">Importante: Tu Llave es Única</p>
                    <p className="opacity-90 leading-relaxed text-xs">Esta contraseña cifrará tus datos de forma local. Si la olvidas, es imposible recuperar el acceso. Nosotros no la guardamos.</p>
                  </div>
                </div>
              )}

              {!isFirstTime && (
                <div className="flex flex-col items-center gap-6">
                  {isMobile && isBiometricsEnabled ? (
                    <div className="w-full max-w-sm space-y-4">
                      <Button
                        onClick={handleBiometricUnlock}
                        disabled={unlocking}
                        className="w-full py-10 text-xl font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-3 h-auto"
                      >
                        <Fingerprint className="w-10 h-10" />
                        Abre tu Bóveda
                      </Button>
                      <p className="text-xs text-slate-400 font-medium">Bóveda asegurada por biometría local</p>
                    </div>
                  ) : (
                    <div className="w-full max-w-sm space-y-6">
                      {isMobile && !isBiometricsEnabled && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 p-4 rounded-2xl text-center">
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1 flex items-center justify-center gap-2">
                            <Fingerprint className="w-4 h-4" /> ¡Activa el Acceso Directo!
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">Entra con tu contraseña una última vez y pulsa el icono de la huella arriba para no tener que volver a escribirla.</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between w-full px-2 gap-3">
                        {!isMobile && (
                          <Button
                            variant="ghost"
                            className="rounded-2xl p-4 h-14 w-14 bg-slate-50 dark:bg-zinc-800/50 hover:bg-green-50 dark:hover:bg-green-950/20 text-slate-400 hover:text-green-500 transition-all border border-slate-200/50 dark:border-zinc-800/50 shrink-0"
                            onClick={handleShowQr}
                            title="Desbloquear con QR"
                          >
                            <QrCode className="w-6 h-6" />
                          </Button>
                        )}

                        <div className="relative w-full group">
                          <Input
                            type={showMasterPassword ? "text" : "password"}
                            placeholder={isMobile ? "Llave Maestra" : "Contraseña"}
                            className="bg-slate-50 dark:bg-black/50 border-slate-200 dark:border-zinc-800/50 text-xl font-bold tracking-widest placeholder:tracking-normal placeholder:text-base text-center h-16 rounded-2xl focus-visible:ring-green-500 shadow-inner w-full pr-12"
                            value={masterPasswordInput}
                            onChange={(e) => setMasterPasswordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUnlock(e as any)}
                            autoFocus
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-12 w-12 hover:bg-transparent rounded-xl text-slate-400"
                            onClick={() => setShowMasterPassword(!showMasterPassword)}
                          >
                            {showMasterPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          disabled={!isBiometricsEnabled}
                          className={`rounded-2xl p-4 h-14 w-14 bg-slate-50 dark:bg-zinc-800/50 transition-all border border-slate-200/50 dark:border-zinc-800/50 shrink-0 ${isBiometricsEnabled ? 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 hover:text-blue-600' : 'opacity-20 cursor-not-allowed text-slate-400'}`}
                          onClick={handleBiometricUnlock}
                          title={isBiometricsEnabled ? "Desbloquear con Huella" : "Biometría no activada"}
                        >
                          <Fingerprint className="w-6 h-6" />
                        </Button>
                      </div>

                      {masterPasswordInput && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
                          <Button
                            onClick={handleUnlock as any}
                            disabled={unlocking}
                            className="w-full py-7 text-lg font-bold bg-green-800 hover:bg-green-900 text-white rounded-2xl shadow-lg shadow-green-800/20 active:scale-[0.98] transition-all"
                          >
                            {unlocking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Descifrar Bóveda'}
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isFirstTime && (
              <form onSubmit={handleUnlock} className="space-y-4">
                <Input
                  type={showMasterPassword ? "text" : "password"}
                  placeholder="Escribe tu nueva llave maestra..."
                  className="text-center py-7 bg-slate-50 dark:bg-black/50 rounded-2xl focus-visible:ring-green-500 border-slate-200 dark:border-zinc-800/50 font-medium"
                  value={masterPasswordInput}
                  onChange={(e) => setMasterPasswordInput(e.target.value)}
                />
                <Button type="submit" disabled={!masterPasswordInput} className="w-full py-7 font-bold bg-green-800 hover:bg-green-900 text-white rounded-2xl shadow-lg">Configurar y Entrar</Button>
              </form>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-black/20 p-4 text-center border-t border-slate-100 dark:border-zinc-800/50">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-green-800 dark:text-green-500 flex items-center justify-center gap-1.5 opacity-80">
              <Lock className="w-3 h-3" /> Protección Local Segura
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Controles de Acciones y Búsqueda ── */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md p-4 rounded-3xl border border-slate-200/60 dark:border-zinc-800 shadow-sm">
        <div className="relative w-full flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por nombre, cuenta o dispositivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 py-6 bg-white dark:bg-black/50 border-transparent focus:border-green-500/50 rounded-2xl shadow-sm w-full font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="application/json" />

          <Button
            onClick={lock}
            variant="outline"
            className="rounded-xl border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 whitespace-nowrap"
          >
            <Lock className="mr-2 h-4 w-4" /> Bloquear
          </Button>

          {biometricsAvailable && (
            <Button
              onClick={isBiometricsEnabled ? disableBiometrics : enableBiometrics}
              variant="outline"
              className={`rounded-xl border-slate-200 dark:border-zinc-800 whitespace-nowrap min-w-[40px] px-3 ${isBiometricsEnabled ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400'}`}
              title={isBiometricsEnabled ? "Biometría Activa" : "Vincular Huella"}
            >
              <Fingerprint className="h-5 w-5" />
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setIsScanning(!isScanning)}
            className={`rounded-xl border-slate-200 dark:border-zinc-800 whitespace-nowrap min-w-[120px] shadow-sm ${isScanning ? 'text-green-800 bg-green-50' : 'text-slate-600 dark:text-slate-300'}`}
          >
            <ScanLine className="mr-2 h-4 w-4 text-green-500" />
            <span>Escanear QR</span>
          </Button>

          <Button
            onClick={handleImportClick}
            variant="outline"
            size="icon"
            className="rounded-xl border-slate-200 dark:border-zinc-800 whitespace-nowrap min-w-10"
            title="Importar"
          >
            <Upload className="h-4 w-4" />
          </Button>

          <Button
            onClick={handleExportPasswords}
            variant="outline"
            size="icon"
            className="rounded-xl border-slate-200 dark:border-zinc-800 whitespace-nowrap min-w-10"
            title="Exportar"
          >
            <Download className="h-4 w-4" />
          </Button>

          <Button
            onClick={handleAddNewClick}
            className="rounded-xl bg-green-800 hover:bg-green-900 text-white shadow-green-800/20 shadow-lg px-5 whitespace-nowrap"
          >
            <Plus className="mr-2 h-5 w-5" /> Nueva Clave
          </Button>
        </div>
      </div>

      {/* ── Área de Listados ── */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-3xl border border-slate-200/50 dark:border-zinc-800 shadow-xl overflow-hidden min-h-[500px] p-6">
        {filteredPasswords.length > 0 ? (
          selectedCategory ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)} className="gap-1 pl-0 hover:bg-transparent hover:text-primary">
                  <ArrowLeft className="h-4 w-4" /> Volver
                </Button>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {(() => {
                    const Config = CATEGORY_CONFIG[selectedCategory] || CATEGORY_CONFIG['Otros'];
                    const Icon = Config.icon;
                    return <Icon className={`h-6 w-6 ${Config.color}`} />;
                  })()}
                  {selectedCategory}
                </h2>
              </div>
              <ul className="space-y-4">
                {(groupedPasswords[selectedCategory] || []).map(p => (
                  <li key={p.id} className="p-4 bg-slate-50/50 dark:bg-black/20 border border-slate-100/50 dark:border-zinc-800/50 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-white dark:hover:bg-zinc-900 transition-all hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/50 group gap-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-100/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl"></div>
                    <div className="flex items-start gap-4 flex-grow w-full">
                      <Avatar className="h-12 w-12 rounded-2xl shadow-sm border border-slate-200/50 dark:border-zinc-800 bg-white">
                        <AvatarImage src={`https://logo.clearbit.com/${p.website || 'example.com'}`} alt={p.name} />
                        <AvatarImage src={`https://www.google.com/s2/favicons?domain=${p.website || 'example.com'}&sz=128`} alt={p.name} />
                        <AvatarFallback className="rounded-2xl bg-green-50 text-green-900 font-bold text-lg">
                          {p.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white truncate">{p.name}</h3>
                        <div className="flex items-center flex-wrap gap-2 mt-1">
                          <span className="flex items-center gap-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-800/50">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[120px]">{p.username}</span>
                          </span>

                          <div className="flex items-center gap-2 font-mono bg-slate-100 dark:bg-black/50 px-2.5 py-0.5 rounded-lg border border-slate-200/50 dark:border-zinc-800/50">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 tracking-widest">{visiblePasswords[p.id] || '••••••••'}</span>
                            <button onClick={() => handleTogglePasswordVisibility(p.id, p.passwordHash)} className="text-slate-400 hover:text-green-800 transition-colors p-1">
                              {visiblePasswords[p.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2.5 text-xs font-medium text-slate-500">
                          {p.website && (
                            <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-green-800 transition-colors bg-slate-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md">
                              <Globe className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[100px]">
                                {(() => {
                                  try {
                                    return new URL(p.website).hostname.replace('www.', '');
                                  } catch {
                                    return p.website;
                                  }
                                })()}
                              </span>
                            </a>
                          )}
                          {p.device && <span className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md truncate max-w-[100px]"><Smartphone className="h-3.5 w-3.5 shrink-0" /> {p.device}</span>}
                          {p.location && <span className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md truncate max-w-[100px]"><MapPin className="h-3.5 w-3.5 shrink-0" /> {p.location}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 self-end sm:self-center ml-auto sm:ml-0 bg-slate-100/50 dark:bg-black/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white dark:hover:bg-zinc-800 hover:text-green-800 hover:shadow-sm" onClick={() => handleCopyPassword(p.passwordHash)} title="Copiar contraseña"><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white dark:hover:bg-zinc-800 hover:text-blue-600 hover:shadow-sm" onClick={() => handleEditClick(p)} title="Editar"><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 hover:shadow-sm" onClick={() => handleDeleteClick(p.id)} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(groupedPasswords).map(([category, items]) => {
                const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['Otros'];
                const Icon = config.icon;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`relative overflow-hidden p-6 rounded-xl border text-left transition-all hover:shadow-md hover:scale-[1.02] group bg-gradient-to-br ${config.gradient}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg bg-background/80 backdrop-blur-sm shadow-sm ${config.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="text-2xl font-bold opacity-20 group-hover:opacity-40 transition-opacity">{items.length}</span>
                    </div>
                    <h3 className="font-bold text-lg mb-1">{category}</h3>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      {items.length} {items.length === 1 ? 'Contraseña' : 'Contraseñas'}
                    </p>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No tienes contraseñas guardadas.</p>
            <p className="text-sm">Añade tu primera contraseña para empezar.</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border-slate-200/50 dark:border-zinc-800/50 shadow-2xl rounded-[2rem] gap-0 p-0 overflow-hidden">
          <div className="p-6 pb-2 border-b border-slate-100 dark:border-zinc-900">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                {editingPassword ? <><Edit className="w-6 h-6 text-green-500" /> Editar Contraseña</> : <><Plus className="w-6 h-6 text-green-500" /> Nueva Contraseña</>}
              </DialogTitle>
              <DialogDescription>
                Completa los detalles para guardar una nueva contraseña de forma segura.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-5 p-6 overflow-y-auto max-h-[70vh]">
            {!editingPassword && (
              <div className="space-y-3 mb-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Servicios Populares</Label>
                <div className="grid grid-cols-5 gap-2">
                  {POPULAR_SERVICES.map((service) => (
                    <button
                      key={service.name}
                      type="button"
                      onClick={() => handleServiceClick(service)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent transition-colors group"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:scale-110 transition-transform ${service.color}`}>
                        {service.name.charAt(0)}
                      </div>
                      <span className="text-[10px] text-center leading-tight truncate w-full">{service.name}</span>
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">O rellena manualmente</span>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-1.5 focus-within:text-green-800 transition-colors">
              <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider">Nombre del Servicio <span className="text-red-500">*</span></Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Google, Netflix..." className="bg-slate-50 dark:bg-zinc-900 border-none rounded-xl py-6 focus-visible:ring-green-500 shadow-inner text-lg font-medium" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 focus-within:text-green-800 transition-colors">
                <Label htmlFor="username" className="text-xs font-bold uppercase tracking-wider">Usuario / Correo <span className="text-red-500">*</span></Label>
                <Input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="tu@email.com" className="bg-slate-50 dark:bg-zinc-900 border-none rounded-xl py-6 focus-visible:ring-green-500 shadow-inner" />
              </div>
              <div className="space-y-1.5 focus-within:text-green-800 transition-colors">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider">Contraseña <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input id="password" type={isNewPasswordVisible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="bg-slate-50 dark:bg-zinc-900 border-none rounded-xl py-6 pr-24 focus-visible:ring-green-500 shadow-inner font-mono" />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" type="button" className="h-10 w-10 text-slate-400 hover:text-green-800 rounded-lg" onClick={() => setIsNewPasswordVisible(prev => !prev)}>{isNewPasswordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</Button>
                    <Button variant="ghost" size="icon" type="button" className="h-10 w-10 text-slate-400 hover:text-blue-600 rounded-lg" onClick={generatePassword} title="Generar"><RefreshCw className="h-5 w-5" /></Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 focus-within:text-green-800 transition-colors">
                <Label htmlFor="website" className="text-xs font-bold uppercase tracking-wider text-slate-500">Sitio Web / IP</Label>
                <Input id="website" value={website} onChange={e => setWebsite(e.target.value)} placeholder="Ej: router.local o https://..." className="bg-slate-50 dark:bg-zinc-900 border-none rounded-xl py-5 focus-visible:ring-green-500 shadow-inner" />
              </div>
              <div className="space-y-1.5 focus-within:text-green-800 transition-colors">
                <Label htmlFor="category" className="text-xs font-bold uppercase tracking-wider text-slate-500">Categoría</Label>
                <Input id="category" value={category} onChange={e => setCategory(e.target.value)} placeholder="Ej: Trabajo, WiFi, Suscripciones..." className="bg-slate-50 dark:bg-zinc-900 border-none rounded-xl py-5 focus-visible:ring-green-500 shadow-inner" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 focus-within:text-green-800 transition-colors">
                <Label htmlFor="device" className="text-xs font-bold uppercase tracking-wider text-slate-500">Dispositivo</Label>
                <Input id="device" value={device} onChange={e => setDevice(e.target.value)} placeholder="Ej: Cámara Xiaomi, Router..." className="bg-slate-50 dark:bg-zinc-900 border-none rounded-xl py-5 focus-visible:ring-green-500 shadow-inner" />
              </div>
              <div className="space-y-1.5 focus-within:text-green-800 transition-colors">
                <Label htmlFor="location" className="text-xs font-bold uppercase tracking-wider text-slate-500">Ubicación física</Label>
                <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Entrada balcón, Salón..." className="bg-slate-50 dark:bg-zinc-900 border-none rounded-xl py-5 focus-visible:ring-green-500 shadow-inner" />
              </div>
            </div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-black/50 border-t border-slate-100 dark:border-zinc-900 flex justify-end gap-3 rounded-b-[2rem]">
            <Button variant="ghost" className="rounded-xl px-6 hover:bg-slate-200/50" onClick={() => { setIsDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button className="rounded-xl px-8 bg-green-800 shadow-lg shadow-green-500/20" onClick={handleSavePassword}>Guardar Clave</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR PC MODAL */}
      <AnimatePresence>
        {showQrScreen && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-950 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center relative border border-white/10"
            >
              <button onClick={handleCloseQr} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">
                <X className="w-6 h-6" />
              </button>
              <div className="mb-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-800-950/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-green-800">
                  <QrCode className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">Accesibilidad Remota</h2>
                <div className="bg-slate-50 dark:bg-zinc-900 rounded-xl p-4 mt-4 text-left border border-slate-100 dark:border-zinc-800 shadow-inner">
                  <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 font-medium list-decimal list-inside">
                    <li>Abre <b>Claves</b> en tu móvil.</li>
                    <li>Desbloquea introduciendo tu contraseña.</li>
                    <li>Pulsa el botón <b>&quot;Escanear QR&quot;</b> de la cabecera e ilumina esta pantalla.</li>
                  </ol>
                </div>
              </div>

              <div className="bg-white p-4 rounded-3xl shadow-inner inline-block mb-6 border-4 border-slate-50">
                <QRCodeSVG value={`quioba-pass:${currentQrSession}`} size={200} level="H" />
              </div>

              <div className="flex items-center justify-center gap-2 text-green-800 text-sm font-bold animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Esperando al móvil...</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SCANNER MODAL */}
      <AnimatePresence>
        {isScanning && (
          <div className="fixed inset-0 z-[101] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white dark:bg-zinc-950 p-6 rounded-[2.5rem] shadow-2xl max-w-md w-full relative border border-white/5 overflow-hidden"
            >
              <div className="mb-4 text-center">
                <h3 className="text-xl font-bold">Escáner de Autorización</h3>
                <p className="text-slate-500 text-xs">Apunta al código QR generado en tu PC.</p>
              </div>

              <div className="aspect-square rounded-3xl overflow-hidden border-2 border-green-500/20 bg-black mb-4">
                <Scanner onScan={(result) => result[0]?.rawValue && handleScanSuccess(result[0].rawValue)} />
              </div>

              <Button variant="outline" className="w-full rounded-2xl py-6" onClick={() => setIsScanning(false)}>
                Cancelar Escaneo
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

