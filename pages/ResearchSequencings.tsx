import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Database,
  Dna,
  Expand,
  FileSearch,
  FlaskConical,
  GitCompareArrows,
  Info,
  Layers3,
  Microscope,
  ScanLine,
  ShieldCheck,
  Target,
  Workflow,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type SequencingView = 'singlecellseq' | 'atacseq';

interface ResearchSequencingsProps {
  activeView: SequencingView;
}

interface AnalysisFigure {
  src: string;
  title: string;
  caption: string;
  interpretation: string;
  caveat?: string;
  alt: string;
}

const singleCellQCMetrics = [
  { label: 'Called Barcodes', value: '1,903', note: 'Transcript cutoff: 341' },
  { label: 'Median Genes / Barcode', value: '560', note: '18,925 genes detected across called barcodes' },
  { label: 'Median Transcripts / Barcode', value: '770', note: '3,387,014 total transcripts' },
  { label: 'Mean Reads / Barcode', value: '3,648', note: '6,941,686 reads in the report' },
  { label: 'Transcriptome Mapping', value: '64.13%', note: 'rn7-mod1-mclover3 reference' },
  { label: 'Reads in Called Barcodes', value: '55.67%', note: '55.57% of transcripts in called barcodes' },
  { label: 'Sequencing Saturation', value: '0.89%', note: 'Library remains shallow' },
  { label: 'Base Quality', value: '94.9-97.9%', note: 'Q30 across cDNA, polyN, and barcodes' },
];

const clusterDistribution = [
  { cluster: 'C1', cells: 561 },
  { cluster: 'C2', cells: 332 },
  { cluster: 'C3', cells: 240 },
  { cluster: 'C4', cells: 197 },
  { cluster: 'C5', cells: 170 },
  { cluster: 'C6', cells: 159 },
  { cluster: 'C7', cells: 139 },
  { cluster: 'C8', cells: 105 },
];

const seuratClusterDistribution = [
  { cluster: 'C1', cells: 158 },
  { cluster: 'C2', cells: 90 },
  { cluster: 'C3', cells: 136 },
  { cluster: 'C4', cells: 112 },
  { cluster: 'C5', cells: 340 },
  { cluster: 'C6', cells: 568 },
  { cluster: 'C7', cells: 214 },
  { cluster: 'C8', cells: 172 },
];

const seuratMarkerFindings = [
  {
    cluster: 'Cluster 1',
    evidence: 'ST18, BCAS1, QKI, MBP, PLP1',
    interpretation:
      'A coherent oligodendroglial program is present. BCAS1 and the close oligodendrocyte/OPC panel scores make a broad lineage label safer than a mature-state claim.',
  },
  {
    cluster: 'Cluster 2',
    evidence: 'MAF, SOX6, ERBB4, NXPH1',
    interpretation:
      'These genes support an inhibitory-neuron program, but the shallow library does not justify a fine interneuron subtype label.',
  },
  {
    cluster: 'Cluster 4',
    evidence: 'FOXP2, ERBB4, PBX3, MEIS2',
    interpretation:
      'The combination supports a second inhibitory or subcortical-like neuronal state. FOXP2 alone is not used to assign an excitatory identity.',
  },
  {
    cluster: 'Cluster 7',
    evidence: 'SATB2, TAFA1, DPP10, ARPP21, MEF2C',
    interpretation:
      'SATB2 and the broader neuronal program support a candidate excitatory cortical-projection population.',
  },
  {
    cluster: 'Clusters 3, 5, 6, 8',
    evidence: 'Distinct neuronal marker combinations',
    interpretation:
      'They remain deliberately unresolved because available markers do not support a unique broad lineage or subtype without contradictory evidence.',
  },
];

const round1WellDistribution = [
  { well: 'D10', cells: 697, medianTranscripts: 899 },
  { well: 'D11', cells: 600, medianTranscripts: 697 },
  { well: 'D12', cells: 606, medianTranscripts: 754 },
];

const markerPanels = [
  {
    label: 'Excitatory cortical neurons',
    genes: 'SATB2, LRRC7, GRIN2B, TLE4',
    purpose: 'A proposed panel for testing broad glutamatergic, corticothalamic, and near-projecting identities.',
  },
  {
    label: 'Inhibitory interneurons',
    genes: 'GAD1, GAD2, SST, VIP, LAMP5, SNCG',
    purpose: 'A proposed panel for testing GABAergic populations and candidate interneuron subclasses.',
  },
  {
    label: 'Microglia / CNS macrophages',
    genes: 'AIF1, CX3CR1, P2RY12, CSF1R',
    purpose: 'A proposed panel for testing resident immune identities in the PFC preparation.',
  },
  {
    label: 'Vascular endothelium',
    genes: 'CLDN5, FLT1, PECAM1, VWF',
    purpose: 'A proposed panel for testing vascular-associated identities.',
  },
  {
    label: 'Dopamine-response axis',
    genes: 'DRD1, DRD2, PDE4B',
    purpose: 'An exploratory panel for receptor-related expression relevant to PFC signaling.',
  },
];

const singleNucleusGlossary = [
  {
    term: 'Combinatorial barcode',
    definition: 'A sequence assembled across multiple rounds so transcripts can be assigned back to one captured nucleus.',
  },
  {
    term: 'Called barcode',
    definition: 'A barcode that passes the transcript threshold and is treated as a nucleus-like observation for analysis.',
  },
  {
    term: 'Sequencing saturation',
    definition: 'The fraction of additional reads expected to duplicate molecules already seen; low saturation means more sequencing can still discover molecules.',
  },
  {
    term: 'Highly variable gene',
    definition: 'A gene whose cell-to-cell variation exceeds its average technical trend and is therefore informative for dimensional reduction.',
  },
  {
    term: 'UMAP',
    definition: 'A two-dimensional visualization of local transcriptomic similarity; distance is descriptive and is not proof of a cell type.',
  },
  {
    term: 'Leiden cluster',
    definition: 'A graph-based neighborhood found without cell-type labels. Biological identity must be established separately with marker evidence.',
  },
];

const singleCellSaturation = [
  { reads: 0, transcripts: 0, genes: 0 },
  { reads: 1000, transcripts: 213, genes: 187 },
  { reads: 2000, transcripts: 426, genes: 340 },
  { reads: 3000, transcripts: 633, genes: 476 },
  { reads: 3648, transcripts: 770, genes: 560 },
];

const singleCellImageRoot = '/research/sequencings/singlecellseq';
const singleCellFigureVersion = '20260717-seurat-reanalysis';

