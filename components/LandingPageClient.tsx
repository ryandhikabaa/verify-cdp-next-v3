"use client";

import {useState} from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Building2,
  Crown,
  Fingerprint,
  Globe2,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCog,
  Waves,
} from 'lucide-react';
import {PublicShell} from '@/components/PublicShell';
import {UnderDevelopmentModal} from '@/components/ui/UnderDevelopmentModal';

const featureCards = [
  {
    icon: Fingerprint,
    title: 'Controlled security pattern management',
    description: 'Standardize how security patterns are created, governed, and maintained to support repeatable protection workflows across business units and regulated operations.',
  },
  {
    icon: Building2,
    title: 'Purpose-built operational workspaces',
    description: 'Equip production, verification, and supervisory teams with dedicated workspaces that improve execution clarity, accountability, and cross-functional coordination.',
  },
  {
    icon: Shield,
    title: 'Enterprise governance and assurance',
    description: 'Embed stronger internal control through role-based access, auditable activity records, and review checkpoints aligned with enterprise risk and compliance needs.',
  },
];

const preferenceCards = [
  {
    value: '3k+',
    title: 'Protection scenarios supported',
    description: 'Architected to support a growing portfolio of document models, reference assets, and verification scenarios across complex enterprise environments.',
  },
  {
    title: 'Accelerated review orchestration',
    description: 'Reduce friction between preparation and validation teams with clearer operational visibility, fewer manual handoffs, and more dependable review cycles.',
  },
  {
    title: 'Centralized reference intelligence',
    description: 'Consolidate patterns, verification outcomes, and supporting references in one controlled layer to improve traceability, oversight, and change governance.',
  },
];

const chartMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const chartHeights = [24, 52, 66, 81, 94, 118];

const growthSteps = [
  {
    step: '1',
    title: 'Activate the right operational workspace',
    description: 'Begin in the workspace aligned to the mission, whether the team is preparing protected assets, validating field outcomes, or supervising enterprise operations.',
  },
  {
    step: '2',
    title: 'Register governed reference assets',
    description: 'Maintain approved references in a structured catalog so every protected document is backed by a clear identity, approved baseline, and verifiable history.',
  },
  {
    step: '3',
    title: 'Verify, review, and scale with confidence',
    description: 'Execute verification checks, compare outcomes, and extend into reporting, supervision, and audit review through one disciplined enterprise workflow.',
  },
];

const missionStats = [
  {value: '24%', label: 'potential uplift in operational efficiency'},
  {value: '180K', label: 'reference records supported at scale'},
  {value: '10+', label: 'workflow domains ready for expansion'},
];

const workspaceCards = [
  {title: 'Pattern Studio', price: 'Enterprise workspace for controlled document protection setup'},
  {title: 'Scan Console', price: 'Enterprise workspace for verification, review, and field assurance', featured: true},
];

const trustSignals = ['Simple to start', 'Clear for teams', 'Ready to grow'];

const conversionHighlights = [
  'Reduce manual review friction',
  'Improve trust in verification outcomes',
  'Create a more premium operational standard',
];

const premiumPillars = [
  {
    icon: Crown,
    title: 'Calm, confident control',
    description: 'Help leadership and supervisory teams keep a clearer view of verification readiness, operational quality, and governance posture.',
  },
  {
    icon: Globe2,
    title: 'Flexible for growing teams',
    description: 'Support distributed teams, growing document volumes, and broader operational coverage without adding unnecessary complexity.',
  },
  {
    icon: UserCog,
    title: 'Designed for everyday use',
    description: 'Bring structured workflows, clearer responsibilities, and auditable execution into one refined experience that feels approachable.',
  },
];

