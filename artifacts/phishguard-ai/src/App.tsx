import { useState, type CSSProperties, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CircleCheck,
  Clock3,
  Info,
  Lightbulb,
  Link2,
  LockKeyhole,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  useAnalyzeUrl,
  useGenerateUrlExplanation,
  type UrlAnalysis,
  type UrlSignal,
} from '@workspace/api-client-react';

const queryClient = new QueryClient();

const urlSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Paste a link to begin.')
    .max(2048, 'That link is too long to check.')
    .refine((value) => /^(https?:\/\/|www\.)/i.test(value), 'Include http:// or https:// before the link.'),
});

type UrlForm = z.infer<typeof urlSchema>;

const examples = [
  { label: 'News article', value: 'https://www.bbc.com/news' },
  { label: 'Package delivery', value: 'https://delivery-status.example.com/track' },
  { label: 'Account sign-in', value: 'https://accounts.google.com' },
];

function Home() {
  const [analysis, setAnalysis] = useState<UrlAnalysis | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationUnavailable, setExplanationUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const analyzeUrl = useAnalyzeUrl();
  const generateExplanation = useGenerateUrlExplanation();
  const form = useForm<UrlForm>({
    resolver: zodResolver(urlSchema),
    defaultValues: { url: '' },
  });
  const watchedUrl = form.watch('url');

  const onSubmit = (values: UrlForm) => {
    setErrorMessage('');
    setAnalysis(null);
    setExplanation(null);
    setExplanationUnavailable(false);
    analyzeUrl.mutate(
      { data: { url: values.url.trim() } },
      {
        onSuccess: (result) => {
          const submittedUrl = values.url.trim();
          setAnalysis(result);
          generateExplanation.mutate(
            { data: { url: submittedUrl, analysis: result } },
            {
              onSuccess: (response) => setExplanation(response.explanation),
              onError: () => setExplanationUnavailable(true),
            },
          );
        },
        onError: (error) => {
          const candidate = error as { response?: { data?: { error?: string } }; message?: string };
          setErrorMessage(
            candidate.response?.data?.error ||
              candidate.message ||
              'We could not complete that check. Try again in a moment.',
          );
        },
      },
    );
  };

  const chooseExample = (value: string) => {
    form.setValue('url', value, { shouldValidate: true });
    setErrorMessage('');
    document.getElementById('url-checker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#top" className="flex items-center gap-3" data-testid="link-brand">
            <span className="flex size-9 items-center justify-center rounded-[12px] bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="size-5" strokeWidth={2.5} />
            </span>
            <span className="text-[15px] font-bold tracking-[-0.02em]">PhishGuard <span className="font-mono text-[11px] font-medium text-primary">AI</span></span>
          </a>
          <a href="#how-it-works" className="hidden items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex" data-testid="link-how-it-works">
            How it works <ArrowRight className="size-3.5" />
          </a>
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground sm:hidden" data-testid="status-private-mobile">
            <LockKeyhole className="size-3.5 text-primary" /> Private by design
          </div>
        </div>
      </header>

      <section id="top" className="security-grid relative border-b border-border/70">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
          <div className="max-w-3xl animate-float-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-primary shadow-sm" data-testid="badge-analyst-note">
              <span className="size-1.5 rounded-full bg-accent" />
              A calmer way to click
            </div>
            <h1 className="max-w-3xl text-balance text-[clamp(2.65rem,8vw,5.8rem)] font-semibold leading-[0.98] tracking-[-0.065em] text-foreground">
              Check a suspicious link before you <span className="text-primary">click.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              PhishGuard reads a suspicious link like a security analyst would, then explains what it found in plain language. No panic. Just a clearer next step.
            </p>
          </div>

          <div id="url-checker" className="mt-10 max-w-3xl animate-float-in [animation-delay:120ms]" data-testid="card-url-checker">
            <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-[22px] border border-border bg-card p-2.5 shadow-[0_20px_60px_-30px_hsl(216_37%_17%_/_0.35)] sm:p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] border border-transparent bg-secondary/65 px-4 py-3 focus-within:border-primary/40 focus-within:bg-card">
                  <Link2 className="size-5 shrink-0 text-primary" />
                  <label htmlFor="url" className="sr-only">URL to check</label>
                  <input
                    id="url"
                    type="url"
                    placeholder="Paste a link you are unsure about"
                    autoComplete="url"
                    {...form.register('url')}
                    className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
                    data-testid="input-url"
                  />
                  {watchedUrl ? (
                    <button type="button" onClick={() => form.reset()} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Clear URL" data-testid="button-clear-url">
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
                <button
                  type="submit"
                  disabled={analyzeUrl.isPending || generateExplanation.isPending}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-primary px-6 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-wait disabled:opacity-75 sm:min-w-[154px]"
                  data-testid="button-analyze-url"
                >
                  {analyzeUrl.isPending || generateExplanation.isPending ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/35 border-t-primary-foreground" />
                      {analyzeUrl.isPending ? 'Checking' : 'Generating'}
                    </>
                  ) : (
                    <>
                      Check link <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </div>
              {form.formState.errors.url ? (
                <p className="px-3 pt-2 text-xs font-medium text-destructive" data-testid="text-url-error">{form.formState.errors.url.message}</p>
              ) : null}
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-3.5 text-primary" /> We do not visit the link</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" /> Usually under 3 seconds</span>
            </div>
          </div>

          <div className="mt-8 max-w-3xl animate-float-in [animation-delay:220ms]">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Try a safe example</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => chooseExample(example.value)}
                  className="rounded-full border border-border bg-card/75 px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  data-testid={`button-example-${example.label.toLowerCase().replaceAll(' ', '-')}`}
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        {errorMessage ? <ErrorState message={errorMessage} onRetry={() => form.handleSubmit(onSubmit)()} /> : null}
        {analyzeUrl.isPending ? <LoadingState /> : null}
        {analysis ? (
          <AnalysisResult
            analysis={analysis}
            explanation={explanation}
            explanationPending={generateExplanation.isPending}
            explanationUnavailable={explanationUnavailable}
            onAnalyzeAnother={() => {
              setAnalysis(null);
              setExplanation(null);
              setExplanationUnavailable(false);
              setErrorMessage('');
              form.reset();
              document.getElementById('url-checker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
        ) : null}
        {!analysis && !analyzeUrl.isPending && !errorMessage ? <Explainer /> : null}
        <HowItWorks />
        <FooterInfo />
      </div>
    </main>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="animate-float-in py-10" data-testid="state-error">
      <div className="flex flex-col gap-4 rounded-[20px] border border-destructive/25 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="size-4" /></span>
          <div><p className="font-semibold">The check could not finish</p><p className="mt-1 text-sm text-muted-foreground">{message}</p></div>
        </div>
        <button onClick={onRetry} className="inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/25 px-3.5 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10" data-testid="button-retry">
          <RotateCcw className="size-4" /> Try again
        </button>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <section className="animate-float-in py-10" aria-live="polite" data-testid="state-loading">
      <div className="rounded-[20px] border border-border bg-card p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><ScanSearch className="size-5 animate-pulse" /></span>
          <div><p className="font-semibold">Reading the link signals</p><p className="mt-1 text-sm text-muted-foreground">We are checking structure, domain clues, and context.</p></div>
        </div>
        <div className="mt-7 space-y-3"><div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" /><div className="h-3 w-3/5 animate-pulse rounded-full bg-muted" /><div className="h-3 w-2/5 animate-pulse rounded-full bg-muted" /></div>
      </div>
    </section>
  );
}

function Explainer() {
  return (
    <section className="py-14 sm:py-20" data-testid="section-explainer">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
        <div>
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">The useful middle ground</p>
          <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">You do not need to be a security expert to spot a risky link.</h2>
          <p className="mt-5 max-w-xl leading-7 text-muted-foreground">A link can look familiar and still hide a different destination. PhishGuard surfaces the small details people often miss: a lookalike domain, an urgent path, or a link that asks for more trust than it has earned.</p>
        </div>
        <div className="rounded-[20px] border border-border bg-card p-5 sm:p-7">
          <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-accent/30 text-primary"><Lightbulb className="size-4" /></span><h3 className="font-semibold">A good answer is actionable</h3></div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">We will tell you what to do next, not just assign a scary number. When in doubt: do not sign in through the link. Open the service using an address you already trust.</p>
          <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-xs font-semibold text-primary"><ShieldCheck className="size-4" /> Explainable checks, human-readable results</div>
        </div>
      </div>
    </section>
  );
}

function AnalysisResult({
  analysis,
  explanation,
  explanationPending,
  explanationUnavailable,
  onAnalyzeAnother,
}: {
  analysis: UrlAnalysis;
  explanation: string | null;
  explanationPending: boolean;
  explanationUnavailable: boolean;
  onAnalyzeAnother: () => void;
}) {
  const risk = riskMeta(analysis.risk);
  const score = Math.max(0, Math.min(100, analysis.score));
  const scoreStyle = { '--score': score, '--score-color': risk.color } as CSSProperties;
  return (
    <section className="animate-float-in py-10 sm:py-14" aria-live="polite" data-testid="section-analysis-result">
      <div className="mb-6 flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Your link check</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Here is what we found.</h2></div>
        <button
          type="button"
          onClick={onAnalyzeAnother}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary sm:self-auto"
          data-testid="button-analyze-another"
        >
          <RotateCcw className="size-3.5" /> Analyze another URL
        </button>
        <p className="font-mono text-[11px] text-muted-foreground" data-testid="text-analysis-time">{formatDate(analysis.analyzedAt)}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className={`rounded-[22px] border p-5 sm:p-7 ${risk.panel}`}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="score-ring relative flex size-32 shrink-0 items-center justify-center rounded-full" style={scoreStyle} data-testid="display-risk-score">
              <div className="relative z-10 text-center"><div className="font-mono text-3xl font-medium tracking-[-0.08em]">{score}</div><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">score</div></div>
            </div>
            <div><div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${risk.badge}`} data-testid="status-risk"><span className="size-1.5 rounded-full bg-current" /> {risk.label}</div><h3 className="text-xl font-semibold tracking-[-0.03em]">{analysis.summary}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">This is an advisory signal check, not a guarantee. Context matters.</p></div>
          </div>
          <div className="mt-7 border-t border-current/10 pt-4"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Destination</p><p className="mt-2 break-all font-mono text-xs text-foreground" data-testid="text-normalized-url">{analysis.normalizedUrl}</p><p className="mt-2 text-xs text-muted-foreground">Domain: <span className="font-semibold text-foreground">{analysis.domain}</span></p></div>
        </div>
        <div className="rounded-[22px] border border-border bg-card p-5 sm:p-7">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Recommended next steps</h3><Lightbulb className="size-4 text-primary" /></div>
          <ul className="mt-5 space-y-4">{analysis.recommendations.map((recommendation, index) => <li className="flex gap-3 text-sm leading-6" key={`${recommendation}-${index}`} data-testid={`recommendation-${index}`}><span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-2.5" strokeWidth={3} /></span><span>{recommendation}</span></li>)}</ul>
          <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><Activity className="size-3.5 text-primary" /> {explanation ? 'AI-assisted explanation' : explanationUnavailable ? 'AI explanation unavailable' : 'Heuristic analysis complete'}</div>
        </div>
      </div>
      <section className="mt-5 rounded-[22px] border border-border bg-card p-5 sm:p-7" aria-live="polite" data-testid="section-ai-explanation">
        <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Lightbulb className="size-4" /></span><h3 className="font-semibold">AI explanation</h3></div>
        {explanationPending ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><span className="size-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />Generating explanation...</p>
        ) : explanation ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground" data-testid="text-ai-explanation">{explanation}</p>
        ) : explanationUnavailable ? (
          <p className="mt-4 text-sm text-muted-foreground" data-testid="text-ai-explanation-unavailable">AI explanation unavailable. Your heuristic assessment is still shown above.</p>
        ) : null}
      </section>
      <Signals signals={analysis.signals} />
    </section>
  );
}

function Signals({ signals }: { signals: UrlSignal[] }) {
  return (
    <div className="mt-5 rounded-[22px] border border-border bg-card p-5 sm:p-7" data-testid="section-signals">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Signal breakdown</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.03em]">What shaped the assessment</h3></div><p className="text-xs text-muted-foreground">{signals.length} signals reviewed</p></div>
      <div className="mt-6 grid gap-3 md:grid-cols-2">{signals.map((signal) => <SignalRow signal={signal} key={signal.id} />)}</div>
    </div>
  );
}

function SignalRow({ signal }: { signal: UrlSignal }) {
  const meta = signalMeta(signal.severity);
  return <article className={`signal-${signal.severity} rounded-r-xl border border-border border-l-4 bg-background p-4`} data-testid={`signal-${signal.id}`}><div className="flex items-start gap-3"><span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${meta.iconBg} ${meta.iconText}`}>{meta.icon}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{signal.label}</h4><span className={`font-mono text-[10px] font-medium ${meta.points}`}>{signal.points > 0 ? `+${signal.points}` : signal.points} pts</span></div><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{signal.detail}</p><span className="mt-3 inline-flex rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{signal.category}</span></div></div></article>;
}

function HowItWorks() {
  const steps = [
    ['01', 'Paste, do not open', 'Share the URL you are unsure about. PhishGuard checks the text itself without loading the destination.'],
    ['02', 'Signals become context', 'We look at the domain, URL structure, and common social-engineering patterns.'],
    ['03', 'You choose with clarity', 'Get a measured risk level, the evidence behind it, and a practical recommendation.'],
  ];
  return <section id="how-it-works" className="border-t border-border py-14 sm:py-20" data-testid="section-how-it-works"><div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr] lg:gap-16"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">How it works</p><h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">Small checks.<br />Better decisions.</h2></div><div className="divide-y divide-border border-y border-border">{steps.map(([number, title, detail]) => <div className="grid gap-3 py-6 sm:grid-cols-[52px_1fr] sm:gap-5" key={number}><span className="font-mono text-xs font-medium text-primary">{number}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{detail}</p></div></div>)}</div></div></section>;
}

function FooterInfo() {
  return <footer className="border-t border-border py-12 sm:py-16" data-testid="section-limitations"><div className="grid gap-10 md:grid-cols-3 md:gap-8"><div><div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" /> PhishGuard <span className="font-mono text-[10px] text-primary">AI</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">A pre-click pause for the moments when a link does not feel quite right.</p></div><div><h3 className="text-sm font-semibold">Know the limits</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">No automated tool can promise perfect safety. A low-risk result is not permission to share passwords or payment details. If a message creates urgency, verify it through a separate trusted channel.</p></div><div><h3 className="text-sm font-semibold">Privacy note</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">We analyze the URL you submit. We do not visit the destination or ask you to sign in. Avoid pasting links containing private tokens or personal information.</p></div></div><div className="mt-10 rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950"><strong>Safety reminder:</strong> PhishGuard AI provides a risk assessment, not a guarantee of safety. Never enter passwords, OTPs, or financial information on a suspicious website.</div><div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-center gap-2"><Info className="size-3.5" /> Built for informed clicks, not fear.</span><span className="font-mono">pre-click / 01</span></div></footer>;
}

function riskMeta(risk: UrlAnalysis['risk']) {
  if (risk === 'high') return { label: 'High Risk', color: 'hsl(4 72% 50%)', panel: 'border-destructive/25 bg-destructive/5', badge: 'bg-destructive/10 text-destructive' };
  if (risk === 'medium') return { label: 'Medium Risk', color: 'hsl(42 90% 52%)', panel: 'border-amber-400/35 bg-amber-50', badge: 'bg-amber-100 text-amber-800' };
  return { label: 'Low Risk', color: 'hsl(173 71% 31%)', panel: 'border-primary/25 bg-primary/5', badge: 'bg-primary/10 text-primary' };
}

function signalMeta(severity: UrlSignal['severity']) {
  if (severity === 'danger') return { icon: <Ban className="size-3.5" />, iconBg: 'bg-destructive/10', iconText: 'text-destructive', points: 'text-destructive' };
  if (severity === 'caution') return { icon: <AlertTriangle className="size-3.5" />, iconBg: 'bg-amber-100', iconText: 'text-amber-800', points: 'text-amber-800' };
  return { icon: <CircleCheck className="size-3.5" />, iconBg: 'bg-primary/10', iconText: 'text-primary', points: 'text-primary' };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return `Checked ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)}`;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
