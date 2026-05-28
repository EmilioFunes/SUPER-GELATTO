import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ShoppingBag, IceCream, Trash2, Shield, Plus, RefreshCw, AlertTriangle } from 'lucide-react';

const AdminDashboard = ({ user }) => {
  const [dashboardData, setDashboardData] = useState({ stats: {}, users: [], sales: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('users');
  const [actionLoading, setActionLoading] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.rol !== 'admin') {
      navigate('/');
      return;
    }
    fetchDashboardData();
  }, [user, navigate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/dashboard`, {
        headers: {
          'X-User-Role': user?.rol || ''
        }
      });
      if (!res.ok) throw new Error('Error al obtener datos');
      const data = await res.json();
      
      // También obtenemos productos para la nueva pestaña
      const prodRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/products`);
      const products = await prodRes.json();
      
      setDashboardData({ ...data, products });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) return;
    
    setActionLoading(id);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          'X-User-Role': user?.rol || ''
        }
      });
      if (res.ok) {
        setDashboardData(prev => ({
          ...prev,
          users: prev.users.filter(u => u.id_usuario !== id),
          stats: { ...prev.stats, activeUsers: prev.stats.activeUsers - 1 }
        }));
      }
    } catch (err) {
      alert('Error al eliminar usuario');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;
    
    setActionLoading(id);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: {
          'X-User-Role': user?.rol || ''
        }
      });
      if (res.ok) {
        setDashboardData(prev => ({
          ...prev,
          products: prev.products.filter(p => p.id !== id)
        }));
      }
    } catch (err) {
      alert('Error al eliminar producto');
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <RefreshCw className="w-10 h-10 text-gold-premium animate-spin mb-4" />
      <p className="text-gold-premium font-light tracking-widest uppercase">Accediendo a la Terminal...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-2xl text-white mb-2">Falla Crítica del Sistema</h2>
      <p className="text-white/60 mb-6 max-w-md">{error}</p>
      <button onClick={() => window.location.reload()} className="px-8 py-3 bg-gold-premium text-black rounded-full hover:scale-105 transition-transform">
        Reintentar Conexión
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-20 px-6 font-sans selection:bg-gold-premium/30">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-3 text-gold-premium mb-2">
              <Shield size={20} />
              <span className="text-xs tracking-[0.3em] uppercase font-bold">Protocolo de Administración</span>
            </div>
            <h1 className="text-5xl font-extralight tracking-tight text-white mb-2">
              Super <span className="text-gold-premium font-normal">Gelatto</span> Dashboard
            </h1>
            <p className="text-white/40 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Sesión activa como <span className="text-white/80 font-medium">{user.name}</span>
            </p>
          </div>
          
          <div className="flex gap-4">
             <button onClick={fetchDashboardData} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
               <RefreshCw size={20} />
             </button>
          </div>
        </header>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { label: 'Ingresos Totales', value: formatCurrency(dashboardData.stats.totalRevenue), icon: ShoppingBag, color: 'text-gold-premium' },
            { label: 'Ventas Realizadas', value: dashboardData.stats.totalSales, icon: ShoppingBag, color: 'text-white' },
            { label: 'Clientes Registrados', value: dashboardData.stats.activeUsers, icon: Users, color: 'text-white' },
          ].map((stat, i) => (
            <div key={i} className="group relative bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 hover:border-gold-premium/30 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 p-8 text-white/5 group-hover:text-gold-premium/10 transition-colors duration-500">
                <stat.icon size={80} />
              </div>
              <h3 className="text-white/30 text-xs tracking-widest uppercase mb-4 font-bold">{stat.label}</h3>
              <p className={`text-4xl font-light ${stat.color} relative z-10 tracking-tighter`}>{stat.value}</p>
              <div className="mt-4 h-1 w-12 bg-gold-premium/20 group-hover:w-full transition-all duration-700"></div>
            </div>
          ))}
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white/5 p-1 rounded-2xl w-fit">
          {[
            { id: 'users', label: 'Usuarios', icon: Users },
            { id: 'sales', label: 'Ventas', icon: ShoppingBag },
            { id: 'products', label: 'Catálogo', icon: IceCream },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id 
                ? 'bg-gold-premium text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT AREA */}
        <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl shadow-2xl overflow-hidden min-h-[400px]">
          
          {activeTab === 'users' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 text-[10px] uppercase tracking-[0.2em] font-bold">
                    <th className="p-6">Identificador</th>
                    <th className="p-6">Usuario</th>
                    <th className="p-6">Correo Electrónico</th>
                    <th className="p-6">Rango / Rol</th>
                    <th className="p-6">Registro</th>
                    <th className="p-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dashboardData.users.map(u => (
                    <tr key={u.id_usuario} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-6 text-white/20 font-mono text-xs">#{u.id_usuario}</td>
                      <td className="p-6 font-medium">{u.nombre} {u.apellido}</td>
                      <td className="p-6 text-white/60">{u.email}</td>
                      <td className="p-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          u.rol === 'admin' 
                          ? 'bg-gold-premium/10 text-gold-premium border border-gold-premium/20' 
                          : 'bg-white/5 text-white/40'
                        }`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="p-6 text-white/40 text-sm">{formatDate(u.fecha_registro)}</td>
                      <td className="p-6 text-right">
                        {u.id_usuario !== user.id && (
                          <button 
                            disabled={actionLoading === u.id_usuario}
                            onClick={() => handleDeleteUser(u.id_usuario)}
                            className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            {actionLoading === u.id_usuario ? <RefreshCw className="animate-spin" size={18} /> : <Trash2 size={18} />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dashboardData.users.length === 0 && <div className="p-20 text-center text-white/20">No hay usuarios registrados</div>}
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 text-[10px] uppercase tracking-[0.2em] font-bold">
                    <th className="p-6">Orden</th>
                    <th className="p-6">Cliente ID</th>
                    <th className="p-6">Valor Total</th>
                    <th className="p-6">Timestamp</th>
                    <th className="p-6">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dashboardData.sales.map(s => (
                    <tr key={s.id_venta} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-6 text-white/20 font-mono text-xs">TRX-{s.id_venta}</td>
                      <td className="p-6 text-white/60 font-mono text-xs">USER-{s.id_usuario}</td>
                      <td className="p-6 font-bold text-white tracking-tight">{formatCurrency(s.total)}</td>
                      <td className="p-6 text-white/40 text-sm">{formatDate(s.fecha)}</td>
                      <td className="p-6">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-500 border border-green-500/20">
                          Completado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dashboardData.sales.length === 0 && <div className="p-20 text-center text-white/20">Sin registros de ventas</div>}
            </div>
          )}

          {activeTab === 'products' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 text-[10px] uppercase tracking-[0.2em] font-bold">
                    <th className="p-6">SKU</th>
                    <th className="p-6">Sabor / Producto</th>
                    <th className="p-6">Precio</th>
                    <th className="p-6">Categoría</th>
                    <th className="p-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dashboardData.products.map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-6 text-white/20 font-mono text-xs">PROD-{p.id}</td>
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                          <div>
                            <p className="font-medium text-white">{p.name}</p>
                            <p className="text-[10px] text-white/40 line-clamp-1 max-w-[200px]">{p.desc}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6 font-bold text-gold-premium tracking-tight">{formatCurrency(p.precio)}</td>
                      <td className="p-6">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-white/60">
                          {p.categoria || 'Artesanal'}
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <button 
                          disabled={actionLoading === p.id}
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          {actionLoading === p.id ? <RefreshCw className="animate-spin" size={18} /> : <Trash2 size={18} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dashboardData.products.length === 0 && <div className="p-20 text-center text-white/20">No hay productos en el catálogo</div>}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
