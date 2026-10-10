// import React, { useState } from 'react';
// import { X } from 'lucide-react';
// import toast from 'react-hot-toast';

// interface ConflictRow {
//   data: any;
//   index: number;
// }

// interface DuplicateConflict {
//   website: string;
//   rows: ConflictRow[];
// }

// interface DuplicatePhoneModalProps {
//   isOpen: boolean;
//   conflicts: DuplicateConflict[];
//   onClose: () => void;
//   /**
//    * Called with the list of conflicts the user selected to KEEP.
//    * Each conflict includes the website and the rows the user retained.
//    */
//   onConfirm: (selected: DuplicateConflict[]) => void;
// }

// /**
//  * Modal displays duplicate phone entries grouped by website.
//  * For each group the user can pick a single row (or multiple if they wish) to keep.
//  * After confirmation the parent component will continue the upload with the filtered data.
//  */
// export const DuplicatePhoneModal: React.FC<DuplicatePhoneModalProps> = ({
//   isOpen,
//   conflicts,
//   onClose,
//   onConfirm,
// }) => {
//   const filteredConflicts = React.useMemo(() => conflicts.filter(conflict => conflict.rows.some(row => {
//     const email = (row.data["POC Email"] ?? "").toString().trim();
//     const phone = (row.data["POC Phone"] ?? "").toString().trim();
//     return email || phone;
//   })), [conflicts]);
//   const [selectedMap, setSelectedMap] = useState<Record<string, Set<number>>>(() => {
//     const initMap: Record<string, Set<number>> = {};
//     filteredConflicts.forEach((conflict, idx) => {
//       const fullRows = conflict.rows.filter(row => {
//         const name = (row.data["POC Name"] ?? "").toString().trim();
//         const phone = (row.data["POC Phone"] ?? "").toString().trim();
//         const email = (row.data["POC Email"] ?? "").toString().trim();
//         return name && phone && email;
//       });
//       if (fullRows.length > 0) {
//         initMap[idx.toString()] = new Set([fullRows[0].index]);
//       } else if (conflict.rows.length > 0) {
//         initMap[idx.toString()] = new Set([conflict.rows[0].index]);
//       } else {
//         initMap[idx.toString()] = new Set();
//       }
//     });
//     return initMap;
//   });
//       const fullRows = conflict.rows.filter(row => {
//         const name = (row.data["POC Name"] ?? "").toString().trim();
//         const phone = (row.data["POC Phone"] ?? "").toString().trim();
//         const email = (row.data["POC Email"] ?? "").toString().trim();
//         return name && phone && email;
//       });
//       if (fullRows.length > 0) {
//         initMap[idx.toString()] = new Set([fullRows[0].index]);
//       } else if (conflict.rows.length > 0) {
//         initMap[idx.toString()] = new Set([conflict.rows[0].index]);
//       } else {
//         initMap[idx.toString()] = new Set();
//       }
//     });
//     return initMap;
//   });

//   if (!isOpen) return null;

//   const toggleRow = (conflictKey: string, rowIdx: number) => {
//     setSelectedMap(prev => {
//       const currentSet = prev[conflictKey] ?? new Set();
//       const newSet = new Set(currentSet);
//       if (newSet.has(rowIdx)) {
//         // Deselect the row
//         newSet.delete(rowIdx);
//       } else {
//         // Select this row (only one per group)
//         newSet.clear();
//         newSet.add(rowIdx);
//       }
//       return { ...prev, [conflictKey]: newSet };
//     });
//   };

//     // Toggle all rows for filtered conflicts
//     const toggleAll = (selectAll: boolean) => {
//       setSelectedMap(prev => {
//         const newMap: Record<string, Set<number>> = {};
//         filteredConflicts.forEach((conflict, i) => {
//           if (selectAll) {
//             const allIndexes = conflict.rows.map(r => r.index);
//             newMap[i.toString()] = new Set(allIndexes);
//           } else {
//             newMap[i.toString()] = new Set();
//           }
//         });
//         return newMap;
//       });
//     };
//     const kept: DuplicateConflict[] = filteredConflicts.map((conflict, i) => {
//       const keptRows = conflict.rows.filter(r => selectedMap[i.toString()]?.has(r.index));
//       return { website: conflict.website, rows: keptRows };
//     });
//     // Directly confirm even if no rows are kept
//     onConfirm(kept);