/** Client landing page with interactive public actions. */
export function LandingPageClient() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeAction, setActiveAction] = useState('This feature');

  const showUnderDevelopment = (label: string) => {
    setActiveAction(label);
    setIsModalOpen(true);
  };

  return (
    <PublicShell>
      <UnderDevelopmentModal open={isModalOpen} title={activeAction} onClose={() => setIsModalOpen(false)} />

      <section className="overflow-hidden rounded-[2.6rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_32%),linear-gradient(135deg,#031923_0%,#0a3140_52%,#0f5d73_100%)] text-white shadow-[0_40px_120px_rgba(2,12,27,0.28)]">
        <div className="px-6 py-12 sm:px-8 sm:py-14 lg:px-12 lg:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-white/12 bg-white/8 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-100">
              Enterprise document trust platform
            </div>
            <h1 className="mt-6 max-w-2xl text-4xl font-black tracking-[-0.07em] text-white sm:text-5xl lg:text-[66px] lg:leading-[1.03]">
              A simpler way to manage document security, verification, and oversight.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-cyan-50/78 sm:text-lg">
              Dotvera brings pattern management, verification, and supervisory insight together in one clean platform, so teams can work with more clarity and less friction.
            </p>

            <div className="mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/verify"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-200 px-6 text-sm font-semibold text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.18)] transition hover:bg-cyan-100"
              >
                Start Verification
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#products"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-white/6 px-5 text-sm font-medium text-cyan-100 transition hover:bg-white/10 hover:text-white"
              >
                Learn More
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:max-w-xl sm:grid-cols-3">
              {trustSignals.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-cyan-50/85 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-cyan-200" />
                    <span>{item}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-100/70">Executive brief</div>
                  <div className="mt-2 text-2xl font-black tracking-[-0.05em] text-white">Premium foundation for modern document operations</div>
                </div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-cyan-100">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {premiumPillars.map(({icon: Icon, title, description}) => (
                  <div key={title} className="rounded-[1.4rem] border border-white/8 bg-slate-950/20 p-4">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-cyan-100">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-base font-semibold text-white">{title}</div>
                    <p className="mt-2 text-sm leading-7 text-cyan-50/72">{description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-cyan-200/10 bg-black/20 p-6 backdrop-blur-xl">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-100/65">Why it matters</div>
              <div className="mt-3 text-3xl font-black tracking-[-0.05em] text-white">Designed to feel premium and drive business confidence</div>
              <p className="mt-3 text-sm leading-7 text-cyan-50/72">
                Create a more credible verification experience for teams, partners, and stakeholders while improving operational consistency.
              </p>

              <div className="mt-5 space-y-3">
                {conversionHighlights.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/6 px-4 py-3 text-sm text-cyan-50/85">
                    <CheckCircle2 className="h-4 w-4 text-cyan-200" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/verify"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Try Verification Flow
                </Link>
                <button
                  type="button"
                  onClick={() => showUnderDevelopment('Request Demo')}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-white/6 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Request Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="products" className="mt-10 rounded-[2.1rem] border border-slate-200/80 bg-white/95 px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.05)] sm:px-8 lg:px-12 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-700">Platform overview</div>
            <h2 className="mt-3 max-w-xl text-3xl font-black tracking-[-0.05em] text-slate-950 sm:text-4xl">
              A modern trust infrastructure for organizations that cannot afford uncertainty in document security.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-slate-500">
            Dotvera unifies preparation, reference governance, verification, and supervisory review into a single operational layer built to improve trust, consistency, and executive visibility.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {featureCards.map(({icon: Icon, title, description}) => (
            <div key={title} className="rounded-[2rem] border border-slate-200/60 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfc_100%)] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-cyan-100">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="customers" className="mt-10">
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-700">Why Dotvera</div>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950 sm:text-4xl">Built for enterprises that demand stronger control, traceability, and trust in document operations</h2>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          <div className="rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbfc_100%)] p-7 shadow-[0_24px_70px_rgba(15,23,42,0.04)]">
            <div className="text-6xl font-black tracking-[-0.07em] text-cyan-700">{preferenceCards[0].value}</div>
            <div className="mt-5 max-w-xs text-2xl font-semibold tracking-[-0.04em] text-slate-950">{preferenceCards[0].title}</div>
            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-500">{preferenceCards[0].description}</p>
          </div>

          <div className="rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbfc_100%)] p-7 shadow-[0_24px_70px_rgba(15,23,42,0.04)]">
            <h3 className="max-w-xs text-2xl font-semibold tracking-[-0.04em] text-slate-950">{preferenceCards[1].title}</h3>
            <p className="mt-3 max-w-sm text-sm leading-7 text-slate-500">{preferenceCards[1].description}</p>
            <div className="mt-8 flex items-center gap-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-700 text-white">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="flex-1 border-t border-dashed border-slate-300" />
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbfc_100%)] p-7 shadow-[0_24px_70px_rgba(15,23,42,0.04)] lg:col-span-2">
            <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-end">
              <div>
                <h3 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">{preferenceCards[2].title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">{preferenceCards[2].description}</p>
              </div>
              <div className="rounded-[1.75rem] bg-slate-50 p-5">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Operational trend</span>
                  <span>6 months</span>
                </div>
                <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">+38% visibility across verification operations</div>
                <div className="mt-6 flex h-40 items-end gap-3">
                  {chartHeights.map((height, index) => (
                    <div key={height} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-[1.25rem] bg-[linear-gradient(180deg,rgba(8,145,178,0.18),rgba(14,165,233,0.52))]"
                        style={{height}}
                      />
                      <span className="text-[11px] text-slate-400">{chartMonths[index]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mt-10 overflow-hidden rounded-[2.2rem] bg-[linear-gradient(135deg,#041d28_0%,#08384a_42%,#0d566a_100%)] px-6 py-8 text-white shadow-[0_30px_90px_rgba(8,56,74,0.28)] sm:px-8 lg:px-12 lg:py-12">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/80">Workflow steps</div>
        <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.05em] sm:text-4xl">
          Build a document trust workflow that is easier to govern, easier to audit, and stronger at scale.
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {growthSteps.map((item) => (
            <div key={item.step} className="rounded-[1.75rem] border border-white/8 bg-white/6 p-5 backdrop-blur-sm">
              <div className="text-5xl font-black tracking-[-0.06em] text-white/35">{item.step}</div>
              <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-cyan-50/70">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="learn" className="mt-10 px-2 text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-700">Our mission</div>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950 sm:text-4xl">
          We help enterprises elevate sensitive document handling into a reliable, accountable, and commercially credible trust operation.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
          Beyond preparation and verification, the platform is designed to support an end-to-end operating model that leadership teams can supervise, improve, and scale with confidence.
        </p>

        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-3">
          {missionStats.map((item) => (
            <div key={item.label}>
              <div className="text-5xl font-black tracking-[-0.06em] text-slate-950">{item.value}</div>
              <div className="mt-2 text-sm font-medium text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-4xl">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Explore workspaces</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {workspaceCards.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => showUnderDevelopment(item.title)}
                className={`group rounded-[2rem] p-7 text-left shadow-[0_24px_70px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_30px_80px_rgba(15,23,42,0.08)] ${
                  item.featured
                    ? 'bg-[linear-gradient(135deg,#082c39_0%,#106177_55%,#1f8ca8_100%)] text-white'
                    : 'border border-slate-200/70 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbfc_100%)] text-slate-950'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-4xl font-black tracking-[-0.05em]">{item.title}</div>
                    <div className={`mt-8 text-2xl ${item.featured ? 'text-white/90' : 'text-slate-600'}`}>{item.price}</div>
                  </div>
                  <ArrowRight className={`h-5 w-5 transition group-hover:translate-x-1 ${item.featured ? 'text-white' : 'text-slate-500'}`} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-10 rounded-[2.2rem] bg-[linear-gradient(135deg,#071f2b_0%,#09394b_50%,#0c5568_100%)] px-6 py-8 text-white shadow-[0_30px_90px_rgba(8,56,74,0.18)] sm:px-8 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/80">Get started</div>
            <h2 className="mt-3 max-w-xl text-3xl font-black tracking-[-0.05em]">Ready to strengthen trust in your document security operations?</h2>
            <p className="mt-3 max-w-lg text-sm leading-7 text-cyan-50/75">
              Explore a connected platform for document protection setup, reference governance, verification review, and enterprise-grade operational monitoring.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/verify"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-600 px-5 text-sm font-semibold text-white transition hover:bg-cyan-500"
            >
              Start Verification
            </Link>
            <button
              type="button"
              onClick={() => showUnderDevelopment('Learn More')}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Learn More
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <footer className="mt-10 border-t border-slate-200/80 px-2 py-8 text-sm text-slate-500">
        <div className="grid gap-8 md:grid-cols-[1fr_repeat(3,minmax(0,160px))_auto] md:items-start">
          <div>
            <div className="flex items-center gap-3 text-slate-950">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-700 text-xs font-bold text-white">DV</span>
              <span className="text-lg font-semibold">Dotvera</span>
            </div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">Solutions</div>
            <div className="mt-3 space-y-2">
              <div>Pattern Studio</div>
              <div>Scan Console</div>
              <div>Reference Intelligence</div>
            </div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">Company</div>
            <div className="mt-3 space-y-2">
              <div>About Dotvera</div>
              <div>Product Roadmap</div>
              <div>Enterprise Support</div>
            </div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">Learn</div>
            <div className="mt-3 space-y-2">
              <div>Platform Overview</div>
              <div>Implementation Guides</div>
              <div>Product Updates</div>
            </div>
          </div>
          <div className="flex gap-3 md:justify-end">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
              <BarChart3 className="h-4 w-4" />
            </span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
              <Waves className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200/80 pt-5 text-center text-xs text-slate-400">©Dotvera 2026. All rights reserved.</div>
      </footer>
    </PublicShell>
  );
}
