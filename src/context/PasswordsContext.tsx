'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import PBKDF2 from 'crypto-js/pbkdf2';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { toast } from 'sonner';

// 1. Definir la estructura de una contraseña
export interface Password {
  id: string;
  name: string;
  username: string;
  passwordHash: string; // Contraseña cifrada
  website?: string;
  category: string;
  device?: string;
  location?: string;
  createdAt: string;
}

export type PasswordInput = Omit<Password, 'id' | 'createdAt' | 'passwordHash'> & { password: string };

// 2. Definir el contexto
interface PasswordsContextType {
  passwords: Password[];
  loading: boolean;
  isLocked: boolean;
  unlock: (masterPassword: string) => Promise<boolean>;
  lock: () => void;
  addPassword: (data: PasswordInput) => Promise<void>;
  updatePassword: (id: string, data: PasswordInput) => Promise<void>;
  deletePassword: (id: string) => Promise<void>;
  decryptPassword: (hash: string) => string;
  importPasswords: (passwords: Password[]) => Promise<void>;
  biometricsAvailable: boolean;
  isBiometricsEnabled: boolean;
  enableBiometrics: () => Promise<void>;
  disableBiometrics: () => void;
  unlockWithBiometrics: () => Promise<boolean>;
  generateQrSession: () => string;
  authorizeQrSession: (sessionId: string) => Promise<void>;
  checkQrSession: (sessionId: string) => Promise<boolean>;

  // MFA (Multifactor Authentication Mandatory)
  mfaRequired: boolean;
  completeMfaUnlock: () => void;
  cancelMfaUnlock: () => void;
}

const PasswordsContext = createContext<PasswordsContextType | undefined>(undefined);