//   };

//   return (
//     <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#0f172a]/40 backdrop-blur-sm">
//       <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-xl p-6 animate-in fade-in zoom-in-95 duration-300">
//         <div className="flex items-center justify-between mb-4">
//           <div className="flex items-center justify-between mb-4">
//             <h2 className="text-lg font-bold text-[#0f1c2e]">Duplicate Phone Numbers Detected</h2>
//             <div className="flex gap-2">
//               <button onClick={() => toggleAll(true)} className="px-3 py-1 rounded bg-slate-200 text-slate-800 hover:bg-slate-300 transition" title="Select all rows">
//                 Select All
//               </button>
//               <button onClick={() => toggleAll(false)} className="px-3 py-1 rounded bg-slate-200 text-slate-800 hover:bg-slate-300 transition" title="Deselect all rows">
//                 Deselect All
//               </button>
//               <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded" aria-label="Close modal">
//                 <X size={20} className="text-slate-500" />
//               </button>
//             </div>
//           </div>
//         </div>
//         <p className="mb-4 text-sm text-slate-600">
//           The uploaded file contains rows with the same phone number for the same company (Website URL).
//           Please select which row(s) you want to keep for each duplicate group.
//         </p>
//         <div className="space-y-4 max-h-[60vh] overflow-y-auto">
//           {filteredConflicts.map((conflict, i) => (
//             <div key={i} className="border border-slate-200 rounded p-3">
//               <h3 className="font-medium text-slate-800 mb-2">Website: {conflict.website}</h3>
//               <table className="w-full text-left text-sm border-collapse">
//                 <thead className="bg-slate-50">
//                   <tr>
//                     <th className="px-2 py-1"></th>
//                     <th className="px-2 py-1">Row #</th>
//                     <th className="px-2 py-1">POC Name</th>
//                     <th className="px-2 py-1">Phone</th>
//                     <th className="px-2 py-1">Email</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {conflict.rows.map(row => (
//                     <tr key={row.index} className="hover:bg-slate-50">
//                       <td className="px-2 py-1 text-center">
//                         <input
//                           type="checkbox"
//                           checked={selectedMap[i.toString()]?.has(row.index) ?? false}
//                           onChange={() => toggleRow(i.toString(), row.index)}
//                           className="form-checkbox h-4 w-4 text-[#0ea5e9] border-slate-300 rounded"
//                         />
//                       </td>
//                       <td className="px-2 py-1">{row.index + 1}</td>
//                       <td className="px-2 py-1">{row.data["POC Name"] || "N/A"}</td>
//                       <td className="px-2 py-1">{row.data["POC Phone"]}</td>
//                       <td className="px-2 py-1">{row.data["POC Email"] || "—"}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           ))}
//         </div>
//         <div className="flex justify-end gap-3 mt-6">
//           <button
//             onClick={onClose}
//             className="px-4 py-2 rounded bg-slate-200 text-slate-800 hover:bg-slate-300 transition"
//           >
//             Cancel
//           </button>
//           <button
//             onClick={handleConfirm}
//             className="px-4 py-2 rounded bg-[#0ea5e9] text-white hover:bg-[#0284c7] transition"
//           >
//             Keep Selected
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default DuplicatePhoneModal;


import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface ConflictRow {
  data: any;
  index: number;
}

interface DuplicateConflict {
  website: string;
  rows: ConflictRow[];
}

interface DuplicatePhoneModalProps {
  isOpen: boolean;
  conflicts: DuplicateConflict[];
  onClose: () => void;
  onConfirm: (selected: DuplicateConflict[]) => void;
}

