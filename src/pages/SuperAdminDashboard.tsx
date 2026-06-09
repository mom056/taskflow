import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building, Users, ClipboardList, Shield, LogOut, 
  Search, Plus, CheckCircle, RefreshCcw, Save, X, Edit, CreditCard, Trash2, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CompanyAdminView {
  id: string;
  name: string;
  plan: 'free' | 'basic' | 'premium';
  maxEmployees: number;
  createdAt: number;
  managers: { name: string; email: string }[];
  employeeCount: number;
}

export default function SuperAdminDashboard() {
  const { signOut, user, profile } = useAuth();
  
  const [companies, setCompanies] = useState<CompanyAdminView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
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

  // Stats
  const stats = useMemo(() => {
    const total = companies.length;
    const basic = companies.filter(c => c.plan === 'basic').length;
    const premium = companies.filter(c => c.plan === 'premium').length;
    const free = companies.filter(c => c.plan === 'free').length;
    const totalEmployees = companies.reduce((acc, c) => acc + c.employeeCount, 0);
    return { total, basic, premium, free, totalEmployees };
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
          .map(u => ({ name: u.name || 'مدير جديد', email: u.email }));
        const employeeCount = compUsers.filter(u => u.role === 'employee').length;

        return {
          id: comp.id,
          name: comp.name,
          plan: comp.plan,
          maxEmployees: comp.max_employees,
          createdAt: comp.created_at,
          managers,
          employeeCount
        };
      });

      setCompanies(formatted);
    } catch (err: any) {
      console.error(err);
      toast.error('تعذر جلب بيانات الشركات والاشتراكات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenEdit = (comp: CompanyAdminView) => {
    setEditingCompany(comp);
    setEditName(comp.name);
    setEditPlan(comp.plan);
    setEditMaxEmployees(comp.maxEmployees);
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

      toast.success('تم تحديث الشركة وباقة الاشتراك بنجاح');
      setEditingCompany(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'تعذر تحديث إعدادات الشركة');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCompanies = companies.filter(c => {
    const query = searchQuery.toLowerCase();
    const matchName = c.name.toLowerCase().includes(query);
    const matchManager = c.managers.some(m => 
      m.name.toLowerCase().includes(query) || m.email.toLowerCase().includes(query)
    );
    return matchName || matchManager;
  });

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

      toast.success(`تم إنشاء شركة "${newCompName.trim()}" بنجاح`);
      setShowAddModal(false);
      setNewCompName('');
      setNewCompPlan('free');
      setNewCompMaxEmp(5);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'تعذر إنشاء الشركة');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!deletingCompany) return;

    setIsDeleting(true);
    try {
      // Delete all users belonging to this company first
      const { error: usersError } = await supabase
        .from('users')
        .delete()
        .eq('company_id', deletingCompany.id);

      if (usersError) throw usersError;

      // Then delete the company
      const { error: compError } = await supabase
        .from('companies')
        .delete()
        .eq('id', deletingCompany.id);

      if (compError) throw compError;

      toast.success(`تم حذف شركة "${deletingCompany.name}" وجميع موظفيها بنجاح`);
      setDeletingCompany(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'تعذر حذف الشركة');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans overflow-hidden text-slate-900" dir="rtl">
      
      {/* ── SIDEBAR ── */}
      <aside className="w-[260px] bg-slate-900 text-slate-300 flex-col p-6 shrink-0 z-10 hidden md:flex border-l border-slate-800">
        <div className="mb-10">
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-500" />
            TaskFlow SaaS
          </div>
          <div className="text-[10px] text-blue-400 font-semibold mt-1 tracking-wider uppercase">لوحة المشرف العام</div>
        </div>

        <nav className="flex flex-col flex-1 gap-1">
          <button className="flex justify-start items-center px-4 py-3 rounded-xl font-medium border-none bg-blue-600 text-white shadow-md">
            <Building className="w-5 h-5 ml-3" />
            إدارة الشركات والاشتراكات
          </button>
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-800 space-y-3">
          <Link to="/profile" className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 transition-colors text-slate-300 no-underline cursor-pointer">
            <div className="w-9 h-9 bg-blue-600 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold border border-blue-500 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="مشرف عام" className="w-full h-full object-cover" />
              ) : (
                (profile?.name || 'م')[0].toUpperCase()
              )}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-semibold truncate text-white leading-tight">{profile?.name || 'مشرف عام'}</div>
              <div className="text-xs text-slate-500 mt-0.5">Super Admin</div>
            </div>
          </Link>
          <button
            onClick={signOut}
            className="flex items-center text-slate-400 hover:text-red-400 px-2 py-2 transition-colors w-full rounded-lg bg-transparent border-none cursor-pointer hover:bg-slate-800"
          >
            <LogOut className="w-4 h-4 ml-2" />
            <span className="text-sm font-medium">تسجيل خروج</span>
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
                <img src={profile.avatar_url} alt="مشرف عام" className="w-full h-full object-cover" />
              ) : (
                (profile?.name || 'م')[0].toUpperCase()
              )}
            </div>
            <div>
              <span className="text-xs font-bold block leading-none">{profile?.name || 'مشرف عام'}</span>
              <span className="text-[9px] text-blue-400 font-semibold block mt-0.5">لوحة المشرف</span>
            </div>
          </Link>
          <button onClick={signOut} className="p-2 hover:bg-slate-800 rounded-full border-none bg-transparent cursor-pointer">
            <LogOut className="w-4 h-4 text-slate-400" />
          </button>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex bg-white border-b border-slate-100 px-8 py-4 items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900 m-0">التحكم في الشركات والاشتراكات</h1>
            <p className="text-slate-400 text-sm mt-0.5 m-0">مراقبة باقات الخدمة لجميع عملاء المنصة</p>
          </div>
          <button 
            onClick={fetchData} 
            className="p-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto relative p-4 md:p-8 space-y-6">
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
              <div className="rounded-full h-8 w-8 bg-blue-600 animate-ping" />
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <Building className="w-6 h-6 text-blue-500 mb-2" />
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
              <div className="text-xs text-slate-400 mt-1">إجمالي الشركات</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <Users className="w-6 h-6 text-green-500 mb-2" />
              <div className="text-2xl font-bold text-slate-900">{stats.totalEmployees}</div>
              <div className="text-xs text-slate-400 mt-1">إجمالي الموظفين</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <CreditCard className="w-6 h-6 text-purple-500 mb-2" />
              <div className="text-2xl font-bold text-slate-900">{stats.premium}</div>
              <div className="text-xs text-slate-400 mt-1">شركات باقة Premium</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <CreditCard className="w-6 h-6 text-amber-500 mb-2" />
              <div className="text-2xl font-bold text-slate-900">{stats.basic}</div>
              <div className="text-xs text-slate-400 mt-1">شركات باقة Basic</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <CreditCard className="w-6 h-6 text-slate-500 mb-2" />
              <div className="text-2xl font-bold text-slate-900">{stats.free}</div>
              <div className="text-xs text-slate-400 mt-1">باقات مجانية</div>
            </div>
          </div>

          {/* Search Table Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base m-0">قائمة الشركات والعملاء</h3>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition border-none cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  إضافة شركة
                </button>
                <div className="relative flex-1 sm:w-72">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم الشركة أو المدير..."
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                />
                <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-semibold">
                    <th className="p-4">اسم الشركة</th>
                    <th className="p-4">المدير المسؤول</th>
                    <th className="p-4">البريد الإلكتروني</th>
                    <th className="p-4 text-center">باقة الاشتراك</th>
                    <th className="p-4 text-center">الموظفين المضافين</th>
                    <th className="p-4 text-center">الحد الأقصى</th>
                    <th className="p-4 text-center">التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {filteredCompanies.length > 0 ? (
                    filteredCompanies.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{c.name}</td>
                        <td className="p-4 text-slate-600">{c.managers[0]?.name || 'غير محدد'}</td>
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
                        <td className="p-4 text-center font-semibold text-slate-700">{c.employeeCount} موظف</td>
                        <td className="p-4 text-center font-bold text-blue-600">{c.maxEmployees}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(c)}
                              className="p-2 hover:bg-slate-100 text-blue-600 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                              title="تعديل"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingCompany(c)}
                              className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-slate-400">
                        لا يوجد شركات متطابقة مع البحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ── EDIT COMPANY MODAL ── */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base m-0">تعديل باقة الشركة والاشتراك</h3>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">اسم الشركة</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">باقة الخدمة (Plan)</label>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">الحد الأقصى للموظفين المسموح بهم</label>
                  <input 
                    type="number" 
                    min={1}
                    value={editMaxEmployees}
                    onChange={e => setEditMaxEmployees(Number(e.target.value))}
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
                  {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingCompany(null)}
                  className="px-5 bg-white border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition text-sm cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD COMPANY MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base m-0">إضافة شركة جديدة</h3>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">اسم الشركة</label>
                  <input 
                    type="text" 
                    value={newCompName}
                    onChange={e => setNewCompName(e.target.value)}
                    required
                    placeholder="شركة التقنية الحديثة"
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">باقة الخدمة</label>
                  <select 
                    value={newCompPlan}
                    onChange={e => setNewCompPlan(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="free">Free Plan — مجانية</option>
                    <option value="basic">Basic Plan — أساسية</option>
                    <option value="premium">Premium Plan — متقدمة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">الحد الأقصى للموظفين</label>
                  <input 
                    type="number" 
                    min={1}
                    value={newCompMaxEmp}
                    onChange={e => setNewCompMaxEmp(Number(e.target.value))}
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
                  {isAdding ? 'جاري الإنشاء...' : <><Plus className="w-4 h-4" /> إنشاء الشركة</>}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-5 bg-white border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition text-sm cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deletingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg m-0">تأكيد حذف الشركة</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  سيتم حذف شركة <strong className="text-red-600">"{deletingCompany.name}"</strong> نهائياً مع جميع موظفيها ({deletingCompany.employeeCount} موظف) ومديريها ({deletingCompany.managers.length} مدير).
                </p>
                <p className="text-xs text-red-500 font-bold mt-2">⚠️ هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button 
                onClick={handleDeleteCompany}
                disabled={isDeleting}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition disabled:opacity-50 text-sm border-none cursor-pointer"
              >
                {isDeleting ? 'جاري الحذف...' : 'نعم، احذف الشركة'}
              </button>
              <button 
                onClick={() => setDeletingCompany(null)}
                className="px-5 bg-white border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition text-sm cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