// 3. Crear el proveedor de contexto
export function PasswordsProvider({ children }: { children: React.ReactNode }) {
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(true);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);
  const { user } = useAuth();

  // MFA States
  const [mfaRequired, setMfaRequired] = useState(false);
  const [pendingMfaKey, setPendingMfaKey] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchPasswords();
      checkBiometrics();
    } else {
      setPasswords([]);
      setLoading(false);
      setIsLocked(true);
      setEncryptionKey(null);
      setIsBiometricsEnabled(false);
    }
  }, [user]);

  const checkBiometrics = async () => {
    const isAvailable = !!(window.PublicKeyCredential);
    setBiometricsAvailable(isAvailable);

    if (user) {
      const enabled = localStorage.getItem(`passwords_bio_enabled_${user.id}`) === 'true';
      setIsBiometricsEnabled(enabled);
    }
  };

  const deriveKey = (masterPassword: string, salt: string) => {
    // PBKDF2 key derivation
    // 1000 iterations, 256-bit key
    const derived = PBKDF2(masterPassword, salt, {
      keySize: 256 / 32,
      iterations: 1000
    });
    return derived.toString();
  };

  const unlock = async (masterPassword: string) => {
    if (!user) return false;
    try {
      // Derive key using user ID as salt
      const key = deriveKey(masterPassword, user.id);
      setPendingMfaKey(key);
      setMfaRequired(true);
      return true;
    } catch (e) {
      console.error('Error unlocking:', e);
      return false;
    }
  };

  const completeMfaUnlock = () => {
    if (pendingMfaKey) {
      setEncryptionKey(pendingMfaKey);
      setIsLocked(false);
      setMfaRequired(false);
      setPendingMfaKey(null);
    }
  };

  const cancelMfaUnlock = () => {
    setPendingMfaKey(null);
    setMfaRequired(false);
    setIsLocked(true);
  };

  const lock = () => {
    setIsLocked(true);
    setEncryptionKey(null);
    setMfaRequired(false);
    setPendingMfaKey(null);
  };

  const enableBiometrics = async () => {
    if (!user || !encryptionKey) return;

    try {
      if (!window.PublicKeyCredential) {
        toast.error('Este dispositivo no soporta biometría web');
        return;
      }

      // 1. Forzamos un diálogo de creación de credencial WebAuthn (TouchID/FaceID/Windows Hello)
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: "Quioba Vault", id: window.location.hostname },
          user: {
            id: userId,
            name: user.email || 'user',
            displayName: user.email || 'user'
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Requerimos huella integrada en el dispositivo
            requireResidentKey: true, // Para navegadores antiguos
            residentKey: "required", // Permite leer la llave sin tener que rastrear el ID (Discoverable Credential)
            userVerification: "required" // Obliga al SO a pedir la huella sí o sí
          },
          timeout: 60000,
        }
      });

      // 2. Si el SO nos dio el OK (el usuario puso la huella con éxito para crear la llave), guardamos
      localStorage.setItem(`passwords_bio_enabled_${user.id}`, 'true');
      localStorage.setItem(`passwords_bio_key_${user.id}`, encryptionKey);
      setIsBiometricsEnabled(true);
      toast.success('Bóveda vinculada a tu huella digital');
    } catch (e) {
      console.error('Error Biometría:', e);
      toast.error('Operación biométrica cancelada o fallida');
    }
  };

  const disableBiometrics = () => {
    if (!user) return;
    localStorage.removeItem(`passwords_bio_enabled_${user.id}`);
    localStorage.removeItem(`passwords_bio_key_${user.id}`);
    setIsBiometricsEnabled(false);
    toast.info('Biometría desactivada');
  };

  const unlockWithBiometrics = async () => {
    if (!user || !biometricsAvailable || !isBiometricsEnabled) return false;

    try {
      const storedKey = localStorage.getItem(`passwords_bio_key_${user.id}`);
      if (!storedKey) return false;

      // 3. Forzamos un diálogo de obtención de credencial (TouchID/FaceID/Windows Hello)
      if (window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        await navigator.credentials.get({
          publicKey: {
            challenge: challenge,
            rpId: window.location.hostname,
            userVerification: "required" // Obliga al SO a pedir la huella al sacar el dato
          }
        });

        // 4. Solo llegamos aquí si la huella fue correcta
        setEncryptionKey(storedKey);
        setIsLocked(false);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Bio unlock error:', e);
      return false;
    }
  };

  const generateQrSession = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const authorizeQrSession = async (sessionId: string) => {
    if (!user || !encryptionKey) return;

    try {
      // Usamos una tabla 'session_auth' en Supabase como buzón temporal
      // El móvil deposita la llave (encriptada o directa si es canal seguro)
      const { error } = await supabase
        .from('session_auth')
        .insert([{ id: sessionId, user_id: user.id, encrypted_key: encryptionKey, expires_at: new Date(Date.now() + 60000).toISOString() }]);

      if (error) throw error;
      toast.success('Entrada autorizada');
    } catch (e) {
      console.error('Error al autorizar QR:', e);
      toast.error('Error al autorizar sesión');
    }
  };

  const checkQrSession = async (sessionId: string) => {
    if (!user) return false;
    try {
      const { data, error } = await supabase
        .from('session_auth')
        .select('encrypted_key')
        .eq('id', sessionId)
        .single();

      if (error || !data) return false;

      // El PC recibe la llave
      setEncryptionKey(data.encrypted_key);
      setIsLocked(false);

      // Limpiar estados de MFA por si estábamos esperando la certificación cruzada
      setMfaRequired(false);
      setPendingMfaKey(null);

      // Limpiar el puente
      await supabase.from('session_auth').delete().eq('id', sessionId);

      toast.success('Bóveda desbloqueada vía móvil');
      return true;
    } catch (e) {
      return false;
    }
  };

  const fetchPasswords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('passwords')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map Supabase fields to Password interface
      const mappedPasswords: Password[] = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        username: item.username || '',
        passwordHash: item.password_hash,
        website: item.website,
        category: item.category || '',
        device: item.device,
        location: item.location,
        createdAt: item.created_at,
      }));

      setPasswords(mappedPasswords);
    } catch (error) {
      console.error('Error fetching passwords:', error);
      toast.error('Error al cargar las contraseñas');
    } finally {
      setLoading(false);
    }
  };

  const addPassword = async (data: PasswordInput) => {
    if (!user || !encryptionKey) {
      toast.error('La bóveda está bloqueada');
      return;
    }

    const passwordHash = AES.encrypt(data.password, encryptionKey).toString();

    try {
      const { data: newPassword, error } = await supabase
        .from('passwords')
        .insert([
          {
            user_id: user.id,
            name: data.name,
            username: data.username,
            password_hash: passwordHash,
            website: data.website,
            category: data.category,
            device: data.device,
            location: data.location,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      const mappedPassword: Password = {
        id: newPassword.id,
        name: newPassword.name,
        username: newPassword.username || '',
        passwordHash: newPassword.password_hash,
        website: newPassword.website,
        category: newPassword.category || '',
        device: newPassword.device,
        location: newPassword.location,
        createdAt: newPassword.created_at,
      };

      setPasswords([mappedPassword, ...passwords]);
      toast.success('Contraseña guardada cifrada');
    } catch (error) {
      console.error('Error adding password:', error);
      toast.error('Error al guardar la contraseña');
      throw error;
    }
  };

  const updatePassword = async (id: string, data: PasswordInput) => {
    if (!encryptionKey) {
      toast.error('La bóveda está bloqueada');
      return;
    }

    const passwordHash = AES.encrypt(data.password, encryptionKey).toString();

    try {
      const { error } = await supabase
        .from('passwords')
        .update({
          name: data.name,
          username: data.username,
          password_hash: passwordHash,
          website: data.website,
          category: data.category,
          device: data.device,
          location: data.location,
        })
        .eq('id', id);

      if (error) throw error;

      setPasswords(passwords.map(p =>
        p.id === id
          ? {
            ...p,
            ...data,
            passwordHash,
          }
          : p
      ));
      toast.success('Contraseña actualizada');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Error al actualizar la contraseña');
      throw error;
    }
  };

  const deletePassword = async (id: string) => {
    try {
      const { error } = await supabase
        .from('passwords')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPasswords(passwords.filter(p => p.id !== id));
      toast.success('Contraseña eliminada');
    } catch (error) {
      console.error('Error deleting password:', error);
      toast.error('Error al eliminar la contraseña');
      throw error;
    }
  };

  const importPasswords = async (importedPasswords: Password[]) => {
    if (!user) return;

    try {
      const passwordsToInsert = importedPasswords.map(p => ({
        user_id: user.id,
        name: p.name,
        username: p.username,
        password_hash: p.passwordHash,
        website: p.website,
        category: p.category,
        device: p.device,
        location: p.location,
      }));

      const { data, error } = await supabase
        .from('passwords')
        .insert(passwordsToInsert)
        .select();

      if (error) throw error;

      fetchPasswords();
      toast.success('Contraseñas importadas');
    } catch (error) {
      console.error('Error importing passwords:', error);
      toast.error('Error al importar contraseñas');
      throw error;
    }
  };

  const decryptPassword = (hash: string) => {
    if (!encryptionKey) return '';
    try {
      const bytes = AES.decrypt(hash, encryptionKey);
      return bytes.toString(Utf8);
    } catch (e) {
      return '';
    }
  };

  const value = {
    passwords,
    loading,
    isLocked,
    unlock,
    lock,
    addPassword,
    updatePassword,
    deletePassword,
    decryptPassword,
    importPasswords,
    biometricsAvailable,
    isBiometricsEnabled,
    enableBiometrics,
    disableBiometrics,
    unlockWithBiometrics,
    generateQrSession,
    authorizeQrSession,
    checkQrSession,
    mfaRequired,
    completeMfaUnlock,
    cancelMfaUnlock,
  };

  return <PasswordsContext.Provider value={value}>{children}</PasswordsContext.Provider>;
}

// 4. Hook para usar el contexto
export function usePasswords() {
  const context = useContext(PasswordsContext);
  if (context === undefined) {
    throw new Error('usePasswords must be used within a PasswordsProvider');
  }
  return context;
}