export const DuplicatePhoneModal: React.FC<DuplicatePhoneModalProps> = ({
  isOpen,
  conflicts,
  onClose,
  onConfirm,
}) => {
  const filteredConflicts = useMemo(
    () =>
      conflicts.filter((conflict) =>
        conflict.rows.some((row) => {
          const email = (row.data['POC Email'] ?? '').toString().trim();
          const phone = (row.data['POC Phone'] ?? '').toString().trim();
          return email || phone;
        })
      ),
    [conflicts]
  );

  const [selectedMap, setSelectedMap] = useState<Record<string, Set<number>>>(() => {
    const initMap: Record<string, Set<number>> = {};

    filteredConflicts.forEach((conflict, idx) => {
      const fullRows = conflict.rows.filter((row) => {
        const name = (row.data['POC Name'] ?? '').toString().trim();
        const phone = (row.data['POC Phone'] ?? '').toString().trim();
        const email = (row.data['POC Email'] ?? '').toString().trim();

        return name && phone && email;
      });

      if (fullRows.length > 0) {
        initMap[idx.toString()] = new Set([fullRows[0].index]);
      } else if (conflict.rows.length > 0) {
        initMap[idx.toString()] = new Set([conflict.rows[0].index]);
      } else {
        initMap[idx.toString()] = new Set();
      }
    });

    return initMap;
  });

  if (!isOpen) return null;

  const toggleRow = (conflictKey: string, rowIdx: number) => {
    setSelectedMap((prev) => {
      const currentSet = prev[conflictKey] ?? new Set<number>();
      const newSet = new Set(currentSet);

      if (newSet.has(rowIdx)) {
        newSet.delete(rowIdx);
      } else {
        newSet.clear(); // Only one selection per group
        newSet.add(rowIdx);
      }

      return {
        ...prev,
        [conflictKey]: newSet,
      };
    });
  };

  const toggleAll = (selectAll: boolean) => {
    const newMap: Record<string, Set<number>> = {};

    filteredConflicts.forEach((conflict, i) => {
      if (selectAll) {
        newMap[i.toString()] = new Set(conflict.rows.map((r) => r.index));
      } else {
        newMap[i.toString()] = new Set();
      }
    });

    setSelectedMap(newMap);
  };

  const handleConfirm = () => {
    const hasSelection = Object.values(selectedMap).some(
      (set) => set.size > 0
    );

    if (!hasSelection) {
      toast.error('Please select at least one row.');
      return;
    }

    const kept: DuplicateConflict[] = filteredConflicts.map((conflict, i) => {
      const keptRows = conflict.rows.filter((row) =>
        selectedMap[i.toString()]?.has(row.index)
      );

      return {
        website: conflict.website,
        rows: keptRows,
      };
    });

    onConfirm(kept);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#0f172a]/40 backdrop-blur-sm">
      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-xl p-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#0f1c2e]">
            Duplicate Phone Numbers Detected
          </h2>

          <div className="flex gap-2">
            <button
              onClick={() => toggleAll(true)}
              className="px-3 py-1 rounded bg-slate-200 text-slate-800 hover:bg-slate-300 transition"
            >
              Select All
            </button>

            <button
              onClick={() => toggleAll(false)}
              className="px-3 py-1 rounded bg-slate-200 text-slate-800 hover:bg-slate-300 transition"
            >
              Deselect All
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          The uploaded file contains rows with the same phone number for the
          same company (Website URL). Please select which row(s) you want to
          keep for each duplicate group.
        </p>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {filteredConflicts.map((conflict, i) => (
            <div
              key={i}
              className="border border-slate-200 rounded p-3"
            >
              <h3 className="font-medium text-slate-800 mb-2">
                Website: {conflict.website}
              </h3>

              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-1"></th>
                    <th className="px-2 py-1">Row #</th>
                    <th className="px-2 py-1">POC Name</th>
                    <th className="px-2 py-1">Phone</th>
                    <th className="px-2 py-1">Email</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {conflict.rows.map((row) => (
                    <tr
                      key={row.index}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={
                            selectedMap[i.toString()]?.has(row.index) ?? false
                          }
                          onChange={() =>
                            toggleRow(i.toString(), row.index)
                          }
                          className="form-checkbox h-4 w-4 text-[#0ea5e9] border-slate-300 rounded"
                        />
                      </td>

                      <td className="px-2 py-1">{row.index + 1}</td>

                      <td className="px-2 py-1">
                        {row.data['POC Name'] || 'N/A'}
                      </td>

                      <td className="px-2 py-1">
                        {row.data['POC Phone']}
                      </td>

                      <td className="px-2 py-1">
                        {row.data['POC Email'] || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-200 text-slate-800 hover:bg-slate-300 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded bg-[#0ea5e9] text-white hover:bg-[#0284c7] transition"
          >
            Keep Selected
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicatePhoneModal;