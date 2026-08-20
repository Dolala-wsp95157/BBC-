'use client';
import { useState, useEffect } from 'react';
import { supabase } from './supabase';

interface Player {
  id: string;
  player_name: string;
  player_level: string;
  time_slot?: string;
  created_at?: string;
}

interface TimeOption {
  id: string;
  label: string;
  startHour: number;
  zone: 'A' | 'B' | 'C' | 'D' | 'E';
}

const ALL_TIME_OPTIONS: TimeOption[] = [
  { id: '09-10', label: '09:00 - 10:00', startHour: 9, zone: 'A' },
  { id: '10-11', label: '10:00 - 11:00', startHour: 10, zone: 'A' },
  { id: '11-12', label: '11:00 - 12:00', startHour: 11, zone: 'A' },
  { id: '12-13', label: '12:00 - 13:00', startHour: 12, zone: 'B' },
  { id: '13-14', label: '13:00 - 14:00', startHour: 13, zone: 'B' },
  { id: '14-15', label: '14:00 - 15:00', startHour: 14, zone: 'B' },
  { id: '15-16', label: '15:00 - 16:00', startHour: 15, zone: 'C' },
  { id: '16-17', label: '16:00 - 17:00', startHour: 16, zone: 'C' },
  { id: '17-18', label: '17:00 - 18:00', startHour: 17, zone: 'C' },
  { id: '18-19', label: '18:00 - 19:00', startHour: 18, zone: 'D' },
  { id: '19-20', label: '19:00 - 20:00', startHour: 19, zone: 'D' },
  { id: '20-21', label: '20:00 - 21:00', startHour: 20, zone: 'E' },
  { id: '21-22', label: '21:00 - 22:00', startHour: 21, zone: 'E' },
];

const MIN_PLAYERS = 5; // 成團最低人數

