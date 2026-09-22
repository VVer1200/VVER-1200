import React, { useState, useEffect } from 'react';

/**
 * @file AZConfirmModal.jsx
 * @module AZConfirmModal
 * @description Диалоговое окно подтверждения аварийной защиты реактора (АЗ-1).
 * 
 * КОНТРАКТ МОДУЛЯ (Public Interface):
 * @param {Object} props
 * @param {boolean} props.isOpen - Флаг отображения окна
 * @param {function} props.onConfirm - Функция обратного вызова при подтверждении аварийного останова
 * @param {function} props.onCancel - Функция обратного вызова при отмене действия оператором
 * @param {number} [props.timeoutSeconds=10] - Таймаут автоматической отмены диалога (сек)
 */
export const AZConfirmModal = ({ isOpen, onConfirm, onCancel, timeoutSeconds = 10 }) => {
  const [secondsLeft, setSecondsLeft] = useState(timeoutSeconds);
  const [isArmed, setIsArmed] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(timeoutSeconds);
      setIsArmed(false);
      return;
    }

    const intervalId = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          onCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isOpen, timeoutSeconds, onCancel]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({
      action: 'SCRAM_MANUAL',
      timestamp: Date.now(),
      rodGroup: 'ALL_SUZ'
    });
  };

  return (
    <div className="az-modal-overlay" style={overlayStyle}>
      <div className="az-modal-card" style={cardStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: '24px' }}>🚨</span>
          <h2 style={{ margin: 0, color: '#ff4d4f' }}>ПОДТВЕРЖДЕНИЕ СБРОСА АЗ-1</h2>
        </div>
        <p style={{ margin: '16px 0', fontSize: '14px', lineHeight: 1.5 }}>
          ВНИМАНИЕ! Вы инициируете экстренный аварийный останов энергоблока ВВЭР-1200.
          Все поглощающие стержни СУЗ будут сброшены в активную зону под действием силы тяжести.
        </p>
        <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', padding: '10px', borderRadius: '4px', marginBottom: '16px' }}>
          <b>Автоматическая отмена через: {secondsLeft} сек.</b>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isArmed}
            onChange={(e) => setIsArmed(e.target.checked)}
          />
          <span>Подтверждаю осознанность аварийного воздействия</span>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={cancelBtnStyle}
          >
            Отмена (Esc)
          </button>
          <button
            type="button"
            disabled={!isArmed}
            onClick={handleConfirm}
            style={isArmed ? confirmActiveBtnStyle : confirmDisabledBtnStyle}
          >
            СБРОСИТЬ АЗ-1
          </button>
        </div>
      </div>
    </div>
  );
};

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
};

const cardStyle = {
  backgroundColor: '#1f1f1f', color: '#fff', padding: '24px',
  borderRadius: '8px', maxWidth: '480px', width: '90%', border: '2px solid #ff4d4f',
  boxShadow: '0 8px 24px rgba(255, 77, 79, 0.3)'
};

const headerStyle = { display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #333', paddingBottom: '12px' };
const cancelBtnStyle = { padding: '8px 16px', borderRadius: '4px', border: '1px solid #555', background: '#333', color: '#fff', cursor: 'pointer' };
const confirmActiveBtnStyle = { padding: '8px 16px', borderRadius: '4px', border: 'none', background: '#ff4d4f', color: '#fff', fontWeight: 'bold', cursor: 'pointer' };
const confirmDisabledBtnStyle = { padding: '8px 16px', borderRadius: '4px', border: 'none', background: '#555', color: '#888', cursor: 'not-allowed' };

export default AZConfirmModal;
