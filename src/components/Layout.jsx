import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Gem, ChevronDown, User, Menu, X } from 'lucide-react';

const Layout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleMenu = () => setMobileMenuOpen(!mobileMenuOpen);

    const closeMenu = () => setMobileMenuOpen(false);

    return (
        <div className="app-container">
            <header className="top-nav">
                <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Gem size={20} color="#C9972A" />
                    Bindu Jewellery
                </div>
                
                {/* Mobile Menu Toggle */}
                <div className="mobile-menu-toggle" style={{ display: 'none' }} onClick={toggleMenu}>
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </div>
                
                <nav className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
                    <NavLink to="/" onClick={closeMenu} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} end>
                        Insights
                    </NavLink>
                    <NavLink to="/leads" onClick={closeMenu} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        Leads
                    </NavLink>
                    <NavLink to="/customers" onClick={closeMenu} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        Unified Profiles
                    </NavLink>
                    <NavLink to="/calls" onClick={closeMenu} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        Calls
                    </NavLink>
                    <NavLink to="/sales" onClick={closeMenu} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        Sales
                    </NavLink>
                    {user?.role !== 'owner' && user?.role !== 'admin' && (
                    <NavLink to="/campaigns" onClick={closeMenu} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        Campaigns
                    </NavLink>
                    )}
                    {user?.role === 'owner' && (
                        <>
                            <NavLink to="/team" onClick={closeMenu} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                                Team
                            </NavLink>
                            <NavLink to="/branches" onClick={closeMenu} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                                Branches
                            </NavLink>
                            <NavLink to="/attendance" onClick={closeMenu} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                                Attendance
                            </NavLink>
                            <NavLink to="/field-visits" onClick={closeMenu} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                                Field Visits
                            </NavLink>
                        </>
                    )}
                </nav>

                <Link to="/profile" className="nav-user">
                    <div className="avatar">
                        <User size={16} color="var(--text-muted)" />
                    </div>
                    {user?.full_name || 'Admin'}
                    <ChevronDown size={14} color="var(--text-muted)" />
                </Link>
            </header>

            <main className="main-content">
                <Outlet />
            </main>

            <style>{`
                @media (max-width: 1024px) {
                    .nav-links {
                        flex-wrap: wrap;
                        justify-content: center;
                    }
                }
                @media (max-width: 768px) {
                    .top-nav {
                        flex-wrap: wrap;
                        padding: 1rem;
                    }
                    .mobile-menu-toggle {
                        display: block !important;
                        cursor: pointer;
                    }
                    .nav-links {
                        display: none;
                        width: 100%;
                        flex-direction: column;
                        background: var(--bg-card);
                        border-radius: 12px;
                        margin-top: 1rem;
                        padding: 1rem;
                    }
                    .nav-links.mobile-open {
                        display: flex;
                    }
                    .nav-item {
                        width: 100%;
                        text-align: center;
                        padding: 0.75rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default Layout;
