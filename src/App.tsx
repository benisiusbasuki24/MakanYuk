import React, { useState, useEffect } from 'react';
import { 
  Utensils, ShoppingBag, Truck, CheckCircle2, Clock, XCircle, Plus, Minus, 
  Trash2, Edit, Save, Search, Filter, FileSpreadsheet, FileText, Download, 
  Phone, MapPin, User, ShieldCheck, DollarSign, QrCode, ArrowRight, RefreshCw, 
  Check, AlertCircle, Image as ImageIcon, Sparkles, ChefHat, LogOut, Lock, UserPlus, Key, Settings, Store
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, 
  onSnapshot, query, orderBy, serverTimestamp, getDocs, setDoc, getDoc
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import * as XLSX from 'xlsx';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export interface MenuItem {
  id: string;
  name: string;
  category: 'Makanan' | 'Minuman';
  price: number;
  description: string;
  imageUrl: string;
  available: boolean;
}

export interface OrderItem {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface Order {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: 'Tunai' | 'Transfer Bank';
  paymentStatus: 'Belum Lunas' | 'Lunas';
  status: 'Menunggu Konfirmasi' | 'Diproses' | 'Dalam Pengiriman' | 'Selesai' | 'Dibatalkan';
  createdAt: any;
}

export interface UserAccount {
  id: string;
  name: string;
  whatsappNumber: string;
  email: string;
  password?: string;
  role: 'pelanggan' | 'warung';
  address: string;
  createdAt: string;
}

const DEFAULT_MENU: Omit<MenuItem, 'id'>[] = [
  {
    name: 'Nasi Goreng Spesial PesenDong',
    category: 'Makanan',
    price: 25000,
    description: 'Nasi goreng gurih dengan bumbu rempah rahasia, ayam suwir, telur mata sapi, dan kerupuk udang.',
    imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80',
    available: true
  },
  {
    name: 'Mie Goreng Jawa Pedas Manis',
    category: 'Makanan',
    price: 22000,
    description: 'Mie kuning kenyal dimasak dengan kobis, tauge, potongan ayam, dan kecap manis khas pedas.',
    imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80',
    available: true
  },
  {
    name: 'Sate Ayam Madura (10 Tusuk)',
    category: 'Makanan',
    price: 30000,
    description: 'Sate ayam empuk disiram bumbu kacang kental gurih, kecap manis, dan taburan bawang goreng.',
    imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    available: true
  },
  {
    name: 'Ayam Geprek Sambal Matah',
    category: 'Makanan',
    price: 24000,
    description: 'Ayam crispy renyah digeprek dengan sambal matah segar beraroma serai dan daun jeruk.',
    imageUrl: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80',
    available: true
  },
  {
    name: 'Es Teh Manis Segar',
    category: 'Minuman',
    price: 5000,
    description: 'Teh melati pilihan disajikan dingin dengan es batu segar penhilang dahaga.',
    imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80',
    available: true
  },
  {
    name: 'Es Jeruk Peras Murni',
    category: 'Minuman',
    price: 8000,
    description: 'Jeruk segar pilihan diperas langsung dengan tambahan gula asli dan es batu.',
    imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80',
    available: true
  },
  {
    name: 'Jus Alpukat Cokelat',
    category: 'Minuman',
    price: 15000,
    description: 'Jus alpukat kental berpadu dengan susu kental manis cokelat legit.',
    imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80',
    available: true
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'customer' | 'tracking' | 'warung' | 'reports'>('customer');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Auth state
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('pesendong_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Auth Modal state (Login / Register with role selection)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authRole, setAuthRole] = useState<'pelanggan' | 'warung'>('pelanggan');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authWhatsapp, setAuthWhatsapp] = useState('');
  const [authAddress, setAuthAddress] = useState('');

  // Profile Edit state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    whatsappNumber: '',
    email: '',
    address: '',
    password: ''
  });

  // Customer Cart state
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'Transfer Bank'>('Tunai');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);

  // Tracking state
  const [searchCode, setSearchCode] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);

  // Warung menu editing state
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [isNewMenuModal, setIsNewMenuModal] = useState(false);
  const [newMenuForm, setNewMenuForm] = useState({
    name: '',
    category: 'Makanan' as 'Makanan' | 'Minuman',
    price: 20000,
    description: '',
    imageUrl: '',
    available: true
  });

  // Filter menu
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | 'Makanan' | 'Minuman'>('Semua');
  const [searchMenuQuery, setSearchMenuQuery] = useState('');

  // Sync user to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('pesendong_current_user', JSON.stringify(currentUser));
      if (currentUser.role === 'warung') {
        setActiveTab('warung');
      } else {
        setActiveTab('customer');
      }
    } else {
      localStorage.removeItem('pesendong_current_user');
    }
  }, [currentUser]);

  // Fetch Menu and Orders in Real-time from Firestore
  useEffect(() => {
    setLoading(true);
    
    // Listen to Menu
    const menuQuery = query(collection(db, 'menu'));
    const unsubscribeMenu = onSnapshot(menuQuery, async (snapshot) => {
      const items: MenuItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as MenuItem);
      });

      if (items.length === 0) {
        const hasInitialized = localStorage.getItem('pesendong_initialized');
        if (!hasInitialized) {
          localStorage.setItem('pesendong_initialized', 'true');
          try {
            for (const defItem of DEFAULT_MENU) {
              await addDoc(collection(db, 'menu'), defItem);
            }
          } catch (err) {
            console.error("Error seeding default menu:", err);
          }
        } else {
          setMenuItems([]);
        }
      } else {
        setMenuItems(items);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to menu:", error);
      setLoading(false);
    });

    // Listen to Orders
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const fetchedOrders: Order[] = [];
      snapshot.forEach((docSnap) => {
        fetchedOrders.push({ id: docSnap.id, ...docSnap.data() } as Order);
      });
      setOrders(fetchedOrders);
    }, (error) => {
      console.error("Error listening to orders:", error);
    });

    return () => {
      unsubscribeMenu();
      unsubscribeOrders();
    };
  }, []);

  // Auth Handlers with Role Selection
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'register') {
      if (!authName || !authWhatsapp || !authEmail || !authPassword) {
        alert('Mohon lengkapi Nama, Nomor WhatsApp Aktif, Email, dan Password!');
        return;
      }
      if (authWhatsapp.length < 9) {
        alert('Nomor WhatsApp tidak valid. Masukkan nomor WhatsApp aktif yang benar.');
        return;
      }

      try {
        const newUser: UserAccount = {
          id: 'user_' + Date.now(),
          name: authName.trim(),
          whatsappNumber: authWhatsapp.trim(),
          email: authEmail.trim(),
          password: authPassword,
          role: authRole,
          address: authAddress.trim(),
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', newUser.id), newUser);
        setCurrentUser(newUser);
        setShowAuthModal(false);
        alert(`Registrasi berhasil sebagai ${authRole === 'warung' ? 'Warung' : 'Pelanggan'}! Selamat datang di PesenDong.`);
      } catch (err) {
        console.error("Error registering user:", err);
        alert('Gagal registrasi. Silakan coba lagi.');
      }
    } else {
      if (!authEmail || !authPassword) {
        alert('Masukkan Email dan Password!');
        return;
      }

      // Check Superadmin credentials
      if (authEmail.trim().toLowerCase() === 'order.bangben@gmail.com' && authPassword === 'BangsaT220483') {
        const superAdminUser: UserAccount = {
          id: 'superadmin_bangben',
          name: 'Superadmin PesenDong',
          whatsappNumber: '081234567890',
          email: 'order.bangben@gmail.com',
          role: 'warung',
          address: 'Pusat PesenDong Express',
          createdAt: new Date().toISOString()
        };
        setCurrentUser(superAdminUser);
        setShowAuthModal(false);
        alert('Login berhasil sebagai Superadmin (Warung)!');
        return;
      }

      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let foundUser: UserAccount | null = null;
        usersSnap.forEach((d) => {
          const u = d.data() as UserAccount;
          if (u.email === authEmail.trim() && u.password === authPassword) {
            foundUser = { ...u, id: d.id };
          }
        });

        if (foundUser) {
          setCurrentUser(foundUser);
          setShowAuthModal(false);
          alert(`Selamat datang kembali, ${(foundUser as UserAccount).name}!`);
        } else {
          alert('Email atau password salah! Atau akun belum terdaftar.');
        }
      } catch (err) {
        console.error("Error logging in:", err);
        alert('Gagal login. Silakan coba lagi.');
      }
    }
  };

  // Update Profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!profileForm.whatsappNumber || profileForm.whatsappNumber.length < 9) {
        alert('Nomor WhatsApp aktif wajib diisi dengan benar!');
        return;
    }

    try {
      const updatedUser: UserAccount = {
        ...currentUser,
        name: profileForm.name.trim(),
        whatsappNumber: profileForm.whatsappNumber.trim(),
        email: profileForm.email.trim(),
        address: profileForm.address.trim(),
        password: profileForm.password ? profileForm.password : currentUser.password
      };

      await setDoc(doc(db, 'users', currentUser.id), updatedUser);
      setCurrentUser(updatedUser);
      setShowProfileModal(false);
      alert('Profil berhasil diperbarui!');
    } catch (err) {
      console.error("Error updating profile:", err);
      alert('Gagal memperbarui profil.');
    }
  };

  // Cart operations
  const addToCart = (item: MenuItem) => {
    if (!currentUser || currentUser.role !== 'pelanggan') {
      setShowAuthModal(true);
      setAuthRole('pelanggan');
      setAuthMode('login');
      alert('Silakan login sebagai Pelanggan terlebih dahulu untuk memesan.');
      return;
    }

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(ci => ci.menuId === item.id);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex].quantity += 1;
        return updated;
      } else {
        return [...prevCart, {
          menuId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1
        }];
      }
    });
  };

  const updateCartQuantity = (menuId: string, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(ci => {
        if (ci.menuId === menuId) {
          const newQty = ci.quantity + delta;
          return newQty > 0 ? { ...ci, quantity: newQty } : null;
        }
        return ci;
      }).filter(Boolean) as OrderItem[];
    });
  };

  const removeFromCart = (menuId: string) => {
    setCart(prevCart => prevCart.filter(ci => ci.menuId !== menuId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = 10000;
  const grandTotal = cartTotal > 0 ? cartTotal + deliveryFee : 0;

  // Submit Order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'pelanggan') {
      setShowAuthModal(true);
      alert('Silakan Login sebagai Pelanggan terlebih dahulu untuk melakukan pemesanan!');
      return;
    }
    if (!currentUser.whatsappNumber || currentUser.whatsappNumber.length < 9) {
      alert('Akun Anda belum memiliki Nomor WhatsApp Aktif. Silakan lengkapi profil Anda terlebih dahulu.');
      setShowProfileModal(true);
      setProfileForm({
        name: currentUser.name,
        whatsappNumber: currentUser.whatsappNumber || '',
        email: currentUser.email,
        address: currentUser.address || '',
        password: ''
      });
      return;
    }
    if (cart.length === 0) {
      alert('Keranjang belanja masih kosong! Pilih menu makanan atau minuman terlebih dahulu.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const orderCode = 'PD-' + Math.floor(1000 + Math.random() * 9000);
      const newOrderData: Omit<Order, 'id'> = {
        orderCode,
        customerName: currentUser.name,
        customerPhone: currentUser.whatsappNumber,
        deliveryAddress: currentUser.address || 'Alamat tidak diset',
        items: cart,
        totalAmount: grandTotal,
        paymentMethod,
        paymentStatus: (paymentMethod === 'Transfer Bank' ? 'Lunas' : 'Belum Lunas') as 'Lunas' | 'Belum Lunas',
        status: 'Menunggu Konfirmasi',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'orders'), newOrderData);
      const placedOrder: Order = { id: docRef.id, ...newOrderData };
      setLastPlacedOrder(placedOrder);

      // WhatsApp notification link generation to Warung
      const waMessage = encodeURIComponent(
        `Halo Warung PesenDong! Ada pesanan baru:\n\n` +
        `No. Pesanan: *${orderCode}*\n` +
        `Nama Pelanggan: *${currentUser.name}*\n` +
        `No. WA: *${currentUser.whatsappNumber}*\n` +
        `Alamat: *${currentUser.address}*\n\n` +
        `Pesanan:\n` +
        cart.map(i => `- ${i.name} x${i.quantity} (Rp ${(i.price * i.quantity).toLocaleString()})`).join('\n') +
        `\n\nTotal: *Rp ${grandTotal.toLocaleString()}*\n` +
        `Metode Pembayaran: *${paymentMethod}*\n\n` +
        `Mohon segera diproses ya Kak. Terima kasih!`
      );

      window.open(`https://wa.me/6281234567890?text=${waMessage}`, '_blank');

      setCart([]);
      setActiveTab('tracking');
      setSearchCode(orderCode);
      setTrackedOrder(placedOrder);
    } catch (err) {
      console.error("Error placing order:", err);
      alert('Gagal membuat pesanan. Silakan coba lagi.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Search order for tracking
  const handleSearchTracking = (codeToSearch?: string) => {
    const code = (codeToSearch !== undefined ? codeToSearch : searchCode).trim().toUpperCase();
    if (!code) return;
    const found = orders.find(o => o.orderCode.toUpperCase() === code || o.customerPhone.includes(code));
    if (found) {
      setTrackedOrder(found);
    } else {
      alert('Pesanan dengan kode atau nomor HP tersebut tidak ditemukan.');
      setTrackedOrder(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
    } catch (err) {
      console.error("Error updating order status:", err);
      alert('Gagal mengupdate status pesanan.');
    }
  };

  const handleUpdatePaymentStatus = async (orderId: string, newPaymentStatus: Order['paymentStatus']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { paymentStatus: newPaymentStatus });
    } catch (err) {
      console.error("Error updating payment status:", err);
      alert('Gagal mengupdate status pembayaran.');
    }
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuForm.name || !newMenuForm.price) {
      alert('Nama dan harga menu wajib diisi!');
      return;
    }

    try {
      const payload = {
        name: newMenuForm.name,
        category: newMenuForm.category,
        price: Number(newMenuForm.price),
        description: newMenuForm.description,
        imageUrl: newMenuForm.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        available: newMenuForm.available
      };

      if (editingMenuItem) {
        await updateDoc(doc(db, 'menu', editingMenuItem.id), payload);
        setEditingMenuItem(null);
      } else {
        await addDoc(collection(db, 'menu'), payload);
      }

      setNewMenuForm({
        name: '',
        category: 'Makanan',
        price: 20000,
        description: '',
        imageUrl: '',
        available: true
      });
      setIsNewMenuModal(false);
    } catch (err) {
      console.error("Error saving menu:", err);
      alert('Gagal menyimpan menu.');
    }
  };

  const handleDeleteMenu = async (id: string) => {
    if (confirm('Yakin ingin menghapus menu ini?')) {
      try {
        await deleteDoc(doc(db, 'menu', id));
      } catch (err) {
        console.error("Error deleting menu:", err);
        alert('Gagal menghapus menu.');
      }
    }
  };

  const startEditMenu = (item: MenuItem) => {
    setEditingMenuItem(item);
    setNewMenuForm({
      name: item.name,
      category: item.category,
      price: item.price,
      description: item.description,
      imageUrl: item.imageUrl,
      available: item.available
    });
    setIsNewMenuModal(true);
  };

  const exportToExcel = () => {
    const completedOrders = orders.filter(o => o.status === 'Selesai');
    const dataToExport = completedOrders.map(o => ({
      'Kode Pesanan': o.orderCode,
      'Nama Pelanggan': o.customerName,
      'No. WhatsApp': o.customerPhone,
      'Alamat': o.deliveryAddress,
      'Total (Rp)': o.totalAmount,
      'Metode Pembayaran': o.paymentMethod,
      'Status Pembayaran': o.paymentStatus,
      'Waktu Pesan': new Date(o.createdAt).toLocaleString('id-ID')
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Penjualan");
    XLSX.writeFile(workbook, `Laporan_Penjualan_PesenDong_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToCSV = () => {
    const completedOrders = orders.filter(o => o.status === 'Selesai');
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Kode Pesanan,Nama Pelanggan,No WhatsApp,Alamat,Total,Metode Pembayaran,Status Pembayaran,Waktu\r\n";
    
    completedOrders.forEach(o => {
      const row = [
        o.orderCode,
        `"${o.customerName}"`,
        `"${o.customerPhone}"`,
        `"${o.deliveryAddress.replace(/"/g, '""')}"`,
        o.totalAmount,
        o.paymentMethod,
        o.paymentStatus,
        `"${new Date(o.createdAt).toLocaleString('id-ID')}"`
      ].join(",");
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Penjualan_PesenDong_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredMenu = menuItems.filter(item => {
    const matchCat = selectedCategory === 'Semua' || item.category === selectedCategory;
    const matchQuery = item.name.toLowerCase().includes(searchMenuQuery.toLowerCase()) || 
                       item.description.toLowerCase().includes(searchMenuQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* 
        LANDING PAGE / NOT LOGGED IN: NO NAVBAR. Only clean brand header with Login/Register trigger.
        LOGGED IN AS PELANGGAN: Customer Navbar (Menu, Lacak Pesanan, Profile, Logout).
        LOGGED IN AS WARUNG: Warung Navbar (Dashboard Warung, Kelola Menu, Laporan, Profile Warung, Logout).
      */}
      <header className="bg-orange-600 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => {
            if (currentUser?.role === 'warung') setActiveTab('warung');
            else setActiveTab('customer');
          }}>
            <div className="bg-white text-orange-600 p-2 rounded-2xl shadow-md">
              <Utensils className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-wider flex items-center gap-1">
                PesenDong <span className="text-xs bg-amber-300 text-orange-900 px-2 py-0.5 rounded-full font-bold">Express</span>
              </h1>
              <p className="text-xs text-orange-100">Pesan Antar Makanan & Minuman Real-time</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser && currentUser.role === 'pelanggan' && (
              <nav className="flex items-center gap-2 overflow-x-auto py-1">
                <button 
                  onClick={() => setActiveTab('customer')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
                    activeTab === 'customer' ? 'bg-white text-orange-600 shadow' : 'text-orange-50 hover:bg-orange-700'
                  }`}
                >
                  <Utensils className="w-4 h-4" /> Menu
                </button>
                <button 
                  onClick={() => setActiveTab('tracking')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
                    activeTab === 'tracking' ? 'bg-white text-orange-600 shadow' : 'text-orange-50 hover:bg-orange-700'
                  }`}
                >
                  <Truck className="w-4 h-4" /> Lacak Pesanan
                </button>
              </nav>
            )}

            {currentUser && currentUser.role === 'warung' && (
              <nav className="flex items-center gap-2 overflow-x-auto py-1">
                <button 
                  onClick={() => setActiveTab('warung')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
                    activeTab === 'warung' ? 'bg-white text-orange-600 shadow' : 'text-orange-50 hover:bg-orange-700'
                  }`}
                >
                  <Store className="w-4 h-4" /> Dashboard Warung
                </button>
                <button 
                  onClick={() => setActiveTab('reports')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
                    activeTab === 'reports' ? 'bg-white text-orange-600 shadow' : 'text-orange-50 hover:bg-orange-700'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" /> Laporan Penjualan
                </button>
              </nav>
            )}

            {/* Profile / Auth Button */}
            <div className={`${currentUser ? 'border-l border-orange-500 pl-3' : ''}`}>
              {currentUser ? (
                <div className="flex items-center gap-2 bg-orange-700/60 px-3 py-1.5 rounded-2xl border border-orange-500/40">
                  <div className="w-7 h-7 bg-white text-orange-600 rounded-full flex items-center justify-center font-bold text-xs shadow">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block text-left text-xs">
                    <p className="font-bold text-white truncate max-w-[100px]">{currentUser.name}</p>
                    <p className="text-[10px] text-orange-200 capitalize">Role: {currentUser.role}</p>
                  </div>
                  <button
                    onClick={() => {
                      setProfileForm({
                        name: currentUser.name,
                        whatsappNumber: currentUser.whatsappNumber,
                        email: currentUser.email,
                        address: currentUser.address,
                        password: ''
                      });
                      setShowProfileModal(true);
                    }}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition"
                    title="Edit Profil"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentUser(null)}
                    className="p-1.5 bg-white/10 hover:bg-red-600 rounded-lg text-white transition"
                    title="Keluar"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                    className="px-4 py-2 bg-white text-orange-600 hover:bg-orange-50 rounded-xl text-xs font-black shadow transition flex items-center gap-1.5"
                  >
                    <User className="w-4 h-4" /> Login
                  </button>
                  <button
                    onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                    className="px-4 py-2 bg-amber-400 text-orange-950 hover:bg-amber-300 rounded-xl text-xs font-black shadow transition flex items-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" /> Register
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-600 font-medium">Memuat menu dan data pesanan dari Firebase...</p>
          </div>
        ) : (
          <>
            {/* 1. LANDING PAGE (WHEN NOT LOGGED IN) */}
            {!currentUser && (
              <div className="space-y-8 py-4">
                {/* Landing Banner & Quick Register/Login Card */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                  <div className="lg:col-span-2 space-y-4">
                    <span className="bg-white/20 text-white text-xs font-bold px-3.5 py-1 rounded-full uppercase tracking-wider">
                      Selamat Datang di PesenDong Express
                    </span>
                    <h2 className="text-3xl md:text-5xl font-black leading-tight">Lapar? PesenDong Aja!</h2>
                    <p className="text-orange-100 text-base leading-relaxed max-w-xl">
                      Pesan makanan & minuman favoritmu dari warung terbaik secara real-time. Nikmati pengiriman cepat dan pelacakan pesanan instan.
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                        className="px-6 py-3.5 bg-white text-orange-600 font-black rounded-2xl shadow-lg hover:bg-orange-50 transition flex items-center gap-2"
                      >
                        <UserPlus className="w-5 h-5" /> Daftar Akun Baru Sekarang
                      </button>
                      <button
                        onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                        className="px-6 py-3.5 bg-orange-700/80 hover:bg-orange-700 text-white font-black rounded-2xl shadow-lg transition flex items-center gap-2 border border-orange-400/40"
                      >
                        <User className="w-5 h-5" /> Login Pelanggan / Warung
                      </button>
                    </div>
                  </div>

                  <div className="hidden lg:flex justify-center">
                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center space-y-3">
                      <Store className="w-16 h-16 text-white mx-auto animate-pulse" />
                      <h3 className="text-lg font-bold">Mitra Warung & Pelanggan</h3>
                      <p className="text-xs text-orange-100">Satu platform terintegrasi untuk pesan antar kuliner nusantara.</p>
                    </div>
                  </div>
                </div>

                {/* Landing Menu Catalog Section */}
                <div className="space-y-4 pt-4">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-800">Menu Makanan & Minuman Tersedia</h3>
                      <p className="text-xs text-slate-500">Pilih menu favoritmu. Login sebagai Pelanggan untuk mulai memesan.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      {(['Semua', 'Makanan', 'Minuman'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-semibold transition ${
                            selectedCategory === cat 
                              ? 'bg-orange-600 text-white shadow-md' 
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Menu Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredMenu.map((item) => (
                      <div 
                        key={item.id} 
                        className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between group"
                      >
                        <div className="relative h-48 overflow-hidden bg-slate-100">
                          <img 
                            src={item.imageUrl} 
                            alt={item.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            onError={(e)=>{
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
                            }}
                          />
                          <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-lg">
                            {item.category}
                          </span>
                        </div>
                        
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-bold text-slate-800 text-base line-clamp-1">{item.name}</h4>
                            <p className="text-slate-500 text-xs mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                          </div>
                          
                          <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                            <span className="font-black text-orange-600 text-base">
                              Rp {item.price.toLocaleString()}
                            </span>
                            <button 
                              onClick={() => {
                                setShowAuthModal(true);
                                setAuthMode('login');
                              }}
                              className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow transition"
                            >
                              Login untuk Pesan
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. CUSTOMER VIEW (LOGGED IN AS PELANGGAN) */}
            {currentUser && currentUser.role === 'pelanggan' && activeTab === 'customer' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Menu Catalog & Search */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Hero Banner */}
                  <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute right-0 bottom-0 opacity-15 translate-x-10 translate-y-10">
                      <ChefHat className="w-64 h-64" />
                    </div>
                    <div className="relative z-10 max-w-lg">
                      <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Halo, {currentUser.name}!
                      </span>
                      <h2 className="text-3xl md:text-4xl font-black mt-3 mb-2">Pilih Menu Favoritmu</h2>
                      <p className="text-orange-100 text-sm leading-relaxed">
                        Tambahkan item ke keranjang dan kirim pesanan langsung ke Warung secara real-time.
                      </p>
                    </div>
                  </div>

                  {/* Search and Category Filter */}
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input 
                        type="text" 
                        placeholder="Cari makanan atau minuman..." 
                        value={searchMenuQuery}
                        onChange={(e) => setSearchMenuQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
                      />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      {(['Semua', 'Makanan', 'Minuman'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-semibold transition ${
                            selectedCategory === cat 
                              ? 'bg-orange-600 text-white shadow-md' 
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Food Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredMenu.length === 0 ? (
                      <div className="col-span-2 text-center py-12 bg-white rounded-2xl border border-slate-200">
                        <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                        <p className="text-slate-600 font-medium">Menu tidak ditemukan.</p>
                      </div>
                    ) : (
                      filteredMenu.map((item) => (
                        <div 
                          key={item.id} 
                          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between group"
                        >
                          <div className="relative h-44 overflow-hidden bg-slate-100">
                            <img 
                              src={item.imageUrl} 
                              alt={item.name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              onError={(e)=>{
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
                              }}
                            />
                            <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-lg">
                              {item.category}
                            </span>
                            {!item.available && (
                              <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
                                <span className="bg-red-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl uppercase tracking-wider">
                                  Habis / Kosong
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="p-4 flex-1 flex flex-col justify-between">
                            <div>
                              <h3 className="font-bold text-slate-800 text-lg line-clamp-1">{item.name}</h3>
                              <p className="text-slate-500 text-xs mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                            </div>
                            
                            <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                              <span className="font-black text-orange-600 text-base">
                                Rp {item.price.toLocaleString()}
                              </span>
                              <button 
                                onClick={() => addToCart(item)}
                                disabled={!item.available}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                                  item.available 
                                    ? 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer active:scale-95' 
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                <Plus className="w-4 h-4" /> Tambah
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Checkout & Cart Sidebar */}
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sticky top-24">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-orange-600" /> Keranjang Pesanan
                      </h3>
                      <span className="bg-orange-100 text-orange-700 font-bold text-xs px-2.5 py-1 rounded-full">
                        {cart.reduce((sum, i) => sum + i.quantity, 0)} Item
                      </span>
                    </div>

                    {cart.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium text-sm">Keranjang masih kosong</p>
                        <p className="text-slate-400 text-xs mt-1">Pilih menu favoritmu dengan menekan tombol "+"</p>
                      </div>
                    ) : (
                      <div className="space-y-6 mt-4">
                        {/* Cart items list */}
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                          {cart.map((item) => (
                            <div key={item.menuId} className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                              <div className="flex-1">
                                <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{item.name}</h4>
                                <span className="text-xs text-orange-600 font-semibold">Rp {(item.price * item.quantity).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => updateCartQuantity(item.menuId, -1)}
                                  className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                                <button 
                                  onClick={() => updateCartQuantity(item.menuId, 1)}
                                  className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => removeFromCart(item.menuId)}
                                  className="text-red-500 hover:text-red-700 ml-1 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Customer Info Box */}
                        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3.5 space-y-1 text-xs">
                          <div className="flex justify-between font-bold text-orange-900">
                            <span>Pemesan: {currentUser.name}</span>
                            <button 
                              onClick={() => {
                                setProfileForm({
                                  name: currentUser.name,
                                  whatsappNumber: currentUser.whatsappNumber,
                                  email: currentUser.email,
                                  address: currentUser.address,
                                  password: ''
                                });
                                setShowProfileModal(true);
                              }}
                              className="text-[11px] text-orange-600 underline font-semibold"
                            >
                              Edit Profil
                            </button>
                          </div>
                          <p className="text-slate-600">No. WA: <strong className="font-mono">{currentUser.whatsappNumber || 'Belum diisi'}</strong></p>
                          <p className="text-slate-600">Alamat: {currentUser.address || 'Belum diisi (Klik Edit Profil)'}</p>
                        </div>

                        {/* Payment Method */}
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-slate-600">Metode Pembayaran</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setPaymentMethod('Tunai')}
                              className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                                paymentMethod === 'Tunai'
                                  ? 'bg-orange-50 border-orange-500 text-orange-700'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              <DollarSign className="w-4 h-4" /> Tunai (COD)
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentMethod('Transfer Bank')}
                              className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                                paymentMethod === 'Transfer Bank'
                                  ? 'bg-orange-50 border-orange-500 text-orange-700'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              <QrCode className="w-4 h-4" /> Transfer Bank
                            </button>
                          </div>
                          {paymentMethod === 'Transfer Bank' && (
                            <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                              <p className="font-bold">Transfer ke Rekening Resmi PesenDong:</p>
                              <p>BCA: <span className="font-mono font-bold">1234-5678-90</span> (a.n PT PesenDong Indonesia)</p>
                            </div>
                          )}
                        </div>

                        {/* Summary calculation */}
                        <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>Subtotal</span>
                            <span>Rp {cartTotal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Ongkos Kirim</span>
                            <span>Rp {deliveryFee.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-slate-900 font-black text-base pt-2 border-t border-dashed border-slate-200">
                            <span>Total Pembayaran</span>
                            <span className="text-orange-600">Rp {grandTotal.toLocaleString()}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handlePlaceOrder}
                          disabled={submittingOrder}
                          className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          {submittingOrder ? (
                            <>Memproses Pesanan...</>
                          ) : (
                            <>Kirim Pesanan Sekarang <ArrowRight className="w-4 h-4" /></>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TRACKING TAB */}
            {currentUser && currentUser.role === 'pelanggan' && activeTab === 'tracking' && (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 text-center space-y-4">
                  <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <Truck className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">Lacakan Pesanan Real-Time</h2>
                  <p className="text-slate-500 text-sm max-w-md mx-auto">
                    Masukkan Kode Pesanan (cth: #PD-XXXX) atau nomor WhatsApp Anda untuk memantau status pesanan secara langsung.
                  </p>

                  <div className="flex gap-2 max-w-md mx-auto pt-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input 
                        type="text" 
                        placeholder="Cth: PD-4821" 
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase font-mono font-bold"
                      />
                    </div>
                    <button 
                      onClick={() => handleSearchTracking()}
                      className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow transition"
                    >
                      Cari
                    </button>
                  </div>
                </div>

                {lastPlacedOrder && !trackedOrder && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">Pesanan Baru Berhasil Dibuat!</p>
                      <p className="text-xs text-emerald-700">Kode Pesanan: <span className="font-mono font-bold">{lastPlacedOrder.orderCode}</span></p>
                    </div>
                    <button 
                      onClick={() => { setSearchCode(lastPlacedOrder.orderCode); setTrackedOrder(lastPlacedOrder); }}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg"
                    >
                      Lacak Sekarang
                    </button>
                  </div>
                )}

                {trackedOrder && (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 space-y-6">
                    <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kode Pesanan</span>
                        <h3 className="text-2xl font-black font-mono text-orange-600">{trackedOrder.orderCode}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Saat Ini</span>
                        <div>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-1 ${
                            trackedOrder.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' :
                            trackedOrder.status === 'Dibatalkan' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-800 animate-pulse'
                          }`}>
                            {trackedOrder.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline stepper */}
                    <div className="py-4">
                      <div className="grid grid-cols-3 gap-2 relative">
                        {[
                          { title: 'Menunggu', desc: 'Pesanan diterima' },
                          { title: 'Diproses', desc: 'Dimasak koki' },
                          { title: 'Pengiriman', desc: 'Kurir menuju lokasi' },
                        ].map((step, idx) => {
                          const statusOrder = ['Menunggu Konfirmasi', 'Diproses', 'Dalam Pengiriman', 'Selesai'];
                          const currentIndex = statusOrder.indexOf(trackedOrder.status);
                          const isDone = currentIndex >= idx + 1 || trackedOrder.status === 'Selesai';
                          const isCurrent = (currentIndex === idx) || (idx === 0 && trackedOrder.status === 'Menunggu Konfirmasi');

                          return (
                            <div key={step.title} className="text-center relative">
                              <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center font-bold text-xs mb-2 transition ${
                                isDone ? 'bg-emerald-600 text-white shadow-md' :
                                isCurrent ? 'bg-orange-600 text-white shadow-lg animate-bounce' :
                                'bg-slate-200 text-slate-500'
                              }`}>
                                {isDone ? <Check className="w-5 h-5" /> : idx + 1}
                              </div>
                              <h4 className="font-bold text-xs text-slate-800">{step.title}</h4>
                              <p className="text-[10px] text-slate-500 mt-0.5">{step.desc}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Order detail breakdown */}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-3 text-sm">
                      <div className="flex justify-between text-xs text-slate-500 pb-2 border-b border-slate-200">
                        <span>Nama Pemesan: <strong className="text-slate-800">{trackedOrder.customerName}</strong></span>
                        <span>No. WA: <strong className="text-slate-800">{trackedOrder.customerPhone}</strong></span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">Alamat Pengiriman:</p>
                        <p className="text-slate-800 font-medium text-xs bg-white p-2.5 rounded-xl border border-slate-200">{trackedOrder.deliveryAddress}</p>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <p className="text-xs font-semibold text-slate-500">Rincian Menu:</p>
                        {trackedOrder.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="text-slate-700">{item.name} x{item.quantity}</span>
                            <span className="font-semibold text-slate-900">Rp {(item.price * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-slate-200 font-bold">
                        <span>Total Pembayaran ({trackedOrder.paymentMethod})</span>
                        <span className="text-orange-600 text-base">Rp {trackedOrder.totalAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Status Pembayaran:</span>
                        <span className={`font-bold px-2 py-0.5 rounded-md ${trackedOrder.paymentStatus === 'Lunas' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {trackedOrder.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. WARUNG VIEW (LOGGED IN AS WARUNG) */}
            {currentUser && currentUser.role === 'warung' && activeTab === 'warung' && (
              <div className="space-y-8">
                {/* Warung Header */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 w-fit">
                      <Store className="w-3.5 h-3.5" /> Dashboard Warung Aktif
                    </span>
                    <h2 className="text-2xl font-black text-slate-800 mt-1">Halo, {currentUser.name} (Warung)</h2>
                    <p className="text-xs text-slate-500">No. WA Warung: {currentUser.whatsappNumber} | Email: {currentUser.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setProfileForm({
                          name: currentUser.name,
                          whatsappNumber: currentUser.whatsappNumber,
                          email: currentUser.email,
                          address: currentUser.address,
                          password: ''
                        });
                        setShowProfileModal(true);
                      }}
                      className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-xl flex items-center gap-2 transition"
                    >
                      <Settings className="w-4 h-4" /> Edit Profil Warung
                    </button>
                    <button 
                      onClick={() => setCurrentUser(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 transition"
                    >
                      <LogOut className="w-4 h-4" /> Keluar
                    </button>
                  </div>
                </div>

                {/* SECTION A: Incoming Orders Management */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-orange-600" /> Daftar Pesanan Masuk ({orders.length})
                    </h3>
                    <span className="text-xs text-slate-500">Pembaruan otomatis real-time</span>
                  </div>

                  {/* Mobile View: Cards */}
                  <div className="block md:hidden space-y-4">
                    {orders.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">Belum ada pesanan masuk.</div>
                    ) : (
                      orders.map((o) => (
                        <div key={o.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                          <div className="flex justify-between items-start pb-2 border-b border-slate-200">
                            <div>
                              <span className="font-mono font-bold text-orange-600 text-base">{o.orderCode}</span>
                              <div className="text-[10px] text-slate-400">
                                {new Date(o.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={o.status}
                                onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value as any)}
                                className={`text-xs font-bold px-2 py-1.5 rounded-xl border ${
                                  o.status === 'Selesai' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
                                  o.status === 'Dibatalkan' ? 'bg-red-50 border-red-300 text-red-800' :
                                  'bg-orange-50 border-orange-300 text-orange-800'
                                }`}
                              >
                                <option value="Menunggu Konfirmasi">Menunggu Konfirmasi</option>
                                <option value="Diproses">Diproses (Masak)</option>
                                <option value="Dalam Pengiriman">Dalam Pengiriman</option>
                                <option value="Selesai">Selesai</option>
                                <option value="Dibatalkan">Dibatalkan</option>
                              </select>
                            </div>
                          </div>

                          <div className="text-xs space-y-1">
                            <p className="font-bold text-slate-800 text-sm">{o.customerName} <span className="text-slate-500 font-normal">({o.customerPhone})</span></p>
                            <p className="text-slate-600 text-[11px] bg-white p-2 rounded-xl border border-slate-100">{o.deliveryAddress}</p>
                          </div>

                          <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-100 text-xs">
                            <p className="font-bold text-slate-700 text-[11px]">Rincian Pesanan:</p>
                            {o.items.map((i, idx) => (
                              <div key={idx} className="flex justify-between text-slate-600">
                                <span>- {i.name}</span>
                                <span className="font-bold">x{i.quantity}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                            <div>
                              <div className="font-black text-orange-600 text-sm">Rp {o.totalAmount.toLocaleString()}</div>
                              <div className="text-[10px] text-slate-500">{o.paymentMethod}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={o.paymentStatus}
                                onChange={(e) => handleUpdatePaymentStatus(o.id, e.target.value as any)}
                                className={`text-[10px] font-bold px-2 py-1 rounded border ${
                                  o.paymentStatus === 'Lunas' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'
                                }`}
                              >
                                <option value="Belum Lunas">Belum Lunas</option>
                                <option value="Lunas">Lunas</option>
                              </select>
                              <a 
                                href={`https://wa.me/${o.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo Kak ${o.customerName}, pesanan PesenDong dengan kode *${o.orderCode}* statusnya saat ini: *${o.status}*. Terima kasih telah memesan!`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition"
                                title="Kirim WhatsApp"
                              >
                                <Phone className="w-3.5 h-3.5" /> WA
                              </a>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Desktop View: Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] font-bold">
                        <tr>
                          <th className="p-3 rounded-l-xl">Kode / Waktu</th>
                          <th className="p-3">Pelanggan & Alamat</th>
                          <th className="p-3">Pesanan</th>
                          <th className="p-3">Total & Bayar</th>
                          <th className="p-3">Status Pesanan</th>
                          <th className="p-3 rounded-r-xl text-center">Aksi WA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-slate-400">Belum ada pesanan masuk.</td>
                          </tr>
                        ) : (
                          orders.map((o) => (
                            <tr key={o.id} className="hover:bg-slate-50/80 transition">
                              <td className="p-3 font-mono font-bold text-orange-600">
                                {o.orderCode}
                                <div className="text-[10px] text-slate-400 font-normal">
                                  {new Date(o.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-800">{o.customerName}</div>
                                <div className="text-xs text-slate-500">{o.customerPhone}</div>
                                <div className="text-[11px] text-slate-400 line-clamp-1">{o.deliveryAddress}</div>
                              </td>
                              <td className="p-3 text-xs">
                                {o.items.map((i, idx) => (
                                  <div key={idx}>- {i.name} ({i.quantity}x)</div>
                                ))}
                              </td>
                              <td className="p-3">
                                <div className="font-black text-slate-800">Rp {o.totalAmount.toLocaleString()}</div>
                                <div className="text-[11px] text-slate-500">{o.paymentMethod}</div>
                                <select
                                  value={o.paymentStatus}
                                  onChange={(e) => handleUpdatePaymentStatus(o.id, e.target.value as any)}
                                  className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                                    o.paymentStatus === 'Lunas' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'
                                  }`}
                                >
                                  <option value="Belum Lunas">Belum Lunas</option>
                                  <option value="Lunas">Lunas</option>
                                </select>
                              </td>
                              <td className="p-3">
                                <select
                                  value={o.status}
                                  onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value as any)}
                                  className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border ${
                                    o.status === 'Selesai' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
                                    o.status === 'Dibatalkan' ? 'bg-red-50 border-red-300 text-red-800' :
                                    'bg-orange-50 border-orange-300 text-orange-800'
                                  }`}
                                >
                                  <option value="Menunggu Konfirmasi">Menunggu Konfirmasi</option>
                                  <option value="Diproses">Diproses (Masak)</option>
                                  <option value="Dalam Pengiriman">Dalam Pengiriman</option>
                                  <option value="Selesai">Selesai</option>
                                  <option value="Dibatalkan">Dibatalkan</option>
                                </select>
                              </td>
                              <td className="p-3 text-center">
                                <a 
                                  href={`https://wa.me/${o.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo Kak ${o.customerName}, pesanan PesenDong dengan kode *${o.orderCode}* statusnya saat ini: *${o.status}*. Terima kasih telah memesan!`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition"
                                  title="Kirim Pesan WhatsApp"
                                >
                                  <Phone className="w-4 h-4" />
                                </a>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION B: Menu Management */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                      <Utensils className="w-5 h-5 text-orange-600" /> Kelola Menu Makanan & Minuman Warung
                    </h3>
                    <button 
                      onClick={() => {
                        setEditingMenuItem(null);
                        setNewMenuForm({
                          name: '',
                          category: 'Makanan',
                          price: 20000,
                          description: '',
                          imageUrl: '',
                          available: true
                        });
                        setIsNewMenuModal(true);
                      }}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2 transition"
                    >
                      <Plus className="w-4 h-4" /> Tambah Menu Baru
                    </button>
                  </div>

                  {/* Menu table */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {menuItems.map((item) => (
                      <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-4 items-center">
                        <img 
                          src={item.imageUrl} 
                          alt={item.name} 
                          className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">{item.category}</span>
                          <h4 className="font-bold text-sm text-slate-800 truncate mt-0.5">{item.name}</h4>
                          <p className="text-xs text-orange-600 font-black">Rp {item.price.toLocaleString()}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <button 
                              onClick={() => startEditMenu(item)}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1"
                            >
                              <Edit className="w-3 h-3" /> Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteMenu(item.id)}
                              className="px-2.5 py-1 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-100 flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. REPORTS TAB (WARUNG ONLY) */}
            {currentUser && currentUser.role === 'warung' && activeTab === 'reports' && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">Laporan Penjualan Harian</h2>
                    <p className="text-slate-500 text-xs mt-1">Unduh laporan transaksi pesanan yang telah selesai dalam format Excel atau CSV.</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={exportToExcel}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2 transition"
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Download Excel
                    </button>
                    <button 
                      onClick={exportToCSV}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2 transition"
                    >
                      <Download className="w-4 h-4" /> Download CSV
                    </button>
                  </div>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pesanan Selesai</span>
                    <h3 className="text-3xl font-black text-slate-800 mt-2">
                      {orders.filter(o => o.status === 'Selesai').length}
                    </h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pendapatan Total Selesai</span>
                    <h3 className="text-3xl font-black text-orange-600 mt-2">
                      Rp {orders.filter(o => o.status === 'Selesai').reduce((sum, o) => sum + o.totalAmount, 0).toLocaleString()}
                    </h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Semua Pesanan Masuk</span>
                    <h3 className="text-3xl font-black text-slate-800 mt-2">{orders.length}</h3>
                  </div>
                </div>

                {/* Completed Orders Table */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <h3 className="text-lg font-black text-slate-800">Riwayat Pesanan Selesai (Siap Export)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] font-bold">
                        <tr>
                          <th className="p-3 rounded-l-xl">Kode</th>
                          <th className="p-3">Pelanggan</th>
                          <th className="p-3">Alamat</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Metode & Status Bayar</th>
                          <th className="p-3 rounded-r-xl">Waktu Selesai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.filter(o => o.status === 'Selesai').length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-slate-400">Belum ada pesanan dengan status Selesai.</td>
                          </tr>
                        ) : (
                          orders.filter(o => o.status === 'Selesai').map((o) => (
                            <tr key={o.id} className="hover:bg-slate-50 transition">
                              <td className="p-3 font-mono font-bold text-orange-600">{o.orderCode}</td>
                              <td className="p-3">
                                <div className="font-bold text-slate-800">{o.customerName}</div>
                                <div className="text-xs text-slate-500">{o.customerPhone}</div>
                              </td>
                              <td className="p-3 text-xs text-slate-600 max-w-xs truncate">{o.deliveryAddress}</td>
                              <td className="p-3 font-bold text-slate-800">Rp {o.totalAmount.toLocaleString()}</td>
                              <td className="p-3 text-xs">
                                <div>{o.paymentMethod}</div>
                                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">{o.paymentStatus}</span>
                              </td>
                              <td className="p-3 text-xs text-slate-500">{new Date(o.createdAt).toLocaleString('id-ID')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Auth Modal (Login / Register with Role Selection) */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                <User className="w-5 h-5 text-orange-600" />
                {authMode === 'login' ? 'Login PesenDong' : 'Registrasi Akun Baru'}
              </h3>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${authMode === 'login' ? 'bg-white text-orange-600 shadow' : 'text-slate-600'}`}
              >
                Sudah Punya Akun (Login)
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${authMode === 'register' ? 'bg-white text-orange-600 shadow' : 'text-slate-600'}`}
              >
                Daftar Baru
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Role / Peran *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthRole('pelanggan')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                      authRole === 'pelanggan'
                        ? 'bg-orange-50 border-orange-500 text-orange-700'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <User className="w-4 h-4" /> Pelanggan
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthRole('warung')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                      authRole === 'warung'
                        ? 'bg-orange-50 border-orange-500 text-orange-700'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <Store className="w-4 h-4" /> Warung
                  </button>
                </div>
              </div>

              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap / Nama Warung *</label>
                    <input 
                      type="text"
                      required
                      placeholder={authRole === 'warung' ? 'cth: Warung Makan Berkah' : 'cth: Siti Rahma'}
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nomor WhatsApp Aktif * (Wajib)</label>
                    <input 
                      type="tel"
                      required
                      placeholder="cth: 08123456789"
                      value={authWhatsapp}
                      onChange={(e) => setAuthWhatsapp(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat Utama / Lokasi Warung</label>
                    <textarea 
                      rows={2}
                      placeholder="cth: Jl. Mawar No. 5, Jakarta..."
                      value={authAddress}
                      onChange={(e) => setAuthAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
                <input 
                  type="email"
                  required
                  placeholder="cth: user@email.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password *</label>
                <input 
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg transition"
                >
                  {authMode === 'login' ? 'Login ke Akun' : 'Daftar & Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {showProfileModal && currentUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-orange-600" /> Edit Profil ({currentUser.role === 'warung' ? 'Warung' : 'Pelanggan'})
              </h3>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama *</label>
                <input 
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nomor WhatsApp Aktif *</label>
                <input 
                  type="tel"
                  required
                  value={profileForm.whatsappNumber}
                  onChange={(e) => setProfileForm({ ...profileForm, whatsappNumber: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
                <input 
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat / Lokasi</label>
                <textarea 
                  rows={2}
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password Baru (Opsional)</label>
                <input 
                  type="password"
                  placeholder="Kosongkan jika tidak ingin mengubah"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow transition"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Menu Modal */}
      {isNewMenuModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-800">
                {editingMenuItem ? 'Edit Menu' : 'Tambah Menu Makanan/Minuman'}
              </h3>
              <button onClick={() => setIsNewMenuModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveMenu} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Menu *</label>
                <input 
                  type="text"
                  required
                  placeholder="Cth: Nasi Goreng Spesial"
                  value={newMenuForm.name}
                  onChange={(e) => setNewMenuForm({ ...newMenuForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori *</label>
                  <select 
                    value={newMenuForm.category}
                    onChange={(e) => setNewMenuForm({ ...newMenuForm, category: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="Makanan">Makanan</option>
                    <option value="Minuman">Minuman</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Harga (Rp) *</label>
                  <input 
                    type="number"
                    required
                    min={0}
                    value={newMenuForm.price}
                    onChange={(e) => setNewMenuForm({ ...newMenuForm, price: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">URL Gambar (Foto Menu) *</label>
                <input 
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/photo-..."
                  value={newMenuForm.imageUrl}
                  onChange={(e) => setNewMenuForm({ ...newMenuForm, imageUrl: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Masukkan URL gambar foto makanan valid.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi Menu</label>
                <textarea 
                  rows={2}
                  placeholder="Deskripsi singkat rasa & bahan..."
                  value={newMenuForm.description}
                  onChange={(e) => setNewMenuForm({ ...newMenuForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox"
                  id="availableCheck"
                  checked={newMenuForm.available}
                  onChange={(e) => setNewMenuForm({ ...newMenuForm, available: e.target.checked })}
                  className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                />
                <label htmlFor="availableCheck" className="text-xs font-semibold text-slate-700">Menu Tersedia (Aktif)</label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsNewMenuModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow transition"
                >
                  Simpan Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-auto">
        <p>© 2026 PesenDong Express. Seluruh hak cipta dilindungi. Real-time Firebase Synchronized.</p>
      </footer>
    </div>
  );
}