const singleCellFigures = {
  qc: {
    src: `${singleCellImageRoot}/seurat_qc_after.png?v=${singleCellFigureVersion}`,
    title: 'QC distributions after reproducible Seurat filtering',
    caption:
      'The rerun imported 1,838 barcodes with at least 300 detected features, then retained 1,790 after applying nFeature_RNA < 2,000, nCount_RNA < 3,000, and mitochondrial percentage < 3.',
    interpretation:
      'The upper-bound filters removed 48 barcodes and retained 97.4% of the minimum-feature population. The post-QC medians are 562 detected features, 773 counts, and 0.34% mitochondrial signal.',
    caveat:
      'These thresholds reproduce the archived script rather than an independently optimized QC model. Doublet and ambient-RNA filtering were not applied.',
    alt: 'Violin plots of detected genes, RNA counts, and mitochondrial percentage for 1,790 post-QC barcodes.',
  },
  umap: {
    src: `${singleCellImageRoot}/scanpy_umap_clusters.svg?v=${singleCellFigureVersion}`,
    title: 'Transcriptomic structure resolved by Scanpy',
    caption:
      'UMAP coordinates and Leiden labels were reconstructed directly from the split-pipe report for all 1,903 called barcodes.',
    interpretation:
      'The embedding resolves eight neighborhoods with unequal abundance. Cluster 1 contains 561 cells, while cluster 8 contains 105, showing a dominant population alongside several smaller transcriptional states.',
    caveat:
      'UMAP separation is descriptive and does not by itself establish biological cell types. Cell-type names require validated marker evidence, and this run contains only one archived combined sample label.',
    alt: 'UMAP projection of 1,903 rat prefrontal cortex called barcodes colored by eight Leiden clusters.',
  },
  resolution: {
    src: `${singleCellImageRoot}/seurat_resolution_diagnostics.png?v=${singleCellFigureVersion}`,
    title: 'Resolution sensitivity and cluster-size diagnostics',
    caption:
      'Seven Seurat resolutions were compared using cluster count, minimum cluster size, PCA-space silhouette, and barcode-level agreement with the archived Scanpy partition.',
    interpretation:
      'Resolution 0.6 has the highest Scanpy agreement (ARI 0.589) while retaining at least 90 barcodes per cluster. Resolution 1.5 drops to ARI 0.425 and creates a two-barcode outlier cluster.',
    caveat:
      'Agreement with Scanpy is a reproducibility diagnostic, not proof that eight biological cell types exist. Both methods operate on the same shallow, single-sample dataset.',
    alt: 'Line charts comparing Seurat resolution with Scanpy agreement and minimum cluster size.',
  },
  primaryUmap: {
    src: `${singleCellImageRoot}/seurat_primary_resolution_0_6_umap.png?v=${singleCellFigureVersion}`,
    title: 'Conservative Seurat partition',
    caption:
      'The primary report uses resolution 0.6, which yields eight tree-ordered clusters across all 1,790 post-QC barcodes.',
    interpretation:
      'This partition avoids singleton-like groups while retaining the major separated and connected transcriptomic neighborhoods visible in the embedding.',
    caveat:
      'The cluster numbers are Seurat-specific and cannot be equated directly with identically numbered Scanpy clusters.',
    alt: 'Seurat UMAP of 1,790 post-QC barcodes colored by eight conservative clusters.',
  },
  legacyUmap: {
    src: `${singleCellImageRoot}/seurat_legacy_resolution_1_5_umap.png?v=${singleCellFigureVersion}`,
    title: 'Legacy resolution-1.5 sensitivity result',
    caption:
      'The archived script targeted resolution 1.5 and referred to 14 identities. The reproducible rerun under Seurat 5.5.0 produces 12 clusters instead.',
    interpretation:
      'The two-barcode cluster and lower agreement with Scanpy indicate that this higher-resolution partition is likely over-splitting at least one sparse edge of the graph.',
    caveat:
      'A 14-cluster result was not forced. Software versions, graph construction, and stochastic details can change graph partitions.',
    alt: 'Seurat UMAP at legacy resolution 1.5 showing 12 observed clusters.',
  },
  technicalWells: {
    src: `${singleCellImageRoot}/seurat_technical_wells_umap.png?v=${singleCellFigureVersion}`,
    title: 'Technical-well mixing across the Seurat embedding',
    caption:
      'The same UMAP is colored by Parse round-1 wells D10, D11, and D12 rather than by cluster.',
    interpretation:
      'All three well colors appear throughout the major neighborhoods. The resolution-0.6 cluster/well association is small (Cramer’s V 0.091), although not exactly zero.',
    caveat:
      'Well mixing is only a technical diagnostic. D10-D12 are not independent animals and cannot support biological inference.',
    alt: 'Seurat UMAP colored by technical wells D10, D11, and D12.',
  },
  markers: {
    src: `${singleCellImageRoot}/seurat_marker_dotplot.png?v=${singleCellFigureVersion}`,
    title: 'Canonical marker evidence across conservative Seurat clusters',
    caption:
      'Dot size represents the fraction of barcodes expressing each marker, and color represents scaled average expression within each cluster.',
    interpretation:
      'Cluster 1 has an oligodendroglial program, clusters 2 and 4 show inhibitory-neuron evidence, and cluster 7 shows candidate excitatory cortical evidence. Other groups remain unresolved.',
    caveat:
      'Only panels with at least two retained genes are scored. Labels remain provisional because depth is low and no reference mapping or doublet model was validated.',
    alt: 'Dot plot of canonical neuronal and glial marker genes across eight Seurat clusters.',
  },
  crosswalk: {
    src: `${singleCellImageRoot}/seurat_scanpy_crosswalk.png?v=${singleCellFigureVersion}`,
    title: 'Barcode-level Seurat and Scanpy crosswalk',
    caption:
      'All 1,790 post-QC Seurat barcodes were joined to archived Scanpy assignments using their shared barcode identifiers.',
    interpretation:
      'The diagonal and split blocks show partial but not exact agreement. ARI 0.589 means the two pipelines recover related structure while partitioning several neighborhoods differently.',
    caveat:
      'This comparison validates reproducible barcode matching; it does not make cluster numbers or biological labels interchangeable.',
    alt: 'Heatmap crosswalking eight Seurat clusters against eight archived Scanpy Leiden clusters.',
  },
} satisfies Record<string, AnalysisFigure>;

const atacSamples = [
  { sample: 'SRR13307053', region: 'PFC', animal: 'Rat2', library: 'ATAC39', mapped: '89.9M', peaks: '104,342', frip: '0.2546', status: 'Good' },
  { sample: 'SRR13307057', region: 'Motor', animal: 'Rat2', library: 'ATAC35', mapped: '46.9M', peaks: '97,617', frip: '0.3185', status: 'Excellent FRiP' },
  { sample: 'SRR13307077', region: 'PFC', animal: 'Rat1', library: 'ATAC17', mapped: '31.1M', peaks: '56,817', frip: '0.2269', status: 'Good' },
  { sample: 'SRR13307081', region: 'Motor', animal: 'Rat1', library: 'ATAC13', mapped: '26.1M', peaks: '36,257', frip: '0.1497', status: 'Review' },
];

const atacAnnotationSummary = [
  { sample: 'SRR13307053', promoter: '10.76%', distal: '53.84%' },
  { sample: 'SRR13307057', promoter: '11.10%', distal: '54.04%' },
  { sample: 'SRR13307077', promoter: '16.20%', distal: '51.41%' },
  { sample: 'SRR13307081', promoter: '22.10%', distal: '48.75%' },
];

const atacGlossary = [
  {
    term: 'Open chromatin',
    definition: 'DNA that is sufficiently exposed for Tn5 transposase to insert sequencing adapters; it often marks active or poised regulatory regions.',
  },
  {
    term: 'Alignment',
    definition: 'One sequenced read placed on the reference genome. The reported mapped and FRiP counts in this reanalysis count BAM alignment records.',
  },
  {
    term: 'Paired fragment',
    definition: 'The DNA interval bounded by a read pair. MACS2 BAMPE uses paired alignments to infer these fragments for peak calling.',
  },
  {
    term: 'Peak',
    definition: 'A genomic interval with more ATAC-seq signal than expected background; it is evidence of accessibility, not automatically an enhancer.',
  },
  {
    term: 'FRiP',
    definition: 'Fraction of Reads in Peaks. Here it is the fraction of retained mapped alignments overlapping a sample’s called peaks.',
  },
  {
    term: 'Consensus region',
    definition: 'A shared coordinate system made by merging overlapping sample peaks so every library can be compared over the same intervals.',
  },
  {
    term: 'CPM',
    definition: 'Counts or coverage per million mapped reads, used here to place BigWig signal on a comparable library-size scale.',
  },
  {
    term: 'PCA',
    definition: 'A linear summary of the dominant axes of variation. With four samples it is exploratory, not a differential-accessibility test.',
  },
];

const atacImageRoot = '/research/sequencings/atacseq';
const atacFigureVersion = '20260716-centered-titles';

