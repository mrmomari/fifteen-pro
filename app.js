// Shared utilities for admin.html and portal.html

const AppUtils = {
  // Get current timestamp (consistent across app)
  getCurrentTimestamp() {
    return new Date().toISOString();
  },

  // Format timestamp for display
  formatDate(timestamp) {
    if (!timestamp) return '—';
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  formatDateTime(timestamp) {
    if (!timestamp) return '—';
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

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

  // Send notification (email/SMS stub for Cloud Functions)
  async sendNotification(type, recipient, subject, data) {
    try {
      const db = firebase.firestore();
      await db.collection('notifications').add({
        type: type, // 'email', 'sms', 'in-app'
        recipient: recipient,
        subject: subject,
        data: data,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        sentAt: null,
        error: null
      });
    } catch (error) {
      console.error('Notification error:', error);
    }
  },

  // Show toast notification
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      background-color: ${type === 'success' ? '#26915E' : type === 'error' ? '#D32F2F' : '#1976D2'};
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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
  },

  // Fetch Firestore config
  async getConfig(path) {
    try {
      const db = firebase.firestore();
      const doc = await db.doc(path).get();
      return doc.exists ? doc.data() : null;
    } catch (error) {
      console.error('Config fetch error:', error);
      return null;
    }
  },

  // Set Firestore config
  async setConfig(path, data) {
    try {
      const db = firebase.firestore();
      await db.doc(path).set(data, { merge: true });
      return true;
    } catch (error) {
      console.error('Config set error:', error);
      return false;
    }
  },

  // Fetch collection with optional filters
  async fetchCollection(collectionPath, filters = []) {
    try {
      const db = firebase.firestore();
      let query = db.collection(collectionPath);

      filters.forEach(({ field, operator, value }) => {
        query = query.where(field, operator, value);
      });

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Collection fetch error:', error);
      return [];
    }
  },

  // Delete document with audit log
  async deleteWithAudit(collectionPath, docId, userId, resourceType) {
    try {
      const db = firebase.firestore();
      await db.doc(`${collectionPath}/${docId}`).delete();
      await this.logAudit(userId, 'delete', docId, resourceType, {});
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }
};

// Inject modal styles globally
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  });
} else {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}
