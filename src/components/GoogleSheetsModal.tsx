import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  PlusCircle,
  Code2,
  Globe,
  Save,
  Check
} from 'lucide-react';
import { Activity, Registration, SheetConfig } from '../types';
import {
  createCmuActivitySpreadsheet,
  fetchSharedConfig,
  saveSharedConfig,
  syncAllDataToSheet,
  fetchDataFromGoogleSheet,
  triggerZeroLoginSheetSync,
  clearSpreadsheetInfo,
  exportToCsv,
  GOOGLE_APPS_SCRIPT_CODE
} from '../services/googleSheets';
import { getAccessToken, googleSignIn } from '../services/firebaseAuth';

interface GoogleSheetsModalProps {
  onClose: () => void;
  activities: Activity[];
  registrations: Registration[];
  onDataLoadedFromSheet?: (activities: Activity[], registrations: Registration[]) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  onClose,
  activities,
  registrations,
  onDataLoadedFromSheet
}) => {
  const [config, setConfig] = useState<SheetConfig>({
    spreadsheetId: null,
    spreadsheetUrl: null,
    webhookUrl: null,
    autoSync: true,
  });

  const [inputWebhookUrl, setInputWebhookUrl] = useState('');
  const [inputSpreadsheetUrl, setInputSpreadsheetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showScriptGuide, setShowScriptGuide] = useState(false);

  useEffect(() => {
    fetchSharedConfig().then(cfg => {
      setConfig(cfg);
      if (cfg.webhookUrl) setInputWebhookUrl(cfg.webhookUrl);
      if (cfg.spreadsheetUrl) setInputSpreadsheetUrl(cfg.spreadsheetUrl);
    });
  }, []);

  const handleCreateNewSheet = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      let token = await getAccessToken();
      if (!token) {
        const signin = await googleSignIn();
        token = signin?.accessToken || null;
      }

      if (!token) {
        throw new Error('ไม่สามารถรับสิทธิ์เข้าถึงบัญชี Google ได้ กรุณาลองใหม่อีกครั้ง');
      }

      const res = await createCmuActivitySpreadsheet(token, activities, registrations);
      const updated = await saveSharedConfig({
        spreadsheetId: res.spreadsheetId,
        spreadsheetUrl: res.spreadsheetUrl,
      });
      setConfig(updated);
      setInputSpreadsheetUrl(res.spreadsheetUrl);
      setMessage({
        type: 'success',
        text: `สร้าง Google Sheet ใหม่สำเร็จแล้ว! ข้อมูลจะถูกเชื่อมต่ออัตโนมัติในทุกอุปกรณ์ทันที`
      });
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: 'error',
        text: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      let sheetId = config.spreadsheetId;
      let sheetUrl = inputSpreadsheetUrl.trim() || config.spreadsheetUrl;

      // Extract spreadsheet ID from URL if provided
      const match = sheetUrl?.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        sheetId = match[1];
      }

      const updated = await saveSharedConfig({
        webhookUrl: inputWebhookUrl.trim() || null,
        spreadsheetUrl: sheetUrl || null,
        spreadsheetId: sheetId,
        autoSync: true,
      });

      setConfig(updated);
      setMessage({
        type: 'success',
        text: 'บันทึกการตั้งค่า Google Sheets เรียบร้อยแล้ว! ทุกเครื่องจะเชื่อมต่อและบันทึกข้อมูลอัตโนมัติ'
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: 'บันทึกการตั้งค่าไม่สำเร็จ: ' + err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceSync = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      if (config.webhookUrl || inputWebhookUrl) {
        const res = await triggerZeroLoginSheetSync(inputWebhookUrl || config.webhookUrl || undefined);
        if (res.success) {
          setMessage({
            type: 'success',
            text: res.message,
          });
          setConfig(prev => ({ ...prev, lastSyncedAt: res.lastSyncedAt }));
        } else {
          setMessage({
            type: 'error',
            text: res.message,
          });
        }
      } else if (config.spreadsheetId) {
        let token = await getAccessToken();
        if (!token) {
          const signin = await googleSignIn();
          token = signin?.accessToken || null;
        }

        if (!token) {
          throw new Error('ไม่สามารถรับสิทธิ์เข้าถึงบัญชี Google ได้ กรุณากรอก Web App URL เพื่อซิงค์โดยไม่ต้องล็อกอิน');
        }

        await syncAllDataToSheet(token, config.spreadsheetId, activities, registrations);
        setMessage({
          type: 'success',
          text: 'ซิงค์ข้อมูลกิจกรรมและรายชื่อนักศึกษาทั้งหมดลงใน Google Sheet เรียบร้อยแล้ว'
        });
      } else {
        setMessage({
          type: 'error',
          text: 'กรุณาระบุ Web App URL หรือ Google Sheet URL ก่อนทำการซิงค์'
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'การซิงค์ข้อมูลล้มเหลว'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePullFromSheet = async () => {
    if (!config.spreadsheetId) {
      setMessage({
        type: 'error',
        text: 'ยังไม่ได้ระบุหรือเชื่อมต่อ Google Sheet'
      });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const token = await getAccessToken();
      const res = await fetchDataFromGoogleSheet(config.spreadsheetId, token || undefined);
      if (res.success) {
        if (onDataLoadedFromSheet) {
          onDataLoadedFromSheet(res.activities, res.registrations);
        }
        setMessage({
          type: 'success',
          text: `ดึงข้อมูลจาก Google Sheet สำเร็จ: พบกิจกรรม ${res.activities.length} โครงการ, ผู้สมัคร ${res.registrations.length} คน`
        });
      } else {
        setMessage({
          type: 'error',
          text: res.message || 'ไม่สามารถดึงข้อมูลจาก Google Sheet ได้'
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDisconnect = () => {
    if (window.confirm('คุณต้องการยกเลิกการผูก Google Sheet นี้หรือไม่? (ข้อมูลบน Google Drive ของคุณจะไม่ถูกลบ)')) {
      clearSpreadsheetInfo();
      setConfig({
        spreadsheetId: null,
        spreadsheetUrl: null,
        webhookUrl: null,
        autoSync: true,
      });
      setInputWebhookUrl('');
      setInputSpreadsheetUrl('');
      setMessage({
        type: 'success',
        text: 'ยกเลิกการเชื่อมต่อเรียบร้อยแล้ว'
      });
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'รหัสกิจกรรม',
      'ชื่อกิจกรรม',
      'หมวดหมู่',
      'สถานที่จัด',
      'วันเวลาจัด',
      'จำนวนรับ',
      'วันเปิดรับสมัคร',
      'วันปิดรับสมัคร'
    ];
    const rows = activities.map(a => [
      a.code,
      a.title,
      a.categoryLabel,
      a.location,
      a.eventDateTime,
      a.maxParticipants,
      a.openDate,
      a.closeDate
    ]);
    exportToCsv('สำเนาข้อมูลกิจกรรมหอพัก_มช', [headers, ...rows]);
  };

  const isConnected = Boolean(config.spreadsheetId || config.webhookUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white p-6 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">
              GOOGLE SHEETS MULTI-DEVICE SYNC
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {message && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-start gap-2 border ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Connection Status Card */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                สถานะการเชื่อมต่อส่วนกลาง:
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                  isConnected
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {isConnected ? 'เชื่อมต่ออัตโนมัติทุกอุปกรณ์' : 'ยังไม่ได้เชื่อมต่อ'}
              </span>
            </div>

            {config.spreadsheetUrl && (
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 truncate max-w-[280px]">
                  ลิงก์: {config.spreadsheetUrl}
                </span>
                <a
                  href={config.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline shrink-0"
                >
                  เปิดดู Sheet <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Option 1: 1-Click Create with Google Account */}
          <div className="p-4 rounded-2xl border border-purple-100 bg-purple-50/50 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#6C3994] text-white text-[11px] font-bold flex items-center justify-center">
                1
              </span>
              <h4 className="text-xs font-bold text-slate-900">
                สร้าง Google Sheet อัตโนมัติด้วย Google Account
              </h4>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              คลิกปุ่มด้านล่างเพื่อสร้างไฟล์ Google Sheet พร้อมแท็บ "กิจกรรมทั้งหมด" และ "รายชื่อผู้สมัครเข้าร่วม" บน Google Drive ของคุณโดยตรง
            </p>
            <button
              onClick={handleCreateNewSheet}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-[#6C3994] to-[#8648B8] hover:from-[#562879] hover:to-[#6C3994] text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              <PlusCircle className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'กำลังสร้าง Google Sheet...' : 'สร้าง Google Sheet กิจกรรมอัตโนมัติ'}</span>
            </button>
          </div>

          {/* Option 2: Connect Existing Sheet via Webhook (Universal No-Auth on all student devices) */}
          <form onSubmit={handleSaveWebhook} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                  2
                </span>
                <h4 className="text-xs font-bold text-slate-900">
                  เชื่อมต่อ Google Sheet หรือ Google Apps Script Web App
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptGuide(!showScriptGuide)}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{showScriptGuide ? 'ซ่อนโค้ดสคริปต์' : 'ดูโค้ด Apps Script'}</span>
              </button>
            </div>

            {/* Expandable Apps Script helper */}
            {showScriptGuide && (
              <div className="p-3 bg-slate-900 text-slate-200 rounded-xl text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-semibold text-[11px]">
                    คัดลอกโค้ดนี้ไปวางใน Google Sheet &gt; Extensions &gt; Apps Script
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-medium transition-colors"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ด'}</span>
                  </button>
                </div>
                <pre className="max-h-36 overflow-y-auto text-[10px] p-2 bg-black/40 rounded font-mono text-slate-300">
                  {GOOGLE_APPS_SCRIPT_CODE}
                </pre>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                URL ของ Google Sheet (สำหรับเปิดดูและดึงรหัสชีต)
              </label>
              <input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={inputSpreadsheetUrl}
                onChange={e => setInputSpreadsheetUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-200 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Web App URL (Google Apps Script Webhook สำหรับบันทึกอัตโนมัติจากทุกเครื่อง)
              </label>
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={inputWebhookUrl}
                onChange={e => setInputWebhookUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-200 text-xs"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                * เมื่อกรอก URL นี้ นักศึกษาจะสามารถสมัครจากโทรศัพท์มือถือเครื่องใดก็ได้ และข้อมูลจะเข้า Google Sheet ทันทีโดยไม่ต้องล็อกอิน
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>บันทึกการตั้งค่าลงระบบส่วนกลาง</span>
            </button>
          </form>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {config.spreadsheetId && (
              <>
                <button
                  type="button"
                  onClick={handlePullFromSheet}
                  disabled={isLoading}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>ดึงข้อมูลจาก Google Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={handleForceSync}
                  disabled={isLoading}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>ซิงค์ข้อมูลลง Sheet</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-[#6C3994] text-xs font-semibold rounded-xl border border-purple-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>สำรองข้อมูลเป็น CSV</span>
            </button>
          </div>

          {isConnected && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors"
              >
                ยกเลิกการเชื่อมต่อกับ Google Sheet นี้
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
