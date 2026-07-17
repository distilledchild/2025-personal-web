#!/usr/bin/env Rscript

suppressPackageStartupMessages({
    library(ChIPseeker)
    library(GenomicRanges)
    library(TxDb.Rnorvegicus.UCSC.rn7.refGene)
    library(ggplot2)
    library(ggrepel)
    library(grid)
    library(gridExtra)
    library(pheatmap)
    library(RColorBrewer)
    library(rtracklayer)
    library(scales)
})

source_dir <- Sys.getenv(
    "ATAC_SOURCE_DIR",
    "/Users/pete/Desktop/playground/2026-epigenetic-analysis/ATAC-seq_2021_Yuan_et_al"
)
data_dir <- file.path(source_dir, "out_atac_rn7_pe")
output_dir <- file.path("public", "research", "sequencings", "atacseq")
external_data_dir <- Sys.getenv(
    "ATAC_EXTERNAL_DATA_DIR",
    "/Volumes/external_1000GB_all/playground/2026-epigenetic-analysis/ATAC-seq_2021_Yuan_et_al/out_atac_rn7_pe"
)

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

samples <- c("SRR13307053", "SRR13307057", "SRR13307077", "SRR13307081")
sample_meta <- data.frame(
    sample = samples,
    region = c("PFC", "Motor", "PFC", "Motor"),
    stringsAsFactors = FALSE
)
region_colors <- c("PFC" = "#E64B35", "Motor" = "#4DBBD5")

web_theme <- theme_minimal(base_size = 13) +
    theme(
        plot.title = element_text(
            hjust = 0.5,
            face = "bold",
            size = 18,
            margin = margin(b = 24)
        ),
        plot.title.position = "plot",
        plot.margin = margin(t = 22, r = 28, b = 22, l = 28)
    )

save_web_plot <- function(plot, filename, width = 10, height = 6) {
    ggsave(
        filename = file.path(output_dir, filename),
        plot = plot,
        width = width,
        height = height,
        dpi = 300,
        bg = "white"
    )
}

message("Loading ATAC-seq QC and peak data")
qc <- read.delim(
    file.path(data_dir, "04_qc_core.tsv"),
    stringsAsFactors = FALSE
)
qc$sample <- factor(qc$sample, levels = samples)

frip_plot <- ggplot(qc, aes(x = reorder(sample, -FRiP), y = FRiP, fill = region)) +
    geom_col(width = 0.6, alpha = 0.85) +
    geom_hline(
        yintercept = 0.3,
        linetype = "dashed",
        color = "green4",
        linewidth = 0.5
    ) +
    geom_hline(
        yintercept = 0.2,
        linetype = "dashed",
        color = "orange",
        linewidth = 0.5
    ) +
    annotate(
        "text",
        x = 0.5,
        y = 0.31,
        label = "Excellent (0.3)",
        hjust = 0,
        color = "green4",
        size = 3
    ) +
    annotate(
        "text",
        x = 0.5,
        y = 0.21,
        label = "Good (0.2)",
        hjust = 0,
        color = "orange",
        size = 3
    ) +
    scale_fill_manual(values = region_colors) +
    scale_y_continuous(
        labels = percent_format(accuracy = 1),
        limits = c(0, 0.4),
        expand = expansion(mult = c(0, 0.03))
    ) +
    labs(
        title = "Fraction of Reads in Peaks (FRiP)",
        x = NULL,
        y = "FRiP",
        fill = "Region"
    ) +
    web_theme +
    theme(axis.text.x = element_text(angle = 30, hjust = 1))

save_web_plot(frip_plot, "FRiP_score.png", width = 10, height = 7)

peak_files <- setNames(
    file.path(data_dir, samples, "peaks", paste0(samples, "_peaks.narrowPeak")),
    samples
)
stopifnot(all(file.exists(peak_files)))

message("Annotating peak locations against rn7")
peak_list <- lapply(peak_files, function(path) {
    peaks <- read.delim(
        path,
        header = FALSE,
        stringsAsFactors = FALSE,
        col.names = c(
            "chr", "start", "end", "name", "score",
            "strand", "signalValue", "pValue", "qValue", "peak"
        )
    )
    makeGRangesFromDataFrame(peaks, keep.extra.columns = TRUE)
})