export default function Home() {
  const [activityTitle, setActivityTitle] = useState('🏸 週六羽球臨打報名');
  const [maxPlayers, setMaxPlayers] = useState(40);

  const [newTitleInput, setNewTitleInput] = useState('');
  const [newMaxPlayersInput, setNewMaxPlayersInput] = useState('40');
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  const [name, setName] = useState('');
  const [level, setLevel] = useState('7級');
  const [selectedHours, setSelectedHours] = useState<string[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myRegistrationIds, setMyRegistrationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔑 管理員相關狀態
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const ADMIN_PASSWORD = 'admin888';

  const getStartHourFromSlot = (slotStr?: string): number => {
    if (!slotStr) return 99;
    const match = slotStr.match(/(\d{2}):00/);
    return match ? parseInt(match[1], 10) : 99;
  };

  // 1. 抓取系統設定
  const fetchSettings = async () => {
    const { data } = await supabase.from('system_settings').select('*');

    if (data) {
      const titleItem = data.find((item) => item.key === 'activity_title');
      const maxPlayersItem = data.find((item) => item.key === 'max_players');

      if (titleItem && titleItem.value) {
        setActivityTitle(titleItem.value);
        setNewTitleInput(titleItem.value);
      }
      if (maxPlayersItem && maxPlayersItem.value) {
        const val = parseInt(maxPlayersItem.value, 10);
        if (!isNaN(val)) {
          setMaxPlayers(val);
          setNewMaxPlayersInput(val.toString());
        }
      }
    }
  };

  // 2. 抓取報名資料
  const fetchPlayers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('抓取資料失敗：', error);
    } else if (data) {
      const sortedPlayers = [...data].sort((a, b) => {
        const startA = getStartHourFromSlot(a.time_slot);
        const startB = getStartHourFromSlot(b.time_slot);

        if (startA !== startB) {
          return startA - startB;
        }

        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      });

      setPlayers(sortedPlayers);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
    fetchPlayers();

    const savedIds = localStorage.getItem('my_badminton_ids');
    if (savedIds) {
      try {
        setMyRegistrationIds(JSON.parse(savedIds));
      } catch (e) {
        console.error('Failed to parse saved IDs', e);
      }
    }
  }, []);

  // 👑 管理員更新設定
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitleInput.trim()) return alert('標題不能為空！');
    const parsedMax = parseInt(newMaxPlayersInput, 10);
    if (isNaN(parsedMax) || parsedMax <= 0) return alert('請輸入有效的人數上限！');

    const { error: error1 } = await supabase
      .from('system_settings')
      .upsert({ key: 'activity_title', value: newTitleInput.trim() });

    const { error: error2 } = await supabase
      .from('system_settings')
      .upsert({ key: 'max_players', value: parsedMax.toString() });

    if (error1 || error2) {
      alert('更新失敗：' + (error1?.message || error2?.message));
    } else {
      setActivityTitle(newTitleInput.trim());
      setMaxPlayers(parsedMax);
      setIsEditingSettings(false);
      alert('🎉 活動設定已更新！');
    }
  };

  // 📊 計算每個 1 小時小區塊目前包含的總人數
  const getHourCount = (hourOpt: TimeOption) => {
    return players.filter((p) => {
      if (!p.time_slot) return false;
      const match = p.time_slot.match(/(\d{2}):00\s*-\s*(\d{2}):00/);
      if (!match) return false;
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      return hourOpt.startHour >= start && hourOpt.startHour < end;
    }).length;
  };

  // 📊 計算大區塊 (A, B, C, D, E) 的報名總人數
  const getZoneCount = (zone: 'A' | 'B' | 'C' | 'D' | 'E') => {
    return players.filter((p) => {
      if (!p.time_slot) return false;
      const match = p.time_slot.match(/(\d{2}):00\s*-\s*(\d{2}):00/);
      if (!match) return false;
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);

      const zoneHours = ALL_TIME_OPTIONS.filter((opt) => opt.zone === zone);
      return zoneHours.some((opt) => opt.startHour >= start && opt.startHour < end);
    }).length;
  };

  // 🏷️ 計算單一球友在該時段中的 正取 / 備取 狀態與序號
  const getPlayerStatus = (player: Player) => {
    if (!player.time_slot) return { isBackup: false, backupIndex: 0 };

    const match = player.time_slot.match(/(\d{2}):00\s*-\s*(\d{2}):00/);
    if (!match) return { isBackup: false, backupIndex: 0 };

    const pStart = parseInt(match[1], 10);
    const pEnd = parseInt(match[2], 10);

    const sameSlotPlayers = players.filter((p) => {
      if (!p.time_slot) return false;
      const m = p.time_slot.match(/(\d{2}):00\s*-\s*(\d{2}):00/);
      if (!m) return false;
      const s = parseInt(m[1], 10);
      const e = parseInt(m[2], 10);
      return Math.max(pStart, s) < Math.min(pEnd, e);
    }).sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    });

    const index = sameSlotPlayers.findIndex((p) => p.id === player.id);
    if (index >= maxPlayers) {
      return { isBackup: true, backupIndex: index - maxPlayers + 1 };
    }
    return { isBackup: false, backupIndex: 0 };
  };

  // 💰 從時段字串計算總小時數與金額
  const calculateDurationAndPrice = (slotStr?: string): { hours: number; price: number } => {
    if (!slotStr) return { hours: 0, price: 0 };

    const matchHr = slotStr.match(/\(共(\d+)hr\)/);
    let hours = matchHr ? parseInt(matchHr[1], 10) : 0;

    if (!hours) {
      const matchTime = slotStr.match(/(\d{2}):00\s*-\s*(\d{2}):00/);
      if (matchTime) {
        hours = parseInt(matchTime[2], 10) - parseInt(matchTime[1], 10);
      }
    }

    let price = 0;
    if (hours === 2) {
      price = 230;
    } else if (hours === 3) {
      price = 330;
    } else if (hours > 0) {
      price = hours * 110 + 10;
    }

    return { hours, price };
  };

  // 📥 匯出 CSV 功能
  const handleExportCSV = () => {
    if (players.length === 0) return alert('目前尚無報名資料可下載！');

    const headers = ['序號', '暱稱/姓名', '羽球程度', '臨打時段', '總時長', '應繳金額'];
    const rows = players.map((p, index) => {
      const { hours, price } = calculateDurationAndPrice(p.time_slot);
      return [
        index + 1,
        `"${p.player_name.replace(/"/g, '""')}"`,
        `"${p.player_level}"`,
        `"${p.time_slot || '未指定'}"`,
        `"${hours} 小時"`,
        `"${price} 元"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activityTitle}_報名名單.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTimeToggle = (id: string) => {
    if (selectedHours.includes(id)) {
      setSelectedHours(selectedHours.filter((h) => h !== id));
    } else {
      setSelectedHours([...selectedHours, id]);
    }
  };

  const validateTimeSlots = (): { valid: boolean; message: string; formattedSlotString: string } => {
    if (selectedHours.length === 0) {
      return { valid: false, message: '請至少選擇 1 個小時的時段！', formattedSlotString: '' };
    }

    const selectedObjs = ALL_TIME_OPTIONS.filter((opt) => selectedHours.includes(opt.id)).sort(
      (a, b) => a.startHour - b.startHour
    );

    for (let i = 0; i < selectedObjs.length - 1; i++) {
      if (selectedObjs[i + 1].startHour !== selectedObjs[i].startHour + 1) {
        return { valid: false, message: '選擇的時段必須是連續的時間，不能跳號選擇喔！', formattedSlotString: '' };
      }
    }

    const totalHours = selectedObjs.length;
    const zonesUsed = Array.from(new Set(selectedObjs.map((opt) => opt.zone))).sort();
    const zonesKey = zonesUsed.join('');

    const allowedZoneCombinations = ['A', 'B', 'C', 'D', 'E', 'AB', 'BC', 'DE'];

    if (!allowedZoneCombinations.includes(zonesKey)) {
      return { valid: false, message: '不允許此跨區組合！僅允許 A+B、B+C 或 D+E 跨區。', formattedSlotString: '' };
    }

    if (zonesUsed.length > 1 && totalHours < 3) {
      return { valid: false, message: '跨區域報名必須選擇滿 3 小時（含）以上！', formattedSlotString: '' };
    }

    const startStr = selectedObjs[0].label.split(' - ')[0];
    const endStr = selectedObjs[selectedObjs.length - 1].label.split(' - ')[1];
    const formattedSlotString = `${startStr} - ${endStr} (${totalHours}hr)`;

    return { valid: true, message: '', formattedSlotString };
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      return alert('請輸入暱稱！');
    }

    const isDuplicate = players.some(
      (p) => p.player_name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      return alert(`「${trimmedName}」這個暱稱已經有人使用囉！請換一個暱稱。`);
    }

    const validation = validateTimeSlots();
    if (!validation.valid) {
      return alert(validation.message);
    }

    const { data, error } = await supabase
      .from('registrations')
      .insert([
        {
          player_name: trimmedName,
          player_level: level,
          time_slot: validation.formattedSlotString,
        },
      ])
      .select();

    if (error) {
      alert('報名失敗：' + error.message);
    } else if (data && data.length > 0) {
      const newRegistration = data[0];
      const updatedMyIds = [...myRegistrationIds, newRegistration.id];

      setMyRegistrationIds(updatedMyIds);
      localStorage.setItem('my_badminton_ids', JSON.stringify(updatedMyIds));

      setName('');
      setSelectedHours([]);
      fetchPlayers();
      alert('🎉 報名成功！');
    }
  };

  const handleCancel = async (id: string, playerName: string) => {
    if (!confirm(`確定要取消 ${playerName} 的報名嗎？`)) return;

    const { error } = await supabase
      .from('registrations')
      .delete()
      .eq('id', id);

    if (error) {
      alert('取消失敗：' + error.message);
    } else {
      const updatedMyIds = myRegistrationIds.filter((myId) => myId !== id);
      setMyRegistrationIds(updatedMyIds);
      localStorage.setItem('my_badminton_ids', JSON.stringify(updatedMyIds));
      fetchPlayers();
    }
  };

  const handleAdminDelete = async (id: string, playerName: string) => {
    if (!confirm(`【管理員操作】確定要刪除「${playerName}」的報名嗎？`)) return;

    const { error } = await supabase
      .from('registrations')
      .delete()
      .eq('id', id);

    if (error) {
      alert('刪除失敗：' + error.message);
    } else {
      fetchPlayers();
    }
  };

  const handleAdminClearAll = async () => {
    if (!confirm('⚠️【危險操作】確定要清空「所有」球友的報名資料嗎？此動作無法復原！')) return;
    if (!confirm('再次確認：這將會刪除名單上的全部資料，確定要清空嗎？')) return;

    const { error } = await supabase
      .from('registrations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      alert('清空失敗：' + error.message);
    } else {
      alert('已成功清空所有報名資料！');
      fetchPlayers();
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setAdminPasswordInput('');
      alert('🔓 管理員模式已開啟！');
    } else {
      alert('❌ 密碼錯誤！');
    }
  };

  return (
    <main className="max-w-md mx-auto p-4 bg-slate-50 min-h-screen">
      {/* 👑 管理員編輯活動設定 */}
      {isAdmin && isEditingSettings ? (
        <form onSubmit={handleUpdateSettings} className="my-4 bg-white p-3 rounded-xl shadow border border-blue-200 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">修改活動標題</label>
            <input
              type="text"
              value={newTitleInput}
              onChange={(e) => setNewTitleInput(e.target.value)}
              className="w-full text-sm p-2 border border-slate-300 rounded text-slate-800 outline-none focus:border-blue-500"
              placeholder="例如：🏸 8/23 (六) 羽球臨打報名"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">各時段正取人數上限 (人)</label>
            <input
              type="number"
              value={newMaxPlayersInput}
              onChange={(e) => setNewMaxPlayersInput(e.target.value)}
              className="w-full text-sm p-2 border border-slate-300 rounded text-slate-800 outline-none focus:border-blue-500"
              placeholder="預設 40 人"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditingSettings(false)}
              className="text-xs bg-slate-200 text-slate-600 px-3 py-1.5 rounded font-bold"
            >
              取消
            </button>
            <button
              type="submit"
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-700"
            >
              儲存設定
            </button>
          </div>
        </form>
      ) : (
        <div className="relative group my-4 text-center">
          <h1 className="text-2xl font-bold text-slate-800 px-6">
            {activityTitle}
          </h1>
          {isAdmin && (
            <button
              onClick={() => setIsEditingSettings(true)}
              className="mt-1 text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full font-semibold hover:bg-blue-100 transition"
            >
              ⚙️ 修改標題與人數上限
            </button>
          )}
        </div>
      )}

      {/* 管理員狀態提示 */}
      {isAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl mb-4 text-xs font-semibold flex justify-between items-center">
          <span>👑 目前為管理員模式</span>
          <button
            onClick={() => setIsAdmin(false)}
            className="text-red-600 underline font-bold"
          >
            退出管理員
          </button>
        </div>
      )}

      {/* 人數總覽與各區統計卡片 */}
      <div className="bg-white p-3.5 rounded-xl shadow mb-4 border border-slate-100">
        <div className="flex justify-around text-xs text-center border-b border-slate-100 pb-3 mb-3">
          <div>
            <span className="text-gray-400 block mb-0.5">成團低標</span>
            <span className="font-bold text-slate-700">{MIN_PLAYERS} 人 / 時段</span>
          </div>
          <div className="border-r border-slate-200 h-8 my-auto"></div>
          <div>
            <span className="text-gray-400 block mb-0.5">正取上限</span>
            <span className="font-bold text-blue-600">{maxPlayers} 人 / 時段</span>
          </div>
        </div>

        {/* 📊 A ~ E 各區即時人數 */}
        <div>
          <p className="text-[11px] font-bold text-slate-500 mb-2 text-center">
            📍 各時段即時人數 (達 {MIN_PLAYERS} 人成團，額滿自動轉備取)
          </p>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {[
              { code: 'A', name: '09-12' },
              { code: 'B', name: '12-15' },
              { code: 'C', name: '15-18' },
              { code: 'D', name: '18-20' },
              { code: 'E', name: '20-22' },
            ].map((z) => {
              const count = getZoneCount(z.code as 'A' | 'B' | 'C' | 'D' | 'E');
              const isGrouped = count >= MIN_PLAYERS;
              const isFull = count >= maxPlayers;

              return (
                <div
                  key={z.code}
                  className={`p-1.5 rounded-lg border ${
                    isFull
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : isGrouped
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-slate-50 border-slate-100 text-slate-600'
                  }`}
                >
                  <span className="text-[10px] block font-bold text-slate-400">{z.code}區</span>
                  <span className="text-[10px] block scale-90 text-slate-400">{z.name}</span>
                  <span className="text-xs font-bold font-mono">{count}人</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 報名表單 */}
      <form onSubmit={handleRegister} className="space-y-4 bg-white p-4 rounded-xl shadow mb-6 border border-slate-100">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">暱稱 / 姓名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
            placeholder="請輸入暱稱（不可重複）"
          />
        </div>

        {/* 時段勾選區 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            選擇臨打時段（點擊可複選每小時）
          </label>
          <p className="text-xs text-gray-400 mb-2">
            💡 規則：滿 {maxPlayers} 人轉備取。滿 3hr 可 A+B、B+C、D+E 跨區。
          </p>

          <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2.5 bg-slate-50">
            {[
              { title: 'A 時段 (09:00 - 12:00)', zone: 'A' },
              { title: 'B 時段 (12:00 - 15:00)', zone: 'B' },
              { title: 'C 時段 (15:00 - 18:00)', zone: 'C' },
              { title: 'D 時段 (18:00 - 20:00)', zone: 'D' },
              { title: 'E 時段 (20:00 - 22:00)', zone: 'E' },
            ].map((group) => (
              <div key={group.zone} className="bg-white p-2 rounded border border-slate-100">
                <p className="text-xs font-bold text-slate-600 mb-1 border-b pb-1 flex justify-between items-center">
                  <span>{group.title}</span>
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {ALL_TIME_OPTIONS.filter((opt) => opt.zone === group.zone).map((opt) => {
                    const isChecked = selectedHours.includes(opt.id);
                    const count = getHourCount(opt);
                    const isFull = count >= maxPlayers;
                    const isGrouped = count >= MIN_PLAYERS;
                    const backupNum = isFull ? count - maxPlayers + 1 : 0;

                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between text-xs p-1.5 rounded cursor-pointer transition ${
                          isChecked
                            ? 'bg-blue-50 border border-blue-300 font-semibold text-blue-700'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTimeToggle(opt.id)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>{opt.label}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-gray-500">
                            {count}/{maxPlayers}人
                          </span>
                          {isFull ? (
                            <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold">
                              備取+{backupNum}
                            </span>
                          ) : isGrouped ? (
                            <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-bold">
                              已成團
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-bold">
                              差{MIN_PLAYERS - count}人
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🏆 18 級羽球程度選擇區 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            羽球程度 (1 - 18 級)
          </label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 bg-white text-xs"
          >
            <option value="1級">1級 - 新手 (剛接觸，懂得比賽禮儀)</option>
            <option value="2級">2級 - 新手 (球齡&lt;1年，中場來回10拍)</option>
            <option value="3級">3級 - 新手 (定點擊球至中後場)</option>
            <option value="4級">4級 - 初階 (球齡1-3年，長球/平推)</option>
            <option value="5級">5級 - 初階 (懂基本腳步、非受迫球路)</option>
            <option value="6級">6級 - 初中階 (球齡3-5年，懂基本輪轉)</option>
            <option value="7級">7級 - 初中階 (殺/切/長球成功率七成)</option>
            <option value="8級">8級 - 中階 (球齡5-10年，熟悉輪轉戰略)</option>
            <option value="9級">9級 - 中階 (球路發力強、高準確度)</option>
            <option value="10級">10級 - 中進階 (球齡&gt;10年，靈活戰略)</option>
            <option value="11級">11級 - 中進階 (反拍各種球路，具威脅性)</option>
            <option value="12級">12級 - 中進階 (高速度移位、高強度侵略)</option>
            <option value="13級">13級 - 高階 (校隊前段/體保/社會甲組)</option>
            <option value="14級">14級 - 高階 (穩定熟練、防守無死角)</option>
            <option value="15級">15級 - 高階 (球速快、戰略組織上等)</option>
            <option value="16級">16級 - 職業級 (甲組/國家代表選手)</option>
            <option value="17級">17級 - 職業級 (戰術步法爐火純青)</option>
            <option value="18級">18級 - 職業級 (個人獨特球路風格)</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow"
        >
          立即報名 (+1)
        </button>
      </form>

      {/* 報名名單 */}
      <div className="bg-white p-4 rounded-xl shadow border border-slate-100 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-slate-700 text-sm">
            📋 本週報名名單 (共 {players.length} 人，依時段排序)
          </h2>
          {isAdmin && players.length > 0 && (
            <div className="flex gap-1.5">
              <button
                onClick={handleExportCSV}
                className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold hover:bg-emerald-200 transition"
              >
                📥 下載清單 (CSV)
              </button>
              <button
                onClick={handleAdminClearAll}
                className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-bold hover:bg-red-200 transition"
              >
                ⚠️ 一鍵清空名單
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm text-center py-4">連線雲端資料庫中...</p>
        ) : players.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">目前還沒有人報名，快搶頭香！</p>
        ) : (
          <ul className="space-y-2">
            {players.map((p, index) => {
              const isMyRegistration = myRegistrationIds.includes(p.id);
              const { isBackup, backupIndex } = getPlayerStatus(p);

              return (
                <li
                  key={p.id}
                  className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-lg border border-slate-100"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-500">{index + 1}.</span>
                      <span className="font-semibold text-slate-800">{p.player_name}</span>
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-medium">
                        {p.player_level}
                      </span>

                      {/* 正取 / 備取 標籤 */}
                      {isBackup ? (
                        <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-bold">
                          備取 #{backupIndex}
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-bold">
                          正取
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 pl-5">
                      ⏰ {p.time_slot || '未指定時段'}
                    </div>
                  </div>

                  <div className="flex gap-1">
                    {isAdmin ? (
                      <button
                        onClick={() => handleAdminDelete(p.id, p.player_name)}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold hover:bg-red-600 transition"
                      >
                        刪除
                      </button>
                    ) : (
                      isMyRegistration && (
                        <button
                          onClick={() => handleCancel(p.id, p.player_name)}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded hover:bg-red-50 border border-red-200 transition"
                        >
                          取消
                        </button>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 🔐 管理員登入區塊 */}
      {!isAdmin && (
        <form onSubmit={handleAdminLogin} className="pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-gray-400 mb-2">主辦人管理後台</p>
          <div className="flex gap-2 max-w-xs mx-auto">
            <input
              type="password"
              placeholder="輸入管理密碼"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
              className="flex-1 text-xs p-2 border border-gray-300 rounded outline-none text-slate-800"
            />
            <button
              type="submit"
              className="text-xs bg-slate-700 text-white px-3 py-2 rounded font-semibold hover:bg-slate-800"
            >
              登入
            </button>
          </div>
        </form>
      )}
    </main>
  );
}