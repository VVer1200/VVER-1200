import React, { useEffect } from 'react';

/**
 * @file MockAZConfirmModal.jsx
 * @module MockAZConfirmModal
 * @description Тестовая подмена (Mock) для автоматического выполнения сценариев АЗ-1 без рендеринга DOM.
 * Реализует тот же публичный контракт, что и AZConfirmModal.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Флаг вызова диалога
 * @param {function} props.onConfirm - Колбэк подтверждения останова
 * @param {function} props.onCancel - Колбэк отмены
 */
export const MockAZConfirmModal = ({ isOpen, onConfirm }) => {
  useEffect(() => {
    if (isOpen && typeof onConfirm === 'function') {
      // Автоматическое мгновенное подтверждение для автоматических тестов
      onConfirm({
        action: 'SCRAM_MANUAL',
        timestamp: Date.now(),
        rodGroup: 'ALL_SUZ',
        isMocked: true
      });
    }
  }, [isOpen, onConfirm]);

  return null; // Без графического оверхеда в тестах
};

export default MockAZConfirmModal;
