import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
  Sparkles,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  useAnalyzeUrl,
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

function LinkSageMark({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M24 5.5 39 11v10.3c0 9.1-5.9 16.1-15 21.2C14.9 37.4 9 30.4 9 21.3V11L24 5.5Z"
        fill="currentColor"
        fillOpacity=".12"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <g
        stroke="#e2e8f0"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.1"
      >
        <path d="M20 26a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
        <path d="M28 22a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
      </g>
      <path
        d="m33 11 .8 2.2L36 14l-2.2.8L33 17l-.8-2.2L30 14l2.2-.8L33 11Z"
        fill="#a5f3fc"
      />
    </svg>
  );
}

function Home() {
  const [analysis, setAnalysis] = useState<UrlAnalysis | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationPending, setExplanationPending] = useState(false);
  const [explanationUnavailable, setExplanationUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const explanationController = useRef<AbortController | null>(null);
  const analyzeUrl = useAnalyzeUrl();
  const form = useForm<UrlForm>({
    resolver: zodResolver(urlSchema),
    defaultValues: { url: '' },
  });
  const watchedUrl = form.watch('url');

  const requestExplanation = async (url: string, result: UrlAnalysis) => {
    explanationController.current?.abort();
    const controller = new AbortController();
    explanationController.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
    setExplanationPending(true);
    try {
      const response = await fetch('/api/analyze-url-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, analysis: result }),
        signal: controller.signal,
      });

      if (!response.ok) {
        setExplanationUnavailable(true);
        return;
      }

      const data: unknown = await response.json();
      const explanationText =
        typeof data === 'object' && data !== null && 'explanation' in data &&
        typeof data.explanation === 'string'
          ? data.explanation.trim()
          : '';

      if (explanationText) {
        setExplanation(explanationText);
      } else {
        setExplanationUnavailable(true);
      }
    } catch (error) {
      if (explanationController.current !== controller) return;
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('AI explanation request failed', error);
      }
      setExplanationUnavailable(true);
    } finally {
      window.clearTimeout(timeoutId);
      if (explanationController.current === controller) {
        explanationController.current = null;
        setExplanationPending(false);
      }
    }
  };

  const onSubmit = (values: UrlForm) => {
    explanationController.current?.abort();
    explanationController.current = null;
    setErrorMessage('');
    setAnalysis(null);
    setExplanation(null);
    setExplanationPending(false);
    setExplanationUnavailable(false);
    analyzeUrl.mutate(
      { data: { url: values.url.trim() } },
      {
        onSuccess: (result) => {
          const submittedUrl = values.url.trim();
          setAnalysis(result);
          void requestExplanation(submittedUrl, result);
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
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0b1020]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#top" aria-label="LinkSage AI home" className="focus-ring flex items-center gap-3 rounded-lg" data-testid="link-brand">
            <span className="flex size-10 items-center justify-center rounded-[14px] border border-cyan-200/15 bg-cyan-300/[0.06] text-primary shadow-[0_0_28px_hsl(190_92%_58%_/_0.16)]">
              <LinkSageMark className="size-9" />
            </span>
            <span className="text-[15px] font-bold tracking-[-0.02em]">LinkSage <span className="font-mono text-[11px] font-medium text-primary">AI</span></span>
          </a>
          <a href="#how-it-works" className="focus-ring hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex" data-testid="link-how-it-works">
            How it works <ArrowRight className="size-3.5" />
          </a>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-[11px] font-semibold text-emerald-100/90" data-testid="status-private-mobile">
            <LockKeyhole className="size-3.5 text-emerald-300" /> Private by design
          </div>
        </div>
      </header>

      <section id="top" className="security-grid relative isolate border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[34rem] max-w-5xl rounded-full bg-[radial-gradient(ellipse_at_top,hsl(247_74%_55%_/_0.12),transparent_66%)] blur-3xl" />
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="mx-auto max-w-4xl animate-float-in text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-primary shadow-[0_0_30px_hsl(190_92%_58%_/_0.08)]" data-testid="badge-analyst-note">
              <Sparkles className="size-3.5" />
              Know before you click.
            </div>
            <h1 className="mx-auto max-w-4xl text-balance text-[clamp(2.7rem,8vw,5.6rem)] font-semibold leading-[0.99] tracking-[-0.065em] text-foreground">
              Check a suspicious link <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300 bg-clip-text text-transparent">before you click.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              AI-powered pre-click URL risk analysis that explains suspicious signals in plain English.
            </p>
          </div>

          <div id="url-checker" className="mx-auto mt-10 max-w-3xl animate-float-in [animation-delay:120ms] sm:mt-12" data-testid="card-url-checker">
            <form onSubmit={form.handleSubmit(onSubmit)} className="surface-card rounded-[26px] border border-white/[0.1] p-2.5 shadow-[0_28px_90px_-38px_hsl(190_92%_45%_/_0.24)] ring-1 ring-white/[0.03] transition-shadow duration-300 focus-within:shadow-[0_30px_100px_-38px_hsl(190_92%_45%_/_0.32)] sm:p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-[18px] border border-transparent bg-[#080d1a]/70 px-4 py-3 transition-colors focus-within:border-primary/35 focus-within:bg-[#090f20] sm:min-h-[62px] sm:px-5">
                  <Link2 className="size-5 shrink-0 text-primary" />
                  <label htmlFor="url" className="sr-only">URL to check</label>
                  <input
                    id="url"
                    type="url"
                    placeholder="Paste a link you are unsure about"
                    autoComplete="url"
                    {...form.register('url')}
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/80"
                    data-testid="input-url"
                  />
                  {watchedUrl ? (
                    <button type="button" onClick={() => form.reset()} className="focus-ring rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground" aria-label="Clear URL" data-testid="button-clear-url">
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
                <button
                  type="submit"
                  disabled={analyzeUrl.isPending}
                  className="focus-ring inline-flex min-h-14 items-center justify-center gap-2 rounded-[17px] bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 px-6 text-sm font-bold text-slate-950 shadow-[0_8px_24px_hsl(190_92%_58%_/_0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_12px_30px_hsl(190_92%_58%_/_0.3)] active:translate-y-0 disabled:cursor-wait disabled:opacity-65 sm:min-w-[158px]"
                  data-testid="button-analyze-url"
                >
                  {analyzeUrl.isPending ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/35 border-t-primary-foreground" />
                      Checking
                    </>
                  ) : (
                    <>
                      Check link <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </div>
              {form.formState.errors.url ? (
                <p className="px-3 pt-2 text-xs font-medium text-rose-300" role="alert" data-testid="text-url-error">{form.formState.errors.url.message}</p>
              ) : null}
            </form>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-3.5 text-emerald-300" /> We never visit the link</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 text-primary" /> Usually under 3 seconds</span>
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-3xl animate-float-in text-center [animation-delay:220ms]">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Or try a safe example</p>
            <div className="flex flex-wrap justify-center gap-2">
              {examples.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => chooseExample(example.value)}
                  className="focus-ring rounded-full border border-white/[0.09] bg-white/[0.035] px-3.5 py-2 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary/[0.06] hover:text-primary"
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
            explanationPending={explanationPending}
            explanationUnavailable={explanationUnavailable}
            onAnalyzeAnother={() => {
              setAnalysis(null);
              setExplanation(null);
              setExplanationPending(false);
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
      <div className="flex flex-col gap-4 rounded-[22px] border border-amber-300/20 bg-amber-200/[0.045] p-5 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200"><AlertTriangle className="size-4" /></span>
          <div><p className="font-semibold">The check could not finish</p><p className="mt-1 text-sm text-muted-foreground">{message}</p></div>
        </div>
        <button onClick={onRetry} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-200/20 px-4 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-200/10" data-testid="button-retry">
          <RotateCcw className="size-4" /> Try again
        </button>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <section className="animate-float-in py-10" aria-live="polite" data-testid="state-loading">
      <div className="surface-card rounded-[24px] border border-white/[0.08] p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.08] text-primary"><ScanSearch className="size-5 animate-pulse" /></span>
          <div><p className="font-semibold">Reading the link signals</p><p className="mt-1 text-sm text-muted-foreground">Checking structure, domain clues, and context.</p></div>
        </div>
        <div className="mt-7 space-y-3" aria-hidden="true"><div className="soft-shimmer h-3 w-4/5 rounded-full" /><div className="soft-shimmer h-3 w-3/5 rounded-full" /><div className="soft-shimmer h-3 w-2/5 rounded-full" /></div>
      </div>
    </section>
  );
}

function Explainer() {
  return (
    <section className="py-14 sm:py-20" data-testid="section-explainer">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
        <div>
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Clarity over alarm</p>
          <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">A little context can change your next click.</h2>
          <p className="mt-5 max-w-xl leading-7 text-muted-foreground">A link can look familiar and still hide a different destination. LinkSage AI surfaces the small details people often miss: a lookalike domain, an urgent path, or a link that asks for more trust than it has earned.</p>
        </div>
        <div className="surface-card rounded-[24px] border border-white/[0.08] p-5 transition-transform duration-300 hover:-translate-y-1 sm:p-7">
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-300/[0.08] text-violet-200"><Lightbulb className="size-4" /></span><h3 className="font-semibold">A good answer is actionable</h3></div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">We will tell you what to do next, not just assign a scary number. When in doubt: do not sign in through the link. Open the service using an address you already trust.</p>
          <div className="mt-6 flex items-center gap-2 border-t border-white/[0.08] pt-4 text-xs font-semibold text-primary"><ShieldCheck className="size-4" /> Explainable checks, human-readable results</div>
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
      <div className="mb-6 flex flex-col gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Your link check</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Here is what we found.</h2></div>
        <button
          type="button"
          onClick={onAnalyzeAnother}
          className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-white/[0.1] bg-white/[0.035] px-4 py-2 text-sm font-semibold text-foreground transition-all duration-200 hover:border-primary/35 hover:bg-primary/[0.05] hover:text-primary sm:self-auto"
          data-testid="button-analyze-another"
        >
          <RotateCcw className="size-3.5" /> Analyze another URL
        </button>
        <p className="font-mono text-[11px] text-muted-foreground sm:text-right" data-testid="text-analysis-time">{formatDate(analysis.analyzedAt)}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className={`rounded-[24px] border p-5 shadow-xl sm:p-7 ${risk.panel}`}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div
              className="score-ring relative flex size-36 shrink-0 items-center justify-center rounded-full p-[7px]"
              style={scoreStyle}
              role="progressbar"
              aria-label="Risk score"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={score}
              data-testid="display-risk-score"
            >
              <div className="relative z-10 text-center"><div className="font-mono text-4xl font-medium tracking-[-0.08em]">{score}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">out of 100</div></div>
            </div>
            <div>
              <div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] ${risk.badge}`} data-testid="status-risk"><span className="size-1.5 rounded-full bg-current" /> {risk.label}</div>
              <h3 className="text-xl font-semibold tracking-[-0.03em]">{analysis.summary}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">An advisory signal check, not a guarantee. Context matters.</p>
            </div>
          </div>
          <div className="mt-7 border-t border-white/[0.09] pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Destination</p>
            <p className="mt-2 break-all rounded-xl bg-black/15 px-3 py-2.5 font-mono text-xs leading-5 text-foreground/90" data-testid="text-normalized-url">{analysis.normalizedUrl}</p>
            <p className="mt-2 text-xs text-muted-foreground">Domain: <span className="font-semibold text-foreground">{analysis.domain}</span></p>
          </div>
        </div>
        <div className="surface-card rounded-[24px] border border-white/[0.08] p-5 shadow-lg sm:p-7">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Your next move</p><h3 className="mt-1 font-semibold">Recommended next steps</h3></div><span className="flex size-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.08] text-primary"><Lightbulb className="size-4" /></span></div>
          <ul className="mt-5 space-y-3">{analysis.recommendations.map((recommendation, index) => <li className="flex gap-3 rounded-xl border border-white/[0.055] bg-white/[0.025] p-3 text-sm leading-6 transition-colors hover:bg-white/[0.045]" key={`${recommendation}-${index}`} data-testid={`recommendation-${index}`}><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-300/10 text-emerald-300"><Check className="size-3" strokeWidth={3} /></span><span>{recommendation}</span></li>)}</ul>
          <div className="mt-5 flex items-center gap-2 border-t border-white/[0.08] pt-4 text-xs text-muted-foreground"><Activity className="size-3.5 text-primary" /> {explanation ? 'AI-assisted explanation' : explanationUnavailable ? 'AI explanation unavailable' : 'Heuristic analysis complete'}</div>
        </div>
      </div>
      <section className="relative mt-5 overflow-hidden rounded-[24px] border border-violet-300/15 bg-[linear-gradient(125deg,hsl(252_46%_18%_/_0.74),hsl(224_37%_11%_/_0.98)_55%,hsl(190_44%_14%_/_0.72))] p-5 shadow-lg sm:p-7" aria-live="polite" data-testid="section-ai-explanation">
        <div className="pointer-events-none absolute -right-12 -top-20 size-56 rounded-full bg-violet-400/[0.09] blur-3xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-300/[0.1] text-violet-200"><Sparkles className="size-4" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-200/80">LinkSage AI intelligence</p><h3 className="mt-0.5 font-semibold">AI explanation</h3></div></div>
          <span className="hidden rounded-full border border-white/[0.09] bg-black/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline-flex">Optional insight</span>
        </div>
        {explanationPending ? (
          <div className="relative mt-5 flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4" data-testid="state-ai-loading">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-300/10 text-violet-200"><Sparkles className="size-3.5 animate-pulse" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground/90">Putting the signals into context...</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">A concise explanation is on its way. Your risk assessment is ready.</p>
              <div className="mt-4 space-y-2.5" aria-hidden="true"><div className="soft-shimmer h-2.5 w-full max-w-xl rounded-full" /><div className="soft-shimmer h-2.5 w-4/5 max-w-lg rounded-full" /></div>
            </div>
          </div>
        ) : explanation ? (
          <p className="relative mt-5 max-w-4xl whitespace-pre-wrap rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-sm leading-7 text-foreground/90 sm:p-5" data-testid="text-ai-explanation">{explanation}</p>
        ) : explanationUnavailable ? (
          <p className="relative mt-5 rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-sm leading-6 text-muted-foreground" data-testid="text-ai-explanation-unavailable">The AI explanation is unavailable right now. Your risk assessment and recommendations are still shown above.</p>
        ) : null}
      </section>
      <Signals signals={analysis.signals} />
    </section>
  );
}

function Signals({ signals }: { signals: UrlSignal[] }) {
  return (
    <div className="surface-card mt-5 rounded-[24px] border border-white/[0.08] p-5 sm:p-7" data-testid="section-signals">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Signal breakdown</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.03em]">What shaped the assessment</h3></div><p className="text-xs text-muted-foreground">{signals.length} signals reviewed</p></div>
      {signals.length > 0 ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">{signals.map((signal) => <SignalRow signal={signal} key={signal.id} />)}</div>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-sm leading-6 text-muted-foreground">No notable URL signals were detected. That is not a guarantee that the destination is safe.</div>
      )}
    </div>
  );
}

function SignalRow({ signal }: { signal: UrlSignal }) {
  const meta = signalMeta(signal.severity);
  return <article className={`signal-${signal.severity} rounded-xl border border-white/[0.07] border-l-[3px] bg-white/[0.025] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.13] hover:bg-white/[0.045]`} data-testid={`signal-${signal.id}`}><div className="flex items-start gap-3"><span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ${meta.iconBg} ${meta.iconText}`}>{meta.icon}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{signal.label}</h4><span className={`rounded-full bg-black/15 px-2 py-1 font-mono text-[10px] font-medium ${meta.points}`}>{signal.points > 0 ? `+${signal.points}` : signal.points} pts</span></div><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{signal.detail}</p><span className="mt-3 inline-flex rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{signal.category}</span></div></div></article>;
}

function HowItWorks() {
  const steps = [
    ['01', 'Paste, do not open', 'Share the URL you are unsure about. LinkSage AI checks the text itself without loading the destination.'],
    ['02', 'Signals become context', 'We look at the domain, URL structure, and common social-engineering patterns.'],
    ['03', 'You choose with clarity', 'Get a measured risk level, the evidence behind it, and a practical recommendation.'],
  ];
  return <section id="how-it-works" className="border-t border-white/[0.07] py-14 sm:py-20" data-testid="section-how-it-works"><div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr] lg:gap-16"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">How it works</p><h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">Small checks.<br />Better decisions.</h2></div><div className="divide-y divide-white/[0.07] rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 sm:px-7">{steps.map(([number, title, detail]) => <div className="grid gap-3 py-6 sm:grid-cols-[52px_1fr] sm:gap-5" key={number}><span className="font-mono text-xs font-medium text-primary">{number}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{detail}</p></div></div>)}</div></div></section>;
}

function FooterInfo() {
  return <footer className="border-t border-white/[0.07] py-12 sm:py-16" data-testid="section-limitations"><div className="grid gap-10 md:grid-cols-3 md:gap-8"><div><div className="flex items-center gap-2 font-semibold"><LinkSageMark className="size-5 text-primary" /> LinkSage <span className="font-mono text-[10px] text-primary">AI</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">A pre-click pause for the moments when a link does not feel quite right.</p></div><div><h3 className="text-sm font-semibold">Know the limits</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">No automated tool can promise perfect safety. A low-risk result is not permission to share passwords or payment details. If a message creates urgency, verify it through a separate trusted channel.</p></div><div><h3 className="text-sm font-semibold">Privacy note</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">We analyze the URL you submit. We do not visit the destination or ask you to sign in. Avoid pasting links containing private tokens or personal information.</p></div></div><div className="mt-10 rounded-xl border border-amber-200/15 bg-amber-200/[0.045] px-4 py-3 text-xs leading-5 text-amber-100/90"><strong className="text-amber-100">Safety reminder:</strong> LinkSage AI provides a risk assessment, not a guarantee of safety. Never enter passwords, OTPs, or financial information on a suspicious website.</div><div className="mt-5 flex flex-col gap-3 border-t border-white/[0.07] pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-center gap-2"><Info className="size-3.5" /> Built for informed clicks, not fear.</span><span className="font-mono">pre-click / 01</span></div></footer>;
}

function riskMeta(risk: UrlAnalysis['risk']) {
  if (risk === 'high') return { label: 'High Risk', color: 'hsl(0 78% 64%)', panel: 'border-rose-300/20 bg-rose-300/[0.045]', badge: 'border-rose-300/20 bg-rose-300/[0.09] text-rose-200' };
  if (risk === 'medium') return { label: 'Medium Risk', color: 'hsl(44 94% 65%)', panel: 'border-amber-200/20 bg-amber-200/[0.045]', badge: 'border-amber-200/20 bg-amber-200/[0.08] text-amber-100' };
  return { label: 'Low Risk', color: 'hsl(150 62% 56%)', panel: 'border-emerald-300/20 bg-emerald-300/[0.045]', badge: 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200' };
}

function signalMeta(severity: UrlSignal['severity']) {
  if (severity === 'danger') return { icon: <Ban className="size-3.5" />, iconBg: 'bg-rose-300/10', iconText: 'text-rose-200', points: 'text-rose-200' };
  if (severity === 'caution') return { icon: <AlertTriangle className="size-3.5" />, iconBg: 'bg-amber-200/10', iconText: 'text-amber-100', points: 'text-amber-100' };
  return { icon: <CircleCheck className="size-3.5" />, iconBg: 'bg-emerald-300/10', iconText: 'text-emerald-200', points: 'text-emerald-200' };
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
