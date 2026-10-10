
import React, { useState, useEffect, useRef } from 'react';
import { Mail, Pencil, X, Send, Save, AlertTriangle, Plus, Trash2, Sparkles, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config';

interface SendEmailModalProps {
  open: boolean;
  onClose: () => void;
  company: any;
  poc: any;
}

interface EmailContent {
  greeting: string;
  openingLine: string;
  contextLine: string;
  companyBlurb: string;
  pitchLine: string;
  bullets: string[];
  caseStudyLabel: string;
  testimonialsLabel: string;
  closingLine: string;
  ctaLine: string;
  senderName: string;
}

const buildCompanyBlurb = (company: any, poc: any) => {
  const name = company?.company_name || 'This company';
  const parts: string[] = [];

  let sentence = name;
  if (company?.company_size) sentence += ` is a ${company.company_size}-person company`;
  else sentence += ' is a company';
  if (company?.industry_name) sentence += ` in the ${company.industry_name} industry`;
  sentence += '.';
  parts.push(sentence);

  if (poc?.name || poc?.designation) {
    let pocSentence = 'Our point of contact is';
    if (poc?.name) pocSentence += ` ${poc.name}`;
    if (poc?.designation) pocSentence += `, ${poc.designation}`;
    pocSentence += '.';
    parts.push(pocSentence);
  }

  return parts.join(' ');
};

const SendEmailModal: React.FC<SendEmailModalProps> = ({ open, onClose, company, poc }) => {
  const [editMode, setEditMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState(poc?.email || '');
  const [subject, setSubject] = useState(
    `Your Next Great Hire — Jobs Territory × ${company?.company_name || 'Your Company'}`
  );

  // AI generation state
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState<string | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);
  const hasFetched = useRef(false);

  // Auto-generate on mount (runs once per modal open)
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    generateAiEmail();
  }, []);

  const generateAiEmail = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/email-leads/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
        body: JSON.stringify({
          leadId:  company?._id  ?? null,
          pocId:   poc?._id      ?? null,
          company: {
            company_name:  company?.company_name  ?? '',
            industry_name: company?.industry_name ?? '',
            company_size:  company?.company_size  ?? '',
            website_url:   company?.website_url   ?? ''
          },
          poc: {
            name:        poc?.name        ?? '',
            designation: poc?.designation ?? '',
            email:       poc?.email       ?? ''
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.content) {
        setContent(data.content);
        if (data.subject) setSubject(data.subject);
        setAiGenerated(true);
      } else {
        // Non-blocking: keep static template, show soft error
        setAiError(data.message || 'AI generation failed — using default template.');
      }
    } catch {
      setAiError('Could not reach AI service — using default template.');
    } finally {
      setAiLoading(false);
    }
  };

  const [content, setContent] = useState<EmailContent>({
    greeting: `Hi ${poc?.name || 'there'},`,
    openingLine: `Hope you're doing well! I came across ${company?.company_name || 'your company'}${company?.industry_name ? ` in the ${company.industry_name} space` : ''} and noticed you're growing fast — which tells me hiring the right talent is a top priority right now.`,
    contextLine: `${poc?.designation ? `As ${poc.designation} at ${company?.company_name || 'your company'}` : `At ${company?.company_name || 'your company'}`}, I understand you're not just filling seats — you're looking for people who truly drive impact${company?.industry_name ? ` in the ${company.industry_name} industry` : ''}.`,
    companyBlurb: buildCompanyBlurb(company, poc),
    pitchLine: `That's exactly where Jobs Territory steps in. We're a Bengaluru-based recruitment firm specializing in mid-to-senior Non-IT hiring across Sales, Marketing, Business Development, and Operations — with 45+ trained recruiters and a track record of delivering quality shortlists in 48–72 hours.`,
    bullets: [
      'Strong pipeline of pre-screened professionals across domains',
      'Shortlists delivered within 48–72 hours of mandate confirmation',
      'On-site culture fit screening — you only meet the best-matched candidates',
      'Flexible engagement — overflow support with zero long-term lock-in',
      'Backed by 10+ years of recruitment expertise across industries',
    ],
    caseStudyLabel: 'View Our Case Studies',
    testimonialsLabel: 'Read Client Testimonials',
    closingLine: `We'd love to be your hiring partner. Given your team's growth trajectory, attracting the right talent who aligns with both your mission and culture is critical — and that's what we do best.`,
    ctaLine: `Can we connect for a quick 15-minute call this week to explore how we can support your open mandates?`,
    senderName: 'Business Development Team — Jobs Territory',
  });

  const buildHtml = (c: EmailContent) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- HERO HEADER -->
    <tr><td style="background:linear-gradient(135deg,#0f1c2e 0%,#1e3a5f 60%,#0ea5e9 100%);border-radius:20px 20px 0 0;padding:40px 48px;text-align:center;">
      <div style="display:inline-block;background:rgba(14,165,233,0.15);border:1px solid rgba(14,165,233,0.3);border-radius:50px;padding:6px 18px;margin-bottom:20px;">
        <span style="font-size:11px;font-weight:700;color:#7dd3fc;letter-spacing:2px;text-transform:uppercase;">Recruitment Partner</span>
      </div>
      <div style="font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-1px;line-height:1.1;">
        Jobs<span style="color:#38bdf8;">Territory</span>
      </div>
      <div style="font-size:12px;color:#94a3b8;margin-top:8px;letter-spacing:3px;text-transform:uppercase;">Talent · Growth · Results</div>
      <div style="margin-top:28px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:20px 24px;text-align:left;">
        <div style="font-size:13px;color:#cbd5e1;line-height:1.7;">${c.greeting.replace(/\n/g,'<br/>')}</div>
        <div style="font-size:15px;font-weight:600;color:#f1f5f9;line-height:1.7;margin-top:10px;">${c.openingLine.replace(/\n/g,'<br/>')}</div>
      </div>
    </td></tr>

    <!-- CONTEXT BAND -->
    <tr><td style="background:#0ea5e9;padding:16px 48px;">
      <div style="font-size:13px;color:#e0f2fe;line-height:1.7;font-style:italic;">${c.contextLine.replace(/\n/g,'<br/>')}</div>
    </td></tr>

    <!-- COMPANY INFO (simple blurb) -->
    <tr><td style="background:#ffffff;padding:28px 48px 0 48px;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0ea5e9;border-radius:0 12px 12px 0;padding:18px 24px;">
        <div style="font-size:10px;font-weight:800;color:#0ea5e9;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">About ${company?.company_name || 'Your Company'}</div>
        <div style="font-size:13px;color:#374151;line-height:1.7;">${c.companyBlurb.replace(/\n/g,'<br/>')}</div>
      </div>
    </td></tr>

    <!-- PITCH SECTION -->
    <tr><td style="background:#ffffff;padding:28px 48px 40px 48px;">
      <div style="font-size:11px;font-weight:800;color:#0ea5e9;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Why Jobs Territory?</div>
      <div style="font-size:15px;color:#374151;line-height:1.8;margin-bottom:28px;">${c.pitchLine.replace(/\n/g,'<br/>')}</div>

      <!-- BULLETS -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        ${c.bullets.map(b => `
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;">
              <div style="width:20px;height:20px;background:#0ea5e9;border-radius:6px;text-align:center;line-height:20px;font-size:12px;color:#fff;font-weight:900;">✓</div>
            </td>
            <td style="font-size:14px;color:#374151;padding-left:12px;line-height:1.6;">${b}</td>
          </tr></table>
        </td></tr>`).join('')}
      </table>

      <!-- SOCIAL PROOF CARDS -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td width="48%" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#0ea5e9;">📊</div>
            <div style="font-size:12px;font-weight:800;color:#0f1c2e;margin:8px 0 4px 0;text-transform:uppercase;letter-spacing:1px;">Case Studies</div>
            <div style="font-size:12px;color:#64748b;margin-bottom:12px;">Proven Results — Real Impact</div>
            <a href="#" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;padding:8px 18px;border-radius:20px;">${c.caseStudyLabel}</a>
          </td>
          <td width="4%"></td>
          <td width="48%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#16a34a;">💬</div>
            <div style="font-size:12px;font-weight:800;color:#0f1c2e;margin:8px 0 4px 0;text-transform:uppercase;letter-spacing:1px;">Testimonials</div>
            <div style="font-size:12px;color:#64748b;margin-bottom:12px;">Real Voices — Real Outcomes</div>
            <a href="#" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;padding:8px 18px;border-radius:20px;">${c.testimonialsLabel}</a>
          </td>
        </tr>
      </table>

      <!-- CLOSING -->
      <div style="font-size:15px;color:#374151;line-height:1.8;margin-bottom:16px;">${c.closingLine.replace(/\n/g,'<br/>')}</div>
      <div style="font-size:15px;font-weight:600;color:#0f1c2e;line-height:1.8;margin-bottom:28px;">${c.ctaLine.replace(/\n/g,'<br/>')}</div>

      <!-- CTA BUTTON -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="mailto:${to}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;padding:14px 36px;border-radius:50px;letter-spacing:0.5px;">📅 Schedule a 15-Min Call</a>
      </div>

      <!-- SIGNATURE -->
      <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
        <div style="font-size:13px;color:#64748b;">Warm regards,</div>
        <div style="font-size:15px;font-weight:800;color:#0f1c2e;margin-top:4px;">${c.senderName.replace(/\n/g,'<br/>')}</div>
      </div>
    </td></tr>

    <!-- STATS BAR -->
    <tr><td style="background:#0f1c2e;padding:24px 48px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="text-align:center;border-right:1px solid rgba(255,255,255,0.1);">
            <div style="font-size:22px;font-weight:900;color:#38bdf8;">10+</div>
            <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Years Experience</div>
          </td>
          <td style="text-align:center;border-right:1px solid rgba(255,255,255,0.1);">
            <div style="font-size:22px;font-weight:900;color:#38bdf8;">45+</div>
            <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Trained Recruiters</div>
          </td>
          <td style="text-align:center;border-right:1px solid rgba(255,255,255,0.1);">
            <div style="font-size:22px;font-weight:900;color:#38bdf8;">48h</div>
            <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Shortlist Delivery</div>
          </td>
          <td style="text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#38bdf8;">50K+</div>
            <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Talent Pool</div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- FOOTER -->
    <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 20px 20px;padding:20px 48px;text-align:center;">
      <div style="margin-bottom:14px;">
        <a href="https://www.linkedin.com/company/jobsterritory" target="_blank" style="display:inline-block;background:#0077b5;color:#fff;text-decoration:none;font-size:11px;font-weight:700;padding:7px 18px;border-radius:20px;margin:0 4px;">LinkedIn</a>
        <a href="https://twitter.com/jobsterritory" target="_blank" style="display:inline-block;background:#1da1f2;color:#fff;text-decoration:none;font-size:11px;font-weight:700;padding:7px 18px;border-radius:20px;margin:0 4px;">Twitter</a>
        <a href="https://jobsterritory.com" target="_blank" style="display:inline-block;background:#0f1c2e;color:#fff;text-decoration:none;font-size:11px;font-weight:700;padding:7px 18px;border-radius:20px;margin:0 4px;">Website</a>
      </div>
      <div style="font-size:11px;color:#94a3b8;">© 2024 Jobs Territory. All rights reserved. · Bengaluru, India</div>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`.trim();

  const updateBullet = (idx: number, val: string) => {
    const updated = [...content.bullets];
    updated[idx] = val;
    setContent({ ...content, bullets: updated });
  };
  const addBullet = () => setContent({ ...content, bullets: [...content.bullets, ''] });
  const removeBullet = (idx: number) => setContent({ ...content, bullets: content.bullets.filter((_, i) => i !== idx) });

  const handleSend = async () => {
    if (!to) { toast.error('Recipient email is required'); return; }
    try {
      setSending(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/email-leads/send-mails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
        body: JSON.stringify({ to, subject, htmlBody: buildHtml(content), leadId: company?._id, pocId: poc?._id })
      });
      const data = await res.json();
      if (res.ok) { toast.success('Email sent successfully!'); onClose(); }
      else toast.error(data.message || 'Failed to send email');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const fieldClass = `w-full px-4 py-3 rounded-2xl border border-[#0ea5e9] bg-white ring-4 ring-[#0ea5e9]/10 text-sm text-[#0f1c2e] outline-none transition-all`;
  const viewFieldClass = `w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-[#0f1c2e] outline-none`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-full sm:max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0ea5e9]/10 flex items-center justify-center text-[#0ea5e9]">
              <Mail size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-[#0f1c2e]">Compose Email</h2>
                {/* AI badge — shown once generation is done */}
                {aiGenerated && !aiLoading && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.55rem] font-extrabold bg-violet-50 text-violet-600 border border-violet-200 animate-in fade-in duration-300">
                    <Sparkles size={9} />
                    AI Generated
                  </span>
                )}
                {aiLoading && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.55rem] font-extrabold bg-sky-50 text-[#0ea5e9] border border-sky-200 animate-pulse">
                    <Sparkles size={9} />
                    Generating…
                  </span>
                )}
              </div>
              <p className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Email Sending Tab</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Regenerate button */}
            <button
              onClick={() => { hasFetched.current = false; generateAiEmail(); }}
              disabled={aiLoading || sending}
              title="Regenerate with AI"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={12} className={aiLoading ? 'animate-spin' : ''} />
              {aiLoading ? 'Generating' : 'Regenerate'}
            </button>
            <button
              onClick={() => setEditMode(!editMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                editMode ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-amber-200 hover:text-amber-600'
              }`}
            >
              <Pencil size={13} />
              {editMode ? 'Editing' : 'Edit'}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* AI skeleton loader — shown while the AI generates the email */}
          {aiLoading && (
            <div className="space-y-3 animate-pulse">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={13} className="text-violet-400" />
                <span className="text-[0.6rem] font-bold text-violet-500 uppercase tracking-widest">AI is personalising your email…</span>
              </div>
              {/* Skeleton rows mimicking email sections */}
              <div className="h-9 bg-slate-100 rounded-2xl w-full" />
              <div className="h-9 bg-slate-100 rounded-2xl w-full" />
              <div className="h-24 bg-slate-100 rounded-2xl w-full" />
              <div className="h-16 bg-slate-100 rounded-2xl w-full" />
              <div className="space-y-2">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-7 bg-slate-50 rounded-xl" style={{ width: `${75 + i * 4}%` }} />
                ))}
              </div>
              <div className="h-10 bg-slate-100 rounded-2xl w-full" />
            </div>
          )}

          {/* AI error banner — shown when generation fails (static template still active) */}
          {!aiLoading && aiError && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-700">AI generation failed — showing default template.</p>
                <p className="text-[0.65rem] text-amber-600 mt-0.5">{aiError}</p>
              </div>
            </div>
          )}

          {!poc?.email && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs font-bold text-amber-700">This contact has no email — please enter one below before sending.</p>
            </div>
          )}

          {/* To / Subject / Preview — hidden while AI skeleton is showing */}
          {!aiLoading && (
            <>
          {/* To */}
          <div className="space-y-1.5">
            <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">To</label>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${editMode || !poc?.email ? 'border-[#0ea5e9] bg-white ring-4 ring-[#0ea5e9]/10' : 'border-slate-200 bg-slate-50'}`}>
              <Mail size={15} className="text-slate-400 shrink-0" />
              <input
                type="email"
                value={to}
                disabled={!!poc?.email && !editMode}
                onChange={e => setTo(e.target.value)}
                placeholder="Enter recipient email"
                className="flex-1 bg-transparent text-sm font-bold text-[#0f1c2e] placeholder-slate-300 outline-none"
              />
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Subject</label>
            <input
              type="text"
              value={subject}
              disabled={!editMode}
              onChange={e => setSubject(e.target.value)}
              className={editMode ? fieldClass : viewFieldClass}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[0.6rem] font-bold text-slate-300 uppercase tracking-widest">
              {editMode ? 'Edit Email Sections' : 'Email Preview'}
            </span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* EDIT MODE — friendly section fields */}
          {editMode ? (
            <div className="space-y-5">

              <div className="space-y-1.5">
                <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Greeting</label>
                <input type="text" value={content.greeting} onChange={e => setContent({...content, greeting: e.target.value})} className={fieldClass} placeholder="Hi John," />
              </div>

              <div className="space-y-1.5">
                <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Opening Line</label>
                <textarea rows={2} value={content.openingLine} onChange={e => setContent({...content, openingLine: e.target.value})} className={`${fieldClass} resize-none`} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Context / Company Insight</label>
                <textarea rows={2} value={content.contextLine} onChange={e => setContent({...content, contextLine: e.target.value})} className={`${fieldClass} resize-none`} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">About The Company (short blurb)</label>
                <textarea rows={2} value={content.companyBlurb} onChange={e => setContent({...content, companyBlurb: e.target.value})} className={`${fieldClass} resize-none`} placeholder="A couple of plain sentences about the company" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Our Pitch</label>
                <textarea rows={3} value={content.pitchLine} onChange={e => setContent({...content, pitchLine: e.target.value})} className={`${fieldClass} resize-none`} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Value Points</label>
                  <button onClick={addBullet} className="flex items-center gap-1 text-[0.65rem] font-bold text-[#0ea5e9] hover:underline">
                    <Plus size={12} /> Add Point
                  </button>
                </div>
                <div className="space-y-2">
                  {content.bullets.map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#0ea5e9]/10 text-[#0ea5e9] flex items-center justify-center text-[0.6rem] font-black shrink-0">{i + 1}</span>
                      <input type="text" value={b} onChange={e => updateBullet(i, e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-[#0ea5e9] bg-white ring-2 ring-[#0ea5e9]/10 text-sm text-[#0f1c2e] outline-none" placeholder={`Value point ${i + 1}`} />
                      {content.bullets.length > 1 && (
                        <button onClick={() => removeBullet(i)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Case Study Button Label</label>
                  <input type="text" value={content.caseStudyLabel} onChange={e => setContent({...content, caseStudyLabel: e.target.value})} className={fieldClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Testimonials Button Label</label>
                  <input type="text" value={content.testimonialsLabel} onChange={e => setContent({...content, testimonialsLabel: e.target.value})} className={fieldClass} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Closing Paragraph</label>
                <textarea rows={2} value={content.closingLine} onChange={e => setContent({...content, closingLine: e.target.value})} className={`${fieldClass} resize-none`} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Call to Action Line</label>
                <input type="text" value={content.ctaLine} onChange={e => setContent({...content, ctaLine: e.target.value})} className={fieldClass} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Sender Name / Sign-off</label>
                <input type="text" value={content.senderName} onChange={e => setContent({...content, senderName: e.target.value})} className={fieldClass} />
              </div>

            </div>
          ) : (
            /* VIEW MODE — rendered email preview */
            <div
              className="w-full border border-slate-200 rounded-2xl overflow-hidden"
              dangerouslySetInnerHTML={{ __html: buildHtml(content) }}
            />
          )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
            {editMode ? '✏️ Edit mode — modify sections above' : '👁 View mode — click Edit to modify'}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            {editMode && (
              <button onClick={() => setEditMode(false)} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-emerald-200 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-all">
                <Save size={13} /> Save
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#0ea5e9] text-white rounded-xl text-xs font-bold hover:bg-[#0284c7] transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50"
            >
              {sending ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send size={13} />}
              {sending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SendEmailModal;