const figures = {
  mapped: {
    src: `${atacImageRoot}/Mapped_reads.png`,
    title: 'Mapped alignments',
    caption: 'Final MAPQ-filtered alignments retained after primary-alignment filtering and duplicate removal.',
    interpretation:
      'Retained signal spans 26.1M to 89.9M alignments, a 3.4-fold range. SRR13307053 provides the deepest library, whereas SRR13307081 has the smallest evidence base for peak recovery.',
    caveat:
      'These are final retained alignments, not raw input reads. The difference combines starting depth with sample-specific losses during trimming, alignment, filtering, and duplicate removal.',
    alt: 'Bar chart comparing mapped ATAC-seq alignments across four rat cortex samples.',
  },
  peaks: {
    src: `${atacImageRoot}/Peak_count.png`,
    title: 'Accessible regions called per sample',
    caption: 'MACS2 narrowPeak counts show the usable regulatory-region yield from each library.',
    interpretation:
      'Peak yield broadly follows retained depth: the two strongest libraries recover about 98K-104K peaks, while SRR13307081 recovers 36,257. This pattern indicates that library quality materially affects the apparent accessible-regulatory landscape.',
    caveat:
      'A larger peak count is not automatically better; it must be interpreted with FRiP and genomic annotation to distinguish biological signal from permissive peak calling.',
    alt: 'Bar chart comparing MACS2 ATAC-seq peak counts across four samples.',
  },
  frip: {
    src: `${atacImageRoot}/FRiP_score.png?v=${atacFigureVersion}`,
    title: 'Signal enrichment in called peaks',
    caption: 'FRiP provides a direct signal-to-noise view. Three libraries exceed 0.20; SRR13307081 is flagged at 0.1497.',
    interpretation:
      'SRR13307057 has the strongest concentration of reads in accessible regions (0.3185). Both PFC libraries exceed 0.22, whereas SRR13307081 carries visibly weaker enrichment and should receive less weight in region-level interpretation.',
    caveat:
      'FRiP thresholds are practical diagnostics rather than universal pass/fail laws. Comparisons also depend on peak caller settings, genome build, and filtering choices.',
    alt: 'FRiP score chart with good and excellent quality reference lines.',
  },
  annotation: {
    src: `${atacImageRoot}/Annotation_comparison.png?v=${atacFigureVersion}`,
    title: 'Where accessible regions occur',
    caption: 'ChIPseeker annotation compares promoter, genic, and distal-intergenic peak composition across libraries.',
    interpretation:
      'Promoter ≤1 kb peaks increase from 10.76-11.10% in the two deepest libraries to 16.20% in SRR13307077 and 22.10% in SRR13307081. Distal-intergenic peaks decrease from about 54% to 48.75%, showing a quality-associated composition gradient rather than three identical profiles.',
    caveat:
      'Feature proportions describe location, not regulatory function. A distal peak is only a candidate enhancer until linked to chromatin state, activity, or a target gene.',
    alt: 'Stacked bars showing genomic annotation categories for ATAC-seq peaks.',
  },
  tss: {
    src: `${atacImageRoot}/TSS_distance_profile.png?v=${atacFigureVersion}`,
    title: 'Accessibility around transcription start sites',
    caption: 'Peak-distance profiles summarize enrichment near TSSs while retaining distal regulatory signal.',
    interpretation:
      'All samples show a central promoter-proximal component around the TSS together with broad 10-100 kb and >100 kb tails. That balance supports recovery of both open promoters and distal regulatory elements.',
    caveat:
      'This is a distribution of called peak locations, not a base-resolution TSS enrichment score. It cannot substitute for fragment-length periodicity or aggregate insertion profiling.',
    alt: 'Distribution of ATAC-seq peaks by distance from transcription start sites.',
  },
  correlation: {
    src: `${atacImageRoot}/Sample_correlation_heatmap.png?v=${atacFigureVersion}`,
    title: 'Sample-to-sample signal correlation',
    caption: 'Spearman correlations are calculated from CPM signal over 120,562 merged consensus regions; every region retained signal in at least two samples.',
    interpretation:
      'Pairwise correlations range from 0.792 to 0.891. The strongest pair is SRR13307053-SRR13307057 despite their different region labels, so sequencing depth and library quality may be contributing alongside cortical identity.',
    caveat:
      'With two libraries per region, clustering cannot separate region effects from replicate quality or other technical differences.',
    alt: 'Heatmap of Spearman correlations between four ATAC-seq samples.',
  },
  pca: {
    src: `${atacImageRoot}/PCA_ATAC_signal.png?v=${atacFigureVersion}`,
    title: 'Global accessibility structure',
    caption: 'PCA summarizes the dominant axes of variation across consensus-peak signal; PC1 and PC2 explain 55.9% and 25.5%.',
    interpretation:
      'The first two components capture 81.4% of the observed variance, but same-region samples do not form tight replicate pairs. The spread is therefore better read as library-level heterogeneity than as clean PFC-versus-motor separation.',
    caveat:
      'Four points are insufficient for a stable biological separation claim. A replicate-aware differential accessibility analysis and stronger QC balance would be required.',
    alt: 'PCA scatter plot of PFC and motor cortex ATAC-seq samples.',
  },
} satisfies Record<string, AnalysisFigure>;

const FigureCard = ({
  figure,
  onExpand,
}: {
  figure: AnalysisFigure;
  onExpand: (figure: AnalysisFigure) => void;
}) => (
  <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <button
      type="button"
      onClick={() => onExpand(figure)}
      className="group relative block w-full overflow-hidden bg-[#f8faf9] text-left"
      aria-label={`Expand ${figure.title}`}
    >
      <img
        src={figure.src}
        alt={figure.alt}
        loading="lazy"
        className="block h-auto w-full transition-transform duration-500 group-hover:scale-[1.015]"
      />
      <span className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-slate-950/80 px-3 py-2 text-xs font-bold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
        <Expand size={14} />
        Expand
      </span>
    </button>
    <figcaption className="space-y-4 border-t border-slate-100 px-5 py-5">
      <h5 className="font-bold text-slate-900">{figure.title}</h5>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">What the figure shows</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{figure.caption}</p>
      </div>
      <div className="rounded-xl border-l-4 border-teal-500 bg-teal-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">Interpretation</p>
        <p className="mt-1 text-sm leading-relaxed text-teal-950/85">{figure.interpretation}</p>
      </div>
      {figure.caveat && (
        <div className="flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-amber-950">
          <AlertTriangle className="mt-0.5 flex-shrink-0" size={16} />
          <p className="text-xs leading-relaxed">{figure.caveat}</p>
        </div>
      )}
    </figcaption>
  </figure>
);

const FigureModal = ({
  figure,
  onClose,
}: {
  figure: AnalysisFigure | null;
  onClose: () => void;
}) => {
  if (!figure) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={figure.title}
      onClick={onClose}
    >
      <div
        className="relative max-h-[94vh] w-full max-w-7xl overflow-auto rounded-2xl bg-white p-3 shadow-2xl md:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-10 rounded-full bg-slate-950 p-2 text-white shadow-lg transition hover:bg-teal-700"
          aria-label="Close figure"
        >
          <X size={20} />
        </button>
        <img src={figure.src} alt={figure.alt} className="h-auto w-full" />
        <div className="space-y-3 px-2 pb-2 pt-4">
          <h5 className="font-bold text-slate-950">{figure.title}</h5>
          <p className="text-sm leading-relaxed text-slate-600">{figure.caption}</p>
          <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm leading-relaxed text-teal-950">
            <strong>Interpretation:</strong> {figure.interpretation}
          </div>
          {figure.caveat && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950">
              <strong>Caution:</strong> {figure.caveat}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const GlossaryGrid = ({
  items,
  accent = 'teal',
}: {
  items: Array<{ term: string; definition: string }>;
  accent?: 'cyan' | 'teal';
}) => {
  const termColor = accent === 'cyan' ? 'text-cyan-700' : 'text-teal-700';

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.term} className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className={`text-xs font-black uppercase tracking-[0.14em] ${termColor}`}>{item.term}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.definition}</p>
        </div>
      ))}
    </div>
  );
};