txdb <- TxDb.Rnorvegicus.UCSC.rn7.refGene
anno_list <- lapply(peak_list, function(peaks) {
    annotatePeak(
        peaks,
        TxDb = txdb,
        level = "gene",
        verbose = FALSE
    )
})

annotation_plot <- plotAnnoBar(anno_list) +
    labs(title = "Genomic Feature Distribution of ATAC-seq Peaks") +
    web_theme
save_web_plot(annotation_plot, "Annotation_comparison.png", width = 10, height = 6)

tss_plot <- plotDistToTSS(anno_list) +
    labs(title = "Distribution of Peaks Relative to TSS") +
    web_theme
save_web_plot(tss_plot, "TSS_distance_profile.png", width = 10, height = 6)

bigwig_files <- setNames(
    file.path(external_data_dir, samples, "tracks", paste0(samples, ".CPM.bw")),
    samples
)
stopifnot(all(file.exists(bigwig_files)))

message("Building the consensus-peak signal matrix")
consensus <- reduce(Reduce(c, peak_list))
signal_matrix <- sapply(bigwig_files, function(path) {
    signal <- import(path, format = "BigWig", which = consensus)
    overlaps <- findOverlaps(consensus, signal)
    scores <- numeric(length(consensus))
    grouped_scores <- split(signal$score[subjectHits(overlaps)], queryHits(overlaps))
    score_index <- as.integer(names(grouped_scores))
    scores[score_index] <- vapply(grouped_scores, mean, numeric(1), na.rm = TRUE)
    scores
})

signal_filtered <- signal_matrix[rowSums(signal_matrix > 0) >= 2, , drop = FALSE]
cor_mat <- cor(signal_filtered, method = "spearman")

annotation <- data.frame(
    Region = sample_meta$region,
    row.names = sample_meta$sample
)
annotation_colors <- list(Region = region_colors)

heatmap <- pheatmap(
    cor_mat,
    display_numbers = TRUE,
    number_format = "%.3f",
    color = colorRampPalette(brewer.pal(9, "YlOrRd"))(100),
    annotation_row = annotation,
    annotation_col = annotation,
    annotation_colors = annotation_colors,
    border_color = "#94a3b8",
    fontsize = 11,
    treeheight_row = 48,
    treeheight_col = 48,
    main = NA,
    silent = TRUE
)

png(
    file.path(output_dir, "Sample_correlation_heatmap.png"),
    width = 3000,
    height = 1980,
    res = 300,
    bg = "white"
)
grid.arrange(
    textGrob(
        "Spearman Correlation of ATAC-seq Signal (CPM)",
        gp = gpar(fontsize = 18, fontface = "bold")
    ),
    nullGrob(),
    heatmap$gtable,
    ncol = 1,
    heights = unit(c(0.48, 0.24, 5.88), "in")
)
dev.off()

log_signal <- log2(signal_filtered + 1)
pca_result <- prcomp(t(log_signal), center = TRUE, scale. = TRUE)
pca_data <- as.data.frame(pca_result$x[, 1:2])
pca_data$sample <- rownames(pca_data)
pca_data$region <- sample_meta$region[match(pca_data$sample, sample_meta$sample)]
variance_explained <- round(summary(pca_result)$importance[2, 1:2] * 100, 1)

pca_plot <- ggplot(
    pca_data,
    aes(x = PC1, y = PC2, color = region, label = sample)
) +
    geom_point(size = 5, alpha = 0.8) +
    geom_text_repel(
        size = 3.5,
        box.padding = 0.65,
        point.padding = 0.55,
        min.segment.length = 0,
        max.overlaps = Inf,
        show.legend = FALSE,
        seed = 42
    ) +
    scale_color_manual(values = region_colors) +
    scale_x_continuous(expand = expansion(mult = c(0.16, 0.16))) +
    scale_y_continuous(expand = expansion(mult = c(0.16, 0.2))) +
    labs(
        title = "PCA of ATAC-seq Signal Across Samples",
        x = paste0("PC1 (", variance_explained[1], "%)"),
        y = paste0("PC2 (", variance_explained[2], "%)"),
        color = "Region"
    ) +
    web_theme +
    theme(legend.position = "right")

save_web_plot(pca_plot, "PCA_ATAC_signal.png", width = 10, height = 6)

message(sprintf(
    "Generated five web figures in %s from %s consensus peaks",
    normalizePath(output_dir),
    format(length(consensus), big.mark = ",")
))
