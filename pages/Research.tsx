
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GitBranch, Database, Search, Cat } from 'lucide-react';
import { ResearchLoopBrowser } from './ResearchLoopBrowser';
import { ResearchBreedchain } from './ResearchBreedchain';
import { ResearchPEInteractions } from './ResearchPEInteractions';
import { ResearchPaperFinder } from './ResearchPaperFinder';
import { ResearchSequencings, type SequencingView } from './ResearchSequencings';
import { PageHeader } from '../components/PageHeader';

const sequencingViews: SequencingView[] = ['singlecellseq', 'atacseq'];

const EnhancerID = () => (
  <div className="space-y-8 animate-fadeIn">
    <div className="space-y-3">
      <h3 className="text-2xl font-bold text-slate-900">Deep Learning Framework for Rat Promoter-Enhancer Interactions</h3>
      <p className="text-slate-600 text-base leading-relaxed">
        This page summarizes the working plan from the project notes to connect Hi-C loops, sequence variation,
        and Enformer predictions for breed-specific regulatory interpretation in HRDP rat frontal cortex.
      </p>
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        {['HRDP (10 strains)', 'No WGS required', 'Hi-C variant calling', 'Enformer (196,608 bp)', 'Loop-aware validation'].map((tag) => (
          <span key={tag} className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-teal-700">
            {tag}
          </span>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="rounded-2xl border border-slate-200 p-5">
        <h4 className="text-lg font-bold text-slate-900 mb-3">Scientific Focus</h4>
        <ul className="text-sm text-slate-700 space-y-2">
          <li><strong>Question:</strong> Which sequence differences across strains explain differences in loop-supported promoter-enhancer regulation.</li>
          <li><strong>Input data:</strong> Hi-C FASTQ or BAM, loop anchors, and promoter-linked loop catalogs.</li>
          <li><strong>Core assumption:</strong> Hi-C reads can be reused for SNP and indel calling when chimeric-aware alignment and strict QC are applied.</li>
          <li><strong>Priority regions:</strong> Loop anchors and loop-centered windows where Hi-C read density is relatively high.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 p-5">
        <h4 className="text-lg font-bold text-slate-900 mb-3">Why Enformer</h4>
        <ul className="text-sm text-slate-700 space-y-2">
          <li><strong>Long-range context:</strong> Enformer models distal effects in large sequence windows using transformer attention.</li>
          <li><strong>Rich outputs:</strong> CAGE and chromatin tracks are usable as functional priors for loop interpretation.</li>
          <li><strong>Variant effects:</strong> Delta prediction between strain-specific sequences provides a direct in silico effect size.</li>
          <li><strong>Practical fit:</strong> 196,608 bp windows can be centered on loop anchors to align sequence prediction with 3D contacts.</li>
        </ul>
      </div>
    </div>

    <div className="space-y-4">
      <h4 className="text-lg font-bold text-slate-900">Computational Pipeline</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-2">Step 1. Hi-C Variant Calling</p>
          <p className="text-sm text-slate-600">Align with BWA-MEM (-5SP), mark duplicates, and call variants using GATK HaplotypeCaller & GenotypeGVCFs.</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-2">Step 2. Strain-Specific Consensus FASTA</p>
          <p className="text-sm text-slate-600">Filter VCF to SNP-only to preserve coordinates, generate consensus genome via bcftools.</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-2">Step 3. Enformer Input and Inference</p>
          <p className="text-sm text-slate-600">Extract 196 kb sequences centered on loop anchors from the custom genome.</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-2">Step 4. Loop-Attention Concordance</p>
          <p className="text-sm text-slate-600">Correlate Enformer attention maps with Hi-C contact matrices using distance-corrected metrics.</p>
        </div>
      </div>
    </div>


    <div className="bg-slate-900 rounded-2xl p-6 overflow-x-auto shadow-inner">
      <code className="text-sm font-mono leading-relaxed">
        <span className="text-slate-400"># Step 0: Reference prep (run once per reference)</span><br />
        <span className="text-yellow-300">samtools faidx rn7chr.fa</span><br />
        <span className="text-yellow-300">gatk CreateSequenceDictionary -R rn7chr.fa</span><br />
        <br />
        <span className="text-slate-400"># Step 1: Hi-C based variant calling (Sample 592)</span><br />
        <span className="text-yellow-300">bwa mem -5SP -t 16 rn7chr.fa 592_R1.fastq.gz 592_R2.fastq.gz | samtools view -b - &gt; 592_raw.bam</span><br />
        <span className="text-yellow-300">samtools sort -@ 8 -o 592_sorted.bam 592_raw.bam</span><br />
        <span className="text-yellow-300">samtools index 592_sorted.bam</span><br />
        <br />
        <span className="text-yellow-300">gatk MarkDuplicates -I 592_sorted.bam -O 592_dedup.bam -M metrics.txt --REMOVE_DUPLICATES true</span><br />
        <span className="text-yellow-300">samtools index 592_dedup.bam</span><br />
        <br />
        <span className="text-yellow-300">gatk HaplotypeCaller -R rn7chr.fa -I 592_dedup.bam -O 592_output.g.vcf.gz -ERC GVCF --dont-use-soft-clipped-bases true</span><br />
        <span className="text-yellow-300">gatk GenotypeGVCFs -R rn7chr.fa -V 592_output.g.vcf.gz -O 592_raw.vcf.gz</span><br />
        <span className="text-yellow-300">tabix -p vcf 592_raw.vcf.gz</span><br />
        <br />
        <span className="text-slate-400"># Step 2: SNP-only consensus (preserve coordinates)</span><br />
        <span className="text-yellow-300">bcftools filter -e &apos;QD &lt; 2.0 || FS &gt; 60.0&apos; -O z -o 592_filtered.vcf.gz 592_raw.vcf.gz</span><br />
        <span className="text-yellow-300">bcftools view -V indels -O z -o 592_snps_only.vcf.gz 592_filtered.vcf.gz</span><br />
        <span className="text-yellow-300">tabix -p vcf 592_snps_only.vcf.gz</span><br />
        <span className="text-yellow-300">bcftools consensus -f rn7chr.fa -o 592_genome.fa 592_snps_only.vcf.gz</span><br />
        <br />
        <span className="text-slate-400"># Step 3: Enformer input extraction</span><br />
        <span className="text-slate-400"># NOTE: loop_anchors.bed must be BED (0-based, half-open)</span><br />
        <span className="text-yellow-300">bedtools getfasta -fi 592_genome.fa -bed loop_anchors.bed -fo input_sequences.fa</span><br />
      </code>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="rounded-2xl border border-slate-200 p-5">
        <h4 className="text-lg font-bold text-slate-900 mb-3">Validation and Readouts</h4>
        <ul className="text-sm text-slate-700 space-y-2">
          <li><strong>Delta effect check:</strong> Compare prediction differences between strains at differential loops.</li>
          <li><strong>Attention versus loops:</strong> Quantify overlap between top attention pixels and HICCUP loop anchors.</li>
          <li><strong>Distance-corrected correlation:</strong> Compare predicted long-range signal and Hi-C contact after genomic-distance correction.</li>
          <li><strong>Null controls:</strong> Apply permutation and shuffled-region tests before claiming strain-specific regulation.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h4 className="text-lg font-bold text-amber-900 mb-2">Important Caveats</h4>
        <p className="text-sm text-amber-900/90 leading-relaxed">
          Hi-C based variant calling is feasible, but coverage remains non-uniform because of restriction site bias and
          chimeric read structure. Claims should be restricted to well-covered loop-anchor regions, include strict variant QC,
          and report uncertainty for low-depth regions outside anchor-focused analyses.
        </p>
      </div>
    </div>
  </div >
);

const variancePartitionReportPath = '/reports/variancepartition.html';

const VariancePartitionReport = () => {
  const [reportHeight, setReportHeight] = useState(900);

  const syncReportHeight = (iframe: HTMLIFrameElement) => {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc?.body || !doc.documentElement) return;

    setReportHeight(
      Math.max(
        doc.documentElement.scrollHeight,
        doc.body.scrollHeight,
        900
      )
    );
  };

  return (
    <div className="animate-fadeIn">
      <div className="mx-auto w-full max-w-6xl bg-white">
        <iframe
          src={variancePartitionReportPath}
          title="VariancePartition report"
          className="block w-full border-0 bg-white"
          scrolling="no"
          style={{ height: reportHeight }}
          onLoad={(event) => {
            const iframe = event.currentTarget;
            syncReportHeight(iframe);
            window.setTimeout(() => syncReportHeight(iframe), 200);
            window.setTimeout(() => syncReportHeight(iframe), 800);
          }}
        >
          <a href={variancePartitionReportPath}>Open the VariancePartition report</a>
        </iframe>
      </div>
    </div>
  );
};

export const Research: React.FC = () => {
  const { submenu, subId } = useParams<{ submenu?: string; subId?: string }>();
  const navigate = useNavigate();

  const tabs = [
    { label: 'PaperFinder', icon: Search, color: 'text-teal-500 border-teal-500', activeBg: 'bg-teal-50 ring-teal-200', slug: 'paperfinder' },
    { label: 'Loop Browser', icon: Search, color: 'text-teal-500 border-teal-500', activeBg: 'bg-teal-50 ring-teal-200', slug: 'loopbrowser' },
    { label: 'Breedchain', icon: Cat, color: 'text-teal-500 border-teal-500', activeBg: 'bg-teal-50 ring-teal-200', slug: 'breedchain' },
    { label: 'PE Interactions', icon: GitBranch, color: 'text-teal-500 border-teal-500', activeBg: 'bg-teal-50 ring-teal-200', slug: 'peinteractions' },
    { label: 'Sequencings', icon: Database, color: 'text-teal-500 border-teal-500', activeBg: 'bg-teal-50 ring-teal-200', slug: 'sequencings' },
  ];

  const defaultSlug = tabs[0]?.slug || 'paperfinder';
  const requestedSlug = submenu && tabs.some((t) => t.slug === submenu) ? submenu : defaultSlug;
  const activeSequencingView: SequencingView = sequencingViews.includes(subId as SequencingView)
    ? (subId as SequencingView)
    : 'singlecellseq';

  // Normalize top-level and sequencing URLs without leaving stale nested paths.
  React.useEffect(() => {
    if (submenu !== requestedSlug) {
      navigate(`/research/${requestedSlug}`, { replace: true });
      return;
    }

    if (requestedSlug === 'sequencings' && !sequencingViews.includes(subId as SequencingView)) {
      navigate('/research/sequencings/singlecellseq', { replace: true });
      return;
    }

    if (requestedSlug !== 'sequencings' && subId) {
      navigate(`/research/${requestedSlug}`, { replace: true });
    }
  }, [submenu, requestedSlug, subId, navigate]);

  // Prefetch initial genome data (chr1) in background when Research page loads
  React.useEffect(() => {
    const prefetchInitialData = async () => {
      try {
        // Import dynamically to avoid blocking main bundle if possible, 
        // but here we just use the imported functions if we were to import them at top level.
        // Since we need to modify imports, let's assume we'll add imports at the top.
        const { loadChromosomeData, loadLoopDataForChr, loadGeneDataForChr } = await import('../utils/csvLoader');

        // Load chromosome list and chr1 data (default view)
        await Promise.all([
          loadChromosomeData(),
          loadLoopDataForChr('chr1'),
          loadGeneDataForChr('chr1')
        ]);
        console.log('Initial genome data prefetched');
      } catch (error) {
        console.error('Failed to prefetch genome data:', error);
      }
    };

    prefetchInitialData();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <PageHeader
        title="Projects"
        tabs={tabs.map(tab => ({
          ...tab,
          id: tab.slug // Use slug as id for PageHeader
        }))}
        activeTab={requestedSlug}
        onTabChange={(id) => {
          navigate(id === 'sequencings' ? '/research/sequencings/singlecellseq' : `/research/${id}`);
        }}
        activeColor="text-teal-500 border-teal-500"
      />

      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          {requestedSlug === 'loopbrowser' && <ResearchLoopBrowser />}
          {requestedSlug === 'breedchain' && <ResearchBreedchain />}
          {requestedSlug === 'peinteractions' && <ResearchPEInteractions />}
          {requestedSlug === 'paperfinder' && <ResearchPaperFinder />}
          {requestedSlug === 'variancepartition' && <VariancePartitionReport />}
          {requestedSlug === 'sequencings' && <ResearchSequencings activeView={activeSequencingView} />}
          {requestedSlug === 'deeplearningenhancer' && <EnhancerID />}
        </div>
      </div>
    </div>
  );
};
