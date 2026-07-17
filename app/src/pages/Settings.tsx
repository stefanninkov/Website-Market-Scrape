/**
 * Settings page (SPEC §9.5, PLAN Phase 3): identity config, tone guide editor,
 * budgets, Gmail connect. Niche presets and cron toggle are lightweight extras.
 * Everything writes directly to config/* (owner-only per rules).
 */

import { useEffect, useMemo, useState } from 'react';
import { setDoc } from 'firebase/firestore';
import type { Identity } from '@wms/shared';
import { apiBudgetDoc, gmailDoc, identityDoc, toneGuideDoc } from '../lib/db';
import { useDoc } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { Button, inputClass, labelClass } from '../components/ui';

const BLANK_IDENTITY: Identity = {
  businessName: '',
  fullName: '',
  address: '',
  calLink: '',
  emailSignature: '',
};

export default function Settings() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-lg font-semibold">Settings</h1>
      <IdentitySection />
      <ToneGuideSection />
      <GmailSection />
      <BudgetSection />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function IdentitySection() {
  const ref = useMemo(() => identityDoc(), []);
  const { data } = useDoc(ref);
  const toast = useToast();
  const [form, setForm] = useState<Identity>(BLANK_IDENTITY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function save(): Promise<void> {
    setSaving(true);
    try {
      await setDoc(identityDoc(), form);
      toast.show('Identity saved.', 'success');
    } catch (err) {
      toast.show(`Save failed: ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof Identity, label: string, placeholder = '') => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <Card title="Identity (used in every email + preview branding)">
      <div className="grid gap-3 sm:grid-cols-2">
        {field('businessName', 'Business name', 'FlowDev')}
        {field('fullName', 'Full name', 'Stefan Ninkov')}
        {field('address', 'Postal address', 'Bulevar oslobođenja 1, Novi Sad, Srbija')}
        {field('calLink', 'Cal.com booking link', 'https://cal.com/flowdev')}
      </div>
      <div className="mt-3">
        <label className={labelClass}>Email signature</label>
        <input
          className={inputClass}
          value={form.emailSignature}
          onChange={(e) => setForm({ ...form, emailSignature: e.target.value })}
          placeholder="Stefan · FlowDev"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save identity'}
        </Button>
      </div>
    </Card>
  );
}

function ToneGuideSection() {
  const ref = useMemo(() => toneGuideDoc(), []);
  const { data } = useDoc(ref);
  const toast = useToast();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setText(data.text);
  }, [data]);

  async function save(): Promise<void> {
    setSaving(true);
    try {
      await setDoc(toneGuideDoc(), { text });
      toast.show('Tone guide saved.', 'success');
    } catch (err) {
      toast.show(`Save failed: ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Tone guide (injected into every AI generation)">
      <textarea
        className={`${inputClass} min-h-32 resize-y font-mono text-xs`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Professional but warm, never corporate-stiff. Short sentences. Local and specific…"
      />
      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save tone guide'}
        </Button>
      </div>
    </Card>
  );
}

function GmailSection() {
  const ref = useMemo(() => gmailDoc(), []);
  const { data } = useDoc(ref);
  const connected = Boolean(data?.refreshToken);

  // The OAuth dance runs through the gmailAuthStart function (Phase 3 backend).
  const startUrl = '/gmailAuthStart';

  return (
    <Card title="Gmail (send outreach + reply detection)">
      {connected ? (
        <p className="text-sm text-success">
          ✓ Connected as {data?.emailAddress ?? 'your Google account'}.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-text-dim">
            Connect the Gmail account you send outreach from. Requires the Cloud Functions
            OAuth config (GMAIL_CLIENT_ID / SECRET).
          </p>
          <a
            href={startUrl}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
          >
            Connect Gmail
          </a>
        </div>
      )}
    </Card>
  );
}

function BudgetSection() {
  const ref = useMemo(() => apiBudgetDoc(), []);
  const { data } = useDoc(ref);
  const toast = useToast();
  const [places, setPlaces] = useState('200');
  const [anthropic, setAnthropic] = useState('20');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setPlaces(String(data.places.monthlyLimitUsd));
      setAnthropic(String(data.anthropic.monthlyLimitUsd));
    }
  }, [data]);

  async function save(): Promise<void> {
    if (!data) return;
    setSaving(true);
    try {
      await setDoc(apiBudgetDoc(), {
        ...data,
        places: { ...data.places, monthlyLimitUsd: Number(places) || 0 },
        anthropic: { ...data.anthropic, monthlyLimitUsd: Number(anthropic) || 0 },
      });
      toast.show('Budgets saved.', 'success');
    } catch (err) {
      toast.show(`Save failed: ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Monthly budgets (USD)">
      {!data ? (
        <p className="text-sm text-text-dim">
          Budgets initialize when the first sweep runs.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Google Places (spent ${data.places.spentUsd.toFixed(2)})
              </label>
              <input
                className={inputClass}
                type="number"
                value={places}
                onChange={(e) => setPlaces(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>
                Anthropic (spent ${data.anthropic.spentUsd.toFixed(2)})
              </label>
              <input
                className={inputClass}
                type="number"
                value={anthropic}
                onChange={(e) => setAnthropic(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save budgets'}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
