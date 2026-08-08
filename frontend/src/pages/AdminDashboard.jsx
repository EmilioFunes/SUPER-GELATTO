import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, ShoppingBag, IceCream, Trash2, Shield, Plus, 
  RefreshCw, AlertTriangle, Box, Sparkles, Key, CheckCircle, 
  X, Camera, Loader2, ArrowRight, Star, Image, Upload, Eye,
  Mail, Receipt
} from 'lucide-react';
import Model3DPreview from '../components/Model3DPreview';
import CapturaFacial from '../components/CapturaFacial';
import { apiFetch } from '../utils/api';

const AdminDashboard = ({ user, onLogout }) => {
  const [dashboardData, setDashboardData] = useState({ stats: {}, users: [], sales: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('users');
  const [actionLoading, setActionLoading] = useState(null);
  const navigate = useNavigate();

  // --- Verificación de Admin: Si ya está autenticado como admin, acceso directo sin re-verificación ---
  const [isQrVerified, setIsQrVerified] = useState(() => {
    // Si el usuario tiene rol admin, considerarlo siempre verificado (ya autenticó en login)
    return true;
  });
  const [userToDelete, setUserToDelete] = useState(null);
  // --- New Admin Form States ---
  const [newAdminForm, setNewAdminForm] = useState({ name: '', lastName: '', email: '', password: '' });
  const [createAdminLoading, setCreateAdminLoading] = useState(false);
  const [createAdminMsg, setCreateAdminMsg] = useState({ type: '', text: '' });

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setCreateAdminMsg({ type: '', text: '' });
    if (!newAdminForm.name || !newAdminForm.email || !newAdminForm.password) {
      setCreateAdminMsg({ type: 'error', text: 'Nombre, correo y contraseña son obligatorios.' });
      return;
    }

    try {
      setCreateAdminLoading(true);
      const res = await apiFetch('/api/admin/create-admin', {
        method: 'POST',
        body: JSON.stringify(newAdminForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al crear administrador.');

      setCreateAdminMsg({ type: 'success', text: '¡Administrador registrado con éxito!' });
      setNewAdminForm({ name: '', lastName: '', email: '', password: '' });
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      setCreateAdminMsg({ type: 'error', text: err.message || 'Ocurrió un error al registrar el administrador.' });
    } finally {
      setCreateAdminLoading(false);
    }
  };

  // --- AWS Rekognition Facial States ---
  const [showCapturaFacialModal, setShowCapturaFacialModal] = useState(false);
  const [rekognitionMsg, setRekognitionMsg] = useState({ type: '', text: '' });
  const [rekognitionLoading, setRekognitionLoading] = useState(false);

  const handleRekognitionRegister = async (base64Image) => {
    setShowCapturaFacialModal(false);
    setRekognitionLoading(true);
    setRekognitionMsg({ type: 'info', text: 'Enviando imagen a AWS Rekognition para indexación...' });

    try {
      const res = await apiFetch('/api/admin/faceid/rekognition-register', {
        method: 'POST',
        body: JSON.stringify({ image: base64Image })
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'Error al registrar rostro en AWS Rekognition.');
      }

      setRekognitionMsg({
        type: 'success',
        text: data.message || '¡Reconocimiento facial registrado exitosamente con AWS Rekognition!'
      });
    } catch (err) {
      console.error('Error registrando rostro:', err);
      setRekognitionMsg({
        type: 'error',
        text: err.message || 'Ocurrió un error al registrar el reconocimiento facial en AWS Rekognition.'
      });
    } finally {
      setRekognitionLoading(false);
    }
  };

  // --- Tripo 3D Generator States ---
  const [newProduct, setNewProduct] = useState({ nombre: '', descripcion: '', precio: '', categoria: 'Clásico', prompt3d: '' });
  const [generatingProduct, setGeneratingProduct] = useState(null);
  const [generatingStatus, setGeneratingStatus] = useState('idle'); // 'idle', 'enviando', 'generando', 'listo', 'error'
  const [generatedModel, setGeneratedModel] = useState(null);
  const pollIntervalRef = useRef(null);

  // --- 3D Modal States ---
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productModel, setProductModel] = useState(null);
  const [loadingModel, setLoadingModel] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [regenStatus, setRegenStatus] = useState('idle'); // 'idle', 'generando', 'listo', 'error'

  // --- Product Image Management States ---
  const [imageModalProduct, setImageModalProduct] = useState(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageSaving, setImageSaving] = useState(false);
  const [imageMsg, setImageMsg] = useState({ type: '', text: '' });

  // --- Featured Products States ---
  const [togglingFeatured, setTogglingFeatured] = useState(null);

  // --- Create Product States ---
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [createProductForm, setCreateProductForm] = useState({
    name: '',
    price: '',
    category: 'Clásico',
    description: '',
    image: '',
    featured: false,
    stock: 50
  });
  const [createProductLoading, setCreateProductLoading] = useState(false);
  const [createProductMsg, setCreateProductMsg] = useState({ type: '', text: '' });

  // --- Update Category State ---
  const [updatingCategory, setUpdatingCategory] = useState(null);

  const handleUpdateCategory = async (productId, newCategory) => {
    setUpdatingCategory(productId);
    // Optimistic update
    setDashboardData(prev => ({
      ...prev,
      products: prev.products.map(p => String(p.id) === String(productId) ? { ...p, categoria: newCategory } : p)
    }));
    try {
      await apiFetch(`/api/admin/products/${productId}/category`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: newCategory })
      });
    } catch (err) {
      console.error('Error actualizando categoría:', err);
    } finally {
      setUpdatingCategory(null);
    }
  };

  // --- Update Price State ---
  const [editingPrice, setEditingPrice] = useState(null); // { id, value }
  const [updatingPrice, setUpdatingPrice] = useState(null);
  
  // --- Update Stock State ---
  const [editingStock, setEditingStock] = useState(null); // { id, value }
  const [updatingStock, setUpdatingStock] = useState(null);

  const handleSaveStock = async (productId, newStockValue) => {
    const numStock = parseInt(newStockValue, 10);
    if (isNaN(numStock) || numStock < 0) {
      alert('El stock disponible debe ser un número entero mayor o igual a 0.');
      setEditingStock(null);
      return;
    }

    setUpdatingStock(productId);
    setEditingStock(null);

    // Actualización optimista de la UI
    setDashboardData(prev => ({
      ...prev,
      products: (prev.products || []).map(p => String(p.id) === String(productId) ? { ...p, stock: numStock } : p)
    }));

    try {
      const res = await apiFetch(`/api/admin/products/${productId}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: numStock })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Error al actualizar el stock disponible.');
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Error actualizando stock:', err);
      alert('Error de conexión al actualizar el stock disponible.');
      fetchDashboardData();
    } finally {
      setUpdatingStock(null);
    }
  };

  const handleStepStock = (productId, currentStock, delta) => {
    const stockVal = currentStock !== undefined && currentStock !== null ? Number(currentStock) : 50;
    const newStock = Math.max(0, stockVal + delta);
    handleSaveStock(productId, newStock);
  };

  const [updatingSaleStatus, setUpdatingSaleStatus] = useState(null);

  const handleUpdateSaleStatus = async (saleId, newStatus) => {
    setUpdatingSaleStatus(saleId);
    setDashboardData(prev => ({
      ...prev,
      sales: (prev.sales || []).map(s => String(s.id_venta) === String(saleId) ? { ...s, estado: newStatus } : s)
    }));
    try {
      const res = await apiFetch(`/api/admin/sales/${saleId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: newStatus })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Error al cambiar el estado de la venta.');
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Error al actualizar estado de la venta:', err);
      alert('Error de conexión al actualizar el estado de la venta.');
      fetchDashboardData();
    } finally {
      setUpdatingSaleStatus(null);
    }
  };

  const handleSavePrice = async (productId) => {
    if (!editingPrice || String(editingPrice.id) !== String(productId)) return;
    const newPrice = parseInt(editingPrice.value, 10);
    if (!newPrice || newPrice <= 0) { setEditingPrice(null); return; }
    setUpdatingPrice(productId);
    // Optimistic update
    setDashboardData(prev => ({
      ...prev,
      products: prev.products.map(p => String(p.id) === String(productId) ? { ...p, precio: newPrice, price: newPrice } : p)
    }));
    setEditingPrice(null);
    try {
      await apiFetch(`/api/admin/products/${productId}/price`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ precio: newPrice })
      });
    } catch (err) {
      console.error('Error actualizando precio:', err);
    } finally {
      setUpdatingPrice(null);
    }
  };

  const handleCreateNewProduct = async (e) => {
    e.preventDefault();
    if (!createProductForm.name || !createProductForm.price) {
      setCreateProductMsg({ type: 'error', text: 'El nombre y el precio son obligatorios.' });
      return;
    }
    setCreateProductLoading(true);
    setCreateProductMsg({ type: '', text: '' });
    try {
      const res = await apiFetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createProductForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al crear el producto.');

      setDashboardData(prev => ({
        ...prev,
        products: [data.product, ...prev.products]
      }));

      setCreateProductMsg({ type: 'success', text: '¡Producto agregado con éxito!' });
      setTimeout(() => {
        setShowAddProductModal(false);
        setCreateProductForm({
          name: '',
          price: '',
          category: 'Clásico',
          description: '',
          image: '',
          featured: false,
          stock: 50
        });
        setCreateProductMsg({ type: '', text: '' });
      }, 900);
    } catch (err) {
      setCreateProductMsg({ type: 'error', text: err.message || 'Error al crear el producto.' });
    } finally {
      setCreateProductLoading(false);
    }
  };

  const handleAddProductFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setCreateProductMsg({ type: 'error', text: 'La imagen excede 4MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setCreateProductForm(prev => ({ ...prev, image: reader.result }));
      setCreateProductMsg({ type: '', text: '' });
    };
    reader.readAsDataURL(file);
  };

  const handleOpenImageModal = (product) => {
    setImageModalProduct(product);
    setImageUrlInput(product.image || '');
    setImageMsg({ type: '', text: '' });
  };

  const handleSaveProductImage = async (e) => {
    e.preventDefault();
    if (!imageModalProduct || !imageUrlInput) return;
    setImageSaving(true);
    setImageMsg({ type: '', text: '' });
    try {
      const res = await apiFetch(`/api/admin/products/${imageModalProduct.id}/image`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageUrlInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al actualizar la imagen.');

      setDashboardData(prev => ({
        ...prev,
        products: prev.products.map(p => String(p.id) === String(imageModalProduct.id) ? { ...p, image: imageUrlInput } : p)
      }));

      setImageMsg({ type: 'success', text: '¡Imagen actualizada con éxito!' });
      setTimeout(() => {
        setImageModalProduct(null);
      }, 900);
    } catch (err) {
      setImageMsg({ type: 'error', text: err.message || 'Error al guardar la imagen.' });
    } finally {
      setImageSaving(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setImageMsg({ type: 'error', text: 'La imagen excede 4MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrlInput(reader.result);
      setImageMsg({ type: '', text: '' });
    };
    reader.readAsDataURL(file);
  };

  const handleToggleFeatured = async (productId, currentStatus) => {
    const nextStatus = !currentStatus;
    setTogglingFeatured(productId);

    // Actualización optimista e INSTANTÁNEA en la interfaz
    setDashboardData(prev => ({
      ...prev,
      products: prev.products.map(p => String(p.id) === String(productId) ? { ...p, destacado: nextStatus } : p)
    }));
    try {
      localStorage.setItem('supergelatto_products_updated', Date.now().toString());
    } catch (e) {}

    try {
      const res = await apiFetch(`/api/admin/products/${productId}/featured`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destacado: nextStatus })
      });
      if (!res.ok) {
        // Revertir si el servidor reporta error
        setDashboardData(prev => ({
          ...prev,
          products: prev.products.map(p => String(p.id) === String(productId) ? { ...p, destacado: currentStatus } : p)
        }));
        const data = await res.json();
        alert(data.message || 'Error al cambiar estado destacado.');
      }
    } catch (err) {
      console.error(err);
      // Revertir
      setDashboardData(prev => ({
        ...prev,
        products: prev.products.map(p => String(p.id) === String(productId) ? { ...p, destacado: currentStatus } : p)
      }));
      alert('Error de conexión al actualizar estado destacado.');
    } finally {
      setTogglingFeatured(null);
    }
  };

  useEffect(() => {
    if (!user || user.rol !== 'admin') {
      navigate('/');
      return;
    }
    
    fetchDashboardData();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [user, navigate]);

  // Actualizar la fecha de última actividad de la sesión facial
  useEffect(() => {
    if (isQrVerified) {
      const updateActivity = () => {
        sessionStorage.setItem('superGelatto_face_verified_at', Date.now().toString());
      };
      
      // Registrar eventos de actividad del usuario
      window.addEventListener('click', updateActivity);
      window.addEventListener('keypress', updateActivity);
      
      return () => {
        window.removeEventListener('click', updateActivity);
        window.removeEventListener('keypress', updateActivity);
      };
    }
  }, [isQrVerified]);

  const handleFaceSuccess = () => {
    setIsQrVerified(true);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/dashboard');
      
      if (res.status === 401) {
        // La sesión facial expiró en el servidor
        sessionStorage.removeItem('superGelatto_face_verified');
        setIsQrVerified(false);
        throw new Error('Sesión de verificación QR expirada.');
      }
      
      if (!res.ok) throw new Error('Error al obtener datos');
      const data = await res.json();
      
      // Obtener productos
      const prodRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/products`);
      const products = await prodRes.json();
      
      setDashboardData({ ...data, products });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (userObj) => {
    setUserToDelete(userObj);
  };

  const executeDeleteUser = async () => {
    if (!userToDelete) return;
    const id = userToDelete.id_usuario || userToDelete.id;
    
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/admin/users/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDashboardData(prev => ({
          ...prev,
          users: prev.users.filter(u => String(u.id_usuario || u.id) !== String(id)),
          stats: { ...prev.stats, activeUsers: Math.max(0, (prev.stats?.activeUsers || 0) - 1) }
        }));
        setUserToDelete(null);
      } else {
        alert(data.message || `Error al eliminar usuario (${res.status})`);
        if (res.status === 401) {
          setIsQrVerified(false);
        }
      }
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      alert('Error de conexión al intentar eliminar usuario.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    setActionLoading(`role-${userId}`);
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: newRole })
      });
      if (res.ok) {
        setDashboardData(prev => ({
          ...prev,
          users: prev.users.map(u => {
            const uid = u.id_usuario || u.id;
            return String(uid) === String(userId) ? { ...u, rol: newRole } : u;
          })
        }));
      } else {
        const data = await res.json();
        alert(data.message || 'Error al cambiar el rol.');
      }
    } catch (err) {
      console.error('Error al cambiar rol:', err);
      alert('Error de conexión al cambiar el rol.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;
    
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/admin/products/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDashboardData(prev => ({
          ...prev,
          products: prev.products.filter(p => p.id !== id)
        }));
      } else if (res.status === 401) {
        setIsQrVerified(false);
      }
    } catch (err) {
      alert('Error al eliminar producto');
    } finally {
      setActionLoading(null);
    }
  };



  // Crear producto y disparar Tripo AI
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.nombre || !newProduct.precio || !newProduct.categoria) {
      alert('Por favor completa los campos requeridos.');
      return;
    }

    setGeneratingStatus('enviando');
    setGeneratedModel(null);

    try {
      const res = await apiFetch('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          nombre: newProduct.nombre,
          descripcion: newProduct.descripcion,
          precio: newProduct.precio,
          categoria: newProduct.categoria,
          prompt_usado: newProduct.prompt3d
        })
      });

      if (res.status === 401) {
        setIsQrVerified(false);
        return;
      }

      const data = await res.json();

      if (res.ok) {
        setGeneratingProduct(data.product);
        
        if (data.model) {
          setGeneratingStatus('generando');
          // Comenzar polling de estado del modelo 3D
          startPolling(data.product.id);
        } else {
          setGeneratingStatus('idle');
          alert('Producto guardado correctamente (sin modelo 3D).');
          setNewProduct({ nombre: '', descripcion: '', precio: '', categoria: 'Clásico', prompt3d: '' });
          fetchDashboardData();
        }
      } else {
        alert(data.message || 'Error al crear producto.');
        setGeneratingStatus('idle');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
      setGeneratingStatus('idle');
    }
  };

  // Polling para chequear si el modelo 3D está listo
  const startPolling = (productId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    let attempts = 0;
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 50) { // Timeout de 2.5 minutos
        clearInterval(pollIntervalRef.current);
        setGeneratingStatus('error');
        return;
      }

      try {
        const res = await apiFetch(`/api/admin/products/${productId}/model-3d`);
        if (res.ok) {
          const model = await res.json();
          if (model) {
            if (model.estado === 'listo') {
              clearInterval(pollIntervalRef.current);
              setGeneratedModel(model);
              setGeneratingStatus('listo');
              setNewProduct({ nombre: '', descripcion: '', precio: '', categoria: 'Clásico', prompt3d: '' });
              fetchDashboardData();
            } else if (model.estado === 'error') {
              clearInterval(pollIntervalRef.current);
              setGeneratingStatus('error');
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);
  };

  // Abrir visor 3D para un producto del catálogo
  const handleOpen3DModal = async (product) => {
    setSelectedProduct(product);
    setProductModel(null);
    setLoadingModel(true);
    setRegenPrompt('');
    setRegenStatus('idle');

    try {
      const res = await apiFetch(`/api/admin/products/${product.id}/model-3d`);
      if (res.ok) {
        const model = await res.json();
        setProductModel(model);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingModel(false);
    }
  };

  // Regenerar modelo 3D
  const handleRegenerate3D = async () => {
    if (!regenPrompt.trim()) return;

    setRegenStatus('generando');
    try {
      const res = await apiFetch(`/api/admin/products/${selectedProduct.id}/regenerate-3d`, {
        method: 'POST',
        body: JSON.stringify({ prompt: regenPrompt })
      });

      if (res.status === 401) {
        setIsQrVerified(false);
        return;
      }

      const data = await res.json();
      if (res.ok) {
        // Iniciar polling para este producto
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          if (attempts > 50) {
            clearInterval(interval);
            setRegenStatus('error');
            return;
          }

          const modelRes = await apiFetch(`/api/admin/products/${selectedProduct.id}/model-3d`);
          if (modelRes.ok) {
            const updatedModel = await modelRes.json();
            if (updatedModel && updatedModel.estado === 'listo') {
              clearInterval(interval);
              setProductModel(updatedModel);
              setRegenStatus('listo');
              fetchDashboardData();
            } else if (updatedModel && updatedModel.estado === 'error') {
              clearInterval(interval);
              setRegenStatus('error');
            }
          }
        }, 3000);
      } else {
        alert(data.message || 'Error al iniciar regeneración.');
        setRegenStatus('error');
      }
    } catch (err) {
      console.error(err);
      setRegenStatus('error');
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

  // --- RENDER SCREEN GATES ---

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <RefreshCw className="w-10 h-10 text-gold-premium animate-spin mb-4" />
      <p className="text-gold-premium font-light tracking-widest uppercase text-xs">Sincronizando Terminal...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
      <h2 className="text-2xl text-white mb-2">Falla Crítica de Conexión</h2>
      <p className="text-white/60 mb-6 max-w-md">{error}</p>
      <button onClick={() => window.location.reload()} className="px-8 py-3 bg-gold-premium text-black rounded-full hover:scale-105 transition-transform cursor-pointer font-bold">
        Reintentar Conexión
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-28 pb-20 px-6 font-sans selection:bg-gold-premium/30">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-3 text-gold-premium mb-2">
              <Shield size={20} className="animate-pulse" />
              <span className="text-xs tracking-[0.3em] uppercase font-bold">Protocolo de Administración Habilitado</span>
            </div>
            <h1 className="text-5xl font-extralight tracking-tight text-white mb-2">
              Super <span className="text-gold-premium font-normal">Gelatto</span> Dashboard
            </h1>
            <p className="text-white/40 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Sesión biométrica activa para <span className="text-white/80 font-medium">{user.name}</span>
            </p>
          </div>
          
          <div className="flex gap-4">
             <button onClick={fetchDashboardData} className="p-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer" title="Sincronizar datos">
               <RefreshCw size={18} />
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
            <div key={i} className="group relative bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 hover:border-gold-premium/30 transition-all duration-500 overflow-hidden shadow-lg">
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
        <div className="flex flex-wrap gap-2 mb-8 bg-white/5 p-1.5 rounded-2xl w-fit border border-white/5 backdrop-blur-md">
          {[
            { id: 'users', label: 'Usuarios', icon: Users },
            { id: 'sales', label: 'Ventas', icon: ShoppingBag },
            { id: 'products', label: 'Catálogo', icon: IceCream },
            { id: 'featured', label: 'Destacados', icon: Star },
            { id: 'generator_3d', label: 'Generador 3D', icon: Box },
            { id: 'security', label: 'Seguridad', icon: Key },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === tab.id 
                ? 'bg-gold-premium text-black shadow-[0_0_20px_rgba(212,175,55,0.3)] font-semibold' 
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
          
          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* PANEL DE REGISTRO DE ADMINISTRADOR */}
              <div className="bg-gradient-to-br from-white/[0.03] via-white/[0.01] to-transparent border border-gold-premium/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
                <div className="absolute top-0 right-0 p-6 text-gold-premium/5 pointer-events-none">
                  <Shield size={140} />
                </div>

                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gold-premium/10 border border-gold-premium/30 flex items-center justify-center text-gold-premium shadow-inner">
                      <Shield size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        Agregar Nuevo Administrador
                        <span className="text-[10px] bg-gold-premium/20 text-gold-premium px-2.5 py-0.5 rounded-full border border-gold-premium/40 font-mono uppercase tracking-wider">Gestión de Acceso</span>
                      </h3>
                      <p className="text-xs text-white/50 mt-0.5">Registra un nuevo administrador con credenciales de acceso para gestionar la plataforma.</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gold-premium/80 mb-1.5 font-bold">Nombre *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Admin"
                      value={newAdminForm.name}
                      onChange={(e) => setNewAdminForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold-premium/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gold-premium/80 mb-1.5 font-bold">Apellido</label>
                    <input
                      type="text"
                      placeholder="Ej. Gelatto"
                      value={newAdminForm.lastName}
                      onChange={(e) => setNewAdminForm(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold-premium/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gold-premium/80 mb-1.5 font-bold">Correo Electrónico *</label>
                    <input
                      type="email"
                      required
                      placeholder="admin2@supergelatto.com"
                      value={newAdminForm.email}
                      onChange={(e) => setNewAdminForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold-premium/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gold-premium/80 mb-1.5 font-bold">Contraseña *</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={newAdminForm.password}
                      onChange={(e) => setNewAdminForm(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold-premium/50 transition-all"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5 pt-4 mt-2">
                    {createAdminMsg.text ? (
                      <p className={`text-xs font-medium ${createAdminMsg.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                        {createAdminMsg.text}
                      </p>
                    ) : (
                      <span className="text-[11px] text-white/40 italic flex items-center gap-1.5">
                        <Shield size={14} className="text-gold-premium" /> Al registrar, el usuario podrá iniciar sesión con su correo y contraseña.
                      </span>
                    )}

                    <button
                      type="submit"
                      disabled={createAdminLoading}
                      className="w-full sm:w-auto px-6 py-2.5 bg-gold-premium hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow-lg hover:shadow-gold-premium/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {createAdminLoading ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />}
                      <span>Registrar Administrador</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* TABLA DE USUARIOS */}
              <div className="border border-white/5 rounded-2xl overflow-hidden">
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
                  {Array.from(new Map((dashboardData?.users || []).map((u, idx) => [u.id_usuario || u.id || `user-${idx}`, u])).values()).map((u, idx) => {
                    const userId = u.id_usuario || u.id || idx;
                    const SUPER_ADMIN_EMAIL = 'muneracristian63@gmail.com';
                    const savedUserStr = typeof window !== 'undefined' ? (localStorage.getItem('superGelatto_user') || sessionStorage.getItem('superGelatto_user')) : null;
                    const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
                    const activeUser = user || savedUser;
                    const currentUserEmail = (activeUser?.email || activeUser?.user?.email || '').toLowerCase().trim();
                    const isCurrentUserSuperAdmin = currentUserEmail === SUPER_ADMIN_EMAIL || activeUser?.rol === 'super_admin';

                    const targetEmail = (u.email || '').toLowerCase().trim();
                    const isTargetSuperAdmin = targetEmail === SUPER_ADMIN_EMAIL || u.rol === 'super_admin';
                    const isTargetAdmin = u.rol === 'admin';

                    // Modificación de Rol:
                    // 1. Nadie puede cambiar el rol del Super Admin principal (muneracristian63@gmail.com).
                    // 2. Si el objetivo es Administrador, SOLO el Super Admin (muneracristian63@gmail.com) puede cambiar su rol.
                    // 3. Si el objetivo es Cliente, cualquier Administrador puede ascenderlo a admin.
                    const canEditRole = !isTargetSuperAdmin && (!isTargetAdmin || isCurrentUserSuperAdmin);

                    // Eliminación de Usuario:
                    // 1. Nadie puede eliminar la cuenta principal del Super Admin (muneracristian63@gmail.com).
                    // 2. Si el objetivo es Administrador, SOLO la cuenta de Super Admin (muneracristian63@gmail.com) puede eliminarlo.
                    // 3. Si el objetivo es Cliente, cualquier Administrador (Super Admin o Admin normal) puede eliminarlo.
                    const canDeleteUser = !isTargetSuperAdmin && (
                      !isTargetAdmin || (isTargetAdmin && isCurrentUserSuperAdmin && String(userId) !== String(activeUser?.id_usuario || activeUser?.id || activeUser?.user?.id))
                    );

                    return (
                      <tr key={userId} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-6 text-white/20 font-mono text-xs">#{userId}</td>
                        <td className="p-6 font-medium">{u.nombre} {u.apellido}</td>
                        <td className="p-6 text-white/60">
                          {u.email}
                          {isTargetSuperAdmin && (
                            <span className="ml-2 text-[9px] px-2 py-0.5 rounded-full bg-gold-premium/20 text-gold-premium border border-gold-premium/40 font-bold uppercase tracking-wider">
                              Super Admin
                            </span>
                          )}
                        </td>
                        <td className="p-6">
                          <select
                            value={u.rol || 'cliente'}
                            disabled={!canEditRole || actionLoading === `role-${userId}`}
                            onChange={(e) => handleUpdateRole(userId, e.target.value)}
                            title={!canEditRole ? (isTargetSuperAdmin ? 'Cuenta principal protegida' : 'Solo la cuenta de Super Admin (muneracristian63@gmail.com) puede cambiar el rol de un administrador') : 'Cambiar rol'}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider focus:outline-none transition-all ${
                              !canEditRole ? 'opacity-60 cursor-not-allowed ' : 'cursor-pointer '
                            }${
                              u.rol === 'admin' 
                              ? 'bg-gold-premium/20 text-gold-premium border border-gold-premium/40 hover:bg-gold-premium/30' 
                              : 'bg-white/10 text-white/70 border border-white/20 hover:bg-white/20'
                            }`}
                          >
                            <option value="cliente" className="bg-[#050505] text-white">cliente</option>
                            <option value="admin" className="bg-[#050505] text-gold-premium">admin</option>
                          </select>
                        </td>
                        <td className="p-6 text-white/40 text-sm">{formatDate(u.fecha_registro)}</td>
                        <td className="p-6 text-right flex items-center justify-end gap-2">
                          {canDeleteUser ? (
                            <button 
                              disabled={actionLoading === (u.id_usuario || u.id)}
                              onClick={() => handleDeleteUser(u)}
                              className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                              title={u.rol === 'admin' ? "Eliminar cuenta de administrador" : "Eliminar cuenta de cliente"}
                            >
                              {actionLoading === (u.id_usuario || u.id) ? <RefreshCw className="animate-spin" size={18} /> : <Trash2 size={18} />}
                            </button>
                          ) : (
                            <span 
                              className="text-[10px] text-white/20 font-mono uppercase tracking-wider select-none"
                              title={isTargetSuperAdmin ? "La cuenta principal de Super Admin está protegida y no se puede eliminar" : "Solo la cuenta principal de Super Admin (muneracristian63@gmail.com) puede eliminar administradores"}
                            >
                              Protegido
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {dashboardData.users.length === 0 && <div className="p-20 text-center text-white/20">No hay usuarios registrados</div>}
              </div>
            </div>
          )}

          {/* TAB: SALES */}
          {activeTab === 'sales' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 text-[10px] uppercase tracking-[0.2em] font-bold">
                    <th className="p-6">Orden / Pedido</th>
                    <th className="p-6">Cliente (Email)</th>
                    <th className="p-6">Valor Total</th>
                    <th className="p-6">Timestamp</th>
                    <th className="p-6">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dashboardData.sales.map(s => {
                    const currentStatus = s.estado || 'En proceso';
                    const clientUser = (dashboardData.users || []).find(u => String(u.id_usuario || u.id) === String(s.id_usuario));
                    const clientEmail = s.email || clientUser?.email;
                    const clientName = (s.nombre ? `${s.nombre} ${s.apellido || ''}` : null) || (clientUser ? `${clientUser.nombre || ''} ${clientUser.apellido || ''}` : null);

                    return (
                      <tr key={s.id_venta} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-2xl bg-gold-premium/10 border border-gold-premium/30 flex items-center justify-center text-gold-premium shadow-[0_0_15px_rgba(212,175,55,0.15)] group-hover:scale-105 transition-transform">
                              <Receipt size={16} />
                            </div>
                            <div>
                              <span className="font-mono text-xs font-black text-white tracking-wide block">
                                #SG-{s.id_venta}
                              </span>
                              <span className="text-[9px] text-gold-premium/80 font-mono uppercase tracking-widest block mt-0.5">
                                Venta confirmada
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 shrink-0">
                              <Mail size={14} className="text-gold-premium" />
                            </div>
                            <div className="overflow-hidden max-w-[200px]">
                              {clientEmail ? (
                                <p className="font-mono text-xs font-semibold text-white/90 truncate" title={clientEmail}>
                                  {clientEmail}
                                </p>
                              ) : (
                                <p className="font-mono text-xs text-white/40 italic">
                                  USER-{s.id_usuario || 'Anónimo'}
                                </p>
                              )}
                              {clientName && clientName.trim() !== '' && (
                                <p className="text-[10px] text-white/40 font-medium truncate">
                                  {clientName.trim()}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-6 font-bold text-white tracking-tight">{formatCurrency(s.total)}</td>
                        <td className="p-6 text-white/40 text-sm">{formatDate(s.fecha)}</td>
                        <td className="p-6">
                          <div className="relative inline-block">
                            <select
                              value={currentStatus}
                              onChange={(e) => handleUpdateSaleStatus(s.id_venta, e.target.value)}
                              disabled={updatingSaleStatus === s.id_venta}
                              style={{
                                backgroundColor: '#111',
                                color: currentStatus === 'En proceso' ? '#f59e0b' :
                                       currentStatus === 'En entrega' ? '#22d3ee' :
                                       currentStatus === 'Enviado' ? '#60a5fa' :
                                       currentStatus === 'Cancelado' ? '#ef4444' : '#4ade80'
                              }}
                              className={`appearance-none border rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none cursor-pointer transition-all pr-7 ${
                                updatingSaleStatus === s.id_venta ? 'opacity-50' : ''
                              } ${
                                currentStatus === 'En proceso' ? 'border-amber-500/40' :
                                currentStatus === 'En entrega' ? 'border-cyan-500/40' :
                                currentStatus === 'Enviado' ? 'border-blue-500/40' :
                                currentStatus === 'Cancelado' ? 'border-red-500/40' :
                                'border-green-500/40'
                              }`}
                            >
                              <option value="En proceso" style={{ backgroundColor: '#111', color: '#f59e0b' }}>En proceso</option>
                              <option value="En entrega" style={{ backgroundColor: '#111', color: '#22d3ee' }}>En entrega</option>
                              <option value="Enviado" style={{ backgroundColor: '#111', color: '#60a5fa' }}>Enviado</option>
                              <option value="Entregado" style={{ backgroundColor: '#111', color: '#4ade80' }}>Entregado</option>
                              <option value="Cancelado" style={{ backgroundColor: '#111', color: '#ef4444' }}>Cancelado</option>
                            </select>
                            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/40">
                              {updatingSaleStatus === s.id_venta
                                ? <RefreshCw size={10} className="animate-spin" />
                                : <span style={{ fontSize: 8 }}>▼</span>
                              }
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {dashboardData.sales.length === 0 && <div className="p-20 text-center text-white/20">Sin registros de ventas</div>}
            </div>
          )}

          {/* TAB: PRODUCTS CATALOG */}
          {activeTab === 'products' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.01]">
                <div>
                  <h3 className="text-lg font-light text-white flex items-center gap-2">
                    <IceCream className="text-gold-premium" size={20} />
                    Catálogo de <span className="text-gold-premium font-normal">Helados</span>
                  </h3>
                  <p className="text-xs text-white/40 mt-0.5">Gestiona precios, cambia imágenes, destaca productos o agrega nuevas creaciones.</p>
                </div>

                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="px-5 py-2.5 bg-gold-premium hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow-lg hover:shadow-gold-premium/20 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
                >
                  <Plus size={16} />
                  <span>Agregar Nuevo Producto</span>
                </button>
              </div>

              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 text-[10px] uppercase tracking-[0.2em] font-bold">
                    <th className="p-6">SKU</th>
                    <th className="p-6">Sabor / Producto</th>
                    <th className="p-6">Precio</th>
                    <th className="p-6">Categoría</th>
                    <th className="p-6">Stock Disponible</th>
                    <th className="p-6">Destacado</th>
                    <th className="p-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dashboardData.products.map(p => {
                    const currentStock = p.stock !== undefined && p.stock !== null ? Number(p.stock) : 50;
                    return (
                      <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-6 text-white/20 font-mono text-xs">PROD-{p.id}</td>
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="relative group/img cursor-pointer" onClick={() => handleOpenImageModal(p)}>
                              <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-white/10 group-hover/img:brightness-75 transition-all" />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/40 rounded-xl">
                                <Camera size={14} className="text-white" />
                              </div>
                            </div>
                            <div>
                              <p className="font-medium text-white flex items-center gap-2">
                                {p.name}
                                {p.destacado && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-premium/20 text-gold-premium border border-gold-premium/30 font-bold flex items-center gap-1">
                                    <Star size={10} className="fill-gold-premium" /> Destacado
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-white/40 line-clamp-1 max-w-[220px]">{p.desc}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {editingPrice && String(editingPrice.id) === String(p.id) ? (
                            <div className="flex items-center gap-1">
                              <span className="text-white/40 text-xs">$</span>
                              <input
                                type="number"
                                autoFocus
                                value={editingPrice.value}
                                onChange={(e) => setEditingPrice({ id: p.id, value: e.target.value })}
                                onBlur={() => handleSavePrice(p.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSavePrice(p.id);
                                  if (e.key === 'Escape') setEditingPrice(null);
                                }}
                                className="w-24 bg-[#1a1a1a] border border-gold-premium/40 rounded-lg px-2 py-1 text-gold-premium font-bold text-xs focus:outline-none focus:border-gold-premium"
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingPrice({ id: p.id, value: p.precio })}
                              className="group/price flex items-center gap-1.5 font-bold text-gold-premium tracking-tight hover:text-amber-300 transition-colors cursor-pointer"
                              title="Haz clic para editar el precio"
                            >
                              {updatingPrice === p.id
                                ? <RefreshCw size={12} className="animate-spin text-gold-premium" />
                                : null
                              }
                              {formatCurrency(p.precio)}
                              <span className="opacity-0 group-hover/price:opacity-100 text-[9px] text-white/30 transition-opacity">✏️</span>
                            </button>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="relative">
                            <select
                              value={p.categoria || 'Clásico'}
                              onChange={(e) => handleUpdateCategory(p.id, e.target.value)}
                              disabled={updatingCategory === p.id}
                              style={{ backgroundColor: '#111', color: p.categoria === 'Vegano' ? '#86efac' : p.categoria === 'Temporada' ? '#f9a8d4' : p.categoria === 'Gourmet' ? '#c4b5fd' : '#D4AF37' }}
                              className={`appearance-none border rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none cursor-pointer transition-all pr-7 ${
                                updatingCategory === p.id ? 'opacity-50' : ''
                              } ${
                                (p.categoria === 'Vegano') ? 'border-green-500/30' :
                                (p.categoria === 'Temporada') ? 'border-pink-400/30' :
                                (p.categoria === 'Gourmet') ? 'border-purple-400/30' :
                                'border-gold-premium/30'
                              }`}
                            >
                              <option value="Clásico" style={{backgroundColor:'#111',color:'#D4AF37'}}>Clásico</option>
                              <option value="Vegano" style={{backgroundColor:'#111',color:'#86efac'}}>Vegano</option>
                              <option value="Temporada" style={{backgroundColor:'#111',color:'#f9a8d4'}}>Temporada</option>
                              <option value="Gourmet" style={{backgroundColor:'#111',color:'#c4b5fd'}}>Gourmet</option>
                            </select>
                            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/30">
                              {updatingCategory === p.id
                                ? <RefreshCw size={10} className="animate-spin" />
                                : <span style={{fontSize:8}}>▼</span>
                              }
                            </div>
                          </div>
                        </td>
                        {/* CONTROL Y EDICIÓN DE STOCK */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleStepStock(p.id, currentStock, -1)}
                              disabled={updatingStock === p.id}
                              className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer disabled:opacity-30 shrink-0"
                              title="Disminuir stock disponible en 1"
                            >
                              -
                            </button>
                            {editingStock && String(editingStock.id) === String(p.id) ? (
                              <input
                                type="number"
                                min="0"
                                autoFocus
                                value={editingStock.value}
                                onChange={(e) => setEditingStock({ id: p.id, value: e.target.value })}
                                onBlur={() => handleSaveStock(p.id, editingStock.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveStock(p.id, editingStock.value);
                                  if (e.key === 'Escape') setEditingStock(null);
                                }}
                                className="w-16 bg-[#1a1a1a] border border-gold-premium/40 rounded-lg px-2 py-1 text-center font-bold text-xs text-white focus:outline-none focus:border-gold-premium"
                              />
                            ) : (
                              <button
                                onClick={() => setEditingStock({ id: p.id, value: currentStock })}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                  currentStock === 0
                                    ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                                    : currentStock <= 10
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30'
                                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                                }`}
                                title="Haz clic para escribir la cantidad exacta disponible"
                              >
                                {updatingStock === p.id && <RefreshCw size={10} className="animate-spin text-current" />}
                                <span>{currentStock} u.</span>
                                <span className="text-[9px] opacity-40">✏️</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleStepStock(p.id, currentStock, 1)}
                              disabled={updatingStock === p.id}
                              className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer disabled:opacity-30 shrink-0"
                              title="Aumentar stock disponible en 1"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      <td className="p-6">
                        <button
                          onClick={() => handleToggleFeatured(p.id, p.destacado)}
                          disabled={togglingFeatured === p.id}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                            p.destacado
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                              : 'bg-white/5 text-white/40 border border-white/10 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <Star size={12} className={p.destacado ? 'fill-amber-400' : ''} />
                          {p.destacado ? 'Destacado' : 'Destacar'}
                        </button>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenImageModal(p)}
                            className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[10px] font-bold tracking-wider uppercase rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Cambiar la imagen de este producto"
                          >
                            <Image size={12} />
                            Imagen
                          </button>

                          <button
                            onClick={() => handleOpen3DModal(p)}
                            className="px-3 py-1.5 bg-gold-premium/10 hover:bg-gold-premium/20 border border-gold-premium/20 text-gold-premium text-[10px] font-bold tracking-wider uppercase rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Box size={12} />
                            Modelo 3D
                          </button>
                          
                          <button 
                            disabled={actionLoading === p.id}
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                          >
                            {actionLoading === p.id ? <RefreshCw className="animate-spin" size={18} /> : <Trash2 size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
              {dashboardData.products.length === 0 && <div className="p-20 text-center text-white/20">No hay productos en el catálogo</div>}
            </div>
          )}

          {/* TAB: PRODUCTOS DESTACADOS */}
          {activeTab === 'featured' && (
            <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
              {/* Encabezado de Gestión de Destacados */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-gold-premium/10 via-amber-500/5 to-transparent border border-gold-premium/30 p-8 rounded-3xl backdrop-blur-xl">
                <div>
                  <div className="flex items-center gap-2 text-gold-premium mb-2">
                    <Star size={20} className="fill-gold-premium animate-pulse" />
                    <span className="text-xs uppercase tracking-widest font-bold">Gestión de Galería Principal</span>
                  </div>
                  <h2 className="text-3xl font-light text-white mb-2">
                    Productos <span className="font-normal text-gold-premium">Destacados</span>
                  </h2>
                  <p className="text-white/60 text-sm max-w-xl">
                    Los productos marcados aquí se resaltarán automáticamente (hasta un máximo de 6) en la sección principal <strong className="text-gold-premium">"Sabores Destacados"</strong> de la página de inicio.
                  </p>
                </div>

                <div className="bg-black/50 border border-white/10 px-6 py-4 rounded-2xl flex items-center gap-4 text-center min-w-[200px]">
                  <div>
                    <span className="text-3xl font-bold text-gold-premium">
                      {dashboardData.products.filter(p => p.destacado).length}
                    </span>
                    <span className="text-white/40 text-xs font-mono block uppercase">Destacados Activos</span>
                  </div>
                  <div className="h-8 w-[1px] bg-white/10"></div>
                  <div>
                    <span className="text-2xl font-light text-white/70">
                      {dashboardData.products.length}
                    </span>
                    <span className="text-white/40 text-xs font-mono block uppercase">Total Catálogo</span>
                  </div>
                </div>
              </div>

              {/* Grid de Productos con Toggles */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white/40 mb-6 flex items-center gap-2">
                  <IceCream size={16} className="text-gold-premium" /> Selecciona los helados a destacar en la web
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {dashboardData.products.map(p => (
                    <div
                      key={p.id}
                      className={`group relative rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between overflow-hidden ${
                        p.destacado
                          ? 'bg-gradient-to-b from-amber-500/10 via-black to-[#0a0a0a] border-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.15)]'
                          : 'bg-[#080808] border-white/5 hover:border-white/20'
                      }`}
                    >
                      {/* Badge superior */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-white/60 border border-white/10">
                          {p.categoria || 'Artesanal'}
                        </span>

                        <span className="text-xs font-bold text-gold-premium font-mono">
                          {formatCurrency(p.precio)}
                        </span>
                      </div>

                      {/* Imagen + Detalles */}
                      <div className="flex items-center gap-4 mb-6">
                        <div className="relative shrink-0">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-16 h-16 rounded-2xl object-cover border border-white/10 group-hover:scale-105 transition-transform"
                          />
                          {p.destacado && (
                            <span className="absolute -top-1 -right-1 bg-amber-500 text-black p-1 rounded-full shadow-md">
                              <Star size={10} className="fill-black" />
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="font-semibold text-white group-hover:text-gold-premium transition-colors text-base line-clamp-1">
                            {p.name}
                          </h4>
                          <p className="text-xs text-white/40 line-clamp-2 mt-0.5">
                            {p.desc}
                          </p>
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <button
                          onClick={() => handleToggleFeatured(p.id, p.destacado)}
                          disabled={togglingFeatured === p.id}
                          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                            p.destacado
                              ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-500/20'
                              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
                          }`}
                        >
                          {togglingFeatured === p.id ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <Star size={14} className={p.destacado ? 'fill-black' : ''} />
                          )}
                          <span>{p.destacado ? '⭐ Destacado en Inicio' : '☆ Destacar Producto'}</span>
                        </button>

                        <button
                          onClick={() => handleOpenImageModal(p)}
                          className="w-full py-1.5 px-3 rounded-lg text-[10px] font-medium text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Image size={12} />
                          <span>Cambiar Imagen de Producto</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vista Previa de Clientes */}
              <div className="bg-black/60 border border-white/10 rounded-3xl p-8 backdrop-blur-md">
                <div className="flex items-center gap-2 text-gold-premium mb-4">
                  <Eye size={18} />
                  <span className="text-xs uppercase tracking-widest font-bold">Vista Previa de Clientes en el Inicio</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {dashboardData.products.filter(p => p.destacado).map(p => (
                    <div key={`preview-${p.id}`} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                      <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                      <div>
                        <p className="text-xs font-bold text-white line-clamp-1">{p.name}</p>
                        <p className="text-[10px] text-gold-premium font-bold">{formatCurrency(p.precio)}</p>
                      </div>
                    </div>
                  ))}
                  {dashboardData.products.filter(p => p.destacado).length === 0 && (
                    <div className="col-span-full py-8 text-center text-white/30 text-xs italic">
                      No hay ningún producto marcado como destacado. Haz clic en "Destacar Producto" arriba para agregarlo.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: GENERADOR 3D */}
          {activeTab === 'generator_3d' && (
            <div className="p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Formulario */}
                <div>
                  <h2 className="text-2xl font-light mb-6">Crear Nuevo <span className="text-gold-premium font-normal">Helado 3D</span></h2>
                  
                  <form onSubmit={handleCreateProduct} className="space-y-5">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 font-bold">Nombre del Producto *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ej: Fresa Salvaje Premium" 
                        value={newProduct.nombre}
                        onChange={e => setNewProduct({...newProduct, nombre: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-premium/40 transition-colors text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 font-bold">Precio (COP) *</label>
                        <input 
                          type="number" 
                          required
                          placeholder="12000" 
                          value={newProduct.precio}
                          onChange={e => setNewProduct({...newProduct, precio: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-premium/40 transition-colors text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 font-bold">Categoría *</label>
                        <select
                          value={newProduct.categoria}
                          onChange={e => setNewProduct({...newProduct, categoria: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-premium/40 transition-colors text-sm cursor-pointer"
                        >
                          <option value="Clásico" className="bg-[#050505]">Clásico</option>
                          <option value="Vegano" className="bg-[#050505]">Vegano</option>
                          <option value="Temporada" className="bg-[#050505]">Temporada</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-widest text-white/40 mb-2 font-bold">Descripción Corta</label>
                      <textarea 
                        rows="2"
                        placeholder="Breve descripción artesanal del sabor..." 
                        value={newProduct.descripcion}
                        onChange={e => setNewProduct({...newProduct, descripcion: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-premium/40 transition-colors text-sm"
                      />
                    </div>

                    <div className="border-t border-white/5 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs uppercase tracking-widest text-gold-premium font-bold flex items-center gap-1.5">
                          <Sparkles size={14} className="animate-pulse" />
                          Generador 3D (Tripo AI)
                        </label>
                        <span className="text-[10px] text-white/30">Opcional</span>
                      </div>
                      <p className="text-white/40 text-xs mb-3 leading-relaxed">
                        Introduce un prompt descriptivo en inglés o español. Tripo AI modelará la estructura 3D en base al texto.
                      </p>
                      <input 
                        type="text" 
                        placeholder="Ej: gourmet strawberry gelato on waffle cone, high detail, 3d assets" 
                        value={newProduct.prompt3d}
                        onChange={e => setNewProduct({...newProduct, prompt3d: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-premium/40 transition-colors text-sm font-light placeholder:text-white/20"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={generatingStatus === 'enviando' || generatingStatus === 'generando'}
                      className="w-full bg-gold-premium text-black font-semibold py-3.5 rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                    >
                      {generatingStatus === 'enviando' && <Loader2 className="animate-spin" size={18} />}
                      {generatingStatus === 'generando' && <Loader2 className="animate-spin" size={18} />}
                      {generatingStatus === 'enviando' ? 'Enviando a Tripo AI...' :
                       generatingStatus === 'generando' ? 'Generando 3D...' : 'Crear Producto'}
                    </button>
                  </form>
                </div>

                {/* Previsualización en Vivo de la Generación */}
                <div className="border border-white/5 bg-white/[0.02] rounded-3xl p-6 flex flex-col justify-center min-h-[350px] relative overflow-hidden">
                  {generatingStatus === 'idle' && (
                    <div className="text-center p-8 text-white/30 flex flex-col items-center">
                      <Box size={48} className="text-white/10 mb-4" />
                      <p className="text-sm font-medium">Esperando creación...</p>
                      <p className="text-xs text-white/20 mt-1 max-w-[200px]">Crea un producto con prompt 3D para ver el renderizador interactivo aquí.</p>
                    </div>
                  )}

                  {(generatingStatus === 'enviando' || generatingStatus === 'generando') && (
                    <div className="text-center p-8 flex flex-col items-center">
                      <Loader2 className="w-12 h-12 text-gold-premium animate-spin mb-4" />
                      <h4 className="text-lg font-light text-white/80 mb-1">Modelado en Progreso</h4>
                      <p className="text-xs text-gold-premium tracking-[0.2em] uppercase font-semibold animate-pulse">Tripo AI está esculpiendo...</p>
                      <div className="w-48 bg-white/15 h-1 rounded-full overflow-hidden mt-6">
                        <div className="bg-gold-premium h-full animate-[loading-bar_10s_ease-in-out_infinite]"></div>
                      </div>
                      <p className="text-[10px] text-white/40 mt-3 max-w-[220px]">Esto suele tomar entre 10 y 25 segundos. No cierres la ventana.</p>
                    </div>
                  )}

                  {generatingStatus === 'listo' && generatedModel && (
                    <div className="flex flex-col h-full animate-in zoom-in duration-300">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs tracking-wider uppercase font-bold text-green-400">Modelo 3D listo</span>
                      </div>
                      
                      <div className="flex-1 rounded-2xl overflow-hidden border border-white/5">
                        <Model3DPreview url={generatedModel.glb_url} />
                      </div>
                      
                      <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-xs text-white/40 uppercase tracking-widest font-bold mb-1">Prompt Usado</p>
                        <p className="text-xs font-light italic text-white/70">"{generatedModel.prompt_usado}"</p>
                      </div>
                    </div>
                  )}

                  {generatingStatus === 'error' && (
                    <div className="text-center p-8 text-red-400 flex flex-col items-center animate-in zoom-in duration-300">
                      <AlertTriangle size={48} className="mb-4 animate-bounce" />
                      <h4 className="text-lg font-medium">Falla en la Generación</h4>
                      <p className="text-xs text-white/50 mt-1 max-w-[220px]">La API de Tripo AI no pudo modelar este prompt o hubo problemas de conexión.</p>
                      <button 
                        onClick={() => {
                          if (generatingProduct) startPolling(generatingProduct.id);
                        }}
                        className="mt-6 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white text-xs cursor-pointer transition-all"
                      >
                        Reintentar Polling
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}



          {/* TAB: SEGURIDAD */}
          {activeTab === 'security' && (
            <div className="p-8 max-w-2xl mx-auto animate-in fade-in duration-500">
              <h2 className="text-2xl font-light mb-6 flex items-center gap-2">
                <Shield size={24} className="text-gold-premium" />
                Seguridad Biométrica <span className="text-gold-premium font-normal">AWS Rekognition</span>
              </h2>

              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 text-white/5 pointer-events-none">
                  <Camera size={120} />
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gold-premium/10 border border-gold-premium/20 flex items-center justify-center text-gold-premium">
                    <Camera size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Reconocimiento Facial Universal (AWS Cloud)</h3>
                    <p className="text-white/40 text-xs mt-1 leading-relaxed">
                      Captura una foto de tu rostro desde cualquier dispositivo con cámara. AWS Rekognition indexará tus rasgos faciales en la nube para permitirte iniciar sesión de forma rápida y segura.
                    </p>
                  </div>
                </div>

                {rekognitionMsg.text && (
                  <div className={`p-4 rounded-xl text-xs font-bold ${
                    rekognitionMsg.type === 'error' 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                      : rekognitionMsg.type === 'info'
                      ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20 animate-pulse'
                      : 'bg-green-500/10 text-green-400 border border-green-500/20'
                  }`}>
                    {rekognitionMsg.text}
                  </div>
                )}

                <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Estado de Colección AWS</p>
                    <p className="text-sm font-medium mt-1 flex items-center gap-1.5 text-gold-premium">
                      <span className="w-2.5 h-2.5 rounded-full bg-gold-premium animate-pulse"></span>
                      supergelatto-admins (us-east-2)
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCapturaFacialModal(true)}
                    disabled={rekognitionLoading}
                    className="w-full sm:w-auto px-6 py-3 bg-gold-premium hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow-lg hover:shadow-gold-premium/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {rekognitionLoading ? <RefreshCw className="animate-spin" size={16} /> : <Camera size={16} />}
                    <span>Registrar Reconocimiento Facial</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* --- MODAL CAPTURA FACIAL AWS --- */}
      {showCapturaFacialModal && (
        <CapturaFacial
          title="Registro Facial AWS Rekognition"
          subtitle="Toma una foto de tu rostro para vincularlo a tu cuenta de administrador."
          onCapture={handleRekognitionRegister}
          onClose={() => setShowCapturaFacialModal(false)}
        />
      )}

      {/* --- MODAL PREVISUALIZADOR 3D DE CATÁLOGO --- */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-in fade-in duration-300">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-300">
            {/* Botón cerrar */}
            <button 
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/60 hover:text-white transition-colors cursor-pointer z-10"
            >
              <X size={18} />
            </button>

            <div className="p-8">
              <span className="text-[10px] text-gold-premium tracking-[0.3em] uppercase font-bold block mb-1">
                Visualizador del Taller 3D
              </span>
              <h3 className="text-3xl font-light mb-1">
                {selectedProduct.name}
              </h3>
              <p className="text-xs text-white/40 mb-6">
                SKU: PROD-{selectedProduct.id}
              </p>

              {loadingModel ? (
                <div className="w-full h-[350px] bg-black/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center text-white/30">
                  <Loader2 className="w-8 h-8 animate-spin text-gold-premium mb-2" />
                  <p className="text-xs uppercase tracking-widest font-light">Buscando archivo GLB...</p>
                </div>
              ) : productModel && productModel.estado === 'listo' ? (
                <div className="space-y-6">
                  <Model3DPreview url={productModel.glb_url} />

                  {/* Regenerador Form */}
                  <div className="border-t border-white/5 pt-6">
                    <h4 className="text-sm font-semibold text-gold-premium mb-2 flex items-center gap-1.5">
                      <Sparkles size={14} className="animate-pulse" />
                      Regenerar Modelo 3D
                    </h4>
                    <p className="text-xs text-white/40 mb-4 leading-relaxed">
                      ¿No te gusta el render actual? Redefine el prompt y Tripo AI volverá a esculpir el helado para este mismo producto.
                    </p>

                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        placeholder="Nuevo prompt detallado para el modelo..." 
                        value={regenPrompt}
                        onChange={e => setRegenPrompt(e.target.value)}
                        disabled={regenStatus === 'generando'}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-gold-premium/40 text-white transition-colors"
                      />
                      <button
                        onClick={handleRegenerate3D}
                        disabled={!regenPrompt.trim() || regenStatus === 'generando'}
                        className="px-6 py-2.5 bg-gold-premium text-black font-semibold text-xs rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {regenStatus === 'generando' && <Loader2 className="animate-spin" size={12} />}
                        {regenStatus === 'generando' ? 'Generando...' : 'Regenerar'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 bg-black/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center p-6">
                  <Box size={40} className="text-white/15 mb-3" />
                  <p className="text-sm font-medium text-white/60">Este producto no tiene un modelo 3D</p>
                  <p className="text-xs text-white/30 max-w-xs mt-1">Escribe un prompt para generar e indexar su archivo 360° interactivo.</p>
                  
                  <div className="w-full max-w-md mt-6 flex gap-3">
                    <input 
                      type="text" 
                      placeholder="Prompt de generación (ej: realistic chocolate gelato on glass cup)" 
                      value={regenPrompt}
                      onChange={e => setRegenPrompt(e.target.value)}
                      disabled={regenStatus === 'generando'}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-gold-premium/40 text-white"
                    />
                    <button
                      onClick={handleRegenerate3D}
                      disabled={!regenPrompt.trim() || regenStatus === 'generando'}
                      className="px-6 py-2.5 bg-gold-premium text-black font-semibold text-xs rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {regenStatus === 'generando' && <Loader2 className="animate-spin" size={12} />}
                      {regenStatus === 'generando' ? 'Generando...' : 'Generar 3D'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* --- MODAL PARA GESTIÓN Y CAMBIO DE IMAGEN DE PRODUCTO --- */}
      {imageModalProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setImageModalProduct(null)}
              className="absolute top-6 right-6 text-white/40 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 text-gold-premium mb-2">
              <Image size={20} />
              <span className="text-xs uppercase tracking-widest font-bold">Gestor de Imagen de Producto</span>
            </div>
            <h3 className="text-2xl font-light text-white mb-6">
              Actualizar Imagen para <span className="font-normal text-gold-premium">{imageModalProduct.name}</span>
            </h3>

            {/* Previsualización en Vivo */}
            <div className="mb-6 flex flex-col items-center justify-center bg-black/50 border border-white/10 rounded-2xl p-5 relative overflow-hidden">
              {imageUrlInput ? (
                <img
                  src={imageUrlInput}
                  alt="Previsualización"
                  className="w-44 h-44 object-cover rounded-2xl shadow-xl border border-white/10"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/images/gelato_fresa.png';
                  }}
                />
              ) : (
                <div className="w-44 h-44 rounded-2xl bg-white/5 border border-dashed border-white/20 flex flex-col items-center justify-center text-white/30 text-xs">
                  <Image size={36} className="mb-2 text-white/20" />
                  Sin Imagen
                </div>
              )}
              <span className="text-[10px] text-white/40 mt-3 font-mono">Previsualización en tiempo real</span>
            </div>

            <form onSubmit={handleSaveProductImage} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/40 mb-2 font-bold">
                  Opción 1: Pegar URL o Ruta de Imagen
                </label>
                <input
                  type="text"
                  placeholder="https://ejemplo.com/imagen.png o /images/..."
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold-premium/40 transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-white/40 mb-2 font-bold">
                  Opción 2: Seleccionar Imagen desde tu equipo
                </label>
                <label className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-gold-premium/40 rounded-xl p-3 text-xs text-white/70 hover:text-white cursor-pointer transition-all">
                  <Upload size={16} className="text-gold-premium" />
                  <span>Subir Archivo de Imagen Local</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-white/40 mb-2 font-bold">
                  Imágenes Predeterminadas
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Fresa', url: '/images/gelato_fresa.png' },
                    { label: 'Chocolate', url: '/images/gelato_chocolate.png' },
                    { label: 'Mango', url: '/images/gelato_mango.png' },
                    { label: 'Berries', url: '/images/gelato_berries.png' },
                    { label: 'Pistacho', url: '/images/gelato_pistacho.png' },
                    { label: 'Caramelo', url: '/images/caramelo salado.png' },
                    { label: 'Vainilla', url: '/images/vainilla de madagascar.png' },
                    { label: 'Limón', url: '/images/limone di amalfi.png' },
                    { label: 'Tiramisú', url: '/images/Tiramisú Artigianale.png' },
                    { label: 'Coco', url: '/images/Coco & Lima.png' },
                  ].map((item, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setImageUrlInput(item.url)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-gold-premium/20 hover:text-gold-premium border border-white/10 rounded-lg text-[10px] text-white/60 transition-all cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {imageMsg.text && (
                <div className={`p-3 rounded-xl text-xs font-bold ${
                  imageMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
                }`}>
                  {imageMsg.text}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setImageModalProduct(null)}
                  className="w-1/2 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={imageSaving || !imageUrlInput}
                  className="w-1/2 py-2.5 bg-gold-premium hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow-lg hover:shadow-gold-premium/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {imageSaving ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                  Guardar Imagen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL PARA CREAR NUEVO PRODUCTO EN EL CATÁLOGO --- */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddProductModal(false)}
              className="absolute top-6 right-6 text-white/40 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 text-gold-premium mb-2">
              <Plus size={20} />
              <span className="text-xs uppercase tracking-widest font-bold">Nuevo Producto de Heladería</span>
            </div>
            <h3 className="text-2xl font-light text-white mb-6">
              Agregar Helado al <span className="font-normal text-gold-premium">Catálogo</span>
            </h3>

            <form onSubmit={handleCreateNewProduct} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/40 mb-2 font-bold">
                  Nombre del Helado / Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Maracuyá Especial & Cremoso"
                  value={createProductForm.name}
                  onChange={(e) => setCreateProductForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold-premium/40 transition-colors text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/40 mb-2 font-bold">
                    Precio (COP) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="13000"
                    value={createProductForm.price}
                    onChange={(e) => setCreateProductForm(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-gold-premium/40 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/40 mb-2 font-bold">
                    Stock Inicial *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="50"
                    value={createProductForm.stock}
                    onChange={(e) => setCreateProductForm(prev => ({ ...prev, stock: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-gold-premium/40 transition-colors text-sm font-bold text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/40 mb-2 font-bold">
                    Categoría
                  </label>
                  <select
                    value={createProductForm.category}
                    onChange={(e) => setCreateProductForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-[#181818] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-gold-premium/40 text-sm cursor-pointer"
                  >
                    <option value="Clásico">Clásico</option>
                    <option value="Vegano">Vegano</option>
                    <option value="Temporada">Temporada</option>
                    <option value="Gourmet">Gourmet</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-white/40 mb-2 font-bold">
                  Descripción Corta
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalla el sabor, notas de cata e ingredientes clave..."
                  value={createProductForm.description}
                  onChange={(e) => setCreateProductForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold-premium/40 transition-colors text-sm"
                />
              </div>

              {/* Imagen del nuevo producto */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/40 mb-2 font-bold">
                  Imagen del Producto (URL o Archivo Local)
                </label>
                <input
                  type="text"
                  placeholder="https://ejemplo.com/imagen.png o dejar en blanco para imagen automática"
                  value={createProductForm.image}
                  onChange={(e) => setCreateProductForm(prev => ({ ...prev, image: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold-premium/40 transition-colors text-sm mb-2"
                />
                
                <label className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-gold-premium/40 rounded-xl p-2.5 text-xs text-white/70 hover:text-white cursor-pointer transition-all">
                  <Upload size={14} className="text-gold-premium" />
                  <span>Subir Imagen Local desde tu Equipo</span>
                  <input type="file" accept="image/*" onChange={handleAddProductFileUpload} className="hidden" />
                </label>

                {createProductForm.image && (
                  <div className="mt-3 flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-white/10">
                    <img src={createProductForm.image} alt="Vista Previa" className="w-12 h-12 rounded-lg object-cover border border-white/10" />
                    <span className="text-[10px] text-white/50 font-mono">Previsualización de Imagen</span>
                  </div>
                )}
              </div>

              {/* Opción Destacado */}
              <div className="pt-2">
                <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={createProductForm.featured}
                    onChange={(e) => setCreateProductForm(prev => ({ ...prev, featured: e.target.checked }))}
                    className="w-4 h-4 accent-amber-400 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white block">Destacar inmediatamente en la página principal</span>
                    <span className="text-white/40 text-[10px]">Aparecerá en la sección "Sabores Destacados" del inicio.</span>
                  </div>
                </label>
              </div>

              {createProductMsg.text && (
                <div className={`p-3 rounded-xl text-xs font-bold ${
                  createProductMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
                }`}>
                  {createProductMsg.text}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="w-1/2 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createProductLoading || !createProductForm.name || !createProductForm.price}
                  className="w-1/2 py-2.5 bg-gold-premium hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow-lg hover:shadow-gold-premium/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {createProductLoading ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />}
                  Crear Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE USUARIO */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b0b0f] border border-red-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setUserToDelete(null)}
              className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mb-6">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">¿Eliminar esta cuenta?</h3>
            <p className="text-white/70 text-sm mb-4">
              Estás a punto de eliminar a <strong className="text-white">{userToDelete.nombre} {userToDelete.apellido}</strong> ({userToDelete.email}).
            </p>
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs mb-6">
              ⚠️ Esta acción eliminará permanentemente la cuenta y no se puede deshacer.
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="w-1/2 py-3 bg-white/5 hover:bg-white/10 text-white/70 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionLoading === (userToDelete.id_usuario || userToDelete.id)}
                onClick={executeDeleteUser}
                className="w-1/2 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoading === (userToDelete.id_usuario || userToDelete.id) ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos utilitarios para animaciones */}
      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
