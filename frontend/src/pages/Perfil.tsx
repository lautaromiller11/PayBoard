import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import WhatsAppConfig from '../components/WhatsAppConfig';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function Perfil() {
    const { token, user } = useAuth();
    const [phone, setPhone] = useState('');
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        async function fetchConfig() {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`${API_BASE}/auth/user/config`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error('No se pudo cargar la configuración');
                const data = await res.json();
                setPhone(data.phoneNumber || '');
                setEnabled(!!data.whatsappAlertsEnabled);
            } catch (err) {
                setError('Error al cargar configuración');
            } finally {
                setLoading(false);
            }
        }
        if (token) fetchConfig();
    }, [token]);

    async function handleSave(phoneValue: string, enabledValue: boolean) {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const res = await fetch(`${API_BASE}/auth/user/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ phoneNumber: phoneValue, whatsappAlertsEnabled: enabledValue }),
            });
            if (!res.ok) throw new Error('No se pudo guardar la configuración');
            setSuccess('Configuración guardada correctamente');
            setPhone(phoneValue);
            setEnabled(enabledValue);
        } catch (err) {
            setError('Error al guardar configuración');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Layout>
            <div className="max-w-xl mx-auto py-10">
                <h1 className="text-2xl font-bold mb-6">Perfil de Usuario</h1>
                {loading ? (
                    <div className="text-gray-500">Cargando...</div>
                ) : (
                    <WhatsAppConfig initialPhone={phone} initialEnabled={enabled} onSave={handleSave} />
                )}
                {success && <div className="text-green-600 mt-2">{success}</div>}
                {error && <div className="text-red-600 mt-2">{error}</div>}
            </div>
        </Layout>
    );
}
