'use client';

import {useEffect, useMemo, useState} from 'react';
import {BookOpenText, Check, ChevronDown, Copy, Download, Globe, LockKeyhole, Play, Search, Server, ShieldCheck} from 'lucide-react';
import {endpointDocs, type EndpointDocDefinition} from '@/lib/api-docs';

type EndpointDefinition = {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  access: 'Public' | 'Admin';
  summary: string;
  description: string;
  queryExample?: Record<string, string>;
  pathParams?: Record<string, string>;
  requestExample?: string;
  responseExample: string;
  errorExamples?: Array<{
    title: string;
    response: string;
  }>;
  responseContract?: string;
};

type EndpointGroup = {
  title: string;
  icon: JSX.Element;
  items: EndpointDefinition[];
};

type EndpointDraftState = {
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  body: string;
  response: string;
  status: string;
};

const groupIcons: Record<EndpointDocDefinition['group'], JSX.Element> = {
  Authentication: <LockKeyhole className="h-4 w-4" />,
  Patterns: <ShieldCheck className="h-4 w-4" />,
  Mobile: <Server className="h-4 w-4" />,
  'Users & History': <Globe className="h-4 w-4" />,
};

const endpointGroups: EndpointGroup[] = Object.entries(
  endpointDocs.reduce<Record<EndpointDocDefinition['group'], EndpointDefinition[]>>((accumulator, endpoint) => {
    const key = endpoint.group;
    accumulator[key] ??= [];
    accumulator[key].push(endpoint);
    return accumulator;
  }, {
    Authentication: [],
    Patterns: [],
    Mobile: [],
    'Users & History': [],
  }),
).map(([title, items]) => ({
  title,
  icon: groupIcons[title as EndpointDocDefinition['group']],
  items,
}));

const methodStyles: Record<EndpointDefinition['method'], string> = {
  GET: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  POST: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  PATCH: 'border-amber-200 bg-amber-50 text-amber-700',
  DELETE: 'border-rose-200 bg-rose-50 text-rose-700',
};

const methodAccentStyles: Record<EndpointDefinition['method'], string> = {
  GET: 'bg-emerald-500',
  POST: 'bg-cyan-500',
  PATCH: 'bg-amber-500',
  DELETE: 'bg-rose-500',
};

function buildPath(path: string, pathParams: Record<string, string>, queryParams: Record<string, string>) {
  let compiledPath = path;
  Object.entries(pathParams).forEach(([key, value]) => {
    compiledPath = compiledPath.replace(`:${key}`, encodeURIComponent(value));
  });

  const query = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value.trim()) query.set(key, value);
  });

  const queryString = query.toString();
  return queryString ? `${compiledPath}?${queryString}` : compiledPath;
}

function isJsonLike(value: string) {
  const trimmed = value.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

function renderHighlightedCode(value: string) {
  if (!isJsonLike(value)) {
    return value;
  }

  const parts = value.split(/("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\btrue\b|\bfalse\b|null)|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g);

  return parts.filter(Boolean).map((part, index) => {
    if (/^"(?:\\.|[^"\\])*"\s*:$/.test(part)) {
      return <span key={index} className="text-sky-300">{part}</span>;
    }

    if (/^"(?:\\.|[^"\\])*"$/.test(part)) {
      return <span key={index} className="text-emerald-300">{part}</span>;
    }

    if (/^(true|false|null)$/.test(part)) {
      return <span key={index} className="text-violet-300">{part}</span>;
    }

    if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(part)) {
      return <span key={index} className="text-amber-300">{part}</span>;
    }

    return <span key={index}>{part}</span>;
  });
}

function getResponseFormat(value: string) {
  if (isJsonLike(value)) return 'JSON';
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes('csv') || value.includes(',')) return 'CSV';
  return 'TEXT';
}

function buildCurlCommand(endpoint: EndpointDefinition, compiledUrl: string, body: string) {
  const parts = [`curl -X ${endpoint.method}`, `"${compiledUrl}"`];

  if (endpoint.method !== 'GET' && body.trim()) {
    parts.push('-H "Content-Type: application/json"');
    parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
  }

  return parts.join(' ');
}

