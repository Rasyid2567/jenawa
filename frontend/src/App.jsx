import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, Bell, BookHeart, BookOpen, Camera, Check, ChevronLeft,
  ChevronRight, GraduationCap, Heart, Home, LogIn, LogOut, Moon,
  NotebookPen, Pause, Play, RotateCcw, Search, ShieldCheck, Smile, Sparkles,
  Timer, UserRound, Wind, X, Zap, Settings, Music, Smartphone, Sprout, Trash2,
  Lightbulb,
} from 'lucide-react';
import { authApi, emotionsApi, journalsApi, sessionsApi, profileApi, profileAssetUrl } from './lib/api.js';

const moodShortcuts = [
  { label: 'Buruk', emoji: '😭', candidates: ['sedih', 'stres', 'marah'] },
  { label: 'Sedih', emoji: '😔', candidates: ['sedih', 'lelah'] },
  { label: 'Biasa', emoji: '😐', candidates: ['tenang'] },
  { label: 'Senang', emoji: '🙂', candidates: ['bahagia', 'senang'] },
  { label: 'Hebat', emoji: '🤩', candidates: ['bahagia', 'senang'] },
];

const moodStyleByName = {
  tenang: { emoji: '😌', color: 'mood-mint' }, damai: { emoji: '😌', color: 'mood-mint' },
  stres: { emoji: '😣', color: 'mood-peach' }, tertekan: { emoji: '😫', color: 'mood-peach' },
  cemas: { emoji: '😟', color: 'mood-lilac' }, takut: { emoji: '😨', color: 'mood-lilac' }, khawatir: { emoji: '😰', color: 'mood-lilac' },
  lelah: { emoji: '😩', color: 'mood-slate' }, capek: { emoji: '🥱', color: 'mood-slate' },
  bahagia: { emoji: '😄', color: 'mood-yellow' }, senang: { emoji: '😊', color: 'mood-yellow' }, gembira: { emoji: '😆', color: 'mood-yellow' },
  sedih: { emoji: '😢', color: 'mood-blue' }, marah: { emoji: '😠', color: 'mood-peach' }, kecewa: { emoji: '😞', color: 'mood-blue' },
  bingung: { emoji: '😕', color: 'mood-lilac' }, bersyukur: { emoji: '🥰', color: 'mood-yellow' }, kesepian: { emoji: '🥺', color: 'mood-blue' },
};

const recommendations = [
  { id: 'thoughts', title: 'Terlalu Banyak Pikiran', subtitle: 'Hentikan sejenak dengan metode grounding 5-4-3-2-1.', icon: '〰', time: 3, type: 'recommendation', tone: 'tone-blue', duration: 180 },
  { id: 'presentation', title: 'Sebelum Presentasi', subtitle: 'Pernapasan perlahan untuk menenangkan suara dan tangan.', icon: '≋', time: 2, type: 'school', tone: 'tone-orange', duration: 120 },
  { id: 'sleep', title: 'Sulit Tidur?', subtitle: 'Jeda relaksasi untuk membantu tubuh melepas ketegangan.', icon: '☾', time: 10, type: 'sleep', tone: 'tone-violet', duration: 600 },
  { id: 'social', title: 'Kecemasan Sosial', subtitle: 'Persiapan dan pemulihan setelah berinteraksi.', icon: '♧', time: 5, type: 'recommendation', tone: 'tone-green', duration: 300 },
  { id: 'exam', title: 'Kepanikan Ujian', subtitle: 'Jeda singkat untuk menghadapi rasa gugup saat ujian.', icon: '!', time: 1, type: 'school', tone: 'tone-red', duration: 60 },
];

function moodVisual(name, icon) {
  const key = String(name || '').trim().toLowerCase();
  const known = moodStyleByName[key];
  if (known) return known;
  return { emoji: '🙂', color: 'mood-mint' };
}

function initials(name) {
  return String(name || 'SA').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SA';
}

