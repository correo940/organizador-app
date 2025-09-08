import React from 'react';
import Toast from './Toast';

const ToastContainer = ({ toasts, onRemove }) => {
  return (
    <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999 }}>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            marginBottom: '10px',
            transform: `translateY(${index * 10}px)`,
            transition: 'transform 0.3s ease-in-out'
          }}
        >
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