function EndpointCard({
  endpoint,
  draft,
  onDraftChange,
}: {
  endpoint: EndpointDefinition;
  draft: EndpointDraftState;
  onDraftChange: (next: EndpointDraftState) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const {pathParams, queryParams, body, response, status} = draft;

  const compiledUrl = useMemo(() => buildPath(endpoint.path, pathParams, queryParams), [endpoint.path, pathParams, queryParams]);
  const curlCommand = useMemo(() => buildCurlCommand(endpoint, compiledUrl, body), [body, compiledUrl, endpoint]);
  const responseFormat = useMemo(() => getResponseFormat(response), [response]);

  function updateDraft(partial: Partial<EndpointDraftState>) {
    onDraftChange({...draft, ...partial});
  }

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1800);
    } catch {
      setCopiedKey(null);
    }
  }

  function downloadText(filename: string, value: string, mimeType: string) {
    const blob = new Blob([value], {type: mimeType});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const serializedPathParams = useMemo(() => JSON.stringify(pathParams, null, 2), [pathParams]);
  const serializedQueryParams = useMemo(() => JSON.stringify(queryParams, null, 2), [queryParams]);

  async function runRequest() {
    setLoading(true);
    updateDraft({status: 'Running...'});

    try {
      const init: RequestInit = {
        method: endpoint.method,
        headers: {},
        credentials: 'include',
      };

      if (endpoint.method !== 'GET' && body.trim()) {
        (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
        init.body = body;
      }

      const result = await fetch(compiledUrl, init);
      const contentType = result.headers.get('content-type') ?? '';
      let payload = '';

      if (contentType.includes('application/json')) {
        const json = await result.json();
        payload = JSON.stringify(json, null, 2);
      } else if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
        payload = await result.text();
      } else {
        payload = `[${contentType || 'unknown content-type'}] Response tidak ditampilkan sebagai JSON/text.`;
      }

      updateDraft({status: `${result.status} ${result.statusText}`, response: payload});
    } catch (error) {
      updateDraft({status: 'Request failed', response: error instanceof Error ? error.message : 'Unknown error'});
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="group border-t border-slate-200 first:border-t-0" open>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 lg:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${methodStyles[endpoint.method]}`}>
              {endpoint.method}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {endpoint.access}
            </span>
          </div>
          <div className="mt-3 break-all font-mono text-[13px] font-bold text-slate-900">{endpoint.path}</div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{endpoint.summary}</p>
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 lg:px-5">
        <p className="text-sm leading-6 text-slate-600">{endpoint.description}</p>

        <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            {endpoint.pathParams && Object.keys(endpoint.pathParams).length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Path Params</div>
                  <button
                    type="button"
                    onClick={() => copyText('path-params', serializedPathParams)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    {copiedKey === 'path-params' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === 'path-params' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {Object.entries(pathParams).map(([key, value]) => (
                    <label key={key} className="block">
                      <div className="mb-1 text-xs font-semibold text-slate-500">{key}</div>
                      <input
                        value={value}
                        onChange={(event) => updateDraft({pathParams: {...pathParams, [key]: event.target.value}})}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {endpoint.queryExample && Object.keys(endpoint.queryExample).length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Query Params</div>
                  <button
                    type="button"
                    onClick={() => copyText('query-params', serializedQueryParams)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    {copiedKey === 'query-params' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === 'query-params' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {Object.entries(queryParams).map(([key, value]) => (
                    <label key={key} className="block">
                      <div className="mb-1 text-xs font-semibold text-slate-500">{key}</div>
                      <input
                        value={value}
                        onChange={(event) => updateDraft({queryParams: {...queryParams, [key]: event.target.value}})}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {endpoint.method !== 'GET' ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Request Body</div>
                  <button
                    type="button"
                    onClick={() => copyText('request-body', body)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    {copiedKey === 'request-body' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === 'request-body' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <textarea
                  value={body}
                  onChange={(event) => updateDraft({body: event.target.value})}
                  className="docs-code-block mt-3 min-h-[220px] w-full rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-6 text-cyan-50 outline-none transition focus:border-cyan-300"
                  spellCheck={false}
                />
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Request Preview</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyText('request-preview', `${endpoint.method} ${compiledUrl}`)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    {copiedKey === 'request-preview' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === 'request-preview' ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText('request-curl', curlCommand)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    {copiedKey === 'request-curl' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === 'request-curl' ? 'Copied' : 'Copy cURL'}
                  </button>
                </div>
              </div>
              <pre className="docs-code-block mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-950/95 p-3 font-mono text-xs leading-6 text-slate-100">
                <code>{endpoint.method} {compiledUrl}</code>
              </pre>
              <pre className="docs-code-block mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-950/95 p-3 font-mono text-xs leading-6 text-slate-100">
                <code>{curlCommand}</code>
              </pre>
              <button
                type="button"
                onClick={runRequest}
                disabled={loading}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Play className="h-4 w-4" />
                {loading ? 'Running...' : 'Run Endpoint'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Example Response</div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Mock</div>
                  <button
                    type="button"
                    onClick={() => copyText('example-response', endpoint.responseExample)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    {copiedKey === 'example-response' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === 'example-response' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <pre className="docs-code-block docs-scrollbar mt-3 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 font-mono text-xs leading-6 text-emerald-100">
                <code>{renderHighlightedCode(endpoint.responseExample)}</code>
              </pre>
            </div>

            {endpoint.responseContract ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Flutter Response Contract</div>
                  <button
                    type="button"
                    onClick={() => copyText('response-contract', endpoint.responseContract ?? '')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    {copiedKey === 'response-contract' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === 'response-contract' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="docs-code-block docs-scrollbar mt-3 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 font-mono text-xs leading-6 text-cyan-100">
                  <code>{renderHighlightedCode(endpoint.responseContract)}</code>
                </pre>
              </div>
            ) : null}

            {endpoint.errorExamples?.length ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Example Errors</div>
                  <div className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-600">
                    {endpoint.errorExamples.length} Cases
                  </div>
                </div>
                <div className="mt-3 space-y-4">
                  {endpoint.errorExamples.map((example, index) => (
                    <div key={`${example.title}-${index}`} className="rounded-xl border border-rose-100 bg-rose-50/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-bold text-rose-700">{example.title}</div>
                        <button
                          type="button"
                          onClick={() => copyText(`example-error-${index}`, example.response)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                        >
                          {copiedKey === `example-error-${index}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedKey === `example-error-${index}` ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="docs-code-block docs-scrollbar mt-3 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 font-mono text-xs leading-6 text-rose-100">
                        <code>{renderHighlightedCode(example.response)}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Live Response</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Menampilkan response aktual dari endpoint yang dijalankan.</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700">
                    {responseFormat}
                  </div>
                  <div className="max-w-full whitespace-normal break-words rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {status}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => copyText('live-response', response)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                >
                  {copiedKey === 'live-response' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedKey === 'live-response' ? 'Copied' : 'Copy response'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadText(isJsonLike(response) ? 'live-response.json' : 'live-response.txt', response, isJsonLike(response) ? 'application/json' : 'text/plain;charset=utf-8')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
              <pre className="docs-code-block docs-scrollbar mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 font-mono text-xs leading-6 text-cyan-50">
                <code>{renderHighlightedCode(response)}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}

export function ApiDocsWorkspace() {
  const [search, setSearch] = useState('');
  const [selectedEndpointId, setSelectedEndpointId] = useState(endpointGroups[0]?.items[0]?.id ?? '');
  const [endpointDrafts, setEndpointDrafts] = useState<Record<string, EndpointDraftState>>({});
  const totalEndpoints = endpointGroups.reduce((sum, group) => sum + group.items.length, 0);

  useEffect(() => {
    setEndpointDrafts((current) => {
      const next = {...current};

      for (const endpoint of endpointDocs) {
        next[endpoint.id] ??= {
          pathParams: endpoint.pathParams ?? {},
          queryParams: endpoint.queryExample ?? {},
          body: endpoint.requestExample ?? '',
          response: 'Belum ada response. Jalankan endpoint untuk melihat hasilnya.',
          status: 'Idle',
        };
      }

      return next;
    });
  }, []);

  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return endpointGroups;

    return endpointGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const haystack = [item.path, item.summary, item.description, item.method, item.access].join(' ').toLowerCase();
          return haystack.includes(keyword);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [search]);

  const selectedEndpoint = useMemo(() => {
    const fromFiltered = filteredGroups.flatMap((group) => group.items).find((item) => item.id === selectedEndpointId);
    if (fromFiltered) return fromFiltered;
    return filteredGroups[0]?.items[0] ?? null;
  }, [filteredGroups, selectedEndpointId]);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
      <div className="border-b border-slate-200/80 px-6 py-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">
              <BookOpenText className="h-4 w-4" />
              API Docs Workspace
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] text-slate-950">Dokumentasi API interaktif gaya panel modern</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
              Saya sesuaikan dengan referensi gambar: ada sidebar endpoint, area detail fokus, contoh request/response, dan tombol uji langsung dari halaman.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0891b2_0%,#06b6d4_45%,#155e75_100%)] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(8,145,178,0.22)] transition hover:scale-[1.01]"
          >
            Coba Langsung
          </button>
        </div>
      </div>

      <div className="px-6 py-6 lg:px-8">
        <div className="grid gap-3 md:grid-cols-3">
        {[
          {label: 'Endpoint Groups', value: endpointGroups.length, helper: 'Kategori dokumentasi utama', icon: <BookOpenText className="h-4 w-4" />, tone: 'border-cyan-100 bg-cyan-50 text-cyan-700'},
          {label: 'Total Endpoints', value: totalEndpoints, helper: 'Endpoint yang siap diuji', icon: <Server className="h-4 w-4" />, tone: 'border-slate-200 bg-slate-100 text-slate-700'},
          {label: 'Playground', value: 'Live', helper: 'Bisa langsung menjalankan request', icon: <ShieldCheck className="h-4 w-4" />, tone: 'border-emerald-100 bg-emerald-50 text-emerald-700'},
        ].map((item) => (
          <div key={item.label} className="rounded-[1.35rem] border border-slate-200/90 bg-white/88 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.035)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{item.label}</div>
              <div className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border ${item.tone}`}>{item.icon}</div>
            </div>
            <div className="mt-3 text-[1.62rem] font-black tracking-[-0.05em] text-slate-950">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.helper}</div>
          </div>
        ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-6 xl:self-start rounded-[1.6rem] border border-slate-200/90 bg-white/92 shadow-[0_14px_36px_rgba(15,23,42,0.035)] backdrop-blur-sm">
            <div className="border-b border-slate-200/80 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-black tracking-[-0.05em] text-slate-950">Dokumen API</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Versi 1.0.0</div>
                </div>
                <div className="inline-flex rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700">
                  {totalEndpoints} Endpoint
                </div>
              </div>

              <label className="relative mt-4 block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Saring endpoint..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white"
                />
              </label>
            </div>

            <div className="docs-scrollbar max-h-[calc(100vh-12rem)] overflow-y-auto px-3 py-3">
              <div className="space-y-4">
                {filteredGroups.map((group) => (
                  <section key={group.title}>
                    <div className="px-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">{group.title}</div>
                    <div className="mt-2 space-y-1.5">
                      {group.items.map((item) => {
                        const active = selectedEndpoint?.id === item.id;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedEndpointId(item.id)}
                            className={`flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition duration-150 ${
                              active
                                ? 'border-cyan-200/90 bg-cyan-50/80 shadow-[0_8px_18px_rgba(6,182,212,0.08)]'
                                : 'border-transparent bg-transparent hover:border-slate-200/90 hover:bg-slate-50/90'
                            }`}
                          >
                            <span className={`mt-0.5 inline-flex min-w-[42px] justify-center rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${methodStyles[item.method]}`}>
                              {item.method}
                            </span>
                            <span className={`mt-[0.55rem] h-2 w-2 shrink-0 rounded-full ${methodAccentStyles[item.method]}`} />
                            <div className="min-w-0 flex-1">
                              <div className={`text-[13px] font-semibold leading-4 ${active ? 'text-cyan-800' : 'text-slate-700'}`}>
                                {item.summary}
                              </div>
                              <div className="mt-1 break-all font-mono text-[11px] leading-4 text-slate-400">{item.path}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}

                {filteredGroups.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    Endpoint tidak ditemukan untuk kata kunci tersebut.
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            {selectedEndpoint ? (
              <div className="rounded-[1.6rem] border border-slate-200/90 bg-white/95 shadow-[0_14px_36px_rgba(15,23,42,0.035)] backdrop-blur-sm">
                <div className="border-b border-slate-200 px-5 py-5 lg:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`inline-flex rounded-xl border px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] ${methodStyles[selectedEndpoint.method]}`}>
                          {selectedEndpoint.method}
                        </span>
                        <div className="font-mono text-lg font-bold text-slate-900">{selectedEndpoint.path}</div>
                      </div>
                      <h2 className="mt-4 text-[2rem] font-black tracking-[-0.05em] text-slate-950 lg:text-[2.35rem]">{selectedEndpoint.summary}</h2>
                      <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-500">{selectedEndpoint.description}</p>
                    </div>

                    <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(6,182,212,0.10),rgba(14,165,233,0.05))] px-4 py-3 text-right">
                      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Akses</div>
                      <div className="mt-1 text-sm font-semibold text-slate-700">{selectedEndpoint.access}</div>
                    </div>
                  </div>
                </div>

                <div className="px-1 py-1">
                  <EndpointCard
                    endpoint={selectedEndpoint}
                    draft={endpointDrafts[selectedEndpoint.id] ?? {
                      pathParams: selectedEndpoint.pathParams ?? {},
                      queryParams: selectedEndpoint.queryExample ?? {},
                      body: selectedEndpoint.requestExample ?? '',
                      response: 'Belum ada response. Jalankan endpoint untuk melihat hasilnya.',
                      status: 'Idle',
                    }}
                    onDraftChange={(next) => setEndpointDrafts((current) => ({...current, [selectedEndpoint.id]: next}))}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}