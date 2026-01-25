import React from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export type ModalType = 'info' | 'confirm' | 'danger' | 'warning';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertTriangle className="w-6 h-6 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case 'confirm': return <Info className="w-6 h-6 text-blue-600" />;
      default: return <CheckCircle className="w-6 h-6 text-emerald-600" />;
    }
  };

  const getHeaderColor = () => {
    switch (type) {
      case 'danger': return 'bg-red-50 border-b border-red-100';
      case 'warning': return 'bg-amber-50 border-b border-amber-100';
      default: return 'bg-white border-b border-slate-100';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all scale-100">

        {/* Header */}
        <div className={`px-6 py-4 flex items-center gap-3 ${getHeaderColor()}`}>
          <div className={`p-2 rounded-full ${type === 'danger' ? 'bg-red-100' : type === 'warning' ? 'bg-amber-100' : type === 'confirm' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
            {getIcon()}
          </div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
          {(type === 'confirm' || type === 'danger') && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-sm transition-colors"
            >
              {cancelText}
            </button>
          )}

          <button
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose(); // Auto close on simple alerts, or logic handles it
            }}
            className={`px-6 py-2 rounded-lg text-white font-bold text-sm shadow-md transition-all transform active:scale-95 ${type === 'danger'
                ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                : type === 'warning'
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 text-white'
                  : 'bg-primary hover:opacity-90 shadow-slate-200'
              }`}
          >
            {type === 'info' ? 'OK' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;