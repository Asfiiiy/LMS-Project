'use client';

import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { apiService } from '@/app/services/api';
import { showToast } from '@/app/components/Toast';

type StripeSection = {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  hasKeys?: boolean;
};

type StripeSettingsResponse = {
  success?: boolean;
  mode?: string;
  test?: StripeSection;
  live?: StripeSection;
};

export default function StripeSettings() {
  const [settings, setSettings] = useState<StripeSettingsResponse>({
    mode: 'test',
    test: { publishableKey: '', secretKey: '', webhookSecret: '' },
    live: { publishableKey: '', secretKey: '', webhookSecret: '' }
  });
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [newValues, setNewValues] = useState<Record<string, string | undefined>>({});

  const loadSettings = useCallback(async () => {
    try {
      const res = (await apiService.getStripeSettings()) as StripeSettingsResponse;
      if (res.success) {
        setSettings({
          mode: res.mode || 'test',
          test: res.test || { publishableKey: '', secretKey: '', webhookSecret: '' },
          live: res.live || { publishableKey: '', secretKey: '', webhookSecret: '' }
        });
      }
    } catch {
      showToast('Failed to load Stripe settings', 'error');
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const currentMode = (newValues.mode as string | undefined) ?? settings.mode ?? 'test';

  const handleSave = async () => {
    if (settings.mode === 'test' && newValues.mode === 'live') {
      const confirm = await Swal.fire({
        title: 'Switch to Live Mode?',
        html: `This will process <strong>REAL payments</strong>.<br/>Make sure your live keys are correct.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#E51791',
        confirmButtonText: 'Yes, go live',
        cancelButtonText: 'Cancel'
      });
      if (!confirm.isConfirmed) return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string | undefined> = {};
      if (newValues.mode !== undefined) payload.mode = String(newValues.mode);
      if (newValues.test_publishable_key !== undefined)
        payload.test_publishable_key = newValues.test_publishable_key;
      if (newValues.test_secret_key !== undefined) payload.test_secret_key = newValues.test_secret_key;
      if (newValues.test_webhook_secret !== undefined)
        payload.test_webhook_secret = newValues.test_webhook_secret;
      if (newValues.live_publishable_key !== undefined)
        payload.live_publishable_key = newValues.live_publishable_key;
      if (newValues.live_secret_key !== undefined) payload.live_secret_key = newValues.live_secret_key;
      if (newValues.live_webhook_secret !== undefined)
        payload.live_webhook_secret = newValues.live_webhook_secret;

      await apiService.saveStripeSettings(payload);
      showToast('Stripe settings saved', 'success');
      setEditing({});
      setNewValues({});
      await loadSettings();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save settings';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleEdit = (key: string) => {
    setEditing((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const masked = (section: 'test' | 'live', k: keyof StripeSection) => {
    const s = settings[section];
    return (s && s[k]) || '—';
  };

  return (
    <div
      style={{
        background: '#fff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px'
      }}
    >
      <div
        style={{
          fontSize: '16px',
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}
      >
        Stripe payment settings
        <span
          style={{
            background: currentMode === 'live' ? '#fef2f2' : '#f0fdf4',
            color: currentMode === 'live' ? '#dc2626' : '#16a34a',
            border: `1px solid ${currentMode === 'live' ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: '8px',
            padding: '2px 10px',
            fontSize: '12px',
            fontWeight: 700
          }}
        >
          {currentMode === 'live' ? 'LIVE MODE' : 'TEST MODE'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {(['test', 'live'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setNewValues((prev) => ({ ...prev, mode: m }))}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: '2px solid',
              borderColor: currentMode === m ? (m === 'live' ? '#dc2626' : '#22c55e') : '#e2e8f0',
              background: currentMode === m ? (m === 'live' ? '#fef2f2' : '#f0fdf4') : '#fff',
              color: currentMode === m ? (m === 'live' ? '#dc2626' : '#16a34a') : '#64748b',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {m === 'test' ? 'Test mode' : 'Live mode'}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontWeight: 700, color: '#334155', marginBottom: '10px' }}>Test mode keys</div>
        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#64748b' }}>
          Publishable: <code style={{ background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }}>{masked('test', 'publishableKey')}</code>
          {!editing.test_pk ? (
            <button type="button" onClick={() => toggleEdit('test_pk')} style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#E51791', background: 'none', border: 'none', cursor: 'pointer' }}>
              Edit
            </button>
          ) : null}
        </div>
        {editing.test_pk ? (
          <input
            type="password"
            autoComplete="off"
            placeholder="pk_test_..."
            value={newValues.test_publishable_key ?? ''}
            onChange={(e) => setNewValues((p) => ({ ...p, test_publishable_key: e.target.value }))}
            style={{ width: '100%', maxWidth: 420, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}
          />
        ) : null}
        <div style={{ marginBottom: 8, fontSize: 12, color: '#64748b' }}>
          Secret: <code style={{ background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }}>{masked('test', 'secretKey')}</code>
          {!editing.test_sk ? (
            <button type="button" onClick={() => toggleEdit('test_sk')} style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#E51791', background: 'none', border: 'none', cursor: 'pointer' }}>
              Edit
            </button>
          ) : null}
        </div>
        {editing.test_sk ? (
          <input
            type="password"
            autoComplete="off"
            placeholder="sk_test_..."
            value={newValues.test_secret_key ?? ''}
            onChange={(e) => setNewValues((p) => ({ ...p, test_secret_key: e.target.value }))}
            style={{ width: '100%', maxWidth: 420, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}
          />
        ) : null}
        <div style={{ marginBottom: 8, fontSize: 12, color: '#64748b' }}>
          Webhook: <code style={{ background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }}>{masked('test', 'webhookSecret')}</code>
          {!editing.test_wh ? (
            <button type="button" onClick={() => toggleEdit('test_wh')} style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#E51791', background: 'none', border: 'none', cursor: 'pointer' }}>
              Edit
            </button>
          ) : null}
        </div>
        {editing.test_wh ? (
          <input
            type="password"
            autoComplete="off"
            placeholder="whsec_..."
            value={newValues.test_webhook_secret ?? ''}
            onChange={(e) => setNewValues((p) => ({ ...p, test_webhook_secret: e.target.value }))}
            style={{ width: '100%', maxWidth: 420, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
        ) : null}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontWeight: 700, color: '#334155', marginBottom: '10px' }}>Live mode keys</div>
        <div style={{ marginBottom: 8, fontSize: 12, color: '#64748b' }}>
          Publishable: <code style={{ background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }}>{masked('live', 'publishableKey')}</code>
          {!editing.live_pk ? (
            <button type="button" onClick={() => toggleEdit('live_pk')} style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#E51791', background: 'none', border: 'none', cursor: 'pointer' }}>
              Edit
            </button>
          ) : null}
        </div>
        {editing.live_pk ? (
          <input
            type="password"
            autoComplete="off"
            placeholder="pk_live_..."
            value={newValues.live_publishable_key ?? ''}
            onChange={(e) => setNewValues((p) => ({ ...p, live_publishable_key: e.target.value }))}
            style={{ width: '100%', maxWidth: 420, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}
          />
        ) : null}
        <div style={{ marginBottom: 8, fontSize: 12, color: '#64748b' }}>
          Secret: <code style={{ background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }}>{masked('live', 'secretKey')}</code>
          {!editing.live_sk ? (
            <button type="button" onClick={() => toggleEdit('live_sk')} style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#E51791', background: 'none', border: 'none', cursor: 'pointer' }}>
              Edit
            </button>
          ) : null}
        </div>
        {editing.live_sk ? (
          <input
            type="password"
            autoComplete="off"
            placeholder="sk_live_..."
            value={newValues.live_secret_key ?? ''}
            onChange={(e) => setNewValues((p) => ({ ...p, live_secret_key: e.target.value }))}
            style={{ width: '100%', maxWidth: 420, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}
          />
        ) : null}
        <div style={{ marginBottom: 8, fontSize: 12, color: '#64748b' }}>
          Webhook: <code style={{ background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }}>{masked('live', 'webhookSecret')}</code>
          {!editing.live_wh ? (
            <button type="button" onClick={() => toggleEdit('live_wh')} style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#E51791', background: 'none', border: 'none', cursor: 'pointer' }}>
              Edit
            </button>
          ) : null}
        </div>
        {editing.live_wh ? (
          <input
            type="password"
            autoComplete="off"
            placeholder="whsec_..."
            value={newValues.live_webhook_secret ?? ''}
            onChange={(e) => setNewValues((p) => ({ ...p, live_webhook_secret: e.target.value }))}
            style={{ width: '100%', maxWidth: 420, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
        ) : null}
      </div>

      <p style={{ fontSize: '13px', color: '#b45309', marginBottom: '16px' }}>
        Switching to live mode processes real card charges. Ensure keys and webhook endpoints match the active mode in Stripe.
      </p>

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        style={{
          padding: '12px 28px',
          borderRadius: '12px',
          border: 'none',
          fontWeight: 700,
          fontSize: '14px',
          color: '#fff',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
          background: 'linear-gradient(90deg, #11CCEF 0%, #E51791 100%)'
        }}
      >
        {saving ? 'Saving…' : 'Save Stripe settings'}
      </button>
    </div>
  );
}
