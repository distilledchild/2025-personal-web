import React from 'react';
import { ExternalLink, Loader2, Search } from 'lucide-react';
import { API_URL } from '../utils/apiConfig';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { Pagination } from '../components/Pagination';

interface PaperFinderPaper {
  pmid: string;
  title: string;
  journal: string;
  pubDate: string;
  year: number | null;
  authors: string[];
  doi: string;
  pubMedUrl: string;
  semanticScholarUrl?: string;
  citationCount: number | null;
  influentialCitationCount: number | null;
  referenceCount: number | null;
  score: number | null;
  fieldsOfStudy: string[];
  abstract?: string;
  tldr?: string;
  openAccessPdfUrl?: string;
}

interface PaperFinderResponse {
  query: string;
  count: number;
  totalAvailable: number;
  papers: PaperFinderPaper[];
  enrichmentWarning?: string;
}

const formatAuthors = (authors: string[]) => {
  if (!authors.length) return 'Unknown authors';
  if (authors.length <= 3) return authors.join(', ');
  return `${authors.slice(0, 3).join(', ')} et al.`;
};

const formatCount = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return 'NA';
  return value.toLocaleString();
};

const itemsPerPage = 5;

export const ResearchPaperFinder: React.FC = () => {
  const [query, setQuery] = React.useState('');
  const [papers, setPapers] = React.useState<PaperFinderPaper[]>([]);
  const [totalAvailable, setTotalAvailable] = React.useState(0);
  const [submittedQuery, setSubmittedQuery] = React.useState('');
  const [warning, setWarning] = React.useState('');
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);

  const searchPapers = React.useCallback(async (nextQuery?: string) => {
    const trimmedQuery = (nextQuery ?? query).trim();

    if (trimmedQuery.length < 2) {
      setError('Enter at least two characters.');
      setPapers([]);
      setSubmittedQuery('');
      setWarning('');
      return;
    }

    const params = new URLSearchParams({
      query: trimmedQuery,
      limit: '25',
    });

    setIsLoading(true);
    setError('');
    setWarning('');

    try {
      const response = await fetch(`${API_URL}/api/research/paperfinder?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Search failed.');
      }

      const data = payload as PaperFinderResponse;
      setPapers(data.papers || []);
      setTotalAvailable(data.totalAvailable || 0);
      setSubmittedQuery(data.query || trimmedQuery);
      setWarning(data.enrichmentWarning || '');
      setCurrentPage(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed.';
      setError(message);
      setPapers([]);
      setSubmittedQuery(trimmedQuery);
      setCurrentPage(1);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    searchPapers();
  };

  const totalPages = Math.max(1, Math.ceil(papers.length / itemsPerPage));
  const currentPapers = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return papers.slice(startIndex, startIndex + itemsPerPage);
  }, [currentPage, papers]);

  const columns = React.useMemo<DataTableColumn<PaperFinderPaper>[]>(() => [
    {
      key: 'publication',
      header: 'Publication',
      headerClassName: 'w-[38%]',
      className: 'align-top',
      render: (paper) => (
        <div className="space-y-2">
          <p className="font-bold leading-snug text-slate-950">{paper.title}</p>
          <p className="text-xs leading-relaxed text-slate-600">{formatAuthors(paper.authors)}</p>
          {(paper.tldr || paper.abstract) && (
            <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
              {paper.tldr || paper.abstract}
            </p>
          )}
          {paper.fieldsOfStudy.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {paper.fieldsOfStudy.slice(0, 3).map((field) => (
                <span key={field} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                  {field}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      headerClassName: 'w-[8%]',
      className: 'align-top',
      render: (paper) => (
        <span className="rounded-md bg-teal-500 px-2 py-1 font-bold text-white">
          {paper.score === null ? 'NA' : paper.score.toFixed(1)}
        </span>
      ),
    },
    {
      key: 'journal',
      header: 'Journal',
      headerClassName: 'w-[16%]',
      className: 'align-top',
      render: (paper) => (
        <>
          <span className="font-semibold text-slate-700">{paper.journal || 'Unknown journal'}</span>
          {paper.pubDate && <span className="mt-1 block text-xs text-slate-500">{paper.pubDate}</span>}
        </>
      ),
    },
    {
      key: 'year',
      header: 'Year',
      headerClassName: 'w-[8%]',
      className: 'align-top font-bold text-slate-800',
      render: (paper) => paper.year || 'NA',
    },
    {
      key: 'citations',
      header: 'Citations',
      headerClassName: 'w-[9%]',
      className: 'align-top',
      render: (paper) => (
        <span className="rounded-md bg-teal-100 px-2 py-1 font-bold text-teal-900">
          {formatCount(paper.citationCount)}
        </span>
      ),
    },
    {
      key: 'influential',
      header: 'Influential',
      headerClassName: 'w-[9%]',
      className: 'align-top',
      render: (paper) => (
        <span className="rounded-md bg-teal-100 px-2 py-1 font-bold text-teal-900">
          {formatCount(paper.influentialCitationCount)}
        </span>
      ),
    },
    {
      key: 'links',
      header: 'Links',
      headerClassName: 'w-[14%]',
      className: 'align-top',
      render: (paper) => (
        <div className="flex flex-col gap-2">
          <a
            href={paper.pubMedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-bold text-teal-600 hover:text-teal-700"
          >
            PubMed <ExternalLink className="h-3 w-3" />
          </a>
          {paper.doi && (
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-slate-950"
            >
              DOI <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {paper.semanticScholarUrl && (
            <a
              href={paper.semanticScholarUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-slate-950"
            >
              Semantic Scholar <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {paper.openAccessPdfUrl && (
            <a
              href={paper.openAccessPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-slate-950"
            >
              PDF <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ),
    },
  ], []);

  return (
    <div className="animate-fadeIn space-y-8">
      <section className="border border-teal-200 bg-teal-50 p-6 rounded-lg">
        <div className="max-w-4xl space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-bold uppercase tracking-wide text-teal-700">PaperFinder</p>
            <h3 className="text-3xl font-bold text-slate-950">Find publications from PubMed with citation context.</h3>
            <p className="text-sm leading-relaxed text-slate-700">
              Search terms are sent to PubMed first, where candidate PMIDs are retrieved by relevance. The server then enriches those papers through Semantic Scholar and sorts them by a weighted score: 45% PubMed relevance rank, 25% citation count, 20% influential citation count, and 10% publication recency. Citation signals use log scaling so one highly cited review does not flatten the rest of the list.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="paperfinder-query">Search publications</label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-500" />
              <input
                id="paperfinder-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="shadow enhancer"
                className="h-12 w-full rounded-lg border border-teal-200 bg-white pl-11 pr-4 text-base font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-teal-500 px-5 text-sm font-bold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-teal-300"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </form>

        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {warning}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h4 className="text-xl font-bold text-slate-950">Publications</h4>
            <p className="text-sm text-slate-600">
              {submittedQuery
                ? `${papers.length} shown from ${totalAvailable.toLocaleString()} PubMed matches for "${submittedQuery}".`
                : 'Search a topic to start.'}
            </p>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={isLoading ? [] : currentPapers}
          getRowKey={(paper) => paper.pmid}
          theme="teal"
          minRows={itemsPerPage}
          tableClassName="min-w-[1180px] w-full table-fixed"
          emptyState={isLoading ? (
            <span className="inline-flex items-center gap-2 font-semibold">
              <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
              Searching PubMed and Semantic Scholar...
            </span>
          ) : submittedQuery ? 'No publications found.' : 'Results will appear here.'}
        />

        {papers.length > itemsPerPage && (
          <div className="mt-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              theme="teal"
            />
          </div>
        )}
      </section>
    </div>
  );
};