function formatDate(value) {
  if (!value) return 'Baru saja';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Baru saja' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('jenawa_access_token') || '');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [screen, setScreen] = useState('home');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [selectedMood, setSelectedMood] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [emotionNote, setEmotionNote] = useState('');
  const [emotionHistory, setEmotionHistory] = useState([]);
  const [emotionHistoryLoading, setEmotionHistoryLoading] = useState(false);
  const [insightsLogs, setInsightsLogs] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [journalTitle, setJournalTitle] = useState('');
  const [journalContent, setJournalContent] = useState('');
  const [journalReflection, setJournalReflection] = useState('');
  const [journals, setJournals] = useState([]);
  const [journalsLoading, setJournalsLoading] = useState(false);
  const [journalSearch, setJournalSearch] = useState('');
  const [homeSearch, setHomeSearch] = useState('');
  const [homeFilter, setHomeFilter] = useState('recommendation');
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusTotal, setFocusTotal] = useState(225);
  const [focusSeconds, setFocusSeconds] = useState(225);

  const [focusHasStarted, setFocusHasStarted] = useState(false);
  const [breathPhase, setBreathPhase] = useState('inhale');
  const [breathPhaseRemaining, setBreathPhaseRemaining] = useState(4);

  const breathElapsedRef = useRef(0);
  const breathSegmentStartedAtRef = useRef(null);
  const focusDeadlineRef = useRef(null);

  const [focusSaved, setFocusSaved] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: '', nis: '', class_name: '', major: '', email: '', phone: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoRemoving, setPhotoRemoving] = useState(false);
  const photoInputRef = useRef(null);
  const [profilePreferences, setProfilePreferences] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jenawa_profile_preferences') || '{\"examMode\":false,\"notificationSound\":true,\"gentleVibration\":true,\"emotionalSupport\":true,\"supportLevel\":2}'); }
    catch { return { examMode: false, notificationSound: true, gentleVibration: true, emotionalSupport: true, supportLevel: 2 }; }
  });

  useEffect(() => {
    if (!token) { setUser(null); return undefined; }
    let cancelled = false;
    authApi.me(token).then((result) => {
      if (!cancelled) setUser(result?.data?.user ?? null);
    }).catch((err) => {
      if (cancelled) return;
      sessionStorage.removeItem('jenawa_access_token');
      setToken(''); setUser(null);
      setNotice(err.message || 'Sesi telah berakhir. Silakan masuk kembali.');
    });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!token) {
      setProfile(null);
      setProfileForm({ name: '', nis: '', class_name: '', major: '', email: '', phone: '' });
      return undefined;
    }
    let cancelled = false;
    setProfileLoading(true);
    profileApi.get(token).then((result) => {
      if (cancelled) return;
      const data = result?.data;
      if (!data) return;
      setProfile(data);
      setProfileForm({
        name: data.name || '',
        nis: data.nis || '',
        class_name: data.class_name || '',
        major: data.major || '',
        email: data.email || '',
        phone: data.phone || '',
      });
      setUser((current) => current ? { ...current, name: data.name || current.name, email: data.email || current.email } : current);
    }).catch((err) => {
      if (!cancelled) setNotice(`Data profil belum dapat dimuat: ${err.message}`);
    }).finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    try { localStorage.setItem('jenawa_profile_preferences', JSON.stringify(profilePreferences)); }
    catch { /* Preferensi lokal tidak wajib untuk fungsi inti aplikasi. */ }
  }, [profilePreferences]);

  useEffect(() => {
    if (!token) { setCategories([]); return undefined; }
    let cancelled = false;
    setCategoriesLoading(true);
    emotionsApi.categories(token).then((result) => {
      if (cancelled) return;
      const rows = Array.isArray(result?.data) ? result.data : [];
      setCategories(rows.map((category) => ({ ...category, visual: moodVisual(category.name, category.icon) })));
    }).catch((err) => {
      if (!cancelled) setNotice(`Kategori perasaan belum dapat dimuat: ${err.message}`);
    }).finally(() => { if (!cancelled) setCategoriesLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!token || screen !== 'history') return undefined;
    let cancelled = false;
    setEmotionHistoryLoading(true);
    emotionsApi.list(token, { limit: 30, offset: 0 }).then((result) => {
      if (!cancelled) setEmotionHistory(Array.isArray(result?.data) ? result.data : []);
    }).catch((err) => { if (!cancelled) setNotice(`Riwayat perasaan gagal dimuat: ${err.message}`); })
      .finally(() => { if (!cancelled) setEmotionHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [token, screen]);

  useEffect(() => {
    if (!token || screen !== 'insights') return undefined;
    let cancelled = false;
    setInsightsLoading(true);
    emotionsApi.list(token, { limit: 100, offset: 0 }).then((result) => {
      if (!cancelled) setInsightsLogs(Array.isArray(result?.data) ? result.data : []);
    }).catch((err) => {
      if (!cancelled) setNotice(`Wawasan belum dapat dimuat: ${err.message}`);
    }).finally(() => { if (!cancelled) setInsightsLoading(false); });
    return () => { cancelled = true; };
  }, [token, screen]);

  useEffect(() => {
    if (!token || screen !== 'journal') return undefined;
    let cancelled = false;
    setJournalsLoading(true);
    journalsApi.list(token, { q: journalSearch, limit: 30, offset: 0 }).then((result) => {
      if (!cancelled) setJournals(Array.isArray(result?.data) ? result.data : []);
    }).catch((err) => { if (!cancelled) setNotice(`Jurnal belum dapat dimuat: ${err.message}`); })
      .finally(() => { if (!cancelled) setJournalsLoading(false); });
    return () => { cancelled = true; };
  }, [token, screen, journalSearch]);

  useEffect(() => {
    if (!focusRunning) return undefined;

    const updateTimer = () => {
      const now = Date.now();
      const deadline = focusDeadlineRef.current;
      const segmentStartedAt = breathSegmentStartedAtRef.current;

      if (deadline == null || segmentStartedAt == null) return;

      // Timestamp membuat hitungan tetap akurat saat tab/aplikasi berada di latar belakang.
      const remainingMs = Math.max(0, deadline - now);
      const elapsed = breathElapsedRef.current + Math.max(0, now - segmentStartedAt);
      const cyclePosition = elapsed % 10000;

      setFocusSeconds(Math.ceil(remainingMs / 1000));

      // Pola napas: tarik 4 detik, hembuskan 6 detik.
      if (cyclePosition < 4000) {
        setBreathPhase('inhale');
        setBreathPhaseRemaining(Math.max(1, Math.ceil((4000 - cyclePosition) / 1000)));
      } else {
        setBreathPhase('exhale');
        setBreathPhaseRemaining(Math.max(1, Math.ceil((10000 - cyclePosition) / 1000)));
      }

      if (remainingMs <= 0) {
        breathElapsedRef.current = elapsed;
        breathSegmentStartedAtRef.current = null;
        focusDeadlineRef.current = null;
        setFocusSeconds(0);
        setFocusRunning(false);
      }
    };

    updateTimer();
    const timer = window.setInterval(updateTimer, 200);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') updateTimer();
    };
    window.addEventListener('focus', updateTimer);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', updateTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [focusRunning]);

  const greetingName = user?.name?.trim()?.split(/\s+/)[0] || 'Teman';
  const visibleRecommendations = useMemo(() => recommendations.filter((item) => {
    const matchesTab = homeFilter === 'recommendation' ? item.type === 'recommendation' || item.type === 'school' || item.type === 'sleep'
      : homeFilter === 'school' ? item.type === 'school'
      : homeFilter === 'sleep' ? item.type === 'sleep' : true;
    const q = homeSearch.trim().toLowerCase();
    return matchesTab && (!q || `${item.title} ${item.subtitle}`.toLowerCase().includes(q));
  }), [homeFilter, homeSearch]);

  const insightsDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const count = insightsLogs.filter((entry) => {
        const created = new Date(entry.created_at);
        return !Number.isNaN(created.getTime()) && created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth() && created.getDate() === date.getDate();
      }).length;
      return { key, label: date.toLocaleDateString('id-ID', { weekday: 'short' }), count };
    });
  }, [insightsLogs]);
  const insightsTotal = insightsDays.reduce((sum, day) => sum + day.count, 0);
  const insightsWeekKeys = new Set(insightsDays.map((day) => day.key));
  const insightsWeekLogs = insightsLogs.filter((entry) => {
    const created = new Date(entry.created_at);
    if (Number.isNaN(created.getTime())) return false;
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
    return insightsWeekKeys.has(key);
  });
  const intensityValues = insightsWeekLogs.map((entry) => Number(entry.intensity)).filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
  const averageIntensity = intensityValues.length ? (intensityValues.reduce((sum, value) => sum + value, 0) / intensityValues.length).toFixed(1) : '—';
  const mostRecordedEmotion = useMemo(() => {
    const counts = new Map();
    insightsWeekLogs.forEach((entry) => {
      const name = entry.category_name || 'Perasaan tercatat';
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  }, [insightsWeekLogs]);
  const chartPoints = insightsDays.map((day, index) => ({
    x: 14 + index * 42,
    y: 93 - (Math.max(...insightsDays.map((item) => item.count), 1) ? day.count / Math.max(...insightsDays.map((item) => item.count), 1) : 0) * 58,
  }));
  const chartLine = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const chartArea = `${chartLine} L ${chartPoints[chartPoints.length - 1]?.x ?? 266} 104 L ${chartPoints[0]?.x ?? 14} 104 Z`;

  function goPrivate(target) {
    setNotice(''); setError('');
    if (!token) { setAuthMode('login'); setScreen('auth'); setNotice('Silakan masuk untuk menggunakan fitur ini.'); return; }
    setScreen(target);
  }

  function chooseShortcut(shortcut) {
    if (!token) { setAuthMode('login'); setScreen('auth'); setNotice('Masuk terlebih dahulu untuk mencatat perasaanmu.'); return; }
    const found = categories.find((category) => shortcut.candidates.includes(String(category.name).trim().toLowerCase()));
    setSelectedMood(found ? String(found.id) : '');
    setIntensity(3); setEmotionNote(''); setNotice(''); setError(''); setScreen('mood');
  }

  async function submitAuth(event) {
    event.preventDefault(); setAuthLoading(true); setError(''); setNotice('');
    const form = new FormData(event.currentTarget);
    const body = authMode === 'login'
      ? { email: String(form.get('email')).trim(), password: String(form.get('password')) }
      : { name: String(form.get('name')).trim(), email: String(form.get('email')).trim(), password: String(form.get('password')) };
    try {
      const result = authMode === 'login' ? await authApi.login(body) : await authApi.register(body);
      if (authMode === 'register') {
        setNotice('Registrasi berhasil. Silakan masuk menggunakan akunmu.');
        setAuthMode('login');
      } else {
        const nextToken = result?.data?.accessToken;
        if (!nextToken) throw new Error('Token login tidak ditemukan pada respons API.');
        sessionStorage.setItem('jenawa_access_token', nextToken);
        setToken(nextToken); setUser(result?.data?.user ?? null); setScreen('home');
        setNotice('Selamat datang di JENAWA.');
      }
    } catch (err) { setError(err.message || 'Autentikasi gagal.'); }
    finally { setAuthLoading(false); }
  }

  async function logout() {
    setError(''); setNotice('');
    try { if (token) await authApi.logout(token); }
    catch (err) { setNotice(`Sesi lokal diakhiri. Catatan server: ${err.message}`); }
    finally {
      sessionStorage.removeItem('jenawa_access_token');
      setToken(''); setUser(null); setProfile(null); setProfileForm({ name: '', nis: '', class_name: '', major: '', email: '', phone: '' }); setJournals([]); setEmotionHistory([]); setInsightsLogs([]); setCategories([]); setScreen('home');
    }
  }

  async function saveMood(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (!token) { setAuthMode('login'); setScreen('auth'); setNotice('Silakan masuk untuk menyimpan check-in.'); return; }
    const category = categories.find((item) => String(item.id) === String(selectedMood));
    if (!category) { setError('Pilih kategori perasaan yang tersedia.'); return; }
    setBusy(true);
    try {
      const result = await emotionsApi.create({ category_id: Number(category.id), intensity: Number(intensity), note: emotionNote.trim() || null }, token);
      setNotice(result?.message || 'Check-in berhasil disimpan. Terima kasih sudah memberi ruang untuk dirimu.');
      setEmotionNote('');
    } catch (err) { setError(err.message || 'Check-in belum berhasil disimpan.'); }
    finally { setBusy(false); }
  }

  async function saveJournal(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (!token) { setAuthMode('login'); setScreen('auth'); setNotice('Silakan masuk untuk menyimpan jurnal.'); return; }
    if (!journalContent.trim()) { setError('Isi jurnal wajib diisi.'); return; }
    setBusy(true);
    try {
      const result = await journalsApi.create({ title: journalTitle.trim() || null, content: journalContent.trim(), reflection: journalReflection.trim() || null }, token);
      setNotice(result?.message || 'Jurnal refleksi berhasil disimpan.');
      setJournalTitle(''); setJournalContent(''); setJournalReflection('');
      const refreshed = await journalsApi.list(token, { q: journalSearch, limit: 30, offset: 0 });
      setJournals(Array.isArray(refreshed?.data) ? refreshed.data : []);
    } catch (err) { setError(`Jurnal belum berhasil disimpan: ${err.message || 'Terjadi kesalahan.'}`); }
    finally { setBusy(false); }
  }

  function startFocus(seconds) {
    setFocusTotal(seconds);
    setFocusSeconds(seconds);
    setFocusRunning(false);
    setFocusHasStarted(false);
    setBreathPhase('inhale');
    setBreathPhaseRemaining(4);
    setFocusSaved(false);

    breathElapsedRef.current = 0;
    breathSegmentStartedAtRef.current = null;
    focusDeadlineRef.current = null;

    setScreen('focus');
  }

  function toggleFocus() {
    if (focusRunning) {
      pauseFocus();
      return;
    }

    if (focusSeconds <= 0) return;

    const now = Date.now();

    focusDeadlineRef.current =
      now + focusSeconds * 1000;

    breathSegmentStartedAtRef.current = now;

    setFocusHasStarted(true);
    setFocusRunning(true);
  }

  function pauseFocus() {
    if (!focusRunning) return;

    const now = Date.now();
    const remainingMs = Math.max(0, (focusDeadlineRef.current ?? now) - now);
    const segmentStartedAt = breathSegmentStartedAtRef.current ?? now;
    const elapsed = breathElapsedRef.current + Math.max(0, now - segmentStartedAt);
    const cyclePosition = elapsed % 10000;

    setFocusSeconds(Math.ceil(remainingMs / 1000));
    breathElapsedRef.current = elapsed;

    // Simpan fase dan sisa detiknya tepat pada saat tombol jeda ditekan.
    if (cyclePosition < 4000) {
      setBreathPhase('inhale');
      setBreathPhaseRemaining(Math.max(1, Math.ceil((4000 - cyclePosition) / 1000)));
    } else {
      setBreathPhase('exhale');
      setBreathPhaseRemaining(Math.max(1, Math.ceil((10000 - cyclePosition) / 1000)));
    }

    breathSegmentStartedAtRef.current = null;
    focusDeadlineRef.current = null;
    setFocusRunning(false);
  }

  function resetFocus() {
    setFocusRunning(false);
    setFocusHasStarted(false);
    setFocusSeconds(focusTotal);
    setBreathPhase('inhale');
    setBreathPhaseRemaining(4);
    setFocusSaved(false);

    breathElapsedRef.current = 0;
    breathSegmentStartedAtRef.current = null;
    focusDeadlineRef.current = null;
  }
  async function saveFocusSession() {
    if (!token) { setAuthMode('login'); setScreen('auth'); setNotice('Masuk untuk menyimpan riwayat sesi.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await sessionsApi.create({ exercise_id: null, session_type: 'breathing', duration_seconds: Math.max(1, focusTotal - focusSeconds), completed: focusSeconds === 0 }, token);
      setFocusSaved(true); setNotice(result?.message || 'Riwayat sesi berhasil disimpan.');
    } catch (err) { setError(`Riwayat sesi belum tersimpan: ${err.message}`); }
    finally { setBusy(false); }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError(''); setNotice('');
    if (!token) { setAuthMode('login'); setScreen('auth'); setNotice('Silakan masuk untuk mengubah profil.'); return; }
    if (!profileForm.name.trim()) { setError('Nama lengkap wajib diisi.'); return; }
    setProfileSaving(true);
    try {
      const payload = {
        name: profileForm.name.trim(),
        nis: profileForm.nis.trim() || null,
        class_name: profileForm.class_name.trim() || null,
        major: profileForm.major.trim() || null,
        phone: profileForm.phone.trim() || null,
      };
      const result = await profileApi.update(payload, token);
      const data = result?.data;
      if (data) {
        setProfile(data);
        setProfileForm({ name: data.name || '', nis: data.nis || '', class_name: data.class_name || '', major: data.major || '', email: data.email || '', phone: data.phone || '' });
        setUser((current) => current ? { ...current, name: data.name || current.name, email: data.email || current.email } : current);
      }
      setNotice(result?.message || 'Profil berhasil diperbarui.');
    } catch (err) { setError(err.message || 'Profil belum berhasil diperbarui.'); }
    finally { setProfileSaving(false); }
  }

  async function uploadProfilePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setNotice('');
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Foto harus berformat JPG, PNG, atau WebP.');
      event.target.value = '';
      return;
    }
    if (file.size > 500 * 1024) {
      setError('Ukuran foto maksimal 500 KB.');
      event.target.value = '';
      return;
    }
    setPhotoUploading(true);
    try {
      const result = await profileApi.uploadPhoto(file, token);
      if (result?.data) {
        setProfile(result.data);
        setProfileForm((current) => ({ ...current, name: result.data.name || current.name, email: result.data.email || current.email }));
      }
      setNotice(result?.message || 'Foto profil berhasil diperbarui.');
    } catch (err) { setError(err.message || 'Foto profil belum berhasil diunggah.'); }
    finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  async function removeProfilePhoto() {
    if (!profile?.profile_photo_url) return;
    if (!window.confirm('Hapus foto profil saat ini?')) return;
    setPhotoRemoving(true); setError(''); setNotice('');
    try {
      const result = await profileApi.removePhoto(token);
      if (result?.data) setProfile(result.data);
      setNotice(result?.message || 'Foto profil berhasil dihapus.');
    } catch (err) { setError(err.message || 'Foto profil belum berhasil dihapus.'); }
    finally { setPhotoRemoving(false); }
  }

  function updatePreference(key, value) {
    setProfilePreferences((current) => ({ ...current, [key]: value }));
  }

  function bottomNav(target) {
    if (['mood', 'journal', 'history', 'profile', 'insights'].includes(target)) goPrivate(target);
    else { setNotice(''); setError(''); setScreen(target); }
  }

  return (
    <div className="jenawa-stage d-flex justify-content-center align-items-center">
      <div className={`jenawa-phone ${screen === 'auth' ? 'phone-auth' : ''}`}>
        <main className="phone-scroll">
          {screen === 'home' && <>
            <header className="home-header d-flex align-items-center justify-content-center">
              <button type="button" className="brand-lockup btn p-0 border-0" onClick={() => setScreen('home')} aria-label="Kembali ke beranda">
                <img src="/jenawa-mark.png" alt="" className="brand-seal" />
                <span className="brand-copy"><strong>JENAWA</strong><small>Jenangan Wellness App</small></span>
              </button>
            </header>
            <section className="home-greeting d-flex justify-content-between align-items-start">
              <div><div className="eyebrow"><span className="eyebrow-dot" /> HALO, {greetingName.toUpperCase()}!</div><h1>Bagaimana perasaanmu saat ini?</h1></div>
              <button type="button" className="avatar-bubble greeting-avatar profile-photo-trigger" onClick={() => bottomNav('profile')} aria-label="Buka profil">{profile?.profile_photo_url ? <img src={profileAssetUrl(profile.profile_photo_url)} alt="Foto profil"/> : <UserRound size={20}/>}</button>
            </section>
            <section className="shortcut-strip d-flex justify-content-between" aria-label="Pilihan perasaan singkat">
              {moodShortcuts.map((item) => <button type="button" className="shortcut-mood" key={item.label} onClick={() => chooseShortcut(item)}><span className="shortcut-emoji">{item.emoji}</span><small>{item.label}</small></button>)}
            </section>
            <label className="home-search input-group"><span className="input-group-text"><Search size={15}/></span><input className="form-control" value={homeSearch} onChange={(event) => setHomeSearch(event.target.value)} placeholder="Cari fitur atau perasaan..." aria-label="Cari fitur atau perasaan" /></label>
            <div className="filter-pills nav nav-pills" role="tablist" aria-label="Filter rekomendasi">
              <button type="button" className={`nav-link ${homeFilter === 'recommendation' ? 'active' : ''}`} onClick={() => setHomeFilter('recommendation')}>Rekomendasi</button>
              <button type="button" className={`nav-link ${homeFilter === 'school' ? 'active' : ''}`} onClick={() => setHomeFilter('school')}><GraduationCap size={13}/> Sekolah</button>
              <button type="button" className={`nav-link ${homeFilter === 'sleep' ? 'active' : ''}`} onClick={() => setHomeFilter('sleep')}><Moon size={12}/> Tidur</button>
            </div>
            <div className="mini-scrollbar d-flex align-items-center gap-2" aria-hidden="true"><ChevronLeft size={15}/><div className="scroll-track"><span /></div><ChevronRight size={15}/></div>
            <section className="home-section">
              <div className="section-title-row d-flex justify-content-between align-items-center"><h2>Pereda Cepat</h2><button className="link-button" onClick={() => startFocus(180)}>Lihat Semua</button></div>
              {visibleRecommendations.length ? <div className="row g-2 quick-cards">{visibleRecommendations.filter((item) => item.id !== 'sleep').slice(0, 2).map((item) => <div className="col-6" key={item.id}><button type="button" className="recommend-card card h-100 w-100 border-0 text-start" onClick={() => startFocus(item.duration)}><div className={`recommend-icon ${item.tone}`}>{item.icon}</div><strong>{item.title}</strong><p>{item.subtitle}</p><span className="card-time"><Timer size={11}/> {item.time} menit</span></button></div>)}</div>
                : <div className="empty-mini">Tidak ada rekomendasi yang cocok. Coba kata kunci lain.</div>}
            </section>
            <section className="home-section relax-section">
              <div className="section-title-row d-flex justify-content-between align-items-center"><h2>Waktu Bersantai</h2><span className="section-sparkle"><Sparkles size={14}/></span></div>
              {visibleRecommendations.filter((item) => item.id === 'sleep' || (homeFilter === 'school' && item.id === 'exam') || (homeFilter === 'recommendation' && item.id === 'social')).map((item) => <button type="button" className={`relax-card ${item.tone}`} key={item.id} onClick={() => startFocus(item.duration)}><span className="relax-icon">{item.icon}</span><span className="relax-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span><span className="relax-time">{item.time}<small>men</small></span></button>)}
              {visibleRecommendations.filter((item) => item.id === 'sleep' || (homeFilter === 'school' && item.id === 'exam') || (homeFilter === 'recommendation' && item.id === 'social')).length === 0 && <p className="small text-secondary mb-0">Pilih kategori lain untuk melihat rekomendasi.</p>}
            </section>
            {notice && <div className="alert alert-success py-2 small mt-3" role="status">{notice}</div>}
          </>}

          {screen !== 'home' && screen !== 'auth' && <header className="inner-header d-flex align-items-center gap-3"><button type="button" className="btn btn-light rounded-circle back-button" onClick={() => {setNotice('');setError('');setScreen('home');}} aria-label="Kembali"><ArrowLeft size={17}/></button><img src="/jenawa-mark.png" alt="Logo JENAWA" className="inner-brand-seal"/><div className="flex-grow-1"><div className="inner-brand">{screen === 'insights' ? 'EKSPLORASI' : 'JENAWA'}</div><small className="text-secondary">Jenangan Wellness App</small></div><button type="button" className="avatar-bubble profile-photo-trigger" onClick={() => bottomNav('profile')} aria-label="Buka profil">{profile?.profile_photo_url ? <img src={profileAssetUrl(profile.profile_photo_url)} alt="Foto profil"/> : <UserRound size={16}/>}</button></header>}

          {screen === 'insights' && <section className="page-screen insights-screen container-fluid">
            <div className="insights-hero text-center">
              <span className="insights-sprout"><Activity size={26}/></span>
              <h1 className="insights-title">Kenali Pola Perasaanmu</h1>
              <p className="page-intro mb-0">Lihat perjalanan perasaanmu dari catatan check-in yang sudah kamu buat.</p>
            </div>
            <div className="card border-0 insights-chart-card mt-4 mb-4">
              <div className="card-body p-3 p-sm-4">
                <div className="d-flex justify-content-between align-items-center mb-3"><h2 className="insights-card-title mb-0">Tren Check-in</h2><span className="insights-period">7 Hari Terakhir</span></div>
                {insightsLoading ? <div className="text-center py-5"><span className="spinner-border spinner-border-sm text-success"/><p className="small text-secondary mt-2 mb-0">Memuat wawasan…</p></div> : <>
                  <div className="insights-chart-wrap">
                    <svg className="insights-chart" viewBox="0 0 290 112" role="img" aria-label="Grafik jumlah check-in per hari selama tujuh hari terakhir">
                      <defs><linearGradient id="insightsFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#81c784" stopOpacity=".28"/><stop offset="100%" stopColor="#81c784" stopOpacity=".02"/></linearGradient></defs>
                      <path d={chartArea} fill="url(#insightsFill)"/><path d={chartLine} fill="none" stroke="#78c981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      {chartPoints.map((point, index) => <circle key={insightsDays[index].key} cx={point.x} cy={point.y} r="3.8" fill="#fff" stroke="#78c981" strokeWidth="2"/>)}
                    </svg>
                    <div className="insights-chart-labels">{insightsDays.map((day) => <span key={day.key}>{day.label}</span>)}</div>
                    {insightsTotal === 0 && <p className="small text-secondary text-center mt-2 mb-0">Belum ada check-in dalam tujuh hari terakhir.</p>}
                  </div>
                  <div className="row g-0 insights-stats mt-3 pt-3">
                    <div className="col-6 pe-3"><small>CHECK-IN MINGGU INI</small><strong>{insightsTotal} <span>catatan</span></strong></div>
                    <div className="col-6 ps-3"><small>RATA-RATA INTENSITAS</small><strong>{averageIntensity}<span>{averageIntensity === '—' ? '' : ' / 5'}</span></strong></div>
                  </div>
                </>}
              </div>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-3"><h2 className="insights-section-title mb-0">Apa yang sering kamu rasakan</h2><span className="insights-link-label">Berdasarkan catatan</span></div>
            {insightsLoading ? <div className="small text-secondary mb-3">Menyiapkan ringkasan…</div> : mostRecordedEmotion ? <div className="insights-emotion-card card border-0 mb-3"><div className="card-body d-flex align-items-center gap-3"><span className="insights-achievement-icon"><Heart size={20}/></span><div className="flex-grow-1"><strong>{mostRecordedEmotion[0]}</strong><small className="d-block text-secondary">Paling sering dicatat dalam riwayat yang dimuat</small></div><span className="insights-count-badge">{mostRecordedEmotion[1]} kali</span></div></div> : <div className="insights-empty small text-secondary mb-3">Belum ada catatan cukup untuk merangkum pola perasaan. Mulai check-in untuk melihat perkembanganmu.</div>}
            <div className="d-flex justify-content-between align-items-center mb-3 mt-4"><h2 className="insights-section-title mb-0">Perjalanan check-in terbaru</h2><span className="insights-link-label">7 hari terakhir</span></div>
            {insightsLoading ? <div className="small text-secondary mb-3">Memuat catatan…</div> : insightsWeekLogs.length ? <div className="d-grid gap-2 mb-4">{[...insightsWeekLogs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5).map((entry) => { const visual = moodVisual(entry.category_name, entry.category_icon); return <article className="card border-0 history-item" key={entry.id}><div className="card-body d-flex align-items-center gap-3"><span className={`history-mood-icon ${visual.color}`}>{visual.emoji}</span><div className="flex-grow-1"><strong>{entry.category_name || 'Perasaan'}</strong><p className="small text-secondary mb-1">{entry.note || 'Kamu memberi ruang untuk mengenali perasaan.'}</p><small className="text-secondary">{formatDate(entry.created_at)}</small></div><span className="badge rounded-pill bg-light text-success">{entry.intensity ?? '—'}/5</span></div></article>; })}</div> : <div className="insights-empty small text-secondary mb-4">Catatan check-in selama tujuh hari terakhir akan muncul di sini.</div>}
            <h2 className="insights-section-title mb-3">Latihan yang bisa kamu coba</h2>
            <button type="button" className="insights-practice-card card border-0 mb-2 w-100 text-start" onClick={() => startFocus(180)}><div className="card-body d-flex align-items-center gap-3"><span className="practice-icon practice-blue"><Wind size={21}/></span><span className="flex-grow-1"><strong>Tarik Napas Dalam</strong><small className="d-block">Latihan singkat untuk memberi jeda dan menenangkan diri.</small></span><span className="practice-time">3 menit</span></div></button>
            <button type="button" className="insights-practice-card card border-0 mb-3 w-100 text-start" onClick={() => startFocus(300)}><div className="card-body d-flex align-items-center gap-3"><span className="practice-icon practice-purple"><Sprout size={21}/></span><span className="flex-grow-1"><strong>Pemindaian Tubuh</strong><small className="d-block">Arahkan perhatian pada tubuh secara perlahan.</small></span><span className="practice-time">5 menit</span></div></button>
            <div className="insights-tip-card"><h2><Lightbulb size={18}/> Tips untuk Minggu Depan</h2><p>Coba sisihkan beberapa menit untuk check-in dan latihan napas. Tidak perlu memaksakan perubahan besar; cukup perhatikan apa yang kamu rasakan.</p><button type="button" className="btn btn-light rounded-pill px-3" onClick={() => startFocus(180)}>Mulai latihan <ArrowRight size={14} className="ms-1"/></button></div>
            {notice && <div className="alert alert-info small mt-3">{notice}</div>}
          </section>}

          {screen === 'auth' && <section className="auth-screen container-fluid">
            <div className="text-center auth-brand"><img src="/jenawa.png" alt="Logo JENAWA — Jenangan Wellness App"/><div className="eyebrow justify-content-center mt-3">LANGKAH KECIL, MAKNA BESAR</div><h1>{authMode === 'login' ? 'Sambut dirimu kembali.' : 'Mulai dari dirimu.'}</h1><p className="text-secondary">Ruang aman untuk mengenali perasaan dan merefleksikan diri.</p></div>
            <div className="card auth-card border-0 shadow-sm"><div className="card-body p-4"><h2 className="h5 fw-bold mb-1">{authMode === 'login' ? 'Masuk ke JENAWA' : 'Buat akun JENAWA'}</h2><p className="small text-secondary mb-4">{authMode === 'login' ? 'Lanjutkan perjalanan mengenali dirimu.' : 'Akunmu adalah ruang refleksi pribadimu.'}</p>
              <form onSubmit={submitAuth}>
                {authMode === 'register' && <div className="mb-3"><label className="form-label small fw-semibold">Nama lengkap</label><input className="form-control form-control-lg" name="name" autoComplete="name" maxLength="100" required placeholder="Nama kamu"/></div>}
                <div className="mb-3"><label className="form-label small fw-semibold">Email</label><input className="form-control form-control-lg" type="email" name="email" autoComplete="email" maxLength="254" required placeholder="nama@email.com"/></div>
                <div className="mb-3"><label className="form-label small fw-semibold">Kata sandi</label><input className="form-control form-control-lg" type="password" name="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={authMode === 'login' ? 1 : 12} maxLength="72" required placeholder={authMode === 'login' ? 'Masukkan kata sandi' : 'Minimal 12 karakter'}/></div>
                {error && <div className="alert alert-danger py-2 small">{error}</div>}{notice && <div className="alert alert-info py-2 small">{notice}</div>}
                <button className="btn btn-jenawa w-100 py-3" disabled={authLoading}>{authLoading ? 'Memproses…' : authMode === 'login' ? 'Masuk' : 'Daftar'} <ArrowRight size={16} className="ms-2"/></button>
              </form>
              <div className="text-center small mt-3 text-secondary">{authMode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'} <button type="button" className="btn btn-link btn-sm p-0 fw-bold text-success" onClick={() => {setAuthMode(authMode === 'login' ? 'register' : 'login');setError('');setNotice('');}}>{authMode === 'login' ? 'Daftar' : 'Masuk'}</button></div>
              <button type="button" className="btn btn-link btn-sm text-secondary w-100 mt-2" onClick={() => {setScreen('home');setError('');}}>Kembali ke beranda</button>
            </div></div>
          </section>}

          {screen === 'mood' && <section className="page-screen container-fluid">
            <div className="page-eyebrow">CHECK-IN PERASAAN</div><h1 className="page-title">Apa yang kamu rasakan <span>sekarang?</span></h1><p className="page-intro">Tidak ada perasaan yang salah. Pilih yang paling mendekati keadaanmu saat ini.</p>
            <form className="card border-0 page-card" onSubmit={saveMood}><div className="card-body p-3 p-sm-4">
              {categoriesLoading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-success" role="status"/><p className="small text-secondary mt-2 mb-0">Memuat kategori perasaan…</p></div> : categories.length ? <div className="row row-cols-3 g-2 mood-options">{categories.map((category) => <div className="col" key={category.id}><button type="button" className={`mood-option ${category.visual.color} ${String(selectedMood) === String(category.id) ? 'selected' : ''}`} onClick={() => setSelectedMood(String(category.id))}><span className="mood-option-emoji">{category.visual.emoji}</span><strong>{category.name}</strong>{String(selectedMood) === String(category.id) && <Check size={13} className="selected-check"/>}</button></div>)}</div> : <div className="alert alert-warning small">Kategori perasaan belum dapat dimuat. Pastikan login berhasil dan endpoint kategori aktif.</div>}
              <div className="d-flex justify-content-between align-items-center mt-4 mb-2"><label className="small fw-semibold mb-0">Seberapa kuat perasaan ini?</label><strong className="small text-success">{intensity}/5</strong></div><input className="form-range jenawa-range" type="range" min="1" max="5" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))}/><div className="d-flex justify-content-between small text-secondary range-labels"><span>Ringan</span><span>Sangat kuat</span></div>
              <label className="form-label small fw-semibold mt-4">Ingin menambahkan catatan? <span className="fw-normal text-secondary">Opsional</span></label><textarea className="form-control note-input" rows="3" maxLength="2000" value={emotionNote} onChange={(event) => setEmotionNote(event.target.value)} placeholder="Apa yang sedang ada di pikiranmu?"/>
              {error && <div className="alert alert-danger small mt-3 mb-0">{error}</div>}{notice && <div className="alert alert-success small mt-3 mb-0">{notice}</div>}
              <button className="btn btn-jenawa w-100 mt-3 py-3" disabled={!selectedMood || busy || categoriesLoading}>{busy ? 'Menyimpan…' : 'Simpan check-in'} <ArrowRight size={16} className="ms-2"/></button>
            </div></form>
          </section>}

          {screen === 'journal' && <section className="page-screen container-fluid">
            <div className="page-eyebrow">JURNAL REFLEKSI</div><h1 className="page-title">Tuangkan isi <span>pikiranmu.</span></h1><p className="page-intro">Tuliskan dengan bebas. Kamu tidak harus menyusun semuanya dengan sempurna.</p>
            <form className="card border-0 page-card journal-form" onSubmit={saveJournal}><div className="card-body p-3 p-sm-4">
              <div className="mb-3"><label className="form-label small fw-semibold">Judul jurnal <span className="fw-normal text-secondary">Opsional</span></label><input className="form-control" maxLength="200" value={journalTitle} onChange={(event) => setJournalTitle(event.target.value)} placeholder="Hari yang ingin kuingat…"/></div>
              <div className="mb-3"><label className="form-label small fw-semibold">Apa yang ingin kamu ceritakan?</label><textarea className="form-control" rows="5" maxLength="20000" required value={journalContent} onChange={(event) => setJournalContent(event.target.value)} placeholder="Apa yang terjadi hari ini? Apa yang kamu rasakan?"/></div>
              <div className="mb-3"><label className="form-label small fw-semibold">Apa yang kamu pelajari hari ini? <span className="fw-normal text-secondary">Opsional</span></label><textarea className="form-control" rows="3" maxLength="10000" value={journalReflection} onChange={(event) => setJournalReflection(event.target.value)} placeholder="Satu hal yang mulai kamu sadari…"/></div>
              {error && <div className="alert alert-danger small">{error}</div>}{notice && <div className="alert alert-success small">{notice}</div>}
              <button className="btn btn-jenawa w-100 py-3" disabled={!journalContent.trim() || busy}>{busy ? 'Menyimpan…' : 'Simpan refleksi'} <ArrowRight size={16} className="ms-2"/></button>
            </div></form>
            <section className="saved-journals mt-4"><div className="d-flex align-items-center justify-content-between mb-3"><h2 className="section-heading mb-0">Jurnal tersimpan</h2><span className="badge rounded-pill text-bg-light">{journals.length}</span></div><label className="input-group journal-search mb-3"><span className="input-group-text"><Search size={14}/></span><input className="form-control" value={journalSearch} onChange={(event) => setJournalSearch(event.target.value)} placeholder="Cari jurnal…"/></label>
              {journalsLoading ? <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-success"/></div> : journals.length ? <div className="d-grid gap-2">{journals.map((entry) => <article className="card border-0 saved-journal-card" key={entry.id}><div className="card-body p-3"><div className="d-flex gap-2"><span className="saved-journal-icon"><BookHeart size={17}/></span><div className="flex-grow-1 min-w-0"><strong className="saved-journal-title">{entry.title?.trim() || 'Jurnal tanpa judul'}</strong><p className="saved-journal-content mb-2">{String(entry.content || '').length > 200 ? `${String(entry.content).slice(0, 200)}…` : entry.content}</p>{entry.reflection && <p className="small text-secondary mb-2">Refleksi: {entry.reflection}</p>}<small className="text-secondary">{formatDate(entry.updated_at || entry.created_at)}</small></div></div></div></article>)}</div> : <div className="empty-state card border-0 text-center p-4"><span>📖</span><strong>Belum ada jurnal</strong><p>Jurnal yang kamu simpan akan muncul di sini.</p></div>}
            </section>
          </section>}

          {screen === 'history' && <section className="page-screen container-fluid"><div className="page-eyebrow">PERJALANANMU</div><h1 className="page-title">Kenali pola <span>perasaanmu.</span></h1><p className="page-intro">Setiap catatan adalah langkah kecil untuk memahami diri.</p>
            <div className="card border-0 history-summary mb-4"><div className="card-body d-flex align-items-center gap-3"><span className="summary-icon"><Smile size={22}/></span><div><small className="d-block text-secondary">Catatan check-in tersimpan</small><strong className="summary-count">{emotionHistory.length}</strong></div></div></div>
            <div className="d-flex justify-content-between align-items-center mb-3"><h2 className="section-heading mb-0">Riwayat check-in</h2><button type="button" className="btn btn-sm btn-outline-success" onClick={() => {setScreen('history');setNotice('');}}><RotateCcw size={13} className="me-1"/> Muat ulang</button></div>
            {emotionHistoryLoading ? <div className="text-center py-4"><div className="spinner-border text-success spinner-border-sm"/></div> : emotionHistory.length ? <div className="d-grid gap-2">{emotionHistory.map((entry) => { const visual = moodVisual(entry.category_name, entry.category_icon); return <article className="card border-0 history-item" key={entry.id}><div className="card-body d-flex align-items-center gap-3"><span className={`history-mood-icon ${visual.color}`}>{visual.emoji}</span><div className="flex-grow-1"><strong>{entry.category_name || 'Perasaan'}</strong><p className="small text-secondary mb-1">{entry.note || 'Kamu memberi ruang untuk mengenali perasaan.'}</p><small className="text-secondary">{formatDate(entry.created_at)}</small></div><span className="badge rounded-pill bg-light text-success">{entry.intensity ?? '—'}/5</span></div></article>; })}</div> : <div className="empty-state card border-0 text-center p-4"><span>🌱</span><strong>Belum ada catatan</strong><p>Mulai check-in perasaan untuk melihat riwayatmu di sini.</p><button className="btn btn-jenawa" onClick={() => bottomNav('mood')}>Mulai check-in</button></div>}
          </section>}

          {screen === 'focus' && <section className="page-screen container-fluid focus-screen">
            <div className="page-eyebrow">JEDA SEJENAK</div>
            <h1 className="page-title">Tarik napas, <span>beri ruang.</span></h1>
            <p className="page-intro">Ikuti ritme dengan nyaman. Hentikan jika kamu merasa tidak nyaman.</p>
            <div className="focus-panel card border-0 text-center">
              <div
                className={`breath-orb ${focusHasStarted ? 'has-started' : ''} ${focusRunning ? 'is-running' : 'is-paused'} phase-${breathPhase}`}
                role="status"
                aria-live="polite"
                aria-label={focusSeconds === 0 ? 'Latihan selesai' : !focusHasStarted ? 'Siap memulai latihan' : `${breathPhase === 'inhale' ? 'Tarik napas' : 'Hembuskan'}, ${focusRunning ? `${breathPhaseRemaining} detik` : 'dijeda'}`}
              >
                <span className="breath-instruction">
                  <strong>
                    {focusSeconds === 0
                      ? 'Selesai'
                      : !focusHasStarted
                        ? 'Siap Memulai'
                        : breathPhase === 'inhale' ? 'Tarik Napas' : 'Hembuskan'}
                  </strong>
                  {focusHasStarted && focusSeconds > 0 && (
                    <small>{focusRunning ? `${breathPhaseRemaining} detik` : 'Dijeda'}</small>
                  )}
                </span>
              </div>
              <div className="focus-clock">{String(Math.floor(focusSeconds / 60)).padStart(2, '0')}:{String(focusSeconds % 60).padStart(2, '0')}</div>
              <small className="text-secondary">waktu latihan tersisa</small>
              <div className="progress focus-progress my-3"><div className="progress-bar" style={{ width: `${((focusTotal - focusSeconds) / focusTotal) * 100}%` }}/></div>
              <div className="d-flex justify-content-center align-items-center gap-4">
                <button type="button" className="btn btn-light rounded-circle focus-small-button" onClick={resetFocus} aria-label="Atur ulang latihan"><RotateCcw size={18}/></button>
                <button type="button" className="btn focus-main-button rounded-circle" onClick={toggleFocus} disabled={focusSeconds === 0} aria-label={focusRunning ? 'Jeda latihan' : focusHasStarted ? 'Lanjutkan latihan' : 'Mulai latihan'}>{focusRunning ? <Pause size={22}/> : <Play size={22}/>}</button>
                <button type="button" className="btn btn-light rounded-circle focus-small-button" onClick={pauseFocus} disabled={!focusRunning} aria-label="Jeda latihan"><Pause size={18}/></button>
              </div>
              <div className="focus-note mt-4">
                <Wind size={17}/>
                <span>
                  {!focusHasStarted
                    ? 'Siklus lembut: tarik napas 4 detik, lalu hembuskan 6 detik.'
                    : breathPhase === 'inhale'
                      ? 'Tarik napas perlahan selama 4 detik. Biarkan lingkaran membesar.'
                      : 'Hembuskan napas perlahan selama 6 detik. Biarkan lingkaran mengecil.'}
                </span>
              </div>
              {focusSeconds === 0 && !focusSaved && <button type="button" className="btn btn-jenawa w-100 mt-3" onClick={saveFocusSession} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan riwayat sesi'}</button>}
              {focusSaved && <div className="alert alert-success small mt-3 mb-0">Sesi berhasil disimpan.</div>}
              {error && <div className="alert alert-danger small mt-3 mb-0">{error}</div>}
            </div>
          </section>}

          {screen === 'profile' && <section className="page-screen container-fluid profile-screen">
            <div className="profile-settings-heading d-flex align-items-center justify-content-between mb-3">
              <div className="d-flex align-items-center gap-2"><span className="settings-brand-title">Pengaturan</span></div>
              <span className="settings-round-icon"><Settings size={16}/></span>
            </div>
            <div className="d-flex align-items-center justify-content-between mb-3"><h1 className="profile-main-title mb-0">Profil Saya</h1><span className="profile-private-pill"><ShieldCheck size={12}/> Privat</span></div>
            {profileLoading && !profile ? <div className="card border-0 p-4 text-center"><div className="spinner-border spinner-border-sm text-success mx-auto"/><p className="small text-secondary mb-0 mt-2">Memuat profil…</p></div> : <>
              <div className="card border-0 profile-identity-card mb-4"><div className="card-body d-flex align-items-center gap-3">
                <div className="profile-photo-large">{profile?.profile_photo_url ? <img src={profileAssetUrl(profile.profile_photo_url)} alt="Foto profil"/> : <span>{initials(profileForm.name || user?.name)}</span>}</div>
                <div className="flex-grow-1 min-w-0"><h2 className="profile-display-name">{profileForm.name || user?.name || 'Nama lengkap'}</h2><p className="mb-1 profile-meta">{profileForm.nis ? `NIS: ${profileForm.nis}` : 'NIS belum diisi'}</p><p className="mb-0 profile-meta">{profileForm.class_name ? `Kelas: ${profileForm.class_name}` : 'Kelas belum diisi'}</p></div>
              </div><div className="profile-photo-actions px-3 pb-3 d-flex flex-wrap gap-2"><input ref={photoInputRef} type="file" className="d-none" accept="image/png,image/jpeg,image/webp" onChange={uploadProfilePhoto}/><button type="button" className="btn btn-sm btn-outline-success rounded-pill" onClick={() => photoInputRef.current?.click()} disabled={photoUploading}><Camera size={13} className="me-1"/>{photoUploading ? 'Mengunggah…' : profile?.profile_photo_url ? 'Ganti foto' : 'Tambah foto'}</button>{profile?.profile_photo_url && <button type="button" className="btn btn-sm btn-outline-danger rounded-pill" onClick={removeProfilePhoto} disabled={photoRemoving}><Trash2 size={13} className="me-1"/>{photoRemoving ? 'Menghapus…' : 'Hapus foto'}</button>}<small className="photo-hint align-self-center">JPG, PNG, WebP · maksimal 3 MB</small></div></div>

              <div className="profile-section-label">DATA PRIBADI</div>
              <form className="card border-0 profile-form-card mb-4" onSubmit={saveProfile}><div className="card-body p-3">
                <div className="mb-3"><label className="form-label profile-field-label">Nama lengkap <span className="text-danger">*</span></label><input className="form-control profile-control" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({...current, name: event.target.value}))} maxLength={100} required placeholder="Masukkan nama lengkap"/></div>
                <div className="mb-3"><label className="form-label profile-field-label">NIS</label><input className="form-control profile-control" value={profileForm.nis} onChange={(event) => setProfileForm((current) => ({...current, nis: event.target.value}))} maxLength={30} placeholder="Nomor induk siswa"/></div>
                <div className="row g-2"><div className="col-6 mb-3"><label className="form-label profile-field-label">Kelas</label><input className="form-control profile-control" value={profileForm.class_name} onChange={(event) => setProfileForm((current) => ({...current, class_name: event.target.value}))} maxLength={50} placeholder="XI RPL C"/></div><div className="col-6 mb-3"><label className="form-label profile-field-label">Jurusan</label><input className="form-control profile-control" value={profileForm.major} onChange={(event) => setProfileForm((current) => ({...current, major: event.target.value}))} maxLength={100} placeholder="Rekayasa Perangkat Lunak"/></div></div>
                <div className="mb-3"><label className="form-label profile-field-label">Alamat email</label><input className="form-control profile-control profile-readonly" value={profileForm.email || user?.email || ''} readOnly aria-readonly="true"/><div className="form-text profile-field-help">Email mengikuti akun login dan tidak diubah dari halaman ini.</div></div>
                <div className="mb-2"><label className="form-label profile-field-label">No. HP <span className="text-secondary fw-normal">(opsional)</span></label><input className="form-control profile-control" type="tel" inputMode="tel" autoComplete="tel" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({...current, phone: event.target.value}))} maxLength={20} placeholder="Contoh: 081234567890"/></div>
                {error && <div className="alert alert-danger small mt-3 mb-2">{error}</div>}{notice && <div className="alert alert-success small mt-3 mb-2" role="status">{notice}</div>}
                <button type="submit" className="btn btn-jenawa w-100 py-2 mt-2" disabled={profileSaving || profileLoading}>{profileSaving ? <><span className="spinner-border spinner-border-sm me-2"/>Menyimpan…</> : 'Simpan perubahan'}</button>
              </div></form>

              <div className="profile-section-label">BATASAN PRIVASI &amp; NOTIFIKASI</div>
              <div className="profile-peace-card d-flex align-items-start gap-3 mb-4"><span className="profile-setting-symbol bg-white text-success"><Sprout size={19}/></span><div><strong>Temukan Ketenanganmu</strong><p>Sesuaikan cara JENAWA mendampingi keseharianmu. Data profil hanya dapat diubah oleh akun yang sedang masuk.</p></div></div>

              <div className="profile-section-label">MODE UJIAN &amp; BELAJAR</div>
              <div className="card border-0 profile-settings-list mb-4"><div className="profile-setting-row"><span className="profile-setting-symbol text-danger bg-danger-subtle"><Bell size={16}/></span><div className="flex-grow-1"><strong>Hening Selama Ujian</strong><small>Preferensi lokal pada perangkat ini</small></div><div className="form-check form-switch m-0"><input className="form-check-input" type="checkbox" role="switch" checked={profilePreferences.examMode} onChange={(event) => updatePreference('examMode', event.target.checked)} aria-label="Hening selama ujian"/></div></div><div className="profile-setting-row"><span className="profile-setting-symbol text-primary bg-primary-subtle"><GraduationCap size={17}/></span><div className="flex-grow-1"><strong>Jam Kelas</strong><small>09.00 – 15.00 · pengingat visual</small></div><ChevronRight size={16} className="text-secondary"/></div></div>

              <div className="profile-section-label">PREFERENSI SENSORIK</div>
              <div className="card border-0 profile-settings-list mb-4"><div className="profile-setting-row"><span className="profile-setting-symbol text-info bg-info-subtle"><Music size={16}/></span><div className="flex-grow-1"><strong>Nada Notifikasi</strong><small>Saat ini: Hujan Rintik</small></div><span className="local-setting-label">Lokal</span></div><div className="profile-setting-row"><span className="profile-setting-symbol text-primary bg-primary-subtle"><Smartphone size={16}/></span><div className="flex-grow-1"><strong>Getaran Lembut</strong><small>Preferensi pada perangkat ini</small></div><div className="form-check form-switch m-0"><input className="form-check-input" type="checkbox" role="switch" checked={profilePreferences.gentleVibration} onChange={(event) => updatePreference('gentleVibration', event.target.checked)} aria-label="Getaran lembut"/></div></div></div>

              <div className="profile-section-label">DUKUNGAN EMOSIONAL</div>
              <div className="card border-0 profile-support-card mb-4"><div className="card-body p-3"><div className="d-flex align-items-center gap-2 mb-2"><span className="profile-setting-symbol text-success bg-success-subtle"><Heart size={16}/></span><div className="flex-grow-1"><strong>Dorongan Dukungan</strong></div><div className="form-check form-switch m-0"><input className="form-check-input" type="checkbox" role="switch" checked={profilePreferences.emotionalSupport} onChange={(event) => updatePreference('emotionalSupport', event.target.checked)} aria-label="Dorongan dukungan"/></div></div><p className="profile-support-copy">Pengingat yang lembut untuk membantu kamu memperhatikan pola perasaan dan memberi ruang bagi diri sendiri.</p><label className="support-range-label d-flex justify-content-between"><span>RENDAH</span><span>SEIMBANG</span><span>TINGGI</span></label><input className="form-range profile-support-range" type="range" min="1" max="3" value={profilePreferences.supportLevel} disabled={!profilePreferences.emotionalSupport} onChange={(event) => updatePreference('supportLevel', Number(event.target.value))} aria-label="Tingkat dukungan emosional"/></div></div>
              <p className="text-center profile-local-note mb-2">Preferensi sensorik dan dukungan pada bagian ini tersimpan lokal di perangkat ini.</p>
              <div className="profile-logout-wrapper">
                <button
                  type="button"
                  className="btn profile-logout-btn w-100"
                  onClick={logout}
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </div>
            </>}
          </section>}
        </main>

        {screen !== 'auth' && <nav className="bottom-nav" aria-label="Navigasi utama">
          <button type="button" className={`bottom-nav-item ${screen === 'home' ? 'active' : ''}`} onClick={() => bottomNav('home')} aria-label="Hari Ini"><Home size={18}/><span>Hari Ini</span></button>
          <button type="button" className={`bottom-nav-item ${screen === 'insights' ? 'active' : ''}`} onClick={() => bottomNav('insights')} aria-label="Eksplorasi"><Activity size={18}/><span>Eksplorasi</span></button>
          <button type="button" className={`bottom-nav-item nav-fab ${screen === 'mood' ? 'active' : ''}`} onClick={() => bottomNav('mood')} aria-label="Check-in perasaan"><span className="fab-circle"><img src="/jenawa.png" alt="" className="fab-jenawa-reverse"/></span><span>Check-in</span></button>
          <button type="button" className={`bottom-nav-item ${screen === 'journal' ? 'active' : ''}`} onClick={() => bottomNav('journal')}><BookOpen size={18}/><span>Jurnal</span></button>
          <button type="button" className={`bottom-nav-item ${screen === 'profile' ? 'active' : ''}`} onClick={() => bottomNav('profile')}><UserRound size={18}/><span>Profil</span></button>
        </nav>}
      </div>
    </div>
  );
}
