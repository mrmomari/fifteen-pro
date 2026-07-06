// Shared utilities for admin.html

const AppUtils = {
  // Escape HTML to prevent XSS
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // Log audit trail to Firestore
  async logAudit(userId, action, resourceId, resourceType, changes = {}) {
    try {
      const db = firebase.firestore();
      await db.collection('auditLogs').add({
        userId: userId || null,
        action: action,
        resourceId: resourceId,
        resourceType: resourceType,
        changes: changes,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userAgent: navigator.userAgent
      });
    } catch (error) {
      console.error('Audit log error:', error);
    }
  },

  // Modal confirmation
  showConfirm(title, message, onConfirm, onCancel = null) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    modal.innerHTML = `
      <h3 style="margin: 0 0 8px 0; color: #1C2416;">${AppUtils.escapeHtml(title)}</h3>
      <p style="margin: 0 0 20px 0; color: #5A6B4E; font-size: 14px;">${AppUtils.escapeHtml(message)}</p>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn-secondary" style="padding: 8px 16px; border: 1px solid #D5DFBE; background: white; border-radius: 6px; cursor: pointer;">Cancel</button>
        <button class="btn-primary" style="padding: 8px 16px; background: #26915E; color: white; border: none; border-radius: 6px; cursor: pointer;">Confirm</button>
      </div>
    `;

    const confirmBtn = modal.querySelector('.btn-primary');
    const cancelBtn = modal.querySelector('.btn-secondary');

    confirmBtn.onclick = () => {
      backdrop.remove();
      onConfirm();
    };

    cancelBtn.onclick = () => {
      backdrop.remove();
      if (onCancel) onCancel();
    };

    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        backdrop.remove();
        if (onCancel) onCancel();
      }
    };

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  }
};
