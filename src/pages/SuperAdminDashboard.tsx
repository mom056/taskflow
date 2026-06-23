import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building, Users, Shield, LogOut, 
  Search, Plus, RefreshCcw, X, Edit, CreditCard, Trash2, AlertTriangle,
  TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../contexts/LanguageContext';
import PullToRefresh from '../components/PullToRefresh';
import NotificationCenter from '../components/NotificationCenter';
import { triggerHaptic } from '../lib/nativeServices';
import AppLogo from '../components/AppLogo';

interface CompanyAdminView {
  id: string;
  name: string;
  plan: 'free' | 'basic' | 'premium';
  maxEmployees: number;
  createdAt: number;
  managers: { name: string; email: string }[];
  employeeCount: number;
  isActive: boolean;
}

export default function SuperAdminDashboard() {
  const { signOut, profile } = useAuth();
  const { language } = useTranslation();
  
  const [companies, setCompanies] = useState<CompanyAdminView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'premium' | 'basic' | 'free' | 'active' | 'suspended'>('all');
  
  // Edit modal state
  const [editingCompany, setEditingCompany] = useState<CompanyAdminView | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlan, setEditPlan] = useState<'free' | 'basic' | 'premium'>('free');
  const [editMaxEmployees, setEditMaxEmployees] = useState(5);
  const [isSaving, setIsSaving] = useState(false);

  // Add company modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompPlan, setNewCompPlan] = useState<'free' | 'basic' | 'premium'>('free');
  const [newCompMaxEmp, setNewCompMaxEmp] = useState(5);
  const [isAdding, setIsAdding] = useState(false);

  // Delete confirmation state
  const [deletingCompany, setDeletingCompany] = useState<CompanyAdminView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New confirmation states
  const [isLogoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [suspendingCompany, setSuspendingCompany] = useState<CompanyAdminView | null>(null);

  // Utility to convert Arabic/Persian digits to English digits
  const toEnglishDigits = (str: string) => {
    return str
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/[^0-9]/g, '');
  };

  // Stats
  const stats = useMemo(() => {
    const total = companies.length;
    const basic = companies.filter(c => c.plan === 'basic').length;
    const premium = companies.filter(c => c.plan === 'premium').length;
    const free = companies.filter(c => c.plan === 'free').length;
    const totalEmployees = companies.reduce((acc, c) => acc + c.employeeCount, 0);
    const estimatedMRR = companies.reduce((acc, c) => {
      if (!c.isActive) return acc;
      return acc + (c.plan === 'premium' ? 50 : c.plan === 'basic' ? 20 : 0);
    }, 0);
    return { total, basic, premium, free, totalEmployees, estimatedMRR };
  }, [companies]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch companies
      const { data: companiesData, error: compError } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (compError) throw compError;

      // 2. Fetch users to count employees and extract managers per company
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, role, company_id');

      if (usersError) throw usersError;

      // Build views
      const formatted: CompanyAdminView[] = (companiesData || []).map(comp => {
        const compUsers = (usersData || []).filter(u => u.company_id === comp.id);
        const managers = compUsers
          .filter(u => u.role === 'manager')
          .map(u => ({ 
            name: u.name || (language === 'ar' ? 'مدير جديد' : 'New Manager'), 
            email: u.email 
          }));
        const employeeCount = compUsers.filter(u => u.role === 'employee').length;

        return {
          id: comp.id,
          name: comp.name,
          plan: comp.plan,
          maxEmployees: comp.max_employees,
          createdAt: comp.created_at,
          managers,
          employeeCount,
          isActive: comp.is_active !== false
        };
      });

      setCompanies(formatted);
    } catch (err: any) {
      console.error(err);
      toast.error(language === 'ar' ? 'تعذر جلب بيانات الشركات والاشتراكات' : 'Could not fetch companies and subscription data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const ts = Date.now();
    const companiesChan = supabase
      .channel(`companies_all_${ts}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
        fetchData();
      })
      .subscribe((status, err) => {
        if (err) console.warn('[SuperAdmin] Companies realtime error (non-fatal):', err.message);
      });

    const usersChan = supabase
      .channel(`users_all_${ts}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchData();
      })
      .subscribe((status, err) => {
        if (err) console.warn('[SuperAdmin] Users realtime error (non-fatal):', err.message);
      });

    return () => {
      supabase.removeChannel(companiesChan);
      supabase.removeChannel(usersChan);
    };
  }, []);

  const handleOpenEdit = (comp: CompanyAdminView) => {
    setEditingCompany(comp);
    setEditName(comp.name);
    setEditPlan(comp.plan);
    setEditMaxEmployees(comp.maxEmployees);
  };

  const handleToggleActive = async (comp: CompanyAdminView) => {
    if (comp.isActive) {
      // Prompt confirm dialog for deactivation
      setSuspendingCompany(comp);
      return;
    }

    // Reactivation can happen immediately
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: true })
        .eq('id', comp.id);

      if (error) throw error;

      triggerHaptic('success');
      toast.success(
        language === 'ar' 
          ? `تم تنشيط شركة "${comp.name}"` 
          : `Activated company "${comp.name}"`
      );
      fetchData();
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err.message || (language === 'ar' ? 'تعذر تعديل حالة النشاط للشركة' : 'Could not modify company active status'));
    }
  };

  const confirmToggleActive = async () => {
    if (!suspendingCompany) return;
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: false })
        .eq('id', suspendingCompany.id);

      if (error) throw error;

      triggerHaptic('success');
      toast.success(
        language === 'ar' 
          ? `تم إيقاف شركة "${suspendingCompany.name}" مؤقتاً`
          : `Company "${suspendingCompany.name}" suspended successfully`
      );
      setSuspendingCompany(null);
      fetchData();
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err.message || (language === 'ar' ? 'تعذر تعديل حالة النشاط للشركة' : 'Could not modify company active status'));
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: editName.trim(),
          plan: editPlan,
          max_employees: editMaxEmployees
        })
        .eq('id', editingCompany.id);

      if (error) throw error;

      triggerHaptic('success');
      toast.success(language === 'ar' ? 'تم تحديث الشركة وباقة الاشتراك بنجاح' : 'Company and subscription plan updated successfully');
      setEditingCompany(null);
      fetchData();
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err.message || (language === 'ar' ? 'تعذر تحديث إعدادات الشركة' : 'Could not update company settings'));
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const query = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(query);
      const matchManager = c.managers.some(m => 
        m.name.toLowerCase().includes(query) || m.email.toLowerCase().includes(query)
      );
      const matchesSearch = matchName || matchManager;

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'premium') return c.plan === 'premium';
      if (statusFilter === 'basic') return c.plan === 'basic';
      if (statusFilter === 'free') return c.plan === 'free';
      if (statusFilter === 'active') return c.isActive;
      if (statusFilter === 'suspended') return !c.isActive;
      return true;
    });
  }, [companies, searchQuery, statusFilter]);

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim()) return;

    setIsAdding(true);
    try {
      const slug = newCompName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u0600-\u06FF-]/g, '');
      const { error } = await supabase
        .from('companies')
        .insert([{
          name: newCompName.trim(),
          slug: slug || 'company-' + Date.now(),
          plan: newCompPlan,
          max_employees: newCompMaxEmp,
          created_at: Date.now()
        }]);

      if (error) throw error;

      triggerHaptic('success');
      toast.success(
        language === 'ar' 
          ? `تم إنشاء شركة "${newCompName.trim()}" بنجاح`
          : `Company "${newCompName.trim()}" created successfully`
      );
      setShowAddModal(false);
      setNewCompName('');
      setNewCompPlan('free');
      setNewCompMaxEmp(5);
      fetchData();
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err.message || (language === 'ar' ? 'تعذر إنشاء الشركة' : 'Could not create company'));
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!deletingCompany) return;

    setIsDeleting(true);
    try {
      // Delete all users belonging to this company from auth (cascades to public.users)
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('create-user', {
        body: {
          action: 'delete_company',
          targetCompanyId: deletingCompany.id
        }
      });

      if (edgeError) throw new Error(edgeError.message || 'Failed to delete company users from Auth');
      if (edgeData?.error) throw new Error(edgeData.error);

      // Then delete the company
      const { error: compError } = await supabase
        .from('companies')
        .delete()
        .eq('id', deletingCompany.id);

      if (compError) throw compError;

      triggerHaptic('success');
      toast.success(
        language === 'ar' 
          ? `تم حذف شركة "${deletingCompany.name}" وجميع موظفيها بنجاح`
          : `Company "${deletingCompany.name}" and all its employees deleted successfully`
      );
      setDeletingCompany(null);
      fetchData();
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err.message || (language === 'ar' ? 'تعذر حذف الشركة' : 'Could not delete company'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans overflow-hidden text-slate-900" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* ── SIDEBAR ── */}
      <aside className={`w-[260px] bg-slate-900 text-slate-300 flex-col p-6 shrink-0 z-10 hidden md:flex border-slate-800 ${language === 'ar' ? 'border-l' : 'border-r'}`}>
        <div className="mb-10">
          <AppLogo size={32} theme="dark" showText={true} />
          <div className="text-[10px] text-blue-400 font-semibold mt-1 tracking-wider uppercase">
            {language === 'ar' ? 'لوحة المشرف العام' : 'Super Admin Dashboard'}
          </div>
        </div>

        <nav className="flex flex-col flex-1 gap-1">
          <button className={`flex justify-start items-center px-4 py-3 rounded-xl font-medium border-none bg-blue-600 text-white shadow-md cursor-pointer w-full`}>
            <Building className={`w-5 h-5 ${language === 'ar' ? 'ml-3' : 'mr-3'}`} />
            {language === 'ar' ? 'إدارة الشركات والاشتراكات' : 'Manage Companies'}
          </button>
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-800 space-y-3">
          <Link to="/profile" className={`flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 transition-colors text-slate-300 no-underline cursor-pointer ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            <div className="w-9 h-9 bg-blue-600 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold border border-blue-500 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Super Admin" className="w-full h-full object-cover" />
              ) : (
                (profile?.name || 'M')[0].toUpperCase()
              )}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-semibold truncate text-white leading-tight">{profile?.name || (language === 'ar' ? 'مشرف عام' : 'Super Admin')}</div>
              <div className="text-xs text-slate-500 mt-0.5">Super Admin</div>
            </div>
          </Link>
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="flex items-center text-slate-400 hover:text-red-400 px-2 py-2 transition-colors w-full rounded-lg bg-transparent border-none cursor-pointer hover:bg-slate-800"
          >
            <LogOut className={`w-4 h-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
            <span className="text-sm font-medium">{language === 'ar' ? 'تسجيل خروج' : 'Log Out'}</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Mobile Header */}
        <header className="md:hidden bg-slate-900 text-white px-4 pb-3 safe-pt flex items-center justify-between sticky top-0 z-20 shadow-md">
          <Link to="/profile" className="flex items-center gap-2.5 text-white decoration-none no-underline cursor-pointer">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden border border-blue-500">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Super Admin" className="w-full h-full object-cover" />
              ) : (
                (profile?.name || 'M')[0].toUpperCase()
              )}
            </div>
            <div>
              <span className="text-xs font-bold block leading-none">{profile?.name || (language === 'ar' ? 'مشرف عام' : 'Super Admin')}</span>
              <span className="text-[9px] text-blue-400 font-semibold block mt-0.5">
                {language === 'ar' ? 'لوحة المشرف' : 'Admin Panel'}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <button onClick={() => setLogoutConfirmOpen(true)} className="p-2 hover:bg-slate-800 rounded-full border-none bg-transparent cursor-pointer">
              <LogOut className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex bg-white border-b border-slate-100 px-8 py-4 items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900 m-0">
              {language === 'ar' ? 'التحكم في الشركات والاشتراكات' : 'Companies & Subscriptions'}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5 m-0">
              {language === 'ar' ? 'مراقبة باقات الخدمة لجميع عملاء المنصة' : 'Monitor service packages for all platform clients'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <button 
              onClick={fetchData} 
              className="p-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto relative">
          <PullToRefresh onRefresh={fetchData}>
            <div className="p-4 md:p-8 space-y-6">
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
              <div className="rounded-full h-8 w-8 bg-blue-600 animate-ping" />
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <Building className="w-6 h-6 text-blue-500 mb-2" />
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
              <div className="text-xs text-slate-400 mt-1">
                {language === 'ar' ? 'إجمالي الشركات' : 'Total Companies'}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <Users className="w-6 h-6 text-green-500 mb-2" />
              <div className="text-2xl font-bold text-slate-900">{stats.totalEmployees}</div>
              <div className="text-xs text-slate-400 mt-1">
                {language === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <CreditCard className="w-6 h-6 text-purple-500 mb-2" />
              <div className="text-2xl font-bold text-slate-900">{stats.premium}</div>
              <div className="text-xs text-slate-400 mt-1">
                {language === 'ar' ? 'باقات Premium' : 'Premium Plans'}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <CreditCard className="w-6 h-6 text-amber-500 mb-2" />
              <div className="text-2xl font-bold text-slate-900">{stats.basic}</div>
              <div className="text-xs text-slate-400 mt-1">
                {language === 'ar' ? 'باقات Basic' : 'Basic Plans'}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <CreditCard className="w-6 h-6 text-slate-500 mb-2" />
              <div className="text-2xl font-bold text-slate-900">{stats.free}</div>
              <div className="text-xs text-slate-400 mt-1">
                {language === 'ar' ? 'باقات مجانية' : 'Free Plans'}
              </div>
            </div>
            <div className="bg-linear-to-br from-blue-600 to-indigo-700 p-5 rounded-2xl text-white shadow-md col-span-2 lg:col-span-1">
              <TrendingUp className="w-6 h-6 text-blue-200 mb-2" />
              <div className="text-2xl font-bold">${stats.estimatedMRR}</div>
              <div className="text-xs text-blue-100 mt-1">
                {language === 'ar' ? 'العوائد الشهرية المتوقعة (MRR)' : 'Estimated MRR'}
              </div>
            </div>
          </div>

          {/* Search Table Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base m-0">
                  {language === 'ar' ? 'قائمة الشركات والعملاء' : 'Companies & Clients'}
                </h3>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition border-none cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    {language === 'ar' ? 'إضافة شركة' : 'Add Company'}
                  </button>
                  <div className="relative flex-1 sm:w-72">
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={language === 'ar' ? 'ابحث باسم الشركة أو المدير...' : 'Search by company or manager...'}
                      className={`w-full py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm ${language === 'ar' ? 'pl-3 pr-10' : 'pr-3 pl-10'}`}
                    />
                    <Search className={`absolute top-3 w-4 h-4 text-slate-400 ${language === 'ar' ? 'right-3' : 'left-3'}`} />
                  </div>
                </div>
              </div>

              {/* Filters Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button 
                  onClick={() => setStatusFilter('all')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors border-none cursor-pointer ${
                    statusFilter === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {language === 'ar' ? `الكل (${companies.length})` : `All (${companies.length})`}
                </button>
                <button 
                  onClick={() => setStatusFilter('premium')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors border-none cursor-pointer ${
                    statusFilter === 'premium' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Premium ({companies.filter(c => c.plan === 'premium').length})
                </button>
                <button 
                  onClick={() => setStatusFilter('basic')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors border-none cursor-pointer ${
                    statusFilter === 'basic' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Basic ({companies.filter(c => c.plan === 'basic').length})
                </button>
                <button 
                  onClick={() => setStatusFilter('free')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors border-none cursor-pointer ${
                    statusFilter === 'free' ? 'bg-slate-700 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Free ({companies.filter(c => c.plan === 'free').length})
                </button>
                <button 
                  onClick={() => setStatusFilter('active')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors border-none cursor-pointer ${
                    statusFilter === 'active' ? 'bg-green-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {language === 'ar' ? `نشط (${companies.filter(c => c.isActive).length})` : `Active (${companies.filter(c => c.isActive).length})`}
                </button>
                <button 
                  onClick={() => setStatusFilter('suspended')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors border-none cursor-pointer ${
                    statusFilter === 'suspended' ? 'bg-red-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {language === 'ar' ? `موقوف (${companies.filter(c => !c.isActive).length})` : `Suspended (${companies.filter(c => !c.isActive).length})`}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className={`w-full ${language === 'ar' ? 'text-right' : 'text-left'} border-collapse`}>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-semibold">
                    <th className="p-4">{language === 'ar' ? 'اسم الشركة' : 'Company Name'}</th>
                    <th className="p-4">{language === 'ar' ? 'المدير المسؤول' : 'Manager'}</th>
                    <th className="p-4">{language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}</th>
                    <th className="p-4 text-center">{language === 'ar' ? 'باقة الاشتراك' : 'Plan'}</th>
                    <th className="p-4 text-center">{language === 'ar' ? 'استهلاك الموظفين' : 'Employees Consumption'}</th>
                    <th className="p-4 text-center">{language === 'ar' ? 'الحد الأقصى' : 'Max Limit'}</th>
                    <th className="p-4 text-center">{language === 'ar' ? 'التحكم' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {filteredCompanies.length > 0 ? (
                    filteredCompanies.map(c => {
                      const progressPercentage = Math.min((c.employeeCount / c.maxEmployees) * 100, 100);
                      const isNearLimit = c.employeeCount >= c.maxEmployees * 0.8;
                      const isFull = c.employeeCount >= c.maxEmployees;

                      return (
                        <tr key={c.id} className={`hover:bg-slate-50/50 transition-colors ${!c.isActive ? 'bg-red-50/20' : ''}`}>
                          <td className="p-4 font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <span>{c.name}</span>
                              {!c.isActive && (
                                <span className="px-2 py-0.5 text-[10px] bg-red-100 text-red-700 rounded-full font-bold">
                                  {language === 'ar' ? 'موقوف' : 'Suspended'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-slate-600">{c.managers[0]?.name || (language === 'ar' ? 'غير محدد' : 'Unspecified')}</td>
                          <td className="p-4 text-slate-500 font-mono text-xs">{c.managers[0]?.email || '-'}</td>
                          <td className="p-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                              c.plan === 'premium' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                              c.plan === 'basic' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              'bg-slate-50 text-slate-700 border border-slate-100'
                            }`}>
                              {c.plan}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1 min-w-[120px]">
                              <span className="font-semibold text-slate-700 text-xs">
                                {c.employeeCount} / {c.maxEmployees} {language === 'ar' ? 'موظف' : 'employees'}
                              </span>
                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isFull ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-blue-600'
                                  }`} 
                                  style={{ width: `${progressPercentage}%` }} 
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center font-bold text-blue-600">{c.maxEmployees}</td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleToggleActive(c)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border-none transition-colors cursor-pointer ${
                                  c.isActive 
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' 
                                    : 'bg-green-50 hover:bg-green-100 text-green-700'
                                }`}
                              >
                                {c.isActive 
                                  ? (language === 'ar' ? 'تعطيل' : 'Suspend') 
                                  : (language === 'ar' ? 'تنشيط' : 'Activate')}
                              </button>
                              <button
                                onClick={() => handleOpenEdit(c)}
                                className="p-2 hover:bg-slate-100 text-blue-600 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                                title={language === 'ar' ? 'تعديل' : 'Edit'}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingCompany(c)}
                                className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                                title={language === 'ar' ? 'حذف' : 'Delete'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-slate-400">
                        {language === 'ar' ? 'لا يوجد شركات متطابقة مع البحث' : 'No companies found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
            </div>
          </PullToRefresh>
        </div>
      </main>

      {/* ── EDIT COMPANY MODAL ── */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base m-0">
                {language === 'ar' ? 'تعديل باقة الشركة والاشتراك' : 'Edit Company & Subscription'}
              </h3>
              <button 
                onClick={() => setEditingCompany(null)}
                className="p-1 rounded-full hover:bg-slate-200 border-none bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSaveCompany}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {language === 'ar' ? 'اسم الشركة' : 'Company Name'}
                  </label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {language === 'ar' ? 'باقة الخدمة (Plan)' : 'Service Plan'}
                  </label>
                  <select 
                    value={editPlan}
                    onChange={e => setEditPlan(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="free">Free Plan</option>
                    <option value="basic">Basic Plan</option>
                    <option value="premium">Premium Plan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {language === 'ar' ? 'الحد الأقصى للموظفين المسموح بهم' : 'Max Allowed Employees'}
                  </label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={editMaxEmployees}
                    onChange={e => setEditMaxEmployees(Number(toEnglishDigits(e.target.value)) || 1)}
                    required
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 text-sm border-none cursor-pointer"
                >
                  {isSaving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingCompany(null)}
                  className="px-5 bg-white border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition text-sm cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD COMPANY MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base m-0">
                {language === 'ar' ? 'إضافة شركة جديدة' : 'Add New Company'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full hover:bg-slate-200 border-none bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleAddCompany}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {language === 'ar' ? 'اسم الشركة' : 'Company Name'}
                  </label>
                  <input 
                    type="text" 
                    value={newCompName}
                    onChange={e => setNewCompName(e.target.value)}
                    required
                    placeholder={language === 'ar' ? 'شركة التقنية الحديثة' : 'Modern Tech Company'}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {language === 'ar' ? 'باقة الخدمة' : 'Service Plan'}
                  </label>
                  <select 
                    value={newCompPlan}
                    onChange={e => setNewCompPlan(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="free">Free Plan</option>
                    <option value="basic">Basic Plan</option>
                    <option value="premium">Premium Plan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {language === 'ar' ? 'الحد الأقصى للموظفين' : 'Max Employees Limit'}
                  </label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={newCompMaxEmp}
                    onChange={e => setNewCompMaxEmp(Number(toEnglishDigits(e.target.value)) || 1)}
                    required
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button 
                  type="submit" 
                  disabled={isAdding}
                  className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 text-sm border-none cursor-pointer flex items-center justify-center gap-2"
                >
                  {isAdding ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : <><Plus className="w-4 h-4" /> {language === 'ar' ? 'إنشاء الشركة' : 'Create Company'}</>}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-5 bg-white border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition text-sm cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deletingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg m-0">
                  {language === 'ar' ? 'تأكيد حذف الشركة' : 'Confirm Company Deletion'}
                </h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  {language === 'ar' 
                    ? `سيتم حذف شركة "${deletingCompany.name}" نهائياً مع جميع موظفيها (${deletingCompany.employeeCount} موظف) ومديريها (${deletingCompany.managers.length} مدير).`
                    : `Company "${deletingCompany.name}" will be permanently deleted along with all its employees (${deletingCompany.employeeCount} employees) and managers (${deletingCompany.managers.length} managers).`}
                </p>
                <p className="text-xs text-red-500 font-bold mt-2">
                  {language === 'ar' ? '⚠️ هذا الإجراء لا يمكن التراجع عنه' : '⚠️ This action cannot be undone'}
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button 
                onClick={handleDeleteCompany}
                disabled={isDeleting}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition disabled:opacity-50 text-sm border-none cursor-pointer"
              >
                {isDeleting ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...') : (language === 'ar' ? 'نعم، احذف الشركة' : 'Yes, Delete Company')}
              </button>
              <button 
                onClick={() => setDeletingCompany(null)}
                className="px-5 bg-white border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition text-sm cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUSPEND COMPANY CONFIRMATION MODAL ── */}
      {suspendingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg m-0">
                  {language === 'ar' ? 'تأكيد إيقاف الشركة' : 'Confirm Suspend Company'}
                </h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  {language === 'ar' 
                    ? `سيتم تعطيل حساب شركة "${suspendingCompany.name}".`
                    : `The account of company "${suspendingCompany.name}" will be suspended.`}
                  <br />
                  {language === 'ar' 
                    ? 'سيتم منع جميع مستخدمي هذه الشركة من الدخول فوراً. هل أنت متأكد؟'
                    : 'All users of this company will be blocked from logging in immediately. Are you sure?'}
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button 
                onClick={confirmToggleActive}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition text-sm border-none cursor-pointer"
              >
                {language === 'ar' ? 'نعم، أوقف الشركة' : 'Yes, Suspend Company'}
              </button>
              <button 
                onClick={() => setSuspendingCompany(null)}
                className="px-5 bg-white border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition text-sm cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGOUT CONFIRM MODAL ── */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setLogoutConfirmOpen(false)}>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl w-full max-w-sm p-6 space-y-4 text-center animate-scale-up" onClick={(e) => e.stopPropagation()} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center text-xl mx-auto border border-amber-100">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {language === 'ar' ? 'تسجيل الخروج' : 'Log Out'}
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                {language === 'ar' 
                  ? 'هل أنت متأكد من رغبتك في تسجيل الخروج من حسابك المشرف؟'
                  : 'Are you sure you want to log out of your admin account?'}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setLogoutConfirmOpen(false); signOut(); }}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors border-none cursor-pointer"
              >
                {language === 'ar' ? 'نعم، سجل الخروج' : 'Yes, Log Out'}
              </button>
              <button
                onClick={() => setLogoutConfirmOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors border-none cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
