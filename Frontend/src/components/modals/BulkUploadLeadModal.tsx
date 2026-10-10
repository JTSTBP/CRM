import React, { useState, useRef, useEffect } from 'react';
import DuplicatePhoneModal from './DuplicatePhoneModal';
import { X, Upload, Download, AlertCircle, CheckCircle2, Loader2, FileText } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

interface BulkUploadLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadSuccess: () => void;
    source?: string;
}

const BulkUploadLeadModal: React.FC<BulkUploadLeadModalProps> = ({ isOpen, onClose, onUploadSuccess, source }) => {
  // State for duplicate phone detection
  const [duplicateConflicts, setDuplicateConflicts] = useState<Array<{ website: string; rows: Array<{ data: any; index: number }> }>>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showAllRows, setShowAllRows] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setPreviewData([]);
            setLoading(false);
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const instructions = [
        "Include 'Company Name' and 'Website URL' for every row.",
        "Provide 'Assigned By Email' to assign the lead to a specific user.",
        "To add multiple POCs for one lead, add multiple rows with the same Website URL.",
        "Existing leads will be updated, and new POCs will be appended."
    ];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

  // Detect duplicate phone numbers within the same website
  const detectDuplicatePhones = (data: any[]) => {
    const conflicts: Array<{ website: string; rows: Array<{ data: any; index: number }> }> = [];
    const map: { [website: string]: { [phone: string]: Array<{ data: any; index: number }> } } = {};

    data.forEach((row, idx) => {
      const website = row["Website URL"]?.toString().trim();
      const phone = row["POC Phone"]?.toString().trim();
      if (!website || !phone) return;
      if (!map[website]) map[website] = {};
      if (!map[website][phone]) map[website][phone] = [];
      map[website][phone].push({ data: row, index: idx });
    });

    Object.entries(map).forEach(([website, phones]) => {
      Object.entries(phones).forEach(([, rows]) => {
        if (rows.length > 1) {
          conflicts.push({ website, rows });
        }
      });
    });

    return conflicts;
  };

    const parseFile = (file: File) => {
        setLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                setPreviewData(json);
            } catch (err) {
                toast.error("Failed to parse file. Please ensure it's a valid Excel or CSV file.");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

// Removed unused date range helpers


    const downloadTemplate = () => {
        const template = [
            {
                "Company Name": "Example Corp",
                "Website URL": "example.com",
                "Company Email": "info@example.com",
                "Company Size": "50-100",
                "Industry": "Technology",
                "LinkedIn Link": "https://linkedin.com/company/example",
                "Assigned By Email": "admin@example.com",
                "POC Name": "John Doe",
                "POC Phone": "1234567890",
                "POC Email": "john@example.com",
                "POC LinkedIn": "https://linkedin.com/in/johndoe",
                "POC Designation": "Manager",
                "POC Stage": "New"
            }
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "lead_upload_template.xlsx");
    };

    const handleUpload = async (overrideData?: any[]) => {
  const dataToUpload = overrideData || previewData;
  if (!dataToUpload.length) {
    toast.error("No data to upload.");
    return;
  }

  // Detect duplicate phone numbers within the same website before proceeding
  const conflicts = detectDuplicatePhones(dataToUpload);
  if (conflicts.length && !overrideData) {
    setDuplicateConflicts(conflicts);
    setShowDuplicateModal(true);
    setUploading(false);
    return; // pause upload until user resolves conflicts
  }

  setUploading(true);
  try {
    const isEmailSendingTab = source === 'email_sending';
    // Group data by Website URL if present, otherwise by Company Name to handle duplicates
    const groupedLeads: { [key: string]: any } = {};

    dataToUpload.forEach((row: any, idx: number) => {
      const website = row["Website URL"]?.toString().trim();
      const companyName = row["Company Name"]?.toString().trim();

      // Determine key: website takes precedence, else company name
      let key = website || companyName;
      if (!key) {
        if (isEmailSendingTab) {
          key = `row_unnamed_${idx}`;
        } else {
          return;
        }
      }

      if (!groupedLeads[key]) {
        groupedLeads[key] = {
          company_name: companyName,
          website_url: website || undefined,
          company_email: row["Company Email"] || "",
          company_size: row["Company Size"] || "",
          industry_name: row["Industry"] || "",
          linkedin_link: row["LinkedIn Link"] || "",
          assigned_by_email: row["Assigned By Email"] || "",
          points_of_contact: []
        };
      }

      if (row["POC Name"] || row["POC Phone"]) {
        groupedLeads[key].points_of_contact.push({
          name: row["POC Name"] || "N/A",
          phone: row["POC Phone"]?.toString() || "N/A",
          email: row["POC Email"] || "",
          linkedin_url: row["POC LinkedIn"] || "",
          designation: row["POC Designation"] || "",
          stage: row["POC Stage"] || "New"
        });
      }
    });

    const leadsArray = Object.values(groupedLeads);

    if (leadsArray.length === 0) {
      toast.error("No valid leads found in the file. Check mandatory fields.");
      setUploading(false);
      return;
    }

    const token = localStorage.getItem('token');
    const uploadUrl = isEmailSendingTab
      ? `${API_BASE_URL}/api/email-leads/bulk-upload`
      : `${API_BASE_URL}/api/leads/bulk-upload`;

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token || ''
      },
      body: JSON.stringify({ leads: leadsArray })
    });

    const result = await response.json();
    if (response.ok) {
      toast.success(`Successfully uploaded. Created: ${result.stats.created}, Updated: ${result.stats.updated}`);
      if (result.stats.failed > 0) {
        toast.error(`${result.stats.failed} leads failed to upload.`);
        console.error("Bulk upload errors:", result.stats.errors);
      }
      onUploadSuccess();
      onClose();
    } else {
      throw new Error(result.message || "Bulk upload failed");
    }
  } catch (err: any) {
    toast.error(err.message);
  } finally {
    setUploading(false);
  }
};


    return (
        <>
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 max-h-screen overflow-y-auto">
            <div className="absolute inset-0 bg-[#0f172a]/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-y-auto animate-in fade-in zoom-in-95 duration-300" style={{ maxHeight: '90vh' }}>
                <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-[#0f1c2e]">Bulk Upload Leads</h2>
                        <p className="text-[0.65rem] sm:text-sm text-slate-500 mt-0.5">Import multiple leads via Excel or CSV.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-5 sm:p-8">
                    {instructions.length > 0 && (
                        <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <h3 className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-wider mb-2">Instructions</h3>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                                {instructions.map((inst, i) => (
                                    <li key={i} className="text-[0.65rem] text-slate-600 list-disc list-inside">{inst}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {!file ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-[#0ea5e9] hover:bg-sky-50/50 transition-all group"
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".xlsx, .xls, .csv"
                            />
                            <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center text-[#0ea5e9] group-hover:scale-110 transition-transform shrink-0">
                                <Upload size={32} />
                            </div>
                            <div className="text-center">
                                <p className="text-base sm:text-lg font-bold text-[#0f1c2e]">Click to upload or drag and drop</p>
                                <p className="text-xs sm:text-sm text-slate-500">Excel (.xlsx, .xls) or CSV files only</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                                className="mt-2 flex items-center gap-2 text-xs sm:text-sm font-bold text-[#0ea5e9] hover:underline"
                            >
                                <Download size={16} />
                                Download Template
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-[#0f1c2e]">{file.name}</p>
                                        <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB • {previewData.length} rows detected</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setFile(null); setPreviewData([]); }}
                                    className="text-xs font-bold text-rose-500 hover:underline"
                                >
                                    Remove File
                                </button>
                            </div>

                            <div className="max-h-[300px] overflow-auto border border-slate-100 rounded-2xl shadow-inner bg-slate-50/30">
                                <table className="w-full text-left text-[0.65rem] border-collapse relative">
                                    <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-sm z-10">
                                        <tr>
                                            {previewData.length > 0 && Object.keys(previewData[0]).map(key => (
                                                <th key={key} className="px-3 py-2.5 font-bold text-slate-500 whitespace-nowrap border-b border-slate-200">{key}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                         {previewData.slice(0, showAllRows ? previewData.length : 10).map((row, i) => (
                                             <tr key={i} className="hover:bg-slate-50 transition-colors bg-white">
                                                 {Object.values(row).map((val: any, j) => (
                                                     <td key={j} className="px-3 py-2 text-slate-600 truncate max-w-[120px]">{val}</td>
                                                 ))}
                                             </tr>
                                         ))}
                                    </tbody>
                                </table>
                                {previewData.length > 10 && !showAllRows && (
                                    <button
                                        onClick={() => setShowAllRows(true)}
                                        className="p-2 text-center text-slate-400 text-[9px] font-bold bg-slate-50/80 hover:bg-slate-200 transition-colors sticky bottom-0 border-t border-slate-100"
                                    >
                                        + {previewData.length - 10} more rows (show all)
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100 flex gap-2">
                                    <CheckCircle2 size={16} className="text-blue-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[0.65rem] font-bold text-blue-900">Valid Records</p>
                                        <p className="text-[0.55rem] text-blue-700 leading-relaxed">Website URL and Company Name are used for merging.</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-100 flex gap-2">
                                    <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[0.65rem] font-bold text-amber-900">Merge Logic</p>
                                        <p className="text-[0.55rem] text-amber-700 leading-relaxed">Existing leads will have new POCs appended automatically.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 sm:p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 font-bold">
                    <button
                        onClick={onClose}
                        className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-slate-500 hover:bg-slate-200 transition-all text-xs sm:text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handleUpload()}
                        disabled={!file || uploading || loading}
                        className="flex-[2] sm:flex-none flex items-center justify-center gap-2 bg-[#0ea5e9] text-white px-8 py-3 rounded-xl transition-all hover:bg-[#0284c7] shadow-lg shadow-sky-500/20 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
                    >
                        {uploading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Importing...
                            </>
                        ) : (
                            <>
                                <Upload size={16} />
                                Start Import
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
        {/* Duplicate Phone Conflict Modal */}
        {showDuplicateModal && (
            <DuplicatePhoneModal
                isOpen={showDuplicateModal}
                conflicts={duplicateConflicts}
                onClose={() => setShowDuplicateModal(false)}
                onConfirm={(selected) => {
                    // Apply user selections and continue upload
                    const keptIndices = new Set<number>();
                    selected.forEach(conflict => {
                        conflict.rows.forEach(row => keptIndices.add(row.index));
                    });
                    const filteredData = previewData.filter((_row, idx) => {
                        // if row is part of any conflict and not selected, discard
                        const inConflict = duplicateConflicts.some(c => c.rows.some(r => r.index === idx));
                        return !inConflict || keptIndices.has(idx);
                    });
                    setPreviewData(filteredData);
                    setShowDuplicateModal(false);
                    handleUpload(filteredData); // pass cleaned data directly to avoid using stale state
                }}
            />
            )}
            </>
    );
};

export default BulkUploadLeadModal;
