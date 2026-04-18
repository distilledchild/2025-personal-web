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

const formatLeadAuthor = (authors: string[]) => {
  if (!authors.length) return 'Unknown';
  if (authors.length === 1) return authors[0];
  return `${authors[0]} et al.`;
};

const formatCount = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return 'NA';
  return value.toLocaleString();
};

const PublicationCell: React.FC<{ paper: PaperFinderPaper }> = ({ paper }) => {
  const abstractText = paper.abstract || paper.tldr || '';

  return (
    <div className="group relative space-y-2" tabIndex={0}>
      <p className="font-bold leading-snug text-slate-950">{paper.title}</p>
      {abstractText && (
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
          {abstractText}
        </p>
      )}

      {abstractText && (
        <div className="pointer-events-none invisible absolute left-0 top-full z-30 mt-3 w-[min(680px,calc(100vw-4rem))] rounded-lg border border-teal-200 bg-white p-5 text-left opacity-0 shadow-xl transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100">
          <p className="mb-3 text-sm font-bold leading-snug text-slate-950">{paper.title}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Abstract</p>
          <p className="mt-2 max-h-72 overflow-y-auto pr-2 text-sm leading-relaxed text-slate-600 scrollbar-hide">
            {abstractText}
          </p>
        </div>
      )}
    </div>
  );
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
      headerClassName: 'w-[34%]',
      className: 'align-top',
      render: (paper) => <PublicationCell paper={paper} />,
    },
    {
      key: 'authors',
      header: 'Authors',
      headerClassName: 'w-[12%]',
      className: 'align-top font-medium text-slate-700',
      render: (paper) => formatLeadAuthor(paper.authors),
    },
    {
      key: 'score',
      header: 'Score',
      headerClassName: 'w-[7%]',
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
      headerClassName: 'w-[14%]',
      className: 'align-top font-semibold text-slate-700',
      render: (paper) => paper.journal || 'Unknown journal',
    },
    {
      key: 'year',
      header: 'Year',
      headerClassName: 'w-[8%]',
      className: 'align-top font-bold text-slate-800',
      render: (paper) => paper.pubDate || paper.year || 'NA',
    },
    {
      key: 'citations',
      header: 'Citations',
      headerClassName: 'w-[8%]',
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
      headerClassName: 'w-[8%]',
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
      headerClassName: 'w-[9%]',
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
            <div className="text-sm leading-relaxed text-slate-700">
              <p className="font-semibold text-slate-800">
                Score = 0.45(PubMed relevance) + 0.25(log citations) + 0.20(log influential citations) + 0.10(recency)
              </p>
              <p className="text-xs text-slate-600">
                PubMed finds candidate PMIDs; Semantic Scholar adds citation signals before sorting.
              </p>
            </div>
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
          tableClassName="min-w-[1280px] w-full table-fixed"
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
