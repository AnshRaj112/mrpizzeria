'use client';

interface ConfirmDialogProps {
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  message,
  title = 'Confirm Action',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'info',
}: ConfirmDialogProps) {
  const getStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: '⚠️',
          confirmButton: 'bg-red-500 hover:bg-red-600 text-white',
          titleColor: 'text-red-600',
        };
      case 'warning':
        return {
          icon: '⚠️',
          confirmButton: 'bg-yellow-500 hover:bg-yellow-600 text-white',
          titleColor: 'text-yellow-600',
        };
      default:
        return {
          icon: 'ℹ️',
          confirmButton: 'bg-sky-500 hover:bg-sky-600 text-white',
          titleColor: 'text-sky-600',
        };
    }
  };

  const styles = getStyles();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border-2 border-sky-200 animate-scale-in">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <span className="text-4xl flex-shrink-0">{styles.icon}</span>
            <div className="flex-1">
              <h3 className={`text-xl font-bold mb-2 ${styles.titleColor}`}>{title}</h3>
              <p className="text-gray-700 text-sm leading-relaxed">{message}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-6 py-2.5 ${styles.confirmButton} rounded-xl transition-colors font-semibold`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