const SingleCellSequencing = () => {
  const [expandedFigure, setExpandedFigure] = useState<AnalysisFigure | null>(null);

  return (
    <div className="space-y-12 animate-fadeIn">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-100 bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_52%,#f0fdfa_100%)] p-7 md:p-10">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(8,145,178,0.18) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative max-w-4xl">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-cyan-700">
            <Microscope size={17} />
            Single-nucleus RNA sequencing
          </div>
          <h3 className="mt-4 text-3xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">
            Rat prefrontal cortex
            <span className="block text-cyan-700">QC and clustering pilot</span>
          </h3>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-600 md:text-lg">
            This archived SUD-PFC run uses Parse Biosciences combinatorial indexing to recover nucleus-associated
            transcriptomes from rat prefrontal cortex. This report combines the verified July 9, 2024 split-pipe and
            Scanpy archive with a completed, reproducible Seurat reanalysis of the same filtered DGE matrix.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold">
            {[
              'Parse Evercode WT',
              'Chemistry v2',
              'Wells D10-D12',
              'rn7-mod1-mclover3',
              '1 combined sample label',
              '1,903 called barcodes',
              '1,790 post-QC in Seurat',
              '8 conservative Seurat clusters',
              '12 clusters at legacy resolution 1.5',
            ].map((tag) => (
              <span key={tag} className="rounded-full border border-white/90 bg-white/80 px-3 py-1.5 text-slate-700 shadow-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Evidence key</p>
          <h4 className="mt-2 text-2xl font-bold text-slate-950">Know which statements are results and which are plans</h4>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-600">
            A sequencing report is only as strong as its provenance. This page labels evidence by whether an output
            exists in the archive, appears only as code, or still requires a replicated experiment.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2 text-emerald-800">
              <ShieldCheck size={20} />
              <h5 className="font-bold">Verified archived result</h5>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-emerald-950/80">
              split-pipe run metrics, the 1,903 × 41,802 filtered DGE matrix summary, well recovery, subsampling
              curves, Scanpy UMAP coordinates, eight Leiden labels, and cluster abundance.
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
            <div className="flex items-center gap-2 text-sky-800">
              <Workflow size={20} />
              <h5 className="font-bold">Completed reproducible reanalysis</h5>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-sky-950/80">
              Seurat QC, normalization, PCA, a seven-resolution sweep, conservative and legacy UMAPs, 1,133 positive
              marker rows, technical-well diagnostics, and a barcode-level Scanpy crosswalk are now archived.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertTriangle size={20} />
              <h5 className="font-bold">Not demonstrated here</h5>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-amber-950/85">
              Validated cell types, biological reproducibility, strain effects, treatment effects, and SUD-associated
              expression differences. These still require sample-aware replication, doublet assessment, and
              reference-supported annotation.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Project frame</p>
          <h4 className="mt-2 text-2xl font-bold text-slate-950">What this analysis is designed to establish</h4>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-600">
            The immediate goal is to test whether the PFC preparation yields usable nucleus-level profiles, describe
            transcriptomic neighborhoods, and define a defensible path toward annotation. It is a technical pilot for
            later SUD or strain comparisons, not a case-control analysis.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {[
            {
              icon: Target,
              title: 'Scientific question',
              text: 'Does the preparation yield enough high-quality nucleus-associated RNA to resolve candidate transcriptional populations for follow-up?',
            },
            {
              icon: Database,
              title: 'Archived evidence',
              text: 'One combined sample label, three technical round-1 wells, 6.94M reads, a 1,903 × 41,802 filtered count matrix, and an eight-cluster Scanpy report.',
            },
            {
              icon: FlaskConical,
              title: 'Interpretation contract',
              text: 'Separate verified processing metrics from provisional cell-type annotation and reserve SUD-specific claims for replicated experimental contrasts.',
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <Icon className="text-cyan-700" size={21} />
              <h5 className="mt-4 font-bold text-slate-950">{title}</h5>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-cyan-200 bg-cyan-50 p-6 md:p-8">
          <div className="flex items-center gap-2 text-cyan-800">
            <BookOpen size={20} />
            <h4 className="font-bold">What single-nucleus RNA-seq measures</h4>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-cyan-950/85">
            Nuclei are isolated from tissue, their RNA molecules are tagged with combinatorial barcodes, and reads are
            assigned back to those barcodes. The resulting matrix has genes as rows and called barcodes as columns.
            Each value estimates how many transcript molecules from a gene were assigned to one nucleus-like barcode.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-cyan-950/85">
            Because nuclear RNA is sparser than whole-cell RNA, depth, ambient RNA, doublets, and incomplete marker
            detection matter. Clusters summarize expression similarity; they do not arrive with biological names.
          </p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Experimental unit</p>
          <h4 className="mt-3 text-xl font-bold">Three wells are not three animals</h4>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            D10, D11, and D12 are technical barcode wells feeding one combined sample label. They help diagnose
            technical balance, but they do not provide independent biological replication. Statistical comparisons
            must be made across independently collected animals or samples, not across these wells.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Analysis architecture</p>
          <h4 className="mt-2 text-2xl font-bold text-slate-950">Two completed branches joined by barcode identity</h4>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-600">
            Both branches begin with the Parse count matrix, but they apply different filtering and clustering
            decisions. The Seurat rerun now makes a direct barcode-level comparison possible, while keeping the two
            clustering label systems separate.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Branch A</p>
                <h5 className="mt-1 text-lg font-bold text-emerald-950">Archived split-pipe + Scanpy result</h5>
              </div>
              <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white">Verified</span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ['01', 'Decode', 'Validate three barcode rounds and restrict round-1 barcodes to wells D10-D12.'],
                ['02', 'Align', 'Map reads with STAR against rn7-mod1-mclover3 and assign transcript molecules to genes.'],
                ['03', 'Call barcodes', 'Reduce 27,183 barcodes above 10 transcripts to 1,903 using a 341-transcript cutoff.'],
                ['04', 'Transform', 'Filter to 14,668 genes, normalize to 10,000, log transform, and select 3,949 variable genes.'],
                ['05', 'Explore', 'Run PCA, a 50-neighbor graph, UMAP, Leiden clustering, and rank 20 genes per cluster.'],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-3 rounded-xl bg-white/75 p-4">
                  <span className="font-black text-emerald-300">{number}</span>
                  <div>
                    <p className="text-sm font-bold text-emerald-950">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-950/70">{description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-emerald-950/75">
              <strong>Verified output:</strong> 1,903 called barcodes, eight Leiden clusters, UMAP coordinates,
              cluster assignments, and ranked genes in the split-pipe report.
            </p>
          </div>

          <div className="rounded-[2rem] border border-sky-200 bg-sky-50 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">Branch B</p>
                <h5 className="mt-1 text-lg font-bold text-sky-950">Reproducible Seurat reanalysis</h5>
              </div>
              <span className="rounded-full bg-sky-700 px-3 py-1 text-xs font-bold text-white">Completed</span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ['01', 'Import', 'Require at least 300 detected features and retain genes observed in at least five barcodes.'],
                ['02', 'QC', 'Calculate rat mitochondrial percentage and retain 1,790 barcodes after the archived upper cutoffs.'],
                ['03', 'Model', 'Log-normalize, select 2,000 variable genes, scale, run 50 PCs, and use PCs 1-30.'],
                ['04', 'Sweep', 'Compare resolutions 0.2-1.5 by cluster size, silhouette, Scanpy agreement, and technical-well association.'],
                ['05', 'Resolve', 'Use resolution 0.6 for the conservative eight-cluster report and retain resolution 1.5 as a 12-cluster sensitivity result.'],
                ['06', 'Interpret', 'Find positive markers, score multi-gene panels, and crosswalk all post-QC barcodes to Scanpy.'],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-3 rounded-xl bg-white/75 p-4">
                  <span className="font-black text-sky-300">{number}</span>
                  <div>
                    <p className="text-sm font-bold text-sky-950">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-sky-950/70">{description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-sky-950/75">
              <strong>New output:</strong> a completed Seurat object, exact QC tables, resolution diagnostics,
              1,133 positive marker rows, primary and legacy UMAPs, provisional marker evidence, and a Scanpy crosswalk.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <GitCompareArrows className="mt-0.5 flex-shrink-0" size={20} />
          <p className="text-sm leading-relaxed">
            <strong>Why the distinction matters:</strong> cluster numbers are algorithm-specific labels, not stable
            biological identifiers. Scanpy cluster 1 is not automatically Seurat cluster 1, and marker assignments
            must be joined by shared barcode IDs only after both pipelines have completed successfully.
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Run-level quality</p>
          <h4 className="mt-2 text-2xl font-bold text-slate-950">What passed, and where depth remains limiting</h4>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {singleCellQCMetrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{metric.value}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{metric.note}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 size={19} />
              <h5 className="font-bold">Strong base-call quality</h5>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-emerald-950/80">
              Barcode Q30 values range from 95.10% to 97.50%, cDNA Q30 is 94.94%, and polyN Q30 is 97.90%.
              These values support reliable read decoding and indicate that base quality is not the main bottleneck.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertTriangle size={19} />
              <h5 className="font-bold">Depth is the primary constraint</h5>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-amber-950/85">
              Sequencing saturation is only 0.89%. Combined with 560 median genes and 770 median transcripts per
              called barcode, the report indicates a shallow library in which additional sequencing would continue
              to recover new molecules and improve low-expression marker detection.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Q30 answers: can bases be trusted?',
              text: 'A Q30 base has an estimated error probability of about 1 in 1,000. High Q30 values support barcode decoding, but they do not guarantee deep molecular capture.',
            },
            {
              title: 'Cell calling answers: which barcodes are real?',
              text: 'The transcript-count knee separates likely nucleus-containing barcodes from the long background tail. Here the selected cutoff is 341 transcripts.',
            },
            {
              title: 'Saturation answers: is more sequencing useful?',
              text: 'At 0.89% saturation, most additional reads are expected to reveal molecules not observed before. The run is quality-readable but depth-limited.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h5 className="text-sm font-bold text-slate-950">{item.title}</h5>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-700 font-black text-white">1</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Barcode-level QC</p>
            <h4 className="text-2xl font-bold text-slate-950">Define the completed Seurat analysis population</h4>
          </div>
        </div>
        <FigureCard figure={singleCellFigures.qc} onExpand={setExpandedFigure} />
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h5 className="font-bold text-slate-950">Seurat decision path</h5>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            The rerun starts from 1,903 called barcodes. Requiring at least 300 detected features retains 1,838;
            applying the archived upper cutoffs for features, counts, and mitochondrial signal retains 1,790. It then
            log-normalizes the RNA assay, selects 2,000 variable genes, scales those features, runs 50 PCs, and builds
            the graph from PCs 1-30. The exact post-QC metadata and completed Seurat object are now archived.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-700 font-black text-white">2</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Barcode recovery</p>
            <h4 className="text-2xl font-bold text-slate-950">Check well balance and expected gain from deeper sequencing</h4>
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h5 className="font-bold text-slate-950">Round-1 well recovery</h5>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Called-barcode counts are balanced across D10-D12; D10 also has the highest median transcript recovery.
            </p>
            <div className="mt-4 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={round1WellDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="well" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ borderRadius: '12px' }} />
                  <Legend />
                  <Bar dataKey="cells" name="Called barcodes" fill="#0891b2" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="medianTranscripts" name="Median transcripts" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 rounded-xl bg-cyan-50 px-4 py-3 text-sm leading-relaxed text-cyan-950">
              No technical well collapses or dominates the run: 697, 600, and 606 called barcodes were recovered.
              This supports joint technical processing, not treatment of the wells as biological replicates.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h5 className="font-bold text-slate-950">Subsampled sequencing yield</h5>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              The split-pipe report projects genes and transcripts recovered as mean reads per called barcode increase.
            </p>
            <div className="mt-4 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={singleCellSaturation}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="reads"
                    stroke="#64748b"
                    label={{ value: 'Mean reads / called barcode', position: 'insideBottom', offset: -2 }}
                  />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ borderRadius: '12px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="transcripts" name="Median transcripts" stroke="#0891b2" strokeWidth={3} />
                  <Line type="monotone" dataKey="genes" name="Median genes" stroke="#f97316" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
              Both curves are still rising at 3,648 reads per called barcode. Together with 0.89% saturation, this argues that
              deeper sequencing would improve molecular complexity rather than mostly duplicate existing reads.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-700 font-black text-white">3</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Unsupervised structure</p>
            <h4 className="text-2xl font-bold text-slate-950">Resolve transcriptional neighborhoods before annotation</h4>
          </div>
        </div>
        <FigureCard figure={singleCellFigures.umap} onExpand={setExpandedFigure} />
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h5 className="text-center font-bold text-slate-950">Leiden cluster abundance</h5>
            <div className="mt-4 h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clusterDistribution}>
                  <defs>
                    <linearGradient id="singleCellClusterBarGradient" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#0e7490" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="cluster" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ borderRadius: '12px' }} />
                  <Bar dataKey="cells" name="Called barcodes" fill="url(#singleCellClusterBarGradient)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white">
            <ScanLine className="text-cyan-300" size={22} />
            <h5 className="mt-4 text-lg font-bold">How the clusters were generated</h5>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
              <li><strong className="text-white">Input:</strong> 1,903 called barcodes × 41,802 genes.</li>
              <li><strong className="text-white">Clustering matrix:</strong> 14,668 retained genes after filtering.</li>
              <li><strong className="text-white">Feature model:</strong> 3,949 highly variable genes for PCA.</li>
              <li><strong className="text-white">Output:</strong> Eight Leiden clusters and 20 ranked genes per cluster.</li>
              <li><strong className="text-white">Purpose:</strong> Provide neighborhoods for marker-based biological review.</li>
            </ul>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">PCA</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Compresses correlated gene-expression variation into orthogonal axes while retaining broad structure.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">Neighbor graph + Leiden</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Connects transcriptionally similar barcodes, then partitions the graph into communities without using
              cell-type labels.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">UMAP</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Displays local neighborhoods in two dimensions. Shape and spacing can change with parameters and should
              not be interpreted as developmental distance.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-700 font-black text-white">4</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Resolution sensitivity</p>
            <h4 className="text-2xl font-bold text-slate-950">Test the unfinished 14-cluster claim instead of forcing it</h4>
          </div>
        </div>
        <p className="max-w-4xl text-sm leading-relaxed text-slate-600">
          The archived script used resolution 1.5 and later referred to 14 tree identities, but no completed object or
          export was available. The rerun tests that setting directly and compares it with six lower resolutions.
        </p>
        <FigureCard figure={singleCellFigures.resolution} onExpand={setExpandedFigure} />
        <div className="grid gap-6 xl:grid-cols-2">
          <FigureCard figure={singleCellFigures.primaryUmap} onExpand={setExpandedFigure} />
          <FigureCard figure={singleCellFigures.legacyUmap} onExpand={setExpandedFigure} />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <FigureCard figure={singleCellFigures.technicalWells} onExpand={setExpandedFigure} />
          <FigureCard figure={singleCellFigures.crosswalk} onExpand={setExpandedFigure} />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h5 className="text-center font-bold text-slate-950">Conservative Seurat cluster abundance</h5>
            <p className="mt-2 text-center text-sm text-slate-500">
              Eight tree-ordered clusters; every cluster contains at least 90 post-QC barcodes.
            </p>
            <div className="mt-4 h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={seuratClusterDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="cluster" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ borderRadius: '12px' }} />
                  <Bar dataKey="cells" name="Post-QC barcodes" fill="#0e7490" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">Primary report</p>
              <h5 className="mt-2 font-bold text-cyan-950">Resolution 0.6: eight clusters</h5>
              <p className="mt-2 text-sm leading-relaxed text-cyan-950/80">
                Minimum cluster size 90, ARI 0.589 against Scanpy, mean PCA silhouette 0.075, and technical-well
                Cramer&apos;s V 0.091. This is the more conservative descriptive partition.
              </p>
            </div>
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-700">Legacy sensitivity</p>
              <h5 className="mt-2 font-bold text-orange-950">Resolution 1.5: 12 clusters, not 14</h5>
              <p className="mt-2 text-sm leading-relaxed text-orange-950/80">
                Minimum cluster size 2, ARI 0.425, mean PCA silhouette 0.061, and technical-well Cramer&apos;s V 0.115.
                It is archived for comparison but not used as the primary biological summary.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950">
              <strong>Conclusion:</strong> the previously described 14-cluster Seurat result was not reproducible from
              the archived inputs and settings under Seurat 5.5.0. Reporting 12 as 14 would be incorrect, and forcing
              14 would hide the two-barcode over-splitting signal.
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-700 font-black text-white">5</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Marker interpretation</p>
            <h4 className="text-2xl font-bold text-slate-950">Assign only identities supported by coherent evidence</h4>
          </div>
        </div>
        <p className="max-w-4xl text-sm leading-relaxed text-slate-600">
          The completed rerun reports 1,133 positive marker rows and scores multi-gene panels only when at least two
          panel genes survive filtering. The evidence supports several broad candidate programs, but not a complete
          fine-grained cell atlas.
        </p>
        <FigureCard figure={singleCellFigures.markers} onExpand={setExpandedFigure} />
        <div className="grid gap-4 xl:grid-cols-2">
          {seuratMarkerFindings.map((finding) => (
            <div key={finding.cluster} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="font-bold text-slate-950">{finding.cluster}</h5>
                <span className="rounded-full bg-cyan-50 px-3 py-1 font-mono text-[11px] text-cyan-800">
                  {finding.evidence}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{finding.interpretation}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {markerPanels.map((panel) => (
            <div key={panel.label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <h5 className="font-bold text-slate-950">{panel.label}</h5>
                <span className="flex-shrink-0 rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-sky-700">
                  review panel
                </span>
              </div>
              <p className="mt-2 font-mono text-xs leading-relaxed text-cyan-700">{panel.genes}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{panel.purpose}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h5 className="font-bold text-emerald-950">Evidence needed for a defensible label</h5>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-emerald-950/80">
              <li>Multiple coherent positive markers, not one gene alone.</li>
              <li>Absence of strong contradictory lineage markers.</li>
              <li>Marker enrichment within the same completed clustering branch.</li>
              <li>Reference-based mapping or an independent expert review.</li>
              <li>Doublet and ambient-RNA checks before rare labels are accepted.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h5 className="font-bold text-amber-950">What can be concluded now</h5>
            <p className="mt-3 text-sm leading-relaxed text-amber-950/85">
              Oligodendroglial, inhibitory-neuron, and candidate excitatory cortical programs are supported in
              specific Seurat clusters. Several neuronal clusters remain unresolved, and immune, vascular, or
              dopamine-response identities are not claimed from sparse single-gene evidence.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white">
          <div className="flex items-center gap-2 text-cyan-300">
            <FileSearch size={19} />
            <h4 className="font-bold">What the project currently demonstrates</h4>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
            <li>High-quality barcode and cDNA bases support reliable Parse decoding.</li>
            <li>Three technical wells contribute balanced recovery to a 1,903-called-barcode matrix.</li>
            <li>Scanpy resolves eight report-level transcriptional neighborhoods in the archived combined sample.</li>
            <li>Seurat retains 1,790 post-QC barcodes and independently supports a conservative eight-cluster partition.</li>
            <li>The legacy resolution-1.5 rerun produces 12 clusters, not the previously described 14.</li>
            <li>Barcode-level crosswalking shows related but non-identical Seurat and Scanpy structure (ARI 0.589).</li>
            <li>The run is shallow, so deeper sequencing is likely to improve molecular and marker recovery.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-center gap-2 text-amber-900">
            <Layers3 size={19} />
            <h4 className="font-bold">What remains before biological comparison</h4>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-amber-950/85">
            <li>The archived run has one combined sample label and cannot estimate biological variability.</li>
            <li>Low sequencing saturation limits rare transcripts and fine neuronal subtype resolution.</li>
            <li>Doublets and ambient RNA remain unmodeled because no validated platform-specific expectation was archived.</li>
            <li>Provisional cell-type programs require reference mapping and independent marker review.</li>
            <li>Replicated samples, doublet assessment, batch integration, and pseudobulk testing are required for SUD or strain contrasts.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Study guide</p>
          <h4 className="mt-2 text-2xl font-bold text-slate-950">Terms to retain from this analysis</h4>
        </div>
        <GlossaryGrid items={singleNucleusGlossary} accent="cyan" />
      </section>

      <section className="rounded-[2rem] border border-cyan-200 bg-[linear-gradient(135deg,#ecfeff,#f8fafc)] p-6 md:p-8">
        <div className="flex items-center gap-2 text-cyan-800">
          <ArrowRight size={20} />
          <h4 className="text-lg font-bold">Next defensible analysis</h4>
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-700">
          The missing Seurat rerun, object archive, marker testing, and Scanpy crosswalk are now complete. The next
          defensible step is to add independently collected animals, estimate doublets with validated loading
          information, assess ambient RNA, map clusters to a rat-brain reference, and run pseudobulk contrasts at the
          biological-sample level.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-cyan-800">
          {['Assess doublets', 'Map a reference', 'Validate markers', 'Add animals', 'Pseudobulk inference'].map((item) => (
            <span key={item} className="rounded-full border border-cyan-200 bg-white px-3 py-1.5">{item}</span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-slate-700">
          <FileSearch size={18} />
          <h4 className="font-bold">Provenance used for this page</h4>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Parse split-pipe v1.1.2 run log, aggregate analysis summary, archived HTML analysis report, reconstructed
          Scanpy UMAP and cluster assignments, and the completed Seurat 5.5.0 rerun generated from the archived
          1,903 × 41,802 DGE matrix. The new archive includes exact QC tables, seven-resolution diagnostics, UMAPs,
          1,133 marker rows, cluster assignments, a completed RDS object, and package session information.
        </p>
      </section>

      <FigureModal figure={expandedFigure} onClose={() => setExpandedFigure(null)} />
    </div>
  );
};

const BulkAtacSequencing = () => {
  const [expandedFigure, setExpandedFigure] = useState<AnalysisFigure | null>(null);

  return (
    <div className="space-y-12 animate-fadeIn">
      <section className="relative overflow-hidden rounded-[2rem] border border-teal-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_55%,#fff7ed_100%)] p-7 md:p-10">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15,118,110,0.18) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative max-w-4xl">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-teal-700">
            <Dna size={17} />
            Bulk ATAC-seq reanalysis
          </div>
          <h3 className="mt-4 text-3xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">
            Adult rat cortical
            <span className="block text-teal-700">chromatin accessibility</span>
          </h3>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-600 md:text-lg">
            Reanalysis of four public paired-end ATAC-seq libraries from prefrontal and motor cortex in
            Yuan et al. (2021). The original study used rn6; this independent workflow remaps the reads to a custom
            chromosome-only rn7 reference and evaluates retained alignments, peaks, annotations, and global structure.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold">
            {[
              '4 libraries',
              '2 female rats',
              '2 replicates / region',
              'PFC vs Motor',
              'rn7 reanalysis',
              'Paired-end 50 bp',
            ].map((tag) => (
              <span key={tag} className="rounded-full border border-white/90 bg-white/80 px-3 py-1.5 text-slate-700 shadow-sm">
                {tag}
              </span>
            ))}
          </div>
          <a
            href="https://doi.org/10.3389/fgene.2021.651604"
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700"
          >
            Read the source study
            <ArrowUpRight size={16} />
          </a>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[2rem] border border-teal-200 bg-teal-50 p-6 md:p-8">
          <div className="flex items-center gap-2 text-teal-800">
            <BookOpen size={20} />
            <h4 className="font-bold">What bulk ATAC-seq measures</h4>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-teal-950/85">
            Tn5 transposase inserts sequencing adapters preferentially into exposed DNA. After paired-end sequencing,
            enriched insertion fragments identify genomic regions that were accessible in the pooled tissue. Peaks
            can mark promoters, enhancers, insulators, or other open elements, but accessibility alone does not reveal
            regulatory function or the target gene.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-teal-950/85">
            This is a bulk assay: every library averages many nuclei and cell types. A regional difference could
            reflect regulatory change within a cell type, a shift in cell composition, or both.
          </p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">Read, fragment, peak</p>
          <h4 className="mt-3 text-xl font-bold">Three related but different units</h4>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
            <p><strong className="text-white">Alignment:</strong> one read placed on rn7; mapped and FRiP counts here use BAM alignment records.</p>
            <p><strong className="text-white">Fragment:</strong> the interval spanned by a read pair; MACS2 BAMPE uses this paired geometry.</p>
            <p><strong className="text-white">Peak:</strong> a region enriched for many fragments relative to background.</p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Study provenance</p>
          <h4 className="mt-2 text-2xl font-bold text-slate-950">What came from the paper and what changed here</h4>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Yuan et al. resource</p>
            <h5 className="mt-2 font-bold text-slate-950">Original public experiment</h5>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-600">
              <li>Adult Sprague-Dawley rats, approximately 7-8 months old.</li>
              <li>Rat1 and Rat2 are female biological replicates for these cortical libraries.</li>
              <li>MGISEQ-2000 paired-end 50-bp sequencing; BioProject PRJNA684678.</li>
              <li>Original paper preprocessing and downstream coordinates used rn6.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">Local project</p>
            <h5 className="mt-2 font-bold text-teal-950">Independent rn7 reanalysis</h5>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-teal-950/80">
              <li>Selects two PFC and two motor-cortex libraries from the larger atlas.</li>
              <li>Uses fastp, BWA-MEM, MAPQ ≥30 filtering, duplicate removal, and MACS2 BAMPE.</li>
              <li>Uses a custom rn7 chr1-20/X/Y reference that intentionally omits chrM.</li>
              <li>Generates every figure on this page from the local outputs, not from paper figures.</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://www.ncbi.nlm.nih.gov/bioproject/PRJNA684678"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-teal-400 hover:text-teal-700"
          >
            NCBI BioProject
            <ArrowUpRight size={15} />
          </a>
          <a
            href="https://doi.org/10.3389/fgene.2021.651604"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-teal-400 hover:text-teal-700"
          >
            Source article
            <ArrowUpRight size={15} />
          </a>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Project overview</p>
          <h4 className="mt-2 text-2xl font-bold text-slate-950">Rebuild the accessibility evidence from the raw libraries</h4>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-600">
            Yuan et al. published a rat chromatin-accessibility resource spanning tissues and brain regions. This
            focused reanalysis selects two prefrontal-cortex and two motor-cortex libraries, processes all four with
            one rn7 workflow, and asks whether the recovered signal is strong and consistent enough to support later
            region-aware regulatory analysis.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {[
            {
              icon: Target,
              title: 'Primary question',
              text: 'Do the four libraries recover credible promoter and distal accessibility, and how much sample-level variation remains after common processing?',
            },
            {
              icon: Activity,
              title: 'Evidence chain',
              text: 'Read retention, peak yield, FRiP, genomic annotation, TSS distance, consensus-peak correlation, and PCA are interpreted together.',
            },
            {
              icon: FlaskConical,
              title: 'Intended use',
              text: 'Establish a transparent QC and exploratory baseline before testing differential accessibility or linking peaks to candidate target genes.',
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <Icon className="text-teal-700" size={21} />
              <h5 className="mt-4 font-bold text-slate-950">{title}</h5>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Analysis map</p>
            <h4 className="mt-2 text-2xl font-bold text-slate-950">From raw reads to biological structure</h4>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['01', 'Validate pairs', 'Confirm paired FASTQ inputs and inspect raw read quality with FastQC.'],
            ['02', 'Trim reads', 'Use fastp to remove adapters and low-quality sequence before alignment.'],
            ['03', 'Align to rn7', 'Map paired reads with BWA-MEM against the chromosome-level rat reference.'],
            ['04', 'Filter evidence', 'Retain primary MAPQ ≥30 alignments and remove duplicate-marked alignments.'],
            ['05', 'Call peaks', 'Run MACS2 in BAMPE mode at q < 0.01 to define accessible intervals.'],
            ['06', 'Build tracks', 'Create CPM-normalized BigWig signal for comparable genome-wide coverage.'],
            ['07', 'Annotate peaks', 'Assign promoter, genic, and distal context with ChIPseeker and TSS distances.'],
            ['08', 'Compare samples', 'Merge overlaps into 120,562 consensus regions, then calculate Spearman correlation and PCA.'],
          ].map(([number, title, description]) => (
            <div key={number} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-4xl font-black text-teal-100">{number}</span>
              <h5 className="mt-3 font-bold text-slate-900">{title}</h5>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'FASTQ → BAM',
              text: 'The question changes from “what bases were sequenced?” to “where did those reads align on rn7?”',
            },
            {
              title: 'BAM → peaks + BigWig',
              text: 'MACS2 converts local fragment enrichment into intervals; BigWig preserves continuous CPM-normalized coverage.',
            },
            {
              title: 'Peaks → comparable matrix',
              text: 'Overlapping sample peaks are merged so each row represents one genomic region measured in all four libraries.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-bold text-slate-950">{item.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Dataset</p>
          <h4 className="mt-2 text-2xl font-bold text-slate-950">Four cortical libraries</h4>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Rat1 and Rat2 each contribute one PFC and one motor-cortex library. This paired animal structure is useful,
            but two biological replicates per region remain too few for a robust region-level inferential model.
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-5 py-4">Sample</th>
                <th className="px-5 py-4">Region</th>
                <th className="px-5 py-4">Animal</th>
                <th className="px-5 py-4">Library</th>
                <th className="px-5 py-4">Mapped alignments</th>
                <th className="px-5 py-4">Narrow peaks</th>
                <th className="px-5 py-4">FRiP</th>
                <th className="px-5 py-4">QC note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {atacSamples.map((sample) => (
                <tr key={sample.sample} className="transition-colors hover:bg-teal-50/40">
                  <td className="px-5 py-4 font-mono font-semibold text-slate-900">{sample.sample}</td>
                  <td className="px-5 py-4 text-slate-600">{sample.region}</td>
                  <td className="px-5 py-4 text-slate-600">{sample.animal}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">{sample.library}</td>
                  <td className="px-5 py-4 text-slate-600">{sample.mapped}</td>
                  <td className="px-5 py-4 text-slate-600">{sample.peaks}</td>
                  <td className="px-5 py-4 font-semibold text-slate-900">{sample.frip}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        sample.status === 'Review'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {sample.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Reference</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Custom rn7 chr1-20/X/Y</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              All reanalysis samples use the same coordinate system; chrM is absent. The source paper used rn6.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Peak model</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">MACS2 BAMPE, q &lt; 0.01</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Paired fragments define accessible intervals without extending single-end tags.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Comparison unit</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">CPM over 120,562 consensus regions</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              All merged regions retained nonzero signal in at least two libraries.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 font-black text-white">1</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Alignment and peak recovery</p>
            <h4 className="text-2xl font-bold text-slate-950">How much usable signal remained?</h4>
          </div>
        </div>
        <p className="max-w-4xl text-sm leading-relaxed text-slate-600">
          The table and mapped-read figure count final retained BAM alignment records, not unique paired fragments.
          More retained alignments provide a larger evidence base for peak calling. Peak count must still be evaluated
          beside depth and enrichment because an under-sequenced library can appear to contain fewer accessible
          regions simply through under-sampling.
        </p>
        <div className="grid gap-6 xl:grid-cols-2">
          <FigureCard figure={figures.mapped} onExpand={setExpandedFigure} />
          <FigureCard figure={figures.peaks} onExpand={setExpandedFigure} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h5 className="font-bold text-slate-950">How to read depth and peak yield together</h5>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            SRR13307053 has 3.4 times as many retained alignments as SRR13307081 and calls 2.9 times as many peaks.
            This association does not prove that depth explains every difference, but it shows why peak counts alone
            cannot be treated as a direct measure of cortical regulatory complexity.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 font-black text-white">2</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Peak enrichment</p>
            <h4 className="text-2xl font-bold text-slate-950">Is accessibility signal concentrated?</h4>
          </div>
        </div>
        <p className="max-w-4xl text-sm leading-relaxed text-slate-600">
          In this reanalysis, FRiP divides retained mapped alignment records overlapping a sample’s own peaks by all
          retained mapped alignment records. It connects mapping and peak calling into a signal-to-noise diagnostic
          and is the clearest reason to distinguish SRR13307081 from the other libraries.
        </p>
        <FigureCard figure={figures.frip} onExpand={setExpandedFigure} />
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <AlertTriangle className="mt-0.5 flex-shrink-0" size={20} />
          <div>
            <h5 className="font-bold">One library needs cautious interpretation</h5>
            <p className="mt-1 text-sm leading-relaxed">
              SRR13307081 has 26.1M mapped alignments, 36,257 peaks, and FRiP 0.1497. It remains visible in
              downstream plots, but conclusions should not treat all four libraries as equally strong.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h5 className="font-bold text-emerald-950">What higher FRiP suggests</h5>
            <p className="mt-2 text-sm leading-relaxed text-emerald-950/80">
              A larger fraction of retained signal is concentrated in called accessible intervals, consistent with a
              better signal-to-background profile under the same pipeline.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h5 className="font-bold text-amber-950">What FRiP does not prove</h5>
            <p className="mt-2 text-sm leading-relaxed text-amber-950/85">
              It does not validate a peak’s function, remove dependence on peak-caller settings, or establish that two
              libraries are biologically equivalent.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 font-black text-white">3</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Genomic context</p>
            <h4 className="text-2xl font-bold text-slate-950">Where do accessible regions fall?</h4>
          </div>
        </div>
        <p className="max-w-4xl text-sm leading-relaxed text-slate-600">
          Annotation converts anonymous peak coordinates into regulatory context. Promoter-proximal peaks support
          active transcriptional entry points, while intronic and distal-intergenic peaks define the candidate
          enhancer space that would later be connected to genes with 3D contacts or other functional evidence.
        </p>
        <FigureCard figure={figures.annotation} onExpand={setExpandedFigure} />
        <FigureCard figure={figures.tss} onExpand={setExpandedFigure} />
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h5 className="font-bold text-slate-950">Two anchor annotation categories</h5>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Exact ChIPseeker proportions clarify the promoter-to-distal gradient visible in the stacked bars.
            </p>
          </div>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Sample</th>
                <th className="px-5 py-3">Promoter ≤1 kb</th>
                <th className="px-5 py-3">Distal intergenic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {atacAnnotationSummary.map((row) => (
                <tr key={row.sample}>
                  <td className="px-5 py-3 font-mono font-semibold text-slate-800">{row.sample}</td>
                  <td className="px-5 py-3 text-slate-600">{row.promoter}</td>
                  <td className="px-5 py-3 text-slate-600">{row.distal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sky-950">
          <Info className="mt-0.5 flex-shrink-0" size={20} />
          <p className="text-sm leading-relaxed">
            <strong>TSS distance is not TSS enrichment.</strong> The displayed profile counts where called peaks fall
            relative to transcription start sites. A canonical ATAC-seq TSS enrichment score instead aggregates
            insertion coverage at base-level resolution around many TSSs.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 font-black text-white">4</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Cross-sample structure</p>
            <h4 className="text-2xl font-bold text-slate-950">How do the four accessibility profiles relate?</h4>
          </div>
        </div>
        <p className="max-w-4xl text-sm leading-relaxed text-slate-600">
          Consensus-peak CPM profiles place all libraries in a common feature space. Correlation shows pairwise
          similarity, while PCA identifies the dominant axes of global variation. Both are exploratory checks for
          replicate behavior before any region-level statistical model is attempted.
        </p>
        <FigureCard figure={figures.correlation} onExpand={setExpandedFigure} />
        <FigureCard figure={figures.pca} onExpand={setExpandedFigure} />
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">Consensus construction</p>
            <h5 className="mt-2 font-bold text-slate-950">120,562 common genomic rows</h5>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Overlapping peaks from all four libraries were merged into a union of 120,562 non-overlapping regions.
              Mean CPM BigWig signal was then measured for every sample over every region. The requirement for nonzero
              signal in at least two samples retained all 120,562 regions; it did not reduce the row count further.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">Correlation reading</p>
            <h5 className="mt-2 font-bold text-slate-950">Similarity is high, but region pairing is weak</h5>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Pairwise Spearman correlations span 0.792-0.891. The strongest pair, SRR13307053 and SRR13307057,
              crosses region labels. PFC replicates correlate at 0.853 and motor replicates at 0.792, so technical
              quality and depth remain plausible contributors to the observed structure.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <h5 className="font-bold text-teal-950">How to read the PCA without over-claiming</h5>
          <p className="mt-2 text-sm leading-relaxed text-teal-950/85">
            PC1 and PC2 summarize 55.9% and 25.5% of variance, but the axes do not know the sample labels. Because
            same-region libraries do not form tight pairs and only four points exist, the plot demonstrates
            library-level heterogeneity rather than validated PFC-versus-motor separation.
          </p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white">
          <div className="flex items-center gap-2 text-teal-300">
            <FileSearch size={19} />
            <h4 className="font-bold">What this reanalysis supports</h4>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
            <li>Three libraries show FRiP above 0.20 and recover 56,817-104,342 accessible intervals.</li>
            <li>Promoter and distal-intergenic signal appears in every sample, supporting a credible regulatory landscape.</li>
            <li>Global correlations remain high but do not produce clean same-region replicate grouping.</li>
            <li>The analysis supports exploratory QC and structure assessment, not differential accessibility.</li>
            <li>Every displayed figure was generated from the local rn7 reanalysis rather than copied from the paper.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-center gap-2 text-amber-900">
            <Layers3 size={19} />
            <h4 className="font-bold">Interpretation boundary</h4>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-amber-950/85">
            <li>Two libraries per region are insufficient for a robust differential accessibility model.</li>
            <li>SRR13307081 has lower depth, peak yield, and FRiP, so quality and region effects are partly confounded.</li>
            <li>Bulk signal cannot distinguish within-cell regulatory changes from changes in cell composition.</li>
            <li>The rn7 reference used here omits chrM; a zero mitochondrial count would not measure true contamination.</li>
            <li>Duplicate-zero values describe the post-removal BAM and cannot recover the original library duplication rate.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-[2rem] border border-teal-200 bg-teal-50 p-6 md:p-8">
        <div className="flex items-center gap-2 text-teal-800">
          <CheckCircle2 size={21} />
          <h4 className="text-lg font-bold">Next analysis stage</h4>
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-teal-950/85">
          Rat1 and Rat2 already provide two biological replicates per region. The next defensible step is to add more
          independent animals, balance library quality, count paired fragments over a predeclared consensus universe,
          and fit a replicate-aware accessibility model. Significant regions can then be connected to genes using
          promoter proximity, enhancer chromatin states, expression, and 3D contacts. That sequence preserves the
          distinction between exploratory structure and validated PFC-versus-motor regulation.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-teal-800">
          {['Add independent animals', 'Balance QC', 'Count paired fragments', 'Fit sample-aware model', 'Link peaks to genes'].map((item) => (
            <span key={item} className="rounded-full border border-teal-200 bg-white px-3 py-1.5">{item}</span>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Study guide</p>
          <h4 className="mt-2 text-2xl font-bold text-slate-950">Terms to retain from this analysis</h4>
        </div>
        <GlossaryGrid items={atacGlossary} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-slate-700">
          <FileSearch size={18} />
          <h4 className="font-bold">Provenance used for this page</h4>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Yuan et al. (2021) and NCBI BioProject PRJNA684678 provide experiment-level context. Sample-level metrics
          come from the local rn7 final-BAM summary, FRiP table, narrowPeak counts, ChIPseeker annotations, and the
          consensus-region BigWig analysis. Interpretations are constrained to those archived outputs.
        </p>
      </section>

      <FigureModal figure={expandedFigure} onClose={() => setExpandedFigure(null)} />
    </div>
  );
};

export const ResearchSequencings: React.FC<ResearchSequencingsProps> = ({ activeView }) => {
  const navigate = useNavigate();
  const navigation = [
    {
      id: 'singlecellseq' as const,
      label: 'Single-nucleus RNA-seq',
      description: 'Parse Evercode WT',
      icon: Microscope,
    },
    {
      id: 'atacseq' as const,
      label: 'Bulk ATAC-seq',
      description: 'Yuan et al. 2021',
      icon: Database,
    },
  ];

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <aside className="w-full flex-shrink-0 lg:w-64">
        <div className="lg:sticky lg:top-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Sequencings</h3>
          <hr className="my-2 border-slate-200" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeView;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/research/sequencings/${item.id}`)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                    isActive
                      ? 'border-teal-300 bg-teal-50 shadow-sm'
                      : 'border-slate-200 bg-slate-50 hover:border-teal-200 hover:bg-teal-50/70'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={17} className={isActive ? 'text-teal-700' : 'text-slate-400 group-hover:text-teal-600'} />
                    <p className={`text-sm font-bold ${isActive ? 'text-teal-700' : 'text-slate-600 group-hover:text-teal-700'}`}>
                      {item.label}
                    </p>
                  </div>
                  <p className="mt-1 hidden pl-6 text-xs text-slate-400 sm:block">{item.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {activeView === 'singlecellseq' ? <SingleCellSequencing /> : <BulkAtacSequencing />}
      </main>
    </div>
  );
};
