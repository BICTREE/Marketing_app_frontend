import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Gem, Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, user } = useAuth();
    const navigate = useNavigate();

    if (user) {
        return <Navigate to="/" />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            toast.success('Login successful!');
            navigate('/');
        } catch (error) {
            console.error('Login error', error);
            toast.error(error.response?.data?.detail || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'var(--bg-main)'
        }}>
            <div className="card animate-fade-in" style={{
                width: '100%',
                maxWidth: '400px',
                padding: '3rem 2rem',
                textAlign: 'center'
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <img src="/logo-gold.png" alt="Bindu Jewellery Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                </div>
                
                <h1 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>Bindu Jewellery</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.85rem' }}>Sign in to your CRM dashboard</p>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ position: 'relative' }}>
                        <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)' }} />
                        <input 
                            type="email" 
                            style={{ 
                                width: '100%', 
                                background: 'var(--bg-main)', 
                                border: '1px solid var(--border-color)', 
                                color: 'var(--text-main)', 
                                padding: '0.75rem 1rem 0.75rem 2.75rem', 
                                borderRadius: '12px',
                                fontSize: '0.85rem'
                            }}
                            placeholder="Email address" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div style={{ position: 'relative' }}>
                        <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)' }} />
                        <input 
                            type="password" 
                            style={{ 
                                width: '100%', 
                                background: 'var(--bg-main)', 
                                border: '1px solid var(--border-color)', 
                                color: 'var(--text-main)', 
                                padding: '0.75rem 1rem 0.75rem 2.75rem', 
                                borderRadius: '12px',
                                fontSize: '0.85rem'
                            }}
                            placeholder="Password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    
                    <button type="submit" disabled={loading} style={{ 
                        marginTop: '0.5rem',
                        background: 'var(--text-main)',
                        color: 'var(--text-dark)',
                        border: 'none',
                        padding: '0.75rem',
                        borderRadius: '12px',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer'
                    }}>
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
